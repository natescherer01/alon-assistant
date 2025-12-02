import api from '../lib/api';

interface Calendar {
  id: string;
  provider: 'GOOGLE' | 'MICROSOFT' | 'ICS';
  calendarId: string;
  calendarName: string;
  calendarColor?: string;
  isPrimary: boolean;
  isConnected: boolean;
  isReadOnly?: boolean; // ICS calendars are read-only
  lastSyncedAt?: string;
  createdAt: string;
  // Microsoft-specific fields
  ownerEmail?: string; // For shared/delegated calendars
  calendarType?: 'personal' | 'shared' | 'delegated';
  isSyncing?: boolean;
  syncError?: string;
}

interface OAuthUrlResponse {
  authUrl: string;
}

interface ProviderCalendar {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isPrimary: boolean;
  accessRole?: string;
  // Microsoft-specific fields
  ownerEmail?: string;
  calendarType?: 'personal' | 'shared' | 'delegated';
}

interface OAuthCallbackResponse {
  calendars: ProviderCalendar[];
  sessionToken: string;
}

interface OAuthSessionResponse {
  provider: string;
  calendars: ProviderCalendar[];
  userId: string;
  expiresAt: string;
}

interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location?: string;
  attendees?: string[];
  provider: 'GOOGLE' | 'MICROSOFT' | 'ICS';
  calendarName: string;
  calendarColor?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  // Microsoft-specific fields
  teamsEnabled?: boolean;
  teamsMeetingUrl?: string;
  importance?: 'low' | 'normal' | 'high';
  outlookCategories?: string[];
  delegateEmail?: string; // Email of the calendar owner if this is a shared/delegated calendar event
}

export type { Calendar, OAuthUrlResponse, ProviderCalendar, OAuthCallbackResponse, OAuthSessionResponse, CalendarEvent };

/**
 * Calendar API functions for managing calendar connections
 */
export const calendarApi = {
  /**
   * Fetch all connected calendars for the authenticated user
   */
  getCalendars: async (): Promise<Calendar[]> => {
    const response = await api.get<{ calendars: Calendar[] }>('/api/calendars');
    return response.data.calendars;
  },

  /**
   * Disconnect a calendar by ID
   */
  disconnectCalendar: async (id: string): Promise<void> => {
    await api.delete(`/api/calendars/${id}`);
  },

  /**
   * Trigger a manual sync for a calendar
   */
  syncCalendar: async (id: string): Promise<void> => {
    await api.post(`/api/calendars/${id}/sync`);
  },

  /**
   * Sync all connected calendars
   */
  syncAllCalendars: async (): Promise<void> => {
    await api.post('/api/calendars/sync-all');
  },

  /**
   * Get Google OAuth authorization URL
   */
  getGoogleAuthUrl: async (): Promise<string> => {
    const response = await api.get<OAuthUrlResponse>('/api/oauth/google/login');
    return response.data.authUrl;
  },

  /**
   * Get Microsoft OAuth authorization URL
   */
  getMicrosoftAuthUrl: async (): Promise<string> => {
    const response = await api.get<OAuthUrlResponse>('/api/oauth/microsoft/login');
    return response.data.authUrl;
  },

  /**
   * Fetch OAuth session data from backend using session ID
   * This is part of the secure OAuth flow where sensitive data is stored server-side
   */
  getOAuthSession: async (sessionId: string): Promise<OAuthSessionResponse> => {
    const response = await api.get<OAuthSessionResponse>(
      `/api/oauth/session/${sessionId}`
    );
    return response.data;
  },

  /**
   * Select Google calendars to sync using session ID
   */
  selectGoogleCalendars: async (
    sessionId: string,
    selectedCalendarIds: string[]
  ): Promise<{ success: boolean }> => {
    const response = await api.post<{ success: boolean }>(
      '/api/oauth/google/select',
      {
        sessionId,
        selectedCalendarIds,
      }
    );
    return response.data;
  },

  /**
   * Select Microsoft calendars to sync using session ID
   */
  selectMicrosoftCalendars: async (
    sessionId: string,
    selectedCalendarIds: string[]
  ): Promise<{ success: boolean }> => {
    const response = await api.post<{ success: boolean }>(
      '/api/oauth/microsoft/select',
      {
        sessionId,
        selectedCalendarIds,
      }
    );
    return response.data;
  },

  /**
   * Get events from all connected calendars within a date range
   */
  getEvents: async (start: Date, end: Date): Promise<CalendarEvent[]> => {
    const response = await api.get<CalendarEvent[]>('/api/events', {
      params: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
    return response.data;
  },

  /**
   * Validate an ICS subscription URL
   */
  validateIcsUrl: async (url: string): Promise<{
    valid: boolean;
    calendarName?: string;
    eventCount?: number;
    error?: string;
  }> => {
    const response = await api.post<{
      valid: boolean;
      calendarName?: string;
      eventCount?: number;
      error?: string;
    }>('/api/calendars/ics/validate', { url });
    return response.data;
  },

  /**
   * Connect an ICS calendar subscription
   */
  connectIcsCalendar: async (url: string, displayName?: string): Promise<Calendar> => {
    const response = await api.post<{ connection: Calendar }>(
      '/api/calendars/ics/connect',
      { url, displayName }
    );
    return response.data.connection;
  },

  /**
   * Update an ICS calendar connection
   */
  updateIcsCalendar: async (
    connectionId: string,
    url?: string,
    displayName?: string
  ): Promise<Calendar> => {
    const response = await api.put<{ connection: Calendar }>(
      `/api/calendars/ics/${connectionId}`,
      { url, displayName }
    );
    return response.data.connection;
  },
};

export default calendarApi;
