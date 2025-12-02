import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarApi, type Calendar } from '../../api/calendar/calendar';
import { queryKeys } from '../../lib/queryKeys';

interface ValidationResult {
  valid: boolean;
  calendarName?: string;
  eventCount?: number;
  error?: string;
}

/**
 * Hook for managing calendar connections
 * Uses React Query for caching and persistence - data persists across page navigations
 */
export function useCalendars() {
  const queryClient = useQueryClient();

  // Fetch calendars with React Query caching
  const {
    data: calendars = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.calendar.calendars(),
    queryFn: () => calendarApi.getCalendars(),
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch if data is fresh
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention
    retry: 1,
  });

  // Disconnect calendar mutation
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => calendarApi.disconnectCalendar(id),
    onSuccess: (_, id) => {
      // Optimistically update the cache
      queryClient.setQueryData<Calendar[]>(
        queryKeys.calendar.calendars(),
        (old) => old?.filter((cal) => cal.id !== id) || []
      );
      // Invalidate calendar events since a calendar was removed
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events() });
    },
  });

  // Sync calendar mutation
  const syncMutation = useMutation({
    mutationFn: (id: string) => calendarApi.syncCalendar(id),
    onSuccess: (_, id) => {
      // Update lastSyncedAt in cache
      queryClient.setQueryData<Calendar[]>(
        queryKeys.calendar.calendars(),
        (old) =>
          old?.map((cal) =>
            cal.id === id ? { ...cal, lastSyncedAt: new Date().toISOString() } : cal
          ) || []
      );
      // Invalidate events to get fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events() });
    },
  });

  // Connect ICS calendar mutation
  const connectIcsMutation = useMutation({
    mutationFn: ({ url, displayName }: { url: string; displayName?: string }) =>
      calendarApi.connectIcsCalendar(url, displayName),
    onSuccess: (newCalendar) => {
      // Add new calendar to cache
      queryClient.setQueryData<Calendar[]>(
        queryKeys.calendar.calendars(),
        (old) => [...(old || []), newCalendar]
      );
      // Invalidate events to fetch from new calendar
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events() });
    },
  });

  // Update ICS calendar mutation
  const updateIcsMutation = useMutation({
    mutationFn: ({
      connectionId,
      url,
      displayName,
    }: {
      connectionId: string;
      url?: string;
      displayName?: string;
    }) => calendarApi.updateIcsCalendar(connectionId, url, displayName),
    onSuccess: (updatedCalendar) => {
      // Update calendar in cache
      queryClient.setQueryData<Calendar[]>(
        queryKeys.calendar.calendars(),
        (old) =>
          old?.map((cal) => (cal.id === updatedCalendar.id ? updatedCalendar : cal)) || []
      );
    },
  });

  // Initiate OAuth (redirects to provider)
  const initiateOAuth = async (provider: 'GOOGLE' | 'MICROSOFT') => {
    try {
      const authUrl =
        provider === 'GOOGLE'
          ? await calendarApi.getGoogleAuthUrl()
          : await calendarApi.getMicrosoftAuthUrl();

      window.location.href = authUrl;
    } catch (err) {
      throw new Error(`Failed to initiate ${provider} OAuth`);
    }
  };

  // Validate ICS URL (doesn't need caching)
  const validateIcsUrl = async (url: string): Promise<ValidationResult> => {
    try {
      const result = await calendarApi.validateIcsUrl(url);
      return result;
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : 'Failed to validate ICS URL',
      };
    }
  };

  // Wrapper for fetchCalendars that returns a Promise<void> for backwards compatibility
  const fetchCalendars = async (): Promise<void> => {
    await refetch();
  };

  return {
    calendars,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,

    // Actions
    fetchCalendars,
    disconnectCalendar: (id: string) => disconnectMutation.mutateAsync(id),
    syncCalendar: (id: string) => syncMutation.mutateAsync(id),
    initiateOAuth,
    validateIcsUrl,
    connectIcsCalendar: (url: string, displayName?: string) =>
      connectIcsMutation.mutateAsync({ url, displayName }),
    updateIcsCalendar: (connectionId: string, url?: string, displayName?: string) =>
      updateIcsMutation.mutateAsync({ connectionId, url, displayName }),

    // Loading states for mutations
    isDisconnecting: disconnectMutation.isPending,
    isSyncing: syncMutation.isPending,
    isConnecting: connectIcsMutation.isPending,

    // Clear error (for backwards compatibility - React Query handles this)
    clearError: () => {},
    setLoading: () => {},
  };
}

// Default export for backwards compatibility
export default useCalendars;
