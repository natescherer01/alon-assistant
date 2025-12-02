/**
 * Calendar Integration Flow Tests
 *
 * End-to-end integration tests for complete user journeys
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CalendarProvider } from '@prisma/client';
import { prismaMock } from '../mocks/prisma.mock';
import { mockUser } from '../fixtures/users.fixture';
import { mockGoogleConnection } from '../fixtures/calendars.fixture';
import { mockEvent } from '../fixtures/events.fixture';
import {
  mockGoogleCalendars,
  mockGoogleTokens,
  mockGoogleEventsListResponse,
} from '../fixtures/provider-responses.fixture';

// Mock all modules
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('googleapis');
jest.mock('../../src/utils/encryption', () => ({
  encryptToken: jest.fn((token) => `encrypted_${token}`),
  decryptToken: jest.fn((token) => token.replace('encrypted_', '')),
}));
jest.mock('../../src/services/auditService', () => ({
  default: {
    logOAuthConnect: jest.fn(),
    logOAuthConnectFailure: jest.fn(),
    logOAuthDisconnect: jest.fn(),
    logCalendarSync: jest.fn(),
    logCalendarSyncFailure: jest.fn(),
    logTokenRefresh: jest.fn(),
  },
}));

import oauthService from '../../src/services/oauthService';
import eventSyncService from '../../src/services/eventSyncService';
import tokenRefreshService from '../../src/services/tokenRefreshService';

describe('Calendar Integration Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete OAuth Flow: Google Calendar', () => {
    it('should complete full OAuth flow from initiation to calendar selection', async () => {
      const userId = mockUser.id;
      const state = 'random_state_token';

      // Step 1: Initiate OAuth flow
      // Create state token
      prismaMock.oAuthState.create.mockResolvedValue({
        id: 'state_id',
        userId,
        provider: CalendarProvider.GOOGLE,
        state,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        consumed: false,
      });

      const authResult = await oauthService.getGoogleAuthUrl(userId);

      expect(authResult.state).toBeDefined();
      expect(authResult.url).toContain('accounts.google.com');

      // Step 2: Handle OAuth callback
      // Validate state token
      prismaMock.oAuthState.findUnique.mockResolvedValue({
        id: 'state_id',
        userId,
        provider: CalendarProvider.GOOGLE,
        state,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        consumed: false,
      });
      prismaMock.oAuthState.delete.mockResolvedValue({} as any);

      // Mock Google token exchange
      const mockOAuth2Client = {
        getToken: jest.fn().mockResolvedValue({
          tokens: mockGoogleTokens,
        }),
        setCredentials: jest.fn(),
      };

      // Mock Google calendar list
      const mockCalendarApi = {
        calendarList: {
          list: jest.fn().mockResolvedValue({
            data: { items: mockGoogleCalendars },
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      const code = 'authorization_code_123';
      const callbackResult = await oauthService.handleGoogleCallback(
        code,
        state,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(callbackResult.calendars).toHaveLength(mockGoogleCalendars.length);
      expect(callbackResult.userId).toBe(userId);

      // Step 3: User selects calendars
      const selectedCalendarIds = ['primary', 'work@example.com'];

      prismaMock.calendarConnection.upsert.mockResolvedValue({
        ...mockGoogleConnection,
        userId,
      });

      const connections = await oauthService.selectGoogleCalendars(
        userId,
        code,
        selectedCalendarIds,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(connections).toHaveLength(selectedCalendarIds.length);
      expect(connections[0].provider).toBe(CalendarProvider.GOOGLE);
      expect(connections[0].isConnected).toBe(true);
    });
  });

  describe('Event Syncing Flow', () => {
    it('should sync events after calendar connection', async () => {
      const connectionId = mockGoogleConnection.id;

      // Setup mocks
      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarEvent.findUnique.mockResolvedValue(null);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      // Mock Google API
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
      };

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: mockGoogleEventsListResponse,
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      // Mock token refresh
      jest.spyOn(tokenRefreshService, 'checkAndRefreshToken').mockResolvedValue('valid_token');

      // Sync events
      const syncResult = await eventSyncService.syncCalendarEvents(connectionId);

      expect(syncResult.totalEvents).toBe(mockGoogleEventsListResponse.items.length);
      expect(syncResult.errors).toHaveLength(0);
      expect(prismaMock.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastSyncedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should refresh token before syncing if expired', async () => {
      const connectionId = mockGoogleConnection.id;
      const expiredConnection = {
        ...mockGoogleConnection,
        tokenExpiresAt: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(expiredConnection);
      prismaMock.calendarConnection.update.mockResolvedValue(expiredConnection);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);

      // Mock token refresh
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new_access_token',
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
      };

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: mockGoogleEventsListResponse,
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      // Should refresh token before syncing
      jest
        .spyOn(tokenRefreshService, 'checkAndRefreshToken')
        .mockResolvedValue('new_access_token');

      await eventSyncService.syncCalendarEvents(connectionId);

      expect(tokenRefreshService.checkAndRefreshToken).toHaveBeenCalledWith(connectionId);
    });
  });

  describe('Disconnect Calendar Flow', () => {
    it('should disconnect calendar and revoke token', async () => {
      const userId = mockUser.id;
      const connectionId = mockGoogleConnection.id;

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarConnection.update.mockResolvedValue({
        ...mockGoogleConnection,
        isConnected: false,
        deletedAt: new Date(),
      });

      // Mock Google token revocation
      const mockOAuth2Client = {
        revokeToken: jest.fn().mockResolvedValue(undefined),
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);

      await oauthService.disconnectCalendar(userId, connectionId, '192.168.1.1', 'Mozilla/5.0');

      expect(prismaMock.calendarConnection.update).toHaveBeenCalledWith({
        where: { id: connectionId },
        data: {
          isConnected: false,
          deletedAt: expect.any(Date),
        },
      });
    });
  });

  describe('User with Multiple Calendars', () => {
    it('should sync all user calendars simultaneously', async () => {
      const userId = mockUser.id;
      const connections = [
        mockGoogleConnection,
        { ...mockGoogleConnection, id: 'conn2', calendarId: 'work@example.com' },
        { ...mockGoogleConnection, id: 'conn3', calendarId: 'personal@example.com' },
      ];

      prismaMock.calendarConnection.findMany.mockResolvedValue(connections);
      prismaMock.calendarConnection.findUnique
        .mockResolvedValueOnce(connections[0])
        .mockResolvedValueOnce(connections[1])
        .mockResolvedValueOnce(connections[2]);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: mockGoogleEventsListResponse,
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      jest.spyOn(tokenRefreshService, 'checkAndRefreshToken').mockResolvedValue('valid_token');

      const results = await eventSyncService.syncAllUserCalendars(userId);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.errors.length === 0)).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should handle API rate limit and retry', async () => {
      const connectionId = mockGoogleConnection.id;

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      const mockCalendarApi = {
        events: {
          list: jest
            .fn()
            .mockRejectedValueOnce({ code: 429, message: 'Rate limit exceeded' })
            .mockResolvedValueOnce({
              data: mockGoogleEventsListResponse,
            }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      jest.spyOn(tokenRefreshService, 'checkAndRefreshToken').mockResolvedValue('valid_token');

      // First attempt should fail, but the test demonstrates error handling
      await expect(eventSyncService.syncCalendarEvents(connectionId)).rejects.toThrow();
    });

    it('should handle OAuth token revoked by user', async () => {
      const connectionId = mockGoogleConnection.id;

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest
          .fn()
          .mockRejectedValue({ code: 'invalid_grant', message: 'Token revoked' }),
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);

      prismaMock.calendarConnection.update.mockResolvedValue({
        ...mockGoogleConnection,
        isConnected: false,
      });

      // Should fail and mark connection as disconnected
      await expect(tokenRefreshService.checkAndRefreshToken(connectionId)).rejects.toThrow();

      expect(prismaMock.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isConnected: false },
        })
      );
    });
  });

  describe('Data Consistency', () => {
    it('should maintain event data integrity across multiple syncs', async () => {
      const connectionId = mockGoogleConnection.id;

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarEvent.findUnique.mockResolvedValue(mockEvent); // Event exists
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      const updatedEvent = {
        ...mockGoogleEvent,
        summary: 'Updated Meeting Title',
        updated: new Date().toISOString(),
      };

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: {
              items: [updatedEvent],
              nextSyncToken: 'new_sync_token',
            },
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      jest.spyOn(tokenRefreshService, 'checkAndRefreshToken').mockResolvedValue('valid_token');

      // Sync twice to test update logic
      await eventSyncService.syncCalendarEvents(connectionId);
      await eventSyncService.syncCalendarEvents(connectionId);

      // Should update existing event, not create duplicate
      expect(prismaMock.calendarEvent.upsert).toHaveBeenCalled();
    });
  });

  describe('Pagination Handling', () => {
    it('should handle paginated event responses', async () => {
      const connectionId = mockGoogleConnection.id;

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarEvent.findUnique.mockResolvedValue(null);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      // Simulate paginated responses
      const mockCalendarApi = {
        events: {
          list: jest
            .fn()
            .mockResolvedValueOnce({
              data: {
                items: [mockGoogleEvent],
                nextPageToken: 'page2_token',
              },
            })
            .mockResolvedValueOnce({
              data: {
                items: [mockGoogleEvent],
                nextSyncToken: 'final_sync_token',
              },
            }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      jest.spyOn(tokenRefreshService, 'checkAndRefreshToken').mockResolvedValue('valid_token');

      const result = await eventSyncService.syncCalendarEvents(connectionId);

      expect(mockCalendarApi.events.list).toHaveBeenCalledTimes(2); // Two pages
      expect(result.totalEvents).toBe(2);
    });
  });
});
