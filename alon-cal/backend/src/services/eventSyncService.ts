/**
 * Event Sync Service
 *
 * Handles syncing calendar events from external providers to local database
 * Supports Google Calendar, Microsoft Outlook, and Apple Calendar
 * Implements incremental sync using sync tokens
 */

import { prisma } from '../lib/prisma';
import { CalendarProvider, EventStatus, SyncStatus } from '@prisma/client';
import { google, calendar_v3 } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { GoogleCalendarClient } from '../integrations/google';
import { MicrosoftCalendarClient } from '../integrations/microsoft';
import { decryptToken } from '../utils/encryption';
import tokenRefreshService from './tokenRefreshService';
import auditService from './auditService';
import icsService from './icsService';
import logger from '../utils/logger';
import { RRule, rrulestr } from 'rrule';

interface SyncEventsOptions {
  startDate?: Date;
  endDate?: Date;
  fullSync?: boolean; // Force full sync instead of incremental
}

interface SyncResult {
  totalEvents: number;
  newEvents: number;
  updatedEvents: number;
  deletedEvents: number;
  errors: string[];
}

class EventSyncService {
  private googleClient: GoogleCalendarClient;
  private microsoftClient: MicrosoftCalendarClient;

  constructor() {
    this.googleClient = new GoogleCalendarClient();
    this.microsoftClient = new MicrosoftCalendarClient();
  }

  /**
   * Sync events for a specific calendar connection
   *
   * @param connectionId - Calendar connection ID
   * @param userId - User ID (for authorization verification)
   * @param options - Sync options (date range, full sync)
   * @returns Sync result with statistics
   */
  async syncCalendarEvents(
    connectionId: string,
    userId?: string,
    options: SyncEventsOptions = {}
  ): Promise<SyncResult> {
    try {
      const connection = await prisma.calendarConnection.findUnique({
        where: { id: connectionId, deletedAt: null },
      });

      if (!connection) {
        throw new Error('Calendar connection not found');
      }

      // SECURITY: Verify connection belongs to the requesting user
      if (userId && connection.userId !== userId) {
        logger.warn('Unauthorized calendar sync attempt', {
          connectionId,
          requestingUserId: userId,
          actualUserId: connection.userId,
        });
        throw new Error('Unauthorized: Connection does not belong to this user');
      }

      if (!connection.isConnected) {
        throw new Error('Calendar connection is disconnected');
      }

      logger.info('Starting event sync', {
        connectionId,
        provider: connection.provider,
        fullSync: options.fullSync,
      });

      // Refresh token if needed (skip for ICS provider - doesn't use OAuth)
      let accessToken = '';
      if (connection.provider !== CalendarProvider.ICS) {
        accessToken = await tokenRefreshService.checkAndRefreshToken(
          connectionId,
          connection.userId
        );
      }

      let result: SyncResult;

      // Sync based on provider
      switch (connection.provider) {
        case CalendarProvider.GOOGLE:
          result = await this.syncGoogleEvents(connection, accessToken, options);
          break;
        case CalendarProvider.MICROSOFT:
          result = await this.syncMicrosoftEvents(connection, accessToken, options);
          break;
        case CalendarProvider.APPLE:
          result = await this.syncAppleEvents(connection, accessToken, options);
          break;
        case CalendarProvider.ICS:
          // ICS calendars don't need access tokens
          const icsResult = await icsService.syncIcsEvents(connectionId);
          result = {
            totalEvents: icsResult.eventsAdded + icsResult.eventsUpdated,
            newEvents: icsResult.eventsAdded,
            updatedEvents: icsResult.eventsUpdated,
            deletedEvents: icsResult.eventsDeleted,
            errors: icsResult.error ? [icsResult.error] : [],
          };
          break;
        default:
          throw new Error(`Unsupported provider: ${connection.provider}`);
      }

      // Update last synced timestamp
      await prisma.calendarConnection.update({
        where: { id: connectionId },
        data: { lastSyncedAt: new Date() },
      });

      // Log successful sync
      await auditService.logCalendarSync(connection.userId, connectionId, result.totalEvents);

      logger.info('Event sync completed', {
        connectionId,
        ...result,
      });

      return result;
    } catch (error) {
      logger.error('Event sync failed', { connectionId, error });

      // Log sync failure
      const connection = await prisma.calendarConnection.findUnique({
        where: { id: connectionId },
      });

      if (connection) {
        await auditService.logCalendarSyncFailure(
          connection.userId,
          connectionId,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      throw new Error(
        `Failed to sync calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sync Google Calendar events
   */
  private async syncGoogleEvents(
    connection: any,
    accessToken: string,
    options: SyncEventsOptions
  ): Promise<SyncResult> {
    const result: SyncResult = {
      totalEvents: 0,
      newEvents: 0,
      updatedEvents: 0,
      deletedEvents: 0,
      errors: [],
    };

    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Prepare request parameters
      const listParams: calendar_v3.Params$Resource$Events$List = {
        calendarId: connection.calendarId,
        maxResults: 2500,
        singleEvents: false, // Get recurring events as single items
        orderBy: 'updated',
      };

      // Use incremental sync if we have a sync token and not forcing full sync
      if (connection.syncToken && !options.fullSync) {
        listParams.syncToken = connection.syncToken;
        logger.debug('Using incremental sync with sync token', { connectionId: connection.id });
      } else {
        // Full sync with date range
        const timeMin = options.startDate || new Date();
        const timeMax = options.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

        listParams.timeMin = timeMin.toISOString();
        listParams.timeMax = timeMax.toISOString();
        logger.debug('Using full sync with date range', {
          connectionId: connection.id,
          timeMin,
          timeMax,
        });
      }

      let pageToken: string | undefined;
      let newSyncToken: string | undefined;

      do {
        if (pageToken) {
          listParams.pageToken = pageToken;
        }

        const response = await calendar.events.list(listParams);

        if (response.data.items) {
          for (const event of response.data.items) {
            try {
              await this.saveGoogleEvent(connection.id, event);
              result.totalEvents++;

              // Check if it's a new or updated event
              const existingEvent = await prisma.calendarEvent.findUnique({
                where: {
                  unique_calendar_provider_event: {
                    calendarConnectionId: connection.id,
                    providerEventId: event.id!,
                  },
                },
              });

              if (existingEvent) {
                result.updatedEvents++;
              } else {
                result.newEvents++;
              }
            } catch (error) {
              result.errors.push(`Failed to save event ${event.id}: ${error}`);
              logger.error('Failed to save Google event', { eventId: event.id, error });
            }
          }
        }

        pageToken = response.data.nextPageToken || undefined;
        newSyncToken = response.data.nextSyncToken || undefined;
      } while (pageToken);

      // Update sync token for incremental sync
      if (newSyncToken) {
        await prisma.calendarConnection.update({
          where: { id: connection.id },
          data: { syncToken: newSyncToken },
        });
        logger.debug('Updated sync token', { connectionId: connection.id });
      }

      return result;
    } catch (error: any) {
      // If sync token is invalid, retry with full sync
      if (error.code === 410 || error.message?.includes('Sync token')) {
        logger.warn('Sync token invalid, retrying with full sync', { connectionId: connection.id });
        await prisma.calendarConnection.update({
          where: { id: connection.id },
          data: { syncToken: null },
        });
        return this.syncGoogleEvents(connection, accessToken, { ...options, fullSync: true });
      }

      throw error;
    }
  }

  /**
   * Save Google Calendar event to database
   */
  private async saveGoogleEvent(connectionId: string, event: calendar_v3.Schema$Event): Promise<void> {
    if (!event.id) return;

    // Handle deleted events
    if (event.status === 'cancelled') {
      await prisma.calendarEvent.updateMany({
        where: {
          calendarConnectionId: connectionId,
          providerEventId: event.id,
        },
        data: {
          syncStatus: SyncStatus.DELETED,
          deletedAt: new Date(),
        },
      });
      return;
    }

    // Parse event data
    const startTime = event.start?.dateTime || event.start?.date;
    const endTime = event.end?.dateTime || event.end?.date;

    if (!startTime || !endTime) {
      logger.warn('Event missing start or end time', { eventId: event.id });
      return;
    }

    const isAllDay = !event.start?.dateTime;

    // Parse recurrence
    const isRecurring = !!event.recurrence;

    // Parse attendees
    const attendees = event.attendees?.map((att) => ({
      email: att.email || '',
      name: att.displayName || '',
      responseStatus: att.responseStatus || 'needsAction',
      organizer: att.organizer || false,
    }));

    // Parse reminders
    const reminders = event.reminders?.overrides?.map((rem) => ({
      method: rem.method || 'popup',
      minutes: rem.minutes || 0,
    }));

    await prisma.calendarEvent.upsert({
      where: {
        unique_calendar_provider_event: {
          calendarConnectionId: connectionId,
          providerEventId: event.id,
        },
      },
      update: {
        title: event.summary || 'Untitled Event',
        description: event.description,
        location: event.location,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isAllDay,
        timezone: event.start?.timeZone || 'UTC',
        status: this.mapGoogleStatus(event.status),
        syncStatus: SyncStatus.SYNCED,
        isRecurring,
        recurrenceRule: event.recurrence?.join(','),
        attendees: attendees as any,
        reminders: reminders as any,
        providerMetadata: event as any,
        htmlLink: event.htmlLink,
        lastSyncedAt: new Date(),
        deletedAt: null,
      },
      create: {
        calendarConnectionId: connectionId,
        providerEventId: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description,
        location: event.location,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isAllDay,
        timezone: event.start?.timeZone || 'UTC',
        status: this.mapGoogleStatus(event.status),
        syncStatus: SyncStatus.SYNCED,
        isRecurring,
        recurrenceRule: event.recurrence?.join(','),
        attendees: attendees as any,
        reminders: reminders as any,
        providerMetadata: event as any,
        htmlLink: event.htmlLink,
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Sync Microsoft Calendar events using delta query for incremental sync
   */
  private async syncMicrosoftEvents(
    connection: any,
    accessToken: string,
    options: SyncEventsOptions
  ): Promise<SyncResult> {
    const result: SyncResult = {
      totalEvents: 0,
      newEvents: 0,
      updatedEvents: 0,
      deletedEvents: 0,
      errors: [],
    };

    try {
      // Use delta query for incremental sync if available and not forcing full sync
      if (connection.syncToken && !options.fullSync) {
        logger.debug('Using incremental delta sync', { connectionId: connection.id });

        try {
          const deltaResponse = await this.microsoftClient.getDeltaEvents(
            accessToken,
            connection.calendarId,
            connection.syncToken
          );

          // Process delta events
          for (const event of deltaResponse.events) {
            try {
              await this.saveMicrosoftEvent(connection.id, event);
              result.totalEvents++;

              // Check if deleted
              if (event['@removed']) {
                result.deletedEvents++;
              } else {
                // Check if new or updated
                const existingEvent = await prisma.calendarEvent.findUnique({
                  where: {
                    unique_calendar_provider_event: {
                      calendarConnectionId: connection.id,
                      providerEventId: event.id,
                    },
                  },
                });

                if (existingEvent) {
                  result.updatedEvents++;
                } else {
                  result.newEvents++;
                }
              }
            } catch (error) {
              result.errors.push(`Failed to save event ${event.id}: ${error}`);
              logger.error('Failed to save Microsoft event', { eventId: event.id, error });
            }
          }

          // Update delta link for next sync
          if (deltaResponse.deltaLink) {
            await prisma.calendarConnection.update({
              where: { id: connection.id },
              data: { syncToken: deltaResponse.deltaLink },
            });
            logger.debug('Updated delta link', { connectionId: connection.id });
          }

          return result;
        } catch (error: any) {
          // If delta token is invalid (INVALID_DELTA_TOKEN), fall through to full sync
          if (error.message === 'INVALID_DELTA_TOKEN') {
            logger.warn('Delta token invalid, falling back to full sync', { connectionId: connection.id });
            await prisma.calendarConnection.update({
              where: { id: connection.id },
              data: { syncToken: null },
            });
            // Continue to full sync below
          } else {
            throw error;
          }
        }
      }

      // Full sync: either forced or no delta token available
      logger.debug('Using full sync', { connectionId: connection.id });

      const startDate = options.startDate || new Date();
      const endDate = options.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

      const events = await this.microsoftClient.listEvents(
        accessToken,
        connection.calendarId,
        startDate,
        endDate
      );

      // Process all events
      for (const event of events) {
        try {
          await this.saveMicrosoftEvent(connection.id, event);
          result.totalEvents++;

          const existingEvent = await prisma.calendarEvent.findUnique({
            where: {
              unique_calendar_provider_event: {
                calendarConnectionId: connection.id,
                providerEventId: event.id,
              },
            },
          });

          if (existingEvent) {
            result.updatedEvents++;
          } else {
            result.newEvents++;
          }
        } catch (error) {
          result.errors.push(`Failed to save event ${event.id}: ${error}`);
          logger.error('Failed to save Microsoft event', { eventId: event.id, error });
        }
      }

      // After full sync, initialize delta sync for future incremental updates
      try {
        const deltaResponse = await this.microsoftClient.getDeltaEvents(
          accessToken,
          connection.calendarId,
          null // null = initialize delta
        );

        if (deltaResponse.deltaLink) {
          await prisma.calendarConnection.update({
            where: { id: connection.id },
            data: { syncToken: deltaResponse.deltaLink },
          });
          logger.debug('Initialized delta link after full sync', { connectionId: connection.id });
        }
      } catch (error) {
        logger.warn('Failed to initialize delta link', { connectionId: connection.id, error });
        // Not critical - can retry on next sync
      }

      return result;
    } catch (error: any) {
      // Handle rate limiting
      if (error.message?.includes('Rate limited')) {
        logger.warn('Microsoft API rate limit hit', { connectionId: connection.id });
        throw new Error('Rate limited by Microsoft. Please try again later.');
      }

      throw error;
    }
  }

  /**
   * Save Microsoft Calendar event to database with full Microsoft-specific field support
   */
  private async saveMicrosoftEvent(connectionId: string, event: any): Promise<void> {
    if (!event.id) return;

    // Handle deleted events
    if (event['@removed']) {
      await prisma.calendarEvent.updateMany({
        where: {
          calendarConnectionId: connectionId,
          providerEventId: event.id,
        },
        data: {
          syncStatus: SyncStatus.DELETED,
          deletedAt: new Date(),
        },
      });
      return;
    }

    const isAllDay = event.isAllDay || false;
    const startTime = new Date(event.start?.dateTime || event.start?.date);
    const endTime = new Date(event.end?.dateTime || event.end?.date);

    // Parse recurrence and convert to RRULE
    const isRecurring = !!event.recurrence;
    const recurrenceRule = isRecurring
      ? this.microsoftClient.convertRecurrenceToRRule(event.recurrence)
      : null;

    // Parse attendees
    const attendees = event.attendees?.map((att: any) => ({
      email: att.emailAddress?.address || '',
      name: att.emailAddress?.name || '',
      responseStatus: att.status?.response || 'none',
      organizer: att.type === 'required',
    }));

    // Extract Teams meeting information
    const teamsInfo = this.microsoftClient.extractTeamsMeetingInfo(event);

    // Map importance level
    const importanceMap: Record<string, any> = {
      low: 'LOW',
      normal: 'NORMAL',
      high: 'HIGH',
    };
    const importance = importanceMap[event.importance] || 'NORMAL';

    // Prepare Outlook categories (comma-separated)
    const outlookCategories = event.categories?.join(',') || null;

    const eventData = {
      title: event.subject || 'Untitled Event',
      description: event.bodyPreview,
      location: event.location?.displayName,
      startTime,
      endTime,
      isAllDay,
      timezone: event.start?.timeZone || 'UTC',
      status: this.mapMicrosoftStatus(event.isCancelled),
      syncStatus: SyncStatus.SYNCED,
      isRecurring,
      recurrenceRule,
      attendees: attendees as any,
      providerMetadata: event as any,
      htmlLink: event.webLink,
      lastSyncedAt: new Date(),
      deletedAt: null,

      // Microsoft-specific fields
      importance,
      outlookCategories,
      seriesMasterId: event.seriesMasterId || null,
      teamsEnabled: teamsInfo.enabled,
      teamsMeetingUrl: teamsInfo.meetingUrl || null,
      teamsConferenceId: teamsInfo.conferenceId || null,
    };

    await prisma.calendarEvent.upsert({
      where: {
        unique_calendar_provider_event: {
          calendarConnectionId: connectionId,
          providerEventId: event.id,
        },
      },
      update: eventData,
      create: {
        calendarConnectionId: connectionId,
        providerEventId: event.id,
        ...eventData,
      },
    });
  }

  /**
   * Sync Apple Calendar events (stub implementation)
   */
  private async syncAppleEvents(
    connection: any,
    accessToken: string,
    options: SyncEventsOptions
  ): Promise<SyncResult> {
    // Apple Calendar uses CalDAV protocol
    // Full CalDAV implementation would be more complex
    logger.warn('Apple Calendar sync not fully implemented (CalDAV required)', {
      connectionId: connection.id,
    });

    return {
      totalEvents: 0,
      newEvents: 0,
      updatedEvents: 0,
      deletedEvents: 0,
      errors: ['Apple Calendar sync not implemented'],
    };
  }

  /**
   * Map Google event status to EventStatus enum
   */
  private mapGoogleStatus(status?: string | null): EventStatus {
    switch (status) {
      case 'confirmed':
        return EventStatus.CONFIRMED;
      case 'tentative':
        return EventStatus.TENTATIVE;
      case 'cancelled':
        return EventStatus.CANCELLED;
      default:
        return EventStatus.CONFIRMED;
    }
  }

  /**
   * Map Microsoft event status to EventStatus enum
   */
  private mapMicrosoftStatus(isCancelled?: boolean): EventStatus {
    return isCancelled ? EventStatus.CANCELLED : EventStatus.CONFIRMED;
  }

  /**
   * Get events for a user within a date range
   * Aggregates events from all connected calendars
   * Expands recurring events to show instances within the range
   *
   * @param userId - User ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of calendar events (including expanded recurring instances)
   */
  async getEventsInRange(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      // Get non-recurring events in range
      const nonRecurringEvents = await prisma.calendarEvent.findMany({
        where: {
          calendarConnection: {
            userId,
            isConnected: true,
            deletedAt: null,
          },
          syncStatus: SyncStatus.SYNCED,
          deletedAt: null,
          isRecurring: false,
          OR: [
            {
              startTime: {
                gte: startDate,
                lte: endDate,
              },
            },
            {
              endTime: {
                gte: startDate,
                lte: endDate,
              },
            },
            {
              AND: [
                { startTime: { lte: startDate } },
                { endTime: { gte: endDate } },
              ],
            },
          ],
        },
        include: {
          calendarConnection: {
            select: {
              provider: true,
              calendarName: true,
              calendarColor: true,
            },
          },
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      // Get recurring events that started before or during the range
      // and don't have an end date, or end after the range start
      const recurringEvents = await prisma.calendarEvent.findMany({
        where: {
          calendarConnection: {
            userId,
            isConnected: true,
            deletedAt: null,
          },
          syncStatus: SyncStatus.SYNCED,
          deletedAt: null,
          isRecurring: true,
          startTime: { lte: endDate },
          OR: [
            { recurrenceEndDate: null },
            { recurrenceEndDate: { gte: startDate } },
          ],
        },
        include: {
          calendarConnection: {
            select: {
              provider: true,
              calendarName: true,
              calendarColor: true,
            },
          },
        },
      });

      // Expand recurring events
      const expandedRecurringEvents = this.expandRecurringEvents(
        recurringEvents,
        startDate,
        endDate
      );

      // Combine and sort all events
      const allEvents = [...nonRecurringEvents, ...expandedRecurringEvents];
      allEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      return allEvents;
    } catch (error) {
      logger.error('Failed to get events in range', { userId, error });
      throw new Error(
        `Failed to get events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Expand recurring events into individual instances within a date range
   *
   * @param events - Array of recurring events
   * @param startDate - Range start date
   * @param endDate - Range end date
   * @returns Array of expanded event instances
   */
  /**
   * Get the local time components (hour, minute) from a UTC date in a specific timezone
   */
  private getLocalTimeInTimezone(utcDate: Date, timezone: string): { hour: number; minute: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(utcDate);
    const hourPart = parts.find(p => p.type === 'hour');
    const minutePart = parts.find(p => p.type === 'minute');
    return {
      hour: parseInt(hourPart?.value || '0', 10),
      minute: parseInt(minutePart?.value || '0', 10),
    };
  }

  /**
   * Convert a local time on a specific date to UTC, accounting for DST
   * @param year - Year
   * @param month - Month (0-indexed)
   * @param day - Day of month
   * @param hour - Local hour
   * @param minute - Local minute
   * @param timezone - IANA timezone
   * @returns UTC Date
   */
  private localTimeToUTC(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timezone: string
  ): Date {
    // Create a date string in ISO format without timezone
    const localDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

    // Use Intl to find the offset for this specific date/time in the timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'shortOffset',
    });

    // Create a temporary date to get the offset
    // We need to iterate to find the correct UTC time that corresponds to the local time
    // Start with an estimate
    const estimate = new Date(localDateStr + 'Z');

    // Format this estimate in the target timezone
    const parts = formatter.formatToParts(estimate);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');

    // Parse the offset (e.g., "GMT-6" or "GMT-5")
    let offsetHours = 0;
    if (offsetPart) {
      const offsetMatch = offsetPart.value.match(/GMT([+-])(\d+)/);
      if (offsetMatch) {
        offsetHours = parseInt(offsetMatch[2], 10);
        if (offsetMatch[1] === '-') {
          offsetHours = -offsetHours;
        }
      }
    }

    // The local time is UTC + offset, so UTC = local - offset
    // But we want the UTC time that when converted to local gives us the target time
    const utcMs = estimate.getTime() - (offsetHours * 60 * 60 * 1000);
    return new Date(utcMs);
  }

  private expandRecurringEvents(events: any[], startDate: Date, endDate: Date): any[] {
    const expandedEvents: any[] = [];

    for (const event of events) {
      try {
        if (!event.recurrenceRule) {
          continue;
        }

        // Parse the recurrence rule
        const rruleStr = event.recurrenceRule;
        const eventStart = new Date(event.startTime);
        const eventTimezone = event.timezone || 'UTC';

        // Get the local time of the original event in its timezone
        // This is the time that should remain constant across DST changes
        const localTime = this.getLocalTimeInTimezone(eventStart, eventTimezone);

        // Extract just the RRULE part, ignoring DTSTART
        let rrulePart: string;

        if (rruleStr.includes('RRULE:')) {
          const rruleMatch = rruleStr.match(/RRULE:([^\n]+)/);
          if (rruleMatch) {
            rrulePart = rruleMatch[1];
          } else {
            logger.warn('Could not extract RRULE from recurrence string', {
              eventId: event.id,
              recurrenceRule: rruleStr,
            });
            continue;
          }
        } else if (rruleStr.startsWith('FREQ=')) {
          rrulePart = rruleStr;
        } else {
          rrulePart = rruleStr;
        }

        // Parse the recurrence pattern
        const rule = new RRule({
          ...RRule.parseString(rrulePart),
          dtstart: eventStart,
        });

        // Get occurrences within the date range
        // Note: These occurrences will have the same UTC time as the original,
        // which is WRONG when DST changes. We'll fix this below.
        const rawOccurrences = rule.between(startDate, endDate, true);

        // Parse exception dates if any
        const exceptionDates = event.exceptionDates
          ? event.exceptionDates.split(',').map((d: string) => new Date(d.trim()).getTime())
          : [];

        // Calculate event duration
        const duration = new Date(event.endTime).getTime() - eventStart.getTime();

        // Create expanded events for each occurrence with DST-corrected times
        for (const rawOccurrence of rawOccurrences) {
          // Get the date components from the raw occurrence
          // (the date is correct, but the time may be wrong due to DST)
          const occYear = rawOccurrence.getUTCFullYear();
          const occMonth = rawOccurrence.getUTCMonth();
          const occDay = rawOccurrence.getUTCDate();

          // Calculate the correct UTC time for this local time on this date
          // This accounts for DST changes
          const correctedOccurrence = this.localTimeToUTC(
            occYear,
            occMonth,
            occDay,
            localTime.hour,
            localTime.minute,
            eventTimezone
          );

          // Skip if this occurrence is in the exception dates
          // Check both the raw and corrected times for safety
          if (
            exceptionDates.includes(rawOccurrence.getTime()) ||
            exceptionDates.includes(correctedOccurrence.getTime())
          ) {
            continue;
          }

          const occurrenceEnd = new Date(correctedOccurrence.getTime() + duration);

          expandedEvents.push({
            ...event,
            id: `${event.id}_${correctedOccurrence.toISOString()}`,
            startTime: correctedOccurrence,
            endTime: occurrenceEnd,
            isRecurringInstance: true,
            parentEventId: event.id,
          });
        }
      } catch (error) {
        logger.warn('Failed to expand recurring event', {
          eventId: event.id,
          recurrenceRule: event.recurrenceRule,
          error,
        });
      }
    }

    return expandedEvents;
  }

  /**
   * Sync all calendars for a user
   * Useful for background jobs
   *
   * @param userId - User ID
   * @returns Array of sync results
   */
  async syncAllUserCalendars(userId: string): Promise<SyncResult[]> {
    try {
      const connections = await prisma.calendarConnection.findMany({
        where: {
          userId,
          isConnected: true,
          deletedAt: null,
        },
      });

      logger.info(`Syncing ${connections.length} calendars for user`, { userId });

      const results: SyncResult[] = [];

      for (const connection of connections) {
        try {
          const result = await this.syncCalendarEvents(connection.id, userId);
          results.push(result);
        } catch (error) {
          logger.error('Failed to sync calendar in batch', {
            connectionId: connection.id,
            error,
          });
          results.push({
            totalEvents: 0,
            newEvents: 0,
            updatedEvents: 0,
            deletedEvents: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed to sync all user calendars', { userId, error });
      throw new Error(
        `Failed to sync all calendars: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export default new EventSyncService();
