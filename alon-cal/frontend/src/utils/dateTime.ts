/**
 * Date and time utility functions for event creation
 */

/**
 * Convert local date and time to ISO 8601 string
 */
export const toISO8601 = (date: string, time: string, timezone?: string): string => {
  const dateTime = new Date(`${date}T${time}`);
  return dateTime.toISOString();
};

/**
 * Convert ISO 8601 string to local date (YYYY-MM-DD)
 */
export const toLocalDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toISOString().split('T')[0];
};

/**
 * Convert ISO 8601 string to local time (HH:MM)
 */
export const toLocalTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toTimeString().slice(0, 5);
};

/**
 * Get current date in YYYY-MM-DD format
 */
export const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get current time in HH:MM format
 */
export const getCurrentTime = (): string => {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
};

/**
 * Get time one hour from now in HH:MM format
 */
export const getOneHourLater = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours + 1, minutes);
  return date.toTimeString().slice(0, 5);
};

/**
 * Validate that end date/time is after start date/time
 */
export const isEndAfterStart = (
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): boolean => {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  return end > start;
};

/**
 * Get the day of month from a date string
 */
export const getDayOfMonth = (dateString: string): number => {
  const date = new Date(dateString);
  return date.getDate();
};

/**
 * Get the day of week from a date string (0 = Sunday, 6 = Saturday)
 */
export const getDayOfWeek = (dateString: string): number => {
  const date = new Date(dateString);
  return date.getDay();
};

/**
 * Get the day of week name from a date string
 */
export const getDayOfWeekName = (dateString: string): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = getDayOfWeek(dateString);
  return days[dayIndex];
};

/**
 * Get the day of week abbreviation (MO, TU, WE, etc.)
 */
export const getDayOfWeekAbbrev = (dateString: string): string => {
  const abbrevs = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayIndex = getDayOfWeek(dateString);
  return abbrevs[dayIndex];
};

/**
 * Calculate which week of the month a date falls in (1-5)
 */
export const getWeekOfMonth = (dateString: string): number => {
  const date = new Date(dateString);
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
};

/**
 * Get relative day position in month (e.g., "first Monday", "last Friday")
 */
export const getRelativeDayPosition = (dateString: string): {
  position: number; // 1-4 for first-fourth, -1 for last
  positionName: string;
  dayName: string;
  dayAbbrev: string;
} => {
  const date = new Date(dateString);
  const dayOfMonth = date.getDate();
  const dayOfWeek = getDayOfWeek(dateString);
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  // Check if this is the last occurrence of this weekday in the month
  const daysUntilEnd = lastDayOfMonth - dayOfMonth;
  const isLast = daysUntilEnd < 7;

  const weekOfMonth = Math.ceil(dayOfMonth / 7);
  const positions = ['first', 'second', 'third', 'fourth', 'fifth'];

  return {
    position: isLast ? -1 : weekOfMonth,
    positionName: isLast ? 'last' : positions[weekOfMonth - 1],
    dayName: getDayOfWeekName(dateString),
    dayAbbrev: getDayOfWeekAbbrev(dateString),
  };
};

/**
 * Get user's timezone
 */
export const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Format timezone for display
 */
export const formatTimezone = (timezone: string): string => {
  try {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      timeZoneName: 'short',
    };
    const formatted = new Intl.DateTimeFormat('en-US', options).format(date);
    const match = formatted.match(/([A-Z]{3,})/);
    return match ? `${timezone} (${match[1]})` : timezone;
  } catch {
    return timezone;
  }
};

/**
 * Get common timezones
 */
export const getCommonTimezones = (): string[] => {
  return [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];
};

/**
 * Format time in 24-hour format (HH:MM:SS) for a specific timezone
 */
export const formatTime24Hour = (date: Date, timezone: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
};

/**
 * Get timezone abbreviation (e.g., "EST", "PST")
 */
export const getTimezoneAbbreviation = (timezone: string): string => {
  try {
    const date = new Date();
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(date);
    const match = formatted.match(/([A-Z]{3,})/);
    return match ? match[1] : timezone.split('/').pop() || timezone;
  } catch {
    return timezone.split('/').pop() || timezone;
  }
};

/**
 * Format duration in abbreviated format (1h 23m 45s)
 */
export const formatDurationAbbreviated = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
};
