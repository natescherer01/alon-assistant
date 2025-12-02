/**
 * Comprehensive Microsoft Outlook Integration Tests
 *
 * Tests for Microsoft OAuth flow, calendar operations, delta sync, webhooks,
 * Teams meeting extraction, recurrence patterns, and error handling
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MicrosoftCalendarClient, MicrosoftEvent } from '../../src/integrations/microsoft';
import {
  mockMicrosoftCalendars,
  mockMicrosoftTokens,
  mockMicrosoftEvent,
  mockMicrosoftRecurringEvent,
} from '../fixtures/provider-responses.fixture';

// Mock MSAL and Microsoft Graph Client
jest.mock('@azure/msal-node');
jest.mock('@microsoft/microsoft-graph-client');

describe('MicrosoftCalendarClient - Comprehensive Tests', () => {
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
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      filter: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('OAuth Flow', () => {
    describe('getAuthUrl', () => {
      it('should generate OAuth authorization URL with correct scopes', async () => {
        const state = 'test_state_token_123';
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

      it('should force consent to get refresh token', async () => {
        mockMsalClient.getAuthCodeUrl.mockResolvedValue('https://auth.url');

        await client.getAuthUrl('state');

        expect(mockMsalClient.getAuthCodeUrl).toHaveBeenCalledWith(
          expect.objectContaining({ prompt: 'consent' })
        );
      });

      it('should handle URL generation errors', async () => {
        mockMsalClient.getAuthCodeUrl.mockRejectedValue(new Error('Network error'));

        await expect(client.getAuthUrl('state')).rejects.toThrow(
          'Failed to generate Microsoft auth URL'
        );
      });

      it('should handle malformed state parameter', async () => {
        mockMsalClient.getAuthCodeUrl.mockResolvedValue('https://auth.url');

        await expect(client.getAuthUrl('')).resolves.toBeTruthy();
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
        expect(tokens.expiresIn).toBeGreaterThan(0);
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

      it('should handle expired authorization code', async () => {
        mockMsalClient.acquireTokenByCode.mockRejectedValue(
          new Error('authorization_code_expired')
        );

        await expect(client.getTokens('expired_code')).rejects.toThrow(
          'Failed to get Microsoft tokens'
        );
      });

      it('should calculate correct token expiry', async () => {
        const futureDate = new Date(Date.now() + 3600 * 1000);
        mockMsalClient.acquireTokenByCode.mockResolvedValue({
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresOn: futureDate,
        });

        const tokens = await client.getTokens('code');

        expect(tokens.expiresIn).toBeGreaterThan(3500);
        expect(tokens.expiresIn).toBeLessThanOrEqual(3600);
      });

      it('should default to 3600 seconds if no expiry provided', async () => {
        mockMsalClient.acquireTokenByCode.mockResolvedValue({
          accessToken: 'token',
          refreshToken: 'refresh',
        });

        const tokens = await client.getTokens('code');

        expect(tokens.expiresIn).toBe(3600);
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
        expect(tokens.expiresIn).toBeGreaterThan(0);
      });

      it('should throw error if refresh fails', async () => {
        mockMsalClient.acquireTokenByRefreshToken.mockRejectedValue(new Error('invalid_grant'));

        await expect(client.refreshAccessToken('invalid_token')).rejects.toThrow(
          'Failed to refresh Microsoft token'
        );
      });

      it('should throw error if no access token in refresh response', async () => {
        mockMsalClient.acquireTokenByRefreshToken.mockResolvedValue({
          expiresOn: new Date(),
        });

        await expect(client.refreshAccessToken('token')).rejects.toThrow(
          'No access token received from refresh'
        );
      });

      it('should handle revoked refresh token', async () => {
        mockMsalClient.acquireTokenByRefreshToken.mockRejectedValue(
          new Error('token_revoked')
        );

        await expect(client.refreshAccessToken('revoked_token')).rejects.toThrow(
          'Failed to refresh Microsoft token'
        );
      });
    });
  });

  describe('Calendar Operations', () => {
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
          canEdit: true,
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

      it('should default calendar name to "Unnamed Calendar"', async () => {
        mockGraphClient.get.mockResolvedValue({
          value: [
            {
              id: 'cal1',
              color: 'auto',
              isDefaultCalendar: true,
              canEdit: true,
              owner: { name: 'User', address: 'user@example.com' },
            },
          ],
        });

        const calendars = await client.listCalendars('token');

        expect(calendars[0].name).toBe('Unnamed Calendar');
      });

      it('should default canEdit to true if not specified', async () => {
        mockGraphClient.get.mockResolvedValue({
          value: [
            {
              id: 'cal1',
              name: 'Calendar',
              color: 'auto',
              isDefaultCalendar: true,
              owner: { name: 'User', address: 'user@example.com' },
            },
          ],
        });

        const calendars = await client.listCalendars('token');

        expect(calendars[0].canEdit).toBe(true);
      });

      it('should handle shared calendars (canEdit: false)', async () => {
        mockGraphClient.get.mockResolvedValue({
          value: [
            {
              id: 'shared_cal',
              name: 'Shared Calendar',
              color: 'auto',
              isDefaultCalendar: false,
              canEdit: false,
              owner: { name: 'Other User', address: 'other@example.com' },
            },
          ],
        });

        const calendars = await client.listCalendars('token');

        expect(calendars[0].canEdit).toBe(false);
        expect(calendars[0].owner.address).toBe('other@example.com');
      });

      it('should handle missing owner information', async () => {
        mockGraphClient.get.mockResolvedValue({
          value: [
            {
              id: 'cal1',
              name: 'Calendar',
              color: 'auto',
              isDefaultCalendar: true,
              canEdit: true,
            },
          ],
        });

        const calendars = await client.listCalendars('token');

        expect(calendars[0].owner.name).toBe('Unknown');
        expect(calendars[0].owner.address).toBe('');
      });

      it('should handle 401 Unauthorized', async () => {
        const error = new Error('Unauthorized');
        (error as any).statusCode = 401;
        mockGraphClient.get.mockRejectedValue(error);

        await expect(client.listCalendars('invalid_token')).rejects.toThrow(
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
        const error = new Error('Not Found');
        (error as any).statusCode = 404;
        mockGraphClient.get.mockRejectedValue(error);

        await expect(client.getCalendarMetadata('token', 'invalid_id')).rejects.toThrow(
          'Failed to get Microsoft calendar metadata'
        );
      });

      it('should handle deleted calendar', async () => {
        const error = new Error('Calendar was deleted');
        (error as any).statusCode = 410;
        mockGraphClient.get.mockRejectedValue(error);

        await expect(client.getCalendarMetadata('token', 'deleted_id')).rejects.toThrow(
          'Failed to get Microsoft calendar metadata'
        );
      });
    });
  });

  describe('Event Operations', () => {
    describe('listEvents', () => {
      it('should list events within date range', async () => {
        const calendarId = 'AAMkAGI2TGTG';
        const startDate = new Date('2024-02-01T00:00:00Z');
        const endDate = new Date('2024-02-28T23:59:59Z');

        mockGraphClient.get.mockResolvedValue({
          value: [mockMicrosoftEvent, mockMicrosoftRecurringEvent],
        });

        const events = await client.listEvents('token', calendarId, startDate, endDate);

        expect(mockGraphClient.api).toHaveBeenCalledWith(`/me/calendars/${calendarId}/events`);
        expect(mockGraphClient.filter).toHaveBeenCalled();
        expect(mockGraphClient.select).toHaveBeenCalled();
        expect(mockGraphClient.top).toHaveBeenCalledWith(100);
        expect(mockGraphClient.orderby).toHaveBeenCalledWith('start/dateTime');
        expect(events).toHaveLength(2);
      });

      it('should handle pagination with multiple pages', async () => {
        const calendarId = 'cal123';
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');

        // First page
        mockGraphClient.get.mockResolvedValueOnce({
          value: [mockMicrosoftEvent],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/nextPage',
        });

        // Second page
        mockGraphClient.get.mockResolvedValueOnce({
          value: [mockMicrosoftRecurringEvent],
        });

        const events = await client.listEvents('token', calendarId, startDate, endDate);

        expect(mockGraphClient.get).toHaveBeenCalledTimes(2);
        expect(events).toHaveLength(2);
      });

      it('should handle empty event list', async () => {
        const startDate = new Date('2024-02-01');
        const endDate = new Date('2024-02-28');

        mockGraphClient.get.mockResolvedValue({
          value: [],
        });

        const events = await client.listEvents('token', 'cal123', startDate, endDate);

        expect(events).toEqual([]);
      });

      it('should handle rate limiting (429)', async () => {
        const error = new Error('Too Many Requests');
        (error as any).statusCode = 429;
        (error as any).headers = { 'retry-after': '60' };

        mockGraphClient.get.mockRejectedValue(error);

        await expect(
          client.listEvents('token', 'cal123', new Date(), new Date())
        ).rejects.toThrow('Rate limited. Retry after 60 seconds');
      });

      it('should use default retry-after value if header missing', async () => {
        const error = new Error('Too Many Requests');
        (error as any).statusCode = 429;

        mockGraphClient.get.mockRejectedValue(error);

        await expect(
          client.listEvents('token', 'cal123', new Date(), new Date())
        ).rejects.toThrow('Rate limited. Retry after 60 seconds');
      });

      it('should handle very large event lists (1000+ events)', async () => {
        const largeEventList = Array.from({ length: 1000 }, (_, i) => ({
          ...mockMicrosoftEvent,
          id: `event_${i}`,
        }));

        // Simulate pagination with 10 pages of 100 events each
        for (let i = 0; i < 10; i++) {
          const pageEvents = largeEventList.slice(i * 100, (i + 1) * 100);
          const response: any = { value: pageEvents };
          if (i < 9) {
            response['@odata.nextLink'] = `https://graph.microsoft.com/v1.0/page${i + 1}`;
          }
          mockGraphClient.get.mockResolvedValueOnce(response);
        }

        const events = await client.listEvents('token', 'cal123', new Date(), new Date());

        expect(events.length).toBe(1000);
      });
    });

    describe('getEvent', () => {
      it('should get single event by ID', async () => {
        const calendarId = 'cal123';
        const eventId = 'event123';

        mockGraphClient.get.mockResolvedValue(mockMicrosoftEvent);

        const event = await client.getEvent('token', calendarId, eventId);

        expect(mockGraphClient.api).toHaveBeenCalledWith(
          `/me/calendars/${calendarId}/events/${eventId}`
        );
        expect(event).toEqual(mockMicrosoftEvent);
      });

      it('should handle event not found (404)', async () => {
        const error = new Error('Not Found');
        (error as any).statusCode = 404;

        mockGraphClient.get.mockRejectedValue(error);

        await expect(client.getEvent('token', 'cal123', 'nonexistent')).rejects.toThrow(
          'Event not found'
        );
      });

      it('should handle deleted event', async () => {
        const error = new Error('Gone');
        (error as any).statusCode = 410;

        mockGraphClient.get.mockRejectedValue(error);

        await expect(client.getEvent('token', 'cal123', 'deleted_event')).rejects.toThrow(
          'Failed to get Microsoft event'
        );
      });
    });

    describe('getDeltaEvents', () => {
      it('should perform initial delta sync without token', async () => {
        const calendarId = 'cal123';
        const deltaLink = 'https://graph.microsoft.com/v1.0/delta?$deltatoken=abc123';

        mockGraphClient.get.mockResolvedValue({
          value: [mockMicrosoftEvent, mockMicrosoftRecurringEvent],
          '@odata.deltaLink': deltaLink,
        });

        const result = await client.getDeltaEvents('token', calendarId, null);

        expect(mockGraphClient.api).toHaveBeenCalledWith(
          `/me/calendars/${calendarId}/events/delta`
        );
        expect(result.events).toHaveLength(2);
        expect(result.deltaLink).toBe(deltaLink);
      });

      it('should perform incremental delta sync with existing token', async () => {
        const deltaToken = 'https://graph.microsoft.com/v1.0/delta?$deltatoken=old123';
        const newDeltaLink = 'https://graph.microsoft.com/v1.0/delta?$deltatoken=new456';

        mockGraphClient.get.mockResolvedValue({
          value: [mockMicrosoftEvent],
          '@odata.deltaLink': newDeltaLink,
        });

        const result = await client.getDeltaEvents('token', 'cal123', deltaToken);

        expect(mockGraphClient.api).toHaveBeenCalledWith(deltaToken);
        expect(result.events).toHaveLength(1);
        expect(result.deltaLink).toBe(newDeltaLink);
      });

      it('should handle delta token pagination', async () => {
        const calendarId = 'cal123';
        const deltaLink = 'https://graph.microsoft.com/v1.0/delta?$deltatoken=final';

        // First page
        mockGraphClient.get.mockResolvedValueOnce({
          value: [mockMicrosoftEvent],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/nextPage',
        });

        // Second page
        mockGraphClient.get.mockResolvedValueOnce({
          value: [mockMicrosoftRecurringEvent],
          '@odata.deltaLink': deltaLink,
        });

        const result = await client.getDeltaEvents('token', calendarId, null);

        expect(result.events).toHaveLength(2);
        expect(result.deltaLink).toBe(deltaLink);
      });

      it('should handle invalid delta token (410 Gone)', async () => {
        const error = new Error('Gone');
        (error as any).statusCode = 410;

        mockGraphClient.get.mockRejectedValue(error);

        await expect(
          client.getDeltaEvents('token', 'cal123', 'invalid_delta_token')
        ).rejects.toThrow('INVALID_DELTA_TOKEN');
      });

      it('should handle rate limiting in delta sync', async () => {
        const error = new Error('Too Many Requests');
        (error as any).statusCode = 429;
        (error as any).headers = { 'retry-after': '30' };

        mockGraphClient.get.mockRejectedValue(error);

        await expect(client.getDeltaEvents('token', 'cal123', null)).rejects.toThrow(
          'Rate limited. Retry after 30 seconds'
        );
      });

      it('should handle deleted events in delta response', async () => {
        const deletedEvent = {
          ...mockMicrosoftEvent,
          id: 'deleted_event',
          '@removed': { reason: 'deleted' },
        };

        mockGraphClient.get.mockResolvedValue({
          value: [mockMicrosoftEvent, deletedEvent],
          '@odata.deltaLink': 'https://delta.link',
        });

        const result = await client.getDeltaEvents('token', 'cal123', null);

        expect(result.events).toHaveLength(2);
        expect(result.events[1]['@removed']).toBeDefined();
      });

      it('should handle empty delta response', async () => {
        mockGraphClient.get.mockResolvedValue({
          value: [],
          '@odata.deltaLink': 'https://delta.link',
        });

        const result = await client.getDeltaEvents('token', 'cal123', null);

        expect(result.events).toEqual([]);
        expect(result.deltaLink).toBe('https://delta.link');
      });
    });
  });

  describe('Webhook Operations', () => {
    describe('subscribeToCalendar', () => {
      it('should create webhook subscription', async () => {
        const calendarId = 'cal123';
        const webhookUrl = 'https://api.example.com/webhooks/microsoft/events';
        const clientState = 'secret_state_123';

        mockGraphClient.post.mockResolvedValue({
          id: 'sub123',
          resource: `/me/calendars/${calendarId}/events`,
          changeType: 'created,updated,deleted',
          clientState,
          notificationUrl: webhookUrl,
          expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        });

        const subscription = await client.subscribeToCalendar(
          'token',
          calendarId,
          webhookUrl,
          clientState
        );

        expect(mockGraphClient.api).toHaveBeenCalledWith('/subscriptions');
        expect(mockGraphClient.post).toHaveBeenCalledWith(
          expect.objectContaining({
            changeType: 'created,updated,deleted',
            notificationUrl: webhookUrl,
            resource: `/me/calendars/${calendarId}/events`,
            clientState,
          })
        );
        expect(subscription.id).toBe('sub123');
      });

      it('should limit expiration to max 4230 minutes (3 days)', async () => {
        mockGraphClient.post.mockResolvedValue({
          id: 'sub123',
          resource: '/me/calendars/cal123/events',
          changeType: 'created,updated,deleted',
          notificationUrl: 'https://webhook.url',
          expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString(),
        });

        const subscription = await client.subscribeToCalendar(
          'token',
          'cal123',
          'https://webhook.url',
          'state',
          5000 // Request 5000 minutes, should be capped at 4230
        );

        expect(subscription).toBeDefined();
        const expirationDate = new Date(subscription.expirationDateTime);
        const maxDate = new Date(Date.now() + 4230 * 60 * 1000 + 60000); // +1 min buffer
        expect(expirationDate.getTime()).toBeLessThanOrEqual(maxDate.getTime());
      });

      it('should handle webhook URL validation error', async () => {
        const error = new Error('Subscription validation request failed');
        (error as any).message = 'notificationUrl must be publicly accessible';

        mockGraphClient.post.mockRejectedValue(error);

        await expect(
          client.subscribeToCalendar('token', 'cal123', 'http://localhost/webhook', 'state')
        ).rejects.toThrow('Webhook URL must be publicly accessible HTTPS endpoint');
      });

      it('should handle insufficient permissions (403)', async () => {
        const error = new Error('Forbidden');
        (error as any).statusCode = 403;

        mockGraphClient.post.mockRejectedValue(error);

        await expect(
          client.subscribeToCalendar('token', 'cal123', 'https://webhook.url', 'state')
        ).rejects.toThrow('Insufficient permissions to create subscription');
      });

      it('should create subscription without clientState', async () => {
        mockGraphClient.post.mockResolvedValue({
          id: 'sub123',
          resource: '/me/calendars/cal123/events',
          changeType: 'created,updated,deleted',
          notificationUrl: 'https://webhook.url',
          expirationDateTime: new Date().toISOString(),
        });

        const subscription = await client.subscribeToCalendar(
          'token',
          'cal123',
          'https://webhook.url'
        );

        expect(mockGraphClient.post).toHaveBeenCalledWith(
          expect.objectContaining({
            clientState: undefined,
          })
        );
      });
    });

    describe('renewSubscription', () => {
      it('should renew existing subscription', async () => {
        const subscriptionId = 'sub123';
        const newExpiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        mockGraphClient.patch.mockResolvedValue({
          id: subscriptionId,
          resource: '/me/calendars/cal123/events',
          changeType: 'created,updated,deleted',
          notificationUrl: 'https://webhook.url',
          expirationDateTime: newExpiration,
        });

        const subscription = await client.renewSubscription('token', subscriptionId);

        expect(mockGraphClient.api).toHaveBeenCalledWith(`/subscriptions/${subscriptionId}`);
        expect(mockGraphClient.patch).toHaveBeenCalledWith(
          expect.objectContaining({
            expirationDateTime: expect.any(String),
          })
        );
        expect(subscription.id).toBe(subscriptionId);
      });

      it('should handle subscription not found (404)', async () => {
        const error = new Error('Not Found');
        (error as any).statusCode = 404;

        mockGraphClient.patch.mockRejectedValue(error);

        await expect(client.renewSubscription('token', 'nonexistent')).rejects.toThrow(
          'SUBSCRIPTION_NOT_FOUND'
        );
      });

      it('should handle expired subscription', async () => {
        const error = new Error('Subscription expired');
        (error as any).statusCode = 410;

        mockGraphClient.patch.mockRejectedValue(error);

        await expect(client.renewSubscription('token', 'expired_sub')).rejects.toThrow(
          'Failed to renew subscription'
        );
      });
    });

    describe('deleteSubscription', () => {
      it('should delete subscription', async () => {
        const subscriptionId = 'sub123';

        mockGraphClient.delete.mockResolvedValue({});

        await client.deleteSubscription('token', subscriptionId);

        expect(mockGraphClient.api).toHaveBeenCalledWith(`/subscriptions/${subscriptionId}`);
        expect(mockGraphClient.delete).toHaveBeenCalled();
      });

      it('should handle already deleted subscription (404)', async () => {
        const error = new Error('Not Found');
        (error as any).statusCode = 404;

        mockGraphClient.delete.mockRejectedValue(error);

        // Should not throw error
        await expect(client.deleteSubscription('token', 'deleted_sub')).resolves.toBeUndefined();
      });

      it('should handle other deletion errors', async () => {
        const error = new Error('Internal Server Error');
        (error as any).statusCode = 500;

        mockGraphClient.delete.mockRejectedValue(error);

        await expect(client.deleteSubscription('token', 'sub123')).rejects.toThrow(
          'Failed to delete subscription'
        );
      });
    });
  });

  describe('Teams Meeting Extraction', () => {
    it('should extract Teams meeting from onlineMeeting object', () => {
      const event: MicrosoftEvent = {
        ...mockMicrosoftEvent,
        isOnlineMeeting: true,
        onlineMeeting: {
          joinUrl: 'https://teams.microsoft.com/l/meetup-join/123',
          conferenceId: 'conf123',
        },
      };

      const teamsMeeting = client.extractTeamsMeetingInfo(event);

      expect(teamsMeeting.enabled).toBe(true);
      expect(teamsMeeting.meetingUrl).toBe('https://teams.microsoft.com/l/meetup-join/123');
      expect(teamsMeeting.conferenceId).toBe('conf123');
    });

    it('should extract Teams meeting from onlineMeetingUrl', () => {
      const event: MicrosoftEvent = {
        ...mockMicrosoftEvent,
        isOnlineMeeting: true,
        onlineMeetingUrl: 'https://teams.microsoft.com/l/meetup-join/456',
      };

      const teamsMeeting = client.extractTeamsMeetingInfo(event);

      expect(teamsMeeting.enabled).toBe(true);
      expect(teamsMeeting.meetingUrl).toBe('https://teams.microsoft.com/l/meetup-join/456');
      expect(teamsMeeting.conferenceId).toBeUndefined();
    });

    it('should extract Teams meeting from body content (legacy)', () => {
      const event: MicrosoftEvent = {
        ...mockMicrosoftEvent,
        body: {
          contentType: 'html',
          content:
            '<p>Join Teams Meeting</p><a href="https://teams.microsoft.com/l/meetup-join/789">Join</a>',
        },
      };

      const teamsMeeting = client.extractTeamsMeetingInfo(event);

      expect(teamsMeeting.enabled).toBe(true);
      expect(teamsMeeting.meetingUrl).toContain('teams.microsoft.com');
    });

    it('should return disabled for non-Teams events', () => {
      const event: MicrosoftEvent = {
        ...mockMicrosoftEvent,
        isOnlineMeeting: false,
      };

      const teamsMeeting = client.extractTeamsMeetingInfo(event);

      expect(teamsMeeting.enabled).toBe(false);
      expect(teamsMeeting.meetingUrl).toBeUndefined();
    });

    it('should return disabled if no Teams URL found', () => {
      const event: MicrosoftEvent = {
        ...mockMicrosoftEvent,
        isOnlineMeeting: true,
        body: {
          contentType: 'text',
          content: 'Regular meeting with no link',
        },
      };

      const teamsMeeting = client.extractTeamsMeetingInfo(event);

      expect(teamsMeeting.enabled).toBe(false);
    });

    it('should handle missing body content', () => {
      const event: MicrosoftEvent = {
        ...mockMicrosoftEvent,
        isOnlineMeeting: false,
      };

      const teamsMeeting = client.extractTeamsMeetingInfo(event);

      expect(teamsMeeting.enabled).toBe(false);
    });
  });

  describe('Recurrence Pattern Conversion', () => {
    it('should convert daily recurrence', () => {
      const recurrence = {
        pattern: {
          type: 'daily',
          interval: 1,
        },
        range: {
          type: 'noEnd',
          startDate: '2024-01-01',
        },
      };

      const rrule = client.convertRecurrenceToRRule(recurrence);

      expect(rrule).toBe('RRULE:FREQ=DAILY');
    });

    it('should convert weekly recurrence with specific days', () => {
      const recurrence = {
        pattern: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: ['monday', 'wednesday', 'friday'],
        },
        range: {
          type: 'noEnd',
          startDate: '2024-01-01',
        },
      };

      const rrule = client.convertRecurrenceToRRule(recurrence);

      expect(rrule).toContain('FREQ=WEEKLY');
      expect(rrule).toContain('BYDAY=MO,WE,FR');
    });

    it('should convert monthly recurrence with day of month', () => {
      const recurrence = {
        pattern: {
          type: 'absoluteMonthly',
          interval: 1,
          dayOfMonth: 15,
        },
        range: {
          type: 'noEnd',
          startDate: '2024-01-01',
        },
      };

      const rrule = client.convertRecurrenceToRRule(recurrence);

      expect(rrule).toContain('FREQ=MONTHLY');
      expect(rrule).toContain('BYMONTHDAY=15');
    });

    it('should convert yearly recurrence', () => {
      const recurrence = {
        pattern: {
          type: 'absoluteYearly',
          interval: 1,
          dayOfMonth: 25,
          month: 12,
        },
        range: {
          type: 'noEnd',
          startDate: '2024-01-01',
        },
      };

      const rrule = client.convertRecurrenceToRRule(recurrence);

      expect(rrule).toContain('FREQ=YEARLY');
      expect(rrule).toContain('BYMONTH=12');
      expect(rrule).toContain('BYMONTHDAY=25');
    });

    it('should handle end date', () => {
      const recurrence = {
        pattern: {
          type: 'daily',
          interval: 1,
        },
        range: {
          type: 'endDate',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      };

      const rrule = client.convertRecurrenceToRRule(recurrence);

      expect(rrule).toContain('UNTIL=20241231');
    });

    it('should handle count (numberOfOccurrences)', () => {
      const recurrence = {
        pattern: {
          type: 'daily',
          interval: 1,
        },
        range: {
          type: 'numbered',
          startDate: '2024-01-01',
          numberOfOccurrences: 10,
        },
      };

      const rrule = client.convertRecurrenceToRRule(recurrence);

      expect(rrule).toContain('COUNT=10');
    });

    it('should handle interval greater than 1', () => {
      const recurrence = {
        pattern: {
          type: 'weekly',
          interval: 2,
          daysOfWeek: ['tuesday', 'thursday'],
        },
        range: {
          type: 'noEnd',
          startDate: '2024-01-01',
        },
      };

      const rrule = client.convertRecurrenceToRRule(recurrence);

      expect(rrule).toContain('INTERVAL=2');
    });

    it('should return null for undefined recurrence', () => {
      const rrule = client.convertRecurrenceToRRule(undefined);

      expect(rrule).toBeNull();
    });

    it('should return null for null recurrence', () => {
      const rrule = client.convertRecurrenceToRRule(null);

      expect(rrule).toBeNull();
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

    it('should use default color for undefined color', async () => {
      mockGraphClient.get.mockResolvedValue({
        value: [
          {
            id: 'cal1',
            name: 'Calendar',
            isDefaultCalendar: true,
            canEdit: true,
            owner: { name: 'User', address: 'user@example.com' },
          },
        ],
      });

      const calendars = await client.listCalendars('token');
      expect(calendars[0].color).toBe('#1F77B4');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeout', async () => {
      const error = new Error('ETIMEDOUT');
      (error as any).code = 'ETIMEDOUT';

      mockGraphClient.get.mockRejectedValue(error);

      await expect(client.listCalendars('token')).rejects.toThrow(
        'Failed to list Microsoft calendars'
      );
    });

    it('should handle invalid JSON response', async () => {
      mockGraphClient.get.mockRejectedValue(new Error('Unexpected token < in JSON'));

      await expect(client.listCalendars('token')).rejects.toThrow(
        'Failed to list Microsoft calendars'
      );
    });

    it('should handle server errors (500)', async () => {
      const error = new Error('Internal Server Error');
      (error as any).statusCode = 500;

      mockGraphClient.get.mockRejectedValue(error);

      await expect(client.listCalendars('token')).rejects.toThrow(
        'Failed to list Microsoft calendars'
      );
    });

    it('should handle service unavailable (503)', async () => {
      const error = new Error('Service Unavailable');
      (error as any).statusCode = 503;

      mockGraphClient.get.mockRejectedValue(error);

      await expect(client.listCalendars('token')).rejects.toThrow(
        'Failed to list Microsoft calendars'
      );
    });
  });
});
