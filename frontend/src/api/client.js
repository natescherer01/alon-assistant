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
      // Only redirect if not already on login/signup page
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/signup') {
        // Token expired or invalid - clear and redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
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

  updateProfile: async (updates) => {
    const response = await apiClient.patch('/auth/me', updates);
    return response.data;
  },

  deleteAccount: async () => {
    await apiClient.delete('/auth/account');
  },
};

// ==================== Tasks API ====================

export const tasksAPI = {
  getTasks: async (listType = 'all', days = 7, project = null) => {
    const params = { list_type: listType, days };
    if (project) {
      params.project = project;
    }
    const response = await apiClient.get('/tasks', {
      params,
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

  /**
   * Send a message and stream the response using Server-Sent Events
   * @param {string} message - The message to send
   * @param {function} onToken - Callback for each token received
   * @param {function} onDone - Callback when streaming is complete (receives task_updates)
   * @param {function} onError - Callback for errors
   * @returns {function} Cleanup function to abort the stream
   */
  sendMessageStream: (message, onToken, onDone, onError) => {
    const token = localStorage.getItem('token');
    const controller = new AbortController();

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

    console.log('🚀 Starting stream request to:', `${baseUrl}/chat/stream`);

    fetch(`${baseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    })
      .then(async (response) => {
        console.log('📡 Stream response received, status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('📭 Stream ended');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          console.log('📦 Received chunk:', chunk.substring(0, 100));
          buffer += chunk;

          // Process complete SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                console.log('📨 Parsed SSE event:', data.type, data.type === 'token' ? data.content.substring(0, 20) : '');

                if (data.type === 'token') {
                  onToken(data.content);
                } else if (data.type === 'done') {
                  onDone(data.task_updates || []);
                } else if (data.type === 'error') {
                  onError(new Error(data.message));
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e, 'Line:', line);
              }
            }
          }
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('❌ Stream error:', error);
          onError(error);
        }
      });

    // Return cleanup function
    return () => controller.abort();
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
