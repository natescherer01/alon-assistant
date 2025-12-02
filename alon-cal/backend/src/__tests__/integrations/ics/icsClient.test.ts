/**
 * ICS Client Tests
 *
 * Tests for ICS feed fetching and parsing
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ICSClient } from '../../../integrations/ics/icsClient';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Mock axios and URL validator
jest.mock('axios');
jest.mock('../../../utils/urlValidator');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ICS Client', () => {
  let client: ICSClient;
  const testUrl = 'https://example.com/calendar.ics';
  const fixturesPath = path.join(__dirname, '../../fixtures/ics');

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ICSClient();

    // Mock URL validator to always pass
    const { validateIcsUrl } = require('../../../utils/urlValidator');
    (validateIcsUrl as jest.MockedFunction<any>) = jest.fn().mockResolvedValue({
      valid: true,
    });

    // Mock axios.create to return a mock instance
    const mockAxiosInstance = {
      get: jest.fn(),
    };
    (mockedAxios.create as jest.MockedFunction<any>) = jest.fn().mockReturnValue(mockAxiosInstance);
    client['axiosInstance'] = mockAxiosInstance as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to load fixture file
  const loadFixture = (filename: string): string => {
    return fs.readFileSync(path.join(fixturesPath, filename), 'utf-8');
  };

  describe('fetchFeed', () => {
    it('should fetch valid ICS feed successfully', async () => {
      const icsContent = loadFixture('valid-simple.ics');

      client['axiosInstance'].get = jest.fn().mockResolvedValue({
        status: 200,
        data: icsContent,
        headers: {
          'content-type': 'text/calendar',
          'etag': '"abc123"',
          'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT',
        },
      });

      const result = await client.fetchFeed(testUrl);

      expect(result.modified).toBe(true);
      expect(result.content).toBe(icsContent);
      expect(result.etag).toBe('"abc123"');
      expect(result.lastModified).toBe('Mon, 01 Jan 2024 00:00:00 GMT');
    });

    it('should send ETag header on subsequent requests', async () => {
      const icsContent = loadFixture('valid-simple.ics');
      const etag = '"abc123"';

      client['axiosInstance'].get = jest.fn().mockResolvedValue({
        status: 200,
        data: icsContent,
        headers: {
          'content-type': 'text/calendar',
        },
      });

      await client.fetchFeed(testUrl, { etag });

      expect(client['axiosInstance'].get).toHaveBeenCalledWith(
        testUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            'If-None-Match': etag,
          }),
        })
      );
    });

    it('should send Last-Modified header on subsequent requests', async () => {
      const icsContent = loadFixture('valid-simple.ics');
      const lastModified = 'Mon, 01 Jan 2024 00:00:00 GMT';

      client['axiosInstance'].get = jest.fn().mockResolvedValue({
        status: 200,
        data: icsContent,
        headers: {
          'content-type': 'text/calendar',
        },
      });

      await client.fetchFeed(testUrl, { lastModified });

      expect(client['axiosInstance'].get).toHaveBeenCalledWith(
        testUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            'If-Modified-Since': lastModified,
          }),
        })
      );

    });

    it('should handle 304 Not Modified response', async () => {
      client['axiosInstance'].get = jest.fn().mockResolvedValue({
        status: 304,
        data: '',
        headers: {},
      });

      const result = await client.fetchFeed(testUrl, {
        etag: '"abc123"',
        lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
      });

      expect(result.modified).toBe(false);
      expect(result.content).toBeNull();
      expect(result.etag).toBe('"abc123"');
      expect(result.lastModified).toBe('Mon, 01 Jan 2024 00:00:00 GMT');
    });

    it('should handle 304 Not Modified from error response', async () => {
      const error: any = new Error('Not Modified');
      error.response = { status: 304 };

      client['axiosInstance'].get = jest.fn().mockRejectedValue(error);

      const result = await client.fetchFeed(testUrl, {
        etag: '"abc123"',
      });

      expect(result.modified).toBe(false);
      expect(result.content).toBeNull();
    });

    it('should timeout after configured duration', async () => {
      const error: any = new Error('Timeout');
      error.code = 'ECONNABORTED';

      client['axiosInstance'].get = jest.fn().mockRejectedValue(error);

      await expect(client.fetchFeed(testUrl)).rejects.toThrow('Request timeout');
    });

    it('should enforce file size limit', async () => {
      // Create a large ICS file (> 10MB)
      const largeContent = 'X'.repeat(11 * 1024 * 1024);

      client['axiosInstance'].get = jest.fn().mockResolvedValue({
        status: 200,
        data: largeContent,
        headers: {
          'content-type': 'text/calendar',
        },
      });

      await expect(client.fetchFeed(testUrl)).rejects.toThrow('ICS file too large');
    });

    it('should accept valid content types', async () => {
      const icsContent = loadFixture('valid-simple.ics');
      const contentTypes = [
        'text/calendar',
        'text/calendar; charset=utf-8',
        'application/ics',
        'text/plain',
      ];

      for (const contentType of contentTypes) {
        client['axiosInstance'].get = jest.fn().mockResolvedValue({
          status: 200,
          data: icsContent,
          headers: {
            'content-type': contentType,
          },
        });

        const result = await client.fetchFeed(testUrl);
        expect(result.modified).toBe(true);
      }
    });

    it('should handle URL validation failure', async () => {
      const { validateIcsUrl } = require('../../../utils/urlValidator');
      (validateIcsUrl as jest.MockedFunction<any>).mockResolvedValue({
        valid: false,
        error: 'Private IP detected',
      });

      await expect(client.fetchFeed(testUrl)).rejects.toThrow('URL validation failed');
    });

    it('should handle network errors', async () => {
      client['axiosInstance'].get = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(client.fetchFeed(testUrl)).rejects.toThrow('Failed to fetch ICS feed');
    });

    it('should include User-Agent header', async () => {
      const icsContent = loadFixture('valid-simple.ics');

      client['axiosInstance'].get = jest.fn().mockResolvedValue({
        status: 200,
        data: icsContent,
        headers: {
          'content-type': 'text/calendar',
        },
      });

      await client.fetchFeed(testUrl);

      expect(client['axiosInstance'].get).toHaveBeenCalledWith(
        testUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'CalendarApp/1.0',
          }),
        })
      );
    });
  });

  describe('parseEvents', () => {
    const connectionId = 'test-connection-id';

    it('should parse simple VEVENT', async () => {
      const icsContent = loadFixture('valid-simple.ics');

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        uid: 'simple-event-001@example.com',
        summary: 'Team Meeting',
        description: 'Weekly team sync meeting',
        location: 'Conference Room A',
        status: 'CONFIRMED',
        isRecurring: false,
      });
      expect(events[0].start).toBeInstanceOf(Date);
      expect(events[0].end).toBeInstanceOf(Date);
    });

    it('should parse recurring event with RRULE', async () => {
      const icsContent = loadFixture('valid-recurring.ics');

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        uid: 'recurring-event-001@example.com',
        summary: 'Monday Standup',
        isRecurring: true,
      });
      expect(events[0].recurrenceRule).toBeTruthy();
      expect(events[0].recurrenceRule).toContain('FREQ=WEEKLY');
      expect(events[0].recurrenceRule).toContain('BYDAY=MO');
    });

    it('should parse all-day event', async () => {
      const icsContent = loadFixture('valid-allday.ics');

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        uid: 'allday-event-001@example.com',
        summary: 'Company Holiday',
        isAllDay: true,
      });
    });

    it('should parse event with attendees', async () => {
      const icsContent = loadFixture('valid-attendees.ics');

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events).toHaveLength(1);
      expect(events[0].attendees).toBeDefined();
      expect(events[0].attendees).toHaveLength(3);
      expect(events[0].attendees![0]).toMatchObject({
        email: expect.stringContaining('@'),
      });
    });

    it('should parse event with organizer', async () => {
      const icsContent = loadFixture('valid-attendees.ics');

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events[0].organizer).toBeDefined();
      expect(events[0].organizer).toMatchObject({
        email: 'john.smith@example.com',
        name: 'John Smith',
      });
    });

    it('should parse event with EXDATE (exception dates)', async () => {
      const icsContent = loadFixture('valid-exdates.ics');

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events).toHaveLength(1);
      expect(events[0].exceptionDates).toBeDefined();
      expect(events[0].exceptionDates).toHaveLength(2);
      expect(events[0].exceptionDates![0]).toBeInstanceOf(Date);
    });

    it('should handle malformed ICS gracefully', async () => {
      const icsContent = loadFixture('invalid-malformed.ics');

      // Should not throw, but may return empty or partial results
      await expect(client.parseEvents(icsContent, connectionId)).rejects.toThrow('Failed to parse ICS content');
    });

    it('should skip events without required fields', async () => {
      const icsContent = loadFixture('invalid-missing-fields.ics');

      const events = await client.parseEvents(icsContent, connectionId);

      // Events without UID or start time should be skipped
      expect(events.length).toBeLessThan(2);
    });

    it('should handle empty ICS content', async () => {
      const icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events).toHaveLength(0);
    });

    it('should handle UTF-8 encoding', async () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:utf8-test@example.com
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
SUMMARY:Café Meeting ☕
DESCRIPTION:Discuss über strategy
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events).toHaveLength(1);
      expect(events[0].summary).toContain('Café');
      expect(events[0].description).toContain('über');
    });

    it('should handle mixed line endings (CRLF vs LF)', async () => {
      const icsContentCRLF = loadFixture('valid-simple.ics').replace(/\n/g, '\r\n');

      const events = await client.parseEvents(icsContentCRLF, connectionId);

      expect(events).toHaveLength(2);
    });

    it('should parse status field correctly', async () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:confirmed@example.com
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
SUMMARY:Confirmed Event
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:tentative@example.com
DTSTART:20250116T100000Z
DTEND:20250116T110000Z
SUMMARY:Tentative Event
STATUS:TENTATIVE
END:VEVENT
BEGIN:VEVENT
UID:cancelled@example.com
DTSTART:20250117T100000Z
DTEND:20250117T110000Z
SUMMARY:Cancelled Event
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events[0].status).toBe('CONFIRMED');
      expect(events[1].status).toBe('TENTATIVE');
      expect(events[2].status).toBe('CANCELLED');
    });

    it('should default to CONFIRMED if no status', async () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:no-status@example.com
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
SUMMARY:No Status Event
END:VEVENT
END:VCALENDAR`;

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events[0].status).toBe('CONFIRMED');
    });

    it('should handle events with only start time (no end)', async () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:no-end@example.com
DTSTART:20250115T100000Z
SUMMARY:No End Time
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events[0].end).toBeDefined();
      // End should default to start time
      expect(events[0].end.getTime()).toBeGreaterThanOrEqual(events[0].start.getTime());
    });
  });

  describe('validateFeed', () => {
    it('should validate feed and return calendar metadata', async () => {
      const icsContent = loadFixture('valid-simple.ics');

      client['axiosInstance'].get = jest.fn().mockResolvedValue({
        status: 200,
        data: icsContent,
        headers: {
          'content-type': 'text/calendar',
        },
      });

      const result = await client.validateFeed(testUrl);

      expect(result.valid).toBe(true);
      expect(result.calendarName).toBeDefined();
      expect(result.eventCount).toBe(2);
    });

    it('should return error for invalid feed', async () => {
      client['axiosInstance'].get = jest.fn().mockRejectedValue(new Error('Not found'));

      const result = await client.validateFeed(testUrl);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty feed', async () => {
      const icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';

      client['axiosInstance'].get = jest.fn().mockResolvedValue({
        status: 200,
        data: icsContent,
        headers: {
          'content-type': 'text/calendar',
        },
      });

      const result = await client.validateFeed(testUrl);

      expect(result.valid).toBe(true);
      expect(result.eventCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    const connectionId = 'test-connection-id';

    it('should handle very large feed with many events', async () => {
      const icsContent = loadFixture('valid-large.ics');

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events.length).toBeGreaterThan(5);
    });

    it('should handle events with no description', async () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:no-desc@example.com
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
SUMMARY:Event without description
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events[0].description).toBeUndefined();
    });

    it('should handle events with no location', async () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:no-location@example.com
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
SUMMARY:Event without location
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events[0].location).toBeUndefined();
    });

    it('should handle events with complex RRULE', async () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:complex-rrule@example.com
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
RRULE:FREQ=MONTHLY;BYDAY=2TU;BYMONTH=1,3,5,7,9,11
SUMMARY:Complex recurring event
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      const events = await client.parseEvents(icsContent, connectionId);

      expect(events[0].isRecurring).toBe(true);
      expect(events[0].recurrenceRule).toContain('FREQ=MONTHLY');
      expect(events[0].recurrenceRule).toContain('BYDAY=2TU');
    });
  });
});
