/**
 * Events Routes
 *
 * API routes for calendar event management
 * All routes require authentication
 */

import { Router } from 'express';
import eventController from '../controllers/eventController';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Create a new event
 * POST /api/events
 *
 * Request Body: CreateEventRequest (see validator schema)
 *
 * Returns:
 * - 201: Event created and synced successfully
 * - 202: Event created locally but sync pending/failed
 * - 400: Validation error
 * - 401: Unauthorized
 * - 404: Calendar connection not found
 * - 409: Google Calendar API conflict
 * - 500: Internal server error
 */
router.post('/', requireAuth, async (req, res, next) => {
  await eventController.createEvent(req, res, next);
});

/**
 * Get events within a date range
 * GET /api/events?start=2024-01-01T00:00:00Z&end=2024-01-31T23:59:59Z
 *
 * Query Parameters:
 * - start: ISO date string (required)
 * - end: ISO date string (required)
 *
 * Returns:
 * - 200: Array of events from all connected calendars
 * - 400: Invalid query parameters
 * - 401: Unauthorized
 */
router.get('/', requireAuth, async (req, res, next) => {
  await eventController.getEvents(req, res, next);
});

/**
 * Get upcoming events
 * GET /api/events/upcoming?limit=10
 *
 * Query Parameters:
 * - limit: Number of events to return (default: 10, max: 100)
 *
 * Returns:
 * - 200: Array of upcoming events
 * - 400: Invalid limit
 * - 401: Unauthorized
 */
router.get('/upcoming', requireAuth, async (req, res, next) => {
  await eventController.getUpcomingEvents(req, res, next);
});

/**
 * Sync all calendars for the user
 * POST /api/events/sync
 *
 * Triggers sync for all connected calendars
 *
 * Returns:
 * - 200: Sync statistics
 * - 401: Unauthorized
 */
router.post('/sync', requireAuth, async (req, res, next) => {
  await eventController.syncAllCalendars(req, res, next);
});

/**
 * Retry syncing a failed event
 * POST /api/events/:eventId/retry-sync
 *
 * Returns:
 * - 200: Event synced successfully
 * - 400: Event is already synced
 * - 404: Event not found
 * - 401: Unauthorized
 */
router.post('/:eventId/retry-sync', requireAuth, async (req, res, next) => {
  await eventController.retrySyncEvent(req, res, next);
});

/**
 * Get event by ID
 * GET /api/events/:eventId
 *
 * Returns:
 * - 200: Event details
 * - 404: Event not found
 * - 401: Unauthorized
 */
router.get('/:eventId', requireAuth, async (req, res, next) => {
  await eventController.getEventById(req, res, next);
});

/**
 * Update an existing event
 * PUT /api/events/:eventId
 *
 * Request Body: Partial<CreateEventRequest> (see validator schema)
 *
 * Returns:
 * - 200: Event updated and synced successfully
 * - 202: Event updated locally but sync pending/failed
 * - 400: Validation error or read-only calendar
 * - 401: Unauthorized
 * - 403: Cannot modify read-only calendar
 * - 404: Event not found
 * - 500: Internal server error
 */
router.put('/:eventId', requireAuth, async (req, res, next) => {
  await eventController.updateEvent(req, res, next);
});

/**
 * Delete an event
 * DELETE /api/events/:eventId
 *
 * Returns:
 * - 200: Event deleted successfully (soft deleted)
 * - 400: Read-only calendar
 * - 401: Unauthorized
 * - 403: Cannot modify read-only calendar
 * - 404: Event not found
 * - 500: Internal server error
 */
router.delete('/:eventId', requireAuth, async (req, res, next) => {
  await eventController.deleteEvent(req, res, next);
});

export default router;
