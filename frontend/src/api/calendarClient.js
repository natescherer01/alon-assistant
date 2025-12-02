/**
 * Calendar API Client
 * Connects to the alon-cal backend for calendar functionality
 */
import axios from 'axios';

const CALENDAR_API_URL = import.meta.env.VITE_CALENDAR_API_URL || 'http://localhost:3001';

// Create axios instance for calendar API
const calendarApiClient = axios.create({
  baseURL: CALENDAR_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - use same token as main app
calendarApiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
calendarApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect - let main app handle auth state
      console.warn('Calendar API auth error - token may be invalid');
    }
    return Promise.reject(error);
  }
);

// ==================== Calendar API ====================

export const calendarAPI = {
  /**
   * Fetch all connected calendars
   */
  getCalendars: async () => {
    const response = await calendarApiClient.get('/api/calendars');
    return response.data.calendars;
  },

  /**
   * Disconnect a calendar
   */
  disconnectCalendar: async (id) => {
    await calendarApiClient.delete(`/api/calendars/${id}`);
  },

  /**
   * Sync a specific calendar
   */
  syncCalendar: async (id) => {
    await calendarApiClient.post(`/api/calendars/${id}/sync`);
  },

  /**
   * Sync all calendars
   */
  syncAllCalendars: async () => {
    await calendarApiClient.post('/api/calendars/sync-all');
  },

  /**
   * Get Google OAuth URL
   */
  getGoogleAuthUrl: async () => {
    const response = await calendarApiClient.get('/api/oauth/google/login');
    return response.data.authUrl;
  },

  /**
   * Get Microsoft OAuth URL
   */
  getMicrosoftAuthUrl: async () => {
    const response = await calendarApiClient.get('/api/oauth/microsoft/login');
    return response.data.authUrl;
  },

  /**
   * Get OAuth session data
   */
  getOAuthSession: async (sessionId) => {
    const response = await calendarApiClient.get(`/api/oauth/session/${sessionId}`);
    return response.data;
  },

  /**
   * Select Google calendars to sync
   */
  selectGoogleCalendars: async (sessionId, selectedCalendarIds) => {
    const response = await calendarApiClient.post('/api/oauth/google/select', {
      sessionId,
      selectedCalendarIds,
    });
    return response.data;
  },

  /**
   * Select Microsoft calendars to sync
   */
  selectMicrosoftCalendars: async (sessionId, selectedCalendarIds) => {
    const response = await calendarApiClient.post('/api/oauth/microsoft/select', {
      sessionId,
      selectedCalendarIds,
    });
    return response.data;
  },

  /**
   * Validate ICS subscription URL
   */
  validateIcsUrl: async (url) => {
    const response = await calendarApiClient.post('/api/calendars/ics/validate', { url });
    return response.data;
  },

  /**
   * Connect ICS calendar
   */
  connectIcsCalendar: async (url, displayName) => {
    const response = await calendarApiClient.post('/api/calendars/ics/connect', {
      url,
      displayName,
    });
    return response.data.connection;
  },

  /**
   * Update ICS calendar
   */
  updateIcsCalendar: async (connectionId, url, displayName) => {
    const response = await calendarApiClient.put(`/api/calendars/ics/${connectionId}`, {
      url,
      displayName,
    });
    return response.data.connection;
  },
};

// ==================== Events API ====================

export const eventsAPI = {
  /**
   * Get events within date range
   */
  getEvents: async (start, end) => {
    const response = await calendarApiClient.get('/api/events', {
      params: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
    return response.data;
  },

  /**
   * Get upcoming events
   */
  getUpcomingEvents: async (limit = 10) => {
    const response = await calendarApiClient.get('/api/events/upcoming', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get event by ID
   */
  getEventById: async (id) => {
    const response = await calendarApiClient.get(`/api/events/${id}`);
    return response.data.event;
  },

  /**
   * Create event
   */
  createEvent: async (eventData) => {
    const response = await calendarApiClient.post('/api/events', eventData);
    return response.data;
  },

  /**
   * Update event
   */
  updateEvent: async (id, eventData) => {
    const response = await calendarApiClient.put(`/api/events/${id}`, eventData);
    return response.data;
  },

  /**
   * Delete event
   */
  deleteEvent: async (id) => {
    await calendarApiClient.delete(`/api/events/${id}`);
  },

  /**
   * Retry syncing a failed event
   */
  retrySync: async (id) => {
    const response = await calendarApiClient.post(`/api/events/${id}/retry-sync`);
    return response.data;
  },
};

export default calendarApiClient;
