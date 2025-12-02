import type { CalendarEvent } from '../api/calendar';

/**
 * Get hours and minutes from a date in a specific timezone
 * Uses Intl.DateTimeFormat for accurate timezone conversion
 */
function getTimeInTimezone(date: Date, timezone: string): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hourPart = parts.find(p => p.type === 'hour');
  const minutePart = parts.find(p => p.type === 'minute');

  return {
    hour: parseInt(hourPart?.value || '0', 10),
    minute: parseInt(minutePart?.value || '0', 10),
  };
}

/**
 * Get the date portion (year, month, day) in a specific timezone
 */
function getDateInTimezone(date: Date, timezone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const yearPart = parts.find(p => p.type === 'year');
  const monthPart = parts.find(p => p.type === 'month');
  const dayPart = parts.find(p => p.type === 'day');

  return {
    year: parseInt(yearPart?.value || '0', 10),
    month: parseInt(monthPart?.value || '1', 10) - 1, // 0-indexed
    day: parseInt(dayPart?.value || '1', 10),
  };
}

/**
 * Check if two dates are on the same day in a specific timezone
 */
function isSameDayInTimezone(date1: Date, date2: Date, timezone: string): boolean {
  const d1 = getDateInTimezone(date1, timezone);
  const d2 = getDateInTimezone(date2, timezone);
  return d1.year === d2.year && d1.month === d2.month && d1.day === d2.day;
}

/**
 * Represents a time slot in the calendar grid (15-minute intervals)
 */
export interface TimeSlot {
  index: number;        // 0-95 (96 slots in 24 hours)
  hour: number;         // 0-23
  minute: number;       // 0, 15, 30, 45
  label: string;        // "12:00 AM", "1:15 PM", etc.
  labelShort: string;   // "12 AM", "1 PM", etc.
}

/**
 * Event with calculated grid position
 */
export interface GridEvent extends CalendarEvent {
  gridPosition: {
    startSlot: number;   // 0-95 (96 slots in day)
    spanSlots: number;   // duration in 15-min slots
    column?: number;     // 0-6 for week view
    width: string;       // "100%" or "50%" for overlap
    offset: string;      // "0%" or "50%" for overlap
  };
}

/**
 * Overlap group for rendering side-by-side events
 */
export interface OverlapGroup {
  events: GridEvent[];
  startSlot: number;
  endSlot: number;
}

/**
 * Generate 96 time slots for a full day (15-minute intervals from 12 AM - 11:59 PM)
 */
export function getTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const index = (hour * 4) + (minute / 15);
      const label = formatTimeSlotLabel(hour, minute);
      const labelShort = formatTimeSlotLabelShort(hour, minute);

      slots.push({
        index,
        hour,
        minute,
        label,
        labelShort,
      });
    }
  }

  return slots;
}

/**
 * Format time slot label (e.g., "12:00 AM", "1:15 PM")
 */
function formatTimeSlotLabel(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Format time slot label (short version, e.g., "12 AM", "1 PM")
 */
function formatTimeSlotLabelShort(hour: number, minute: number): string {
  if (minute !== 0) return '';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${period}`;
}

/**
 * Get array of 7 dates for week view starting from Sunday
 */
export function getWeekDays(startDate: Date): Date[] {
  const weekDays: Date[] = [];
  const start = new Date(startDate);

  // Ensure we start on Sunday
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    weekDays.push(day);
  }

  return weekDays;
}

/**
 * Get month grid (6-7 weeks × 7 days) for month view
 * Returns array of weeks, where each week is an array of dates
 */
export function getMonthGrid(month: number, year: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get the Sunday before or on the first day of month
  const startDate = new Date(firstDay);
  startDate.setDate(1 - firstDay.getDay());

  // Get the Saturday after or on the last day of month
  const endDate = new Date(lastDay);
  endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    currentWeek.push(new Date(current));

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    current.setDate(current.getDate() + 1);
  }

  return weeks;
}

/**
 * Calculate grid position for an event within a day
 * @param event Calendar event
 * @param dayStart Start of the day (midnight)
 * @param timezone User's timezone for display (e.g., "America/Los_Angeles")
 * @returns Grid position with start slot and span
 */
export function calculateEventPosition(
  event: CalendarEvent,
  dayStart: Date,
  timezone?: string
): { startSlot: number; spanSlots: number } {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);

  // Use timezone-aware time extraction if timezone is provided
  // Otherwise fall back to browser's local timezone
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Calculate start slot (0-95) using timezone-aware extraction
  const startTime = getTimeInTimezone(eventStart, tz);
  const startSlot = (startTime.hour * 4) + Math.floor(startTime.minute / 15);

  // Calculate end slot using timezone-aware extraction
  const endTime = getTimeInTimezone(eventEnd, tz);
  let endSlot = (endTime.hour * 4) + Math.floor(endTime.minute / 15);

  // Check if event ends on a different day (in the user's timezone)
  const startDate = getDateInTimezone(eventStart, tz);
  const endDate = getDateInTimezone(eventEnd, tz);
  const dayStartDate = getDateInTimezone(dayStart, tz);

  // If event ends on a different day than dayStart, cap at end of day
  const endsOnDifferentDay = endDate.year !== dayStartDate.year ||
    endDate.month !== dayStartDate.month ||
    endDate.day !== dayStartDate.day;

  // If event ends at midnight (00:00) on the next day, or extends past this day
  if (endsOnDifferentDay || (endTime.hour === 0 && endTime.minute === 0 && !isSameDayInTimezone(eventStart, eventEnd, tz))) {
    endSlot = 96; // End of day
  }

  // Calculate span (minimum 1 slot for visibility)
  const spanSlots = Math.max(1, endSlot - startSlot);

  return { startSlot, spanSlots };
}

/**
 * Detect overlapping events and calculate widths/offsets for side-by-side display
 * @param events Array of events for a single day
 * @returns Events with calculated width and offset for rendering
 */
export function detectOverlappingEvents(events: GridEvent[]): GridEvent[] {
  if (events.length === 0) return [];

  // Sort events by start slot, then by duration (longer first)
  const sortedEvents = [...events].sort((a, b) => {
    const startDiff = a.gridPosition.startSlot - b.gridPosition.startSlot;
    if (startDiff !== 0) return startDiff;
    return b.gridPosition.spanSlots - a.gridPosition.spanSlots;
  });

  // Find overlap groups
  const groups: OverlapGroup[] = [];

  for (const event of sortedEvents) {
    const eventStart = event.gridPosition.startSlot;
    const eventEnd = eventStart + event.gridPosition.spanSlots;

    // Find existing group that overlaps with this event
    let addedToGroup = false;

    for (const group of groups) {
      const hasOverlap = group.events.some(groupEvent => {
        const groupStart = groupEvent.gridPosition.startSlot;
        const groupEnd = groupStart + groupEvent.gridPosition.spanSlots;
        return eventStart < groupEnd && eventEnd > groupStart;
      });

      if (hasOverlap) {
        group.events.push(event);
        group.startSlot = Math.min(group.startSlot, eventStart);
        group.endSlot = Math.max(group.endSlot, eventEnd);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      groups.push({
        events: [event],
        startSlot: eventStart,
        endSlot: eventEnd,
      });
    }
  }

  // Calculate positions for each group
  for (const group of groups) {
    if (group.events.length === 1) {
      // Single event, full width
      group.events[0].gridPosition.width = '100%';
      group.events[0].gridPosition.offset = '0%';
    } else {
      // Multiple overlapping events - arrange in columns
      const columns = arrangeInColumns(group.events);
      const columnCount = columns.length;

      columns.forEach((columnEvents, columnIndex) => {
        columnEvents.forEach(event => {
          event.gridPosition.width = `${100 / columnCount}%`;
          event.gridPosition.offset = `${(100 / columnCount) * columnIndex}%`;
        });
      });
    }
  }

  return sortedEvents;
}

/**
 * Arrange overlapping events into columns for side-by-side display
 */
function arrangeInColumns(events: GridEvent[]): GridEvent[][] {
  const columns: GridEvent[][] = [];

  for (const event of events) {
    const eventStart = event.gridPosition.startSlot;
    const eventEnd = eventStart + event.gridPosition.spanSlots;

    // Find first column where event doesn't overlap with any existing event
    let placed = false;

    for (const column of columns) {
      const hasOverlap = column.some(colEvent => {
        const colStart = colEvent.gridPosition.startSlot;
        const colEnd = colStart + colEvent.gridPosition.spanSlots;
        return eventStart < colEnd && eventEnd > colStart;
      });

      if (!hasOverlap) {
        column.push(event);
        placed = true;
        break;
      }
    }

    if (!placed) {
      columns.push([event]);
    }
  }

  return columns;
}

/**
 * Transform CalendarEvent to GridEvent with position calculations
 * @param event Calendar event
 * @param dayStart Start of the day for positioning
 * @param columnIndex Column index for week view (0-6)
 * @param timezone User's timezone for display
 */
export function transformToGridEvent(
  event: CalendarEvent,
  dayStart: Date,
  columnIndex?: number,
  timezone?: string
): GridEvent {
  const position = calculateEventPosition(event, dayStart, timezone);

  return {
    ...event,
    gridPosition: {
      startSlot: position.startSlot,
      spanSlots: position.spanSlots,
      column: columnIndex,
      width: '100%',
      offset: '0%',
    },
  };
}

/**
 * Group events by day and calculate grid positions
 * @param events Array of calendar events
 * @param days Array of dates to group by
 * @param timezone User's timezone for display
 */
export function groupEventsByDay(
  events: CalendarEvent[],
  days: Date[],
  timezone?: string
): Map<string, GridEvent[]> {
  const grouped = new Map<string, GridEvent[]>();
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  days.forEach((day, columnIndex) => {
    const dayKey = day.toDateString();
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    // Filter events for this day (using timezone-aware comparison)
    const dayEvents = events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      // Check if event overlaps with this day in the user's timezone
      const eventStartDate = getDateInTimezone(eventStart, tz);
      const eventEndDate = getDateInTimezone(eventEnd, tz);
      const dayDate = getDateInTimezone(day, tz);

      // Event starts on or before this day AND ends on or after this day
      const startsOnOrBefore = eventStartDate.year < dayDate.year ||
        (eventStartDate.year === dayDate.year && eventStartDate.month < dayDate.month) ||
        (eventStartDate.year === dayDate.year && eventStartDate.month === dayDate.month && eventStartDate.day <= dayDate.day);

      const endsOnOrAfter = eventEndDate.year > dayDate.year ||
        (eventEndDate.year === dayDate.year && eventEndDate.month > dayDate.month) ||
        (eventEndDate.year === dayDate.year && eventEndDate.month === dayDate.month && eventEndDate.day >= dayDate.day);

      return startsOnOrBefore && endsOnOrAfter;
    });

    // Transform to grid events with timezone
    const gridEvents = dayEvents.map(event =>
      transformToGridEvent(event, dayStart, columnIndex, tz)
    );

    // Detect and handle overlaps
    const processedEvents = detectOverlappingEvents(gridEvents);

    grouped.set(dayKey, processedEvents);
  });

  return grouped;
}

/**
 * Get current time as a slot index (0-95)
 */
export function getCurrentTimeSlot(): number {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  return (hour * 4) + Math.floor(minute / 15);
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Check if a date is in the current month
 */
export function isCurrentMonth(date: Date, month: number): boolean {
  return date.getMonth() === month;
}

/**
 * Format time for display (e.g., "2:30 PM")
 * @param date Date to format
 * @param timezone User's timezone for display
 */
export function formatTime(date: Date, timezone?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  if (timezone) {
    options.timeZone = timezone;
  }

  return date.toLocaleTimeString('en-US', options);
}

/**
 * Format date for display (e.g., "Mon 12/25")
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  });
}

/**
 * Get weekday name (e.g., "Sunday", "Monday")
 */
export function getWeekdayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Get short weekday name (e.g., "Sun", "Mon")
 */
export function getWeekdayNameShort(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Separate all-day events from timed events
 * Generic function that preserves the input type (CalendarEvent or GridEvent)
 */
export function separateAllDayEvents<T extends CalendarEvent>(events: T[]): {
  allDayEvents: T[];
  timedEvents: T[];
} {
  const allDayEvents: T[] = [];
  const timedEvents: T[] = [];

  events.forEach(event => {
    if (event.isAllDay) {
      allDayEvents.push(event);
    } else {
      timedEvents.push(event);
    }
  });

  return { allDayEvents, timedEvents };
}

/**
 * Validate and sanitize hex color values to prevent CSS injection
 * @param color Hex color string (e.g., "#3b82f6" or "#F00")
 * @returns Valid hex color or default blue
 */
export function validateHexColor(color: string | undefined): string {
  const DEFAULT_COLOR = '#3b82f4';

  if (!color) return DEFAULT_COLOR;

  // Only allow valid hex colors (#RGB or #RRGGBB)
  const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

  if (hexRegex.test(color)) {
    return color;
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[Security] Invalid calendar color format: ${color}. Using default.`);
  }

  return DEFAULT_COLOR;
}

/**
 * Validate and sanitize URLs to prevent protocol-based attacks
 * @param url URL string to validate
 * @returns Valid URL or null if unsafe
 */
export function validateAndSanitizeUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Security] Blocked unsafe URL protocol: ${parsedUrl.protocol}`);
      }
      return null;
    }

    return url;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Security] Invalid URL format: ${url}`);
    }
    return null;
  }
}

/**
 * Sanitize event text fields to prevent UI issues
 * @param text Text to sanitize
 * @param maxLength Maximum length before truncation
 * @returns Sanitized text
 */
export function sanitizeEventText(text: string | undefined | null, maxLength = 500): string {
  if (!text) return '';

  // Ensure it's a string
  const str = String(text);

  // Limit length
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + '...';
  }

  // Remove control characters but keep newlines and tabs
  return str.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}
