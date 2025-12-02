/**
 * Event Create Service
 *
 * Handles creation of calendar events with Google Calendar sync
 * Supports recurring events, attendees, and reminders
 */

import { prisma } from '../lib/prisma';
import { SyncStatus, EventStatus, ReminderMethod } from '@prisma/client';
import { CreateEventRequest } from '../validators/eventValidator';
import { generateRRule, describeRecurrence } from './rruleService';
import googleEventClient from '../integrations/google/eventClient';
import tokenRefreshService from './tokenRefreshService';
import auditService from './auditService';
import logger from '../utils/logger';

export interface CreateEventResult {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  syncStatus: SyncStatus;
  googleEventId?: string;
  htmlLink?: string;
  message: string;
}

class EventCreateService {
  /**
   * Create a new calendar event
   *
   * @param userId - User ID creating the event
   * @param data - Validated event creation data
   * @returns Created event with sync status
   */
  async createEvent(userId: string, data: CreateEventRequest): Promise<CreateEventResult> {
    try {
      logger.info('Creating event', {
        userId,
        title: data.title,
        calendarConnectionId: data.calendarConnectionId,
        isRecurring: !!data.recurrence,
      });

      // Verify calendar connection belongs to user
      const connection = await prisma.calendarConnection.findFirst({
        where: {
          id: data.calendarConnectionId,
          userId,
          isConnected: true,
          deletedAt: null,
        },
      });

      if (!connection) {
        throw new Error('Calendar connection not found or not accessible');
      }

      // Check if calendar is read-only (ICS calendars cannot be modified)
      if (connection.isReadOnly) {
        throw new Error('Cannot modify read-only calendar. This calendar is synced from an external source.');
      }

      // Refresh token if needed
      const accessToken = await tokenRefreshService.checkAndRefreshToken(
        connection.id,
        userId
      );

      // Generate RRULE if recurring
      let rrule: string | undefined;
      if (data.recurrence) {
        rrule = generateRRule(data.recurrence, new Date(data.startTime));
        logger.debug('Generated RRULE for recurring event', { rrule });
      }

      // Create event in database using transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create event
        const event = await tx.calendarEvent.create({
          data: {
            calendarConnectionId: connection.id,
            providerEventId: '', // Will be updated after Google sync
            title: data.title,
            description: data.description,
            location: data.location,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            isAllDay: data.isAllDay,
            timezone: data.timezone,
            status: EventStatus.CONFIRMED,
            syncStatus: SyncStatus.PENDING,
            isRecurring: !!data.recurrence,
            recurrenceRule: rrule ? `RRULE:${rrule}` : null,
            recurrenceFrequency: data.recurrence?.frequency,
            recurrenceInterval: data.recurrence?.interval,
            recurrenceEndType: data.recurrence?.endType,
            recurrenceEndDate: data.recurrence?.endDate
              ? new Date(data.recurrence.endDate)
              : null,
            recurrenceCount: data.recurrence?.count,
            recurrenceByDay: data.recurrence?.byDay?.join(','),
            monthDayType: data.recurrence?.monthDayType,
            recurrenceByMonthDay: data.recurrence?.byMonthDay,
            recurrenceBySetPos: data.recurrence?.bySetPos,
            recurrenceByDayOfWeek: data.recurrence?.byDayOfWeek,
            recurrenceByMonth: data.recurrence?.byMonth?.join(','),
            exceptionDates: data.recurrence?.exceptionDates?.join(','),
          },
        });

        // Create attendees
        if (data.attendees && data.attendees.length > 0) {
          await tx.eventAttendee.createMany({
            data: data.attendees.map((attendee) => ({
              eventId: event.id,
              email: attendee.email,
              isOrganizer: attendee.isOrganizer || false,
              isOptional: attendee.isOptional || false,
              rsvpStatus: 'NEEDS_ACTION',
            })),
          });
          logger.debug('Created attendees', {
            eventId: event.id,
            count: data.attendees.length,
          });
        }

        // Create reminders (default: 30 minutes before if none provided)
        const remindersToCreate =
          data.reminders && data.reminders.length > 0
            ? data.reminders
            : [{ method: 'POPUP' as const, minutesBefore: 30 }];

        await tx.eventReminder.createMany({
          data: remindersToCreate.map((reminder) => ({
            eventId: event.id,
            method: this.mapReminderMethod(reminder.method),
            minutesBefore: reminder.minutesBefore,
          })),
        });
        logger.debug('Created reminders', {
          eventId: event.id,
          count: remindersToCreate.length,
        });

        return event;
      });

      // Push to Google Calendar (outside transaction to avoid long-running transaction)
      let googleEventId: string | undefined;
      let htmlLink: string | undefined;
      let syncStatus = SyncStatus.PENDING;
      let errorMessage: string | undefined;

      try {
        const googleResponse = await googleEventClient.createEvent(
          accessToken,
          connection.calendarId,
          {
            summary: data.title,
            description: data.description,
            location: data.location,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            isAllDay: data.isAllDay,
            timezone: data.timezone,
            recurrenceRule: rrule,
            attendees: data.attendees,
            reminders:
              data.reminders && data.reminders.length > 0
                ? data.reminders.map((r) => ({
                    method: r.method.toLowerCase() as 'email' | 'popup' | 'sms',
                    minutesBefore: r.minutesBefore,
                  }))
                : undefined,
          }
        );

        googleEventId = googleResponse.eventId;
        htmlLink = googleResponse.htmlLink;
        syncStatus = SyncStatus.SYNCED;

        logger.info('Successfully pushed event to Google Calendar', {
          eventId: result.id,
          googleEventId,
        });

        // Update event with Google event ID and sync status
        await prisma.calendarEvent.update({
          where: { id: result.id },
          data: {
            providerEventId: googleEventId,
            htmlLink,
            syncStatus: SyncStatus.SYNCED,
            lastSyncedAt: new Date(),
          },
        });

        // Log successful event creation
        await auditService.log({
          userId,
          action: 'EVENT_CREATE',
          resourceType: 'calendar_event',
          resourceId: result.id,
          status: 'SUCCESS',
          metadata: {
            title: data.title,
            calendarConnectionId: connection.id,
            googleEventId,
            isRecurring: !!data.recurrence,
          },
        });
      } catch (googleError: any) {
        logger.error('Failed to push event to Google Calendar', {
          eventId: result.id,
          error: googleError.message,
        });

        errorMessage = googleError.message;
        syncStatus = SyncStatus.FAILED;

        // Update event with failed sync status
        await prisma.calendarEvent.update({
          where: { id: result.id },
          data: {
            syncStatus: SyncStatus.FAILED,
          },
        });

        // Log failed event creation
        await auditService.log({
          userId,
          action: 'EVENT_CREATE',
          resourceType: 'calendar_event',
          resourceId: result.id,
          status: 'FAILURE',
          errorMessage: googleError.message,
          metadata: {
            title: data.title,
            calendarConnectionId: connection.id,
          },
        });

        // Note: We keep the local event even if Google sync fails
        // User can retry sync later
      }

      return {
        id: result.id,
        title: result.title,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        syncStatus,
        googleEventId,
        htmlLink,
        message:
          syncStatus === SyncStatus.SYNCED
            ? 'Event created and synced to Google Calendar successfully'
            : `Event created locally but failed to sync to Google Calendar: ${errorMessage}`,
      };
    } catch (error: any) {
      logger.error('Failed to create event', {
        userId,
        error: error.message,
      });

      // Log failed event creation
      await auditService.log({
        userId,
        action: 'EVENT_CREATE',
        resourceType: 'calendar_event',
        status: 'FAILURE',
        errorMessage: error.message,
        metadata: {
          title: data.title,
          calendarConnectionId: data.calendarConnectionId,
        },
      });

      throw new Error(`Failed to create event: ${error.message}`);
    }
  }

  /**
   * Map reminder method to Prisma enum
   */
  private mapReminderMethod(method: string): ReminderMethod {
    const methodMap: Record<string, ReminderMethod> = {
      EMAIL: ReminderMethod.EMAIL,
      POPUP: ReminderMethod.POPUP,
      SMS: ReminderMethod.SMS,
    };

    return methodMap[method.toUpperCase()] || ReminderMethod.POPUP;
  }

  /**
   * Retry syncing a failed event to Google Calendar
   *
   * @param userId - User ID
   * @param eventId - Event ID to retry
   * @returns Updated event with sync status
   */
  async retrySyncEvent(userId: string, eventId: string): Promise<CreateEventResult> {
    try {
      // Get event with connection
      const event = await prisma.calendarEvent.findFirst({
        where: {
          id: eventId,
          calendarConnection: {
            userId,
            isConnected: true,
            deletedAt: null,
          },
          deletedAt: null,
        },
        include: {
          calendarConnection: true,
          eventAttendees: true,
          eventReminders: true,
        },
      });

      if (!event) {
        throw new Error('Event not found or not accessible');
      }

      if (event.syncStatus === SyncStatus.SYNCED) {
        throw new Error('Event is already synced');
      }

      logger.info('Retrying event sync', { eventId, userId });

      // Refresh token if needed
      const accessToken = await tokenRefreshService.checkAndRefreshToken(
        event.calendarConnection.id,
        userId
      );

      // Push to Google Calendar
      const googleResponse = await googleEventClient.createEvent(
        accessToken,
        event.calendarConnection.calendarId,
        {
          summary: event.title,
          description: event.description || undefined,
          location: event.location || undefined,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          timezone: event.timezone,
          recurrenceRule: event.recurrenceRule?.replace('RRULE:', ''),
          attendees: event.eventAttendees.map((a) => ({
            email: a.email,
            isOrganizer: a.isOrganizer,
            isOptional: a.isOptional,
          })),
          reminders: event.eventReminders.map((r) => ({
            method: r.method.toLowerCase() as 'email' | 'popup' | 'sms',
            minutesBefore: r.minutesBefore,
          })),
        }
      );

      // Update event with Google event ID and sync status
      await prisma.calendarEvent.update({
        where: { id: eventId },
        data: {
          providerEventId: googleResponse.eventId,
          htmlLink: googleResponse.htmlLink,
          syncStatus: SyncStatus.SYNCED,
          lastSyncedAt: new Date(),
        },
      });

      logger.info('Successfully retried event sync', {
        eventId,
        googleEventId: googleResponse.eventId,
      });

      return {
        id: event.id,
        title: event.title,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        syncStatus: SyncStatus.SYNCED,
        googleEventId: googleResponse.eventId,
        htmlLink: googleResponse.htmlLink,
        message: 'Event synced to Google Calendar successfully',
      };
    } catch (error: any) {
      logger.error('Failed to retry event sync', {
        eventId,
        userId,
        error: error.message,
      });

      throw new Error(`Failed to retry event sync: ${error.message}`);
    }
  }
}

export default new EventCreateService();
