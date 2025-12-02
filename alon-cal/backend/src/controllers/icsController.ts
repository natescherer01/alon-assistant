/**
 * ICS Controller
 *
 * HTTP request handlers for ICS calendar management.
 * Handles URL validation, connection creation/update, and manual sync triggers.
 *
 * Routes:
 * - POST /api/calendars/ics/validate - Validate ICS URL
 * - POST /api/calendars/ics/connect - Create ICS connection
 * - PUT /api/calendars/ics/:connectionId - Update ICS connection
 * - DELETE /api/calendars/ics/:connectionId - Delete ICS connection
 * - POST /api/calendars/ics/:connectionId/sync - Manual sync trigger
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import icsService from '../services/icsService';
import logger from '../utils/logger';
import { z } from 'zod';

// Validation schemas
const validateUrlSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

const connectIcsSchema = z.object({
  url: z.string().url('Invalid URL format'),
  displayName: z.string().min(1).max(255).optional(),
});

const updateIcsSchema = z.object({
  url: z.string().url('Invalid URL format').optional(),
  displayName: z.string().min(1).max(255).optional(),
});

class ICSController {
  /**
   * Validate ICS URL
   * POST /api/calendars/ics/validate
   *
   * Request body:
   * {
   *   "url": "https://example.com/calendar.ics"
   * }
   *
   * Response:
   * {
   *   "valid": true,
   *   "calendarName": "My Calendar",
   *   "eventCount": 42
   * }
   */
  async validateIcsUrl(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      // Validate request body
      const validationResult = validateUrlSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid request body',
          details: validationResult.error.errors,
        });
        return;
      }

      const { url } = validationResult.data;

      logger.info('Validating ICS URL', { userId, url });

      // Validate URL
      const result = await icsService.validateIcsUrl(url);

      if (!result.valid) {
        res.status(400).json({
          valid: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        valid: true,
        calendarName: result.calendarName,
        eventCount: result.eventCount,
      });
    } catch (error) {
      logger.error('Failed to validate ICS URL', { error });
      next(error);
    }
  }

  /**
   * Connect ICS calendar
   * POST /api/calendars/ics/connect
   *
   * Request body:
   * {
   *   "url": "https://example.com/calendar.ics",
   *   "displayName": "My Calendar" // optional
   * }
   *
   * Response:
   * {
   *   "message": "ICS calendar connected successfully",
   *   "connection": {
   *     "id": "...",
   *     "calendarName": "My Calendar",
   *     "isReadOnly": true
   *   }
   * }
   */
  async connectIcsCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      // Validate request body
      const validationResult = connectIcsSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid request body',
          details: validationResult.error.errors,
        });
        return;
      }

      const { url, displayName } = validationResult.data;

      logger.info('Connecting ICS calendar', { userId, url });

      // Create connection
      const connection = await icsService.createIcsConnection(userId, url, displayName);

      // Trigger initial sync (asynchronous - don't wait)
      icsService.syncIcsEvents(connection.id).catch(error => {
        logger.error('Initial ICS sync failed', { connectionId: connection.id, error });
      });

      res.status(201).json({
        message: 'ICS calendar connected successfully',
        connection: {
          id: connection.id,
          provider: connection.provider,
          calendarName: connection.calendarName,
          calendarColor: connection.calendarColor,
          isReadOnly: connection.isReadOnly,
          isConnected: connection.isConnected,
          createdAt: connection.createdAt.toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Failed to connect ICS calendar', { error });

      // Handle specific errors
      if (error.message?.includes('already connected')) {
        res.status(409).json({
          error: 'Conflict',
          message: 'This ICS calendar is already connected',
        });
        return;
      }

      if (error.message?.includes('Invalid ICS URL')) {
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
   * Update ICS calendar
   * PUT /api/calendars/ics/:connectionId
   *
   * Request body:
   * {
   *   "url": "https://example.com/new-calendar.ics", // optional
   *   "displayName": "Updated Name" // optional
   * }
   *
   * Response:
   * {
   *   "message": "ICS calendar updated successfully",
   *   "connection": { ... }
   * }
   */
  async updateIcsCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      if (!connectionId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing connectionId',
        });
        return;
      }

      // Validate request body
      const validationResult = updateIcsSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid request body',
          details: validationResult.error.errors,
        });
        return;
      }

      const updates = validationResult.data;

      logger.info('Updating ICS calendar', { userId, connectionId, updates });

      // Update connection
      const connection = await icsService.updateIcsConnection(connectionId, userId, updates);

      // If URL changed, trigger sync
      if (updates.url) {
        icsService.syncIcsEvents(connection.id).catch(error => {
          logger.error('Post-update ICS sync failed', { connectionId: connection.id, error });
        });
      }

      res.status(200).json({
        message: 'ICS calendar updated successfully',
        connection: {
          id: connection.id,
          provider: connection.provider,
          calendarName: connection.calendarName,
          calendarColor: connection.calendarColor,
          isReadOnly: connection.isReadOnly,
          isConnected: connection.isConnected,
          lastSyncedAt: connection.lastSyncedAt?.toISOString() || null,
          updatedAt: connection.updatedAt.toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Failed to update ICS calendar', { error });

      if (error.message?.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          message: 'ICS calendar connection not found',
        });
        return;
      }

      if (error.message?.includes('Invalid ICS URL')) {
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
   * Delete ICS calendar
   * DELETE /api/calendars/ics/:connectionId
   *
   * Response:
   * {
   *   "message": "ICS calendar deleted successfully"
   * }
   */
  async deleteIcsCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      if (!connectionId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing connectionId',
        });
        return;
      }

      logger.info('Deleting ICS calendar', { userId, connectionId });

      // Delete connection
      await icsService.deleteIcsConnection(connectionId, userId);

      res.status(200).json({
        message: 'ICS calendar deleted successfully',
      });
    } catch (error: any) {
      logger.error('Failed to delete ICS calendar', { error });

      if (error.message?.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          message: 'ICS calendar connection not found',
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Manually sync ICS calendar
   * POST /api/calendars/ics/:connectionId/sync
   *
   * Response:
   * {
   *   "message": "ICS calendar synced successfully",
   *   "stats": {
   *     "eventsAdded": 5,
   *     "eventsUpdated": 10,
   *     "eventsDeleted": 2
   *   }
   * }
   */
  async syncIcsCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      if (!connectionId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing connectionId',
        });
        return;
      }

      logger.info('Manually syncing ICS calendar', { userId, connectionId });

      // Verify connection belongs to user
      const connection = await icsService.getIcsConnection(connectionId, userId);

      if (!connection) {
        res.status(404).json({
          error: 'Not Found',
          message: 'ICS calendar connection not found',
        });
        return;
      }

      // Sync events
      const result = await icsService.syncIcsEvents(connectionId);

      if (!result.success) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to sync ICS calendar',
          details: result.error,
        });
        return;
      }

      res.status(200).json({
        message: 'ICS calendar synced successfully',
        stats: {
          eventsAdded: result.eventsAdded,
          eventsUpdated: result.eventsUpdated,
          eventsDeleted: result.eventsDeleted,
        },
      });
    } catch (error: any) {
      logger.error('Failed to sync ICS calendar', { error });

      if (error.message?.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          message: 'ICS calendar connection not found',
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Get ICS calendar details
   * GET /api/calendars/ics/:connectionId
   *
   * Response:
   * {
   *   "connection": {
   *     "id": "...",
   *     "calendarName": "My Calendar",
   *     "url": "https://...",
   *     "lastSyncedAt": "..."
   *   }
   * }
   */
  async getIcsCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      if (!connectionId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing connectionId',
        });
        return;
      }

      // Get connection with decrypted URL
      const connection = await icsService.getIcsConnection(connectionId, userId);

      res.status(200).json({
        connection: {
          id: connection.id,
          provider: connection.provider,
          calendarName: connection.calendarName,
          calendarColor: connection.calendarColor,
          url: connection.icsUrl, // Decrypted URL
          isReadOnly: connection.isReadOnly,
          isConnected: connection.isConnected,
          lastSyncedAt: connection.lastSyncedAt?.toISOString() || null,
          createdAt: connection.createdAt.toISOString(),
          updatedAt: connection.updatedAt.toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Failed to get ICS calendar', { error });

      if (error.message?.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          message: 'ICS calendar connection not found',
        });
        return;
      }

      next(error);
    }
  }
}

export default new ICSController();
