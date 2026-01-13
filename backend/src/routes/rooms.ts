import express from 'express';
import type { Request, Response } from 'express';

import Room from '../models/Room.js';
import Question from '../models/Question.js';
import { v4 as uuidv4 } from 'uuid';
import { evaluateSubjectiveAnswer } from '../services/llmService.js';

const router = express.Router();

// Middleware to check if user is authenticated (optional)
const optionalAuth = (req: Request, res: Response, next: Function) => {
  // Allow both authenticated and unauthenticated users
  next();
};

// Create a new room (admin only)
router.post('/create', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { stackSize, requiredPlayers } = req.body;
    const adminId = (req.user as any)?._id?.toString() || 'anonymous';

    if (!stackSize || !requiredPlayers) {
      return res.status(400).json({ error: 'stackSize and requiredPlayers are required' });
    }

    if (stackSize < 1 || stackSize > 20) {
      return res.status(400).json({ error: 'stackSize must be between 1 and 20' });
    }

    if (requiredPlayers < 1) {
      return res.status(400).json({ error: 'requiredPlayers must be at least 1' });
    }

    const roomId = uuidv4().substring(0, 8).toUpperCase();

    const room = await Room.create({
      roomId,
      adminId,
      stackSize,
      requiredPlayers,
      participants: [],
      questions: [],
      status: 'waiting',
    });

    res.json({ roomId: room.roomId, room });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get rooms created by the logged-in user
router.get('/user/rooms', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id?.toString();
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const rooms = await Room.find({ adminId: userId }).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get room details
router.get('/:roomId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    
    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required' });
    }
    
    const room = await Room.findOne({ roomId: roomId as string }).populate('questions');

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Don't send correct answers if game hasn't started or is in progress
    const roomData = room.toObject();
    if (room.status === 'waiting' || room.status === 'in-progress') {
      roomData.questions = roomData.questions.map((q: any) => ({
        ...q,
        correctAnswer: undefined, // Hide correct answer
      }));
    }

    res.json(roomData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a room (admin only) - used by Dashboard "Quit Room" button
router.delete('/:roomId', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required' });
    }

    const userId = (req.user as any)?._id?.toString();
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const room = await Room.findOne({ roomId: roomId as string });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.adminId !== userId) {
      return res.status(403).json({ error: 'Only admin can delete the room' });
    }

    await Room.deleteOne({ roomId: roomId as string });
    res.json({ message: 'Room deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add questions to room (admin only)
router.post('/:roomId/questions', optionalAuth, async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    const { questions } = req.body; // Array of question objects

    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required' });
    }

    const room = await Room.findOne({ roomId: roomId as string });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const userId = (req.user as any)?._id?.toString();
    if (room.adminId !== userId && room.adminId !== 'anonymous' && userId) {
      return res.status(403).json({ error: 'Only admin can add questions' });
    }

    if (questions.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 questions allowed' });
    }

    const questionDocs = await Question.insertMany(questions);
    room.questions = questionDocs.map((q) => q._id);
    await room.save();

    res.json({ message: 'Questions added successfully', count: questionDocs.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all questions (for admin to manage)
router.get('/questions/all', optionalAuth, async (req: Request, res: Response) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 }).limit(20);
    res.json(questions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Evaluate a subjective answer via Gemini (LLM)
router.post('/evaluate-answer', async (req: Request, res: Response) => {
  try {
    const { question, correctAnswer, userAnswer } = req.body || {};

    if (!question || !correctAnswer || typeof userAnswer === 'undefined') {
      return res.status(400).json({ error: 'question, correctAnswer, and userAnswer are required' });
    }

    const result = await evaluateSubjectiveAnswer(String(question), String(correctAnswer), String(userAnswer));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

