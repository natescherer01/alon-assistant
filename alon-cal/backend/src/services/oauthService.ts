/**
 * OAuth Service
 *
 * Main service for handling OAuth 2.0 flows for Google Calendar and Microsoft Outlook
 * Manages authorization, token exchange, calendar fetching, and connection management
 */

import { prisma } from '../lib/prisma';
import { CalendarProvider } from '@prisma/client';
import { GoogleCalendarClient, GoogleCalendar } from '../integrations/google';
import { MicrosoftCalendarClient, MicrosoftCalendar } from '../integrations/microsoft';
import { encryptToken, decryptToken } from '../utils/encryption';
import stateService from './stateService';
import sessionService from './sessionService';
import auditService from './auditService';
import eventSyncService from './eventSyncService';
import logger from '../utils/logger';

export interface CalendarConnectionData {
  id: string;
  provider: CalendarProvider;
  calendarId: string;
  calendarName: string;
  calendarColor?: string;
  isPrimary: boolean;
  isConnected: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class OAuthService {
  private googleClient: GoogleCalendarClient;
  private microsoftClient: MicrosoftCalendarClient;

  constructor() {
    this.googleClient = new GoogleCalendarClient();
    this.microsoftClient = new MicrosoftCalendarClient();
  }

  // ============================================================================
  // GOOGLE OAUTH
  // ============================================================================

  /**
   * Get Google OAuth authorization URL
   *
   * @param userId - User ID initiating OAuth flow
   * @returns Authorization URL for user to visit
   */
  async getGoogleAuthUrl(userId: string): Promise<{ url: string; state: string }> {
    try {
      const state = await stateService.createState(userId, 'GOOGLE');
      const url = this.googleClient.getAuthUrl(state);

      logger.info('Generated Google OAuth URL', { userId });

      return { url, state };
    } catch (error) {
      logger.error('Failed to generate Google OAuth URL', { userId, error });
      throw new Error(
        `Failed to generate Google OAuth URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle Google OAuth callback and fetch calendars
   *
   * @param code - Authorization code from Google
   * @param state - State parameter for CSRF protection
   * @param ipAddress - User's IP address
   * @param userAgent - User's user agent
   * @returns Session ID for retrieving calendar selection data
   */
  async handleGoogleCallback(
    code: string,
    state: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ sessionId: string; userId: string }> {
    try {
      // Validate state
      const stateValidation = await stateService.validateState(state, undefined, 'GOOGLE');
      if (!stateValidation.valid || !stateValidation.userId) {
        throw new Error('Invalid or expired state parameter');
      }

      const userId = stateValidation.userId;

      // Delete state token (single-use)
      await stateService.deleteState(state);

      // Exchange code for tokens (SINGLE USE - code is now consumed)
      const tokens = await this.googleClient.getTokens(code);

      // Fetch available calendars
      const calendars = await this.googleClient.listCalendars(tokens.accessToken);

      // Store tokens and calendars in session (server-side, single-use)
      const sessionId = await sessionService.createSession({
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
        calendars,
        userId,
        provider: CalendarProvider.GOOGLE,
      });

      logger.info('Google OAuth callback handled successfully', {
        userId,
        sessionId,
        calendarCount: calendars.length,
      });

      return { sessionId, userId };
    } catch (error) {
      logger.error('Failed to handle Google OAuth callback', { error });
      throw new Error(
        `Failed to handle Google OAuth callback: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create calendar connections for selected Google calendars
   *
   * @param userId - User ID
   * @param sessionId - Session ID from OAuth callback (single-use)
   * @param selectedCalendarIds - Array of calendar IDs to connect
   * @param ipAddress - User's IP address
   * @param userAgent - User's user agent
   * @returns Created calendar connections
   */
  async selectGoogleCalendars(
    userId: string,
    sessionId: string,
    selectedCalendarIds: string[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<CalendarConnectionData[]> {
    try {
      // Retrieve session data (SINGLE-USE - session is deleted after retrieval)
      const session = await sessionService.getSession(sessionId);

      if (!session) {
        throw new Error('Invalid or expired session. Please re-authenticate.');
      }

      // Verify session belongs to the requesting user
      if (session.userId !== userId) {
        throw new Error('Session does not belong to this user');
      }

      // Verify provider matches
      if (session.provider !== CalendarProvider.GOOGLE) {
        throw new Error('Session provider mismatch');
      }

      // Validate selected calendar IDs against available calendars
      const availableCalendarIds = session.calendars.map((cal: GoogleCalendar) => cal.id);
      const invalidIds = selectedCalendarIds.filter((id) => !availableCalendarIds.includes(id));

      if (invalidIds.length > 0) {
        throw new Error(`Invalid calendar IDs: ${invalidIds.join(', ')}`);
      }

      // Filter selected calendars from session data
      const selectedCalendars = session.calendars.filter((cal: GoogleCalendar) =>
        selectedCalendarIds.includes(cal.id)
      );

      if (selectedCalendars.length === 0) {
        throw new Error('No valid calendars selected');
      }

      const tokens = session.tokens;
      const connections: CalendarConnectionData[] = [];
      const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

      // Create connections for each selected calendar
      for (const calendar of selectedCalendars) {
        try {
          const connection = await prisma.calendarConnection.upsert({
            where: {
              unique_user_calendar: {
                userId,
                provider: CalendarProvider.GOOGLE,
                calendarId: calendar.id,
              },
            },
            update: {
              accessToken: encryptToken(tokens.accessToken),
              refreshToken: encryptToken(tokens.refreshToken),
              tokenExpiresAt,
              calendarName: calendar.name,
              calendarColor: calendar.backgroundColor,
              isPrimary: calendar.isPrimary,
              isConnected: true,
              deletedAt: null, // Restore if previously deleted
            },
            create: {
              userId,
              provider: CalendarProvider.GOOGLE,
              calendarId: calendar.id,
              calendarName: calendar.name,
              accessToken: encryptToken(tokens.accessToken),
              refreshToken: encryptToken(tokens.refreshToken),
              tokenExpiresAt,
              calendarColor: calendar.backgroundColor,
              isPrimary: calendar.isPrimary,
              isConnected: true,
            },
          });

          connections.push({
            id: connection.id,
            provider: connection.provider,
            calendarId: connection.calendarId,
            calendarName: connection.calendarName,
            calendarColor: connection.calendarColor || undefined,
            isPrimary: connection.isPrimary,
            isConnected: connection.isConnected,
            lastSyncedAt: connection.lastSyncedAt,
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt,
          });

          // Log successful connection
          await auditService.logOAuthConnect(
            userId,
            'GOOGLE',
            connection.id,
            ipAddress,
            userAgent
          );

          logger.info('Google calendar connected', { userId, calendarId: calendar.id });

          // Trigger initial event sync in background (don't wait for it)
          // This ensures events are available immediately after connection
          this.syncCalendarEventsInBackground(connection.id, userId).catch((error: Error) => {
            logger.error('Background sync failed after calendar connection', {
              connectionId: connection.id,
              error,
            });
          });
        } catch (error) {
          logger.error('Failed to create Google calendar connection', {
            userId,
            calendarId: calendar.id,
            error,
          });
          // Continue with other calendars
        }
      }

      return connections;
    } catch (error) {
      await auditService.logOAuthConnectFailure(
        userId,
        'GOOGLE',
        error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        userAgent
      );

      logger.error('Failed to select Google calendars', { userId, error });
      throw new Error(
        `Failed to select Google calendars: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refresh Google access token
   *
   * @param connectionId - Calendar connection ID
   */
  async refreshGoogleToken(connectionId: string): Promise<void> {
    const connection = await prisma.calendarConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.provider !== CalendarProvider.GOOGLE) {
      throw new Error('Google calendar connection not found');
    }

    const refreshToken = decryptToken(connection.refreshToken);
    const tokens = await this.googleClient.refreshAccessToken(refreshToken);

    await prisma.calendarConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: encryptToken(tokens.accessToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    });

    await auditService.logTokenRefresh(connection.userId, 'GOOGLE', connectionId);
  }

  // ============================================================================
  // MICROSOFT OAUTH
  // ============================================================================

  /**
   * Get Microsoft OAuth authorization URL
   *
   * @param userId - User ID initiating OAuth flow
   * @returns Authorization URL for user to visit
   */
  async getMicrosoftAuthUrl(userId: string): Promise<{ url: string; state: string }> {
    try {
      const state = await stateService.createState(userId, 'MICROSOFT');
      const url = await this.microsoftClient.getAuthUrl(state);

      logger.info('Generated Microsoft OAuth URL', { userId });

      return { url, state };
    } catch (error) {
      logger.error('Failed to generate Microsoft OAuth URL', { userId, error });
      throw new Error(
        `Failed to generate Microsoft OAuth URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle Microsoft OAuth callback and fetch calendars
   *
   * @param code - Authorization code from Microsoft
   * @param state - State parameter for CSRF protection
   * @param ipAddress - User's IP address
   * @param userAgent - User's user agent
   * @returns Session ID for retrieving calendar selection data
   */
  async handleMicrosoftCallback(
    code: string,
    state: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ sessionId: string; userId: string }> {
    try {
      // Validate state
      const stateValidation = await stateService.validateState(state, undefined, 'MICROSOFT');
      if (!stateValidation.valid || !stateValidation.userId) {
        throw new Error('Invalid or expired state parameter');
      }

      const userId = stateValidation.userId;

      // Delete state token (single-use)
      await stateService.deleteState(state);

      // Exchange code for tokens (SINGLE USE - code is now consumed)
      const tokens = await this.microsoftClient.getTokens(code);

      // Fetch available calendars
      const calendars = await this.microsoftClient.listCalendars(tokens.accessToken);

      // Store tokens and calendars in session (server-side, single-use)
      const sessionId = await sessionService.createSession({
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
        calendars,
        userId,
        provider: CalendarProvider.MICROSOFT,
      });

      logger.info('Microsoft OAuth callback handled successfully', {
        userId,
        sessionId,
        calendarCount: calendars.length,
      });

      return { sessionId, userId };
    } catch (error) {
      logger.error('Failed to handle Microsoft OAuth callback', { error });
      throw new Error(
        `Failed to handle Microsoft OAuth callback: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create calendar connections for selected Microsoft calendars
   *
   * @param userId - User ID
   * @param sessionId - Session ID from OAuth callback (single-use)
   * @param selectedCalendarIds - Array of calendar IDs to connect
   * @param ipAddress - User's IP address
   * @param userAgent - User's user agent
   * @returns Created calendar connections
   */
  async selectMicrosoftCalendars(
    userId: string,
    sessionId: string,
    selectedCalendarIds: string[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<CalendarConnectionData[]> {
    try {
      // Retrieve session data (SINGLE-USE - session is deleted after retrieval)
      const session = await sessionService.getSession(sessionId);

      if (!session) {
        throw new Error('Invalid or expired session. Please re-authenticate.');
      }

      // Verify session belongs to the requesting user
      if (session.userId !== userId) {
        throw new Error('Session does not belong to this user');
      }

      // Verify provider matches
      if (session.provider !== CalendarProvider.MICROSOFT) {
        throw new Error('Session provider mismatch');
      }

      // Validate selected calendar IDs against available calendars
      const availableCalendarIds = session.calendars.map((cal: MicrosoftCalendar) => cal.id);
      const invalidIds = selectedCalendarIds.filter((id) => !availableCalendarIds.includes(id));

      if (invalidIds.length > 0) {
        throw new Error(`Invalid calendar IDs: ${invalidIds.join(', ')}`);
      }

      // Filter selected calendars from session data
      const selectedCalendars = session.calendars.filter((cal: MicrosoftCalendar) =>
        selectedCalendarIds.includes(cal.id)
      );

      if (selectedCalendars.length === 0) {
        throw new Error('No valid calendars selected');
      }

      const tokens = session.tokens;

      // Create connections for each selected calendar
      const connections: CalendarConnectionData[] = [];
      const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

      for (const calendar of selectedCalendars) {
        try {
          const connection = await prisma.calendarConnection.upsert({
            where: {
              unique_user_calendar: {
                userId,
                provider: CalendarProvider.MICROSOFT,
                calendarId: calendar.id,
              },
            },
            update: {
              accessToken: encryptToken(tokens.accessToken),
              refreshToken: encryptToken(tokens.refreshToken),
              tokenExpiresAt,
              calendarName: calendar.name,
              calendarColor: calendar.color,
              isPrimary: calendar.isDefaultCalendar,
              isConnected: true,
              deletedAt: null,
            },
            create: {
              userId,
              provider: CalendarProvider.MICROSOFT,
              calendarId: calendar.id,
              calendarName: calendar.name,
              accessToken: encryptToken(tokens.accessToken),
              refreshToken: encryptToken(tokens.refreshToken),
              tokenExpiresAt,
              calendarColor: calendar.color,
              isPrimary: calendar.isDefaultCalendar,
              isConnected: true,
            },
          });

          connections.push({
            id: connection.id,
            provider: connection.provider,
            calendarId: connection.calendarId,
            calendarName: connection.calendarName,
            calendarColor: connection.calendarColor || undefined,
            isPrimary: connection.isPrimary,
            isConnected: connection.isConnected,
            lastSyncedAt: connection.lastSyncedAt,
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt,
          });

          // Log successful connection
          await auditService.logOAuthConnect(
            userId,
            'MICROSOFT',
            connection.id,
            ipAddress,
            userAgent
          );

          logger.info('Microsoft calendar connected', { userId, calendarId: calendar.id });

          // Trigger initial event sync in background (don't wait for it)
          this.syncCalendarEventsInBackground(connection.id, userId).catch((error: Error) => {
            logger.error('Background sync failed after calendar connection', {
              connectionId: connection.id,
              error,
            });
          });

          // Create webhook subscription for real-time sync (don't block on failure)
          this.createWebhookSubscriptionInBackground(connection.id, userId).catch((error: Error) => {
            logger.warn('Failed to create webhook subscription (non-critical)', {
              connectionId: connection.id,
              error: error.message,
            });
          });
        } catch (error) {
          logger.error('Failed to create Microsoft calendar connection', {
            userId,
            calendarId: calendar.id,
            error,
          });
        }
      }

      return connections;
    } catch (error) {
      await auditService.logOAuthConnectFailure(
        userId,
        'MICROSOFT',
        error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        userAgent
      );

      logger.error('Failed to select Microsoft calendars', { userId, error });
      throw new Error(
        `Failed to select Microsoft calendars: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refresh Microsoft access token
   *
   * @param connectionId - Calendar connection ID
   */
  async refreshMicrosoftToken(connectionId: string): Promise<void> {
    const connection = await prisma.calendarConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.provider !== CalendarProvider.MICROSOFT) {
      throw new Error('Microsoft calendar connection not found');
    }

    const refreshToken = decryptToken(connection.refreshToken);
    const tokens = await this.microsoftClient.refreshAccessToken(refreshToken);

    await prisma.calendarConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: encryptToken(tokens.accessToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    });

    await auditService.logTokenRefresh(connection.userId, 'MICROSOFT', connectionId);
  }

  // ============================================================================
  // GENERIC METHODS
  // ============================================================================

  /**
   * Disconnect calendar (soft delete)
   *
   * @param userId - User ID
   * @param connectionId - Calendar connection ID
   * @param ipAddress - User's IP address
   * @param userAgent - User's user agent
   */
  async disconnectCalendar(
    userId: string,
    connectionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const connection = await prisma.calendarConnection.findUnique({
        where: { id: connectionId, userId, deletedAt: null },
      });

      if (!connection) {
        throw new Error('Calendar connection not found');
      }

      // Soft delete
      await prisma.calendarConnection.update({
        where: { id: connectionId },
        data: {
          isConnected: false,
          deletedAt: new Date(),
        },
      });

      // Optionally revoke token at provider
      try {
        const accessToken = decryptToken(connection.accessToken);
        if (connection.provider === CalendarProvider.GOOGLE) {
          await this.googleClient.revokeToken(accessToken);
        }
        // Microsoft doesn't have a simple token revocation endpoint
      } catch (error) {
        logger.warn('Failed to revoke token at provider', { connectionId, error });
      }

      await auditService.logOAuthDisconnect(
        userId,
        connection.provider,
        connectionId,
        ipAddress,
        userAgent
      );

      logger.info('Calendar disconnected', { userId, connectionId });
    } catch (error) {
      logger.error('Failed to disconnect calendar', { userId, connectionId, error });
      throw new Error(
        `Failed to disconnect calendar: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all calendar connections for a user
   *
   * @param userId - User ID
   * @returns Array of calendar connections
   */
  async getUserCalendars(userId: string): Promise<CalendarConnectionData[]> {
    try {
      const connections = await prisma.calendarConnection.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      });

      return connections.map((conn) => ({
        id: conn.id,
        provider: conn.provider,
        calendarId: conn.calendarId,
        calendarName: conn.calendarName,
        calendarColor: conn.calendarColor || undefined,
        isPrimary: conn.isPrimary,
        isConnected: conn.isConnected,
        lastSyncedAt: conn.lastSyncedAt,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
      }));
    } catch (error) {
      logger.error('Failed to get user calendars', { userId, error });
      throw new Error(
        `Failed to get user calendars: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sync calendar events in background (non-blocking)
   * This is called after a calendar is connected to immediately fetch events
   *
   * @param connectionId - Calendar connection ID
   * @param userId - User ID
   */
  private async syncCalendarEventsInBackground(connectionId: string, userId: string): Promise<void> {
    try {
      logger.info('Starting background event sync', { connectionId, userId });

      await eventSyncService.syncCalendarEvents(connectionId, userId, {
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days ahead
      });

      logger.info('Background event sync completed', { connectionId, userId });
    } catch (error) {
      logger.error('Background event sync failed', { connectionId, userId, error });
      // Don't throw - this is a background operation
    }
  }

  /**
   * Create webhook subscription in background (non-blocking)
   * Used after calendar connection to enable real-time sync
   *
   * @param connectionId - Calendar connection ID
   * @param userId - User ID
   */
  private async createWebhookSubscriptionInBackground(
    connectionId: string,
    userId: string
  ): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency
      const { default: webhookService } = await import('./webhookService');

      logger.info('Creating webhook subscription in background', { connectionId, userId });

      await webhookService.createSubscription(connectionId, userId);

      logger.info('Webhook subscription created successfully', { connectionId, userId });
    } catch (error) {
      logger.warn('Failed to create webhook subscription in background', {
        connectionId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - webhook is optional, sync will still work via polling
    }
  }
}

export default new OAuthService();
