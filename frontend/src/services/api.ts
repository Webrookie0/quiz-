import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const authAPI = {
  login: () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  },
  logout: async () => {
    await api.get('/auth/logout');
    window.location.reload();
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const roomAPI = {
  createRoom: async (stackSize: number, requiredPlayers: number) => {
    const response = await api.post('/rooms/create', { stackSize, requiredPlayers });
    return response.data;
  },
  getRoom: async (roomId: string) => {
    const response = await api.get(`/rooms/${roomId}`);
    return response.data;
  },
  getUserRooms: async () => {
    const response = await api.get('/rooms/user/rooms');
    return response.data;
  },
  quitRoom: async (roomId: string) => {
    const response = await api.delete(`/rooms/${roomId}`);
    return response.data;
  },
  addQuestions: async (roomId: string, questions: any[]) => {
    const response = await api.post(`/rooms/${roomId}/questions`, { questions });
    return response.data;
  },
  getAllQuestions: async () => {
    const response = await api.get('/rooms/questions/all');
    return response.data;
  },
};

export const leaderboardAPI = {
  getTopUsers: async () => {
    const response = await api.get('/leaderboard');
    return response.data;
  },
};

export default api;
