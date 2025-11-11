/**
 * API Client for Personal AI Assistant
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== Auth API ====================

export const authAPI = {
  signup: async (email, password, fullName) => {
    const response = await apiClient.post('/auth/signup', {
      email,
      password,
      full_name: fullName,
    });
    return response.data;
  },

  login: async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  deleteAccount: async () => {
    await apiClient.delete('/auth/account');
  },
};

// ==================== Tasks API ====================

export const tasksAPI = {
  getTasks: async (listType = 'all', days = 7) => {
    const response = await apiClient.get('/tasks', {
      params: { list_type: listType, days },
    });
    return response.data;
  },

  getTask: async (taskId) => {
    const response = await apiClient.get(`/tasks/${taskId}`);
    return response.data;
  },

  getNextTask: async (intensityFilter = null) => {
    const response = await apiClient.get('/tasks/next', {
      params: intensityFilter ? { intensity_filter: intensityFilter } : {},
    });
    return response.data;
  },

  createTask: async (taskData) => {
    const response = await apiClient.post('/tasks', taskData);
    return response.data;
  },

  updateTask: async (taskId, updates) => {
    const response = await apiClient.patch(`/tasks/${taskId}`, updates);
    return response.data;
  },

  completeTask: async (taskId, notes = null) => {
    const response = await apiClient.post(`/tasks/${taskId}/complete`, null, {
      params: notes ? { notes } : {},
    });
    return response.data;
  },

  deleteTask: async (taskId) => {
    await apiClient.delete(`/tasks/${taskId}`);
  },

  restoreTask: async (taskId) => {
    const response = await apiClient.post(`/tasks/${taskId}/restore`);
    return response.data;
  },

  getPrerequisites: async (taskId) => {
    const response = await apiClient.get(`/tasks/${taskId}/prerequisites`);
    return response.data;
  },
};

// ==================== Chat API ====================

export const chatAPI = {
  sendMessage: async (message) => {
    const response = await apiClient.post('/chat', { message });
    return response.data;
  },

  getHistory: async (limit = 50) => {
    const response = await apiClient.get('/chat/history', {
      params: { limit },
    });
    return response.data;
  },

  clearHistory: async () => {
    await apiClient.delete('/chat/history');
  },
};

export default apiClient;
