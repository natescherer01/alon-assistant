/**
 * Google Calendar Integration Tests
 *
 * Tests for Google OAuth flow and calendar operations
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GoogleCalendarClient } from '../../src/integrations/google';
import { google } from 'googleapis';
import {
  mockGoogleCalendars,
  mockGoogleTokens,
  mockGoogleEventsListResponse,
} from '../fixtures/provider-responses.fixture';

// Mock googleapis
jest.mock('googleapis');

describe('GoogleCalendarClient', () => {
  let client: GoogleCalendarClient;
  let mockOAuth2Client: any;
  let mockCalendarApi: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock OAuth2 client
    mockOAuth2Client = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      refreshAccessToken: jest.fn(),
      setCredentials: jest.fn(),
      revokeToken: jest.fn(),
    };

    // Mock Calendar API
    mockCalendarApi = {
      calendarList: {
        list: jest.fn(),
      },
      calendars: {
        get: jest.fn(),
      },
      events: {
        list: jest.fn(),
      },
    };

    // Mock google.auth.OAuth2 constructor
    (google.auth.OAuth2 as jest.MockedClass<any>) = jest.fn().mockImplementation(() => mockOAuth2Client);

    // Mock google.calendar
    (google.calendar as jest.MockedFunction<any>) = jest.fn().mockReturnValue(mockCalendarApi);

    client = new GoogleCalendarClient();
  });

  describe('getAuthUrl', () => {
    it('should generate OAuth authorization URL with correct parameters', () => {
      const state = 'test_state_token';
      const expectedUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test';

      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const url = client.getAuthUrl(state);

      expect(url).toBe(expectedUrl);
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: expect.arrayContaining(['https://www.googleapis.com/auth/calendar.readonly']),
        state,
        prompt: 'consent',
      });
    });

    it('should include state parameter for CSRF protection', () => {
      const state = 'random_state_123';
      mockOAuth2Client.generateAuthUrl.mockReturnValue('https://oauth.url');

      client.getAuthUrl(state);

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ state })
      );
    });
  });

  describe('getTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const code = 'authorization_code_123';
      mockOAuth2Client.getToken.mockResolvedValue({
        tokens: mockGoogleTokens,
      });

      const tokens = await client.getTokens(code);

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(code);
      expect(tokens).toEqual({
        accessToken: mockGoogleTokens.access_token,
        refreshToken: mockGoogleTokens.refresh_token,
        expiresIn: expect.any(Number),
      });
    });

    it('should throw error if no access token received', async () => {
      mockOAuth2Client.getToken.mockResolvedValue({
        tokens: { refresh_token: 'token' },
      });

      await expect(client.getTokens('code')).rejects.toThrow('No access token received from Google');
    });

    it('should throw error if no refresh token received', async () => {
      mockOAuth2Client.getToken.mockResolvedValue({
        tokens: { access_token: 'token' },
      });

      await expect(client.getTokens('code')).rejects.toThrow('No refresh token received from Google');
    });

    it('should handle invalid authorization code error', async () => {
      mockOAuth2Client.getToken.mockRejectedValue(new Error('invalid_grant'));

      await expect(client.getTokens('invalid_code')).rejects.toThrow('Failed to get Google tokens');
    });

    it('should calculate correct token expiry time', async () => {
      const expiryDate = Date.now() + 3600 * 1000; // 1 hour from now
      mockOAuth2Client.getToken.mockResolvedValue({
        tokens: {
          ...mockGoogleTokens,
          expiry_date: expiryDate,
        },
      });

      const tokens = await client.getTokens('code');

      expect(tokens.expiresIn).toBeGreaterThan(3500);
      expect(tokens.expiresIn).toBeLessThanOrEqual(3600);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token using refresh token', async () => {
      const refreshToken = 'refresh_token_123';
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'new_access_token',
          expiry_date: Date.now() + 3600 * 1000,
        },
      });

      const tokens = await client.refreshAccessToken(refreshToken);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: refreshToken,
      });
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(tokens.accessToken).toBe('new_access_token');
      expect(tokens.expiresIn).toBeGreaterThan(0);
    });

    it('should throw error if refresh fails', async () => {
      mockOAuth2Client.refreshAccessToken.mockRejectedValue(new Error('invalid_grant'));

      await expect(client.refreshAccessToken('invalid_token')).rejects.toThrow(
        'Failed to refresh Google token'
      );
    });

    it('should throw error if no access token in response', async () => {
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {},
      });

      await expect(client.refreshAccessToken('token')).rejects.toThrow(
        'No access token received from refresh'
      );
    });

    it('should use default expiry if not provided', async () => {
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'new_token',
        },
      });

      const tokens = await client.refreshAccessToken('refresh_token');

      expect(tokens.expiresIn).toBe(3600); // Default 1 hour
    });
  });

  describe('listCalendars', () => {
    it('should list all user calendars', async () => {
      const accessToken = 'access_token_123';
      mockCalendarApi.calendarList.list.mockResolvedValue({
        data: {
          items: mockGoogleCalendars,
        },
      });

      const calendars = await client.listCalendars(accessToken);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: accessToken,
      });
      expect(mockCalendarApi.calendarList.list).toHaveBeenCalled();
      expect(calendars).toHaveLength(3);
      expect(calendars[0]).toEqual({
        id: 'primary',
        name: 'Test User Calendar',
        description: 'Primary calendar',
        timeZone: 'America/New_York',
        backgroundColor: '#1F77B4',
        isPrimary: true,
      });
    });

    it('should return empty array if no calendars found', async () => {
      mockCalendarApi.calendarList.list.mockResolvedValue({
        data: {},
      });

      const calendars = await client.listCalendars('token');

      expect(calendars).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockCalendarApi.calendarList.list.mockRejectedValue(new Error('API Error'));

      await expect(client.listCalendars('token')).rejects.toThrow('Failed to list Google calendars');
    });

    it('should handle calendars without summary', async () => {
      mockCalendarApi.calendarList.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'calendar_without_summary',
              timeZone: 'UTC',
            },
          ],
        },
      });

      const calendars = await client.listCalendars('token');

      expect(calendars[0].name).toBe('Unnamed Calendar');
    });

    it('should handle 100+ calendars (pagination scenario)', async () => {
      const largeCalendarList = Array.from({ length: 150 }, (_, i) => ({
        id: `calendar_${i}`,
        summary: `Calendar ${i}`,
        timeZone: 'UTC',
        primary: i === 0,
      }));

      mockCalendarApi.calendarList.list.mockResolvedValue({
        data: {
          items: largeCalendarList,
        },
      });

      const calendars = await client.listCalendars('token');

      expect(calendars).toHaveLength(150);
    });
  });

  describe('getCalendarMetadata', () => {
    it('should get metadata for specific calendar', async () => {
      const accessToken = 'access_token_123';
      const calendarId = 'primary';
      mockCalendarApi.calendars.get.mockResolvedValue({
        data: {
          id: calendarId,
          summary: 'Primary Calendar',
          description: 'User primary calendar',
          timeZone: 'America/New_York',
        },
      });

      const calendar = await client.getCalendarMetadata(accessToken, calendarId);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: accessToken,
      });
      expect(mockCalendarApi.calendars.get).toHaveBeenCalledWith({ calendarId });
      expect(calendar.id).toBe(calendarId);
      expect(calendar.name).toBe('Primary Calendar');
    });

    it('should handle calendar not found error', async () => {
      mockCalendarApi.calendars.get.mockRejectedValue(new Error('Not Found'));

      await expect(client.getCalendarMetadata('token', 'invalid_id')).rejects.toThrow(
        'Failed to get Google calendar metadata'
      );
    });

    it('should set isPrimary for primary calendar', async () => {
      mockCalendarApi.calendars.get.mockResolvedValue({
        data: {
          id: 'primary',
          summary: 'Calendar',
          timeZone: 'UTC',
        },
      });

      const calendar = await client.getCalendarMetadata('token', 'primary');

      expect(calendar.isPrimary).toBe(true);
    });
  });

  describe('revokeToken', () => {
    it('should revoke OAuth token', async () => {
      const token = 'access_token_to_revoke';
      mockOAuth2Client.revokeToken.mockResolvedValue(undefined);

      await client.revokeToken(token);

      expect(mockOAuth2Client.revokeToken).toHaveBeenCalledWith(token);
    });

    it('should not throw error if token already invalid', async () => {
      mockOAuth2Client.revokeToken.mockRejectedValue(new Error('Token already revoked'));

      // Should not throw
      await expect(client.revokeToken('token')).resolves.toBeUndefined();
    });

    it('should handle network errors gracefully', async () => {
      mockOAuth2Client.revokeToken.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(client.revokeToken('token')).resolves.toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle expired access token', async () => {
      const expiredTokens = {
        ...mockGoogleTokens,
        expiry_date: Date.now() - 3600 * 1000, // 1 hour ago
      };

      mockOAuth2Client.getToken.mockResolvedValue({
        tokens: expiredTokens,
      });

      const tokens = await client.getTokens('code');

      expect(tokens.expiresIn).toBeLessThan(0); // Should be negative
    });

    it('should handle special characters in calendar names', async () => {
      mockCalendarApi.calendarList.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'special_chars',
              summary: 'Calendar with "quotes" & <tags>',
              timeZone: 'UTC',
            },
          ],
        },
      });

      const calendars = await client.listCalendars('token');

      expect(calendars[0].name).toBe('Calendar with "quotes" & <tags>');
    });

    it('should handle very long calendar descriptions', async () => {
      const longDescription = 'A'.repeat(10000);
      mockCalendarApi.calendarList.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'long_desc',
              summary: 'Calendar',
              description: longDescription,
              timeZone: 'UTC',
            },
          ],
        },
      });

      const calendars = await client.listCalendars('token');

      expect(calendars[0].description).toBe(longDescription);
    });
  });
});
