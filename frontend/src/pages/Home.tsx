import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Home.css';

const Home: React.FC = () => {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    // Redirect to dashboard if user is logged in
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  const joinRoom = () => {
    if (roomId.trim()) {
      navigate(`/room/${roomId.trim()}`);
    } else {
      alert('Please enter a room ID');
    }
  };

  if (loading) {
    return (
      <div className="home-container">
        <div className="home-content">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-content">
        <h1>Quiz Application</h1>
        <p className="subtitle">Create or join quiz rooms and test your knowledge!</p>

        {!user && (
          <button onClick={login} className="primary-btn">
            Sign in with Google to Create Rooms
          </button>
        )}

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="join-section">
          <h2>Join a Room</h2>
          <div className="join-form">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Enter Room ID"
              className="room-input"
              onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
            />
            <button onClick={joinRoom} className="primary-btn">
              Join Room
            </button>
          </div>
          <p className="info-text">
            You can join rooms as a guest without signing in. Just enter the room ID and your name.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;

