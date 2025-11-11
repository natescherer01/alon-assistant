/**
 * Authentication state management using Zustand
 */
import { create } from 'zustand';
import { authAPI } from '../api/client';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authAPI.login(email, password);
      localStorage.setItem('token', data.access_token);

      // Fetch user data
      const user = await authAPI.getCurrentUser();

      set({
        token: data.access_token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  signup: async (email, password, fullName) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authAPI.signup(email, password, fullName);
      localStorage.setItem('token', data.access_token);

      // Fetch user data
      const user = await authAPI.getCurrentUser();

      set({
        token: data.access_token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      const message = error.response?.data?.detail || 'Signup failed';
      console.error('Error message:', message);
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    try {
      const user = await authAPI.getCurrentUser();
      set({ user, isAuthenticated: true });
    } catch (error) {
      localStorage.removeItem('token');
      set({ isAuthenticated: false, token: null, user: null });
    }
  },
}));

export default useAuthStore;
