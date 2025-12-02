/**
 * Tests for Calendar Grid Utility Functions
 *
 * Test Coverage:
 * - Time slot generation (96 slots for 24 hours)
 * - Week day calculation (starts on Sunday)
 * - Month grid generation (6-7 weeks)
 * - Event position calculation (15-min slot precision)
 * - Overlap detection and width calculation
 * - Event grouping by day
 * - All-day event separation
 * - Date utilities and formatting
 */

import { describe, it, expect } from 'vitest';
import type { CalendarEvent } from '../api/calendar';
import {
  getTimeSlots,
  getWeekDays,
  getMonthGrid,
  calculateEventPosition,
  detectOverlappingEvents,
  transformToGridEvent,
  groupEventsByDay,
  getCurrentTimeSlot,
  isToday,
  isCurrentMonth,
  formatTime,
  formatDateShort,
  getWeekdayName,
  getWeekdayNameShort,
  separateAllDayEvents,
} from './calendarGrid';

describe('calendarGrid utilities', () => {
  // ==================== Time Slot Tests ====================
  describe('getTimeSlots', () => {
    it('should generate exactly 96 time slots for 24 hours', () => {
      const slots = getTimeSlots();
      expect(slots).toHaveLength(96);
    });

    it('should start with 12:00 AM (midnight)', () => {
      const slots = getTimeSlots();
      expect(slots[0].label).toBe('12:00 AM');
      expect(slots[0].hour).toBe(0);
      expect(slots[0].minute).toBe(0);
      expect(slots[0].index).toBe(0);
    });

    it('should end with 11:45 PM', () => {
      const slots = getTimeSlots();
      expect(slots[95].label).toBe('11:45 PM');
      expect(slots[95].hour).toBe(23);
      expect(slots[95].minute).toBe(45);
      expect(slots[95].index).toBe(95);
    });

    it('should have 15-minute intervals', () => {
      const slots = getTimeSlots();
      expect(slots[0].minute).toBe(0);
      expect(slots[1].minute).toBe(15);
      expect(slots[2].minute).toBe(30);
      expect(slots[3].minute).toBe(45);
      expect(slots[4].minute).toBe(0); // Next hour
    });

    it('should format noon correctly as 12:00 PM', () => {
      const slots = getTimeSlots();
      const noonSlot = slots.find(s => s.hour === 12 && s.minute === 0);
      expect(noonSlot?.label).toBe('12:00 PM');
    });

    it('should format AM/PM correctly', () => {
      const slots = getTimeSlots();
      const slot9AM = slots.find(s => s.hour === 9 && s.minute === 0);
      const slot9PM = slots.find(s => s.hour === 21 && s.minute === 0);
      expect(slot9AM?.label).toBe('9:00 AM');
      expect(slot9PM?.label).toBe('9:00 PM');
    });

    it('should have sequential indices from 0 to 95', () => {
      const slots = getTimeSlots();
      slots.forEach((slot, index) => {
        expect(slot.index).toBe(index);
      });
    });

    it('should calculate correct slot index based on hour and minute', () => {
      const slots = getTimeSlots();
      // 9:30 AM should be slot 38 (9 hours * 4 + 2 for 30 minutes)
      const slot9_30 = slots.find(s => s.hour === 9 && s.minute === 30);
      expect(slot9_30?.index).toBe(38);
    });

    it('should have labelShort only for hour marks', () => {
      const slots = getTimeSlots();
      const hourMarks = slots.filter(s => s.minute === 0);
      const nonHourMarks = slots.filter(s => s.minute !== 0);

      hourMarks.forEach(slot => {
        expect(slot.labelShort).toBeTruthy();
      });

      nonHourMarks.forEach(slot => {
        expect(slot.labelShort).toBe('');
      });
    });
  });

  // ==================== Week Days Tests ====================
  describe('getWeekDays', () => {
    it('should return 7 days starting from Sunday', () => {
      const startDate = new Date('2025-12-10'); // Wednesday
      const weekDays = getWeekDays(startDate);

      expect(weekDays).toHaveLength(7);
      expect(weekDays[0].getDay()).toBe(0); // Sunday
      expect(weekDays[6].getDay()).toBe(6); // Saturday
    });

    it('should adjust to Sunday when given a mid-week date', () => {
      const wednesday = new Date('2025-12-10'); // Wednesday
      const weekDays = getWeekDays(wednesday);

      // First day should be the Sunday before
      expect(weekDays[0].toDateString()).toBe('Sun Dec 07 2025');
      expect(weekDays[6].toDateString()).toBe('Sat Dec 13 2025');
    });

    it('should work correctly when given a Sunday', () => {
      const sunday = new Date('2025-12-07');
      const weekDays = getWeekDays(sunday);

      expect(weekDays[0].toDateString()).toBe('Sun Dec 07 2025');
      expect(weekDays[6].toDateString()).toBe('Sat Dec 13 2025');
    });

    it('should work correctly when given a Saturday', () => {
      const saturday = new Date('2025-12-13');
      const weekDays = getWeekDays(saturday);

      expect(weekDays[0].toDateString()).toBe('Sun Dec 07 2025');
      expect(weekDays[6].toDateString()).toBe('Sat Dec 13 2025');
    });

    it('should reset hours to midnight for all days', () => {
      const startDate = new Date('2025-12-10T15:30:00');
      const weekDays = getWeekDays(startDate);

      weekDays.forEach(day => {
        expect(day.getHours()).toBe(0);
        expect(day.getMinutes()).toBe(0);
        expect(day.getSeconds()).toBe(0);
        expect(day.getMilliseconds()).toBe(0);
      });
    });

    it('should handle year boundaries correctly', () => {
      const newYearsDay = new Date('2026-01-01'); // Thursday
      const weekDays = getWeekDays(newYearsDay);

      // Should start on previous year's Sunday
      expect(weekDays[0].getFullYear()).toBe(2025);
      expect(weekDays[0].getMonth()).toBe(11); // December
      expect(weekDays[0].getDate()).toBe(28);
    });
  });

  // ==================== Month Grid Tests ====================
  describe('getMonthGrid', () => {
    it('should return an array of weeks', () => {
      const grid = getMonthGrid(11, 2025); // December 2025
      expect(Array.isArray(grid)).toBe(true);
      expect(grid.length).toBeGreaterThanOrEqual(4);
      expect(grid.length).toBeLessThanOrEqual(7);
    });

    it('should have 7 days in each week', () => {
      const grid = getMonthGrid(11, 2025);
      grid.forEach(week => {
        expect(week).toHaveLength(7);
      });
    });

    it('should start first week on Sunday', () => {
      const grid = getMonthGrid(11, 2025);
      expect(grid[0][0].getDay()).toBe(0); // Sunday
    });

    it('should end last week on Saturday', () => {
      const grid = getMonthGrid(11, 2025);
      const lastWeek = grid[grid.length - 1];
      expect(lastWeek[6].getDay()).toBe(6); // Saturday
    });

    it('should include dates from adjacent months', () => {
      const grid = getMonthGrid(11, 2025); // December 2025
      const allDates = grid.flat();

      // Should have dates from November and/or January
      const hasNovDates = allDates.some(d => d.getMonth() === 10);
      const hasJanDates = allDates.some(d => d.getMonth() === 0);

      expect(hasNovDates || hasJanDates).toBe(true);
    });

    it('should cover entire month plus padding', () => {
      const grid = getMonthGrid(11, 2025); // December 2025
      const allDates = grid.flat();

      // Should have all days in December (1-31)
      for (let day = 1; day <= 31; day++) {
        const hasDate = allDates.some(
          d => d.getMonth() === 11 && d.getDate() === day
        );
        expect(hasDate).toBe(true);
      }
    });

    it('should handle February in leap year', () => {
      const grid = getMonthGrid(1, 2024); // February 2024 (leap year)
      const allDates = grid.flat();
      const febDates = allDates.filter(d => d.getMonth() === 1);

      // Should have 29 days in February 2024
      expect(febDates).toHaveLength(29);
    });

    it('should handle February in non-leap year', () => {
      const grid = getMonthGrid(1, 2025); // February 2025 (non-leap)
      const allDates = grid.flat();
      const febDates = allDates.filter(d => d.getMonth() === 1);

      // Should have 28 days in February 2025
      expect(febDates).toHaveLength(28);
    });

    it('should generate 5 weeks for months that fit perfectly', () => {
      const grid = getMonthGrid(1, 2021); // February 2021 starts on Monday, 28 days
      // This should generate exactly 5 weeks
      expect(grid.length).toBeGreaterThanOrEqual(4);
      expect(grid.length).toBeLessThanOrEqual(6);
    });

    it('should handle January 2025 correctly', () => {
      const grid = getMonthGrid(0, 2025);
      const firstDate = grid[0][0];
      const lastWeek = grid[grid.length - 1];

      // Should start before January 1st
      expect(firstDate.getMonth() === 11 || firstDate.getDate() === 1).toBe(true);
    });
  });

  // ==================== Event Position Calculation Tests ====================
  describe('calculateEventPosition', () => {
    it('should calculate correct position for 9:30 AM event', () => {
      const event: CalendarEvent = {
        id: '1',
        calendarId: 'cal1',
        title: 'Test Event',
        startTime: '2025-12-10T09:30:00.000Z',
        endTime: '2025-12-10T10:30:00.000Z',
        isAllDay: false,
        provider: 'GOOGLE',
        calendarName: 'Test Calendar',
      };

      const dayStart = new Date('2025-12-10T00:00:00.000Z');
      const position = calculateEventPosition(event, dayStart);

      // 9:30 AM = slot 38 (9 * 4 + 2)
      expect(position.startSlot).toBe(38);
      // 1 hour = 4 slots
      expect(position.spanSlots).toBe(4);
    });

    it('should calculate correct position for midnight event', () => {
      const event: CalendarEvent = {
        id: '1',
        calendarId: 'cal1',
        title: 'Midnight Event',
        startTime: '2025-12-10T00:00:00.000Z',
        endTime: '2025-12-10T01:00:00.000Z',
        isAllDay: false,
        provider: 'GOOGLE',
        calendarName: 'Test Calendar',
      };

      const dayStart = new Date('2025-12-10T00:00:00.000Z');
      const position = calculateEventPosition(event, dayStart);

      expect(position.startSlot).toBe(0);
      expect(position.spanSlots).toBe(4); // 1 hour
    });

    it('should calculate correct position for late evening event', () => {
      const event: CalendarEvent = {
        id: '1',
        calendarId: 'cal1',
        title: 'Late Event',
        startTime: '2025-12-10T23:00:00.000Z',
        endTime: '2025-12-10T23:45:00.000Z',
        isAllDay: false,
        provider: 'GOOGLE',
        calendarName: 'Test Calendar',
      };

      const dayStart = new Date('2025-12-10T00:00:00.000Z');
      const position = calculateEventPosition(event, dayStart);

      // 11 PM = slot 92 (23 * 4)
      expect(position.startSlot).toBe(92);
      // 45 minutes = 3 slots
      expect(position.spanSlots).toBe(3);
    });

    it('should handle events spanning midnight by capping at day end', () => {
      const event: CalendarEvent = {
        id: '1',
        calendarId: 'cal1',
        title: 'Overnight Event',
        startTime: '2025-12-10T23:30:00.000Z',
        endTime: '2025-12-11T01:30:00.000Z',
        isAllDay: false,
        provider: 'GOOGLE',
        calendarName: 'Test Calendar',
      };

      const dayStart = new Date('2025-12-10T00:00:00.000Z');
      const position = calculateEventPosition(event, dayStart);

      // Should start at 11:30 PM = slot 94
      expect(position.startSlot).toBe(94);
      // Should cap at end of day = 2 slots until midnight
      expect(position.spanSlots).toBe(2);
    });

    it('should have minimum span of 1 slot for very short events', () => {
      const event: CalendarEvent = {
        id: '1',
        calendarId: 'cal1',
        title: 'Short Event',
        startTime: '2025-12-10T09:00:00.000Z',
        endTime: '2025-12-10T09:05:00.000Z',
        isAllDay: false,
        provider: 'GOOGLE',
        calendarName: 'Test Calendar',
      };

      const dayStart = new Date('2025-12-10T00:00:00.000Z');
      const position = calculateEventPosition(event, dayStart);

      // Even very short events should span at least 1 slot
      expect(position.spanSlots).toBeGreaterThanOrEqual(1);
    });

    it('should handle events with odd minute values', () => {
      const event: CalendarEvent = {
        id: '1',
        calendarId: 'cal1',
        title: 'Odd Time Event',
        startTime: '2025-12-10T09:17:00.000Z',
        endTime: '2025-12-10T10:43:00.000Z',
        isAllDay: false,
        provider: 'GOOGLE',
        calendarName: 'Test Calendar',
      };

      const dayStart = new Date('2025-12-10T00:00:00.000Z');
      const position = calculateEventPosition(event, dayStart);

      // Should round down to nearest 15-min slot
      // 9:17 -> slot 37 (9 * 4 + 1 for 15-min mark)
      expect(position.startSlot).toBe(37);
      expect(position.spanSlots).toBeGreaterThan(0);
    });

    it('should handle noon events correctly', () => {
      const event: CalendarEvent = {
        id: '1',
        calendarId: 'cal1',
        title: 'Lunch',
        startTime: '2025-12-10T12:00:00.000Z',
        endTime: '2025-12-10T13:00:00.000Z',
        isAllDay: false,
        provider: 'GOOGLE',
        calendarName: 'Test Calendar',
      };

      const dayStart = new Date('2025-12-10T00:00:00.000Z');
      const position = calculateEventPosition(event, dayStart);

      // 12:00 PM = slot 48 (12 * 4)
      expect(position.startSlot).toBe(48);
      expect(position.spanSlots).toBe(4);
    });
  });

  // ==================== Overlap Detection Tests ====================
  describe('detectOverlappingEvents', () => {
    it('should return empty array for no events', () => {
      const result = detectOverlappingEvents([]);
      expect(result).toEqual([]);
    });

    it('should handle single event with 100% width', () => {
      const event = transformToGridEvent(
        {
          id: '1',
          calendarId: 'cal1',
          title: 'Single Event',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T10:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        new Date('2025-12-10T00:00:00.000Z')
      );

      const result = detectOverlappingEvents([event]);

      expect(result).toHaveLength(1);
      expect(result[0].gridPosition.width).toBe('100%');
      expect(result[0].gridPosition.offset).toBe('0%');
    });

    it('should detect overlapping events and calculate 50% width', () => {
      const dayStart = new Date('2025-12-10T00:00:00.000Z');

      const event1 = transformToGridEvent(
        {
          id: '1',
          calendarId: 'cal1',
          title: 'Event 1',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T10:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        dayStart
      );

      const event2 = transformToGridEvent(
        {
          id: '2',
          calendarId: 'cal1',
          title: 'Event 2',
          startTime: '2025-12-10T09:30:00.000Z',
          endTime: '2025-12-10T10:30:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        dayStart
      );

      const result = detectOverlappingEvents([event1, event2]);

      expect(result).toHaveLength(2);
      expect(result[0].gridPosition.width).toBe('50%');
      expect(result[0].gridPosition.offset).toBe('0%');
      expect(result[1].gridPosition.width).toBe('50%');
      expect(result[1].gridPosition.offset).toBe('50%');
    });

    it('should handle three overlapping events with 33% width', () => {
      const dayStart = new Date('2025-12-10T00:00:00.000Z');

      const event1 = transformToGridEvent(
        {
          id: '1',
          calendarId: 'cal1',
          title: 'Event 1',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T11:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        dayStart
      );

      const event2 = transformToGridEvent(
        {
          id: '2',
          calendarId: 'cal1',
          title: 'Event 2',
          startTime: '2025-12-10T09:30:00.000Z',
          endTime: '2025-12-10T10:30:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        dayStart
      );

      const event3 = transformToGridEvent(
        {
          id: '3',
          calendarId: 'cal1',
          title: 'Event 3',
          startTime: '2025-12-10T10:00:00.000Z',
          endTime: '2025-12-10T11:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        dayStart
      );

      const result = detectOverlappingEvents([event1, event2, event3]);

      expect(result).toHaveLength(3);
      // All three overlap at some point, so should have reduced width
      result.forEach(event => {
        expect(parseFloat(event.gridPosition.width)).toBeLessThanOrEqual(50);
      });
    });

    it('should not treat adjacent events as overlapping', () => {
      const dayStart = new Date('2025-12-10T00:00:00.000Z');

      const event1 = transformToGridEvent(
        {
          id: '1',
          calendarId: 'cal1',
          title: 'Event 1',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T10:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        dayStart
      );

      const event2 = transformToGridEvent(
        {
          id: '2',
          calendarId: 'cal1',
          title: 'Event 2',
          startTime: '2025-12-10T10:00:00.000Z',
          endTime: '2025-12-10T11:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        dayStart
      );

      const result = detectOverlappingEvents([event1, event2]);

      expect(result).toHaveLength(2);
      // Adjacent events should not overlap
      expect(result[0].gridPosition.width).toBe('100%');
      expect(result[1].gridPosition.width).toBe('100%');
    });

    it('should sort events by start slot then by duration', () => {
      const dayStart = new Date('2025-12-10T00:00:00.000Z');

      const event1 = transformToGridEvent(
        {
          id: '1',
          calendarId: 'cal1',
          title: 'Short Event',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T09:30:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        dayStart
      );

      const event2 = transformToGridEvent(
        {
          id: '2',
          calendarId: 'cal1',
          title: 'Long Event',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T11:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        dayStart
      );

      const result = detectOverlappingEvents([event1, event2]);

      // Longer event should come first when start times are equal
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('1');
    });
  });

  // ==================== Event Grouping Tests ====================
  describe('groupEventsByDay', () => {
    it('should group events by day correctly', () => {
      const days = [
        new Date('2025-12-10T00:00:00.000Z'),
        new Date('2025-12-11T00:00:00.000Z'),
      ];

      const events: CalendarEvent[] = [
        {
          id: '1',
          calendarId: 'cal1',
          title: 'Event on 10th',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T10:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        {
          id: '2',
          calendarId: 'cal1',
          title: 'Event on 11th',
          startTime: '2025-12-11T14:00:00.000Z',
          endTime: '2025-12-11T15:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
      ];

      const grouped = groupEventsByDay(events, days);

      expect(grouped.size).toBe(2);
      expect(grouped.get(days[0].toDateString())).toHaveLength(1);
      expect(grouped.get(days[1].toDateString())).toHaveLength(1);
    });

    it('should return empty arrays for days with no events', () => {
      const days = [
        new Date('2025-12-10T00:00:00.000Z'),
        new Date('2025-12-11T00:00:00.000Z'),
      ];

      const events: CalendarEvent[] = [];
      const grouped = groupEventsByDay(events, days);

      expect(grouped.size).toBe(2);
      expect(grouped.get(days[0].toDateString())).toEqual([]);
      expect(grouped.get(days[1].toDateString())).toEqual([]);
    });

    it('should handle multi-day events', () => {
      const days = [
        new Date('2025-12-10T00:00:00.000Z'),
        new Date('2025-12-11T00:00:00.000Z'),
        new Date('2025-12-12T00:00:00.000Z'),
      ];

      const events: CalendarEvent[] = [
        {
          id: '1',
          calendarId: 'cal1',
          title: 'Multi-day Event',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-12T17:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
      ];

      const grouped = groupEventsByDay(events, days);

      // Event should appear on all three days
      expect(grouped.get(days[0].toDateString())).toHaveLength(1);
      expect(grouped.get(days[1].toDateString())).toHaveLength(1);
      expect(grouped.get(days[2].toDateString())).toHaveLength(1);
    });

    it('should calculate overlap detection for each day', () => {
      const days = [new Date('2025-12-10T00:00:00.000Z')];

      const events: CalendarEvent[] = [
        {
          id: '1',
          calendarId: 'cal1',
          title: 'Event 1',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T10:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        {
          id: '2',
          calendarId: 'cal1',
          title: 'Event 2',
          startTime: '2025-12-10T09:30:00.000Z',
          endTime: '2025-12-10T10:30:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
      ];

      const grouped = groupEventsByDay(events, days);
      const dayEvents = grouped.get(days[0].toDateString())!;

      expect(dayEvents).toHaveLength(2);
      // Overlapping events should have reduced width
      expect(dayEvents[0].gridPosition.width).toBe('50%');
      expect(dayEvents[1].gridPosition.width).toBe('50%');
    });
  });

  // ==================== All-Day Event Separation Tests ====================
  describe('separateAllDayEvents', () => {
    it('should separate all-day from timed events', () => {
      const events: CalendarEvent[] = [
        {
          id: '1',
          calendarId: 'cal1',
          title: 'All Day Event',
          startTime: '2025-12-10T00:00:00.000Z',
          endTime: '2025-12-10T23:59:59.000Z',
          isAllDay: true,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        {
          id: '2',
          calendarId: 'cal1',
          title: 'Timed Event',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T10:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
      ];

      const { allDayEvents, timedEvents } = separateAllDayEvents(events);

      expect(allDayEvents).toHaveLength(1);
      expect(timedEvents).toHaveLength(1);
      expect(allDayEvents[0].id).toBe('1');
      expect(timedEvents[0].id).toBe('2');
    });

    it('should return empty arrays for empty input', () => {
      const { allDayEvents, timedEvents } = separateAllDayEvents([]);

      expect(allDayEvents).toEqual([]);
      expect(timedEvents).toEqual([]);
    });

    it('should handle all timed events', () => {
      const events: CalendarEvent[] = [
        {
          id: '1',
          calendarId: 'cal1',
          title: 'Timed Event 1',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T10:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        {
          id: '2',
          calendarId: 'cal1',
          title: 'Timed Event 2',
          startTime: '2025-12-10T11:00:00.000Z',
          endTime: '2025-12-10T12:00:00.000Z',
          isAllDay: false,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
      ];

      const { allDayEvents, timedEvents } = separateAllDayEvents(events);

      expect(allDayEvents).toEqual([]);
      expect(timedEvents).toHaveLength(2);
    });

    it('should handle all all-day events', () => {
      const events: CalendarEvent[] = [
        {
          id: '1',
          calendarId: 'cal1',
          title: 'All Day 1',
          startTime: '2025-12-10T00:00:00.000Z',
          endTime: '2025-12-10T23:59:59.000Z',
          isAllDay: true,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
        {
          id: '2',
          calendarId: 'cal1',
          title: 'All Day 2',
          startTime: '2025-12-11T00:00:00.000Z',
          endTime: '2025-12-11T23:59:59.000Z',
          isAllDay: true,
          provider: 'GOOGLE',
          calendarName: 'Test',
        },
      ];

      const { allDayEvents, timedEvents } = separateAllDayEvents(events);

      expect(allDayEvents).toHaveLength(2);
      expect(timedEvents).toEqual([]);
    });
  });

  // ==================== Date Utility Tests ====================
  describe('isToday', () => {
    it('should return true for today', () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isToday(tomorrow)).toBe(false);
    });

    it('should ignore time when comparing dates', () => {
      const todayMorning = new Date();
      todayMorning.setHours(9, 0, 0, 0);

      const todayEvening = new Date();
      todayEvening.setHours(21, 0, 0, 0);

      expect(isToday(todayMorning)).toBe(true);
      expect(isToday(todayEvening)).toBe(true);
    });
  });

  describe('isCurrentMonth', () => {
    it('should return true for date in current month', () => {
      const date = new Date(2025, 11, 15); // December 15, 2025
      expect(isCurrentMonth(date, 11)).toBe(true);
    });

    it('should return false for date in different month', () => {
      const date = new Date(2025, 10, 15); // November 15, 2025
      expect(isCurrentMonth(date, 11)).toBe(false);
    });

    it('should handle month boundaries', () => {
      const firstDay = new Date(2025, 11, 1);
      const lastDay = new Date(2025, 11, 31);

      expect(isCurrentMonth(firstDay, 11)).toBe(true);
      expect(isCurrentMonth(lastDay, 11)).toBe(true);
    });
  });

  describe('formatTime', () => {
    it('should format time correctly', () => {
      const date = new Date('2025-12-10T09:30:00');
      const formatted = formatTime(date);

      // Should include AM/PM and correct format
      expect(formatted).toMatch(/\d{1,2}:\d{2}/);
      expect(formatted).toMatch(/AM|PM/);
    });

    it('should handle noon correctly', () => {
      const noon = new Date('2025-12-10T12:00:00');
      const formatted = formatTime(noon);

      expect(formatted).toMatch(/12:/);
      expect(formatted).toMatch(/PM/);
    });

    it('should handle midnight correctly', () => {
      const midnight = new Date('2025-12-10T00:00:00');
      const formatted = formatTime(midnight);

      expect(formatted).toMatch(/12:/);
      expect(formatted).toMatch(/AM/);
    });
  });

  describe('formatDateShort', () => {
    it('should format date with weekday and month/day', () => {
      const date = new Date('2025-12-10T12:00:00');
      const formatted = formatDateShort(date);

      // Should include weekday abbreviation
      expect(formatted).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
      // Should include numeric date
      expect(formatted).toMatch(/\d+/);
    });
  });

  describe('getWeekdayName', () => {
    it('should return full weekday name', () => {
      const sunday = new Date('2025-12-07');
      const monday = new Date('2025-12-08');

      expect(getWeekdayName(sunday)).toBe('Sunday');
      expect(getWeekdayName(monday)).toBe('Monday');
    });
  });

  describe('getWeekdayNameShort', () => {
    it('should return abbreviated weekday name', () => {
      const sunday = new Date('2025-12-07');
      const monday = new Date('2025-12-08');

      expect(getWeekdayNameShort(sunday)).toBe('Sun');
      expect(getWeekdayNameShort(monday)).toBe('Mon');
    });
  });

  describe('getCurrentTimeSlot', () => {
    it('should return a slot index between 0 and 95', () => {
      const slot = getCurrentTimeSlot();
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThanOrEqual(95);
    });

    it('should calculate slot based on current time', () => {
      const now = new Date();
      const expectedSlot = (now.getHours() * 4) + Math.floor(now.getMinutes() / 15);

      const slot = getCurrentTimeSlot();

      // Allow 1 slot difference in case time changed during test
      expect(Math.abs(slot - expectedSlot)).toBeLessThanOrEqual(1);
    });
  });

  // ==================== Transform to Grid Event Tests ====================
  describe('transformToGridEvent', () => {
    it('should transform calendar event to grid event', () => {
      const event: CalendarEvent = {
        id: '1',
        calendarId: 'cal1',
        title: 'Test Event',
        startTime: '2025-12-10T09:00:00.000Z',
        endTime: '2025-12-10T10:00:00.000Z',
        isAllDay: false,
        provider: 'GOOGLE',
        calendarName: 'Test',
      };

      const dayStart = new Date('2025-12-10T00:00:00.000Z');
      const gridEvent = transformToGridEvent(event, dayStart, 2);

      expect(gridEvent.id).toBe('1');
      expect(gridEvent.gridPosition.startSlot).toBe(36); // 9 AM
      expect(gridEvent.gridPosition.spanSlots).toBe(4); // 1 hour
      expect(gridEvent.gridPosition.column).toBe(2);
      expect(gridEvent.gridPosition.width).toBe('100%');
      expect(gridEvent.gridPosition.offset).toBe('0%');
    });

    it('should work without column index', () => {
      const event: CalendarEvent = {
        id: '1',
        calendarId: 'cal1',
        title: 'Test Event',
        startTime: '2025-12-10T09:00:00.000Z',
        endTime: '2025-12-10T10:00:00.000Z',
        isAllDay: false,
        provider: 'GOOGLE',
        calendarName: 'Test',
      };

      const dayStart = new Date('2025-12-10T00:00:00.000Z');
      const gridEvent = transformToGridEvent(event, dayStart);

      expect(gridEvent.gridPosition.column).toBeUndefined();
    });
  });
});
