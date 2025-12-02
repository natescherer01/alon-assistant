/**
 * OAuth Routes
 *
 * Defines routes for Google Calendar, Microsoft Outlook, and Apple Calendar OAuth flows
 */

import { Router } from 'express';
import oauthController from '../controllers/oauthController';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

// ============================================================================
// GOOGLE OAUTH ROUTES
// ============================================================================

/**
 * Initiate Google OAuth flow
 * GET /api/oauth/google/login
 * Requires authentication
 */
router.get('/google/login', requireAuth, oauthController.initiateGoogleAuth);

/**
 * Google OAuth callback
 * GET /api/oauth/google/callback?code=...&state=...
 * Called by Google after user authorizes
 * Does not require auth (state parameter validates user)
 */
router.get('/google/callback', oauthController.handleGoogleCallback);

/**
 * Select Google calendars to connect
 * POST /api/oauth/google/select
 * Body: { code: string, selectedCalendarIds: string[] }
 * Requires authentication
 */
router.post('/google/select', requireAuth, oauthController.selectGoogleCalendars);

// ============================================================================
// MICROSOFT OAUTH ROUTES
// ============================================================================

/**
 * Initiate Microsoft OAuth flow
 * GET /api/oauth/microsoft/login
 * Requires authentication
 */
router.get('/microsoft/login', requireAuth, oauthController.initiateMicrosoftAuth);

/**
 * Microsoft OAuth callback
 * GET /api/oauth/microsoft/callback?code=...&state=...
 * Called by Microsoft after user authorizes
 * Does not require auth (state parameter validates user)
 */
router.get('/microsoft/callback', oauthController.handleMicrosoftCallback);

/**
 * Select Microsoft calendars to connect
 * POST /api/oauth/microsoft/select
 * Body: { code: string, selectedCalendarIds: string[] }
 * Requires authentication
 */
router.post('/microsoft/select', requireAuth, oauthController.selectMicrosoftCalendars);

// ============================================================================
// SESSION ENDPOINT
// ============================================================================

/**
 * Get OAuth session data
 * GET /api/oauth/session/:sessionId
 * Retrieves calendar list for selection after OAuth callback
 * Requires authentication
 */
router.get('/session/:sessionId', requireAuth, oauthController.getSessionData);

export default router;
