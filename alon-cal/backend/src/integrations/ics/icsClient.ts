/**
 * ICS Client
 *
 * HTTP client for fetching and parsing ICS (iCalendar) feeds.
 * Supports ETag/Last-Modified caching and handles recurring events.
 *
 * Features:
 * - HTTP caching with ETag and Last-Modified headers
 * - 304 Not Modified response handling
 * - SSRF protection via URL validator
 * - Timeout configuration
 * - File size limits
 * - Recurring event parsing (RRULE)
 *
 * Dependencies:
 * - axios: HTTP client
 * - node-ical: ICS parser
 *
 * Environment Variables:
 * - ICS_FETCH_TIMEOUT_MS: Request timeout in milliseconds (default: 10000)
 * - ICS_MAX_FILE_SIZE_MB: Maximum ICS file size in MB (default: 10)
 */

import axios, { AxiosResponse } from 'axios';
import * as ical from 'node-ical';
import { CalendarComponent, VEvent } from 'node-ical';
import { validateIcsUrl, createSafeAxiosInstance } from '../../utils/urlValidator';
import logger from '../../utils/logger';

export interface ICSFetchOptions {
  etag?: string;
  lastModified?: string;
}

export interface ICSFetchResult {
  content: string | null;
  etag: string | null;
  lastModified: string | null;
  modified: boolean; // false if 304 Not Modified
}

export interface ParsedICSEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  timezone?: string;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  isRecurring: boolean;
  recurrenceRule?: string; // RRULE string
  exceptionDates?: Date[]; // EXDATE
  attendees?: Array<{
    email: string;
    name?: string;
    rsvp?: boolean;
    role?: string;
  }>;
  organizer?: {
    email: string;
    name?: string;
  };
}

export class ICSClient {
  private axiosInstance;
  private maxFileSizeMB: number;

  constructor() {
    this.axiosInstance = createSafeAxiosInstance(3); // Max 3 redirects
    this.maxFileSizeMB = parseInt(process.env.ICS_MAX_FILE_SIZE_MB || '10', 10);
  }

  /**
   * Fetch ICS feed from URL
   *
   * @param url - ICS feed URL
   * @param options - Fetch options (ETag, Last-Modified)
   * @returns Fetch result with content and headers
   *
   * @throws Error if URL validation fails
   * @throws Error if fetch fails or times out
   * @throws Error if file size exceeds limit
   *
   * @example
   * const result = await client.fetchFeed('https://example.com/calendar.ics');
   * if (result.modified) {
   *   const events = await client.parseEvents(result.content, connectionId);
   * }
   */
  async fetchFeed(url: string, options: ICSFetchOptions = {}): Promise<ICSFetchResult> {
    try {
      // Validate URL for SSRF protection
      const validation = await validateIcsUrl(url);
      if (!validation.valid) {
        throw new Error(`URL validation failed: ${validation.error}`);
      }

      logger.info('Fetching ICS feed', { url, hasETag: !!options.etag });

      // Prepare headers for conditional request
      const headers: Record<string, string> = {
        'User-Agent': 'CalendarApp/1.0',
        'Accept': 'text/calendar,application/ics',
      };

      if (options.etag) {
        headers['If-None-Match'] = options.etag;
      }

      if (options.lastModified) {
        headers['If-Modified-Since'] = options.lastModified;
      }

      // Fetch feed
      let response: AxiosResponse;
      try {
        response = await this.axiosInstance.get(url, {
          headers,
          responseType: 'text',
          maxContentLength: this.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
          validateStatus: (status) => status === 200 || status === 304,
        });
      } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout - ICS feed took too long to respond');
        }
        if (error.response?.status === 304) {
          // Not modified - return cached result
          logger.debug('ICS feed not modified (304)', { url });
          return {
            content: null,
            etag: options.etag || null,
            lastModified: options.lastModified || null,
            modified: false,
          };
        }
        throw new Error(`Failed to fetch ICS feed: ${error.message}`);
      }

      // Handle 304 Not Modified
      if (response.status === 304) {
        logger.debug('ICS feed not modified (304)', { url });
        return {
          content: null,
          etag: options.etag || null,
          lastModified: options.lastModified || null,
          modified: false,
        };
      }

      // Extract headers
      const newEtag = response.headers['etag'] || null;
      const newLastModified = response.headers['last-modified'] || null;

      // Validate content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/calendar') && !contentType.includes('application/ics') && !contentType.includes('text/plain')) {
        logger.warn('Unexpected content type for ICS feed', { url, contentType });
        // Continue anyway - some servers return incorrect content-type
      }

      // Validate content size
      const content = response.data;
      const contentSizeMB = Buffer.byteLength(content, 'utf8') / (1024 * 1024);
      if (contentSizeMB > this.maxFileSizeMB) {
        throw new Error(`ICS file too large: ${contentSizeMB.toFixed(2)}MB (max: ${this.maxFileSizeMB}MB)`);
      }

      logger.info('ICS feed fetched successfully', {
        url,
        sizeMB: contentSizeMB.toFixed(2),
        hasETag: !!newEtag,
        hasLastModified: !!newLastModified,
      });

      return {
        content,
        etag: newEtag,
        lastModified: newLastModified,
        modified: true,
      };
    } catch (error) {
      logger.error('Failed to fetch ICS feed', { url, error });
      throw error;
    }
  }

  /**
   * Parse ICS content and extract events
   *
   * @param icsContent - ICS file content
   * @param connectionId - Calendar connection ID (for event tracking)
   * @returns Array of parsed events
   *
   * @throws Error if parsing fails
   *
   * @example
   * const events = await client.parseEvents(icsContent, connectionId);
   */
  async parseEvents(icsContent: string, connectionId: string): Promise<ParsedICSEvent[]> {
    try {
      logger.debug('Parsing ICS content', { connectionId, sizeBytes: icsContent.length });

      // Parse ICS content
      const parsed = ical.parseICS(icsContent);

      const events: ParsedICSEvent[] = [];

      // Extract events from parsed calendar
      for (const key in parsed) {
        const component = parsed[key];

        // Only process VEVENT components
        if (component.type !== 'VEVENT') {
          continue;
        }

        const event = component as VEvent;

        // Skip events without required fields
        if (!event.uid || !event.start) {
          logger.warn('Skipping event without UID or start time', { component });
          continue;
        }

        // Parse dates
        const start = this.parseDate(event.start);
        const end = this.parseDate(event.end || event.start);

        // Determine if all-day event
        // All-day events can be:
        // 1. String in YYYYMMDD format (8 chars)
        // 2. Object with dateOnly property set to true
        // 3. VALUE=DATE parameter in the original ICS
        const isAllDay = this.isAllDayEvent(event.start);

        // Parse status
        const status = this.parseStatus(event.status);

        // Parse recurrence
        const isRecurring = !!event.rrule;
        const recurrenceRule = event.rrule ? this.formatRRule(event.rrule) : undefined;

        // Parse exception dates
        const exceptionDates = event.exdate ? this.parseExceptionDates(event.exdate) : undefined;

        // Parse attendees
        const attendees = event.attendee ? this.parseAttendees(event.attendee) : undefined;

        // Parse organizer
        const organizer = event.organizer ? this.parseOrganizer(event.organizer) : undefined;

        // Extract timezone with better fallback handling
        const timezone = this.extractTimezone(event.start, event.end);

        events.push({
          uid: event.uid,
          summary: event.summary || 'Untitled Event',
          description: event.description,
          location: event.location,
          start,
          end,
          isAllDay,
          timezone,
          status,
          isRecurring,
          recurrenceRule,
          exceptionDates,
          attendees,
          organizer,
        });
      }

      logger.info('ICS parsing completed', {
        connectionId,
        totalEvents: events.length,
        recurringEvents: events.filter(e => e.isRecurring).length,
      });

      return events;
    } catch (error) {
      logger.error('Failed to parse ICS content', { connectionId, error });
      throw new Error(`Failed to parse ICS content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Determine if an event is an all-day event
   *
   * All-day events in ICS can be represented as:
   * - String in YYYYMMDD format (8 characters)
   * - Object with dateOnly property set to true
   * - Object with type 'date' (some parsers)
   */
  private isAllDayEvent(start: any): boolean {
    // String in YYYYMMDD format
    if (typeof start === 'string' && start.length === 8 && /^\d{8}$/.test(start)) {
      return true;
    }

    // node-ical date object with dateOnly flag
    if (start && typeof start === 'object') {
      if (start.dateOnly === true) {
        return true;
      }
      // Some parsers use 'date' type for all-day events
      if (start.type === 'date') {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract and sanitize timezone from ICS event dates
   *
   * Checks both start and end dates for timezone information.
   * Validates and sanitizes the timezone to prevent injection attacks.
   * Falls back to 'UTC' if no valid timezone is found.
   */
  private extractTimezone(start: any, end?: any): string {
    const MAX_TZ_LENGTH = 100;

    // Sanitize and validate a timezone string
    const sanitizeTimezone = (tz: unknown): string | null => {
      if (typeof tz !== 'string') return null;

      const trimmed = tz.trim();

      // Length check to prevent DoS
      if (trimmed.length > MAX_TZ_LENGTH) {
        logger.warn('Timezone string too long, ignoring', { length: trimmed.length });
        return null;
      }

      // Check for suspicious patterns (injection attempts)
      if (/[<>'"\\]/.test(trimmed) || trimmed.includes('..') || trimmed.startsWith('http')) {
        logger.warn('Suspicious timezone pattern detected', { timezone: trimmed.substring(0, 50) });
        return null;
      }

      // Basic format validation: should only contain safe characters
      if (!/^[A-Za-z0-9_\/+-:]+$/.test(trimmed)) {
        logger.warn('Invalid timezone format', { timezone: trimmed.substring(0, 50) });
        return null;
      }

      return trimmed;
    };

    // Try to get timezone from start date
    if (start && typeof start === 'object' && start.tz) {
      const sanitized = sanitizeTimezone(start.tz);
      if (sanitized) return sanitized;
    }

    // Try to get timezone from end date as fallback
    if (end && typeof end === 'object' && end.tz) {
      const sanitized = sanitizeTimezone(end.tz);
      if (sanitized) return sanitized;
    }

    // Default to UTC for floating times or invalid timezones
    return 'UTC';
  }

  /**
   * Parse date from ICS format with proper timezone handling
   *
   * node-ical returns dates that may have timezone info in the `tz` property.
   * The Date object from toJSDate() represents the correct UTC instant when
   * the tz property is set, but for floating times (no timezone), we need
   * to be careful.
   */
  private parseDate(date: any): Date {
    if (date instanceof Date) {
      return date;
    }

    if (typeof date === 'string') {
      // ISO string - parse directly
      return new Date(date);
    }

    // Handle node-ical date format
    if (date && typeof date === 'object') {
      // node-ical's toJSDate() correctly handles timezone conversion
      // when the tz property is set - it returns UTC
      if (date.toJSDate) {
        return date.toJSDate();
      }

      // Fallback for other object formats
      if (date.toISOString) {
        return new Date(date.toISOString());
      }
    }

    return new Date(date);
  }

  /**
   * Parse event status
   */
  private parseStatus(status?: string): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' {
    const normalized = (status || 'CONFIRMED').toUpperCase();

    if (normalized === 'TENTATIVE') return 'TENTATIVE';
    if (normalized === 'CANCELLED') return 'CANCELLED';
    return 'CONFIRMED';
  }

  /**
   * Format RRULE object to string
   */
  private formatRRule(rrule: any): string {
    if (typeof rrule === 'string') {
      return rrule;
    }

    // node-ical returns rrule as RRule object from rrule library
    // Check if it has toString() method (RRule objects do)
    if (rrule && typeof rrule.toString === 'function') {
      const str = rrule.toString();
      // RRule.toString() returns "RRULE:FREQ=..." - strip the prefix
      if (str.startsWith('RRULE:')) {
        return str.substring(6);
      }
      return str;
    }

    // Check if it has origOptions (RRule internal options)
    if (rrule && rrule.origOptions) {
      const opts = rrule.origOptions;
      const parts: string[] = [];

      if (opts.freq !== undefined) {
        const freqMap: Record<number, string> = {
          0: 'YEARLY', 1: 'MONTHLY', 2: 'WEEKLY', 3: 'DAILY',
          4: 'HOURLY', 5: 'MINUTELY', 6: 'SECONDLY'
        };
        parts.push(`FREQ=${freqMap[opts.freq] || opts.freq}`);
      }
      if (opts.interval && opts.interval > 1) parts.push(`INTERVAL=${opts.interval}`);
      if (opts.count && typeof opts.count === 'number') parts.push(`COUNT=${opts.count}`);
      if (opts.until) parts.push(`UNTIL=${opts.until.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      if (opts.byweekday && opts.byweekday.length > 0) {
        const dayMap: Record<number, string> = { 0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH', 4: 'FR', 5: 'SA', 6: 'SU' };
        const days = opts.byweekday.map((d: any) => dayMap[d.weekday ?? d] || d).join(',');
        parts.push(`BYDAY=${days}`);
      }
      if (opts.bymonthday) parts.push(`BYMONTHDAY=${Array.isArray(opts.bymonthday) ? opts.bymonthday.join(',') : opts.bymonthday}`);
      if (opts.bymonth) parts.push(`BYMONTH=${Array.isArray(opts.bymonth) ? opts.bymonth.join(',') : opts.bymonth}`);
      if (opts.bysetpos) parts.push(`BYSETPOS=${opts.bysetpos}`);

      return parts.join(';');
    }

    // Fallback: try to extract properties directly (but skip functions)
    if (rrule && typeof rrule === 'object') {
      const parts: string[] = [];

      if (rrule.freq && typeof rrule.freq !== 'function') parts.push(`FREQ=${rrule.freq}`);
      if (rrule.interval && typeof rrule.interval !== 'function') parts.push(`INTERVAL=${rrule.interval}`);
      if (rrule.count && typeof rrule.count !== 'function') parts.push(`COUNT=${rrule.count}`);
      if (rrule.until && typeof rrule.until !== 'function') parts.push(`UNTIL=${rrule.until}`);
      if (rrule.byday && typeof rrule.byday !== 'function') {
        parts.push(`BYDAY=${Array.isArray(rrule.byday) ? rrule.byday.join(',') : rrule.byday}`);
      }
      if (rrule.bymonthday && typeof rrule.bymonthday !== 'function') parts.push(`BYMONTHDAY=${rrule.bymonthday}`);
      if (rrule.bymonth && typeof rrule.bymonth !== 'function') parts.push(`BYMONTH=${rrule.bymonth}`);
      if (rrule.bysetpos && typeof rrule.bysetpos !== 'function') parts.push(`BYSETPOS=${rrule.bysetpos}`);

      return parts.join(';');
    }

    return '';
  }

  /**
   * Parse exception dates (EXDATE)
   */
  private parseExceptionDates(exdate: any): Date[] {
    if (!exdate) return [];

    const dates: Date[] = [];

    if (Array.isArray(exdate)) {
      for (const date of exdate) {
        dates.push(this.parseDate(date));
      }
    } else {
      dates.push(this.parseDate(exdate));
    }

    return dates;
  }

  /**
   * Parse attendees
   */
  private parseAttendees(attendee: any): Array<{ email: string; name?: string; rsvp?: boolean; role?: string }> {
    const attendees: Array<{ email: string; name?: string; rsvp?: boolean; role?: string }> = [];

    const processAttendee = (att: any) => {
      // Extract email from various formats
      let email = '';
      let name = '';

      if (typeof att === 'string') {
        // Format: "mailto:email@example.com" or "email@example.com"
        email = att.replace('mailto:', '');
      } else if (typeof att === 'object') {
        email = att.val?.replace('mailto:', '') || att.email || '';
        name = att.params?.CN || att.name || '';
      }

      if (email) {
        attendees.push({
          email,
          name: name || undefined,
          rsvp: att.params?.RSVP === 'TRUE',
          role: att.params?.ROLE || undefined,
        });
      }
    };

    if (Array.isArray(attendee)) {
      attendee.forEach(processAttendee);
    } else {
      processAttendee(attendee);
    }

    return attendees;
  }

  /**
   * Parse organizer
   */
  private parseOrganizer(organizer: any): { email: string; name?: string } | undefined {
    let email = '';
    let name = '';

    if (typeof organizer === 'string') {
      email = organizer.replace('mailto:', '');
    } else if (typeof organizer === 'object') {
      email = organizer.val?.replace('mailto:', '') || organizer.email || '';
      name = organizer.params?.CN || organizer.name || '';
    }

    if (!email) return undefined;

    return {
      email,
      name: name || undefined,
    };
  }

  /**
   * Validate ICS feed (check if it's parseable and has events)
   *
   * @param url - ICS feed URL
   * @returns Validation result with calendar name and event count
   */
  async validateFeed(url: string): Promise<{
    valid: boolean;
    calendarName?: string;
    eventCount?: number;
    error?: string;
  }> {
    try {
      // Fetch feed
      const fetchResult = await this.fetchFeed(url);

      if (!fetchResult.modified || !fetchResult.content) {
        return {
          valid: false,
          error: 'No content returned from ICS feed',
        };
      }

      // Parse content
      const parsed = ical.parseICS(fetchResult.content);

      // Extract calendar name
      let calendarName = 'Imported Calendar';
      for (const key in parsed) {
        if (parsed[key].type === 'VCALENDAR' && parsed[key].name) {
          calendarName = parsed[key].name;
          break;
        }
      }

      // Count events
      let eventCount = 0;
      for (const key in parsed) {
        if (parsed[key].type === 'VEVENT') {
          eventCount++;
        }
      }

      return {
        valid: true,
        calendarName,
        eventCount,
      };
    } catch (error) {
      logger.error('ICS feed validation failed', { url, error });
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default new ICSClient();
