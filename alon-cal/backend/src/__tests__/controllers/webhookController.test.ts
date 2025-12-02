/**
 * Webhook Controller Tests
 *
 * Tests for HTTP webhook endpoints handling Microsoft Graph notifications
 * Validates request handling, validation handshake, and notification processing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';

// Mock dependencies
jest.mock('../../src/services/webhookService');
jest.mock('../../src/utils/logger');

import webhookController from '../../src/controllers/webhookController';
import webhookService from '../../src/services/webhookService';

describe('WebhookController', () => {
  const mockWebhookService = webhookService as jest.Mocked<typeof webhookService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      query: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('handleMicrosoftWebhook', () => {
    describe('Validation Handshake', () => {
      it('should respond to validation token with 200 and plain text', async () => {
        const validationToken = 'validation_token_123';
        mockRequest.query = { validationToken };

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.type).toHaveBeenCalledWith('text/plain');
        expect(mockResponse.send).toHaveBeenCalledWith(validationToken);
      });

      it('should handle validation token with special characters', async () => {
        const validationToken = 'token+with/special=chars';
        mockRequest.query = { validationToken };

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.send).toHaveBeenCalledWith(validationToken);
      });

      it('should handle empty validation token', async () => {
        mockRequest.query = { validationToken: '' };

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.send).toHaveBeenCalledWith('');
      });
    });

    describe('Change Notifications', () => {
      it('should process valid change notifications', async () => {
        const notifications = [
          {
            subscriptionId: 'sub123',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
            changeType: 'updated',
            resource: '/me/calendars/cal123/events',
            clientState: 'secret',
            tenantId: 'tenant123',
          },
        ];

        mockRequest.body = { value: notifications };
        mockWebhookService.processMicrosoftNotifications.mockResolvedValue(undefined);

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(202);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Notifications accepted for processing',
        });

        // Allow async processing to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockWebhookService.processMicrosoftNotifications).toHaveBeenCalledWith(
          notifications
        );
      });

      it('should handle multiple notifications', async () => {
        const notifications = [
          {
            subscriptionId: 'sub1',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
            changeType: 'created',
            resource: '/resource1',
            tenantId: 'tenant123',
          },
          {
            subscriptionId: 'sub2',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
            changeType: 'updated',
            resource: '/resource2',
            tenantId: 'tenant123',
          },
          {
            subscriptionId: 'sub3',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
            changeType: 'deleted',
            resource: '/resource3',
            tenantId: 'tenant123',
          },
        ];

        mockRequest.body = { value: notifications };
        mockWebhookService.processMicrosoftNotifications.mockResolvedValue(undefined);

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(202);

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockWebhookService.processMicrosoftNotifications).toHaveBeenCalledWith(
          notifications
        );
      });

      it('should return 400 for missing value field', async () => {
        mockRequest.body = {};

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'Bad Request',
          message: 'Invalid notification payload',
        });
      });

      it('should return 400 if value is not an array', async () => {
        mockRequest.body = { value: 'not an array' };

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'Bad Request',
          message: 'Invalid notification payload',
        });
      });

      it('should return 400 for null value', async () => {
        mockRequest.body = { value: null };

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
      });

      it('should handle empty notifications array', async () => {
        mockRequest.body = { value: [] };
        mockWebhookService.processMicrosoftNotifications.mockResolvedValue(undefined);

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(202);

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockWebhookService.processMicrosoftNotifications).toHaveBeenCalledWith([]);
      });

      it('should respond immediately (within 3 seconds requirement)', async () => {
        const startTime = Date.now();
        const notifications = [
          {
            subscriptionId: 'sub123',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
            changeType: 'updated',
            resource: '/resource',
            tenantId: 'tenant123',
          },
        ];

        mockRequest.body = { value: notifications };

        // Simulate slow processing
        mockWebhookService.processMicrosoftNotifications.mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, 5000))
        );

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        const responseTime = Date.now() - startTime;

        // Should respond in less than 1 second (well under 3 second requirement)
        expect(responseTime).toBeLessThan(1000);
        expect(mockResponse.status).toHaveBeenCalledWith(202);
      });

      it('should not fail if async processing throws error', async () => {
        const notifications = [
          {
            subscriptionId: 'sub123',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
            changeType: 'updated',
            resource: '/resource',
            tenantId: 'tenant123',
          },
        ];

        mockRequest.body = { value: notifications };
        mockWebhookService.processMicrosoftNotifications.mockRejectedValue(
          new Error('Processing failed')
        );

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Should still respond with 202
        expect(mockResponse.status).toHaveBeenCalledWith(202);

        // Wait for async processing to complete
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      it('should handle notification with all change types', async () => {
        const notifications = [
          {
            subscriptionId: 'sub123',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
            changeType: 'created,updated,deleted',
            resource: '/resource',
            tenantId: 'tenant123',
          },
        ];

        mockRequest.body = { value: notifications };
        mockWebhookService.processMicrosoftNotifications.mockResolvedValue(undefined);

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(202);
      });

      it('should handle notification with resource data', async () => {
        const notifications = [
          {
            subscriptionId: 'sub123',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
            changeType: 'updated',
            resource: '/resource',
            resourceData: {
              '@odata.type': '#microsoft.graph.event',
              '@odata.id': '/me/events/event123',
              '@odata.etag': 'W/"etag123"',
              id: 'event123',
            },
            tenantId: 'tenant123',
          },
        ];

        mockRequest.body = { value: notifications };
        mockWebhookService.processMicrosoftNotifications.mockResolvedValue(undefined);

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(202);
      });
    });

    describe('Error Handling', () => {
      it('should call next with error for unexpected exceptions', async () => {
        const error = new Error('Unexpected error');
        mockRequest.query = {};
        mockRequest.body = { value: [] };

        // Mock JSON method to throw error
        mockResponse.json = jest.fn().mockImplementation(() => {
          throw error;
        });

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(error);
      });

      it('should handle malformed JSON in body', async () => {
        mockRequest.body = 'not json';

        await webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
      });
    });
  });

  describe('handleGoogleWebhook', () => {
    it('should respond with 200 for Google webhook', async () => {
      await webhookController.handleGoogleWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Google webhook received',
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Error');
      mockResponse.json = jest.fn().mockImplementation(() => {
        throw error;
      });

      await webhookController.handleGoogleWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('Performance', () => {
    it('should handle high volume of notifications efficiently', async () => {
      const notifications = Array.from({ length: 100 }, (_, i) => ({
        subscriptionId: `sub${i}`,
        subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
        changeType: 'updated',
        resource: `/resource${i}`,
        tenantId: 'tenant123',
      }));

      mockRequest.body = { value: notifications };
      mockWebhookService.processMicrosoftNotifications.mockResolvedValue(undefined);

      const startTime = Date.now();

      await webhookController.handleMicrosoftWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(100); // Should respond in less than 100ms
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });
  });

  describe('Edge Cases', () => {
    it('should handle notification with missing optional fields', async () => {
      const notifications = [
        {
          subscriptionId: 'sub123',
          subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
          changeType: 'updated',
          resource: '/resource',
          tenantId: 'tenant123',
          // No clientState or resourceData
        },
      ];

      mockRequest.body = { value: notifications };
      mockWebhookService.processMicrosoftNotifications.mockResolvedValue(undefined);

      await webhookController.handleMicrosoftWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should handle notification with extra unexpected fields', async () => {
      const notifications = [
        {
          subscriptionId: 'sub123',
          subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
          changeType: 'updated',
          resource: '/resource',
          tenantId: 'tenant123',
          unexpectedField: 'some value',
          anotherField: { nested: 'data' },
        },
      ];

      mockRequest.body = { value: notifications };
      mockWebhookService.processMicrosoftNotifications.mockResolvedValue(undefined);

      await webhookController.handleMicrosoftWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should handle concurrent webhook requests', async () => {
      const notifications = [
        {
          subscriptionId: 'sub123',
          subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
          changeType: 'updated',
          resource: '/resource',
          tenantId: 'tenant123',
        },
      ];

      mockRequest.body = { value: notifications };
      mockWebhookService.processMicrosoftNotifications.mockResolvedValue(undefined);

      // Simulate 10 concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        webhookController.handleMicrosoftWebhook(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      );

      await Promise.all(requests);

      expect(mockResponse.status).toHaveBeenCalledTimes(10);
    });
  });
});
