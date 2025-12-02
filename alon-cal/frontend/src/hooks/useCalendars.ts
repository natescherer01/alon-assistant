import { create } from 'zustand';
import { calendarApi, type Calendar } from '../api/calendar';

interface ValidationResult {
  valid: boolean;
  calendarName?: string;
  eventCount?: number;
  error?: string;
}

interface CalendarState {
  calendars: Calendar[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCalendars: () => Promise<void>;
  disconnectCalendar: (id: string) => Promise<void>;
  syncCalendar: (id: string) => Promise<void>;
  initiateOAuth: (provider: 'GOOGLE' | 'MICROSOFT') => Promise<void>;
  validateIcsUrl: (url: string) => Promise<ValidationResult>;
  connectIcsCalendar: (url: string, displayName?: string) => Promise<void>;
  updateIcsCalendar: (connectionId: string, url?: string, displayName?: string) => Promise<void>;
  clearError: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useCalendars = create<CalendarState>((set, get) => ({
  calendars: [],
  isLoading: false,
  error: null,

  /**
   * Fetch all calendars from the API
   */
  fetchCalendars: async () => {
    set({ isLoading: true, error: null });
    try {
      const calendars = await calendarApi.getCalendars();
      set({ calendars, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch calendars';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Disconnect a calendar
   */
  disconnectCalendar: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await calendarApi.disconnectCalendar(id);
      // Remove the calendar from the local state
      const calendars = get().calendars.filter((cal) => cal.id !== id);
      set({ calendars, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to disconnect calendar';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Trigger a manual sync for a calendar
   */
  syncCalendar: async (id: string) => {
    set({ error: null });
    try {
      await calendarApi.syncCalendar(id);
      // Update the lastSyncedAt timestamp
      const calendars = get().calendars.map((cal) =>
        cal.id === id ? { ...cal, lastSyncedAt: new Date().toISOString() } : cal
      );
      set({ calendars });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to sync calendar';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * Initiate OAuth flow for a provider
   */
  initiateOAuth: async (provider: 'GOOGLE' | 'MICROSOFT') => {
    set({ isLoading: true, error: null });
    try {
      const authUrl =
        provider === 'GOOGLE'
          ? await calendarApi.getGoogleAuthUrl()
          : await calendarApi.getMicrosoftAuthUrl();

      // Redirect to OAuth URL
      window.location.href = authUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : `Failed to initiate ${provider} OAuth`;
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Clear any error messages
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Set loading state
   */
  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  /**
   * Validate an ICS calendar URL
   */
  validateIcsUrl: async (url: string) => {
    try {
      const result = await calendarApi.validateIcsUrl(url);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to validate ICS URL';
      return {
        valid: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Connect an ICS calendar
   */
  connectIcsCalendar: async (url: string, displayName?: string) => {
    set({ isLoading: true, error: null });
    try {
      const calendar = await calendarApi.connectIcsCalendar(url, displayName);
      // Add the new calendar to the list
      const calendars = [...get().calendars, calendar];
      set({ calendars, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect ICS calendar';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Update an ICS calendar connection
   */
  updateIcsCalendar: async (connectionId: string, url?: string, displayName?: string) => {
    set({ isLoading: true, error: null });
    try {
      const updatedCalendar = await calendarApi.updateIcsCalendar(connectionId, url, displayName);
      // Update the calendar in the list
      const calendars = get().calendars.map((cal) =>
        cal.id === connectionId ? updatedCalendar : cal
      );
      set({ calendars, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update ICS calendar';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },
}));
