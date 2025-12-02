/**
 * Webhook Controller
 *
 * HTTP request handlers for calendar provider webhooks
 * Handles Microsoft Graph change notifications
 */

import { Request, Response, NextFunction } from 'express';
import webhookService from '../services/webhookService';
import logger from '../utils/logger';

class WebhookController {
  /**
   * Handle Microsoft Graph webhook notifications
   * POST /api/webhooks/microsoft/events
   *
   * Microsoft sends two types of requests:
   * 1. Validation handshake (validationToken query param)
   * 2. Change notifications (array of notifications in body)
   */
  async handleMicrosoftWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Step 1: Handle validation handshake
      // Microsoft sends this when creating a subscription
      const validationToken = req.query.validationToken as string;

      if (validationToken) {
        logger.info('Microsoft webhook validation request received');

        // Respond with validation token in plain text
        res.status(200).type('text/plain').send(validationToken);
        return;
      }

      // Step 2: Handle change notifications
      const { value } = req.body;

      if (!value || !Array.isArray(value)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid notification payload',
        });
        return;
      }

      logger.info(`Received ${value.length} Microsoft webhook notifications`);

      // Process notifications asynchronously (don't block response)
      webhookService.processMicrosoftNotifications(value).catch((error) => {
        logger.error('Failed to process Microsoft notifications', { error });
      });

      // Respond immediately with 202 Accepted
      // Microsoft requires response within 3 seconds
      res.status(202).json({ message: 'Notifications accepted for processing' });
    } catch (error) {
      logger.error('Failed to handle Microsoft webhook', { error });
      next(error);
    }
  }

  /**
   * Handle Google Calendar webhook notifications (future implementation)
   * POST /api/webhooks/google/events
   *
   * Google Calendar uses Push Notifications via Cloud Pub/Sub
   */
  async handleGoogleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('Google webhook notification received');

      // TODO: Implement Google webhook handling
      // Google uses X-Goog-Channel-ID and X-Goog-Resource-State headers
      // Resource state can be: 'sync', 'exists', 'not_exists'

      res.status(200).json({ message: 'Google webhook received' });
    } catch (error) {
      logger.error('Failed to handle Google webhook', { error });
      next(error);
    }
  }
}

export default new WebhookController();
