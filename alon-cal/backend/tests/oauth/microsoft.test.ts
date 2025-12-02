/**
 * Microsoft Outlook Integration Tests
 *
 * Tests for Microsoft OAuth flow and calendar operations
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MicrosoftCalendarClient } from '../../src/integrations/microsoft';
import {
  mockMicrosoftCalendars,
  mockMicrosoftTokens,
  mockMicrosoftEvent,
} from '../fixtures/provider-responses.fixture';

// Mock MSAL and Microsoft Graph Client
jest.mock('@azure/msal-node');
jest.mock('@microsoft/microsoft-graph-client');

describe('MicrosoftCalendarClient', () => {
  let client: MicrosoftCalendarClient;
  let mockMsalClient: any;
  let mockGraphClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock MSAL client
    mockMsalClient = {
      getAuthCodeUrl: jest.fn(),
      acquireTokenByCode: jest.fn(),
      acquireTokenByRefreshToken: jest.fn(),
    };

    // Mock Graph API client
    mockGraphClient = {
      api: jest.fn().mockReturnThis(),
      get: jest.fn(),
      filter: jest.fn().mockReturnThis(),
      top: jest.fn().mockReturnThis(),
      orderby: jest.fn().mockReturnThis(),
    };

    // Mock ConfidentialClientApplication constructor
    const { ConfidentialClientApplication } = require('@azure/msal-node');
    (ConfidentialClientApplication as jest.MockedClass<any>) = jest
      .fn()
      .mockImplementation(() => mockMsalClient);

    // Mock Graph Client.init
    const { Client } = require('@microsoft/microsoft-graph-client');
    (Client.init as jest.MockedFunction<any>) = jest.fn().mockReturnValue(mockGraphClient);

    client = new MicrosoftCalendarClient();
  });

  describe('getAuthUrl', () => {
    it('should generate OAuth authorization URL', async () => {
      const state = 'test_state_token';
      const expectedUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

      mockMsalClient.getAuthCodeUrl.mockResolvedValue(expectedUrl);

      const url = await client.getAuthUrl(state);

      expect(url).toBe(expectedUrl);
      expect(mockMsalClient.getAuthCodeUrl).toHaveBeenCalledWith({
        scopes: expect.arrayContaining(['Calendars.Read']),
        redirectUri: expect.any(String),
        state,
        prompt: 'consent',
      });
    });

    it('should include CSRF state parameter', async () => {
      mockMsalClient.getAuthCodeUrl.mockResolvedValue('https://auth.url');

      await client.getAuthUrl('random_state_123');

      expect(mockMsalClient.getAuthCodeUrl).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'random_state_123' })
      );
    });

    it('should handle URL generation errors', async () => {
      mockMsalClient.getAuthCodeUrl.mockRejectedValue(new Error('URL generation failed'));

      await expect(client.getAuthUrl('state')).rejects.toThrow(
        'Failed to generate Microsoft auth URL'
      );
    });
  });

  describe('getTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const code = 'authorization_code_123';
      mockMsalClient.acquireTokenByCode.mockResolvedValue(mockMicrosoftTokens);

      const tokens = await client.getTokens(code);

      expect(mockMsalClient.acquireTokenByCode).toHaveBeenCalledWith({
        code,
        scopes: expect.any(Array),
        redirectUri: expect.any(String),
      });
      expect(tokens).toEqual({
        accessToken: mockMicrosoftTokens.accessToken,
        refreshToken: mockMicrosoftTokens.refreshToken,
        expiresIn: expect.any(Number),
      });
    });

    it('should throw error if no access token received', async () => {
      mockMsalClient.acquireTokenByCode.mockResolvedValue({
        refreshToken: 'token',
      });

      await expect(client.getTokens('code')).rejects.toThrow(
        'No access token received from Microsoft'
      );
    });

    it('should handle missing refresh token gracefully', async () => {
      mockMsalClient.acquireTokenByCode.mockResolvedValue({
        accessToken: 'access_token',
        expiresOn: new Date(Date.now() + 3600 * 1000),
      });

      const tokens = await client.getTokens('code');

      expect(tokens.refreshToken).toBe('');
    });

    it('should handle invalid authorization code', async () => {
      mockMsalClient.acquireTokenByCode.mockRejectedValue(new Error('invalid_grant'));

      await expect(client.getTokens('invalid_code')).rejects.toThrow(
        'Failed to get Microsoft tokens'
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token using refresh token', async () => {
      const refreshToken = 'refresh_token_123';
      mockMsalClient.acquireTokenByRefreshToken.mockResolvedValue({
        accessToken: 'new_access_token',
        expiresOn: new Date(Date.now() + 3600 * 1000),
      });

      const tokens = await client.refreshAccessToken(refreshToken);

      expect(mockMsalClient.acquireTokenByRefreshToken).toHaveBeenCalledWith({
        refreshToken,
        scopes: expect.any(Array),
      });
      expect(tokens.accessToken).toBe('new_access_token');
    });

    it('should throw error if refresh fails', async () => {
      mockMsalClient.acquireTokenByRefreshToken.mockRejectedValue(new Error('invalid_grant'));

      await expect(client.refreshAccessToken('invalid_token')).rejects.toThrow(
        'Failed to refresh Microsoft token'
      );
    });
  });

  describe('listCalendars', () => {
    it('should list all user calendars', async () => {
      const accessToken = 'access_token_123';
      mockGraphClient.get.mockResolvedValue({
        value: mockMicrosoftCalendars,
      });

      const calendars = await client.listCalendars(accessToken);

      expect(mockGraphClient.api).toHaveBeenCalledWith('/me/calendars');
      expect(calendars).toHaveLength(2);
      expect(calendars[0]).toMatchObject({
        id: 'AAMkAGI2TGTG',
        name: 'Calendar',
        isDefaultCalendar: true,
      });
    });

    it('should map Microsoft color codes to hex values', async () => {
      mockGraphClient.get.mockResolvedValue({
        value: [
          {
            id: 'cal1',
            name: 'Blue Calendar',
            color: 'lightBlue',
            isDefaultCalendar: true,
            canEdit: true,
            owner: { name: 'User', address: 'user@example.com' },
          },
        ],
      });

      const calendars = await client.listCalendars('token');

      expect(calendars[0].color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should handle empty calendar list', async () => {
      mockGraphClient.get.mockResolvedValue({});

      const calendars = await client.listCalendars('token');

      expect(calendars).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockGraphClient.get.mockRejectedValue(new Error('API Error'));

      await expect(client.listCalendars('token')).rejects.toThrow(
        'Failed to list Microsoft calendars'
      );
    });
  });

  describe('getCalendarMetadata', () => {
    it('should get metadata for specific calendar', async () => {
      const calendarId = 'AAMkAGI2TGTG';
      mockGraphClient.get.mockResolvedValue({
        id: calendarId,
        name: 'Work Calendar',
        color: 'auto',
        isDefaultCalendar: false,
        canEdit: true,
        owner: { name: 'User', address: 'user@example.com' },
      });

      const calendar = await client.getCalendarMetadata('token', calendarId);

      expect(mockGraphClient.api).toHaveBeenCalledWith(`/me/calendars/${calendarId}`);
      expect(calendar.id).toBe(calendarId);
      expect(calendar.name).toBe('Work Calendar');
    });

    it('should handle calendar not found', async () => {
      mockGraphClient.get.mockRejectedValue(new Error('Not Found'));

      await expect(client.getCalendarMetadata('token', 'invalid_id')).rejects.toThrow(
        'Failed to get Microsoft calendar metadata'
      );
    });
  });

  describe('Color Mapping', () => {
    it('should map all Microsoft color codes correctly', async () => {
      const colorCodes = [
        'auto',
        'lightBlue',
        'lightGreen',
        'lightOrange',
        'lightGray',
        'lightYellow',
        'lightTeal',
        'lightPink',
        'lightBrown',
        'lightRed',
        'maxColor',
      ];

      for (const color of colorCodes) {
        mockGraphClient.get.mockResolvedValue({
          value: [
            {
              id: 'cal1',
              name: 'Calendar',
              color,
              isDefaultCalendar: true,
              canEdit: true,
              owner: { name: 'User', address: 'user@example.com' },
            },
          ],
        });

        const calendars = await client.listCalendars('token');
        expect(calendars[0].color).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });

    it('should use default color for unknown color code', async () => {
      mockGraphClient.get.mockResolvedValue({
        value: [
          {
            id: 'cal1',
            name: 'Calendar',
            color: 'unknownColor',
            isDefaultCalendar: true,
            canEdit: true,
            owner: { name: 'User', address: 'user@example.com' },
          },
        ],
      });

      const calendars = await client.listCalendars('token');
      expect(calendars[0].color).toBe('#1F77B4'); // Default color
    });
  });
});
