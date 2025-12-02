/**
 * Google Calendar Event Client
 *
 * Handles creating, updating, and deleting events in Google Calendar
 * Supports recurring events, attendees, and reminders
 */

import { google, calendar_v3 } from 'googleapis';
import logger from '../../utils/logger';

export interface GoogleEventData {
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  timezone: string;
  recurrenceRule?: string; // RRULE string
  attendees?: Array<{
    email: string;
    isOrganizer?: boolean;
    isOptional?: boolean;
  }>;
  reminders?: Array<{
    method: 'email' | 'popup' | 'sms';
    minutesBefore: number;
  }>;
}

export interface CreateGoogleEventResponse {
  eventId: string;
  htmlLink: string;
  status: string;
}

export class GoogleEventClient {
  /**
   * Create event in Google Calendar
   *
   * @param accessToken - Valid Google access token
   * @param calendarId - Google calendar ID (e.g., "primary" or specific calendar ID)
   * @param eventData - Event data to create
   * @returns Created event details
   * @throws Error if creation fails
   */
  async createEvent(
    accessToken: string,
    calendarId: string,
    eventData: GoogleEventData
  ): Promise<CreateGoogleEventResponse> {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Prepare event request
      const event: calendar_v3.Schema$Event = {
        summary: eventData.summary,
        description: eventData.description,
        location: eventData.location,
        status: 'confirmed',
      };

      // Set start and end times
      if (eventData.isAllDay) {
        // For all-day events, use date format (YYYY-MM-DD)
        event.start = {
          date: this.formatDateOnly(eventData.startTime),
          timeZone: eventData.timezone,
        };
        event.end = {
          date: this.formatDateOnly(eventData.endTime),
          timeZone: eventData.timezone,
        };
      } else {
        // For timed events, use dateTime format (ISO 8601)
        event.start = {
          dateTime: eventData.startTime.toISOString(),
          timeZone: eventData.timezone,
        };
        event.end = {
          dateTime: eventData.endTime.toISOString(),
          timeZone: eventData.timezone,
        };
      }

      // Add recurrence rule
      if (eventData.recurrenceRule) {
        event.recurrence = [`RRULE:${eventData.recurrenceRule}`];
        logger.debug('Adding recurrence to Google event', { rrule: eventData.recurrenceRule });
      }

      // Add attendees
      if (eventData.attendees && eventData.attendees.length > 0) {
        event.attendees = eventData.attendees.map((attendee) => ({
          email: attendee.email,
          organizer: attendee.isOrganizer || false,
          optional: attendee.isOptional || false,
          responseStatus: 'needsAction',
        }));
        logger.debug('Adding attendees to Google event', { count: eventData.attendees.length });
      }

      // Add reminders
      if (eventData.reminders && eventData.reminders.length > 0) {
        event.reminders = {
          useDefault: false,
          overrides: eventData.reminders.map((reminder) => ({
            method: reminder.method,
            minutes: reminder.minutesBefore,
          })),
        };
        logger.debug('Adding reminders to Google event', { count: eventData.reminders.length });
      } else {
        // Use default reminders if none specified
        event.reminders = {
          useDefault: true,
        };
      }

      logger.info('Creating event in Google Calendar', {
        calendarId,
        summary: eventData.summary,
        startTime: eventData.startTime,
        isRecurring: !!eventData.recurrenceRule,
        attendeeCount: eventData.attendees?.length || 0,
      });

      // Create event
      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates: 'all', // Send email invitations to attendees
      });

      if (!response.data.id) {
        throw new Error('Google Calendar did not return an event ID');
      }

      logger.info('Successfully created event in Google Calendar', {
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
      });

      return {
        eventId: response.data.id,
        htmlLink: response.data.htmlLink || '',
        status: response.data.status || 'confirmed',
      };
    } catch (error: any) {
      logger.error('Failed to create event in Google Calendar', {
        error: error.message,
        statusCode: error.code,
        calendarId,
        summary: eventData.summary,
      });

      // Map Google API errors to user-friendly messages
      if (error.code === 401) {
        throw new Error('Google Calendar authentication failed. Please reconnect your calendar.');
      } else if (error.code === 403) {
        throw new Error('Permission denied. You do not have access to this calendar.');
      } else if (error.code === 404) {
        throw new Error('Calendar not found. Please check your calendar connection.');
      } else if (error.code === 409) {
        throw new Error('Event conflict. This event overlaps with another event.');
      } else if (error.code === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.message?.includes('Invalid RRULE')) {
        throw new Error('Invalid recurrence rule. Please check your recurrence settings.');
      } else if (error.message?.includes('attendees')) {
        throw new Error('Invalid attendee email address. Please check all attendee emails.');
      }

      throw new Error(
        `Failed to create event in Google Calendar: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Update event in Google Calendar
   *
   * @param accessToken - Valid Google access token
   * @param calendarId - Google calendar ID
   * @param eventId - Google event ID to update
   * @param eventData - Updated event data
   * @returns Updated event details
   */
  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    eventData: Partial<GoogleEventData>
  ): Promise<CreateGoogleEventResponse> {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Get existing event first
      const existingEvent = await calendar.events.get({
        calendarId,
        eventId,
      });

      // Merge with existing data
      const event: calendar_v3.Schema$Event = {
        ...existingEvent.data,
        summary: eventData.summary || existingEvent.data.summary,
        description: eventData.description !== undefined ? eventData.description : existingEvent.data.description,
        location: eventData.location !== undefined ? eventData.location : existingEvent.data.location,
      };

      // Update start and end times if provided
      if (eventData.startTime && eventData.endTime) {
        if (eventData.isAllDay) {
          event.start = {
            date: this.formatDateOnly(eventData.startTime),
            timeZone: eventData.timezone || 'UTC',
          };
          event.end = {
            date: this.formatDateOnly(eventData.endTime),
            timeZone: eventData.timezone || 'UTC',
          };
        } else {
          event.start = {
            dateTime: eventData.startTime.toISOString(),
            timeZone: eventData.timezone || 'UTC',
          };
          event.end = {
            dateTime: eventData.endTime.toISOString(),
            timeZone: eventData.timezone || 'UTC',
          };
        }
      }

      // Update recurrence if provided
      if (eventData.recurrenceRule !== undefined) {
        event.recurrence = eventData.recurrenceRule ? [`RRULE:${eventData.recurrenceRule}`] : undefined;
      }

      // Update attendees if provided
      if (eventData.attendees !== undefined) {
        event.attendees = eventData.attendees.map((attendee) => ({
          email: attendee.email,
          organizer: attendee.isOrganizer || false,
          optional: attendee.isOptional || false,
        }));
      }

      // Update reminders if provided
      if (eventData.reminders !== undefined) {
        if (eventData.reminders.length > 0) {
          event.reminders = {
            useDefault: false,
            overrides: eventData.reminders.map((reminder) => ({
              method: reminder.method,
              minutes: reminder.minutesBefore,
            })),
          };
        } else {
          event.reminders = {
            useDefault: true,
          };
        }
      }

      logger.info('Updating event in Google Calendar', { calendarId, eventId });

      const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: event,
        sendUpdates: 'all',
      });

      logger.info('Successfully updated event in Google Calendar', { eventId });

      return {
        eventId: response.data.id!,
        htmlLink: response.data.htmlLink || '',
        status: response.data.status || 'confirmed',
      };
    } catch (error: any) {
      logger.error('Failed to update event in Google Calendar', {
        error: error.message,
        calendarId,
        eventId,
      });

      throw new Error(
        `Failed to update event in Google Calendar: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Delete event from Google Calendar
   *
   * @param accessToken - Valid Google access token
   * @param calendarId - Google calendar ID
   * @param eventId - Google event ID to delete
   */
  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      logger.info('Deleting event from Google Calendar', { calendarId, eventId });

      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all', // Notify attendees
      });

      logger.info('Successfully deleted event from Google Calendar', { eventId });
    } catch (error: any) {
      logger.error('Failed to delete event from Google Calendar', {
        error: error.message,
        calendarId,
        eventId,
      });

      throw new Error(
        `Failed to delete event from Google Calendar: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Format date to YYYY-MM-DD for all-day events
   *
   * @param date - Date object
   * @returns Formatted date string
   */
  private formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export default new GoogleEventClient();
