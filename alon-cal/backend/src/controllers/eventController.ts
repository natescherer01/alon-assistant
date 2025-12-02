/**
 * Event Controller
 *
 * HTTP request handlers for calendar event management
 * Handles fetching events, triggering syncs, and event queries
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import eventSyncService from '../services/eventSyncService';
import eventCreateService from '../services/eventCreateService';
import eventManagementService from '../services/eventManagementService';
import { validateCreateEventRequest, validateUpdateEventRequest } from '../validators/eventValidator';
import { ZodError } from 'zod';
import logger from '../utils/logger';

class EventController {
  /**
   * Create a new event
   * POST /api/events
   *
   * Request body: CreateEventRequest (validated by Zod)
   *
   * Returns created event with sync status
   */
  async createEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      // Validate request body
      let validatedData;
      try {
        validatedData = validateCreateEventRequest(req.body);
      } catch (error) {
        if (error instanceof ZodError) {
          logger.warn('Event creation validation failed', {
            userId,
            errors: error.errors,
          });

          res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid event data',
            details: error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          });
          return;
        }
        throw error;
      }

      logger.info('Creating event via API', {
        userId,
        title: validatedData.title,
        calendarConnectionId: validatedData.calendarConnectionId,
      });

      // Create event
      const result = await eventCreateService.createEvent(userId, validatedData);

      // Return appropriate status code based on sync status
      const statusCode = result.syncStatus === 'SYNCED' ? 201 : 202;

      res.status(statusCode).json({
        id: result.id,
        title: result.title,
        startTime: result.startTime,
        endTime: result.endTime,
        syncStatus: result.syncStatus,
        googleEventId: result.googleEventId,
        htmlLink: result.htmlLink,
        message: result.message,
      });
    } catch (error: any) {
      logger.error('Failed to create event via API', {
        userId: req.user?.userId,
        error: error.message,
      });

      // Map common errors to appropriate status codes
      if (error.message?.includes('not found') || error.message?.includes('not accessible')) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('authentication failed') || error.message?.includes('reconnect')) {
        res.status(401).json({
          error: 'Authentication Error',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('Permission denied') || error.message?.includes('access')) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('conflict') || error.message?.includes('overlaps')) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('Rate limit')) {
        res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Retry syncing a failed event
   * POST /api/events/:eventId/retry-sync
   *
   * Retries pushing a locally created event to Google Calendar
   */
  async retrySyncEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { eventId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!eventId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing eventId' });
        return;
      }

      logger.info('Retrying event sync via API', { userId, eventId });

      const result = await eventCreateService.retrySyncEvent(userId, eventId);

      res.status(200).json({
        id: result.id,
        title: result.title,
        startTime: result.startTime,
        endTime: result.endTime,
        syncStatus: result.syncStatus,
        googleEventId: result.googleEventId,
        htmlLink: result.htmlLink,
        message: result.message,
      });
    } catch (error: any) {
      logger.error('Failed to retry event sync via API', {
        userId: req.user?.userId,
        eventId: req.params.eventId,
        error: error.message,
      });

      if (error.message?.includes('not found') || error.message?.includes('not accessible')) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('already synced')) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }
  /**
   * Get events for a user within a date range
   * GET /api/events?start=...&end=...
   *
   * Query parameters:
   * - start: ISO date string (required)
   * - end: ISO date string (required)
   *
   * Returns aggregated events from all connected calendars
   */
  async getEvents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const { start, end } = req.query;

      if (!start || !end) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required query parameters: start and end',
        });
        return;
      }

      const startDate = new Date(start as string);
      const endDate = new Date(end as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)',
        });
        return;
      }

      if (startDate >= endDate) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Start date must be before end date',
        });
        return;
      }

      // Limit date range to prevent excessive queries
      const maxDays = 365; // 1 year
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > maxDays) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Date range too large. Maximum ${maxDays} days allowed.`,
        });
        return;
      }

      logger.debug('Fetching events', { userId, start: startDate, end: endDate });

      const events = await eventSyncService.getEventsInRange(userId, startDate, endDate);

      res.status(200).json(events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        isAllDay: event.isAllDay,
        timezone: event.timezone,
        status: event.status,
        isRecurring: event.isRecurring,
        attendees: event.attendees,
        reminders: event.reminders,
        htmlLink: event.htmlLink,
        calendarId: event.calendarConnectionId,
        provider: event.calendarConnection.provider,
        calendarName: event.calendarConnection.calendarName,
        calendarColor: event.calendarConnection.calendarColor,
      })));
    } catch (error) {
      logger.error('Failed to get events', { error });
      next(error);
    }
  }

  /**
   * Sync all calendars for the authenticated user
   * POST /api/events/sync
   *
   * Triggers sync for all connected calendars
   */
  async syncAllCalendars(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      logger.info('Syncing all calendars for user', { userId });

      const results = await eventSyncService.syncAllUserCalendars(userId);

      const totalStats = results.reduce(
        (acc, result) => ({
          totalEvents: acc.totalEvents + result.totalEvents,
          newEvents: acc.newEvents + result.newEvents,
          updatedEvents: acc.updatedEvents + result.updatedEvents,
          deletedEvents: acc.deletedEvents + result.deletedEvents,
          errors: [...acc.errors, ...result.errors],
        }),
        {
          totalEvents: 0,
          newEvents: 0,
          updatedEvents: 0,
          deletedEvents: 0,
          errors: [] as string[],
        }
      );

      res.status(200).json({
        message: 'Calendar sync completed',
        stats: totalStats,
        calendarCount: results.length,
      });
    } catch (error) {
      logger.error('Failed to sync all calendars', { error });
      next(error);
    }
  }

  /**
   * Get event by ID
   * GET /api/events/:eventId
   *
   * Returns detailed information about a specific event
   */
  async getEventById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { eventId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!eventId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing eventId' });
        return;
      }

      const { prisma } = await import('../lib/prisma');

      // Handle recurring event instance IDs (format: parentEventId_occurrenceDate)
      // These composite IDs are generated in expandRecurringEvents for recurring instances
      let actualEventId = eventId;
      let instanceDate: string | null = null;

      // Check if this is a composite ID for a recurring instance
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      // Composite format: uuid_ISO8601Date
      const compositeMatch = eventId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(.+)$/i);
      if (compositeMatch) {
        actualEventId = compositeMatch[1];
        instanceDate = compositeMatch[2];
      }

      const event = await prisma.calendarEvent.findFirst({
        where: {
          id: actualEventId,
          calendarConnection: {
            userId,
            deletedAt: null,
          },
          deletedAt: null,
        },
        include: {
          calendarConnection: {
            select: {
              provider: true,
              calendarName: true,
              calendarColor: true,
              isReadOnly: true,
            },
          },
        },
      });

      if (!event) {
        res.status(404).json({ error: 'Not Found', message: 'Event not found' });
        return;
      }

      // For recurring instances, calculate the specific instance's start/end times
      let responseStartTime = event.startTime;
      let responseEndTime = event.endTime;

      if (instanceDate && event.isRecurring) {
        try {
          const instanceStart = new Date(instanceDate);
          const duration = event.endTime.getTime() - event.startTime.getTime();
          responseStartTime = instanceStart;
          responseEndTime = new Date(instanceStart.getTime() + duration);
        } catch {
          // If parsing fails, fall back to original times
          logger.warn('Failed to parse recurring instance date', { eventId, instanceDate });
        }
      }

      res.status(200).json({
        event: {
          id: eventId, // Return the original ID (including composite ID for recurring instances)
          title: event.title,
          description: event.description,
          location: event.location,
          startTime: responseStartTime.toISOString(),
          endTime: responseEndTime.toISOString(),
          isAllDay: event.isAllDay,
          timezone: event.timezone,
          status: event.status,
          isRecurring: event.isRecurring,
          recurrenceRule: event.recurrenceRule,
          attendees: event.attendees,
          reminders: event.reminders,
          htmlLink: event.htmlLink,
          calendar: {
            provider: event.calendarConnection.provider,
            name: event.calendarConnection.calendarName,
            color: event.calendarConnection.calendarColor,
            isReadOnly: event.calendarConnection.isReadOnly || event.calendarConnection.provider === 'ICS',
          },
          providerMetadata: event.providerMetadata,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get event by ID', { error });
      next(error);
    }
  }

  /**
   * Get upcoming events
   * GET /api/events/upcoming?limit=10
   *
   * Returns upcoming events starting from now
   */
  async getUpcomingEvents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Limit must be between 1 and 100',
        });
        return;
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { prisma } = await import('../lib/prisma');

      const events = await prisma.calendarEvent.findMany({
        where: {
          calendarConnection: {
            userId,
            isConnected: true,
            deletedAt: null,
          },
          syncStatus: 'SYNCED',
          deletedAt: null,
          startTime: {
            gte: now,
            lte: endDate,
          },
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
        take: limit,
      });

      res.status(200).json({
        events: events.map((event) => ({
          id: event.id,
          title: event.title,
          startTime: event.startTime.toISOString(),
          endTime: event.endTime.toISOString(),
          isAllDay: event.isAllDay,
          location: event.location,
          calendar: {
            provider: event.calendarConnection.provider,
            name: event.calendarConnection.calendarName,
            color: event.calendarConnection.calendarColor,
          },
        })),
        meta: {
          total: events.length,
          limit,
        },
      });
    } catch (error) {
      logger.error('Failed to get upcoming events', { error });
      next(error);
    }
  }

  /**
   * Update an existing event
   * PUT /api/events/:eventId
   *
   * Updates event fields and syncs changes to provider
   */
  async updateEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { eventId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!eventId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing eventId' });
        return;
      }

      // Validate request body
      let validatedData;
      try {
        validatedData = validateUpdateEventRequest(req.body);
      } catch (error) {
        if (error instanceof ZodError) {
          logger.warn('Event update validation failed', {
            userId,
            eventId,
            errors: error.errors,
          });

          res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid event data',
            details: error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          });
          return;
        }
        throw error;
      }

      logger.info('Updating event via API', {
        userId,
        eventId,
        fieldsUpdated: Object.keys(validatedData),
      });

      // Update event
      const result = await eventManagementService.updateEvent(userId, eventId, validatedData);

      // Return appropriate status code based on sync status
      const statusCode = result.syncStatus === 'SYNCED' ? 200 : 202;

      res.status(statusCode).json({
        id: result.id,
        title: result.title,
        startTime: result.startTime,
        endTime: result.endTime,
        syncStatus: result.syncStatus,
        providerEventId: result.providerEventId,
        htmlLink: result.htmlLink,
        message: result.message,
      });
    } catch (error: any) {
      logger.error('Failed to update event via API', {
        userId: req.user?.userId,
        eventId: req.params.eventId,
        error: error.message,
      });

      // Map common errors to appropriate status codes
      if (error.message?.includes('not found') || error.message?.includes('not accessible')) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('read-only') || error.message?.includes('cannot modify')) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('authentication failed') || error.message?.includes('reconnect')) {
        res.status(401).json({
          error: 'Authentication Error',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('Permission denied')) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Delete an event
   * DELETE /api/events/:eventId
   *
   * Soft deletes the event and removes it from provider
   */
  async deleteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { eventId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!eventId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing eventId' });
        return;
      }

      logger.info('Deleting event via API', { userId, eventId });

      // Delete event
      const result = await eventManagementService.deleteEvent(userId, eventId);

      res.status(200).json({
        id: result.id,
        message: result.message,
        deletedFromProvider: result.deletedFromProvider,
      });
    } catch (error: any) {
      logger.error('Failed to delete event via API', {
        userId: req.user?.userId,
        eventId: req.params.eventId,
        error: error.message,
      });

      // Map common errors to appropriate status codes
      if (error.message?.includes('not found') || error.message?.includes('not accessible')) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('read-only') || error.message?.includes('cannot delete')) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
        });
        return;
      } else if (error.message?.includes('authentication failed') || error.message?.includes('reconnect')) {
        res.status(401).json({
          error: 'Authentication Error',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }
}

export default new EventController();
