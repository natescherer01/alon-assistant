/**
 * Google Calendar Integration
 *
 * Handles Google Calendar API interactions using googleapis npm package
 * Implements OAuth 2.0 flow and calendar data fetching
 */

import { google, calendar_v3 } from 'googleapis';
import { googleOAuthConfig } from '../config/oauth';
import logger from '../utils/logger';

export interface GoogleCalendar {
  id: string;
  name: string;
  description?: string;
  timeZone: string;
  backgroundColor?: string;
  isPrimary: boolean;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class GoogleCalendarClient {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      googleOAuthConfig.clientId,
      googleOAuthConfig.clientSecret,
      googleOAuthConfig.redirectUri
    );
  }

  /**
   * Generate Google OAuth authorization URL
   *
   * @param state - CSRF protection state parameter
   * @returns Authorization URL for user to visit
   */
  getAuthUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: googleOAuthConfig.scopes,
      state,
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for access and refresh tokens
   *
   * @param code - Authorization code from OAuth callback
   * @returns Access token, refresh token, and expiry info
   */
  async getTokens(code: string): Promise<GoogleTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      if (!tokens.refresh_token) {
        throw new Error('No refresh token received from Google');
      }

      logger.info('Successfully exchanged Google authorization code for tokens');

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expiry_date
          ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
          : 3600, // Default to 1 hour
      };
    } catch (error) {
      logger.error('Failed to exchange Google authorization code', { error });
      throw new Error(
        `Failed to get Google tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refresh Google access token using refresh token
   *
   * @param refreshToken - Refresh token from previous authorization
   * @returns New access token and expiry info
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('No access token received from refresh');
      }

      logger.info('Successfully refreshed Google access token');

      return {
        accessToken: credentials.access_token,
        expiresIn: credentials.expiry_date
          ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
          : 3600,
      };
    } catch (error) {
      logger.error('Failed to refresh Google access token', { error });
      throw new Error(
        `Failed to refresh Google token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List all calendars accessible to the user
   *
   * @param accessToken - Valid Google access token
   * @returns Array of calendar objects
   */
  async listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      const response = await calendar.calendarList.list();

      if (!response.data.items) {
        logger.warn('No calendars found in Google Calendar response');
        return [];
      }

      const calendars: GoogleCalendar[] = response.data.items.map((item) => ({
        id: item.id!,
        name: item.summary || 'Unnamed Calendar',
        description: item.description,
        timeZone: item.timeZone || 'UTC',
        backgroundColor: item.backgroundColor,
        isPrimary: item.primary || false,
      }));

      logger.info(`Retrieved ${calendars.length} Google calendars`);
      return calendars;
    } catch (error) {
      logger.error('Failed to list Google calendars', { error });
      throw new Error(
        `Failed to list Google calendars: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get metadata for a specific calendar
   *
   * @param accessToken - Valid Google access token
   * @param calendarId - Google calendar ID
   * @returns Calendar metadata
   */
  async getCalendarMetadata(accessToken: string, calendarId: string): Promise<GoogleCalendar> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      const response = await calendar.calendars.get({ calendarId });

      return {
        id: response.data.id!,
        name: response.data.summary || 'Unnamed Calendar',
        description: response.data.description,
        timeZone: response.data.timeZone || 'UTC',
        backgroundColor: undefined, // Not available in calendar.get
        isPrimary: calendarId === 'primary',
      };
    } catch (error) {
      logger.error('Failed to get Google calendar metadata', { error, calendarId });
      throw new Error(
        `Failed to get Google calendar metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Revoke Google OAuth token (disconnect)
   *
   * @param token - Access or refresh token to revoke
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(token);
      logger.info('Successfully revoked Google OAuth token');
    } catch (error) {
      logger.error('Failed to revoke Google OAuth token', { error });
      // Don't throw - token might already be invalid
    }
  }
}
