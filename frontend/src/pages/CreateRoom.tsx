import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomAPI } from '../services/api';
import './CreateRoom.css';

interface Question {
  question: string;
  type: 'objective' | 'subjective';
  options?: string[];
  correctAnswer: number | string;
  explanation?: string;
  useAI?: boolean;
}

const CreateRoom: React.FC = () => {
  const navigate = useNavigate();
  const [stackSize, setStackSize] = useState<number | ''>(5);
  const [requiredPlayers, setRequiredPlayers] = useState<number | ''>(2);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Question>({
    question: '',
    type: 'objective',
    options: ['', ''],
    correctAnswer: 0,
    explanation: '',
    useAI: true,
  });

  const createRoom = async () => {
    if (!stackSize || !requiredPlayers || stackSize < 1 || requiredPlayers < 1) {
      alert('Please enter valid values for stack size and required players');
      return;
    }
    try {
      const data = await roomAPI.createRoom(Number(stackSize), Number(requiredPlayers));
      setRoomId(data.roomId);
      alert(`Room created! Room Code: ${data.roomId}`);
    } catch (error: any) {
      alert(`Error creating room: ${error.response?.data?.error || error.message}`);
    }
  };

  const addQuestion = () => {
    if (!newQuestion.question.trim()) {
      alert('Please enter a question');
      return;
    }

    if (newQuestion.type === 'objective') {
      if (!newQuestion.options || newQuestion.options.some((opt) => !opt.trim())) {
        alert('Please fill in all options for objective questions');
        return;
      }
      if (typeof newQuestion.correctAnswer !== 'number') {
        alert('Please select a correct option');
        return;
      }
    } else {
      if (!newQuestion.correctAnswer || typeof newQuestion.correctAnswer !== 'string') {
        alert('Please enter the correct answer for subjective questions');
        return;
      }
    }

    setQuestions([...questions, { ...newQuestion }]);
    setNewQuestion({
      question: '',
      type: 'objective',
      options: ['', ''],
      correctAnswer: 0,
      explanation: '',
      useAI: true,
    });
    setShowQuestionForm(false);
  };

  const addOption = () => {
    if (newQuestion.options && newQuestion.options.length < 10) {
      setNewQuestion({
        ...newQuestion,
        options: [...newQuestion.options, ''],
      });
    }
  };

  const removeOption = (index: number) => {
    if (newQuestion.options && newQuestion.options.length > 2) {
      const newOptions = newQuestion.options.filter((_, i) => i !== index);
      const currentAnswer = typeof newQuestion.correctAnswer === 'number'
        ? newQuestion.correctAnswer
        : 0;
      setNewQuestion({
        ...newQuestion,
        options: newOptions,
        correctAnswer: currentAnswer >= newOptions.length ? 0 : currentAnswer,
      });
    }
  };

  const saveQuestionsToRoom = async () => {
    if (!roomId) {
      alert('Please create a room first');
      return;
    }
    if (questions.length < Number(stackSize)) {
      alert(`Please add at least ${stackSize} questions`);
      return;
    }
    try {
      await roomAPI.addQuestions(roomId, questions.slice(0, 20));
      alert('Questions saved to room successfully!');
      navigate(`/room/${roomId}`);
    } catch (error: any) {
      alert(`Error saving questions: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleQuestionTypeChange = (type: 'objective' | 'subjective') => {
    setNewQuestion({
      question: newQuestion.question,
      type,
      options: type === 'objective' ? ['', ''] : undefined,
      correctAnswer: type === 'objective' ? 0 : '',
      explanation: newQuestion.explanation,
      useAI: true,
    });
  };

  return (
    <div className="create-room-container">
      <div className="create-room-content">
        <header className="create-room-header">
          <h1>Create Quiz Room</h1>
          <button onClick={() => navigate('/dashboard')} className="btn secondary-btn">← Back</button>
        </header>

        {!roomId ? (
          <div className="room-setup-section">
            <h2 style={{ marginBottom: '20px' }}>Room Settings</h2>
            <div className="form-group">
              <label>Number of Questions (Stack Size):</label>
              <input
                type="number"
                min="1"
                max="20"
                value={stackSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setStackSize(val === '' ? '' : Number(val));
                }}
                placeholder="Enter number of questions"
              />
              <small style={{ color: 'var(--text-muted)', marginTop: '5px', display: 'block' }}>Maximum 20 questions allowed</small>
            </div>
            <div className="form-group">
              <label>Required Players:</label>
              <input
                type="number"
                min="1"
                value={requiredPlayers}
                onChange={(e) => {
                  const val = e.target.value;
                  setRequiredPlayers(val === '' ? '' : Number(val));
                }}
                placeholder="Enter required players"
              />
              <small style={{ color: 'var(--text-muted)', marginTop: '5px', display: 'block' }}>Minimum number of players needed to start the quiz</small>
            </div>
            <button onClick={createRoom} className="btn primary-btn" style={{ width: '100%', marginTop: '20px' }}>Create Room</button>
          </div>
        ) : (
          <div className="questions-section">
            <div className="room-info">
              <h2>Room Code: <span className="room-code">{roomId}</span></h2>
              <p style={{ color: 'var(--text-secondary)' }}>Share this code with players to join your quiz</p>
            </div>

            <div className="question-management">
              <h3>Add Questions ({questions.length}/{stackSize || 0})</h3>
              {!showQuestionForm ? (
                <button onClick={() => setShowQuestionForm(true)} className="btn primary-btn">
                  + Add Question
                </button>
              ) : (
                <div className="question-form animate-fade-in">
                  <div className="form-group">
                    <label>Question Type:</label>
                    <div className="type-selector">
                      <button
                        className={newQuestion.type === 'objective' ? 'active' : ''}
                        onClick={() => handleQuestionTypeChange('objective')}
                      >
                        Objective (Multiple Choice)
                      </button>
                      <button
                        className={newQuestion.type === 'subjective' ? 'active' : ''}
                        onClick={() => handleQuestionTypeChange('subjective')}
                      >
                        Subjective (Text Answer)
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Question:</label>
                    <textarea
                      value={newQuestion.question}
                      onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                      rows={3}
                      placeholder="Enter your question here"
                    />
                  </div>

                  {newQuestion.type === 'objective' ? (
                    <>
                      <div className="form-group">
                        <label>Options:</label>
                        {newQuestion.options?.map((opt, index) => (
                          <div key={index} className="option-row">
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={newQuestion.correctAnswer === index}
                              onChange={() => setNewQuestion({ ...newQuestion, correctAnswer: index })}
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOptions = [...(newQuestion.options || [])];
                                newOptions[index] = e.target.value;
                                setNewQuestion({ ...newQuestion, options: newOptions });
                              }}
                              placeholder={`Option ${index + 1}`}
                            />
                            {newQuestion.options && newQuestion.options.length > 2 && (
                              <button onClick={() => removeOption(index)} className="remove-btn">×</button>
                            )}
                          </div>
                        ))}
                        {newQuestion.options && newQuestion.options.length < 10 && (
                          <button onClick={addOption} className="add-option-btn">+ Add Option</button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label>Correct Answer:</label>
                        <input
                          type="text"
                          value={newQuestion.correctAnswer as string}
                          onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                          placeholder="Enter the correct answer for AI analysis"
                        />
                      </div>
                      <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
                        <input
                          type="checkbox"
                          id="use-ai"
                          checked={newQuestion.useAI !== false}
                          onChange={(e) => setNewQuestion({ ...newQuestion, useAI: e.target.checked })}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)' }}
                        />
                        <label htmlFor="use-ai" style={{ marginBottom: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-primary)' }}>
                          ✨ Analyze with AI
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '5px' }}>(Get 0-100 score + feedback)</span>
                        </label>
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label>Explanation (optional):</label>
                    <textarea
                      value={newQuestion.explanation}
                      onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                      rows={2}
                      placeholder="Explain why this is the correct answer"
                    />
                  </div>

                  <div className="form-actions">
                    <button onClick={addQuestion} className="btn primary-btn">Add Question</button>
                    <button onClick={() => setShowQuestionForm(false)} className="btn secondary-btn">Cancel</button>
                  </div>
                </div>
              )}

              {questions.length > 0 && (
                <div className="questions-list">
                  <h3>Added Questions:</h3>
                  {questions.map((q, index) => (
                    <div key={index} className="question-item animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                      <div className="question-header">
                        <div>
                          <strong>Q{index + 1}:</strong>
                          <span className="question-type-badge">{q.type}</span>
                          {q.type === 'subjective' && q.useAI && (
                            <span className="question-type-badge" style={{ background: 'rgba(0, 240, 255, 0.2)', color: 'var(--secondary-color)' }}>
                              ✨ AI
                            </span>
                          )}
                        </div>
                        <button
                          className="remove-question-btn"
                          onClick={() => {
                            const newQuestions = questions.filter((_, i) => i !== index);
                            setQuestions(newQuestions);
                          }}
                          title="Remove Question"
                        >
                          ×
                        </button>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>{q.question}</p>
                      {q.type === 'objective' && q.options && (
                        <div className="options-preview">
                          {q.options.map((opt, optIndex) => (
                            <span key={optIndex} className={optIndex === q.correctAnswer ? 'correct' : ''}>
                              {optIndex + 1}. {opt} {optIndex === q.correctAnswer && '✓'}
                            </span>
                          ))}
                        </div>
                      )}
                      {q.type === 'subjective' && (
                        <div className="answer-preview">
                          <strong>Correct Answer:</strong> {q.correctAnswer}
                        </div>
                      )}
                    </div>
                  ))}
                  {questions.length >= Number(stackSize) && (
                    <button onClick={saveQuestionsToRoom} className="save-btn glass-card">
                      Save Questions and Enter Room →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateRoom;
