/**
 * Calendar API Client
 * Connects to the FastAPI backend for calendar functionality
 */
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const CALENDAR_BASE = `${API_URL}/api/v1/calendar`;

// Create axios instance for calendar API
const calendarApiClient = axios.create({
  baseURL: CALENDAR_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
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
    const response = await calendarApiClient.get('/calendars');
    return response.data.calendars || response.data;
  },

  /**
   * Disconnect a calendar
   */
  disconnectCalendar: async (id) => {
    await calendarApiClient.delete(`/calendars/${id}`);
  },

  /**
   * Sync a specific calendar
   */
  syncCalendar: async (id) => {
    await calendarApiClient.post(`/calendars/${id}/sync`);
  },

  /**
   * Sync all calendars
   */
  syncAllCalendars: async () => {
    await calendarApiClient.post('/calendars/sync-all');
  },

  /**
   * Get Google OAuth URL
   */
  getGoogleAuthUrl: async () => {
    const response = await calendarApiClient.get('/oauth/google/login');
    return response.data.auth_url || response.data.authUrl;
  },

  /**
   * Get Microsoft OAuth URL
   */
  getMicrosoftAuthUrl: async () => {
    const response = await calendarApiClient.get('/oauth/microsoft/login');
    return response.data.auth_url || response.data.authUrl;
  },

  /**
   * Get OAuth session data
   */
  getOAuthSession: async (sessionId) => {
    const response = await calendarApiClient.get(`/oauth/session/${sessionId}`);
    return response.data;
  },

  /**
   * Select Google calendars to sync
   */
  selectGoogleCalendars: async (sessionId, selectedCalendarIds) => {
    const response = await calendarApiClient.post('/oauth/google/select', {
      session_id: sessionId,
      selected_calendar_ids: selectedCalendarIds,
    });
    return response.data;
  },

  /**
   * Select Microsoft calendars to sync
   */
  selectMicrosoftCalendars: async (sessionId, selectedCalendarIds) => {
    const response = await calendarApiClient.post('/oauth/microsoft/select', {
      session_id: sessionId,
      selected_calendar_ids: selectedCalendarIds,
    });
    return response.data;
  },

  /**
   * Validate ICS subscription URL
   */
  validateIcsUrl: async (url) => {
    const response = await calendarApiClient.post('/ics/validate', { url });
    return response.data;
  },

  /**
   * Connect ICS calendar
   */
  connectIcsCalendar: async (url, displayName) => {
    const response = await calendarApiClient.post('/ics/connect', {
      url,
      display_name: displayName,
    });
    return response.data.connection;
  },

  /**
   * Update ICS calendar
   */
  updateIcsCalendar: async (connectionId, url, displayName) => {
    const response = await calendarApiClient.put(`/ics/${connectionId}`, {
      url,
      display_name: displayName,
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
    const response = await calendarApiClient.get('/events', {
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
    const response = await calendarApiClient.get('/events/upcoming', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get event by ID
   */
  getEventById: async (id) => {
    const response = await calendarApiClient.get(`/events/${id}`);
    return response.data.event || response.data;
  },

  /**
   * Create event
   */
  createEvent: async (eventData) => {
    const response = await calendarApiClient.post('/events', eventData);
    return response.data;
  },

  /**
   * Update event
   */
  updateEvent: async (id, eventData) => {
    const response = await calendarApiClient.put(`/events/${id}`, eventData);
    return response.data;
  },

  /**
   * Delete event
   */
  deleteEvent: async (id) => {
    await calendarApiClient.delete(`/events/${id}`);
  },

  /**
   * Retry syncing a failed event
   */
  retrySync: async (id) => {
    const response = await calendarApiClient.post(`/events/${id}/retry-sync`);
    return response.data;
  },
};

export default calendarApiClient;
