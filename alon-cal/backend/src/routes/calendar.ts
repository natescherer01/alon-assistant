/**
 * Calendar Routes
 *
 * Defines routes for calendar management (list, disconnect, sync)
 */

import { Router } from 'express';
import calendarController from '../controllers/calendarController';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Get all connected calendars for authenticated user
 * GET /api/calendars
 * Requires authentication
 */
router.get('/', requireAuth, calendarController.getUserCalendars);

/**
 * Sync all connected calendars
 * POST /api/calendars/sync-all
 * Requires authentication
 */
router.post('/sync-all', requireAuth, calendarController.syncAllCalendars);

/**
 * Get calendar connection statistics
 * GET /api/calendars/stats
 * Requires authentication
 */
router.get('/stats', requireAuth, calendarController.getCalendarStats);

/**
 * Get specific calendar connection metadata
 * GET /api/calendars/:connectionId
 * Requires authentication
 */
router.get('/:connectionId', requireAuth, calendarController.getCalendarMetadata);

/**
 * Disconnect calendar (soft delete)
 * DELETE /api/calendars/:connectionId
 * Requires authentication
 */
router.delete('/:connectionId', requireAuth, calendarController.disconnectCalendar);

/**
 * Manually trigger calendar sync
 * POST /api/calendars/:connectionId/sync
 * Requires authentication
 */
router.post('/:connectionId/sync', requireAuth, calendarController.syncCalendar);

/**
 * Enable webhook for a calendar (Microsoft only)
 * POST /api/calendars/:connectionId/webhook
 * Requires authentication
 */
router.post('/:connectionId/webhook', requireAuth, calendarController.enableWebhook);

/**
 * Disable webhook for a calendar
 * DELETE /api/calendars/:connectionId/webhook
 * Requires authentication
 */
router.delete('/:connectionId/webhook', requireAuth, calendarController.disableWebhook);

export default router;
