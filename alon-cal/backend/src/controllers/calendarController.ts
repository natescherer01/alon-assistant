/**
 * Calendar Controller
 *
 * HTTP request handlers for calendar management
 * Handles listing, disconnecting, and syncing calendars
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, getClientIp, getUserAgent } from '../middleware/auth';
import oauthService from '../services/oauthService';
import tokenRefreshService from '../services/tokenRefreshService';
import eventSyncService from '../services/eventSyncService';
import webhookService from '../services/webhookService';
import auditService from '../services/auditService';
import { prisma } from '../lib/prisma';
import { CalendarProvider } from '@prisma/client';
import logger from '../utils/logger';

class CalendarController {
  /**
   * Get all connected calendars for user
   * GET /api/calendars
   *
   * Returns list of all calendar connections (not deleted)
   */
  async getUserCalendars(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const calendars = await oauthService.getUserCalendars(userId);

      logger.debug('Retrieved user calendars', { userId, count: calendars.length });

      res.status(200).json({
        calendars: calendars.map((cal) => ({
          id: cal.id,
          provider: cal.provider,
          calendarId: cal.calendarId,
          calendarName: cal.calendarName,
          calendarColor: cal.calendarColor,
          isPrimary: cal.isPrimary,
          isConnected: cal.isConnected,
          lastSyncedAt: cal.lastSyncedAt?.toISOString() || null,
          createdAt: cal.createdAt.toISOString(),
          updatedAt: cal.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      logger.error('Failed to get user calendars', { error });
      next(error);
    }
  }

  /**
   * Disconnect calendar
   * DELETE /api/calendars/:connectionId
   *
   * Soft deletes calendar connection and optionally revokes OAuth token
   */
  async disconnectCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!connectionId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing connectionId' });
        return;
      }

      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);

      await oauthService.disconnectCalendar(userId, connectionId, ipAddress, userAgent);

      logger.info('Calendar disconnected', { userId, connectionId });

      res.status(200).json({
        message: 'Calendar disconnected successfully',
      });
    } catch (error) {
      logger.error('Failed to disconnect calendar', { error });
      next(error);
    }
  }

  /**
   * Get calendar metadata
   * GET /api/calendars/:connectionId
   *
   * Returns detailed information about a specific calendar connection
   */
  async getCalendarMetadata(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!connectionId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing connectionId' });
        return;
      }

      const connection = await prisma.calendarConnection.findUnique({
        where: {
          id: connectionId,
          userId,
          deletedAt: null,
        },
      });

      if (!connection) {
        res.status(404).json({ error: 'Not Found', message: 'Calendar connection not found' });
        return;
      }

      logger.debug('Retrieved calendar metadata', { userId, connectionId });

      res.status(200).json({
        calendar: {
          id: connection.id,
          provider: connection.provider,
          calendarId: connection.calendarId,
          calendarName: connection.calendarName,
          calendarColor: connection.calendarColor,
          isPrimary: connection.isPrimary,
          isConnected: connection.isConnected,
          lastSyncedAt: connection.lastSyncedAt?.toISOString() || null,
          tokenExpiresAt: connection.tokenExpiresAt.toISOString(),
          createdAt: connection.createdAt.toISOString(),
          updatedAt: connection.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get calendar metadata', { error });
      next(error);
    }
  }

  /**
   * Manually trigger calendar sync
   * POST /api/calendars/:connectionId/sync
   *
   * Refreshes token if needed and updates lastSyncedAt
   * (Actual event syncing would be implemented separately)
   */
  async syncCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!connectionId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing connectionId' });
        return;
      }

      // Verify connection belongs to user
      const connection = await prisma.calendarConnection.findUnique({
        where: {
          id: connectionId,
          userId,
          deletedAt: null,
        },
      });

      if (!connection) {
        res.status(404).json({ error: 'Not Found', message: 'Calendar connection not found' });
        return;
      }

      if (!connection.isConnected) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Calendar is disconnected',
        });
        return;
      }

      // Trigger event sync (pass userId for authorization check)
      try {
        const syncResult = await eventSyncService.syncCalendarEvents(
          connectionId,
          userId,
          {
            startDate: new Date(), // From now
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days ahead
          }
        );

        logger.info('Calendar synced', { userId, connectionId, ...syncResult });

        res.status(200).json({
          message: 'Calendar synced successfully',
          lastSyncedAt: new Date().toISOString(),
          stats: {
            totalEvents: syncResult.totalEvents,
            newEvents: syncResult.newEvents,
            updatedEvents: syncResult.updatedEvents,
            deletedEvents: syncResult.deletedEvents,
          },
          errors: syncResult.errors.length > 0 ? syncResult.errors : undefined,
        });
      } catch (error) {
        logger.error('Failed to sync events', { connectionId, error });
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to sync calendar events. Please try again.',
        });
        return;
      }
    } catch (error) {
      logger.error('Failed to sync calendar', { error });

      // Log sync failure
      if (req.user?.userId && req.params.connectionId) {
        await auditService.logCalendarSyncFailure(
          req.user.userId,
          req.params.connectionId,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      next(error);
    }
  }

  /**
   * Sync all calendars for the authenticated user
   * POST /api/calendars/sync-all
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

      // Get all connected calendars
      const calendars = await prisma.calendarConnection.findMany({
        where: {
          userId,
          deletedAt: null,
          isConnected: true,
        },
      });

      if (calendars.length === 0) {
        res.status(200).json({
          message: 'No calendars to sync',
          results: [],
        });
        return;
      }

      logger.info('Starting sync for all calendars', { userId, count: calendars.length });

      // Sync all calendars in parallel
      const syncPromises = calendars.map(async (calendar) => {
        try {
          const syncResult = await eventSyncService.syncCalendarEvents(
            calendar.id,
            userId,
            {
              startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days back
              endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days ahead
            }
          );

          return {
            calendarId: calendar.id,
            calendarName: calendar.calendarName,
            success: true,
            stats: {
              totalEvents: syncResult.totalEvents,
              newEvents: syncResult.newEvents,
              updatedEvents: syncResult.updatedEvents,
              deletedEvents: syncResult.deletedEvents,
            },
            errors: syncResult.errors.length > 0 ? syncResult.errors : undefined,
          };
        } catch (error) {
          logger.error('Failed to sync calendar', { calendarId: calendar.id, error });
          return {
            calendarId: calendar.id,
            calendarName: calendar.calendarName,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const results = await Promise.all(syncPromises);

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      logger.info('Completed sync for all calendars', {
        userId,
        total: calendars.length,
        success: successCount,
        failed: failureCount,
      });

      res.status(200).json({
        message: `Synced ${successCount} of ${calendars.length} calendars`,
        results,
        summary: {
          total: calendars.length,
          success: successCount,
          failed: failureCount,
        },
      });
    } catch (error) {
      logger.error('Failed to sync all calendars', { error });
      next(error);
    }
  }

  /**
   * Get calendar connection stats
   * GET /api/calendars/stats
   *
   * Returns statistics about user's calendar connections
   */
  async getCalendarStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const [totalConnections, connectedCount, googleCount, microsoftCount] = await Promise.all([
        prisma.calendarConnection.count({
          where: { userId, deletedAt: null },
        }),
        prisma.calendarConnection.count({
          where: { userId, deletedAt: null, isConnected: true },
        }),
        prisma.calendarConnection.count({
          where: { userId, deletedAt: null, provider: 'GOOGLE' },
        }),
        prisma.calendarConnection.count({
          where: { userId, deletedAt: null, provider: 'MICROSOFT' },
        }),
      ]);

      res.status(200).json({
        stats: {
          total: totalConnections,
          connected: connectedCount,
          disconnected: totalConnections - connectedCount,
          byProvider: {
            google: googleCount,
            microsoft: microsoftCount,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get calendar stats', { error });
      next(error);
    }
  }

  /**
   * Enable webhook for a calendar (Microsoft only)
   * POST /api/calendars/:connectionId/webhook
   *
   * Creates a Microsoft Graph subscription for real-time notifications
   */
  async enableWebhook(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!connectionId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing connectionId' });
        return;
      }

      // Verify connection belongs to user and is Microsoft
      const connection = await prisma.calendarConnection.findUnique({
        where: {
          id: connectionId,
          userId,
          deletedAt: null,
        },
      });

      if (!connection) {
        res.status(404).json({ error: 'Not Found', message: 'Calendar connection not found' });
        return;
      }

      if (connection.provider !== CalendarProvider.MICROSOFT) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Webhooks are only supported for Microsoft calendars',
        });
        return;
      }

      if (!connection.isConnected) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Calendar is disconnected',
        });
        return;
      }

      // Create webhook subscription
      const subscription = await webhookService.createSubscription(connectionId, userId);

      logger.info('Webhook enabled', { userId, connectionId, subscriptionId: subscription.subscriptionId });

      res.status(201).json({
        message: 'Webhook enabled successfully',
        subscription: {
          id: subscription.id,
          subscriptionId: subscription.subscriptionId,
          expiresAt: subscription.expirationDateTime.toISOString(),
          isActive: subscription.isActive,
        },
      });
    } catch (error) {
      logger.error('Failed to enable webhook', { error });
      next(error);
    }
  }

  /**
   * Disable webhook for a calendar
   * DELETE /api/calendars/:connectionId/webhook
   *
   * Deletes the Microsoft Graph subscription
   */
  async disableWebhook(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!connectionId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing connectionId' });
        return;
      }

      // Delete webhook subscription
      await webhookService.deleteSubscription(connectionId, userId);

      logger.info('Webhook disabled', { userId, connectionId });

      res.status(200).json({
        message: 'Webhook disabled successfully',
      });
    } catch (error) {
      logger.error('Failed to disable webhook', { error });
      next(error);
    }
  }
}

export default new CalendarController();
