/**
 * Event Sync Service Tests
 *
 * Tests for calendar event syncing functionality
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CalendarProvider, SyncStatus, EventStatus } from '@prisma/client';
import { prismaMock } from '../mocks/prisma.mock';
import {
  mockGoogleConnection,
  mockMicrosoftConnection,
} from '../fixtures/calendars.fixture';
import { mockEvent, generateMockEvents } from '../fixtures/events.fixture';
import {
  mockGoogleEvent,
  mockGoogleEventsListResponse,
  mockMicrosoftEvent,
  mockMicrosoftEventsResponse,
} from '../fixtures/provider-responses.fixture';

// Mock modules
jest.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

jest.mock('googleapis');
jest.mock('@microsoft/microsoft-graph-client');
jest.mock('../../src/services/tokenRefreshService', () => ({
  default: {
    checkAndRefreshToken: jest.fn().mockResolvedValue('valid_access_token'),
  },
}));

jest.mock('../../src/services/auditService', () => ({
  default: {
    logCalendarSync: jest.fn(),
    logCalendarSyncFailure: jest.fn(),
  },
}));

// Import after mocks
import eventSyncService from '../../src/services/eventSyncService';
import tokenRefreshService from '../../src/services/tokenRefreshService';

describe('EventSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncCalendarEvents', () => {
    it('should sync Google calendar events successfully', async () => {
      const connectionId = mockGoogleConnection.id;

      // Mock database calls
      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarEvent.findUnique.mockResolvedValue(null); // New events
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      // Mock Google API
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

      const result = await eventSyncService.syncCalendarEvents(connectionId);

      expect(result.totalEvents).toBeGreaterThan(0);
      expect(result.newEvents).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(tokenRefreshService.checkAndRefreshToken).toHaveBeenCalledWith(connectionId);
    });

    it('should use incremental sync with sync token', async () => {
      const connectionId = mockGoogleConnection.id;
      const connectionWithToken = {
        ...mockGoogleConnection,
        syncToken: 'existing_sync_token',
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(connectionWithToken);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(connectionWithToken);

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: {
              items: [mockGoogleEvent],
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

      await eventSyncService.syncCalendarEvents(connectionId);

      // Should use sync token for incremental sync
      expect(mockCalendarApi.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          syncToken: 'existing_sync_token',
        })
      );
    });

    it('should fall back to full sync if sync token invalid', async () => {
      const connectionId = mockGoogleConnection.id;
      const connectionWithToken = {
        ...mockGoogleConnection,
        syncToken: 'invalid_sync_token',
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(connectionWithToken);
      prismaMock.calendarConnection.update.mockResolvedValue(connectionWithToken);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);

      const mockCalendarApi = {
        events: {
          list: jest
            .fn()
            .mockRejectedValueOnce({ code: 410, message: 'Sync token no longer valid' })
            .mockResolvedValueOnce({
              data: {
                items: [mockGoogleEvent],
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

      const result = await eventSyncService.syncCalendarEvents(connectionId);

      expect(mockCalendarApi.events.list).toHaveBeenCalledTimes(2); // Retry with full sync
      expect(result.totalEvents).toBeGreaterThan(0);
    });

    it('should handle deleted events', async () => {
      const connectionId = mockGoogleConnection.id;

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarEvent.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      const deletedEvent = {
        ...mockGoogleEvent,
        status: 'cancelled',
      };

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: {
              items: [deletedEvent],
              nextSyncToken: 'sync_token',
            },
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      await eventSyncService.syncCalendarEvents(connectionId);

      expect(prismaMock.calendarEvent.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          providerEventId: deletedEvent.id,
        }),
        data: expect.objectContaining({
          syncStatus: SyncStatus.DELETED,
        }),
      });
    });

    it('should handle recurring events', async () => {
      const connectionId = mockGoogleConnection.id;

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarEvent.findUnique.mockResolvedValue(null);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      const recurringEvent = {
        ...mockGoogleEvent,
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'],
      };

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: {
              items: [recurringEvent],
              nextSyncToken: 'sync_token',
            },
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      await eventSyncService.syncCalendarEvents(connectionId);

      expect(prismaMock.calendarEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            isRecurring: true,
            recurrenceRule: expect.stringContaining('FREQ=WEEKLY'),
          }),
        })
      );
    });

    it('should throw error for non-existent connection', async () => {
      prismaMock.calendarConnection.findUnique.mockResolvedValue(null);

      await expect(eventSyncService.syncCalendarEvents('invalid_id')).rejects.toThrow(
        'Calendar connection not found'
      );
    });

    it('should throw error for disconnected calendar', async () => {
      const disconnectedConnection = {
        ...mockGoogleConnection,
        isConnected: false,
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(disconnectedConnection);

      await expect(
        eventSyncService.syncCalendarEvents(disconnectedConnection.id)
      ).rejects.toThrow('Calendar connection is disconnected');
    });

    it('should update lastSyncedAt timestamp', async () => {
      const connectionId = mockGoogleConnection.id;

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: { items: [mockGoogleEvent], nextSyncToken: 'token' },
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      await eventSyncService.syncCalendarEvents(connectionId);

      expect(prismaMock.calendarConnection.update).toHaveBeenCalledWith({
        where: { id: connectionId },
        data: { lastSyncedAt: expect.any(Date) },
      });
    });
  });

  describe('syncMicrosoftEvents', () => {
    it('should sync Microsoft calendar events', async () => {
      const connectionId = mockMicrosoftConnection.id;

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockMicrosoftConnection);
      prismaMock.calendarEvent.findUnique.mockResolvedValue(null);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockMicrosoftConnection);

      // Mock Microsoft Graph API
      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        top: jest.fn().mockReturnThis(),
        orderby: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockMicrosoftEventsResponse),
      };

      const { Client } = require('@microsoft/microsoft-graph-client');
      Client.init = jest.fn().mockReturnValue(mockGraphClient);

      const result = await eventSyncService.syncCalendarEvents(connectionId);

      expect(result.totalEvents).toBeGreaterThan(0);
      expect(result.newEvents).toBeGreaterThan(0);
    });

    it('should use delta link for incremental sync', async () => {
      const connectionId = mockMicrosoftConnection.id;
      const connectionWithDelta = {
        ...mockMicrosoftConnection,
        syncToken: 'https://graph.microsoft.com/v1.0/delta?token=abc',
      };

      prismaMock.calendarConnection.findUnique.mockResolvedValue(connectionWithDelta);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(connectionWithDelta);

      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          value: [mockMicrosoftEvent],
          '@odata.deltaLink': 'new_delta_link',
        }),
      };

      const { Client } = require('@microsoft/microsoft-graph-client');
      Client.init = jest.fn().mockReturnValue(mockGraphClient);

      await eventSyncService.syncCalendarEvents(connectionId);

      expect(mockGraphClient.api).toHaveBeenCalledWith(connectionWithDelta.syncToken);
    });
  });

  describe('getEventsInRange', () => {
    it('should fetch events within date range', async () => {
      const userId = 'user_123';
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-28');

      const mockEvents = generateMockEvents(10, mockGoogleConnection.id);

      prismaMock.calendarEvent.findMany.mockResolvedValue(
        mockEvents.map((event) => ({
          ...event,
          calendarConnection: {
            provider: CalendarProvider.GOOGLE,
            calendarName: 'Test Calendar',
            calendarColor: '#1F77B4',
          },
        })) as any
      );

      const events = await eventSyncService.getEventsInRange(userId, startDate, endDate);

      expect(events).toHaveLength(10);
      expect(prismaMock.calendarEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            calendarConnection: {
              userId,
              isConnected: true,
              deletedAt: null,
            },
            syncStatus: SyncStatus.SYNCED,
            deletedAt: null,
          }),
        })
      );
    });

    it('should filter out deleted and cancelled events', async () => {
      const userId = 'user_123';
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-28');

      prismaMock.calendarEvent.findMany.mockResolvedValue([]);

      await eventSyncService.getEventsInRange(userId, startDate, endDate);

      expect(prismaMock.calendarEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            syncStatus: SyncStatus.SYNCED,
            deletedAt: null,
          }),
        })
      );
    });

    it('should handle events spanning date range', async () => {
      const userId = 'user_123';
      const startDate = new Date('2024-02-10');
      const endDate = new Date('2024-02-20');

      prismaMock.calendarEvent.findMany.mockResolvedValue([]);

      await eventSyncService.getEventsInRange(userId, startDate, endDate);

      // Should query for events that start, end, or overlap with the range
      expect(prismaMock.calendarEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('should sort events by start time', async () => {
      const userId = 'user_123';
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-28');

      prismaMock.calendarEvent.findMany.mockResolvedValue([]);

      await eventSyncService.getEventsInRange(userId, startDate, endDate);

      expect(prismaMock.calendarEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            startTime: 'asc',
          },
        })
      );
    });
  });

  describe('syncAllUserCalendars', () => {
    it('should sync all connected calendars for a user', async () => {
      const userId = 'user_123';
      const connections = [mockGoogleConnection, mockMicrosoftConnection];

      prismaMock.calendarConnection.findMany.mockResolvedValue(connections);
      prismaMock.calendarConnection.findUnique
        .mockResolvedValueOnce(mockGoogleConnection)
        .mockResolvedValueOnce(mockMicrosoftConnection);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: { items: [mockGoogleEvent], nextSyncToken: 'token' },
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        top: jest.fn().mockReturnThis(),
        orderby: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockMicrosoftEventsResponse),
      };

      const { Client } = require('@microsoft/microsoft-graph-client');
      Client.init = jest.fn().mockReturnValue(mockGraphClient);

      const results = await eventSyncService.syncAllUserCalendars(userId);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.totalEvents >= 0)).toBe(true);
    });

    it('should continue syncing even if one calendar fails', async () => {
      const userId = 'user_123';
      const connections = [mockGoogleConnection, mockMicrosoftConnection];

      prismaMock.calendarConnection.findMany.mockResolvedValue(connections);
      prismaMock.calendarConnection.findUnique
        .mockResolvedValueOnce(mockGoogleConnection)
        .mockResolvedValueOnce(mockMicrosoftConnection);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      // First calendar succeeds
      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: { items: [mockGoogleEvent], nextSyncToken: 'token' },
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      // Second calendar fails
      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        top: jest.fn().mockReturnThis(),
        orderby: jest.fn().mockReturnThis(),
        get: jest.fn().mockRejectedValue(new Error('API Error')),
      };

      const { Client } = require('@microsoft/microsoft-graph-client');
      Client.init = jest.fn().mockReturnValue(mockGraphClient);

      const results = await eventSyncService.syncAllUserCalendars(userId);

      expect(results).toHaveLength(2);
      expect(results[0].errors).toHaveLength(0); // First succeeded
      expect(results[1].errors.length).toBeGreaterThan(0); // Second failed
    });
  });

  describe('Performance', () => {
    it('should handle syncing 1000+ events efficiently', async () => {
      const connectionId = mockGoogleConnection.id;
      const largeEventList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockGoogleEvent,
        id: `event_${i}`,
        summary: `Event ${i}`,
      }));

      prismaMock.calendarConnection.findUnique.mockResolvedValue(mockGoogleConnection);
      prismaMock.calendarEvent.findUnique.mockResolvedValue(null);
      prismaMock.calendarEvent.upsert.mockResolvedValue(mockEvent);
      prismaMock.calendarConnection.update.mockResolvedValue(mockGoogleConnection);

      const mockCalendarApi = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: {
              items: largeEventList,
              nextSyncToken: 'token',
            },
          }),
        },
      };

      const { google } = require('googleapis');
      google.auth.OAuth2 = jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      }));
      google.calendar = jest.fn().mockReturnValue(mockCalendarApi);

      const start = Date.now();
      const result = await eventSyncService.syncCalendarEvents(connectionId);
      const duration = Date.now() - start;

      expect(result.totalEvents).toBe(1000);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
