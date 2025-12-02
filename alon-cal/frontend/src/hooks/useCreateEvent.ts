import { useState } from 'react';
import { eventsApi } from '../api/events';
import { useToast } from './useToast';
import type { CreateEventRequest, CreateEventResponse } from '../types/event';

interface UseCreateEventReturn {
  createEvent: (data: CreateEventRequest) => Promise<CreateEventResponse>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for creating calendar events
 * Handles API calls, loading states, and error handling
 */
export function useCreateEvent(): UseCreateEventReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success: showSuccess, error: showError } = useToast();

  const createEvent = async (data: CreateEventRequest): Promise<CreateEventResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await eventsApi.createEvent(data);

      // Show success message based on sync status
      if (response.syncStatus === 'SYNCED') {
        showSuccess('Event created successfully');
      } else if (response.syncStatus === 'PENDING') {
        showSuccess('Event created and syncing...');
      } else if (response.syncStatus === 'FAILED') {
        showError('Event created but sync failed');
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create event';
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    createEvent,
    isLoading,
    error,
    clearError,
  };
}
