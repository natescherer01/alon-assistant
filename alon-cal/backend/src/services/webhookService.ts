/**
 * Webhook Service
 *
 * Manages webhook subscriptions and processes change notifications
 * Handles Microsoft Graph subscription lifecycle (create, renew, delete)
 */

import { prisma } from '../lib/prisma';
import { CalendarProvider } from '@prisma/client';
import { MicrosoftCalendarClient } from '../integrations/microsoft';
import eventSyncService from './eventSyncService';
import tokenRefreshService from './tokenRefreshService';
import logger from '../utils/logger';
import crypto from 'crypto';

interface MicrosoftNotification {
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  changeType: string;
  resource: string;
  resourceData?: {
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag': string;
    id: string;
  };
  clientState?: string;
  tenantId: string;
}

class WebhookService {
  private microsoftClient: MicrosoftCalendarClient;

  constructor() {
    this.microsoftClient = new MicrosoftCalendarClient();
  }

  /**
   * Create webhook subscription for a calendar connection
   *
   * @param connectionId - Calendar connection ID
   * @param userId - User ID (for authorization)
   * @returns Subscription details
   */
  async createSubscription(connectionId: string, userId: string): Promise<any> {
    try {
      const connection = await prisma.calendarConnection.findUnique({
        where: { id: connectionId, userId, deletedAt: null },
      });

      if (!connection) {
        throw new Error('Calendar connection not found');
      }

      if (connection.provider !== CalendarProvider.MICROSOFT) {
        throw new Error('Webhooks only supported for Microsoft calendars');
      }

      // Check if subscription already exists
      const existingSubscription = await prisma.webhookSubscription.findFirst({
        where: {
          calendarConnectionId: connectionId,
          provider: CalendarProvider.MICROSOFT,
          isActive: true,
        },
      });

      if (existingSubscription) {
        logger.info('Webhook subscription already exists', {
          connectionId,
          subscriptionId: existingSubscription.subscriptionId,
        });
        return existingSubscription;
      }

      // Get valid access token
      const accessToken = await tokenRefreshService.checkAndRefreshToken(connectionId, userId);

      // Generate webhook URL
      const webhookUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/webhooks/microsoft/events`;

      // Generate client state for validation
      const clientState = crypto.randomBytes(16).toString('hex');

      // Create subscription via Microsoft Graph
      const subscription = await this.microsoftClient.subscribeToCalendar(
        accessToken,
        connection.calendarId,
        webhookUrl,
        clientState
      );

      // Store subscription in database
      const dbSubscription = await prisma.webhookSubscription.create({
        data: {
          calendarConnectionId: connectionId,
          provider: CalendarProvider.MICROSOFT,
          subscriptionId: subscription.id,
          resourcePath: subscription.resource,
          expirationDateTime: new Date(subscription.expirationDateTime),
          clientState,
          notificationUrl: webhookUrl,
          isActive: true,
        },
      });

      logger.info('Webhook subscription created', {
        connectionId,
        subscriptionId: subscription.id,
        expiresAt: subscription.expirationDateTime,
      });

      return dbSubscription;
    } catch (error) {
      logger.error('Failed to create webhook subscription', { connectionId, error });
      throw new Error(
        `Failed to create webhook subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Renew webhook subscription before it expires
   * Should be called 24 hours before expiration
   *
   * @param subscriptionId - Database subscription ID
   * @returns Updated subscription
   */
  async renewSubscription(subscriptionId: string): Promise<any> {
    try {
      const subscription = await prisma.webhookSubscription.findUnique({
        where: { id: subscriptionId },
        include: { calendarConnection: true },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (!subscription.isActive) {
        throw new Error('Subscription is not active');
      }

      const connection = subscription.calendarConnection;

      // Get valid access token
      const accessToken = await tokenRefreshService.checkAndRefreshToken(
        connection.id,
        connection.userId
      );

      try {
        // Renew subscription via Microsoft Graph
        const renewed = await this.microsoftClient.renewSubscription(
          accessToken,
          subscription.subscriptionId
        );

        // Update database
        const updated = await prisma.webhookSubscription.update({
          where: { id: subscriptionId },
          data: {
            expirationDateTime: new Date(renewed.expirationDateTime),
            updatedAt: new Date(),
          },
        });

        logger.info('Webhook subscription renewed', {
          subscriptionId: subscription.subscriptionId,
          expiresAt: renewed.expirationDateTime,
        });

        return updated;
      } catch (error: any) {
        if (error.message === 'SUBSCRIPTION_NOT_FOUND') {
          // Subscription was deleted on Microsoft side, mark as inactive
          await prisma.webhookSubscription.update({
            where: { id: subscriptionId },
            data: { isActive: false },
          });

          logger.warn('Subscription not found on Microsoft, marked as inactive', {
            subscriptionId: subscription.subscriptionId,
          });

          throw new Error('Subscription not found on provider');
        }
        throw error;
      }
    } catch (error) {
      logger.error('Failed to renew webhook subscription', { subscriptionId, error });
      throw new Error(
        `Failed to renew subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete webhook subscription
   *
   * @param connectionId - Calendar connection ID
   * @param userId - User ID (for authorization)
   */
  async deleteSubscription(connectionId: string, userId: string): Promise<void> {
    try {
      const subscription = await prisma.webhookSubscription.findFirst({
        where: {
          calendarConnectionId: connectionId,
          isActive: true,
        },
        include: { calendarConnection: true },
      });

      if (!subscription) {
        logger.debug('No active subscription to delete', { connectionId });
        return;
      }

      // Verify ownership
      if (subscription.calendarConnection.userId !== userId) {
        throw new Error('Unauthorized: Subscription does not belong to this user');
      }

      // Get valid access token
      const accessToken = await tokenRefreshService.checkAndRefreshToken(connectionId, userId);

      // Delete from Microsoft Graph
      await this.microsoftClient.deleteSubscription(accessToken, subscription.subscriptionId);

      // Mark as inactive in database
      await prisma.webhookSubscription.update({
        where: { id: subscription.id },
        data: { isActive: false },
      });

      logger.info('Webhook subscription deleted', {
        connectionId,
        subscriptionId: subscription.subscriptionId,
      });
    } catch (error) {
      logger.error('Failed to delete webhook subscription', { connectionId, error });
      throw new Error(
        `Failed to delete subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process Microsoft Graph change notifications
   * Triggered when calendar events change
   *
   * @param notifications - Array of Microsoft notifications
   */
  async processMicrosoftNotifications(notifications: MicrosoftNotification[]): Promise<void> {
    for (const notification of notifications) {
      try {
        logger.debug('Processing Microsoft notification', {
          subscriptionId: notification.subscriptionId,
          changeType: notification.changeType,
        });

        // Find subscription in database
        const subscription = await prisma.webhookSubscription.findFirst({
          where: {
            subscriptionId: notification.subscriptionId,
            provider: CalendarProvider.MICROSOFT,
            isActive: true,
          },
          include: { calendarConnection: true },
        });

        if (!subscription) {
          logger.warn('Received notification for unknown subscription', {
            subscriptionId: notification.subscriptionId,
          });
          continue;
        }

        // Validate client state if provided
        if (notification.clientState && notification.clientState !== subscription.clientState) {
          logger.warn('Invalid client state in notification', {
            subscriptionId: notification.subscriptionId,
          });
          continue;
        }

        // Update last notification timestamp
        await prisma.webhookSubscription.update({
          where: { id: subscription.id },
          data: { lastNotificationAt: new Date() },
        });

        // Trigger incremental sync for the calendar
        logger.info('Triggering incremental sync from webhook', {
          connectionId: subscription.calendarConnectionId,
          changeType: notification.changeType,
        });

        await eventSyncService.syncCalendarEvents(
          subscription.calendarConnectionId,
          subscription.calendarConnection.userId
        );

        logger.debug('Successfully processed notification', {
          subscriptionId: notification.subscriptionId,
        });
      } catch (error) {
        logger.error('Failed to process notification', {
          subscriptionId: notification.subscriptionId,
          error,
        });
        // Continue processing other notifications
      }
    }
  }

  /**
   * Renew expiring subscriptions
   * Should be run periodically (e.g., every 12 hours)
   * Renews subscriptions expiring within 24 hours
   */
  async renewExpiringSubscriptions(): Promise<void> {
    try {
      const expirationThreshold = new Date();
      expirationThreshold.setHours(expirationThreshold.getHours() + 24);

      const expiringSubscriptions = await prisma.webhookSubscription.findMany({
        where: {
          isActive: true,
          provider: CalendarProvider.MICROSOFT,
          expirationDateTime: {
            lte: expirationThreshold,
          },
        },
      });

      logger.info(`Found ${expiringSubscriptions.length} subscriptions expiring within 24 hours`);

      for (const subscription of expiringSubscriptions) {
        try {
          await this.renewSubscription(subscription.id);
        } catch (error) {
          logger.error('Failed to renew expiring subscription', {
            subscriptionId: subscription.id,
            error,
          });
          // Continue with other subscriptions
        }
      }
    } catch (error) {
      logger.error('Failed to renew expiring subscriptions', { error });
    }
  }

  /**
   * Cleanup expired subscriptions
   * Marks subscriptions as inactive if they've expired
   */
  async cleanupExpiredSubscriptions(): Promise<void> {
    try {
      const now = new Date();

      const result = await prisma.webhookSubscription.updateMany({
        where: {
          isActive: true,
          expirationDateTime: {
            lt: now,
          },
        },
        data: {
          isActive: false,
        },
      });

      if (result.count > 0) {
        logger.info(`Marked ${result.count} expired subscriptions as inactive`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired subscriptions', { error });
    }
  }
}

export default new WebhookService();
