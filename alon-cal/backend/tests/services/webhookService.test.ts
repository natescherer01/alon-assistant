/**
 * Webhook Service Comprehensive Tests
 *
 * Tests for webhook subscription management, notification processing,
 * renewal logic, and error handling
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { CalendarProvider } from '@prisma/client';

// Mock dependencies before importing the service
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    calendarConnection: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    webhookSubscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../../src/integrations/microsoft');
jest.mock('../../src/services/eventSyncService');
jest.mock('../../src/services/tokenRefreshService');
jest.mock('../../src/utils/logger');

import { prisma } from '../../src/lib/prisma';
import webhookService from '../../src/services/webhookService';
import { MicrosoftCalendarClient } from '../../src/integrations/microsoft';
import eventSyncService from '../../src/services/eventSyncService';
import tokenRefreshService from '../../src/services/tokenRefreshService';

describe('WebhookService - Comprehensive Tests', () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;
  const mockTokenRefreshService = tokenRefreshService as jest.Mocked<typeof tokenRefreshService>;
  const mockEventSyncService = eventSyncService as jest.Mocked<typeof eventSyncService>;

  let mockMicrosoftClient: jest.Mocked<MicrosoftCalendarClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock MicrosoftCalendarClient
    mockMicrosoftClient = {
      subscribeToCalendar: jest.fn(),
      renewSubscription: jest.fn(),
      deleteSubscription: jest.fn(),
    } as any;

    (MicrosoftCalendarClient as jest.MockedClass<any>).mockImplementation(
      () => mockMicrosoftClient
    );

    // Set API_URL environment variable
    process.env.API_URL = 'https://api.example.com';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createSubscription', () => {
    it('should create new webhook subscription', async () => {
      const connectionId = 'conn123';
      const userId = 'user123';
      const calendarId = 'cal123';
      const accessToken = 'access_token_123';

      const mockConnection = {
        id: connectionId,
        userId,
        calendarId,
        provider: CalendarProvider.MICROSOFT,
        isConnected: true,
        deletedAt: null,
      };

      const mockSubscription = {
        id: 'sub123',
        resource: `/me/calendars/${calendarId}/events`,
        changeType: 'created,updated,deleted',
        clientState: 'client_state_123',
        notificationUrl: 'https://api.example.com/api/webhooks/microsoft/events',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(mockConnection as any);
      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(null);
      mockTokenRefreshService.checkAndRefreshToken.mockResolvedValue(accessToken);
      mockMicrosoftClient.subscribeToCalendar.mockResolvedValue(mockSubscription);
      mockPrisma.webhookSubscription.create.mockResolvedValue({
        id: 'db_sub_123',
        calendarConnectionId: connectionId,
        provider: CalendarProvider.MICROSOFT,
        subscriptionId: mockSubscription.id,
        resourcePath: mockSubscription.resource,
        expirationDateTime: new Date(mockSubscription.expirationDateTime),
        clientState: mockSubscription.clientState,
        notificationUrl: mockSubscription.notificationUrl,
        isActive: true,
        lastNotificationAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await webhookService.createSubscription(connectionId, userId);

      expect(mockPrisma.calendarConnection.findUnique).toHaveBeenCalledWith({
        where: { id: connectionId, userId, deletedAt: null },
      });
      expect(mockTokenRefreshService.checkAndRefreshToken).toHaveBeenCalledWith(
        connectionId,
        userId
      );
      expect(mockMicrosoftClient.subscribeToCalendar).toHaveBeenCalledWith(
        accessToken,
        calendarId,
        'https://api.example.com/api/webhooks/microsoft/events',
        expect.any(String)
      );
      expect(mockPrisma.webhookSubscription.create).toHaveBeenCalled();
      expect(result.subscriptionId).toBe(mockSubscription.id);
    });

    it('should return existing subscription if already exists', async () => {
      const connectionId = 'conn123';
      const userId = 'user123';

      const mockConnection = {
        id: connectionId,
        userId,
        provider: CalendarProvider.MICROSOFT,
        deletedAt: null,
      };

      const existingSubscription = {
        id: 'existing_sub',
        subscriptionId: 'sub123',
        isActive: true,
      };

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(mockConnection as any);
      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(existingSubscription as any);

      const result = await webhookService.createSubscription(connectionId, userId);

      expect(result).toEqual(existingSubscription);
      expect(mockMicrosoftClient.subscribeToCalendar).not.toHaveBeenCalled();
    });

    it('should throw error if connection not found', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      await expect(
        webhookService.createSubscription('nonexistent', 'user123')
      ).rejects.toThrow('Calendar connection not found');
    });

    it('should throw error for non-Microsoft providers', async () => {
      const mockConnection = {
        id: 'conn123',
        userId: 'user123',
        provider: CalendarProvider.GOOGLE,
        deletedAt: null,
      };

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(mockConnection as any);

      await expect(
        webhookService.createSubscription('conn123', 'user123')
      ).rejects.toThrow('Webhooks only supported for Microsoft calendars');
    });

    it('should handle token refresh errors', async () => {
      const mockConnection = {
        id: 'conn123',
        userId: 'user123',
        calendarId: 'cal123',
        provider: CalendarProvider.MICROSOFT,
        deletedAt: null,
      };

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(mockConnection as any);
      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(null);
      mockTokenRefreshService.checkAndRefreshToken.mockRejectedValue(
        new Error('Token refresh failed')
      );

      await expect(
        webhookService.createSubscription('conn123', 'user123')
      ).rejects.toThrow('Failed to create webhook subscription');
    });

    it('should handle Microsoft Graph API errors', async () => {
      const mockConnection = {
        id: 'conn123',
        userId: 'user123',
        calendarId: 'cal123',
        provider: CalendarProvider.MICROSOFT,
        deletedAt: null,
      };

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(mockConnection as any);
      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(null);
      mockTokenRefreshService.checkAndRefreshToken.mockResolvedValue('token');
      mockMicrosoftClient.subscribeToCalendar.mockRejectedValue(
        new Error('Subscription validation failed')
      );

      await expect(
        webhookService.createSubscription('conn123', 'user123')
      ).rejects.toThrow('Failed to create webhook subscription');
    });

    it('should use localhost URL in development', async () => {
      process.env.API_URL = undefined;

      const mockConnection = {
        id: 'conn123',
        userId: 'user123',
        calendarId: 'cal123',
        provider: CalendarProvider.MICROSOFT,
        deletedAt: null,
      };

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(mockConnection as any);
      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(null);
      mockTokenRefreshService.checkAndRefreshToken.mockResolvedValue('token');
      mockMicrosoftClient.subscribeToCalendar.mockResolvedValue({
        id: 'sub123',
        resource: '/resource',
        changeType: 'created,updated,deleted',
        notificationUrl: 'http://localhost:3001/api/webhooks/microsoft/events',
        expirationDateTime: new Date().toISOString(),
      } as any);
      mockPrisma.webhookSubscription.create.mockResolvedValue({} as any);

      await webhookService.createSubscription('conn123', 'user123');

      expect(mockMicrosoftClient.subscribeToCalendar).toHaveBeenCalledWith(
        'token',
        'cal123',
        'http://localhost:3001/api/webhooks/microsoft/events',
        expect.any(String)
      );

      process.env.API_URL = 'https://api.example.com';
    });
  });

  describe('renewSubscription', () => {
    it('should renew active subscription', async () => {
      const subscriptionId = 'sub123';
      const connectionId = 'conn123';
      const userId = 'user123';

      const mockSubscription = {
        id: subscriptionId,
        subscriptionId: 'ms_sub_123',
        isActive: true,
        calendarConnection: {
          id: connectionId,
          userId,
        },
      };

      const renewedSubscription = {
        id: 'ms_sub_123',
        resource: '/resource',
        changeType: 'created,updated,deleted',
        notificationUrl: 'https://webhook.url',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockTokenRefreshService.checkAndRefreshToken.mockResolvedValue('token');
      mockMicrosoftClient.renewSubscription.mockResolvedValue(renewedSubscription as any);
      mockPrisma.webhookSubscription.update.mockResolvedValue({
        ...mockSubscription,
        expirationDateTime: new Date(renewedSubscription.expirationDateTime),
      } as any);

      const result = await webhookService.renewSubscription(subscriptionId);

      expect(mockTokenRefreshService.checkAndRefreshToken).toHaveBeenCalledWith(
        connectionId,
        userId
      );
      expect(mockMicrosoftClient.renewSubscription).toHaveBeenCalledWith('token', 'ms_sub_123');
      expect(mockPrisma.webhookSubscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: {
          expirationDateTime: new Date(renewedSubscription.expirationDateTime),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(null);

      await expect(webhookService.renewSubscription('nonexistent')).rejects.toThrow(
        'Subscription not found'
      );
    });

    it('should throw error if subscription not active', async () => {
      const mockSubscription = {
        id: 'sub123',
        isActive: false,
      };

      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(mockSubscription as any);

      await expect(webhookService.renewSubscription('sub123')).rejects.toThrow(
        'Subscription is not active'
      );
    });

    it('should mark subscription inactive if not found on Microsoft', async () => {
      const subscriptionId = 'sub123';
      const mockSubscription = {
        id: subscriptionId,
        subscriptionId: 'ms_sub_123',
        isActive: true,
        calendarConnection: {
          id: 'conn123',
          userId: 'user123',
        },
      };

      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockTokenRefreshService.checkAndRefreshToken.mockResolvedValue('token');
      mockMicrosoftClient.renewSubscription.mockRejectedValue(
        new Error('SUBSCRIPTION_NOT_FOUND')
      );
      mockPrisma.webhookSubscription.update.mockResolvedValue({} as any);

      await expect(webhookService.renewSubscription(subscriptionId)).rejects.toThrow(
        'Subscription not found on provider'
      );

      expect(mockPrisma.webhookSubscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: { isActive: false },
      });
    });

    it('should handle token refresh errors', async () => {
      const mockSubscription = {
        id: 'sub123',
        subscriptionId: 'ms_sub_123',
        isActive: true,
        calendarConnection: {
          id: 'conn123',
          userId: 'user123',
        },
      };

      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockTokenRefreshService.checkAndRefreshToken.mockRejectedValue(
        new Error('Token expired')
      );

      await expect(webhookService.renewSubscription('sub123')).rejects.toThrow(
        'Failed to renew subscription'
      );
    });
  });

  describe('deleteSubscription', () => {
    it('should delete active subscription', async () => {
      const connectionId = 'conn123';
      const userId = 'user123';

      const mockSubscription = {
        id: 'sub123',
        subscriptionId: 'ms_sub_123',
        isActive: true,
        calendarConnection: {
          id: connectionId,
          userId,
        },
      };

      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(mockSubscription as any);
      mockTokenRefreshService.checkAndRefreshToken.mockResolvedValue('token');
      mockMicrosoftClient.deleteSubscription.mockResolvedValue(undefined);
      mockPrisma.webhookSubscription.update.mockResolvedValue({} as any);

      await webhookService.deleteSubscription(connectionId, userId);

      expect(mockMicrosoftClient.deleteSubscription).toHaveBeenCalledWith('token', 'ms_sub_123');
      expect(mockPrisma.webhookSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub123' },
        data: { isActive: false },
      });
    });

    it('should return early if no active subscription', async () => {
      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(null);

      await webhookService.deleteSubscription('conn123', 'user123');

      expect(mockMicrosoftClient.deleteSubscription).not.toHaveBeenCalled();
    });

    it('should throw error if unauthorized', async () => {
      const mockSubscription = {
        id: 'sub123',
        calendarConnection: {
          userId: 'other_user',
        },
      };

      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(mockSubscription as any);

      await expect(webhookService.deleteSubscription('conn123', 'user123')).rejects.toThrow(
        'Unauthorized: Subscription does not belong to this user'
      );
    });

    it('should handle Microsoft API errors', async () => {
      const mockSubscription = {
        id: 'sub123',
        subscriptionId: 'ms_sub_123',
        isActive: true,
        calendarConnection: {
          id: 'conn123',
          userId: 'user123',
        },
      };

      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(mockSubscription as any);
      mockTokenRefreshService.checkAndRefreshToken.mockResolvedValue('token');
      mockMicrosoftClient.deleteSubscription.mockRejectedValue(new Error('API Error'));

      await expect(webhookService.deleteSubscription('conn123', 'user123')).rejects.toThrow(
        'Failed to delete subscription'
      );
    });
  });

  describe('processMicrosoftNotifications', () => {
    it('should process valid notifications', async () => {
      const notifications = [
        {
          subscriptionId: 'ms_sub_123',
          subscriptionExpirationDateTime: new Date().toISOString(),
          changeType: 'updated',
          resource: '/me/calendars/cal123/events',
          clientState: 'secret_state',
          tenantId: 'tenant123',
        },
      ];

      const mockSubscription = {
        id: 'sub123',
        subscriptionId: 'ms_sub_123',
        isActive: true,
        clientState: 'secret_state',
        calendarConnectionId: 'conn123',
        calendarConnection: {
          userId: 'user123',
        },
      };

      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(mockSubscription as any);
      mockPrisma.webhookSubscription.update.mockResolvedValue({} as any);
      mockEventSyncService.syncCalendarEvents.mockResolvedValue({} as any);

      await webhookService.processMicrosoftNotifications(notifications);

      expect(mockPrisma.webhookSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub123' },
        data: { lastNotificationAt: expect.any(Date) },
      });
      expect(mockEventSyncService.syncCalendarEvents).toHaveBeenCalledWith('conn123', 'user123');
    });

    it('should skip notification for unknown subscription', async () => {
      const notifications = [
        {
          subscriptionId: 'unknown_sub',
          subscriptionExpirationDateTime: new Date().toISOString(),
          changeType: 'created',
          resource: '/resource',
          tenantId: 'tenant123',
        },
      ];

      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(null);

      await webhookService.processMicrosoftNotifications(notifications);

      expect(mockEventSyncService.syncCalendarEvents).not.toHaveBeenCalled();
    });

    it('should reject notification with invalid client state', async () => {
      const notifications = [
        {
          subscriptionId: 'ms_sub_123',
          subscriptionExpirationDateTime: new Date().toISOString(),
          changeType: 'updated',
          resource: '/resource',
          clientState: 'wrong_state',
          tenantId: 'tenant123',
        },
      ];

      const mockSubscription = {
        id: 'sub123',
        subscriptionId: 'ms_sub_123',
        isActive: true,
        clientState: 'correct_state',
      };

      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(mockSubscription as any);

      await webhookService.processMicrosoftNotifications(notifications);

      expect(mockEventSyncService.syncCalendarEvents).not.toHaveBeenCalled();
    });

    it('should process notification without client state validation', async () => {
      const notifications = [
        {
          subscriptionId: 'ms_sub_123',
          subscriptionExpirationDateTime: new Date().toISOString(),
          changeType: 'created',
          resource: '/resource',
          tenantId: 'tenant123',
        },
      ];

      const mockSubscription = {
        id: 'sub123',
        subscriptionId: 'ms_sub_123',
        isActive: true,
        clientState: 'some_state',
        calendarConnectionId: 'conn123',
        calendarConnection: {
          userId: 'user123',
        },
      };

      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(mockSubscription as any);
      mockPrisma.webhookSubscription.update.mockResolvedValue({} as any);
      mockEventSyncService.syncCalendarEvents.mockResolvedValue({} as any);

      await webhookService.processMicrosoftNotifications(notifications);

      expect(mockEventSyncService.syncCalendarEvents).toHaveBeenCalled();
    });

    it('should continue processing other notifications if one fails', async () => {
      const notifications = [
        {
          subscriptionId: 'sub1',
          subscriptionExpirationDateTime: new Date().toISOString(),
          changeType: 'created',
          resource: '/resource',
          tenantId: 'tenant123',
        },
        {
          subscriptionId: 'sub2',
          subscriptionExpirationDateTime: new Date().toISOString(),
          changeType: 'updated',
          resource: '/resource',
          tenantId: 'tenant123',
        },
      ];

      mockPrisma.webhookSubscription.findFirst
        .mockResolvedValueOnce({
          id: 'sub1',
          subscriptionId: 'sub1',
          isActive: true,
          calendarConnectionId: 'conn1',
          calendarConnection: { userId: 'user1' },
        } as any)
        .mockResolvedValueOnce({
          id: 'sub2',
          subscriptionId: 'sub2',
          isActive: true,
          calendarConnectionId: 'conn2',
          calendarConnection: { userId: 'user2' },
        } as any);

      mockPrisma.webhookSubscription.update.mockResolvedValue({} as any);
      mockEventSyncService.syncCalendarEvents
        .mockRejectedValueOnce(new Error('Sync failed'))
        .mockResolvedValueOnce({} as any);

      await webhookService.processMicrosoftNotifications(notifications);

      expect(mockEventSyncService.syncCalendarEvents).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple notifications for same subscription', async () => {
      const notifications = [
        {
          subscriptionId: 'ms_sub_123',
          subscriptionExpirationDateTime: new Date().toISOString(),
          changeType: 'created',
          resource: '/resource',
          tenantId: 'tenant123',
        },
        {
          subscriptionId: 'ms_sub_123',
          subscriptionExpirationDateTime: new Date().toISOString(),
          changeType: 'updated',
          resource: '/resource',
          tenantId: 'tenant123',
        },
      ];

      const mockSubscription = {
        id: 'sub123',
        subscriptionId: 'ms_sub_123',
        isActive: true,
        calendarConnectionId: 'conn123',
        calendarConnection: {
          userId: 'user123',
        },
      };

      mockPrisma.webhookSubscription.findFirst.mockResolvedValue(mockSubscription as any);
      mockPrisma.webhookSubscription.update.mockResolvedValue({} as any);
      mockEventSyncService.syncCalendarEvents.mockResolvedValue({} as any);

      await webhookService.processMicrosoftNotifications(notifications);

      expect(mockEventSyncService.syncCalendarEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('renewExpiringSubscriptions', () => {
    it('should renew subscriptions expiring within 24 hours', async () => {
      const expiringSubscriptions = [
        {
          id: 'sub1',
          subscriptionId: 'ms_sub_1',
          expirationDateTime: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
          isActive: true,
        },
        {
          id: 'sub2',
          subscriptionId: 'ms_sub_2',
          expirationDateTime: new Date(Date.now() + 20 * 60 * 60 * 1000), // 20 hours
          isActive: true,
        },
      ];

      mockPrisma.webhookSubscription.findMany.mockResolvedValue(expiringSubscriptions as any);
      mockPrisma.webhookSubscription.findUnique
        .mockResolvedValueOnce({
          ...expiringSubscriptions[0],
          calendarConnection: { id: 'conn1', userId: 'user1' },
        } as any)
        .mockResolvedValueOnce({
          ...expiringSubscriptions[1],
          calendarConnection: { id: 'conn2', userId: 'user2' },
        } as any);

      mockTokenRefreshService.checkAndRefreshToken.mockResolvedValue('token');
      mockMicrosoftClient.renewSubscription.mockResolvedValue({
        id: 'ms_sub',
        resource: '/resource',
        changeType: 'created,updated,deleted',
        notificationUrl: 'https://webhook.url',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      } as any);
      mockPrisma.webhookSubscription.update.mockResolvedValue({} as any);

      await webhookService.renewExpiringSubscriptions();

      expect(mockPrisma.webhookSubscription.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          provider: CalendarProvider.MICROSOFT,
          expirationDateTime: {
            lte: expect.any(Date),
          },
        },
      });
      expect(mockMicrosoftClient.renewSubscription).toHaveBeenCalledTimes(2);
    });

    it('should continue renewing other subscriptions if one fails', async () => {
      const expiringSubscriptions = [
        { id: 'sub1', expirationDateTime: new Date(Date.now() + 12 * 60 * 60 * 1000) },
        { id: 'sub2', expirationDateTime: new Date(Date.now() + 20 * 60 * 60 * 1000) },
      ];

      mockPrisma.webhookSubscription.findMany.mockResolvedValue(expiringSubscriptions as any);
      mockPrisma.webhookSubscription.findUnique
        .mockResolvedValueOnce({
          ...expiringSubscriptions[0],
          subscriptionId: 'ms_sub_1',
          isActive: true,
          calendarConnection: { id: 'conn1', userId: 'user1' },
        } as any)
        .mockResolvedValueOnce({
          ...expiringSubscriptions[1],
          subscriptionId: 'ms_sub_2',
          isActive: true,
          calendarConnection: { id: 'conn2', userId: 'user2' },
        } as any);

      mockTokenRefreshService.checkAndRefreshToken.mockResolvedValue('token');
      mockMicrosoftClient.renewSubscription
        .mockRejectedValueOnce(new Error('Renewal failed'))
        .mockResolvedValueOnce({
          id: 'ms_sub_2',
          resource: '/resource',
          changeType: 'created,updated,deleted',
          notificationUrl: 'https://webhook.url',
          expirationDateTime: new Date().toISOString(),
        } as any);
      mockPrisma.webhookSubscription.update.mockResolvedValue({} as any);

      await webhookService.renewExpiringSubscriptions();

      // Should have attempted to renew both
      expect(mockPrisma.webhookSubscription.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should handle no expiring subscriptions', async () => {
      mockPrisma.webhookSubscription.findMany.mockResolvedValue([]);

      await webhookService.renewExpiringSubscriptions();

      expect(mockMicrosoftClient.renewSubscription).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredSubscriptions', () => {
    it('should mark expired subscriptions as inactive', async () => {
      mockPrisma.webhookSubscription.updateMany.mockResolvedValue({ count: 3 } as any);

      await webhookService.cleanupExpiredSubscriptions();

      expect(mockPrisma.webhookSubscription.updateMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          expirationDateTime: {
            lt: expect.any(Date),
          },
        },
        data: {
          isActive: false,
        },
      });
    });

    it('should handle no expired subscriptions', async () => {
      mockPrisma.webhookSubscription.updateMany.mockResolvedValue({ count: 0 } as any);

      await webhookService.cleanupExpiredSubscriptions();

      expect(mockPrisma.webhookSubscription.updateMany).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrisma.webhookSubscription.updateMany.mockRejectedValue(
        new Error('Database connection lost')
      );

      // Should not throw
      await expect(webhookService.cleanupExpiredSubscriptions()).resolves.toBeUndefined();
    });
  });
});
