import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { calendarUsersApi, CalendarUser, BusyBlock, FreeSlot } from '../../api/calendar/users';

/**
 * Hook for fetching all users with calendar connection status
 */
export function useCalendarUsers() {
  return useQuery({
    queryKey: ['calendar-users'],
    queryFn: calendarUsersApi.getUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for fetching busy times for selected users
 */
export function useBusyTimes(
  userIds: string[],
  startDate: Date,
  endDate: Date,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['busy-times', userIds.sort().join(','), startDate.toISOString(), endDate.toISOString()],
    queryFn: () => calendarUsersApi.getBusyTimes(userIds, startDate, endDate),
    enabled: enabled && userIds.length > 0,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Auto-refetch every 2 minutes
  });
}

/**
 * Hook for finding mutual free time (as a mutation for on-demand search)
 */
export function useFindFreeTimes() {
  return useMutation({
    mutationFn: ({
      userIds,
      startDate,
      endDate,
      minSlotMinutes = 30,
      excludedHoursStart = 0,
      excludedHoursEnd = 6,
    }: {
      userIds: string[];
      startDate: Date;
      endDate: Date;
      minSlotMinutes?: number;
      excludedHoursStart?: number;
      excludedHoursEnd?: number;
    }) =>
      calendarUsersApi.getFreeTimes(
        userIds,
        startDate,
        endDate,
        minSlotMinutes,
        excludedHoursStart,
        excludedHoursEnd
      ),
  });
}

/**
 * Combined hook for multi-user calendar view state
 */
export function useMultiUserCalendar(currentUserId: string) {
  const queryClient = useQueryClient();

  const invalidateBusyTimes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['busy-times'] });
  }, [queryClient]);

  return {
    invalidateBusyTimes,
  };
}
