import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../../api/calendar/auth';
import { calendarApi } from '../../api/calendar/calendar';

// Define User type inline to avoid import issues
export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  timezone?: string;
  sleepStartTime?: string | null;
  sleepEndTime?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// Extend user with computed name property
const enrichUser = (user: User): User => {
  if (!user.name && (user.firstName || user.lastName)) {
    return {
      ...user,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    };
  }
  return user;
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  signup: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateSettings: (data: { timezone?: string; sleepStartTime?: string | null; sleepEndTime?: string | null }) => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      signup: async (email, password, firstName, lastName) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.signup({
            email,
            password,
            firstName,
            lastName,
          });

          // Save token to localStorage
          if (response.token) {
            localStorage.setItem('token', response.token);
          }

          set({
            user: enrichUser(response.user),
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error && 'response' in error
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Signup failed'
            : 'Signup failed';
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
            user: null,
          });
          throw error;
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login({ email, password });

          // Save token to localStorage
          if (response.token) {
            localStorage.setItem('token', response.token);
          }

          set({
            user: enrichUser(response.user),
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Trigger calendar sync in background (don't await, don't block login)
          calendarApi.syncAllCalendars().catch((error) => {
            console.error('Background calendar sync failed:', error);
            // Silently fail - don't interrupt login flow
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error && 'response' in error
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Login failed'
            : 'Login failed';
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
            user: null,
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authApi.logout();
          // Clear token from localStorage
          localStorage.removeItem('token');
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error: unknown) {
          // Even if logout fails on server, clear local state
          localStorage.removeItem('token');
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const response = await authApi.getMe();
          set({
            user: enrichUser(response.user),
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: unknown) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      updateSettings: async (data: { timezone?: string; sleepStartTime?: string | null; sleepEndTime?: string | null }) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.updateSettings(data);
          set({
            user: enrichUser(response.user),
            isLoading: false,
            error: null,
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error && 'response' in error
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to update settings'
            : 'Failed to update settings';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
