/**
 * ICS Service
 *
 * Business logic for managing ICS (iCalendar subscription) calendar connections.
 * Handles URL validation, connection creation, event syncing, and encryption.
 *
 * Features:
 * - SSRF-protected URL validation
 * - Encrypted ICS URL storage
 * - ETag/Last-Modified caching
 * - Event synchronization
 * - Recurring event support (RRULE)
 * - Read-only calendar enforcement
 *
 * Security:
 * - All ICS URLs are encrypted before database storage
 * - SSRF protection prevents access to private IPs
 * - URL validation on every sync operation
 */

import { prisma } from '../lib/prisma';
import { CalendarProvider, EventStatus, SyncStatus } from '@prisma/client';
import { encryptToken, decryptToken } from '../utils/encryption';
import { validateIcsUrl } from '../utils/urlValidator';
import icsClient from '../integrations/ics/icsClient';
import auditService from './auditService';
import logger from '../utils/logger';
import crypto from 'crypto';
import { normalizeTimezone } from '../utils/timezone';

interface SyncResult {
  success: boolean;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  error?: string;
}

class ICSService {
  /**
   * Validate ICS URL and test feed
   *
   * @param url - ICS feed URL
   * @returns Validation result with calendar metadata
   *
   * @example
   * const result = await icsService.validateIcsUrl('https://example.com/calendar.ics');
   * if (result.valid) {
   *   console.log(`Calendar: ${result.calendarName}, Events: ${result.eventCount}`);
   * }
   */
  async validateIcsUrl(url: string): Promise<{
    valid: boolean;
    calendarName?: string;
    eventCount?: number;
    error?: string;
  }> {
    try {
      logger.info('Validating ICS URL', { url });

      // Step 1: URL validation (SSRF protection)
      const urlValidation = await validateIcsUrl(url);
      if (!urlValidation.valid) {
        return {
          valid: false,
          error: urlValidation.error,
        };
      }

      // Step 2: Fetch and parse feed
      const feedValidation = await icsClient.validateFeed(url);

      if (!feedValidation.valid) {
        return {
          valid: false,
          error: feedValidation.error || 'Failed to parse ICS feed',
        };
      }

      logger.info('ICS URL validation successful', {
        url,
        calendarName: feedValidation.calendarName,
        eventCount: feedValidation.eventCount,
      });

      return {
        valid: true,
        calendarName: feedValidation.calendarName,
        eventCount: feedValidation.eventCount,
      };
    } catch (error) {
      logger.error('ICS URL validation failed', { url, error });
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create ICS calendar connection
   *
   * @param userId - User ID
   * @param url - ICS feed URL
   * @param displayName - Optional custom display name
   * @returns Created calendar connection
   *
   * @throws Error if URL validation fails
   * @throws Error if connection already exists
   *
   * @example
   * const connection = await icsService.createIcsConnection(
   *   userId,
   *   'https://example.com/calendar.ics',
   *   'My Calendar'
   * );
   */
  async createIcsConnection(
    userId: string,
    url: string,
    displayName?: string
  ): Promise<any> {
    try {
      logger.info('Creating ICS connection', { userId, url });

      // Validate URL
      const validation = await this.validateIcsUrl(url);
      if (!validation.valid) {
        throw new Error(`Invalid ICS URL: ${validation.error}`);
      }

      // Generate calendar ID (hash of URL for uniqueness)
      const calendarId = this.generateCalendarId(url);

      // Check if connection already exists (including soft-deleted)
      const existingConnection = await prisma.calendarConnection.findFirst({
        where: {
          userId,
          provider: CalendarProvider.ICS,
          calendarId,
        },
      });

      if (existingConnection) {
        // If soft-deleted, restore it
        if (existingConnection.deletedAt) {
          const encryptedUrl = encryptToken(url);
          const calendarName = displayName || validation.calendarName || existingConnection.calendarName;

          const restoredConnection = await prisma.calendarConnection.update({
            where: { id: existingConnection.id },
            data: {
              deletedAt: null,
              isConnected: true,
              icsUrl: encryptedUrl,
              calendarName,
              updatedAt: new Date(),
            },
          });

          await auditService.logCalendarConnect(userId, restoredConnection.id, CalendarProvider.ICS);

          logger.info('ICS connection restored', {
            userId,
            connectionId: restoredConnection.id,
            calendarName,
          });

          return restoredConnection;
        }

        throw new Error('ICS calendar already connected');
      }

      // Encrypt ICS URL before storage
      const encryptedUrl = encryptToken(url);

      // Use validation result or custom display name
      const calendarName = displayName || validation.calendarName || 'ICS Calendar';

      // Create calendar connection
      const connection = await prisma.calendarConnection.create({
        data: {
          userId,
          provider: CalendarProvider.ICS,
          calendarId,
          calendarName,
          icsUrl: encryptedUrl,
          isReadOnly: true, // ICS calendars are always read-only
          isConnected: true,
          isPrimary: false,
          // OAuth fields are null for ICS
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        },
      });

      // Log audit event
      await auditService.logCalendarConnect(userId, connection.id, CalendarProvider.ICS);

      logger.info('ICS connection created', {
        userId,
        connectionId: connection.id,
        calendarName,
      });

      return connection;
    } catch (error) {
      logger.error('Failed to create ICS connection', { userId, url, error });
      throw error;
    }
  }

  /**
   * Update ICS calendar connection
   *
   * @param connectionId - Connection ID
   * @param userId - User ID (for authorization)
   * @param updates - Update data (url, displayName)
   * @returns Updated calendar connection
   *
   * @throws Error if connection not found
   * @throws Error if unauthorized
   * @throws Error if URL validation fails
   */
  async updateIcsConnection(
    connectionId: string,
    userId: string,
    updates: { url?: string; displayName?: string }
  ): Promise<any> {
    try {
      logger.info('Updating ICS connection', { connectionId, userId, updates });

      // Fetch connection
      const connection = await prisma.calendarConnection.findUnique({
        where: {
          id: connectionId,
          userId,
          provider: CalendarProvider.ICS,
          deletedAt: null,
        },
      });

      if (!connection) {
        throw new Error('ICS calendar connection not found');
      }

      const updateData: any = {};

      // Update URL if provided
      if (updates.url) {
        // Validate new URL
        const validation = await this.validateIcsUrl(updates.url);
        if (!validation.valid) {
          throw new Error(`Invalid ICS URL: ${validation.error}`);
        }

        // Encrypt new URL
        updateData.icsUrl = encryptToken(updates.url);

        // Update calendar ID (hash of new URL)
        updateData.calendarId = this.generateCalendarId(updates.url);

        // Reset ETag and Last-Modified when URL changes
        updateData.icsETag = null;
        updateData.icsLastModified = null;
      }

      // Update display name if provided
      if (updates.displayName) {
        updateData.calendarName = updates.displayName;
      }

      // Update connection
      const updatedConnection = await prisma.calendarConnection.update({
        where: { id: connectionId },
        data: updateData,
      });

      logger.info('ICS connection updated', { connectionId, userId });

      return updatedConnection;
    } catch (error) {
      logger.error('Failed to update ICS connection', { connectionId, userId, error });
      throw error;
    }
  }

  /**
   * Sync ICS events for a calendar connection
   *
   * @param connectionId - Connection ID
   * @returns Sync result with statistics
   *
   * @throws Error if connection not found
   * @throws Error if fetch/parse fails
   *
   * @example
   * const result = await icsService.syncIcsEvents(connectionId);
   * console.log(`Added: ${result.eventsAdded}, Updated: ${result.eventsUpdated}`);
   */
  async syncIcsEvents(connectionId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
    };

    try {
      logger.info('Starting ICS event sync', { connectionId });

      // Fetch connection
      const connection = await prisma.calendarConnection.findUnique({
        where: {
          id: connectionId,
          provider: CalendarProvider.ICS,
          deletedAt: null,
        },
      });

      if (!connection) {
        throw new Error('ICS calendar connection not found');
      }

      if (!connection.icsUrl) {
        throw new Error('ICS URL not configured');
      }

      // Decrypt ICS URL
      const url = decryptToken(connection.icsUrl);

      // Validate URL before fetching (SSRF protection)
      const validation = await validateIcsUrl(url);
      if (!validation.valid) {
        throw new Error(`URL validation failed: ${validation.error}`);
      }

      // Fetch ICS feed with caching headers
      const fetchResult = await icsClient.fetchFeed(url, {
        etag: connection.icsETag || undefined,
        lastModified: connection.icsLastModified || undefined,
      });

      // If not modified, skip sync
      if (!fetchResult.modified) {
        logger.debug('ICS feed not modified, skipping sync', { connectionId });
        result.success = true;
        return result;
      }

      // Parse events
      const parsedEvents = await icsClient.parseEvents(fetchResult.content!, connectionId);

      // Get existing events for this connection
      const existingEvents = await prisma.calendarEvent.findMany({
        where: {
          calendarConnectionId: connectionId,
          deletedAt: null,
        },
      });

      const existingEventMap = new Map(
        existingEvents.map(e => [e.providerEventId, e])
      );

      const processedUids = new Set<string>();

      // Process each parsed event
      for (const parsedEvent of parsedEvents) {
        processedUids.add(parsedEvent.uid);

        const existingEvent = existingEventMap.get(parsedEvent.uid);

        // Store the event timezone for reference
        // Note: node-ical already parses dates into correct UTC instants,
        // so we store dates as-is. The frontend handles display in user's timezone.
        const eventTimezone = parsedEvent.timezone || 'UTC';
        const normalizedEventTz = normalizeTimezone(eventTimezone);

        // Prepare event data - dates are stored as UTC (no conversion needed)
        // The frontend will display them in the user's preferred timezone
        const eventData = {
          title: parsedEvent.summary,
          description: parsedEvent.description,
          location: parsedEvent.location,
          startTime: parsedEvent.start,
          endTime: parsedEvent.end,
          isAllDay: parsedEvent.isAllDay,
          timezone: normalizedEventTz.timezone, // Store original event timezone for reference
          status: this.mapStatus(parsedEvent.status),
          syncStatus: SyncStatus.SYNCED,
          isRecurring: parsedEvent.isRecurring,
          recurrenceRule: parsedEvent.recurrenceRule,
          exceptionDates: parsedEvent.exceptionDates?.map(d => d.toISOString()).join(','),
          lastSyncedAt: new Date(),
        };

        if (existingEvent) {
          // Update existing event
          await prisma.calendarEvent.update({
            where: { id: existingEvent.id },
            data: {
              ...eventData,
              deletedAt: null,
            },
          });
          result.eventsUpdated++;
        } else {
          // Create new event
          await prisma.calendarEvent.create({
            data: {
              calendarConnectionId: connectionId,
              providerEventId: parsedEvent.uid,
              ...eventData,
            },
          });
          result.eventsAdded++;
        }
      }

      // Mark events that are no longer in the feed as deleted
      for (const existingEvent of existingEvents) {
        if (!processedUids.has(existingEvent.providerEventId)) {
          await prisma.calendarEvent.update({
            where: { id: existingEvent.id },
            data: {
              syncStatus: SyncStatus.DELETED,
              deletedAt: new Date(),
            },
          });
          result.eventsDeleted++;
        }
      }

      // Update connection with new ETag and Last-Modified
      await prisma.calendarConnection.update({
        where: { id: connectionId },
        data: {
          icsETag: fetchResult.etag,
          icsLastModified: fetchResult.lastModified,
          lastSyncedAt: new Date(),
        },
      });

      // Log audit event
      await auditService.logCalendarSync(
        connection.userId,
        connectionId,
        result.eventsAdded + result.eventsUpdated
      );

      result.success = true;

      logger.info('ICS event sync completed', {
        connectionId,
        ...result,
      });

      return result;
    } catch (error) {
      logger.error('ICS event sync failed', { connectionId, error });
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';

      // Log audit failure
      const connection = await prisma.calendarConnection.findUnique({
        where: { id: connectionId },
      });
      if (connection) {
        await auditService.logCalendarSyncFailure(
          connection.userId,
          connectionId,
          result.error
        );
      }

      return result;
    }
  }

  /**
   * Generate calendar ID from URL (SHA-256 hash)
   */
  private generateCalendarId(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex');
  }

  /**
   * Map ICS status to EventStatus enum
   */
  private mapStatus(status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'): EventStatus {
    switch (status) {
      case 'TENTATIVE':
        return EventStatus.TENTATIVE;
      case 'CANCELLED':
        return EventStatus.CANCELLED;
      default:
        return EventStatus.CONFIRMED;
    }
  }

  /**
   * Get ICS connection by ID (with decrypted URL)
   *
   * @param connectionId - Connection ID
   * @param userId - User ID (for authorization)
   * @returns Connection with decrypted URL
   */
  async getIcsConnection(connectionId: string, userId: string): Promise<any> {
    const connection = await prisma.calendarConnection.findUnique({
      where: {
        id: connectionId,
        userId,
        provider: CalendarProvider.ICS,
        deletedAt: null,
      },
    });

    if (!connection) {
      throw new Error('ICS calendar connection not found');
    }

    // Decrypt URL for display (be careful not to expose in logs)
    const decryptedUrl = connection.icsUrl ? decryptToken(connection.icsUrl) : null;

    return {
      ...connection,
      icsUrl: decryptedUrl,
    };
  }

  /**
   * Delete ICS connection
   *
   * @param connectionId - Connection ID
   * @param userId - User ID (for authorization)
   */
  async deleteIcsConnection(connectionId: string, userId: string): Promise<void> {
    try {
      const connection = await prisma.calendarConnection.findUnique({
        where: {
          id: connectionId,
          userId,
          provider: CalendarProvider.ICS,
          deletedAt: null,
        },
      });

      if (!connection) {
        throw new Error('ICS calendar connection not found');
      }

      // Soft delete connection
      await prisma.calendarConnection.update({
        where: { id: connectionId },
        data: {
          deletedAt: new Date(),
          isConnected: false,
        },
      });

      // Soft delete associated events
      await prisma.calendarEvent.updateMany({
        where: { calendarConnectionId: connectionId },
        data: {
          deletedAt: new Date(),
          syncStatus: SyncStatus.DELETED,
        },
      });

      logger.info('ICS connection deleted', { connectionId, userId });
    } catch (error) {
      logger.error('Failed to delete ICS connection', { connectionId, userId, error });
      throw error;
    }
  }
}

export default new ICSService();
