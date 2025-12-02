/**
 * ICS Routes
 *
 * HTTP routes for ICS calendar management
 *
 * All routes require authentication via requireAuth middleware
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import icsController from '../controllers/icsController';

const router = Router();

/**
 * POST /api/calendars/ics/validate
 * Validate an ICS URL before connecting
 *
 * Body: { url: string }
 * Returns: { valid: boolean, calendarName?: string, eventCount?: number, error?: string }
 */
router.post('/validate', requireAuth, icsController.validateIcsUrl);

/**
 * POST /api/calendars/ics/connect
 * Connect a new ICS calendar
 *
 * Body: { url: string, displayName?: string }
 * Returns: { message: string, connection: {...} }
 */
router.post('/connect', requireAuth, icsController.connectIcsCalendar);

/**
 * GET /api/calendars/ics/:connectionId
 * Get ICS calendar details
 *
 * Returns: { connection: {...} }
 */
router.get('/:connectionId', requireAuth, icsController.getIcsCalendar);

/**
 * PUT /api/calendars/ics/:connectionId
 * Update ICS calendar (URL or display name)
 *
 * Body: { url?: string, displayName?: string }
 * Returns: { message: string, connection: {...} }
 */
router.put('/:connectionId', requireAuth, icsController.updateIcsCalendar);

/**
 * DELETE /api/calendars/ics/:connectionId
 * Delete ICS calendar connection
 *
 * Returns: { message: string }
 */
router.delete('/:connectionId', requireAuth, icsController.deleteIcsCalendar);

/**
 * POST /api/calendars/ics/:connectionId/sync
 * Manually trigger ICS calendar sync
 *
 * Returns: { message: string, stats: {...} }
 */
router.post('/:connectionId/sync', requireAuth, icsController.syncIcsCalendar);

export default router;
