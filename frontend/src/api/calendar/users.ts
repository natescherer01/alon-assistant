import api from '../calendarApi';

export interface CalendarUser {
  id: string;
  email: string;
  fullName: string | null;
  hasCalendar: boolean;
}

export interface BusyBlock {
  userId: string;
  userName: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
}

export interface FreeSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface BusyTimesResponse {
  busyBlocks: BusyBlock[];
}

export interface FreeTimesResponse {
  freeSlots: FreeSlot[];
}

export const calendarUsersApi = {
  /**
   * Get all users with their calendar connection status
   */
  getUsers: async (): Promise<CalendarUser[]> => {
    const response = await api.get('/users');
    return response.data;
  },

  /**
   * Get busy time blocks for selected users (privacy-preserving)
   */
  getBusyTimes: async (
    userIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<BusyTimesResponse> => {
    const response = await api.post('/busy-times', {
      userIds,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    return response.data;
  },

  /**
   * Find mutual free time slots across selected users
   */
  getFreeTimes: async (
    userIds: string[],
    startDate: Date,
    endDate: Date,
    minSlotMinutes: number = 30,
    excludedHoursStart: number = 0,
    excludedHoursEnd: number = 6
  ): Promise<FreeTimesResponse> => {
    const response = await api.post('/free-times', {
      userIds,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      excludedHoursStart,
      excludedHoursEnd,
      minSlotMinutes,
    });
    return response.data;
  },
};
