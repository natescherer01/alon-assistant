import { api } from '../lib/api';

export interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    timezone?: string;
    sleepStartTime?: string | null;
    sleepEndTime?: string | null;
    createdAt: string;
  };
  token?: string;
}

export interface UpdateSettingsRequest {
  timezone?: string;
  sleepStartTime?: string | null;  // "HH:MM" format or null to clear
  sleepEndTime?: string | null;    // "HH:MM" format or null to clear
}

/**
 * Authentication API functions
 */
export const authApi = {
  /**
   * Register a new user
   */
  signup: async (data: SignupRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/auth/signup', data);
    return response.data;
  },

  /**
   * Login user
   */
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/auth/login', data);
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout');
  },

  /**
   * Get current user
   */
  getMe: async (): Promise<AuthResponse> => {
    const response = await api.get<AuthResponse>('/api/auth/me');
    return response.data;
  },

  /**
   * Refresh authentication token
   */
  refresh: async (): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/auth/refresh');
    return response.data;
  },

  /**
   * Update user settings
   */
  updateSettings: async (data: UpdateSettingsRequest): Promise<AuthResponse> => {
    const response = await api.put<AuthResponse>('/api/auth/settings', data);
    return response.data;
  },
};
