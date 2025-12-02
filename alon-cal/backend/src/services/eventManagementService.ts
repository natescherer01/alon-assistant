/**
 * Event Management Service
 *
 * Handles updating and deleting calendar events with provider sync
 * Supports Google Calendar, Microsoft, and read-only ICS calendar checks
 */

import { prisma } from '../lib/prisma';
import { SyncStatus, ReminderMethod, CalendarProvider } from '@prisma/client';
import { UpdateEventRequest } from '../validators/eventValidator';
import { generateRRule } from './rruleService';
import googleEventClient from '../integrations/google/eventClient';
import tokenRefreshService from './tokenRefreshService';
import auditService from './auditService';
import logger from '../utils/logger';

export interface UpdateEventResult {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  syncStatus: SyncStatus;
  providerEventId?: string;
  htmlLink?: string;
  message: string;
}

export interface DeleteEventResult {
  id: string;
  message: string;
  deletedFromProvider: boolean;
}

class EventManagementService {
  /**
   * Update an existing calendar event
   *
   * @param userId - User ID updating the event
   * @param eventId - Event ID to update
   * @param data - Validated event update data
   * @returns Updated event with sync status
   */
  async updateEvent(userId: string, eventId: string, data: UpdateEventRequest): Promise<UpdateEventResult> {
    try {
      logger.info('Updating event', { userId, eventId, fieldsUpdated: Object.keys(data) });

      // Get event with connection
      const event = await prisma.calendarEvent.findFirst({
        where: {
          id: eventId,
          calendarConnection: {
            userId,
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

      // Check if calendar is read-only (ICS calendars cannot be modified)
      if (event.calendarConnection.isReadOnly) {
        throw new Error('Cannot modify read-only calendar. This calendar is synced from an external source.');
      }

      // Generate RRULE if recurrence is being updated
      let rrule: string | undefined;
      if (data.recurrence) {
        const startTime = data.startTime ? new Date(data.startTime) : event.startTime;
        rrule = generateRRule(data.recurrence, startTime);
        logger.debug('Generated RRULE for updated recurring event', { rrule });
      }

      // Build update data object
      const updateData: any = {
        updatedAt: new Date(),
      };

      // Update basic fields
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
      if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
      if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;
      if (data.timezone !== undefined) updateData.timezone = data.timezone;

      // Update recurrence fields
      if (data.recurrence !== undefined) {
        updateData.isRecurring = !!data.recurrence;
        updateData.recurrenceRule = rrule ? `RRULE:${rrule}` : null;
        updateData.recurrenceFrequency = data.recurrence?.frequency || null;
        updateData.recurrenceInterval = data.recurrence?.interval || null;
        updateData.recurrenceEndType = data.recurrence?.endType || null;
        updateData.recurrenceEndDate = data.recurrence?.endDate ? new Date(data.recurrence.endDate) : null;
        updateData.recurrenceCount = data.recurrence?.count || null;
        updateData.recurrenceByDay = data.recurrence?.byDay?.join(',') || null;
        updateData.monthDayType = data.recurrence?.monthDayType || null;
        updateData.recurrenceByMonthDay = data.recurrence?.byMonthDay || null;
        updateData.recurrenceBySetPos = data.recurrence?.bySetPos || null;
        updateData.recurrenceByDayOfWeek = data.recurrence?.byDayOfWeek || null;
        updateData.recurrenceByMonth = data.recurrence?.byMonth?.join(',') || null;
        updateData.exceptionDates = data.recurrence?.exceptionDates?.join(',') || null;
      }

      // Update event in database using transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update main event
        const updatedEvent = await tx.calendarEvent.update({
          where: { id: eventId },
          data: updateData,
        });

        // Update attendees if provided
        if (data.attendees !== undefined) {
          // Delete existing attendees
          await tx.eventAttendee.deleteMany({
            where: { eventId },
          });

          // Create new attendees
          if (data.attendees.length > 0) {
            await tx.eventAttendee.createMany({
              data: data.attendees.map((attendee) => ({
                eventId,
                email: attendee.email,
                isOrganizer: attendee.isOrganizer || false,
                isOptional: attendee.isOptional || false,
                rsvpStatus: 'NEEDS_ACTION',
              })),
            });
            logger.debug('Updated attendees', { eventId, count: data.attendees.length });
          }
        }

        // Update reminders if provided
        if (data.reminders !== undefined) {
          // Delete existing reminders
          await tx.eventReminder.deleteMany({
            where: { eventId },
          });

          // Create new reminders
          if (data.reminders.length > 0) {
            await tx.eventReminder.createMany({
              data: data.reminders.map((reminder) => ({
                eventId,
                method: this.mapReminderMethod(reminder.method),
                minutesBefore: reminder.minutesBefore,
              })),
            });
            logger.debug('Updated reminders', { eventId, count: data.reminders.length });
          }
        }

        return updatedEvent;
      });

      // Sync to provider (only if event was previously synced)
      let syncStatus = event.syncStatus;
      let errorMessage: string | undefined;

      if (event.syncStatus === SyncStatus.SYNCED && event.providerEventId) {
        try {
          // Refresh token if needed
          const accessToken = await tokenRefreshService.checkAndRefreshToken(
            event.calendarConnection.id,
            userId
          );

          // Get updated attendees and reminders
          const updatedAttendees = data.attendees !== undefined
            ? data.attendees
            : event.eventAttendees.map((a) => ({
                email: a.email,
                isOrganizer: a.isOrganizer,
                isOptional: a.isOptional,
              }));

          const updatedReminders = data.reminders !== undefined
            ? data.reminders
            : event.eventReminders.map((r) => ({
                method: r.method.toLowerCase() as 'email' | 'popup' | 'sms',
                minutesBefore: r.minutesBefore,
              }));

          // Push to Google Calendar
          if (event.calendarConnection.provider === CalendarProvider.GOOGLE) {
            await googleEventClient.updateEvent(
              accessToken,
              event.calendarConnection.calendarId,
              event.providerEventId,
              {
                summary: data.title,
                description: data.description,
                location: data.location,
                startTime: data.startTime ? new Date(data.startTime) : undefined,
                endTime: data.endTime ? new Date(data.endTime) : undefined,
                isAllDay: data.isAllDay,
                timezone: data.timezone,
                recurrenceRule: rrule,
                attendees: updatedAttendees,
                reminders: updatedReminders,
              }
            );

            logger.info('Successfully updated event in Google Calendar', {
              eventId,
              providerEventId: event.providerEventId,
            });

            // Update sync timestamp
            await prisma.calendarEvent.update({
              where: { id: eventId },
              data: {
                syncStatus: SyncStatus.SYNCED,
                lastSyncedAt: new Date(),
              },
            });

            syncStatus = SyncStatus.SYNCED;
          }

          // Log successful event update
          await auditService.log({
            userId,
            action: 'EVENT_UPDATE',
            resourceType: 'calendar_event',
            resourceId: eventId,
            status: 'SUCCESS',
            metadata: {
              fieldsUpdated: Object.keys(data),
              providerEventId: event.providerEventId,
            },
          });
        } catch (providerError: any) {
          logger.error('Failed to update event in provider', {
            eventId,
            provider: event.calendarConnection.provider,
            error: providerError.message,
          });

          errorMessage = providerError.message;
          syncStatus = SyncStatus.FAILED;

          // Update event with failed sync status
          await prisma.calendarEvent.update({
            where: { id: eventId },
            data: {
              syncStatus: SyncStatus.FAILED,
            },
          });

          // Log failed provider sync
          await auditService.log({
            userId,
            action: 'EVENT_UPDATE',
            resourceType: 'calendar_event',
            resourceId: eventId,
            status: 'FAILURE',
            errorMessage: providerError.message,
            metadata: {
              fieldsUpdated: Object.keys(data),
            },
          });
        }
      }

      return {
        id: result.id,
        title: result.title,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        syncStatus,
        providerEventId: event.providerEventId || undefined,
        htmlLink: event.htmlLink || undefined,
        message:
          syncStatus === SyncStatus.SYNCED
            ? 'Event updated and synced successfully'
            : syncStatus === SyncStatus.FAILED
            ? `Event updated locally but failed to sync: ${errorMessage}`
            : 'Event updated locally',
      };
    } catch (error: any) {
      logger.error('Failed to update event', {
        userId,
        eventId,
        error: error.message,
      });

      // Log failed event update
      await auditService.log({
        userId,
        action: 'EVENT_UPDATE',
        resourceType: 'calendar_event',
        resourceId: eventId,
        status: 'FAILURE',
        errorMessage: error.message,
        metadata: {
          fieldsUpdated: Object.keys(data),
        },
      });

      throw new Error(`Failed to update event: ${error.message}`);
    }
  }

  /**
   * Delete a calendar event (soft delete)
   *
   * @param userId - User ID deleting the event
   * @param eventId - Event ID to delete
   * @returns Deletion result with sync status
   */
  async deleteEvent(userId: string, eventId: string): Promise<DeleteEventResult> {
    try {
      logger.info('Deleting event', { userId, eventId });

      // Get event with connection
      const event = await prisma.calendarEvent.findFirst({
        where: {
          id: eventId,
          calendarConnection: {
            userId,
            deletedAt: null,
          },
          deletedAt: null,
        },
        include: {
          calendarConnection: true,
        },
      });

      if (!event) {
        throw new Error('Event not found or not accessible');
      }

      // Check if calendar is read-only (ICS calendars cannot be modified)
      if (event.calendarConnection.isReadOnly) {
        throw new Error('Cannot delete from read-only calendar. This calendar is synced from an external source.');
      }

      let deletedFromProvider = false;

      // Delete from provider first (if synced)
      if (event.syncStatus === SyncStatus.SYNCED && event.providerEventId) {
        try {
          // Refresh token if needed
          const accessToken = await tokenRefreshService.checkAndRefreshToken(
            event.calendarConnection.id,
            userId
          );

          // Delete from Google Calendar
          if (event.calendarConnection.provider === CalendarProvider.GOOGLE) {
            await googleEventClient.deleteEvent(
              accessToken,
              event.calendarConnection.calendarId,
              event.providerEventId
            );

            logger.info('Successfully deleted event from Google Calendar', {
              eventId,
              providerEventId: event.providerEventId,
            });

            deletedFromProvider = true;
          }
        } catch (providerError: any) {
          logger.error('Failed to delete event from provider', {
            eventId,
            provider: event.calendarConnection.provider,
            error: providerError.message,
          });

          // Continue with local deletion even if provider deletion fails
          // The event will be marked as deleted locally
        }
      }

      // Soft delete the event in database
      await prisma.calendarEvent.update({
        where: { id: eventId },
        data: {
          deletedAt: new Date(),
          syncStatus: SyncStatus.DELETED,
        },
      });

      logger.info('Successfully soft deleted event', { eventId, deletedFromProvider });

      // Log successful event deletion
      await auditService.log({
        userId,
        action: 'EVENT_DELETE',
        resourceType: 'calendar_event',
        resourceId: eventId,
        status: 'SUCCESS',
        metadata: {
          providerEventId: event.providerEventId,
          deletedFromProvider,
          provider: event.calendarConnection.provider,
        },
      });

      return {
        id: eventId,
        message: deletedFromProvider
          ? 'Event deleted successfully from calendar'
          : 'Event deleted locally (provider deletion may have failed)',
        deletedFromProvider,
      };
    } catch (error: any) {
      logger.error('Failed to delete event', {
        userId,
        eventId,
        error: error.message,
      });

      // Log failed event deletion
      await auditService.log({
        userId,
        action: 'EVENT_DELETE',
        resourceType: 'calendar_event',
        resourceId: eventId,
        status: 'FAILURE',
        errorMessage: error.message,
      });

      throw new Error(`Failed to delete event: ${error.message}`);
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
}

export default new EventManagementService();
