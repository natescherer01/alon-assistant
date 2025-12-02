/**
 * Webhook Routes
 *
 * Handles incoming webhook notifications from calendar providers
 * Microsoft Graph subscriptions send change notifications here
 */

import { Router } from 'express';
import webhookController from '../controllers/webhookController';

const router = Router();

/**
 * Microsoft Graph webhook endpoint
 * POST /api/webhooks/microsoft/events
 *
 * Receives change notifications from Microsoft Graph subscriptions
 * Handles validation handshake and change notifications
 */
router.post('/microsoft/events', webhookController.handleMicrosoftWebhook);

/**
 * Google Calendar webhook endpoint (for future implementation)
 * POST /api/webhooks/google/events
 *
 * Google uses push notifications via Cloud Pub/Sub
 */
router.post('/google/events', webhookController.handleGoogleWebhook);

export default router;
