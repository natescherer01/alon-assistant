/**
 * Background Jobs Service
 *
 * Manages recurring background tasks:
 * - Renewing Microsoft Graph webhook subscriptions
 * - Cleaning up expired subscriptions
 * - Periodic calendar syncs
 * - ICS calendar polling
 */

import webhookService from './webhookService';
import icsSyncJob from '../jobs/icsSyncJob';
import logger from '../utils/logger';

class BackgroundJobsService {
  private renewalIntervalId?: NodeJS.Timeout;
  private cleanupIntervalId?: NodeJS.Timeout;

  /**
   * Start all background jobs
   */
  startAll(): void {
    logger.info('Starting background jobs');

    // Renew expiring subscriptions every 12 hours
    // Microsoft Graph subscriptions max out at 3 days
    this.startSubscriptionRenewal();

    // Cleanup expired subscriptions every hour
    this.startSubscriptionCleanup();

    // Start ICS calendar polling
    icsSyncJob.start();
  }

  /**
   * Stop all background jobs
   */
  stopAll(): void {
    logger.info('Stopping background jobs');

    if (this.renewalIntervalId) {
      clearInterval(this.renewalIntervalId);
      this.renewalIntervalId = undefined;
    }

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }

    // Stop ICS sync job
    icsSyncJob.stop();
  }

  /**
   * Start subscription renewal job
   * Runs every 12 hours to renew subscriptions expiring within 24 hours
   */
  private startSubscriptionRenewal(): void {
    // Run immediately on startup
    this.renewSubscriptions();

    // Then run every 12 hours
    const intervalMs = 12 * 60 * 60 * 1000; // 12 hours
    this.renewalIntervalId = setInterval(() => {
      this.renewSubscriptions();
    }, intervalMs);

    logger.info('Subscription renewal job started (runs every 12 hours)');
  }

  /**
   * Start subscription cleanup job
   * Runs every hour to mark expired subscriptions as inactive
   */
  private startSubscriptionCleanup(): void {
    // Run immediately on startup
    this.cleanupSubscriptions();

    // Then run every hour
    const intervalMs = 60 * 60 * 1000; // 1 hour
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupSubscriptions();
    }, intervalMs);

    logger.info('Subscription cleanup job started (runs every hour)');
  }

  /**
   * Execute subscription renewal
   */
  private async renewSubscriptions(): Promise<void> {
    try {
      logger.info('Running subscription renewal job');
      await webhookService.renewExpiringSubscriptions();
      logger.info('Subscription renewal job completed');
    } catch (error) {
      logger.error('Subscription renewal job failed', { error });
    }
  }

  /**
   * Execute subscription cleanup
   */
  private async cleanupSubscriptions(): Promise<void> {
    try {
      logger.debug('Running subscription cleanup job');
      await webhookService.cleanupExpiredSubscriptions();
      logger.debug('Subscription cleanup job completed');
    } catch (error) {
      logger.error('Subscription cleanup job failed', { error });
    }
  }
}

export default new BackgroundJobsService();
