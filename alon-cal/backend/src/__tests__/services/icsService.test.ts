/**
 * ICS Service Tests
 *
 * Tests for ICS service business logic
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import icsService from '../../../services/icsService';
import { CalendarProvider, EventStatus, SyncStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../../../lib/prisma');
jest.mock('../../../utils/encryption');
jest.mock('../../../utils/urlValidator');
jest.mock('../../../integrations/ics/icsClient');
jest.mock('../../../services/auditService');

describe('ICS Service', () => {
  let mockPrisma: any;
  let mockEncryption: any;
  let mockIcsClient: any;
  let mockUrlValidator: any;
  let mockAuditService: any;

  const testUserId = 'user-123';
  const testUrl = 'https://example.com/calendar.ics';
  const testConnectionId = 'conn-123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Prisma
    mockPrisma = require('../../../lib/prisma').prisma;
    mockPrisma.calendarConnection = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    mockPrisma.calendarEvent = {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };

    // Mock encryption
    mockEncryption = require('../../../utils/encryption');
    mockEncryption.encryptToken = jest.fn((token: string) => `encrypted_${token}`);
    mockEncryption.decryptToken = jest.fn((token: string) => token.replace('encrypted_', ''));

    // Mock URL validator
    mockUrlValidator = require('../../../utils/urlValidator');
    mockUrlValidator.validateIcsUrl = jest.fn().mockResolvedValue({ valid: true });

    // Mock ICS client
    mockIcsClient = require('../../../integrations/ics/icsClient').default;
    mockIcsClient.validateFeed = jest.fn();
    mockIcsClient.fetchFeed = jest.fn();
    mockIcsClient.parseEvents = jest.fn();

    // Mock audit service
    mockAuditService = require('../../../services/auditService').default;
    mockAuditService.logCalendarConnect = jest.fn();
    mockAuditService.logCalendarSync = jest.fn();
    mockAuditService.logCalendarSyncFailure = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateIcsUrl', () => {
    it('should return valid result for valid URL', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'Test Calendar',
        eventCount: 10,
      });

      const result = await icsService.validateIcsUrl(testUrl);

      expect(result.valid).toBe(true);
      expect(result.calendarName).toBe('Test Calendar');
      expect(result.eventCount).toBe(10);
    });

    it('should return error for invalid URL (SSRF)', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({
        valid: false,
        error: 'Private IP detected',
      });

      const result = await icsService.validateIcsUrl(testUrl);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IP');
    });

    it('should return error for unparseable feed', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: false,
        error: 'Invalid ICS format',
      });

      const result = await icsService.validateIcsUrl(testUrl);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle validation errors gracefully', async () => {
      mockUrlValidator.validateIcsUrl.mockRejectedValue(new Error('Network error'));

      const result = await icsService.validateIcsUrl(testUrl);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('createIcsConnection', () => {
    it('should create connection with encrypted URL', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'My Calendar',
        eventCount: 5,
      });
      mockPrisma.calendarConnection.findFirst.mockResolvedValue(null);
      mockPrisma.calendarConnection.create.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        calendarId: 'cal-123',
        calendarName: 'My Calendar',
        icsUrl: 'encrypted_url',
        isReadOnly: true,
        isConnected: true,
        createdAt: new Date(),
      });

      const connection = await icsService.createIcsConnection(testUserId, testUrl, 'My Calendar');

      expect(connection).toBeDefined();
      expect(mockEncryption.encryptToken).toHaveBeenCalledWith(testUrl);
      expect(mockPrisma.calendarConnection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: testUserId,
            provider: CalendarProvider.ICS,
            isReadOnly: true,
          }),
        })
      );
    });

    it('should set isReadOnly to true', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'Test Calendar',
        eventCount: 0,
      });
      mockPrisma.calendarConnection.findFirst.mockResolvedValue(null);
      mockPrisma.calendarConnection.create.mockResolvedValue({
        id: testConnectionId,
        isReadOnly: true,
      });

      await icsService.createIcsConnection(testUserId, testUrl);

      expect(mockPrisma.calendarConnection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isReadOnly: true,
          }),
        })
      );
    });

    it('should throw error if URL validation fails', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({
        valid: false,
        error: 'Invalid URL',
      });

      await expect(
        icsService.createIcsConnection(testUserId, testUrl)
      ).rejects.toThrow('Invalid ICS URL');
    });

    it('should throw error if connection already exists', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'Test',
        eventCount: 0,
      });
      mockPrisma.calendarConnection.findFirst.mockResolvedValue({
        id: 'existing-conn',
      });

      await expect(
        icsService.createIcsConnection(testUserId, testUrl)
      ).rejects.toThrow('already connected');
    });

    it('should use custom display name if provided', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'Original Name',
        eventCount: 0,
      });
      mockPrisma.calendarConnection.findFirst.mockResolvedValue(null);
      mockPrisma.calendarConnection.create.mockResolvedValue({
        id: testConnectionId,
        calendarName: 'Custom Name',
      });

      await icsService.createIcsConnection(testUserId, testUrl, 'Custom Name');

      expect(mockPrisma.calendarConnection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            calendarName: 'Custom Name',
          }),
        })
      );
    });

    it('should log audit event', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'Test',
        eventCount: 0,
      });
      mockPrisma.calendarConnection.findFirst.mockResolvedValue(null);
      mockPrisma.calendarConnection.create.mockResolvedValue({
        id: testConnectionId,
      });

      await icsService.createIcsConnection(testUserId, testUrl);

      expect(mockAuditService.logCalendarConnect).toHaveBeenCalledWith(
        testUserId,
        testConnectionId,
        CalendarProvider.ICS
      );
    });
  });

  describe('updateIcsConnection', () => {
    it('should update URL and re-sync', async () => {
      const newUrl = 'https://example.com/new-calendar.ics';

      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_old_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'New Calendar',
        eventCount: 3,
      });
      mockPrisma.calendarConnection.update.mockResolvedValue({
        id: testConnectionId,
        icsUrl: 'encrypted_new_url',
      });

      const result = await icsService.updateIcsConnection(
        testConnectionId,
        testUserId,
        { url: newUrl }
      );

      expect(mockEncryption.encryptToken).toHaveBeenCalledWith(newUrl);
      expect(mockPrisma.calendarConnection.update).toHaveBeenCalled();
    });

    it('should update display name', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
      });
      mockPrisma.calendarConnection.update.mockResolvedValue({
        id: testConnectionId,
        calendarName: 'New Name',
      });

      await icsService.updateIcsConnection(
        testConnectionId,
        testUserId,
        { displayName: 'New Name' }
      );

      expect(mockPrisma.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            calendarName: 'New Name',
          }),
        })
      );
    });

    it('should reset ETag and Last-Modified when URL changes', async () => {
      const newUrl = 'https://example.com/new-calendar.ics';

      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'New',
        eventCount: 0,
      });
      mockPrisma.calendarConnection.update.mockResolvedValue({
        id: testConnectionId,
      });

      await icsService.updateIcsConnection(
        testConnectionId,
        testUserId,
        { url: newUrl }
      );

      expect(mockPrisma.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            icsETag: null,
            icsLastModified: null,
          }),
        })
      );
    });

    it('should throw error if connection not found', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      await expect(
        icsService.updateIcsConnection(testConnectionId, testUserId, {})
      ).rejects.toThrow('not found');
    });

    it('should throw error if URL validation fails', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({
        valid: false,
        error: 'Invalid',
      });

      await expect(
        icsService.updateIcsConnection(testConnectionId, testUserId, { url: 'bad-url' })
      ).rejects.toThrow('Invalid ICS URL');
    });
  });

  describe('syncIcsEvents', () => {
    const mockParsedEvents = [
      {
        uid: 'event-1',
        summary: 'Event 1',
        description: 'Description 1',
        location: 'Location 1',
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T11:00:00Z'),
        isAllDay: false,
        timezone: 'UTC',
        status: 'CONFIRMED' as const,
        isRecurring: false,
      },
      {
        uid: 'event-2',
        summary: 'Event 2',
        description: 'Description 2',
        location: 'Location 2',
        start: new Date('2025-01-16T14:00:00Z'),
        end: new Date('2025-01-16T15:00:00Z'),
        isAllDay: false,
        timezone: 'UTC',
        status: 'CONFIRMED' as const,
        isRecurring: false,
      },
    ];

    it('should create new events', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockResolvedValue({
        modified: true,
        content: 'ics content',
        etag: '"abc123"',
        lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
      });
      mockIcsClient.parseEvents.mockResolvedValue(mockParsedEvents);
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.calendarEvent.create.mockResolvedValue({});
      mockPrisma.calendarConnection.update.mockResolvedValue({});

      const result = await icsService.syncIcsEvents(testConnectionId);

      expect(result.success).toBe(true);
      expect(result.eventsAdded).toBe(2);
      expect(result.eventsUpdated).toBe(0);
      expect(result.eventsDeleted).toBe(0);
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalledTimes(2);
    });

    it('should update existing events', async () => {
      const existingEvents = [
        {
          id: 'db-event-1',
          providerEventId: 'event-1',
          title: 'Old Title',
        },
      ];

      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockResolvedValue({
        modified: true,
        content: 'ics content',
        etag: null,
        lastModified: null,
      });
      mockIcsClient.parseEvents.mockResolvedValue([mockParsedEvents[0]]);
      mockPrisma.calendarEvent.findMany.mockResolvedValue(existingEvents);
      mockPrisma.calendarEvent.update.mockResolvedValue({});
      mockPrisma.calendarConnection.update.mockResolvedValue({});

      const result = await icsService.syncIcsEvents(testConnectionId);

      expect(result.success).toBe(true);
      expect(result.eventsAdded).toBe(0);
      expect(result.eventsUpdated).toBe(1);
      expect(result.eventsDeleted).toBe(0);
      expect(mockPrisma.calendarEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'db-event-1' },
          data: expect.objectContaining({
            title: 'Event 1',
          }),
        })
      );
    });

    it('should delete removed events', async () => {
      const existingEvents = [
        {
          id: 'db-event-1',
          providerEventId: 'event-1',
        },
        {
          id: 'db-event-removed',
          providerEventId: 'event-removed',
        },
      ];

      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockResolvedValue({
        modified: true,
        content: 'ics content',
        etag: null,
        lastModified: null,
      });
      mockIcsClient.parseEvents.mockResolvedValue([mockParsedEvents[0]]);
      mockPrisma.calendarEvent.findMany.mockResolvedValue(existingEvents);
      mockPrisma.calendarEvent.update.mockResolvedValue({});
      mockPrisma.calendarConnection.update.mockResolvedValue({});

      const result = await icsService.syncIcsEvents(testConnectionId);

      expect(result.success).toBe(true);
      expect(result.eventsDeleted).toBe(1);
      expect(mockPrisma.calendarEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'db-event-removed' },
          data: expect.objectContaining({
            syncStatus: SyncStatus.DELETED,
            deletedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should use ETag for caching', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
        icsETag: '"old-etag"',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockResolvedValue({
        modified: false,
        content: null,
        etag: '"old-etag"',
        lastModified: null,
      });

      const result = await icsService.syncIcsEvents(testConnectionId);

      expect(result.success).toBe(true);
      expect(result.eventsAdded).toBe(0);
      expect(mockIcsClient.fetchFeed).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          etag: '"old-etag"',
        })
      );
    });

    it('should use Last-Modified for caching', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
        icsLastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockResolvedValue({
        modified: false,
        content: null,
        etag: null,
        lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
      });

      const result = await icsService.syncIcsEvents(testConnectionId);

      expect(mockIcsClient.fetchFeed).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
        })
      );
    });

    it('should handle sync failures gracefully', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockRejectedValue(new Error('Network error'));

      const result = await icsService.syncIcsEvents(testConnectionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(mockAuditService.logCalendarSyncFailure).toHaveBeenCalled();
    });

    it('should throw error if connection not found', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      const result = await icsService.syncIcsEvents(testConnectionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should update connection with new ETag and Last-Modified', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockResolvedValue({
        modified: true,
        content: 'ics content',
        etag: '"new-etag"',
        lastModified: 'Tue, 02 Jan 2024 00:00:00 GMT',
      });
      mockIcsClient.parseEvents.mockResolvedValue([]);
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.calendarConnection.update.mockResolvedValue({});

      await icsService.syncIcsEvents(testConnectionId);

      expect(mockPrisma.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testConnectionId },
          data: expect.objectContaining({
            icsETag: '"new-etag"',
            icsLastModified: 'Tue, 02 Jan 2024 00:00:00 GMT',
            lastSyncedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('getIcsConnection', () => {
    it('should return connection with decrypted URL', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
        calendarName: 'My Calendar',
      });

      const connection = await icsService.getIcsConnection(testConnectionId, testUserId);

      expect(connection.icsUrl).toBe('url');
      expect(mockEncryption.decryptToken).toHaveBeenCalledWith('encrypted_url');
    });

    it('should throw error if connection not found', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      await expect(
        icsService.getIcsConnection(testConnectionId, testUserId)
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteIcsConnection', () => {
    it('should soft delete connection and events', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
      });
      mockPrisma.calendarConnection.update.mockResolvedValue({});
      mockPrisma.calendarEvent.updateMany.mockResolvedValue({});

      await icsService.deleteIcsConnection(testConnectionId, testUserId);

      expect(mockPrisma.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testConnectionId },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            isConnected: false,
          }),
        })
      );
      expect(mockPrisma.calendarEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { calendarConnectionId: testConnectionId },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            syncStatus: SyncStatus.DELETED,
          }),
        })
      );
    });

    it('should throw error if connection not found', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      await expect(
        icsService.deleteIcsConnection(testConnectionId, testUserId)
      ).rejects.toThrow('not found');
    });
  });
});
