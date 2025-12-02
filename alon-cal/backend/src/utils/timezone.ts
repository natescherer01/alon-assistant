/**
 * Timezone Conversion Utilities
 *
 * Provides timezone conversion functions for calendar event imports.
 * Uses date-fns-tz for accurate IANA timezone support with DST handling.
 *
 * Features:
 * - Convert between IANA timezones
 * - Handle DST transitions correctly
 * - Support all-day event preservation
 * - Map common timezone abbreviations to IANA identifiers
 * - Validate timezone identifiers
 *
 * Dependencies:
 * - date-fns: Date utility library
 * - date-fns-tz: Timezone conversion library
 */

import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { isValid } from 'date-fns';
import logger from './logger';

/**
 * Common timezone abbreviation mappings to IANA identifiers
 * Note: Abbreviations are ambiguous (EST could be US or Australia)
 * We default to US timezones for common abbreviations
 */
const TIMEZONE_ABBREVIATION_MAP: Record<string, string> = {
  // US Timezones
  'EST': 'America/New_York',
  'EDT': 'America/New_York',
  'CST': 'America/Chicago',
  'CDT': 'America/Chicago',
  'MST': 'America/Denver',
  'MDT': 'America/Denver',
  'PST': 'America/Los_Angeles',
  'PDT': 'America/Los_Angeles',
  'AKST': 'America/Anchorage',
  'AKDT': 'America/Anchorage',
  'HST': 'Pacific/Honolulu',
  'AST': 'America/Halifax',
  'ADT': 'America/Halifax',

  // European Timezones
  'GMT': 'Europe/London',
  'BST': 'Europe/London',
  'WET': 'Europe/Lisbon',
  'WEST': 'Europe/Lisbon',
  'CET': 'Europe/Paris',
  'CEST': 'Europe/Paris',
  'EET': 'Europe/Athens',
  'EEST': 'Europe/Athens',
  'MSK': 'Europe/Moscow',

  // Asia/Pacific
  'IST': 'Asia/Kolkata',
  'JST': 'Asia/Tokyo',
  'KST': 'Asia/Seoul',
  'CST_ASIA': 'Asia/Shanghai', // Disambiguate from US CST
  'HKT': 'Asia/Hong_Kong',
  'SGT': 'Asia/Singapore',
  'AEST': 'Australia/Sydney',
  'AEDT': 'Australia/Sydney',
  'AWST': 'Australia/Perth',
  'NZST': 'Pacific/Auckland',
  'NZDT': 'Pacific/Auckland',
};

/**
 * Result of a timezone conversion operation
 */
export interface TimezoneConversionResult {
  /** Converted date in the target timezone */
  convertedDate: Date;
  /** Original timezone identifier */
  originalTimezone: string;
  /** Target timezone identifier */
  targetTimezone: string;
  /** Whether conversion was performed (false if same timezone or all-day) */
  wasConverted: boolean;
  /** Warning message if any issues occurred */
  warning?: string;
}

/** Maximum allowed length for timezone strings to prevent DoS */
const MAX_TIMEZONE_LENGTH = 100;

/**
 * Validate if a string is a valid IANA timezone identifier
 *
 * @param timezone - Timezone string to validate
 * @returns boolean - true if valid IANA timezone
 *
 * @example
 * isValidTimezone('America/New_York'); // true
 * isValidTimezone('Invalid/Zone'); // false
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== 'string') {
    return false;
  }

  // Length check to prevent DoS attacks
  if (timezone.length > MAX_TIMEZONE_LENGTH) {
    return false;
  }

  // Check for suspicious patterns before expensive Intl call
  if (/[<>'"\\]/.test(timezone) || timezone.includes('..')) {
    return false;
  }

  try {
    // Use Intl.DateTimeFormat to validate timezone
    // This will throw if the timezone is invalid
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize timezone string to IANA format
 *
 * Handles:
 * - IANA timezones (pass through)
 * - Common abbreviations (EST, PST, etc.)
 * - UTC offsets (UTC+5, UTC-08:00)
 *
 * @param timezone - Timezone string from ICS file
 * @returns Normalized IANA timezone or 'UTC' as fallback
 *
 * @example
 * normalizeTimezone('America/New_York'); // 'America/New_York'
 * normalizeTimezone('EST'); // 'America/New_York'
 * normalizeTimezone('UTC'); // 'UTC'
 */
export function normalizeTimezone(timezone: string): { timezone: string; warning?: string } {
  if (!timezone || typeof timezone !== 'string') {
    return { timezone: 'UTC', warning: 'Empty timezone, defaulting to UTC' };
  }

  // Length check BEFORE any processing to prevent DoS
  if (timezone.length > MAX_TIMEZONE_LENGTH) {
    logger.warn('Timezone string exceeds maximum length', { length: timezone.length });
    return { timezone: 'UTC', warning: 'Timezone string too long, defaulting to UTC' };
  }

  const trimmed = timezone.trim();

  // Already valid IANA timezone
  if (isValidTimezone(trimmed)) {
    return { timezone: trimmed };
  }

  // Check abbreviation map
  const upperTrimmed = trimmed.toUpperCase();
  if (TIMEZONE_ABBREVIATION_MAP[upperTrimmed]) {
    const mapped = TIMEZONE_ABBREVIATION_MAP[upperTrimmed];
    return {
      timezone: mapped,
      warning: `Mapped timezone abbreviation '${trimmed}' to '${mapped}'`,
    };
  }

  // Handle UTC offset format (UTC+5, UTC-08:00, etc.)
  const utcOffsetMatch = trimmed.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/i);
  if (utcOffsetMatch) {
    // UTC offsets are valid in Intl.DateTimeFormat as Etc/GMT format
    // Note: Etc/GMT signs are inverted (Etc/GMT-5 = UTC+5)
    const sign = utcOffsetMatch[1] === '+' ? '-' : '+';
    const hours = parseInt(utcOffsetMatch[2], 10);
    const etcTimezone = `Etc/GMT${sign}${hours}`;

    if (isValidTimezone(etcTimezone)) {
      return {
        timezone: etcTimezone,
        warning: `Converted UTC offset '${trimmed}' to '${etcTimezone}'`,
      };
    }
  }

  // Fallback to UTC with warning
  logger.warn('Unknown timezone, defaulting to UTC', { originalTimezone: timezone });
  return {
    timezone: 'UTC',
    warning: `Unknown timezone '${trimmed}', defaulting to UTC`,
  };
}

/**
 * Convert a date from one timezone to another
 *
 * @param date - Date to convert
 * @param sourceTimezone - Source IANA timezone
 * @param targetTimezone - Target IANA timezone
 * @returns Converted date in the target timezone
 *
 * @example
 * // Convert 2pm New York time to user's Los Angeles timezone
 * const nyDate = new Date('2025-01-15T14:00:00');
 * const laDate = convertTimezone(nyDate, 'America/New_York', 'America/Los_Angeles');
 * // laDate represents 11am in Los Angeles
 */
export function convertTimezone(
  date: Date,
  sourceTimezone: string,
  targetTimezone: string
): TimezoneConversionResult {
  // Validate inputs
  if (!date || !isValid(date)) {
    logger.error('Invalid date provided for timezone conversion', { date });
    return {
      convertedDate: new Date(),
      originalTimezone: sourceTimezone,
      targetTimezone,
      wasConverted: false,
      warning: 'Invalid date provided',
    };
  }

  // Normalize timezones
  const normalizedSource = normalizeTimezone(sourceTimezone);
  const normalizedTarget = normalizeTimezone(targetTimezone);

  // If same timezone, no conversion needed
  if (normalizedSource.timezone === normalizedTarget.timezone) {
    return {
      convertedDate: date,
      originalTimezone: normalizedSource.timezone,
      targetTimezone: normalizedTarget.timezone,
      wasConverted: false,
    };
  }

  try {
    // The date from ICS is interpreted as being in the source timezone
    // We need to convert it to UTC first, then to the target timezone

    // Step 1: Interpret the date as being in the source timezone
    // fromZonedTime takes a date that represents local time in the specified zone
    // and returns a Date object representing that same instant in UTC
    const utcDate = fromZonedTime(date, normalizedSource.timezone);

    // Step 2: Convert UTC to target timezone
    // toZonedTime takes a UTC date and returns a Date object
    // representing the same instant in the target timezone
    const targetDate = toZonedTime(utcDate, normalizedTarget.timezone);

    // Combine warnings if any
    const warnings: string[] = [];
    if (normalizedSource.warning) warnings.push(normalizedSource.warning);
    if (normalizedTarget.warning) warnings.push(normalizedTarget.warning);

    return {
      convertedDate: targetDate,
      originalTimezone: normalizedSource.timezone,
      targetTimezone: normalizedTarget.timezone,
      wasConverted: true,
      warning: warnings.length > 0 ? warnings.join('; ') : undefined,
    };
  } catch (error) {
    // Log detailed error internally without exposing sensitive information
    logger.error('Timezone conversion failed', {
      hasDate: !!date,
      sourceTimezone: sourceTimezone ? 'provided' : 'missing',
      targetTimezone: targetTimezone ? 'provided' : 'missing',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    return {
      convertedDate: date,
      originalTimezone: normalizedSource.timezone,
      targetTimezone: normalizedTarget.timezone,
      wasConverted: false,
      // Generic user-facing message to avoid information disclosure
      warning: 'Timezone conversion failed, using original time',
    };
  }
}

/**
 * Convert event times to user's timezone
 *
 * Handles the special case of all-day events which should NOT be converted.
 * All-day events represent calendar dates, not specific instants in time.
 *
 * @param startTime - Event start time
 * @param endTime - Event end time
 * @param eventTimezone - Timezone from ICS event
 * @param userTimezone - User's preferred timezone
 * @param isAllDay - Whether this is an all-day event
 * @returns Object with converted start/end times and metadata
 *
 * @example
 * // Regular event: convert times
 * const result = convertEventToUserTimezone(
 *   new Date('2025-01-15T14:00:00'),
 *   new Date('2025-01-15T15:00:00'),
 *   'America/New_York',
 *   'America/Los_Angeles',
 *   false
 * );
 *
 * // All-day event: preserve dates
 * const allDayResult = convertEventToUserTimezone(
 *   new Date('2025-01-15T00:00:00'),
 *   new Date('2025-01-16T00:00:00'),
 *   'America/New_York',
 *   'America/Los_Angeles',
 *   true
 * );
 */
export function convertEventToUserTimezone(
  startTime: Date,
  endTime: Date,
  eventTimezone: string,
  userTimezone: string,
  isAllDay: boolean
): {
  startTime: Date;
  endTime: Date;
  originalTimezone: string;
  wasConverted: boolean;
  warning?: string;
} {
  // All-day events should NOT be timezone converted
  // They represent calendar dates, not specific times
  if (isAllDay) {
    const normalized = normalizeTimezone(eventTimezone);
    return {
      startTime,
      endTime,
      originalTimezone: normalized.timezone,
      wasConverted: false,
      warning: normalized.warning,
    };
  }

  // Convert start time
  const startResult = convertTimezone(startTime, eventTimezone, userTimezone);

  // Convert end time
  const endResult = convertTimezone(endTime, eventTimezone, userTimezone);

  // Combine warnings
  const warnings: string[] = [];
  if (startResult.warning) warnings.push(`Start: ${startResult.warning}`);
  if (endResult.warning) warnings.push(`End: ${endResult.warning}`);

  return {
    startTime: startResult.convertedDate,
    endTime: endResult.convertedDate,
    originalTimezone: startResult.originalTimezone,
    wasConverted: startResult.wasConverted || endResult.wasConverted,
    warning: warnings.length > 0 ? warnings.join('; ') : undefined,
  };
}

/**
 * Convert exception dates (EXDATE) to user's timezone
 *
 * @param exceptionDates - Array of exception dates from ICS
 * @param eventTimezone - Timezone from ICS event
 * @param userTimezone - User's preferred timezone
 * @param isAllDay - Whether the parent event is all-day
 * @returns Array of converted exception dates
 */
export function convertExceptionDatesToUserTimezone(
  exceptionDates: Date[],
  eventTimezone: string,
  userTimezone: string,
  isAllDay: boolean
): Date[] {
  // All-day events don't need exception date conversion
  if (isAllDay) {
    return exceptionDates;
  }

  return exceptionDates.map(date => {
    const result = convertTimezone(date, eventTimezone, userTimezone);
    return result.convertedDate;
  });
}

/**
 * Format a date in a specific timezone for display
 *
 * @param date - Date to format
 * @param timezone - Target timezone
 * @param formatStr - date-fns format string
 * @returns Formatted date string
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  formatStr: string = "yyyy-MM-dd'T'HH:mm:ssXXX"
): string {
  const normalized = normalizeTimezone(timezone);
  return formatInTimeZone(date, normalized.timezone, formatStr);
}

/**
 * Get the current UTC offset for a timezone in minutes
 *
 * @param timezone - IANA timezone identifier
 * @param date - Date to check offset for (defaults to now)
 * @returns Offset in minutes from UTC
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  const normalized = normalizeTimezone(timezone);

  try {
    // Get the timezone's offset by comparing UTC and local representations
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: normalized.timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
  } catch {
    return 0;
  }
}

export default {
  isValidTimezone,
  normalizeTimezone,
  convertTimezone,
  convertEventToUserTimezone,
  convertExceptionDatesToUserTimezone,
  formatDateInTimezone,
  getTimezoneOffset,
};
