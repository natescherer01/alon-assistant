import api from '../calendarApi';
import type { CreateEventRequest, CreateEventResponse } from '../../types/event';

/**
 * Event API functions for creating and managing calendar events
 */
export const eventsApi = {
  /**
   * Create a new calendar event
   */
  createEvent: async (data: CreateEventRequest): Promise<CreateEventResponse> => {
    const response = await api.post<CreateEventResponse>('/api/events', data);
    return response.data;
  },

  /**
   * Update an existing event
   */
  updateEvent: async (id: string, data: Partial<CreateEventRequest>): Promise<CreateEventResponse> => {
    const response = await api.put<CreateEventResponse>(`/api/events/${id}`, data);
    return response.data;
  },

  /**
   * Delete an event
   */
  deleteEvent: async (id: string): Promise<void> => {
    await api.delete(`/api/events/${id}`);
  },

  /**
   * Get event by ID
   */
  getEventById: async (id: string): Promise<any> => {
    const response = await api.get<{ event: any }>(`/api/events/${id}`);
    return response.data.event;
  },

  /**
   * Retry syncing a failed event
   */
  retrySync: async (id: string): Promise<CreateEventResponse> => {
    const response = await api.post<CreateEventResponse>(`/api/events/${id}/retry-sync`);
    return response.data;
  },
};

export default eventsApi;
