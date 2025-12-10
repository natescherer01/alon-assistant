import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useMemo } from 'react';
import { queryKeys } from '../../lib/queryKeys';
import calendarApi from '../../api/calendar/calendar';
import type { CalendarEvent } from '../../api/calendar/calendar';

// Constants
const EVENTS_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes
const EVENTS_GC_TIME_MS = 30 * 60 * 1000;   // 30 minutes
const DEFAULT_PREFETCH_DISTANCE = 2;        // Prefetch 2 weeks in each direction

interface UseWeekEventsOptions {
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
  /** Number of weeks to prefetch in each direction (default: 2) */
  prefetchDistance?: number;
}

interface UseWeekEventsResult {
  /** Events for the current week */
  events: CalendarEvent[];
  /** Whether events are currently loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Function to manually refetch events */
  refetch: () => void;
}

/**
 * Get the start of week (Sunday) for a given date
 */
const getWeekStart = (date: Date): Date => {
  const result = new Date(date);
  result.setDate(date.getDate() - date.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Get the end of week (Saturday) for a given date
 */
const getWeekEnd = (weekStart: Date): Date => {
  const result = new Date(weekStart);
  result.setDate(weekStart.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
};

/**
 * Add weeks to a date
 */
const addWeeks = (date: Date, weeks: number): Date => {
  const result = new Date(date);
  result.setDate(date.getDate() + weeks * 7);
  return result;
};

/**
 * Format date as YYYY-MM-DD for cache keys
 */
const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Hook to fetch and cache events for a specific week with automatic prefetching
 *
 * Features:
 * - Caches events with React Query
 * - Automatically prefetches adjacent weeks (±2 by default)
 * - Smart cache management (5 min stale time, 30 min garbage collection)
 * - Fire-and-forget prefetching (doesn't block UI)
 *
 * @param currentDate - Any date within the desired week (will be normalized to week start)
 * @param options - Configuration options
 * @returns Events for the week, loading state, error, and refetch function
 *
 * @example
 * const { events, isLoading, error, refetch } = useWeekEvents(new Date());
 */
export function useWeekEvents(
  currentDate: Date,
  options: UseWeekEventsOptions = {}
): UseWeekEventsResult {
  const { enabled = true, prefetchDistance = DEFAULT_PREFETCH_DISTANCE } = options;
  const queryClient = useQueryClient();

  // Validate input
  const isValidDate = currentDate instanceof Date && !isNaN(currentDate.getTime());

  // Normalize to week boundaries
  const weekStart = useMemo(() => {
    if (!isValidDate) return new Date();
    return getWeekStart(currentDate);
  }, [currentDate, isValidDate]);

  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);

  // Create stable cache keys
  const startKey = formatDateKey(weekStart);
  const endKey = formatDateKey(weekEnd);

  // Main query for current week
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.calendar.eventsForRange(startKey, endKey),
    queryFn: () => calendarApi.getEvents(weekStart, weekEnd),
    enabled: enabled && isValidDate,
    staleTime: EVENTS_STALE_TIME_MS,
    gcTime: EVENTS_GC_TIME_MS,
    retry: 2,
  });

  // Prefetch a specific week
  const prefetchWeek = useCallback(async (weekOffset: number) => {
    const targetWeekStart = addWeeks(weekStart, weekOffset);
    const targetWeekEnd = getWeekEnd(targetWeekStart);
    const targetStartKey = formatDateKey(targetWeekStart);
    const targetEndKey = formatDateKey(targetWeekEnd);
    const queryKey = queryKeys.calendar.eventsForRange(targetStartKey, targetEndKey);

    // Check if week is already cached before prefetching
    const existingQuery = queryClient.getQueryState(queryKey);

    // Only prefetch if not cached or if cache is invalidated
    if (!existingQuery || existingQuery.isInvalidated) {
      try {
        await queryClient.prefetchQuery({
          queryKey,
          queryFn: () => calendarApi.getEvents(targetWeekStart, targetWeekEnd),
          staleTime: EVENTS_STALE_TIME_MS,
        });
      } catch (err) {
        // Log prefetch errors but don't block UI
        console.warn(`Failed to prefetch week ${targetStartKey}:`, err);
      }
    }
  }, [weekStart, queryClient]);

  // Prefetch adjacent weeks in the background
  useEffect(() => {
    if (!enabled || !isValidDate) return;

    // Prefetch weeks in both directions
    for (let i = 1; i <= prefetchDistance; i++) {
      prefetchWeek(i);   // Future weeks
      prefetchWeek(-i);  // Past weeks
    }
  }, [startKey, enabled, isValidDate, prefetchDistance, prefetchWeek]);

  // Handle invalid date gracefully
  if (!isValidDate) {
    console.error('Invalid date passed to useWeekEvents:', currentDate);
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
 * Helper function to invalidate all cached week events
 * Useful after calendar sync or when events are modified
 *
 * @example
 * const queryClient = useQueryClient();
 * await syncCalendars();
 * invalidateAllWeekEvents(queryClient);
 */
export function invalidateAllWeekEvents(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({
    queryKey: queryKeys.calendar.all,
  });
}

export default useWeekEvents;
