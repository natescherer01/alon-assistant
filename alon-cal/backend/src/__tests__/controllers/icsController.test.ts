/**
 * ICS Controller Tests
 *
 * Tests for ICS API endpoints
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import icsController from '../../../controllers/icsController';

// Mock dependencies
jest.mock('../../../services/icsService');

describe('ICS Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let mockIcsService: any;

  const testUserId = 'user-123';
  const testConnectionId = 'conn-123';
  const testUrl = 'https://example.com/calendar.ics';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ICS service
    mockIcsService = require('../../../services/icsService').default;

    // Mock request
    mockRequest = {
      user: { userId: testUserId },
      body: {},
      params: {},
    };

    // Mock response
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    // Mock next
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateIcsUrl', () => {
    it('should return 200 with valid URL result', async () => {
      mockRequest.body = { url: testUrl };
      mockIcsService.validateIcsUrl = jest.fn().mockResolvedValue({
        valid: true,
        calendarName: 'Test Calendar',
        eventCount: 10,
      });

      await icsController.validateIcsUrl(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        valid: true,
        calendarName: 'Test Calendar',
        eventCount: 10,
      });
    });

    it('should return 400 with invalid URL result', async () => {
      mockRequest.body = { url: testUrl };
      mockIcsService.validateIcsUrl = jest.fn().mockResolvedValue({
        valid: false,
        error: 'Private IP detected',
      });

      await icsController.validateIcsUrl(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        valid: false,
        error: 'Private IP detected',
      });
    });

    it('should return 401 without authentication', async () => {
      mockRequest.user = undefined;

      await icsController.validateIcsUrl(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
        })
      );
    });

    it('should return 400 with invalid request body', async () => {
      mockRequest.body = { invalidField: 'test' };

      await icsController.validateIcsUrl(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
        })
      );
    });

    it('should handle service errors', async () => {
      mockRequest.body = { url: testUrl };
      mockIcsService.validateIcsUrl = jest.fn().mockRejectedValue(new Error('Service error'));

      await icsController.validateIcsUrl(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('connectIcsCalendar', () => {
    it('should return 201 on successful connection', async () => {
      mockRequest.body = { url: testUrl, displayName: 'My Calendar' };
      mockIcsService.createIcsConnection = jest.fn().mockResolvedValue({
        id: testConnectionId,
        provider: 'ICS',
        calendarName: 'My Calendar',
        isReadOnly: true,
        isConnected: true,
        createdAt: new Date(),
      });
      mockIcsService.syncIcsEvents = jest.fn().mockResolvedValue({});

      await icsController.connectIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'ICS calendar connected successfully',
          connection: expect.objectContaining({
            id: testConnectionId,
            isReadOnly: true,
          }),
        })
      );
    });

    it('should trigger initial sync asynchronously', async () => {
      mockRequest.body = { url: testUrl };
      mockIcsService.createIcsConnection = jest.fn().mockResolvedValue({
        id: testConnectionId,
        provider: 'ICS',
        calendarName: 'Test',
        isReadOnly: true,
        isConnected: true,
        createdAt: new Date(),
      });
      mockIcsService.syncIcsEvents = jest.fn().mockResolvedValue({});

      await icsController.connectIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      // Sync should be called but not awaited
      expect(mockIcsService.syncIcsEvents).toHaveBeenCalledWith(testConnectionId);
    });

    it('should return 401 without authentication', async () => {
      mockRequest.user = undefined;

      await icsController.connectIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 with invalid URL', async () => {
      mockRequest.body = { url: testUrl };
      mockIcsService.createIcsConnection = jest.fn().mockRejectedValue(
        new Error('Invalid ICS URL: Private IP')
      );

      await icsController.connectIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
        })
      );
    });

    it('should return 409 for duplicate URL', async () => {
      mockRequest.body = { url: testUrl };
      mockIcsService.createIcsConnection = jest.fn().mockRejectedValue(
        new Error('ICS calendar already connected')
      );

      await icsController.connectIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Conflict',
        })
      );
    });
  });

  describe('getIcsCalendar', () => {
    it('should return 200 with calendar details', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockIcsService.getIcsConnection = jest.fn().mockResolvedValue({
        id: testConnectionId,
        provider: 'ICS',
        calendarName: 'My Calendar',
        icsUrl: testUrl,
        isReadOnly: true,
        isConnected: true,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await icsController.getIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            id: testConnectionId,
            url: testUrl,
          }),
        })
      );
    });

    it('should return 401 without authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { connectionId: testConnectionId };

      await icsController.getIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if calendar not found', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockIcsService.getIcsConnection = jest.fn().mockRejectedValue(
        new Error('ICS calendar connection not found')
      );

      await icsController.getIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if connectionId missing', async () => {
      mockRequest.params = {};

      await icsController.getIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateIcsCalendar', () => {
    it('should return 200 on successful update', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockRequest.body = { displayName: 'Updated Name' };
      mockIcsService.updateIcsConnection = jest.fn().mockResolvedValue({
        id: testConnectionId,
        provider: 'ICS',
        calendarName: 'Updated Name',
        isReadOnly: true,
        isConnected: true,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      });

      await icsController.updateIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'ICS calendar updated successfully',
        })
      );
    });

    it('should trigger sync when URL changes', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockRequest.body = { url: 'https://example.com/new-calendar.ics' };
      mockIcsService.updateIcsConnection = jest.fn().mockResolvedValue({
        id: testConnectionId,
        provider: 'ICS',
        calendarName: 'Test',
        isReadOnly: true,
        isConnected: true,
        updatedAt: new Date(),
      });
      mockIcsService.syncIcsEvents = jest.fn().mockResolvedValue({});

      await icsController.updateIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockIcsService.syncIcsEvents).toHaveBeenCalledWith(testConnectionId);
    });

    it('should return 404 if connection not found', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockRequest.body = { displayName: 'New Name' };
      mockIcsService.updateIcsConnection = jest.fn().mockRejectedValue(
        new Error('ICS calendar connection not found')
      );

      await icsController.updateIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteIcsCalendar', () => {
    it('should return 200 on successful deletion', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockIcsService.deleteIcsConnection = jest.fn().mockResolvedValue(undefined);

      await icsController.deleteIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'ICS calendar deleted successfully',
      });
    });

    it('should return 401 without authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { connectionId: testConnectionId };

      await icsController.deleteIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if connection not found', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockIcsService.deleteIcsConnection = jest.fn().mockRejectedValue(
        new Error('ICS calendar connection not found')
      );

      await icsController.deleteIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('syncIcsCalendar', () => {
    it('should return 200 with sync stats on success', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockIcsService.getIcsConnection = jest.fn().mockResolvedValue({
        id: testConnectionId,
      });
      mockIcsService.syncIcsEvents = jest.fn().mockResolvedValue({
        success: true,
        eventsAdded: 5,
        eventsUpdated: 3,
        eventsDeleted: 1,
      });

      await icsController.syncIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'ICS calendar synced successfully',
        stats: {
          eventsAdded: 5,
          eventsUpdated: 3,
          eventsDeleted: 1,
        },
      });
    });

    it('should return 500 on sync failure', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockIcsService.getIcsConnection = jest.fn().mockResolvedValue({
        id: testConnectionId,
      });
      mockIcsService.syncIcsEvents = jest.fn().mockResolvedValue({
        success: false,
        eventsAdded: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        error: 'Network timeout',
      });

      await icsController.syncIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
          details: 'Network timeout',
        })
      );
    });

    it('should return 404 if connection not found', async () => {
      mockRequest.params = { connectionId: testConnectionId };
      mockIcsService.getIcsConnection = jest.fn().mockRejectedValue(
        new Error('ICS calendar connection not found')
      );

      await icsController.syncIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 401 without authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { connectionId: testConnectionId };

      await icsController.syncIcsCalendar(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });
});
