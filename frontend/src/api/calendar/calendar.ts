import api from '../calendarApi';

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
    const response = await api.get<{ calendars: Calendar[] } | Calendar[]>('/calendars');
    // Handle both response formats
    return Array.isArray(response.data) ? response.data : response.data.calendars;
  },

  /**
   * Disconnect a calendar by ID
   */
  disconnectCalendar: async (id: string): Promise<void> => {
    await api.delete(`/calendars/${id}`);
  },

  /**
   * Trigger a manual sync for a calendar
   */
  syncCalendar: async (id: string): Promise<void> => {
    await api.post(`/calendars/${id}/sync`);
  },

  /**
   * Sync all connected calendars
   */
  syncAllCalendars: async (): Promise<void> => {
    await api.post('/calendars/sync-all');
  },

  /**
   * Get Google OAuth authorization URL
   */
  getGoogleAuthUrl: async (): Promise<string> => {
    const response = await api.get<{ auth_url?: string; authUrl?: string }>('/oauth/google/login');
    return response.data.auth_url || response.data.authUrl || '';
  },

  /**
   * Get Microsoft OAuth authorization URL
   */
  getMicrosoftAuthUrl: async (): Promise<string> => {
    const response = await api.get<{ auth_url?: string; authUrl?: string }>('/oauth/microsoft/login');
    return response.data.auth_url || response.data.authUrl || '';
  },

  /**
   * Fetch OAuth session data from backend using session ID
   * This is part of the secure OAuth flow where sensitive data is stored server-side
   */
  getOAuthSession: async (sessionId: string): Promise<OAuthSessionResponse> => {
    const response = await api.get<OAuthSessionResponse>(
      `/oauth/session/${sessionId}`
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
      '/oauth/google/select',
      {
        session_id: sessionId,
        selected_calendar_ids: selectedCalendarIds,
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
      '/oauth/microsoft/select',
      {
        session_id: sessionId,
        selected_calendar_ids: selectedCalendarIds,
      }
    );
    return response.data;
  },

  /**
   * Get events from all connected calendars within a date range
   */
  getEvents: async (start: Date, end: Date): Promise<CalendarEvent[]> => {
    const response = await api.get<CalendarEvent[]>('/events', {
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
    }>('/ics/validate', { url });
    return response.data;
  },

  /**
   * Connect an ICS calendar subscription
   */
  connectIcsCalendar: async (url: string, displayName?: string): Promise<Calendar> => {
    const response = await api.post<{ connection: Calendar }>(
      '/ics/connect',
      { url, display_name: displayName }
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
      `/ics/${connectionId}`,
      { url, display_name: displayName }
    );
    return response.data.connection;
  },
};

export default calendarApi;
