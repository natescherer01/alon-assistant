import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '../../lib/queryKeys';
import calendarApi from '../../api/calendar/calendar';
import type { CalendarEvent } from '../../api/calendar/calendar';

// Constants
const EVENTS_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes
const EVENTS_GC_TIME_MS = 30 * 60 * 1000;   // 30 minutes

interface UseMonthEventsOptions {
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
}

interface UseMonthEventsResult {
  /** Events for the current month grid */
  events: CalendarEvent[];
  /** Whether events are currently loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Function to manually refetch events */
  refetch: () => void;
}

/**
 * Get the full month grid date range
 * This includes days from adjacent months that appear in the calendar grid
 */
const getMonthGridRange = (date: Date): { start: Date; end: Date } => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  // Get the Sunday before or on the first day of month
  const start = new Date(firstDay);
  start.setDate(1 - firstDay.getDay());
  start.setHours(0, 0, 0, 0);

  // Get the Saturday after or on the last day of month
  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

/**
 * Format date as YYYY-MM-DD for cache keys
 */
const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Hook to fetch and cache events for a month's calendar grid
 *
 * Features:
 * - Caches events with React Query
 * - Smart cache management (5 min stale time, 30 min garbage collection)
 * - Fetches full month grid range (including adjacent month days visible in grid)
 *
 * @param currentDate - Any date within the desired month
 * @param options - Configuration options
 * @returns Events for the month grid, loading state, error, and refetch function
 *
 * @example
 * const { events, isLoading, error, refetch } = useMonthEvents(new Date());
 */
export function useMonthEvents(
  currentDate: Date,
  options: UseMonthEventsOptions = {}
): UseMonthEventsResult {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  // Validate input
  const isValidDate = currentDate instanceof Date && !isNaN(currentDate.getTime());

  // Calculate month grid boundaries
  const { start: monthStart, end: monthEnd } = useMemo(() => {
    if (!isValidDate) {
      return getMonthGridRange(new Date());
    }
    return getMonthGridRange(currentDate);
  }, [currentDate, isValidDate]);

  // Create stable cache keys
  const startKey = formatDateKey(monthStart);
  const endKey = formatDateKey(monthEnd);

  // Main query for current month
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.calendar.eventsForRange(startKey, endKey),
    queryFn: () => calendarApi.getEvents(monthStart, monthEnd),
    enabled: enabled && isValidDate,
    staleTime: EVENTS_STALE_TIME_MS,
    gcTime: EVENTS_GC_TIME_MS,
    retry: 2,
  });

  // Handle invalid date gracefully
  if (!isValidDate) {
    console.error('Invalid date passed to useMonthEvents:', currentDate);
    return {
      events: [],
      isLoading: false,
      error: new Error('Invalid date provided'),
      refetch: () => {},
    };
  }

  return {
    events: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Get the month grid date range for a given date
 * Exported for use in AppDataLoader prefetching
 */
export { getMonthGridRange };

export default useMonthEvents;
