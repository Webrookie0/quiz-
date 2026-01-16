import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import websocketService from '../services/websocket';
import './Room.css';

interface Participant {
  name: string;
  rollNo?: string;
}

interface Question {
  questionIndex: number;
  question: string;
  type: 'objective' | 'subjective';
  options?: string[];
  totalQuestions: number;
}

interface LeaderboardEntry {
  name: string;
  rollNo?: string;
  score: number;
  totalQuestions: number;
}

interface AnswerResult {
  questionIndex: number;
  question: string;
  type: 'objective' | 'subjective';
  userAnswer: number | string;
  correctAnswer: number | string;
  score: number;
  feedback?: string;
  options?: string[];
}

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [joined, setJoined] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [requiredPlayers, setRequiredPlayers] = useState(0);
  const [canStart, setCanStart] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string>('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerScore, setAnswerScore] = useState<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'in-progress' | 'completed'>('waiting');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answerResults, setAnswerResults] = useState<AnswerResult[]>([]);

  const wsUrlRef = useRef<string>('');

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    // Get WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';
    const wsHost = apiUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '');
    wsUrlRef.current = `${protocol}//${wsHost}/ws`;

    return () => {
      websocketService.disconnect();
    };
  }, [roomId, navigate]);

  const handleJoin = () => {
    if (!name.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!roomId) return;

    websocketService.connect(wsUrlRef.current);

    websocketService.setCallbacks({
      onJoinedRoom: (data: any) => {
        setJoined(true);
        setSocketId(data.socketId);
        setIsAdmin(true === data.isAdmin); // Ensure boolean
        setParticipants(data.participants || []);
        setRequiredPlayers(data.requiredPlayers || 0);
      },
      onPlayerJoined: (data: any) => {
        setParticipants((prev) => [...prev, { name: data.name, rollNo: data.rollNo }]);
      },
      onPlayerLeft: (data: any) => {
        if (Array.isArray(data?.participants)) {
          setParticipants(data.participants);
        }
      },
      onAdminStatus: (data: any) => {
        // Fallback if needed, but we calculate locally
      },
      onGameStarted: (data: any) => {
        setGameStatus('in-progress');
        setCurrentQuestion(data);
        setAnswerSubmitted(false);
        setSelectedAnswer('');
        setAnswerScore(null);
        setAnswerFeedback(null);
        setAnswerResults([]);
      },
      onNextQuestion: (data: any) => {
        setCurrentQuestion(data);
        setAnswerSubmitted(false);
        setSelectedAnswer('');
        setAnswerScore(null);
        setAnswerFeedback(null);
      },
      onGameCompleted: (data: any) => {
        setGameStatus('completed');
        setLeaderboard(data.leaderboard || []);
        setCurrentQuestion(null);
      },
      onAnswerRecorded: (data: any) => {
        setAnswerSubmitted(true);
        if (data.score !== undefined) {
          setAnswerScore(data.score);
        }
        if (data.feedback) {
          setAnswerFeedback(data.feedback);
        }

        // Update the answer result with server response
        setAnswerResults((prev) => {
          const updated = [...prev];
          const existing = updated[data.questionIndex];
          if (existing) {
            updated[data.questionIndex] = {
              ...existing,
              correctAnswer: data.correctAnswer || existing.correctAnswer,
              score: data.score !== undefined ? data.score : (data.isCorrect ? 100 : 0),
              feedback: data.feedback || existing.feedback,
            };
          }
          return updated;
        });
      },
      onError: (errorMsg: string) => {
        setError(errorMsg);
        alert(errorMsg);
      },
    });

    // Send join message
    setTimeout(() => {
      websocketService.send({
        type: 'join-room',
        payload: {
          roomId,
          name: name.trim(),
          rollNo: rollNo.trim() || undefined,
          userId: user?._id,
        },
      });
    }, 100);
  };

  // Effect to calculate canStart state based on fresh participants and isAdmin state
  useEffect(() => {
    if (isAdmin) {
      setCanStart(participants.length >= requiredPlayers);
    }
  }, [isAdmin, participants.length, requiredPlayers]);

  const handleStartGame = () => {
    if (!roomId) return;
    console.log('Starting game...', { roomId, userId: user?._id });
    websocketService.send({
      type: 'start-game',
      payload: { roomId, userId: user?._id },
    });
  };

  const handleAnswer = () => {
    if (!roomId || !socketId || !currentQuestion) return;

    if (currentQuestion.type === 'objective' && typeof selectedAnswer !== 'number') {
      alert('Please select an option');
      return;
    }

    if (currentQuestion.type === 'subjective' && !selectedAnswer) {
      alert('Please enter your answer');
      return;
    }

    // Store the answer locally before sending
    const answerToSend = selectedAnswer;
    const questionToSend = currentQuestion;

    websocketService.send({
      type: 'answer',
      payload: {
        roomId,
        socketId,
        questionIndex: currentQuestion.questionIndex,
        answer: selectedAnswer,
        timeTaken: 0, // You can implement timer if needed
      },
    });

    // Store answer result immediately (will be updated when server responds)
    const result: AnswerResult = {
      questionIndex: questionToSend.questionIndex,
      question: questionToSend.question,
      type: questionToSend.type,
      userAnswer: answerToSend,
      correctAnswer: '', // Will be updated from server response
      score: 0, // Will be updated from server response
      feedback: undefined,
      options: questionToSend.options,
    };

    setAnswerResults((prev) => {
      const updated = [...prev];
      updated[questionToSend.questionIndex] = result;
      return updated;
    });
  };

  const handleNextQuestion = () => {
    if (!roomId) return;
    console.log('Requesting next question/finish...', { roomId, userId: user?._id });
    websocketService.send({
      type: 'next-question',
      payload: { roomId, userId: user?._id },
    });
  };

  const handleQuit = () => {
    if (window.confirm('Are you sure you want to leave this room?')) {
      if (socketId && roomId) {
        websocketService.send({
          type: 'quit-room',
          payload: { roomId, socketId, userId: user?._id },
        });
      }
      websocketService.disconnect();
      navigate('/dashboard');
    }
  };

  if (!joined) {
    return (
      <div className="room-container">
        <div className="join-room-form">
          <h1>Join Room: {roomId}</h1>
          <div className="form-group">
            <label>Your Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>
          <div className="form-group">
            <label>Roll Number (Optional)</label>
            <input
              type="text"
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              placeholder="Enter your roll number"
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>
          <button onClick={handleJoin} className="primary-btn">
            Join Room
          </button>
          <button onClick={() => navigate('/dashboard')} className="secondary-btn">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-container">
      <header className="room-header">
        <div className="room-info">
          <h1>Room: {roomId}</h1>
          {isAdmin && <span className="admin-badge">Admin</span>}
        </div>
        <button onClick={handleQuit} className="quit-btn">
          Leave Room
        </button>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {gameStatus === 'waiting' && (
        <div className="waiting-section">
          <div className="participants-section">
            <h2>Participants ({participants.length}/{requiredPlayers})</h2>
            <div className="participants-list">
              {participants.map((p, idx) => (
                <div key={idx} className="participant-card">
                  <span className="participant-name">{p.name}</span>
                  {p.rollNo && <span className="participant-roll">{p.rollNo}</span>}
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="admin-controls">
              <button
                onClick={handleStartGame}
                disabled={!canStart}
                className={`start-btn ${!canStart ? 'disabled' : ''}`}
              >
                {canStart
                  ? 'Start Game'
                  : `Need ${requiredPlayers - participants.length} more player(s)`}
              </button>
            </div>
          )}

          {!isAdmin && (
            <div className="waiting-message">
              <p>Waiting for admin to start the game...</p>
              <p>Current players: {participants.length}/{requiredPlayers}</p>
            </div>
          )}
        </div>
      )}

      {gameStatus === 'in-progress' && currentQuestion && (
        <div className="question-section">
          <div className="question-header">
            <span className="question-number">
              Question {currentQuestion.questionIndex + 1} of {currentQuestion.totalQuestions}
            </span>
          </div>

          <div className="question-content">
            <h2>{currentQuestion.question}</h2>

            {currentQuestion.type === 'objective' && currentQuestion.options && (
              <div className="options-list">
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    className={`option-btn ${selectedAnswer === idx ? 'selected' : ''}`}
                    onClick={() => !answerSubmitted && setSelectedAnswer(idx)}
                    disabled={answerSubmitted}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'subjective' && (
              <div className="subjective-answer">
                <textarea
                  value={selectedAnswer as string}
                  onChange={(e) => !answerSubmitted && setSelectedAnswer(e.target.value)}
                  placeholder="Enter your answer"
                  disabled={answerSubmitted}
                  rows={4}
                />
              </div>
            )}

            {!answerSubmitted ? (
              <button onClick={handleAnswer} className="submit-answer-btn">
                Submit Answer
              </button>
            ) : (
              <div className="answer-submitted">
                <p>✓ Answer submitted!</p>
                {currentQuestion.type === 'subjective' && answerScore !== null && (
                  <div className="answer-evaluation">
                    <div className="score-display">
                      <span className="score-label">Score:</span>
                      <span className={`score-value ${answerScore >= 80 ? 'high' : answerScore >= 50 ? 'medium' : 'low'}`}>
                        {answerScore}/100
                      </span>
                    </div>
                    {answerFeedback && (
                      <div className="feedback-display">
                        <strong>Feedback:</strong>
                        <p>{answerFeedback}</p>
                      </div>
                    )}
                  </div>
                )}
                <p className="waiting-text">Waiting for next question...</p>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="admin-question-controls">
              <button onClick={handleNextQuestion} className="next-question-btn">
                {currentQuestion.questionIndex + 1 >= currentQuestion.totalQuestions
                  ? 'Finish Game'
                  : 'Next Question'}
              </button>
            </div>
          )}
        </div>
      )}

      {gameStatus === 'completed' && (
        <div className="leaderboard-section">
          <h2>Game Completed!</h2>

          {/* Detailed Results */}
          {answerResults.length > 0 && (
            <div className="results-section">
              <h3>Your Results</h3>
              <div className="results-summary">
                <div className="total-score">
                  <span className="score-label">Total Score:</span>
                  <span className="score-value">
                    {answerResults.reduce((sum, r) => {
                      if (r.type === 'objective') {
                        return sum + (r.score === 100 ? 1 : 0);
                      } else {
                        // For subjective, add points based on score
                        if (r.score >= 80) return sum + 1;
                        if (r.score >= 50) return sum + 0.5;
                        return sum;
                      }
                    }, 0).toFixed(1)}/{answerResults.length}
                  </span>
                </div>
              </div>

              <div className="detailed-results">
                {answerResults.map((result, idx) => (
                  <div key={idx} className="result-item">
                    <div className="result-question-header">
                      <h4>Question {result.questionIndex + 1}</h4>
                      <span className={`result-score-badge ${result.score >= 80 ? 'high' : result.score >= 50 ? 'medium' : 'low'}`}>
                        {result.type === 'objective'
                          ? (result.score === 100 ? '1/1' : '0/1')
                          : `${result.score}/100`}
                      </span>
                    </div>
                    <p className="result-question-text">{result.question}</p>

                    <div className="result-answers">
                      <div className="answer-comparison">
                        <div className="answer-item">
                          <strong>Your Answer:</strong>
                          {result.type === 'objective' && result.options ? (
                            <span>{result.options[result.userAnswer as number] || 'Not selected'}</span>
                          ) : (
                            <span>{result.userAnswer || 'No answer'}</span>
                          )}
                        </div>
                        <div className="answer-item">
                          <strong>Correct Answer:</strong>
                          <span>{result.correctAnswer}</span>
                        </div>
                      </div>

                      {result.type === 'subjective' && result.feedback && (
                        <div className="ai-feedback">
                          <strong>AI Feedback:</strong>
                          <p>{result.feedback}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3>Leaderboard</h3>
          <div className="leaderboard">
            {leaderboard.map((entry, idx) => (
              <div key={idx} className={`leaderboard-entry ${idx === 0 ? 'winner' : ''}`}>
                <div className="rank">#{idx + 1}</div>
                <div className="player-info">
                  <span className="player-name">{entry.name}</span>
                  {entry.rollNo && <span className="player-roll">{entry.rollNo}</span>}
                </div>
                <div className="score">
                  {entry.score}/{entry.totalQuestions}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/dashboard')} className="primary-btn">
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default Room;

