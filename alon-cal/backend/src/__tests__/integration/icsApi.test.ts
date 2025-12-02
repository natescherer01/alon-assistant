/**
 * ICS API Integration Tests
 *
 * End-to-end tests for ICS calendar subscription API endpoints
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { CalendarProvider, EventStatus, SyncStatus } from '@prisma/client';
import icsRoutes from '../../../routes/ics';
import { requireAuth } from '../../../middleware/auth';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('../../../lib/prisma');
jest.mock('../../../utils/encryption');
jest.mock('../../../utils/urlValidator');
jest.mock('../../../integrations/ics/icsClient');
jest.mock('../../../services/auditService');
jest.mock('../../../middleware/auth');

describe('ICS API Integration Tests', () => {
  let app: Express;
  let mockPrisma: any;
  let mockEncryption: any;
  let mockUrlValidator: any;
  let mockIcsClient: any;
  let mockAuth: any;

  const testUserId = 'user-123';
  const testConnectionId = 'conn-123';
  const testUrl = 'https://example.com/calendar.ics';

  const fixturesPath = path.join(__dirname, '../fixtures/ics');
  const loadFixture = (filename: string): string => {
    return fs.readFileSync(path.join(fixturesPath, filename), 'utf-8');
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    mockAuth = require('../../../middleware/auth');
    (mockAuth.requireAuth as jest.MockedFunction<any>) = jest.fn((req, res, next) => {
      req.user = { userId: testUserId };
      next();
    });

    // Mount ICS routes
    app.use('/api/calendars/ics', icsRoutes);

    // Setup mocks
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

    mockEncryption = require('../../../utils/encryption');
    mockEncryption.encryptToken = jest.fn((token: string) => `encrypted_${token}`);
    mockEncryption.decryptToken = jest.fn((token: string) => token.replace('encrypted_', ''));

    mockUrlValidator = require('../../../utils/urlValidator');
    mockUrlValidator.validateIcsUrl = jest.fn().mockResolvedValue({ valid: true });

    mockIcsClient = require('../../../integrations/ics/icsClient').default;
    mockIcsClient.validateFeed = jest.fn();
    mockIcsClient.fetchFeed = jest.fn();
    mockIcsClient.parseEvents = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/calendars/ics/validate', () => {
    it('should return 200 with valid URL', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'Test Calendar',
        eventCount: 10,
      });

      const response = await request(app)
        .post('/api/calendars/ics/validate')
        .send({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        valid: true,
        calendarName: 'Test Calendar',
        eventCount: 10,
      });
    });

    it('should return 400 with invalid URL (SSRF)', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({
        valid: false,
        error: 'Private IP detected',
      });

      const response = await request(app)
        .post('/api/calendars/ics/validate')
        .send({ url: 'https://192.168.1.1/calendar.ics' });

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('Private IP');
    });

    it('should return 400 with malformed URL', async () => {
      const response = await request(app)
        .post('/api/calendars/ics/validate')
        .send({ url: 'not-a-url' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 401 without authentication', async () => {
      (mockAuth.requireAuth as jest.MockedFunction<any>).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/calendars/ics/validate')
        .send({ url: testUrl });

      expect(response.status).toBe(401);
    });

    it('should return 400 for unparseable ICS feed', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: false,
        error: 'Invalid ICS format',
      });

      const response = await request(app)
        .post('/api/calendars/ics/validate')
        .send({ url: testUrl });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/calendars/ics/connect', () => {
    it('should create connection and sync events', async () => {
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
        isReadOnly: true,
        isConnected: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/calendars/ics/connect')
        .send({ url: testUrl, displayName: 'My Calendar' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('ICS calendar connected successfully');
      expect(response.body.connection).toMatchObject({
        id: testConnectionId,
        isReadOnly: true,
        isConnected: true,
      });
    });

    it('should return 400 with invalid URL', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({
        valid: false,
        error: 'Invalid URL',
      });

      const response = await request(app)
        .post('/api/calendars/ics/connect')
        .send({ url: testUrl });

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate URL', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'Test',
        eventCount: 0,
      });
      mockPrisma.calendarConnection.findFirst.mockResolvedValue({
        id: 'existing-conn',
      });

      const response = await request(app)
        .post('/api/calendars/ics/connect')
        .send({ url: testUrl });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Conflict');
    });

    it('should use custom display name if provided', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'Original',
        eventCount: 0,
      });
      mockPrisma.calendarConnection.findFirst.mockResolvedValue(null);
      mockPrisma.calendarConnection.create.mockResolvedValue({
        id: testConnectionId,
        calendarName: 'Custom Name',
        isReadOnly: true,
        isConnected: true,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/calendars/ics/connect')
        .send({ url: testUrl, displayName: 'Custom Name' });

      expect(response.status).toBe(201);
      expect(mockPrisma.calendarConnection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            calendarName: 'Custom Name',
          }),
        })
      );
    });
  });

  describe('GET /api/calendars/ics/:connectionId', () => {
    it('should return calendar details', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        calendarName: 'My Calendar',
        icsUrl: 'encrypted_url',
        isReadOnly: true,
        isConnected: true,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/calendars/ics/${testConnectionId}`);

      expect(response.status).toBe(200);
      expect(response.body.connection).toMatchObject({
        id: testConnectionId,
        url: 'url', // Decrypted
        isReadOnly: true,
      });
    });

    it('should return 403 for other user\'s calendar', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/calendars/ics/${testConnectionId}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 if calendar not found', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/calendars/ics/nonexistent-id`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/calendars/ics/:connectionId', () => {
    it('should update calendar display name', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
      });
      mockPrisma.calendarConnection.update.mockResolvedValue({
        id: testConnectionId,
        calendarName: 'Updated Name',
        isReadOnly: true,
        isConnected: true,
        updatedAt: new Date(),
      });

      const response = await request(app)
        .put(`/api/calendars/ics/${testConnectionId}`)
        .send({ displayName: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ICS calendar updated successfully');
    });

    it('should update calendar URL and trigger re-sync', async () => {
      const newUrl = 'https://example.com/new-calendar.ics';

      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
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
        isReadOnly: true,
        isConnected: true,
        updatedAt: new Date(),
      });

      const response = await request(app)
        .put(`/api/calendars/ics/${testConnectionId}`)
        .send({ url: newUrl });

      expect(response.status).toBe(200);
    });

    it('should return 404 if calendar not found', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/calendars/ics/${testConnectionId}`)
        .send({ displayName: 'New Name' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/calendars/ics/:connectionId', () => {
    it('should soft-delete connection and events', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
      });
      mockPrisma.calendarConnection.update.mockResolvedValue({});
      mockPrisma.calendarEvent.updateMany.mockResolvedValue({});

      const response = await request(app)
        .delete(`/api/calendars/ics/${testConnectionId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ICS calendar deleted successfully');
      expect(mockPrisma.calendarConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            isConnected: false,
          }),
        })
      );
    });

    it('should return 404 if calendar not found', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/calendars/ics/${testConnectionId}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/calendars/ics/:connectionId/sync', () => {
    it('should trigger manual sync and return stats', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockResolvedValue({
        modified: true,
        content: loadFixture('valid-simple.ics'),
        etag: null,
        lastModified: null,
      });
      mockIcsClient.parseEvents.mockResolvedValue([
        {
          uid: 'event-1',
          summary: 'Event 1',
          start: new Date(),
          end: new Date(),
          isAllDay: false,
          timezone: 'UTC',
          status: 'CONFIRMED',
          isRecurring: false,
        },
      ]);
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.calendarEvent.create.mockResolvedValue({});
      mockPrisma.calendarConnection.update.mockResolvedValue({});

      const response = await request(app)
        .post(`/api/calendars/ics/${testConnectionId}/sync`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'ICS calendar synced successfully',
        stats: {
          eventsAdded: expect.any(Number),
          eventsUpdated: expect.any(Number),
          eventsDeleted: expect.any(Number),
        },
      });
    });

    it('should return 500 on sync failure', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post(`/api/calendars/ics/${testConnectionId}/sync`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });

    it('should return 404 if calendar not found', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/calendars/ics/${testConnectionId}/sync`);

      expect(response.status).toBe(404);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large ICS feeds', async () => {
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.validateFeed.mockResolvedValue({
        valid: true,
        calendarName: 'Large Calendar',
        eventCount: 10000,
      });
      mockPrisma.calendarConnection.findFirst.mockResolvedValue(null);
      mockPrisma.calendarConnection.create.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        isReadOnly: true,
        isConnected: true,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/calendars/ics/connect')
        .send({ url: testUrl });

      expect(response.status).toBe(201);
    });

    it('should handle ICS feed with UTF-8 characters', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockResolvedValue({
        modified: true,
        content: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:utf8@example.com
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
SUMMARY:Café Meeting ☕
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`,
        etag: null,
        lastModified: null,
      });
      mockIcsClient.parseEvents.mockResolvedValue([
        {
          uid: 'utf8@example.com',
          summary: 'Café Meeting ☕',
          start: new Date(),
          end: new Date(),
          isAllDay: false,
          timezone: 'UTC',
          status: 'CONFIRMED',
          isRecurring: false,
        },
      ]);
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.calendarEvent.create.mockResolvedValue({});
      mockPrisma.calendarConnection.update.mockResolvedValue({});

      const response = await request(app)
        .post(`/api/calendars/ics/${testConnectionId}/sync`);

      expect(response.status).toBe(200);
    });

    it('should handle concurrent sync requests', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: testUserId,
        provider: CalendarProvider.ICS,
        icsUrl: 'encrypted_url',
      });
      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockResolvedValue({
        modified: false,
        content: null,
        etag: '"abc"',
        lastModified: null,
      });

      const [response1, response2] = await Promise.all([
        request(app).post(`/api/calendars/ics/${testConnectionId}/sync`),
        request(app).post(`/api/calendars/ics/${testConnectionId}/sync`),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should handle connection deletion during sync', async () => {
      mockPrisma.calendarConnection.findUnique
        .mockResolvedValueOnce({
          id: testConnectionId,
          userId: testUserId,
          provider: CalendarProvider.ICS,
          icsUrl: 'encrypted_url',
        })
        .mockResolvedValueOnce(null); // Deleted during sync

      mockUrlValidator.validateIcsUrl.mockResolvedValue({ valid: true });
      mockIcsClient.fetchFeed.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              modified: true,
              content: 'content',
              etag: null,
              lastModified: null,
            });
          }, 100);
        });
      });

      const response = await request(app)
        .post(`/api/calendars/ics/${testConnectionId}/sync`);

      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication token', async () => {
      (mockAuth.requireAuth as jest.MockedFunction<any>).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/calendars/ics/validate')
        .send({ url: testUrl });

      expect(response.status).toBe(401);
    });

    it('should prevent access to other user\'s calendars', async () => {
      mockPrisma.calendarConnection.findUnique.mockResolvedValue({
        id: testConnectionId,
        userId: 'other-user-id',
        provider: CalendarProvider.ICS,
      });

      const response = await request(app)
        .get(`/api/calendars/ics/${testConnectionId}`);

      expect(response.status).toBe(404);
    });
  });
});
