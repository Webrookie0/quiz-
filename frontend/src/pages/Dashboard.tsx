import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { roomAPI } from '../services/api';
import './Dashboard.css';

interface Room {
  _id: string;
  roomId: string;
  stackSize: number;
  requiredPlayers: number;
  status: string;
  participants: any[];
  createdAt: string;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserRooms();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadUserRooms = async () => {
    try {
      const rooms = await roomAPI.getUserRooms();
      setUserRooms(rooms);
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      navigate(`/room/${roomId.trim()}`);
    } else {
      alert('Please enter a room code');
    }
  };

  const createRoom = () => {
    navigate('/create-room');
  };

  const handleQuitRoom = async (roomIdToDelete: string) => {
    if (window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      try {
        await roomAPI.quitRoom(roomIdToDelete);
        await loadUserRooms();
        alert('Room deleted successfully');
      } catch (error: any) {
        alert(`Error deleting room: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Quiz Dashboard</h1>
          {user && (
            <div className="user-section">
              <img src={user.picture} alt={user.name} className="user-avatar" />
              <span className="user-name">{user.name}</span>
              <button onClick={logout} className="logout-btn">Logout</button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-content">
        <div className="action-cards">
          <div className="action-card create-card">
            <h2>Create a Room</h2>
            <p>Set up a new quiz room with custom questions</p>
            <button onClick={createRoom} className="primary-btn">
              Create Room
            </button>
          </div>

          <div className="action-card join-card">
            <h2>Join a Room</h2>
            <p>Enter a room code to join an existing quiz</p>
            <div className="join-form">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter Room Code"
                className="room-input"
                onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
                maxLength={8}
              />
              <button onClick={joinRoom} className="primary-btn">
                Join Room
              </button>
            </div>
          </div>
        </div>

        {user && (
          <div className="my-rooms-section">
            <h2>My Rooms</h2>
            {loading ? (
              <p>Loading...</p>
            ) : userRooms.length === 0 ? (
              <p className="no-rooms">You haven't created any rooms yet. Create one to get started!</p>
            ) : (
              <div className="rooms-grid">
                {userRooms.map((room) => (
                  <div key={room._id} className="room-card">
                    <div className="room-header">
                      <h3>Room: {room.roomId}</h3>
                      <span className={`status-badge ${room.status}`}>{room.status}</span>
                    </div>
                    <div className="room-details">
                      <p><strong>Questions:</strong> {room.stackSize}</p>
                      <p><strong>Required Players:</strong> {room.requiredPlayers}</p>
                      <p><strong>Current Players:</strong> {room.participants.length}</p>
                      <p><strong>Created:</strong> {new Date(room.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="room-actions">
                      <button 
                        onClick={() => navigate(`/room/${room.roomId}`)} 
                        className="join-room-btn"
                      >
                        Enter Room
                      </button>
                      <button 
                        onClick={() => handleQuitRoom(room.roomId)} 
                        className="quit-room-btn"
                      >
                        Quit Room
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

