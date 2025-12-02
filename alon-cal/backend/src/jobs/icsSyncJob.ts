/**
 * ICS Sync Background Job
 *
 * Periodically polls ICS calendar feeds to sync events.
 * Runs every 15 minutes (configurable via environment variable).
 *
 * Features:
 * - Automatic polling of all connected ICS calendars
 * - Staggered sync to avoid thundering herd problem
 * - Error handling and logging
 * - Configurable sync interval
 *
 * Environment Variables:
 * - ICS_SYNC_INTERVAL_MINUTES: Sync interval in minutes (default: 15)
 */

import { prisma } from '../lib/prisma';
import { CalendarProvider } from '@prisma/client';
import icsService from '../services/icsService';
import logger from '../utils/logger';

class ICSSyncJob {
  private intervalId?: NodeJS.Timeout;
  private syncIntervalMs: number;
  private isRunning: boolean = false;

  constructor() {
    // Default: 15 minutes
    const intervalMinutes = parseInt(process.env.ICS_SYNC_INTERVAL_MINUTES || '15', 10);
    this.syncIntervalMs = intervalMinutes * 60 * 1000;
  }

  /**
   * Start the ICS sync job
   *
   * Polls ICS calendars at configured interval
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('ICS sync job already running');
      return;
    }

    logger.info('Starting ICS sync job', {
      intervalMinutes: this.syncIntervalMs / 60000,
    });

    // Run immediately on startup
    this.syncAllIcsCalendars();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.syncAllIcsCalendars();
    }, this.syncIntervalMs);
  }

  /**
   * Stop the ICS sync job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('ICS sync job stopped');
    }
  }

  /**
   * Sync all ICS calendars
   *
   * Fetches all connected ICS calendars and syncs them with staggering
   */
  private async syncAllIcsCalendars(): Promise<void> {
    if (this.isRunning) {
      logger.warn('ICS sync job already running, skipping this cycle');
      return;
    }

    this.isRunning = true;

    try {
      logger.debug('Starting ICS sync cycle');

      // Fetch all connected ICS calendars
      const icsConnections = await prisma.calendarConnection.findMany({
        where: {
          provider: CalendarProvider.ICS,
          isConnected: true,
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          calendarName: true,
          lastSyncedAt: true,
        },
      });

      if (icsConnections.length === 0) {
        logger.debug('No ICS calendars to sync');
        return;
      }

      logger.info(`Starting sync for ${icsConnections.length} ICS calendars`);

      // Calculate stagger delay (spread syncs over 1 minute to avoid thundering herd)
      const staggerDelayMs = Math.min(60000 / icsConnections.length, 5000); // Max 5s per calendar

      let successCount = 0;
      let failureCount = 0;

      // Sync each calendar with staggering
      for (let i = 0; i < icsConnections.length; i++) {
        const connection = icsConnections[i];

        try {
          // Wait for stagger delay (except for first calendar)
          if (i > 0) {
            await this.sleep(staggerDelayMs);
          }

          logger.debug('Syncing ICS calendar', {
            connectionId: connection.id,
            calendarName: connection.calendarName,
          });

          // Sync events
          const result = await icsService.syncIcsEvents(connection.id);

          if (result.success) {
            successCount++;
            logger.debug('ICS calendar synced', {
              connectionId: connection.id,
              calendarName: connection.calendarName,
              eventsAdded: result.eventsAdded,
              eventsUpdated: result.eventsUpdated,
              eventsDeleted: result.eventsDeleted,
            });
          } else {
            failureCount++;
            logger.error('ICS calendar sync failed', {
              connectionId: connection.id,
              calendarName: connection.calendarName,
              error: result.error,
            });
          }
        } catch (error) {
          failureCount++;
          logger.error('ICS calendar sync error', {
            connectionId: connection.id,
            calendarName: connection.calendarName,
            error,
          });
        }
      }

      logger.info('ICS sync cycle completed', {
        total: icsConnections.length,
        success: successCount,
        failed: failureCount,
      });
    } catch (error) {
      logger.error('ICS sync job error', { error });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sleep for a specified duration
   *
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manually trigger a sync cycle (for testing)
   */
  async triggerSync(): Promise<void> {
    logger.info('Manually triggering ICS sync cycle');
    await this.syncAllIcsCalendars();
  }

  /**
   * Get job status
   */
  getStatus(): {
    running: boolean;
    intervalMs: number;
    intervalMinutes: number;
    isSyncing: boolean;
  } {
    return {
      running: !!this.intervalId,
      intervalMs: this.syncIntervalMs,
      intervalMinutes: this.syncIntervalMs / 60000,
      isSyncing: this.isRunning,
    };
  }
}

export default new ICSSyncJob();
