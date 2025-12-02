/**
 * Token Refresh Service Tests
 *
 * Tests for automatic OAuth token refresh
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CalendarProvider } from '@prisma/client';
import { prismaMock } from '../mocks/prisma.mock';
import {
  mockGoogleConnection,
  mockMicrosoftConnection,
  mockExpiredConnection,
} from '../fixtures/calendars.fixture';

// Mock modules
jest.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

jest.mock('googleapis');
jest.mock('@azure/msal-node');
jest.mock('../../src/utils/encryption', () => ({
  encryptToken: jest.fn((token) => `encrypted_${token}`),
  decryptToken: jest.fn((token) => token.replace('encrypted_', '')),
}));

jest.mock('../../src/services/auditService', () => ({
  default: {
    logTokenRefresh: jest.fn(),
    logTokenRefreshFailure: jest.fn(),
  },
}));

import tokenRefreshService from '../../src/services/tokenRefreshService';

describe('TokenRefreshService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndRefreshToken', () => {
    it('should return existing token if not expiring soon', async () => {
      const validConnection = {
        ...mockGoogleConnection,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(validConnection);

      const token = await tokenRefreshService.checkAndRefreshToken(validConnection.id);

      expect(token).toBe('encrypted_access_token'); // Decrypted token
      // Should not call refresh
      expect(prismaMock.calendarConnection.update).not.toHaveBeenCalled();
    });

    it('should refresh token if expiring within 5 minutes', async () => {
      const expiringConnection = {
        ...mockGoogleConnection,
        tokenExpiresAt: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes from now
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(expiringConnection);
      prismaMock.calendarConnection.update.mockResolvedValue(expiringConnection);

      // Mock Google refresh
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new_access_token',
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);

      const token = await tokenRefreshService.checkAndRefreshToken(expiringConnection.id);

      expect(token).toBe('new_access_token');
      expect(prismaMock.calendarConnection.update).toHaveBeenCalledWith({
        where: { id: expiringConnection.id },
        data: {
          accessToken: expect.any(String),
          tokenExpiresAt: expect.any(Date),
        },
      });
    });

    it('should refresh expired token', async () => {
      const expiredConnection = {
        ...mockExpiredConnection,
        provider: CalendarProvider.GOOGLE,
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(expiredConnection);
      prismaMock.calendarConnection.update.mockResolvedValue(expiredConnection);

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'refreshed_token',
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);

      const token = await tokenRefreshService.checkAndRefreshToken(expiredConnection.id);

      expect(token).toBe('refreshed_token');
    });

    it('should handle Google token refresh', async () => {
      const googleConnection = {
        ...mockGoogleConnection,
        tokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(googleConnection);
      prismaMock.calendarConnection.update.mockResolvedValue(googleConnection);

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new_google_token',
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);

      await tokenRefreshService.checkAndRefreshToken(googleConnection.id);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'encrypted_refresh_token',
      });
    });

    it('should handle Microsoft token refresh', async () => {
      const microsoftConnection = {
        ...mockMicrosoftConnection,
        tokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(microsoftConnection);
      prismaMock.calendarConnection.update.mockResolvedValue(microsoftConnection);

      const mockMsalClient = {
        acquireTokenByRefreshToken: jest.fn().mockResolvedValue({
          accessToken: 'new_microsoft_token',
          expiresOn: new Date(Date.now() + 3600 * 1000),
        }),
      };

      const { ConfidentialClientApplication } = require('@azure/msal-node');
      ConfidentialClientApplication.mockImplementation(() => mockMsalClient);

      await tokenRefreshService.checkAndRefreshToken(microsoftConnection.id);

      expect(mockMsalClient.acquireTokenByRefreshToken).toHaveBeenCalled();
    });

    it('should throw error for non-existent connection', async () => {
      prismaMock.calendarConnection.findUnique.mockResolvedValue(null);

      await expect(tokenRefreshService.checkAndRefreshToken('invalid_id')).rejects.toThrow(
        'Calendar connection not found'
      );
    });

    it('should throw error for disconnected connection', async () => {
      const disconnectedConnection = {
        ...mockGoogleConnection,
        isConnected: false,
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(disconnectedConnection);

      await expect(
        tokenRefreshService.checkAndRefreshToken(disconnectedConnection.id)
      ).rejects.toThrow('Calendar connection is disconnected');
    });

    it('should mark connection as disconnected on refresh failure', async () => {
      const connection = {
        ...mockGoogleConnection,
        tokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
      };

      prismaMock.calendarConnection.findUnique
        .mockResolvedValueOnce(connection) // First call succeeds
        .mockResolvedValueOnce(connection); // Second call for audit log
      prismaMock.calendarConnection.update.mockResolvedValue(connection);

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockRejectedValue(new Error('invalid_grant')),
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);

      await expect(tokenRefreshService.checkAndRefreshToken(connection.id)).rejects.toThrow(
        'Failed to refresh token'
      );

      expect(prismaMock.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isConnected: false },
        })
      );
    });
  });

  describe('scheduleTokenRefresh', () => {
    it('should refresh all expiring tokens', async () => {
      const expiringConnections = [
        {
          ...mockGoogleConnection,
          id: 'conn1',
          tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        },
        {
          ...mockMicrosoftConnection,
          id: 'conn2',
          tokenExpiresAt: new Date(Date.now() + 45 * 60 * 1000), // 45 min
        },
      ];

      prismaMock.calendarConnection.findMany.mockResolvedValue(expiringConnections);
      prismaMock.calendarConnection.findUnique
        .mockResolvedValueOnce(expiringConnections[0])
        .mockResolvedValueOnce(expiringConnections[1]);
      prismaMock.calendarConnection.update.mockResolvedValue(expiringConnections[0]);

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new_token',
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);

      const mockMsalClient = {
        acquireTokenByRefreshToken: jest.fn().mockResolvedValue({
          accessToken: 'new_token',
          expiresOn: new Date(Date.now() + 3600 * 1000),
        }),
      };

      const { ConfidentialClientApplication } = require('@azure/msal-node');
      ConfidentialClientApplication.mockImplementation(() => mockMsalClient);

      await tokenRefreshService.scheduleTokenRefresh();

      expect(prismaMock.calendarConnection.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isConnected: true,
          deletedAt: null,
          tokenExpiresAt: {
            lt: expect.any(Date),
          },
        }),
      });
    });

    it('should handle failures gracefully and continue', async () => {
      const connections = [
        {
          ...mockGoogleConnection,
          id: 'conn1',
          tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
        {
          ...mockMicrosoftConnection,
          id: 'conn2',
          tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      ];

      prismaMock.calendarConnection.findMany.mockResolvedValue(connections);
      prismaMock.calendarConnection.findUnique
        .mockResolvedValueOnce(connections[0])
        .mockResolvedValueOnce(connections[0]) // For error handling
        .mockResolvedValueOnce(connections[1]);
      prismaMock.calendarConnection.update.mockResolvedValue(connections[0]);

      // First refresh fails
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockRejectedValue(new Error('Refresh failed')),
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);

      // Second refresh succeeds
      const mockMsalClient = {
        acquireTokenByRefreshToken: jest.fn().mockResolvedValue({
          accessToken: 'new_token',
          expiresOn: new Date(Date.now() + 3600 * 1000),
        }),
      };

      const { ConfidentialClientApplication } = require('@azure/msal-node');
      ConfidentialClientApplication.mockImplementation(() => mockMsalClient);

      // Should not throw, should log errors and continue
      await expect(tokenRefreshService.scheduleTokenRefresh()).resolves.toBeUndefined();
    });

    it('should not fail if no connections need refresh', async () => {
      prismaMock.calendarConnection.findMany.mockResolvedValue([]);

      await expect(tokenRefreshService.scheduleTokenRefresh()).resolves.toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle token that expires exactly at threshold', async () => {
      const connection = {
        ...mockGoogleConnection,
        tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // Exactly 5 minutes
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(connection);

      // Should return existing token (threshold is > 5 minutes, not >=)
      const token = await tokenRefreshService.checkAndRefreshToken(connection.id);

      expect(token).toBeDefined();
    });

    it('should handle negative expiry time (already expired)', async () => {
      const veryExpiredConnection = {
        ...mockGoogleConnection,
        tokenExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(veryExpiredConnection);
      prismaMock.calendarConnection.update.mockResolvedValue(veryExpiredConnection);

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'refreshed_token',
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);

      const token = await tokenRefreshService.checkAndRefreshToken(veryExpiredConnection.id);

      expect(token).toBe('refreshed_token');
    });
  });
});
