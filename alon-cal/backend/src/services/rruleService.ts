/**
 * RRULE Service
 *
 * Converts recurrence objects to RRULE strings (RFC 5545 format)
 * Used for Google Calendar API integration
 */

import { RecurrenceRequest } from '../validators/eventValidator';
import logger from '../utils/logger';

/**
 * Day of week mapping to RRULE format
 */
const DAY_MAP: Record<string, string> = {
  MONDAY: 'MO',
  TUESDAY: 'TU',
  WEDNESDAY: 'WE',
  THURSDAY: 'TH',
  FRIDAY: 'FR',
  SATURDAY: 'SA',
  SUNDAY: 'SU',
};

/**
 * Generate RRULE string from recurrence object
 *
 * Follows RFC 5545 specification for iCalendar recurrence rules
 * Compatible with Google Calendar API
 *
 * @param recurrence - Recurrence configuration object
 * @param eventStartTime - Event start time (for UNTIL conversion)
 * @returns RRULE string (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20")
 *
 * @example
 * // Weekly on Monday, Wednesday, Friday for 20 occurrences
 * generateRRule({
 *   frequency: 'WEEKLY',
 *   byDay: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
 *   endType: 'COUNT',
 *   count: 20
 * })
 * // Returns: "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20"
 */
export function generateRRule(recurrence: RecurrenceRequest, eventStartTime: Date): string {
  const parts: string[] = [];

  // Frequency (required)
  parts.push(`FREQ=${recurrence.frequency}`);

  // Interval (default: 1)
  if (recurrence.interval && recurrence.interval !== 1) {
    parts.push(`INTERVAL=${recurrence.interval}`);
  }

  // BYDAY - Days of the week (for WEEKLY recurrence or MONTHLY with relative day)
  if (recurrence.byDay && recurrence.byDay.length > 0) {
    const days = recurrence.byDay.map((day) => DAY_MAP[day]).join(',');
    parts.push(`BYDAY=${days}`);
  }

  // BYMONTHDAY - Day of month (for MONTHLY with specific date)
  if (recurrence.byMonthDay) {
    parts.push(`BYMONTHDAY=${recurrence.byMonthDay}`);
  }

  // BYSETPOS - Position in month (e.g., 1=first, -1=last)
  // Used with BYDAY for "first Monday", "last Friday", etc.
  if (recurrence.bySetPos !== undefined && recurrence.byDayOfWeek) {
    const day = DAY_MAP[recurrence.byDayOfWeek];
    parts.push(`BYDAY=${day}`);
    parts.push(`BYSETPOS=${recurrence.bySetPos}`);
  }

  // BYMONTH - Months of the year (for YEARLY recurrence)
  if (recurrence.byMonth && recurrence.byMonth.length > 0) {
    const months = recurrence.byMonth.join(',');
    parts.push(`BYMONTH=${months}`);
  }

  // End condition
  switch (recurrence.endType) {
    case 'DATE':
      if (recurrence.endDate) {
        // Convert to UTC format: YYYYMMDDTHHMMSSZ
        const endDate = new Date(recurrence.endDate);
        const untilStr = formatDateForRRule(endDate);
        parts.push(`UNTIL=${untilStr}`);
      }
      break;

    case 'COUNT':
      if (recurrence.count) {
        parts.push(`COUNT=${recurrence.count}`);
      }
      break;

    case 'NEVER':
      // No end condition
      break;
  }

  const rrule = parts.join(';');

  logger.debug('Generated RRULE', { recurrence, rrule });

  return rrule;
}

/**
 * Format date for RRULE UNTIL parameter
 *
 * Converts Date object to RRULE date format: YYYYMMDDTHHMMSSZ
 *
 * @param date - Date object to format
 * @returns Formatted date string
 *
 * @example
 * formatDateForRRule(new Date('2024-12-31T23:59:59Z'))
 * // Returns: "20241231T235959Z"
 */
function formatDateForRRule(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Parse RRULE string to recurrence object
 *
 * Converts RFC 5545 RRULE string back to our internal format
 * Useful for syncing events from Google Calendar
 *
 * @param rrule - RRULE string to parse
 * @returns Recurrence object
 *
 * @example
 * parseRRule("FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20")
 * // Returns: { frequency: 'WEEKLY', byDay: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], endType: 'COUNT', count: 20 }
 */
export function parseRRule(rrule: string): Partial<RecurrenceRequest> {
  const parts = rrule.split(';');
  const recurrence: any = {
    interval: 1,
    endType: 'NEVER',
  };

  // Reverse day map for parsing
  const reverseDayMap: Record<string, string> = {
    MO: 'MONDAY',
    TU: 'TUESDAY',
    WE: 'WEDNESDAY',
    TH: 'THURSDAY',
    FR: 'FRIDAY',
    SA: 'SATURDAY',
    SU: 'SUNDAY',
  };

  for (const part of parts) {
    const [key, value] = part.split('=');

    switch (key) {
      case 'FREQ':
        recurrence.frequency = value as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
        break;

      case 'INTERVAL':
        recurrence.interval = parseInt(value, 10);
        break;

      case 'BYDAY':
        // Check if it's a simple day list or has position modifier
        if (value.includes(',')) {
          // Multiple days (e.g., "MO,WE,FR")
          recurrence.byDay = value.split(',').map((day) => reverseDayMap[day]);
        } else if (/^-?\d/.test(value)) {
          // Has position modifier (e.g., "1MO" or "-1FR")
          const match = value.match(/^(-?\d+)([A-Z]{2})$/);
          if (match) {
            recurrence.bySetPos = parseInt(match[1], 10);
            recurrence.byDayOfWeek = reverseDayMap[match[2]];
          }
        } else {
          // Single day without position
          recurrence.byDay = [reverseDayMap[value]];
        }
        break;

      case 'BYMONTHDAY':
        recurrence.byMonthDay = parseInt(value, 10);
        recurrence.monthDayType = 'DAY_OF_MONTH';
        break;

      case 'BYSETPOS':
        recurrence.bySetPos = parseInt(value, 10);
        recurrence.monthDayType = 'RELATIVE_DAY';
        break;

      case 'BYMONTH':
        recurrence.byMonth = value.split(',').map((m) => parseInt(m, 10));
        break;

      case 'UNTIL':
        recurrence.endType = 'DATE';
        // Parse RRULE date format: YYYYMMDDTHHMMSSZ
        const year = parseInt(value.substring(0, 4), 10);
        const month = parseInt(value.substring(4, 6), 10) - 1;
        const day = parseInt(value.substring(6, 8), 10);
        const hours = parseInt(value.substring(9, 11), 10);
        const minutes = parseInt(value.substring(11, 13), 10);
        const seconds = parseInt(value.substring(13, 15), 10);
        recurrence.endDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds)).toISOString();
        break;

      case 'COUNT':
        recurrence.endType = 'COUNT';
        recurrence.count = parseInt(value, 10);
        break;
    }
  }

  logger.debug('Parsed RRULE', { rrule, recurrence });

  return recurrence;
}

/**
 * Validate RRULE string format
 *
 * @param rrule - RRULE string to validate
 * @returns boolean - true if valid, false otherwise
 */
export function isValidRRule(rrule: string): boolean {
  try {
    // Basic validation: must start with FREQ
    if (!rrule.startsWith('FREQ=')) {
      return false;
    }

    // Must contain valid frequency
    const freqMatch = rrule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/);
    if (!freqMatch) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('RRULE validation error', { rrule, error });
    return false;
  }
}

/**
 * Generate human-readable description of recurrence
 *
 * @param recurrence - Recurrence object
 * @returns Human-readable string
 *
 * @example
 * describeRecurrence({ frequency: 'WEEKLY', byDay: ['MONDAY', 'WEDNESDAY'], endType: 'COUNT', count: 10 })
 * // Returns: "Weekly on Monday, Wednesday for 10 occurrences"
 */
export function describeRecurrence(recurrence: RecurrenceRequest): string {
  const parts: string[] = [];

  // Frequency
  const freqMap: Record<string, string> = {
    DAILY: 'Daily',
    WEEKLY: 'Weekly',
    MONTHLY: 'Monthly',
    YEARLY: 'Yearly',
  };

  let freqStr = freqMap[recurrence.frequency];
  if (recurrence.interval && recurrence.interval > 1) {
    freqStr = `Every ${recurrence.interval} ${recurrence.frequency.toLowerCase()}`;
  }
  parts.push(freqStr);

  // Days of week
  if (recurrence.byDay && recurrence.byDay.length > 0) {
    const dayNames = recurrence.byDay.map((day) => day.charAt(0) + day.slice(1).toLowerCase());
    parts.push(`on ${dayNames.join(', ')}`);
  }

  // Month day
  if (recurrence.byMonthDay) {
    parts.push(`on day ${recurrence.byMonthDay}`);
  }

  // Relative day (e.g., "first Monday")
  if (recurrence.bySetPos !== undefined && recurrence.byDayOfWeek) {
    const posMap: Record<number, string> = {
      1: 'first',
      2: 'second',
      3: 'third',
      4: 'fourth',
      '-1': 'last',
    };
    const pos = posMap[recurrence.bySetPos] || `${recurrence.bySetPos}th`;
    const day = recurrence.byDayOfWeek.charAt(0) + recurrence.byDayOfWeek.slice(1).toLowerCase();
    parts.push(`on the ${pos} ${day}`);
  }

  // End condition
  switch (recurrence.endType) {
    case 'COUNT':
      parts.push(`for ${recurrence.count} occurrences`);
      break;
    case 'DATE':
      if (recurrence.endDate) {
        const endDate = new Date(recurrence.endDate).toLocaleDateString();
        parts.push(`until ${endDate}`);
      }
      break;
    case 'NEVER':
      // No end condition
      break;
  }

  return parts.join(' ');
}
