import http from 'http';
import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { config } from 'dotenv';
import { connectDB } from './config/database.js';
import { initializePassport } from './config/auth.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import Room from './models/Room.js';
import User from './models/User.js';
import type { IQuestion } from './models/Question.js';
import mongoose from 'mongoose';
import { evaluateSubjectiveAnswer } from './services/llmService.js';

config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

// Express app setup
const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render load balancer)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());
initializePassport();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/leaderboard', (await import('./routes/leaderboard.js')).default);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// Store active connections by roomId and socketId
const roomConnections = new Map<string, Map<string, WebSocket>>();
const socketToRoom = new Map<string, { roomId: string; userId?: string }>();

// WebSocket connection handler
wss.on('connection', (ws: WebSocket, req) => {
  console.log('New WebSocket connection');

  ws.on('message', async (message: WebSocket.RawData) => {
    try {
      const data = JSON.parse(message.toString());
      await handleWebSocketMessage(ws, data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    handleDisconnection(ws);
  });
});

async function handleWebSocketMessage(ws: WebSocket, data: any) {
  const { type, payload } = data;

  switch (type) {
    case 'join-room':
      await handleJoinRoom(ws, payload);
      break;

    case 'start-game':
      await handleStartGame(ws, payload);
      break;

    case 'answer':
      await handleAnswer(ws, payload);
      break;

    case 'next-question':
      await handleNextQuestion(ws, payload);
      break;

    case 'quit-room':
      await handleQuitRoom(ws, payload);
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

async function handleJoinRoom(ws: WebSocket, payload: any) {
  const { roomId, name, rollNo, userId } = payload;

  if (!roomId || !name) {
    ws.send(JSON.stringify({ type: 'error', message: 'roomId and name are required' }));
    return;
  }

  try {
    const room = await Room.findOne({ roomId });

    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    if (room.status !== 'waiting') {
      ws.send(JSON.stringify({ type: 'error', message: 'Game has already started or completed' }));
      return;
    }

    // Generate socket ID
    const socketId = `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add participant
    room.participants.push({
      userId,
      name,
      rollNo,
      socketId,
      score: 0,
      answers: [],
    });

    await room.save();

    // Store connection
    if (!roomConnections.has(roomId)) {
      roomConnections.set(roomId, new Map());
    }
    roomConnections.get(roomId)!.set(socketId, ws);
    socketToRoom.set(socketId, { roomId, userId });

    const isAdmin = room.adminId === userId || (room.adminId === 'anonymous' && !userId);

    // Send confirmation
    ws.send(JSON.stringify({
      type: 'joined-room',
      payload: {
        roomId,
        socketId,
        participants: room.participants.map((p) => ({
          name: p.name,
          rollNo: p.rollNo,
        })),
        requiredPlayers: room.requiredPlayers,
        stackSize: room.stackSize,
        isAdmin,
      },
    }));

    // Notify other participants
    broadcastToRoom(roomId, socketId, {
      type: 'player-joined',
      payload: {
        name,
        rollNo,
        totalPlayers: room.participants.length,
        requiredPlayers: room.requiredPlayers,
      },
    });

    // Check if admin and can start game
    if (isAdmin) {
      ws.send(JSON.stringify({
        type: 'admin-status',
        payload: { canStart: room.participants.length >= room.requiredPlayers },
      }));
    }
  } catch (error: any) {
    console.error('Error joining room:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleStartGame(ws: WebSocket, payload: any) {
  const { roomId, userId } = payload;

  try {
    const room = await Room.findOne({ roomId }).populate('questions');

    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    // Check if user is admin
    const isAdmin = room.adminId === userId || (room.adminId === 'anonymous' && !userId);
    if (!isAdmin) {
      ws.send(JSON.stringify({ type: 'error', message: 'Only admin can start the game' }));
      return;
    }

    if (room.participants.length < room.requiredPlayers) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Need at least ${room.requiredPlayers} players to start`,
      }));
      return;
    }

    if (room.questions.length < room.stackSize) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Need at least ${room.stackSize} questions in the room`,
      }));
      return;
    }

    // Select random questions based on stackSize
    const populatedQuestions = room.questions as unknown as IQuestion[];
    const selectedQuestions = populatedQuestions
      .sort(() => Math.random() - 0.5)
      .slice(0, room.stackSize);

    if (selectedQuestions.length === 0 || !selectedQuestions[0]) {
      ws.send(JSON.stringify({ type: 'error', message: 'No questions available' }));
      return;
    }

    room.questions = selectedQuestions.map((q) => q._id as mongoose.Types.ObjectId);
    room.status = 'in-progress';
    room.currentQuestionIndex = 0;
    room.startedAt = new Date();
    await room.save();

    // Send first question to all participants
    const firstQuestion = selectedQuestions[0];
    const questionData = {
      questionIndex: 0,
      question: firstQuestion.question,
      type: firstQuestion.type,
      options: firstQuestion.options,
      totalQuestions: selectedQuestions.length,
    };

    broadcastToRoom(roomId, '', {
      type: 'game-started',
      payload: questionData,
    });
  } catch (error: any) {
    console.error('Error starting game:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleAnswer(ws: WebSocket, payload: any) {
  const { roomId, socketId, questionIndex, answer, timeTaken } = payload;

  try {
    const room = await Room.findOne({ roomId }).populate('questions');

    if (!room || room.status !== 'in-progress') {
      ws.send(JSON.stringify({ type: 'error', message: 'Game is not in progress' }));
      return;
    }

    const participant = room.participants.find((p) => p.socketId === socketId);
    if (!participant) {
      ws.send(JSON.stringify({ type: 'error', message: 'Participant not found' }));
      return;
    }

    // Check if already answered this question
    const alreadyAnswered = participant.answers.some((a) => a.questionIndex === questionIndex);
    if (alreadyAnswered) {
      ws.send(JSON.stringify({ type: 'error', message: 'Already answered this question' }));
      return;
    }

    // Record answer
    participant.answers.push({ questionIndex, answer, timeTaken });

    // Check if correct
    const populatedQuestions = room.questions as unknown as IQuestion[];
    const question = populatedQuestions[questionIndex];
    let isCorrect = false;
    let score = 0;
    let feedback = '';

    if (question) {
      if (question.type === 'objective') {
        // For objective, compare answer index
        isCorrect = question.correctAnswer === answer;
        if (isCorrect) {
          participant.score += 1;
          score = 100;
        }
      } else {
        // For subjective, check if AI evaluation is enabled
        if (question.useAI) {
          // Use LLM to evaluate
          try {
            const evaluation = await evaluateSubjectiveAnswer(
              question.question,
              String(question.correctAnswer),
              String(answer)
            );

            score = evaluation.score;
            feedback = evaluation.feedback;
            isCorrect = evaluation.isCorrect;

            // Award points based on score (100 = full point, 80+ = full point, 50-79 = half point, <50 = 0)
            if (score >= 80) {
              participant.score += 1;
            } else if (score >= 50) {
              participant.score += 0.5;
            }
          } catch (error: any) {
            console.error('Error evaluating subjective answer with AI:', error);
            // Fallback to simple comparison
            const correctAnswer = String(question.correctAnswer).toLowerCase().trim();
            const userAnswer = String(answer).toLowerCase().trim();
            isCorrect = correctAnswer === userAnswer;
            if (isCorrect) {
              participant.score += 1;
              score = 100;
            }
          }
        } else {
          // Simple string comparison (case-insensitive)
          const correctAnswer = String(question.correctAnswer).toLowerCase().trim();
          const userAnswer = String(answer).toLowerCase().trim();
          isCorrect = correctAnswer === userAnswer;
          if (isCorrect) {
            participant.score += 1;
            score = 100;
          }
        }
      }
    }

    await room.save();

    // Prepare response with question details
    const responsePayload: any = {
      questionIndex,
      isCorrect,
    };

    // Add correct answer for display
    if (question) {
      if (question.type === 'objective' && question.options) {
        responsePayload.correctAnswer = question.options[question.correctAnswer as number] || question.correctAnswer;
      } else {
        responsePayload.correctAnswer = question.correctAnswer;
      }
    }

    // Add score and feedback for subjective questions
    if (question?.type === 'subjective') {
      responsePayload.score = score;
      if (feedback) {
        responsePayload.feedback = feedback;
      }
    } else if (question?.type === 'objective') {
      // For objective, score is 100 if correct, 0 if incorrect
      responsePayload.score = isCorrect ? 100 : 0;
    }

    ws.send(JSON.stringify({
      type: 'answer-recorded',
      payload: responsePayload,
    }));
  } catch (error: any) {
    console.error('Error recording answer:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleNextQuestion(ws: WebSocket, payload: any) {
  const { roomId, userId } = payload;

  try {
    const room = await Room.findOne({ roomId }).populate('questions');

    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    // Check if user is admin
    const isAdmin = room.adminId === userId || (room.adminId === 'anonymous' && !userId);
    if (!isAdmin) {
      ws.send(JSON.stringify({ type: 'error', message: 'Only admin can advance questions' }));
      return;
    }

    if (room.status !== 'in-progress') {
      ws.send(JSON.stringify({ type: 'error', message: 'Game is not in progress' }));
      return;
    }

    const nextIndex = room.currentQuestionIndex + 1;

    if (nextIndex >= room.questions.length) {
      // Game completed
      room.status = 'completed';
      room.completedAt = new Date();
      await room.save();

      await room.save();

      // Update global stats for all participants
      for (const p of room.participants) {
        if (p.userId) {
          try {
            await User.findByIdAndUpdate(p.userId, {
              $inc: {
                totalScore: p.score,
                gamesPlayed: 1
              }
            });
          } catch (err) {
            console.error(`Error updating stats for user ${p.userId}:`, err);
          }
        }
      }

      // Send final scores
      const leaderboard = room.participants
        .map((p) => ({
          name: p.name,
          rollNo: p.rollNo,
          score: p.score,
          totalQuestions: room.questions.length,
        }))
        .sort((a, b) => b.score - a.score);

      broadcastToRoom(roomId, '', {
        type: 'game-completed',
        payload: { leaderboard },
      });
    } else {
      room.currentQuestionIndex = nextIndex;
      await room.save();

      const populatedQuestions = room.questions as unknown as IQuestion[];
      const question = populatedQuestions[nextIndex];

      if (!question) {
        ws.send(JSON.stringify({ type: 'error', message: 'Question not found' }));
        return;
      }

      broadcastToRoom(roomId, '', {
        type: 'next-question',
        payload: {
          questionIndex: nextIndex,
          question: question.question,
          type: question.type,
          options: question.options,
          totalQuestions: populatedQuestions.length,
        },
      });
    }
  } catch (error: any) {
    console.error('Error advancing question:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleQuitRoom(ws: WebSocket, payload: any) {
  const { roomId, socketId, userId } = payload;

  try {
    const room = await Room.findOne({ roomId });

    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    // Check if user is admin
    const isAdmin = room.adminId === userId || (room.adminId === 'anonymous' && !userId);

    if (isAdmin) {
      // Admin quitting deletes the room
      await Room.deleteOne({ roomId });
      broadcastToRoom(roomId, '', {
        type: 'room-deleted',
        payload: { message: 'Room has been deleted by admin' },
      });
    } else {
      // Regular participant just leaves
      if (room.status === 'waiting') {
        const leaving = room.participants.find((p) => p.socketId === socketId);
        room.participants = room.participants.filter((p) => p.socketId !== socketId);
        await room.save();

        // Notify others
        broadcastToRoom(roomId, socketId, {
          type: 'player-left',
          payload: {
            name: leaving?.name,
            rollNo: leaving?.rollNo,
            totalPlayers: room.participants.length,
            participants: room.participants.map((p) => ({ name: p.name, rollNo: p.rollNo })),
          },
        });
      }
    }

    // Remove connection
    const connections = roomConnections.get(roomId);
    if (connections) {
      connections.delete(socketId);
    }
    socketToRoom.delete(socketId);

    ws.send(JSON.stringify({ type: 'quit-success', payload: { roomId } }));
  } catch (error: any) {
    console.error('Error quitting room:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

function broadcastToRoom(roomId: string, excludeSocketId: string, message: any) {
  const connections = roomConnections.get(roomId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  connections.forEach((ws, socketId) => {
    if (socketId !== excludeSocketId && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

function handleDisconnection(ws: WebSocket) {
  // Find and remove connection
  for (const [socketId, roomInfo] of socketToRoom.entries()) {
    const connections = roomConnections.get(roomInfo.roomId);
    if (connections?.has(socketId)) {
      connections.delete(socketId);
      socketToRoom.delete(socketId);

      // Remove participant from room
      Room.findOne({ roomId: roomInfo.roomId }).then((room) => {
        if (room && room.status === 'waiting') {
          const leaving = room.participants.find((p) => p.socketId === socketId);
          room.participants = room.participants.filter((p) => p.socketId !== socketId);
          room
            .save()
            .then(() => {
              broadcastToRoom(roomInfo.roomId, '', {
                type: 'player-left',
                payload: {
                  name: leaving?.name,
                  rollNo: leaving?.rollNo,
                  totalPlayers: room.participants.length,
                  participants: room.participants.map((p) => ({ name: p.name, rollNo: p.rollNo })),
                },
              });
            })
            .catch((err) => console.error('Error saving room after disconnect:', err));
        }
      });

      break;
    }
  }
}

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`WebSocket server is listening on ws://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    const allowNoDb = String(process.env.ALLOW_START_WITHOUT_DB || '').toLowerCase() === 'true';

    if (!allowNoDb) {
      console.error('Database connection failed; refusing to start server without DB.');
      console.error('Fix MONGODB_URI / Atlas IP allowlist, or set ALLOW_START_WITHOUT_DB=true for limited LLM-only testing.');
      console.error(err?.message || err);
      process.exit(1);
    }

    console.warn('Database connection failed; starting server WITHOUT DB because ALLOW_START_WITHOUT_DB=true.');
    console.warn('DB-backed routes (auth/rooms) will error until Mongo connects.');
    console.warn(err?.message || err);

    server.listen(PORT, () => {
      console.log(`Server is running (no DB) on http://localhost:${PORT}`);
      console.log(`WebSocket server is listening on ws://localhost:${PORT}`);
    });
  });
