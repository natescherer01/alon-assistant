/**
 * OAuth Controller
 *
 * HTTP request handlers for OAuth 2.0 flows
 * Handles Google Calendar and Microsoft Outlook authentication
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import oauthService from '../services/oauthService';
import sessionService from '../services/sessionService';
import { getClientIp, getUserAgent } from '../middleware/auth';
import logger from '../utils/logger';

class OAuthController {
  // ============================================================================
  // GOOGLE OAUTH ENDPOINTS
  // ============================================================================

  /**
   * Initiate Google OAuth flow
   * GET /api/oauth/google/login
   *
   * Generates authorization URL and redirects user to Google consent screen
   */
  async initiateGoogleAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const { url, state } = await oauthService.getGoogleAuthUrl(userId);

      logger.info('Google OAuth flow initiated', { userId });

      // Return URL for frontend to redirect to
      res.status(200).json({
        authUrl: url,
        state,
        provider: 'GOOGLE',
      });
    } catch (error) {
      logger.error('Failed to initiate Google OAuth', { error });
      next(error);
    }
  }

  /**
   * Handle Google OAuth callback
   * GET /api/oauth/google/callback?code=...&state=...
   *
   * Exchanges authorization code for tokens and fetches available calendars
   */
  async handleGoogleCallback(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error } = req.query;

      // Handle OAuth errors (user denied permission)
      if (error) {
        logger.warn('Google OAuth error', { error });
        res.redirect(`${process.env.FRONTEND_URL}/calendars?error=${error}`);
        return;
      }

      if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing code or state parameter',
        });
        return;
      }

      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);

      // Handle callback and create session (server-side storage)
      const result = await oauthService.handleGoogleCallback(code, state, ipAddress, userAgent);

      // Redirect to frontend with ONLY sessionId (no sensitive data in URL)
      res.redirect(
        `${process.env.FRONTEND_URL}/oauth/google/callback?provider=google&session=${result.sessionId}`
      );
    } catch (error) {
      logger.error('Failed to handle Google OAuth callback', { error });
      res.redirect(`${process.env.FRONTEND_URL}/calendars?error=auth_failed`);
    }
  }

  /**
   * Select Google calendars to connect
   * POST /api/oauth/google/select
   *
   * Body: { sessionId: string, selectedCalendarIds: string[] }
   */
  async selectGoogleCalendars(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const { sessionId, selectedCalendarIds } = req.body;

      if (!sessionId || !selectedCalendarIds || !Array.isArray(selectedCalendarIds)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing sessionId or selectedCalendarIds',
        });
        return;
      }

      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);

      const connections = await oauthService.selectGoogleCalendars(
        userId,
        sessionId,
        selectedCalendarIds,
        ipAddress,
        userAgent
      );

      logger.info('Google calendars selected', { userId, count: connections.length });

      res.status(201).json({
        message: 'Calendars connected successfully',
        calendars: connections,
      });
    } catch (error) {
      logger.error('Failed to select Google calendars', { error });
      next(error);
    }
  }

  // ============================================================================
  // MICROSOFT OAUTH ENDPOINTS
  // ============================================================================

  /**
   * Initiate Microsoft OAuth flow
   * GET /api/oauth/microsoft/login
   *
   * Generates authorization URL and redirects user to Microsoft consent screen
   */
  async initiateMicrosoftAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const { url, state } = await oauthService.getMicrosoftAuthUrl(userId);

      logger.info('Microsoft OAuth flow initiated', { userId });

      // Return URL for frontend to redirect to
      res.status(200).json({
        authUrl: url,
        state,
        provider: 'MICROSOFT',
      });
    } catch (error) {
      logger.error('Failed to initiate Microsoft OAuth', { error });
      next(error);
    }
  }

  /**
   * Handle Microsoft OAuth callback
   * GET /api/oauth/microsoft/callback?code=...&state=...
   *
   * Exchanges authorization code for tokens and fetches available calendars
   */
  async handleMicrosoftCallback(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error } = req.query;

      // Handle OAuth errors
      if (error) {
        logger.warn('Microsoft OAuth error', { error });
        res.redirect(`${process.env.FRONTEND_URL}/calendars?error=${error}`);
        return;
      }

      if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing code or state parameter',
        });
        return;
      }

      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);

      // Handle callback and create session (server-side storage)
      const result = await oauthService.handleMicrosoftCallback(code, state, ipAddress, userAgent);

      // Redirect to frontend with ONLY sessionId (no sensitive data in URL)
      res.redirect(
        `${process.env.FRONTEND_URL}/oauth/microsoft/callback?provider=microsoft&session=${result.sessionId}`
      );
    } catch (error) {
      logger.error('Failed to handle Microsoft OAuth callback', { error });
      res.redirect(`${process.env.FRONTEND_URL}/calendars?error=auth_failed`);
    }
  }

  /**
   * Select Microsoft calendars to connect
   * POST /api/oauth/microsoft/select
   *
   * Body: { sessionId: string, selectedCalendarIds: string[] }
   */
  async selectMicrosoftCalendars(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const { sessionId, selectedCalendarIds } = req.body;

      if (!sessionId || !selectedCalendarIds || !Array.isArray(selectedCalendarIds)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing sessionId or selectedCalendarIds',
        });
        return;
      }

      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);

      const connections = await oauthService.selectMicrosoftCalendars(
        userId,
        sessionId,
        selectedCalendarIds,
        ipAddress,
        userAgent
      );

      logger.info('Microsoft calendars selected', { userId, count: connections.length });

      res.status(201).json({
        message: 'Calendars connected successfully',
        calendars: connections,
      });
    } catch (error) {
      logger.error('Failed to select Microsoft calendars', { error });
      next(error);
    }
  }

  // ============================================================================
  // SESSION ENDPOINT
  // ============================================================================

  /**
   * Get OAuth session data
   * GET /api/oauth/session/:sessionId
   *
   * Retrieves calendar list and provider info for calendar selection.
   * This endpoint does NOT consume the session (uses peek).
   * Session is consumed when calendars are selected.
   */
  async getSessionData(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { sessionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ error: 'Bad Request', message: 'Missing sessionId' });
        return;
      }

      // Peek at session without consuming it (validation only)
      const session = await sessionService.peekSession(sessionId);

      if (!session) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Session not found or expired. Please re-authenticate.',
        });
        return;
      }

      // Verify session belongs to authenticated user
      if (session.userId !== userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Session does not belong to this user',
        });
        return;
      }

      logger.debug('OAuth session data retrieved', {
        sessionId,
        userId,
        provider: session.provider,
        calendarCount: session.calendars.length,
      });

      // Return calendars and provider info (NO tokens in response)
      res.status(200).json({
        provider: session.provider,
        calendars: session.calendars,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      logger.error('Failed to get session data', { error });
      next(error);
    }
  }
}

export default new OAuthController();
