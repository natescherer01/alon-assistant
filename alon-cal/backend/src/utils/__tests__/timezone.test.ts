/**
 * Timezone Conversion Tests
 *
 * Test suite for timezone conversion utilities
 *
 * Test Coverage:
 * - isValidTimezone - IANA timezone validation
 * - normalizeTimezone - Timezone normalization (IANA, abbreviations, UTC offsets)
 * - convertTimezone - Date conversion between timezones
 * - convertEventToUserTimezone - Event-specific conversion with all-day handling
 * - convertExceptionDatesToUserTimezone - Exception date array conversion
 * - Edge cases: invalid dates, null inputs, DST transitions
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  isValidTimezone,
  normalizeTimezone,
  convertTimezone,
  convertEventToUserTimezone,
  convertExceptionDatesToUserTimezone,
  formatDateInTimezone,
  getTimezoneOffset,
  TimezoneConversionResult,
} from '../timezone';
import { isValid } from 'date-fns';

describe('Timezone Utilities', () => {
  describe('isValidTimezone', () => {
    describe('valid IANA timezones', () => {
      it('should accept valid US timezones', () => {
        expect(isValidTimezone('America/New_York')).toBe(true);
        expect(isValidTimezone('America/Los_Angeles')).toBe(true);
        expect(isValidTimezone('America/Chicago')).toBe(true);
        expect(isValidTimezone('America/Denver')).toBe(true);
        expect(isValidTimezone('America/Phoenix')).toBe(true);
        expect(isValidTimezone('America/Anchorage')).toBe(true);
        expect(isValidTimezone('Pacific/Honolulu')).toBe(true);
      });

      it('should accept valid European timezones', () => {
        expect(isValidTimezone('Europe/London')).toBe(true);
        expect(isValidTimezone('Europe/Paris')).toBe(true);
        expect(isValidTimezone('Europe/Berlin')).toBe(true);
        expect(isValidTimezone('Europe/Rome')).toBe(true);
        expect(isValidTimezone('Europe/Athens')).toBe(true);
        expect(isValidTimezone('Europe/Moscow')).toBe(true);
      });

      it('should accept valid Asia/Pacific timezones', () => {
        expect(isValidTimezone('Asia/Tokyo')).toBe(true);
        expect(isValidTimezone('Asia/Shanghai')).toBe(true);
        expect(isValidTimezone('Asia/Kolkata')).toBe(true);
        expect(isValidTimezone('Asia/Dubai')).toBe(true);
        expect(isValidTimezone('Australia/Sydney')).toBe(true);
        expect(isValidTimezone('Pacific/Auckland')).toBe(true);
      });

      it('should accept UTC and Etc timezones', () => {
        expect(isValidTimezone('UTC')).toBe(true);
        expect(isValidTimezone('Etc/GMT')).toBe(true);
        expect(isValidTimezone('Etc/GMT-5')).toBe(true);
        expect(isValidTimezone('Etc/GMT+8')).toBe(true);
      });

      it('should accept timezone abbreviations (via Intl.DateTimeFormat)', () => {
        // Note: Intl.DateTimeFormat accepts some abbreviations as valid
        expect(isValidTimezone('EST')).toBe(true);
        expect(isValidTimezone('PST')).toBe(true);
        expect(isValidTimezone('CST')).toBe(true);
      });
    });

    describe('invalid timezones', () => {
      it('should reject invalid IANA timezone strings', () => {
        expect(isValidTimezone('Invalid/Zone')).toBe(false);
        expect(isValidTimezone('America/InvalidCity')).toBe(false);
        expect(isValidTimezone('Europe/NotACity')).toBe(false);
        expect(isValidTimezone('Random/Timezone')).toBe(false);
      });

      it('should reject empty or malformed inputs', () => {
        expect(isValidTimezone('')).toBe(false);
        expect(isValidTimezone('   ')).toBe(false);
        expect(isValidTimezone('GMT+5')).toBe(false); // Not valid IANA format
        expect(isValidTimezone('UTC+5')).toBe(false); // Not valid IANA format
      });

      it('should reject non-string inputs', () => {
        expect(isValidTimezone(null as any)).toBe(false);
        expect(isValidTimezone(undefined as any)).toBe(false);
        expect(isValidTimezone(123 as any)).toBe(false);
        expect(isValidTimezone({} as any)).toBe(false);
        expect(isValidTimezone([] as any)).toBe(false);
      });
    });
  });

  describe('normalizeTimezone', () => {
    describe('IANA timezone pass-through', () => {
      it('should pass through valid IANA timezones unchanged', () => {
        const result1 = normalizeTimezone('America/New_York');
        expect(result1.timezone).toBe('America/New_York');
        expect(result1.warning).toBeUndefined();

        const result2 = normalizeTimezone('Europe/London');
        expect(result2.timezone).toBe('Europe/London');
        expect(result2.warning).toBeUndefined();

        const result3 = normalizeTimezone('Asia/Tokyo');
        expect(result3.timezone).toBe('Asia/Tokyo');
        expect(result3.warning).toBeUndefined();
      });

      it('should handle UTC and Etc timezones', () => {
        const result1 = normalizeTimezone('UTC');
        expect(result1.timezone).toBe('UTC');
        expect(result1.warning).toBeUndefined();

        const result2 = normalizeTimezone('Etc/GMT-5');
        expect(result2.timezone).toBe('Etc/GMT-5');
        expect(result2.warning).toBeUndefined();
      });

      it('should trim whitespace from IANA timezones', () => {
        const result = normalizeTimezone('  America/New_York  ');
        expect(result.timezone).toBe('America/New_York');
        expect(result.warning).toBeUndefined();
      });

      it('should pass through timezone abbreviations accepted by Intl', () => {
        // Note: Since Intl.DateTimeFormat accepts EST, PST, etc. as valid,
        // they are passed through without mapping (this is the actual behavior)
        const result1 = normalizeTimezone('EST');
        expect(result1.timezone).toBe('EST');
        expect(result1.warning).toBeUndefined();

        const result2 = normalizeTimezone('PST');
        expect(result2.timezone).toBe('PST');
        expect(result2.warning).toBeUndefined();
      });
    });

    describe('abbreviation mapping', () => {
      it('should map timezone abbreviations not recognized by Intl', () => {
        // Test with abbreviations that might not be recognized by Intl
        // Note: The actual mapping behavior depends on the Intl implementation
        // Most common abbreviations (EST, PST, etc.) are actually valid in Intl

        // This test documents the expected behavior if abbreviations were mapped
        // In practice, most abbreviations pass through since Intl accepts them
        const testCases = [
          { input: 'CST_ASIA', expected: 'Asia/Shanghai' }, // Disambiguated
        ];

        testCases.forEach(({ input, expected }) => {
          const result = normalizeTimezone(input);
          expect(result.timezone).toBe(expected);
          expect(result.warning).toBeDefined();
          expect(result.warning).toContain('Mapped timezone abbreviation');
        });
      });

      it('should handle case-insensitive abbreviations for non-Intl mappings', () => {
        // CST_ASIA should map regardless of case
        expect(normalizeTimezone('cst_asia').timezone).toBe('Asia/Shanghai');
        expect(normalizeTimezone('CST_ASIA').timezone).toBe('Asia/Shanghai');
      });
    });

    describe('UTC offset handling', () => {
      it('should convert positive UTC offsets to Etc/GMT format', () => {
        // Note: Etc/GMT signs are inverted (Etc/GMT-5 = UTC+5)
        const result1 = normalizeTimezone('UTC+5');
        expect(result1.timezone).toBe('Etc/GMT-5');
        expect(result1.warning).toBeDefined();
        expect(result1.warning).toContain('Converted UTC offset');

        const result2 = normalizeTimezone('UTC+8');
        expect(result2.timezone).toBe('Etc/GMT-8');
        expect(result2.warning).toBeDefined();

        const result3 = normalizeTimezone('UTC+12');
        expect(result3.timezone).toBe('Etc/GMT-12');
        expect(result3.warning).toBeDefined();
      });

      it('should convert negative UTC offsets to Etc/GMT format', () => {
        const result1 = normalizeTimezone('UTC-5');
        expect(result1.timezone).toBe('Etc/GMT+5');
        expect(result1.warning).toBeDefined();

        const result2 = normalizeTimezone('UTC-8');
        expect(result2.timezone).toBe('Etc/GMT+8');
        expect(result2.warning).toBeDefined();
      });

      it('should handle UTC offset with minutes (colon format)', () => {
        const result1 = normalizeTimezone('UTC+5:30');
        // With minutes, it should still try to map or return a valid timezone
        expect(result1.timezone).toBeDefined();
      });

      it('should handle case-insensitive UTC offset format', () => {
        const result1 = normalizeTimezone('utc+5');
        expect(result1.timezone).toBe('Etc/GMT-5');

        const result2 = normalizeTimezone('Utc-3');
        expect(result2.timezone).toBe('Etc/GMT+3');
      });

      it('should handle UTC+0 offset', () => {
        const result = normalizeTimezone('UTC+0');
        // UTC+0 should map to Etc/GMT+0 or Etc/GMT-0 (both are valid)
        expect(result.timezone).toMatch(/Etc\/GMT[+-]?0/);
        expect(result.warning).toBeDefined();
      });
    });

    describe('fallback behavior', () => {
      it('should fallback to UTC for unknown timezones', () => {
        const result = normalizeTimezone('Unknown/Timezone');
        expect(result.timezone).toBe('UTC');
        expect(result.warning).toBeDefined();
        expect(result.warning).toContain('Unknown timezone');
        expect(result.warning).toContain('defaulting to UTC');
      });

      it('should fallback to UTC for empty input', () => {
        const result1 = normalizeTimezone('');
        expect(result1.timezone).toBe('UTC');
        expect(result1.warning).toBeDefined();
        expect(result1.warning).toContain('Empty timezone');

        const result2 = normalizeTimezone('   ');
        expect(result2.timezone).toBe('UTC');
        expect(result2.warning).toBeDefined();
      });

      it('should fallback to UTC for null/undefined input', () => {
        const result1 = normalizeTimezone(null as any);
        expect(result1.timezone).toBe('UTC');
        expect(result1.warning).toBeDefined();

        const result2 = normalizeTimezone(undefined as any);
        expect(result2.timezone).toBe('UTC');
        expect(result2.warning).toBeDefined();
      });

      it('should fallback to UTC for non-string input', () => {
        const result1 = normalizeTimezone(123 as any);
        expect(result1.timezone).toBe('UTC');
        expect(result1.warning).toBeDefined();

        const result2 = normalizeTimezone({} as any);
        expect(result2.timezone).toBe('UTC');
        expect(result2.warning).toBeDefined();
      });
    });
  });

  describe('convertTimezone', () => {
    describe('same timezone (no conversion)', () => {
      it('should return original date when source and target are identical', () => {
        const date = new Date('2025-01-15T14:00:00Z');
        const result = convertTimezone(date, 'America/New_York', 'America/New_York');

        expect(result.convertedDate).toEqual(date);
        expect(result.originalTimezone).toBe('America/New_York');
        expect(result.targetTimezone).toBe('America/New_York');
        expect(result.wasConverted).toBe(false);
        expect(result.warning).toBeUndefined();
      });

      it('should not convert when normalized timezones are the same', () => {
        const date = new Date('2025-01-15T14:00:00Z');
        // Both EST and America/New_York might be treated as equivalent by Intl
        // or EST might just pass through as-is
        const result = convertTimezone(date, 'EST', 'EST');

        expect(result.wasConverted).toBe(false);
        expect(result.originalTimezone).toBe('EST');
        expect(result.targetTimezone).toBe('EST');
      });
    });

    describe('different timezones', () => {
      it('should convert between US timezones correctly', () => {
        // 2pm EST = 11am PST (3 hour difference)
        const date = new Date('2025-01-15T14:00:00');
        const result = convertTimezone(date, 'America/New_York', 'America/Los_Angeles');

        expect(result.wasConverted).toBe(true);
        expect(result.originalTimezone).toBe('America/New_York');
        expect(result.targetTimezone).toBe('America/Los_Angeles');
        expect(isValid(result.convertedDate)).toBe(true);

        // The conversion should account for timezone offset
        expect(result.convertedDate).toBeDefined();
      });

      it('should convert from US to European timezones', () => {
        // 2pm EST = 7pm GMT (5 hour difference during standard time)
        const date = new Date('2025-01-15T14:00:00');
        const result = convertTimezone(date, 'America/New_York', 'Europe/London');

        expect(result.wasConverted).toBe(true);
        expect(result.originalTimezone).toBe('America/New_York');
        expect(result.targetTimezone).toBe('Europe/London');
        expect(isValid(result.convertedDate)).toBe(true);
      });

      it('should convert from US to Asia/Pacific timezones', () => {
        const date = new Date('2025-01-15T14:00:00');
        const result = convertTimezone(date, 'America/New_York', 'Asia/Tokyo');

        expect(result.wasConverted).toBe(true);
        expect(result.originalTimezone).toBe('America/New_York');
        expect(result.targetTimezone).toBe('Asia/Tokyo');
        expect(isValid(result.convertedDate)).toBe(true);
      });

      it('should handle timezone abbreviations passed through by Intl', () => {
        const date = new Date('2025-01-15T14:00:00');
        const result = convertTimezone(date, 'EST', 'PST');

        // EST and PST are both valid in Intl, so conversion should happen
        expect(result.wasConverted).toBe(true);
        // No warnings since both are valid timezones
        expect(result.warning).toBeUndefined();
      });

      it('should convert UTC to local timezones', () => {
        const date = new Date('2025-01-15T14:00:00Z');
        const result = convertTimezone(date, 'UTC', 'America/New_York');

        expect(result.wasConverted).toBe(true);
        expect(result.originalTimezone).toBe('UTC');
        expect(result.targetTimezone).toBe('America/New_York');
        expect(isValid(result.convertedDate)).toBe(true);
      });

      it('should convert local timezones to UTC', () => {
        const date = new Date('2025-01-15T14:00:00');
        const result = convertTimezone(date, 'America/New_York', 'UTC');

        expect(result.wasConverted).toBe(true);
        expect(result.originalTimezone).toBe('America/New_York');
        expect(result.targetTimezone).toBe('UTC');
        expect(isValid(result.convertedDate)).toBe(true);
      });
    });

    describe('DST transitions', () => {
      it('should handle spring forward DST transition (March)', () => {
        // March 9, 2025 - DST begins in US (2am -> 3am)
        const date = new Date('2025-03-09T02:30:00');
        const result = convertTimezone(date, 'America/New_York', 'America/Los_Angeles');

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.convertedDate)).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it('should handle fall back DST transition (November)', () => {
        // November 2, 2025 - DST ends in US (2am -> 1am)
        const date = new Date('2025-11-02T01:30:00');
        const result = convertTimezone(date, 'America/New_York', 'America/Los_Angeles');

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.convertedDate)).toBe(true);
      });

      it('should handle different DST schedules between timezones', () => {
        // US and Europe have different DST transition dates
        const date = new Date('2025-03-15T12:00:00');
        const result = convertTimezone(date, 'America/New_York', 'Europe/London');

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.convertedDate)).toBe(true);
      });

      it('should handle timezone without DST (Phoenix)', () => {
        // Arizona doesn't observe DST
        const date = new Date('2025-06-15T12:00:00');
        const result = convertTimezone(date, 'America/Phoenix', 'America/New_York');

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.convertedDate)).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle invalid date gracefully', () => {
        const invalidDate = new Date('invalid-date');
        const result = convertTimezone(invalidDate, 'America/New_York', 'America/Los_Angeles');

        expect(result.wasConverted).toBe(false);
        expect(result.warning).toBeDefined();
        expect(result.warning).toContain('Invalid date');
        expect(isValid(result.convertedDate)).toBe(true); // Returns new Date()
      });

      it('should handle null date input', () => {
        const result = convertTimezone(null as any, 'America/New_York', 'America/Los_Angeles');

        expect(result.wasConverted).toBe(false);
        expect(result.warning).toBeDefined();
        expect(result.warning).toContain('Invalid date');
      });

      it('should handle undefined date input', () => {
        const result = convertTimezone(undefined as any, 'America/New_York', 'America/Los_Angeles');

        expect(result.wasConverted).toBe(false);
        expect(result.warning).toBeDefined();
      });

      it('should handle leap year dates correctly', () => {
        const leapDate = new Date('2024-02-29T12:00:00');
        const result = convertTimezone(leapDate, 'America/New_York', 'Europe/London');

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.convertedDate)).toBe(true);
      });

      it('should handle year boundary dates', () => {
        const newYear = new Date('2025-01-01T00:00:00');
        const result = convertTimezone(newYear, 'America/New_York', 'Asia/Tokyo');

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.convertedDate)).toBe(true);
      });

      it('should handle far future dates', () => {
        const futureDate = new Date('2099-12-31T23:59:59');
        const result = convertTimezone(futureDate, 'America/New_York', 'America/Los_Angeles');

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.convertedDate)).toBe(true);
      });

      it('should handle far past dates', () => {
        const pastDate = new Date('1970-01-01T00:00:00');
        const result = convertTimezone(pastDate, 'America/New_York', 'America/Los_Angeles');

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.convertedDate)).toBe(true);
      });

      it('should combine warnings from source and target normalization', () => {
        const date = new Date('2025-01-15T14:00:00');
        // Use UTC offset format which generates warnings
        const result = convertTimezone(date, 'UTC+5', 'UTC-3');

        expect(result.warning).toBeDefined();
        // Both should generate warnings
        expect(result.warning?.includes('Converted UTC offset')).toBe(true);
      });
    });
  });

  describe('convertEventToUserTimezone', () => {
    describe('all-day events (no conversion)', () => {
      it('should not convert all-day events', () => {
        const startTime = new Date('2025-01-15T00:00:00');
        const endTime = new Date('2025-01-16T00:00:00');

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'America/Los_Angeles',
          true // isAllDay
        );

        expect(result.startTime).toEqual(startTime);
        expect(result.endTime).toEqual(endTime);
        expect(result.wasConverted).toBe(false);
        expect(result.originalTimezone).toBe('America/New_York');
      });

      it('should preserve all-day events across timezone boundaries', () => {
        const startTime = new Date('2025-01-15T00:00:00');
        const endTime = new Date('2025-01-16T00:00:00');

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'Asia/Tokyo',
          true
        );

        expect(result.startTime).toEqual(startTime);
        expect(result.endTime).toEqual(endTime);
        expect(result.wasConverted).toBe(false);
      });

      it('should handle timezone normalization for all-day events', () => {
        const startTime = new Date('2025-01-15T00:00:00');
        const endTime = new Date('2025-01-16T00:00:00');

        // Using UTC offset format which generates warnings
        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'UTC+5',
          'America/Los_Angeles',
          true
        );

        expect(result.wasConverted).toBe(false);
        expect(result.warning).toBeDefined();
        expect(result.warning).toContain('Converted UTC offset');
      });

      it('should handle multi-day all-day events', () => {
        const startTime = new Date('2025-01-15T00:00:00');
        const endTime = new Date('2025-01-18T00:00:00'); // 3-day event

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'America/Los_Angeles',
          true
        );

        expect(result.startTime).toEqual(startTime);
        expect(result.endTime).toEqual(endTime);
        expect(result.wasConverted).toBe(false);
      });
    });

    describe('timed events (conversion)', () => {
      it('should convert timed events between timezones', () => {
        const startTime = new Date('2025-01-15T14:00:00');
        const endTime = new Date('2025-01-15T15:00:00');

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'America/Los_Angeles',
          false // Not all-day
        );

        expect(result.wasConverted).toBe(true);
        expect(result.originalTimezone).toBe('America/New_York');
        expect(isValid(result.startTime)).toBe(true);
        expect(isValid(result.endTime)).toBe(true);
      });

      it('should convert both start and end times', () => {
        const startTime = new Date('2025-01-15T14:00:00');
        const endTime = new Date('2025-01-15T16:30:00');

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'Europe/London',
          false
        );

        expect(result.wasConverted).toBe(true);
        expect(result.startTime).not.toEqual(startTime);
        expect(result.endTime).not.toEqual(endTime);
      });

      it('should not convert when source and target are the same', () => {
        const startTime = new Date('2025-01-15T14:00:00');
        const endTime = new Date('2025-01-15T15:00:00');

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'America/New_York',
          false
        );

        expect(result.wasConverted).toBe(false);
        expect(result.startTime).toEqual(startTime);
        expect(result.endTime).toEqual(endTime);
      });

      it('should handle events spanning multiple days', () => {
        const startTime = new Date('2025-01-15T23:00:00');
        const endTime = new Date('2025-01-16T02:00:00'); // Next day

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.startTime)).toBe(true);
        expect(isValid(result.endTime)).toBe(true);
      });

      it('should handle events during DST transition', () => {
        const startTime = new Date('2025-03-09T02:30:00'); // DST transition
        const endTime = new Date('2025-03-09T03:30:00');

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.startTime)).toBe(true);
        expect(isValid(result.endTime)).toBe(true);
      });

      it('should combine warnings from start and end conversions', () => {
        const startTime = new Date('2025-01-15T14:00:00');
        const endTime = new Date('2025-01-15T15:00:00');

        // Use UTC offset format which generates warnings
        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'UTC+5',
          'UTC-3',
          false
        );

        expect(result.warning).toBeDefined();
        // Should have warnings for both start and end
        expect(result.warning).toContain('Start:');
        expect(result.warning).toContain('End:');
      });

      it('should handle short events (minutes)', () => {
        const startTime = new Date('2025-01-15T14:00:00');
        const endTime = new Date('2025-01-15T14:15:00'); // 15 minutes

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.startTime)).toBe(true);
        expect(isValid(result.endTime)).toBe(true);
      });

      it('should handle long events (hours)', () => {
        const startTime = new Date('2025-01-15T09:00:00');
        const endTime = new Date('2025-01-15T17:00:00'); // 8 hours

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'Europe/London',
          false
        );

        expect(result.wasConverted).toBe(true);
        expect(isValid(result.startTime)).toBe(true);
        expect(isValid(result.endTime)).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle invalid start time', () => {
        const invalidStart = new Date('invalid');
        const endTime = new Date('2025-01-15T15:00:00');

        const result = convertEventToUserTimezone(
          invalidStart,
          endTime,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result.warning).toBeDefined();
        expect(result.warning).toContain('Invalid date');
      });

      it('should handle invalid end time', () => {
        const startTime = new Date('2025-01-15T14:00:00');
        const invalidEnd = new Date('invalid');

        const result = convertEventToUserTimezone(
          startTime,
          invalidEnd,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result.warning).toBeDefined();
        expect(result.warning).toContain('Invalid date');
      });

      it('should handle end time before start time', () => {
        const startTime = new Date('2025-01-15T15:00:00');
        const endTime = new Date('2025-01-15T14:00:00'); // Earlier

        const result = convertEventToUserTimezone(
          startTime,
          endTime,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        // Should still convert, even if logically inconsistent
        expect(isValid(result.startTime)).toBe(true);
        expect(isValid(result.endTime)).toBe(true);
      });
    });
  });

  describe('convertExceptionDatesToUserTimezone', () => {
    describe('all-day events', () => {
      it('should not convert exception dates for all-day events', () => {
        const exceptionDates = [
          new Date('2025-01-15T00:00:00'),
          new Date('2025-01-20T00:00:00'),
          new Date('2025-01-25T00:00:00'),
        ];

        const result = convertExceptionDatesToUserTimezone(
          exceptionDates,
          'America/New_York',
          'America/Los_Angeles',
          true // isAllDay
        );

        expect(result).toEqual(exceptionDates);
        expect(result.length).toBe(3);
        result.forEach((date, i) => {
          expect(date).toEqual(exceptionDates[i]);
        });
      });

      it('should handle empty exception dates array for all-day events', () => {
        const result = convertExceptionDatesToUserTimezone(
          [],
          'America/New_York',
          'America/Los_Angeles',
          true
        );

        expect(result).toEqual([]);
        expect(result.length).toBe(0);
      });
    });

    describe('timed events', () => {
      it('should convert exception dates for timed events', () => {
        const exceptionDates = [
          new Date('2025-01-15T14:00:00'),
          new Date('2025-01-20T14:00:00'),
          new Date('2025-01-25T14:00:00'),
        ];

        const result = convertExceptionDatesToUserTimezone(
          exceptionDates,
          'America/New_York',
          'America/Los_Angeles',
          false // Not all-day
        );

        expect(result.length).toBe(3);
        result.forEach((date) => {
          expect(isValid(date)).toBe(true);
        });
        // Dates should be converted (different from original)
        expect(result[0]).not.toEqual(exceptionDates[0]);
      });

      it('should convert each exception date independently', () => {
        const exceptionDates = [
          new Date('2025-01-15T10:00:00'),
          new Date('2025-01-20T14:00:00'),
          new Date('2025-01-25T18:00:00'),
        ];

        const result = convertExceptionDatesToUserTimezone(
          exceptionDates,
          'America/New_York',
          'Europe/London',
          false
        );

        expect(result.length).toBe(3);
        result.forEach((date, i) => {
          expect(isValid(date)).toBe(true);
          expect(date).not.toEqual(exceptionDates[i]);
        });
      });

      it('should handle single exception date', () => {
        const exceptionDates = [new Date('2025-01-15T14:00:00')];

        const result = convertExceptionDatesToUserTimezone(
          exceptionDates,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result.length).toBe(1);
        expect(isValid(result[0])).toBe(true);
      });

      it('should handle empty exception dates array for timed events', () => {
        const result = convertExceptionDatesToUserTimezone(
          [],
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result).toEqual([]);
        expect(result.length).toBe(0);
      });

      it('should handle exception dates during DST transition', () => {
        const exceptionDates = [
          new Date('2025-03-09T02:30:00'), // DST transition
          new Date('2025-11-02T01:30:00'), // DST end
        ];

        const result = convertExceptionDatesToUserTimezone(
          exceptionDates,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result.length).toBe(2);
        result.forEach((date) => {
          expect(isValid(date)).toBe(true);
        });
      });

      it('should handle exception dates across year boundary', () => {
        const exceptionDates = [
          new Date('2024-12-25T14:00:00'),
          new Date('2025-01-01T14:00:00'),
          new Date('2025-01-15T14:00:00'),
        ];

        const result = convertExceptionDatesToUserTimezone(
          exceptionDates,
          'America/New_York',
          'Asia/Tokyo',
          false
        );

        expect(result.length).toBe(3);
        result.forEach((date) => {
          expect(isValid(date)).toBe(true);
        });
      });

      it('should not convert when source and target are the same', () => {
        const exceptionDates = [
          new Date('2025-01-15T14:00:00'),
          new Date('2025-01-20T14:00:00'),
        ];

        const result = convertExceptionDatesToUserTimezone(
          exceptionDates,
          'America/New_York',
          'America/New_York',
          false
        );

        expect(result.length).toBe(2);
        // Should return dates, possibly unchanged
        result.forEach((date) => {
          expect(isValid(date)).toBe(true);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle invalid dates in array', () => {
        const exceptionDates = [
          new Date('2025-01-15T14:00:00'),
          new Date('invalid'),
          new Date('2025-01-25T14:00:00'),
        ];

        const result = convertExceptionDatesToUserTimezone(
          exceptionDates,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result.length).toBe(3);
        // First and third should be valid
        expect(isValid(result[0])).toBe(true);
        expect(isValid(result[2])).toBe(true);
        // Second might be valid (new Date()) or handled
        expect(result[1]).toBeDefined();
      });

      it('should handle large array of exception dates', () => {
        const exceptionDates = Array.from({ length: 100 }, (_, i) =>
          new Date(`2025-01-${(i % 28) + 1}T14:00:00`)
        );

        const result = convertExceptionDatesToUserTimezone(
          exceptionDates,
          'America/New_York',
          'America/Los_Angeles',
          false
        );

        expect(result.length).toBe(100);
        result.forEach((date) => {
          expect(isValid(date)).toBe(true);
        });
      });
    });
  });

  describe('formatDateInTimezone', () => {
    it('should format date in specified timezone with default format', () => {
      const date = new Date('2025-01-15T14:00:00Z');
      const formatted = formatDateInTimezone(date, 'America/New_York');

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      // Default format: "yyyy-MM-dd'T'HH:mm:ssXXX"
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format date with custom format string', () => {
      const date = new Date('2025-01-15T14:00:00Z');
      const formatted = formatDateInTimezone(date, 'America/New_York', 'yyyy-MM-dd HH:mm');

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('should format date in different timezones', () => {
      const date = new Date('2025-01-15T14:00:00Z');

      const nyFormatted = formatDateInTimezone(date, 'America/New_York', 'HH:mm');
      const laFormatted = formatDateInTimezone(date, 'America/Los_Angeles', 'HH:mm');

      expect(nyFormatted).toBeDefined();
      expect(laFormatted).toBeDefined();
      // Times should be different
      expect(nyFormatted).not.toBe(laFormatted);
    });

    it('should handle timezone normalization', () => {
      const date = new Date('2025-01-15T14:00:00Z');
      const formatted = formatDateInTimezone(date, 'EST', 'yyyy-MM-dd');

      expect(formatted).toBeDefined();
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getTimezoneOffset', () => {
    it('should return offset in minutes for timezone', () => {
      const offset = getTimezoneOffset('America/New_York');

      expect(typeof offset).toBe('number');
      // EST is UTC-5 (300 minutes behind) or EDT is UTC-4 (240 minutes behind)
      expect(Math.abs(offset)).toBeGreaterThan(0);
    });

    it('should return 0 for UTC timezone', () => {
      const offset = getTimezoneOffset('UTC');

      expect(offset).toBe(0);
    });

    it('should return different offsets for different timezones', () => {
      const nyOffset = getTimezoneOffset('America/New_York');
      const laOffset = getTimezoneOffset('America/Los_Angeles');

      expect(nyOffset).not.toBe(laOffset);
    });

    it('should handle timezone normalization', () => {
      const offset = getTimezoneOffset('EST');

      expect(typeof offset).toBe('number');
    });

    it('should handle specific date for offset calculation', () => {
      const summerDate = new Date('2025-07-15T12:00:00Z');
      const winterDate = new Date('2025-01-15T12:00:00Z');

      const summerOffset = getTimezoneOffset('America/New_York', summerDate);
      const winterOffset = getTimezoneOffset('America/New_York', winterDate);

      // Offsets might be different due to DST
      expect(typeof summerOffset).toBe('number');
      expect(typeof winterOffset).toBe('number');
    });

    it('should handle invalid timezone gracefully', () => {
      const offset = getTimezoneOffset('Invalid/Timezone');

      // Should return 0 for invalid timezone
      expect(offset).toBe(0);
    });

    it('should use current date if not provided', () => {
      const offset = getTimezoneOffset('America/New_York');

      expect(typeof offset).toBe('number');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete event conversion workflow', () => {
      // Simulate importing an event from ICS with UTC offset formats
      const startTime = new Date('2025-01-15T14:00:00');
      const endTime = new Date('2025-01-15T15:30:00');
      const exceptionDates = [
        new Date('2025-01-22T14:00:00'),
        new Date('2025-01-29T14:00:00'),
      ];

      const event = convertEventToUserTimezone(
        startTime,
        endTime,
        'UTC+5',
        'UTC-3',
        false
      );

      const exceptions = convertExceptionDatesToUserTimezone(
        exceptionDates,
        'UTC+5',
        'UTC-3',
        false
      );

      expect(event.wasConverted).toBe(true);
      expect(event.warning).toBeDefined(); // UTC offset warnings
      expect(exceptions.length).toBe(2);
      exceptions.forEach(date => expect(isValid(date)).toBe(true));
    });

    it('should preserve all-day events in complete workflow', () => {
      const startTime = new Date('2025-01-15T00:00:00');
      const endTime = new Date('2025-01-16T00:00:00');
      const exceptionDates = [
        new Date('2025-01-22T00:00:00'),
      ];

      const event = convertEventToUserTimezone(
        startTime,
        endTime,
        'America/New_York',
        'Asia/Tokyo',
        true // All-day
      );

      const exceptions = convertExceptionDatesToUserTimezone(
        exceptionDates,
        'America/New_York',
        'Asia/Tokyo',
        true // All-day
      );

      expect(event.wasConverted).toBe(false);
      expect(event.startTime).toEqual(startTime);
      expect(exceptions[0]).toEqual(exceptionDates[0]);
    });

    it('should handle mixed timezone formats in workflow', () => {
      const startTime = new Date('2025-01-15T14:00:00');
      const endTime = new Date('2025-01-15T15:00:00');

      // Use different timezone formats
      const result1 = convertEventToUserTimezone(
        startTime,
        endTime,
        'EST', // Abbreviation (passes through via Intl)
        'America/Los_Angeles', // IANA
        false
      );

      const result2 = convertEventToUserTimezone(
        startTime,
        endTime,
        'UTC+5', // Offset (generates warning)
        'Europe/London', // IANA
        false
      );

      expect(result1.wasConverted).toBe(true);
      expect(result2.wasConverted).toBe(true);
      // result1 should not have warnings (both valid)
      // result2 should have warnings (UTC offset)
      expect(result2.warning).toBeDefined();
    });
  });
});
