/**
 * Microsoft Outlook Integration
 *
 * Handles Microsoft Graph API interactions for Outlook Calendar
 * Implements OAuth 2.0 flow using MSAL and calendar data fetching
 * Supports real-time webhooks via Microsoft Graph subscriptions
 */

import { ConfidentialClientApplication, AuthorizationUrlRequest, AuthorizationCodeRequest } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { microsoftOAuthConfig } from '../config/oauth';
import logger from '../utils/logger';

export interface MicrosoftCalendar {
  id: string;
  name: string;
  color: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  owner: { name: string; address: string };
}

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MicrosoftEvent {
  id: string;
  subject: string;
  bodyPreview?: string;
  body?: {
    contentType: string;
    content: string;
  };
  location?: {
    displayName?: string;
    locationType?: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isAllDay: boolean;
  isCancelled: boolean;
  importance: 'low' | 'normal' | 'high';
  showAs: string;
  responseStatus?: {
    response: string;
    time: string;
  };
  attendees?: Array<{
    type: string;
    status: {
      response: string;
      time: string;
    };
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  organizer?: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  categories?: string[];
  recurrence?: {
    pattern: {
      type: string;
      interval: number;
      daysOfWeek?: string[];
      dayOfMonth?: number;
      month?: number;
      firstDayOfWeek?: string;
    };
    range: {
      type: string;
      startDate: string;
      endDate?: string;
      numberOfOccurrences?: number;
    };
  };
  seriesMasterId?: string;
  type: string;
  webLink: string;
  onlineMeetingUrl?: string;
  onlineMeeting?: {
    joinUrl: string;
    conferenceId?: string;
  };
  isOnlineMeeting: boolean;
  onlineMeetingProvider?: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@removed'?: {
    reason: string;
  };
}

export interface DeltaResponse {
  events: MicrosoftEvent[];
  deltaLink?: string;
  nextLink?: string;
}

export interface WebhookSubscription {
  id: string;
  resource: string;
  changeType: string;
  clientState?: string;
  notificationUrl: string;
  expirationDateTime: string;
  creatorId?: string;
}

export class MicrosoftCalendarClient {
  private msalClient: ConfidentialClientApplication;

  constructor() {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: microsoftOAuthConfig.clientId,
        authority: microsoftOAuthConfig.authority,
        clientSecret: microsoftOAuthConfig.clientSecret,
      },
    });
  }

  /**
   * Generate Microsoft OAuth authorization URL
   *
   * @param state - CSRF protection state parameter
   * @returns Authorization URL for user to visit
   */
  async getAuthUrl(state: string): Promise<string> {
    try {
      const authCodeUrlParameters: AuthorizationUrlRequest = {
        scopes: microsoftOAuthConfig.scopes,
        redirectUri: microsoftOAuthConfig.redirectUri,
        state,
        prompt: 'consent', // Force consent to get refresh token
      };

      const authUrl = await this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
      return authUrl;
    } catch (error) {
      logger.error('Failed to generate Microsoft auth URL', { error });
      throw new Error(
        `Failed to generate Microsoft auth URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   *
   * @param code - Authorization code from OAuth callback
   * @returns Access token, refresh token, and expiry info
   */
  async getTokens(code: string): Promise<MicrosoftTokens> {
    try {
      const tokenRequest: AuthorizationCodeRequest = {
        code,
        scopes: microsoftOAuthConfig.scopes,
        redirectUri: microsoftOAuthConfig.redirectUri,
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);

      if (!response.accessToken) {
        throw new Error('No access token received from Microsoft');
      }

      logger.info('Successfully exchanged Microsoft authorization code for tokens');

      return {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken || '',
        expiresIn: response.expiresOn
          ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000)
          : 3600,
      };
    } catch (error) {
      logger.error('Failed to exchange Microsoft authorization code', { error });
      throw new Error(
        `Failed to get Microsoft tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refresh Microsoft access token using refresh token
   *
   * @param refreshToken - Refresh token from previous authorization
   * @returns New access token and expiry info
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const refreshTokenRequest = {
        refreshToken,
        scopes: microsoftOAuthConfig.scopes,
      };

      const response = await this.msalClient.acquireTokenByRefreshToken(refreshTokenRequest);

      if (!response.accessToken) {
        throw new Error('No access token received from refresh');
      }

      logger.info('Successfully refreshed Microsoft access token');

      return {
        accessToken: response.accessToken,
        expiresIn: response.expiresOn
          ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000)
          : 3600,
      };
    } catch (error) {
      logger.error('Failed to refresh Microsoft access token', { error });
      throw new Error(
        `Failed to refresh Microsoft token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List all calendars accessible to the user
   *
   * @param accessToken - Valid Microsoft access token
   * @returns Array of calendar objects
   */
  async listCalendars(accessToken: string): Promise<MicrosoftCalendar[]> {
    try {
      const client = this.getGraphClient(accessToken);

      const response = await client.api('/me/calendars').get();

      if (!response.value) {
        logger.warn('No calendars found in Microsoft Graph response');
        return [];
      }

      const calendars: MicrosoftCalendar[] = response.value.map((item: any) => ({
        id: item.id,
        name: item.name || 'Unnamed Calendar',
        color: this.mapMicrosoftColor(item.color),
        isDefaultCalendar: item.isDefaultCalendar || false,
        canEdit: item.canEdit !== false, // Default to true if not specified
        owner: {
          name: item.owner?.name || 'Unknown',
          address: item.owner?.address || '',
        },
      }));

      logger.info(`Retrieved ${calendars.length} Microsoft calendars`);
      return calendars;
    } catch (error) {
      logger.error('Failed to list Microsoft calendars', { error });
      throw new Error(
        `Failed to list Microsoft calendars: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get metadata for a specific calendar
   *
   * @param accessToken - Valid Microsoft access token
   * @param calendarId - Microsoft calendar ID
   * @returns Calendar metadata
   */
  async getCalendarMetadata(accessToken: string, calendarId: string): Promise<MicrosoftCalendar> {
    try {
      const client = this.getGraphClient(accessToken);

      const response = await client.api(`/me/calendars/${calendarId}`).get();

      return {
        id: response.id,
        name: response.name || 'Unnamed Calendar',
        color: this.mapMicrosoftColor(response.color),
        isDefaultCalendar: response.isDefaultCalendar || false,
        canEdit: response.canEdit !== false,
        owner: {
          name: response.owner?.name || 'Unknown',
          address: response.owner?.address || '',
        },
      };
    } catch (error) {
      logger.error('Failed to get Microsoft calendar metadata', { error, calendarId });
      throw new Error(
        `Failed to get Microsoft calendar metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create Graph API client with access token
   *
   * @param accessToken - Valid Microsoft access token
   * @returns Configured Graph client
   */
  private getGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  /**
   * List events in a calendar within a date range
   *
   * @param accessToken - Valid Microsoft access token
   * @param calendarId - Microsoft calendar ID
   * @param startDate - Start date for event range
   * @param endDate - End date for event range
   * @returns Array of calendar events
   */
  async listEvents(
    accessToken: string,
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MicrosoftEvent[]> {
    try {
      const client = this.getGraphClient(accessToken);
      const events: MicrosoftEvent[] = [];

      // Format dates for OData filter
      const startDateTime = startDate.toISOString();
      const endDateTime = endDate.toISOString();

      // Build query with filter for date range
      let query = client
        .api(`/me/calendars/${calendarId}/events`)
        .filter(`start/dateTime ge '${startDateTime}' and end/dateTime le '${endDateTime}'`)
        .select([
          'id',
          'subject',
          'bodyPreview',
          'body',
          'location',
          'start',
          'end',
          'isAllDay',
          'isCancelled',
          'importance',
          'showAs',
          'responseStatus',
          'attendees',
          'organizer',
          'categories',
          'recurrence',
          'seriesMasterId',
          'type',
          'webLink',
          'onlineMeetingUrl',
          'onlineMeeting',
          'isOnlineMeeting',
          'onlineMeetingProvider',
          'createdDateTime',
          'lastModifiedDateTime',
        ].join(','))
        .top(100)
        .orderby('start/dateTime');

      let response = await query.get();

      // Collect events from all pages
      while (response) {
        if (response.value) {
          events.push(...response.value);
        }

        // Check for next page
        if (response['@odata.nextLink']) {
          response = await client.api(response['@odata.nextLink']).get();
        } else {
          break;
        }
      }

      logger.info(`Retrieved ${events.length} Microsoft events`, {
        calendarId,
        startDate: startDateTime,
        endDate: endDateTime,
      });

      return events;
    } catch (error: any) {
      logger.error('Failed to list Microsoft events', { error, calendarId });

      // Handle rate limiting
      if (error.statusCode === 429) {
        const retryAfter = error.headers?.['retry-after'] || 60;
        throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
      }

      throw new Error(
        `Failed to list Microsoft events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a single event by ID
   *
   * @param accessToken - Valid Microsoft access token
   * @param calendarId - Microsoft calendar ID
   * @param eventId - Event ID
   * @returns Event details
   */
  async getEvent(accessToken: string, calendarId: string, eventId: string): Promise<MicrosoftEvent> {
    try {
      const client = this.getGraphClient(accessToken);

      const event = await client
        .api(`/me/calendars/${calendarId}/events/${eventId}`)
        .select([
          'id',
          'subject',
          'bodyPreview',
          'body',
          'location',
          'start',
          'end',
          'isAllDay',
          'isCancelled',
          'importance',
          'showAs',
          'responseStatus',
          'attendees',
          'organizer',
          'categories',
          'recurrence',
          'seriesMasterId',
          'type',
          'webLink',
          'onlineMeetingUrl',
          'onlineMeeting',
          'isOnlineMeeting',
          'onlineMeetingProvider',
          'createdDateTime',
          'lastModifiedDateTime',
        ].join(','))
        .get();

      logger.debug('Retrieved Microsoft event', { eventId, calendarId });

      return event;
    } catch (error: any) {
      if (error.statusCode === 404) {
        throw new Error(`Event not found: ${eventId}`);
      }

      logger.error('Failed to get Microsoft event', { error, eventId, calendarId });
      throw new Error(
        `Failed to get Microsoft event: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get delta (incremental) changes for calendar events
   * Uses Microsoft Graph delta query for efficient sync
   *
   * @param accessToken - Valid Microsoft access token
   * @param calendarId - Microsoft calendar ID
   * @param deltaToken - Previous delta link (null for initial sync)
   * @returns Delta response with events and new delta link
   */
  async getDeltaEvents(
    accessToken: string,
    calendarId: string,
    deltaToken: string | null
  ): Promise<DeltaResponse> {
    try {
      const client = this.getGraphClient(accessToken);
      const events: MicrosoftEvent[] = [];
      let newDeltaLink: string | undefined;

      let query;
      if (deltaToken) {
        // Use existing delta link for incremental sync
        logger.debug('Using delta token for incremental sync', { calendarId });
        query = client.api(deltaToken);
      } else {
        // Initial delta query - get all events
        logger.debug('Starting initial delta sync', { calendarId });
        query = client
          .api(`/me/calendars/${calendarId}/events/delta`)
          .select([
            'id',
            'subject',
            'bodyPreview',
            'body',
            'location',
            'start',
            'end',
            'isAllDay',
            'isCancelled',
            'importance',
            'showAs',
            'responseStatus',
            'attendees',
            'organizer',
            'categories',
            'recurrence',
            'seriesMasterId',
            'type',
            'webLink',
            'onlineMeetingUrl',
            'onlineMeeting',
            'isOnlineMeeting',
            'onlineMeetingProvider',
            'createdDateTime',
            'lastModifiedDateTime',
          ].join(','))
          .top(100);
      }

      let response = await query.get();

      // Collect all pages of delta results
      while (response) {
        if (response.value) {
          events.push(...response.value);
        }

        // Check for next page or delta link
        if (response['@odata.nextLink']) {
          response = await client.api(response['@odata.nextLink']).get();
        } else if (response['@odata.deltaLink']) {
          newDeltaLink = response['@odata.deltaLink'];
          break;
        } else {
          break;
        }
      }

      logger.info(`Delta sync retrieved ${events.length} events`, { calendarId });

      return {
        events,
        deltaLink: newDeltaLink,
      };
    } catch (error: any) {
      // Handle invalid delta token (410 Gone)
      if (error.statusCode === 410) {
        logger.warn('Delta token invalid, full sync required', { calendarId });
        throw new Error('INVALID_DELTA_TOKEN');
      }

      // Handle rate limiting
      if (error.statusCode === 429) {
        const retryAfter = error.headers?.['retry-after'] || 60;
        throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
      }

      logger.error('Failed to get delta events', { error, calendarId });
      throw new Error(
        `Failed to get delta events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Subscribe to calendar change notifications via webhooks
   * Microsoft Graph subscriptions expire after max 3 days for calendar events
   *
   * @param accessToken - Valid Microsoft access token
   * @param calendarId - Microsoft calendar ID
   * @param webhookUrl - Public HTTPS URL to receive notifications
   * @param clientState - Optional secret for validating notifications
   * @param expirationMinutes - Minutes until expiration (max 4230 = ~3 days)
   * @returns Subscription details
   */
  async subscribeToCalendar(
    accessToken: string,
    calendarId: string,
    webhookUrl: string,
    clientState?: string,
    expirationMinutes: number = 4230 // Default to ~3 days (max allowed)
  ): Promise<WebhookSubscription> {
    try {
      const client = this.getGraphClient(accessToken);

      // Calculate expiration time (max 3 days for calendar events)
      const expirationDateTime = new Date();
      expirationDateTime.setMinutes(expirationDateTime.getMinutes() + Math.min(expirationMinutes, 4230));

      const subscriptionPayload = {
        changeType: 'created,updated,deleted',
        notificationUrl: webhookUrl,
        resource: `/me/calendars/${calendarId}/events`,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: clientState || undefined,
      };

      logger.debug('Creating webhook subscription', { calendarId, webhookUrl, expirationDateTime });

      const subscription = await client.api('/subscriptions').post(subscriptionPayload);

      logger.info('Webhook subscription created', {
        subscriptionId: subscription.id,
        calendarId,
        expiresAt: subscription.expirationDateTime,
      });

      return {
        id: subscription.id,
        resource: subscription.resource,
        changeType: subscription.changeType,
        clientState: subscription.clientState,
        notificationUrl: subscription.notificationUrl,
        expirationDateTime: subscription.expirationDateTime,
      };
    } catch (error: any) {
      logger.error('Failed to create webhook subscription', { error, calendarId });

      // Handle specific errors
      if (error.statusCode === 403) {
        throw new Error('Insufficient permissions to create subscription');
      }

      if (error.message?.includes('notificationUrl')) {
        throw new Error('Webhook URL must be publicly accessible HTTPS endpoint');
      }

      throw new Error(
        `Failed to create webhook subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Renew an existing webhook subscription
   * Should be called before subscription expires (ideally 24 hours before)
   *
   * @param accessToken - Valid Microsoft access token
   * @param subscriptionId - Subscription ID to renew
   * @param expirationMinutes - Minutes to extend (max 4230 = ~3 days)
   * @returns Updated subscription
   */
  async renewSubscription(
    accessToken: string,
    subscriptionId: string,
    expirationMinutes: number = 4230
  ): Promise<WebhookSubscription> {
    try {
      const client = this.getGraphClient(accessToken);

      // Calculate new expiration time
      const expirationDateTime = new Date();
      expirationDateTime.setMinutes(expirationDateTime.getMinutes() + Math.min(expirationMinutes, 4230));

      logger.debug('Renewing webhook subscription', { subscriptionId, expirationDateTime });

      const subscription = await client
        .api(`/subscriptions/${subscriptionId}`)
        .patch({
          expirationDateTime: expirationDateTime.toISOString(),
        });

      logger.info('Webhook subscription renewed', {
        subscriptionId,
        expiresAt: subscription.expirationDateTime,
      });

      return {
        id: subscription.id,
        resource: subscription.resource,
        changeType: subscription.changeType,
        clientState: subscription.clientState,
        notificationUrl: subscription.notificationUrl,
        expirationDateTime: subscription.expirationDateTime,
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.warn('Subscription not found, may have been deleted', { subscriptionId });
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }

      logger.error('Failed to renew webhook subscription', { error, subscriptionId });
      throw new Error(
        `Failed to renew subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a webhook subscription
   *
   * @param accessToken - Valid Microsoft access token
   * @param subscriptionId - Subscription ID to delete
   */
  async deleteSubscription(accessToken: string, subscriptionId: string): Promise<void> {
    try {
      const client = this.getGraphClient(accessToken);

      logger.debug('Deleting webhook subscription', { subscriptionId });

      await client.api(`/subscriptions/${subscriptionId}`).delete();

      logger.info('Webhook subscription deleted', { subscriptionId });
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.warn('Subscription already deleted or not found', { subscriptionId });
        return; // Not an error if already deleted
      }

      logger.error('Failed to delete webhook subscription', { error, subscriptionId });
      throw new Error(
        `Failed to delete subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract Teams meeting information from event
   * Checks multiple fields for Teams meeting data
   *
   * @param event - Microsoft event object
   * @returns Teams meeting info or null
   */
  extractTeamsMeetingInfo(event: MicrosoftEvent): {
    enabled: boolean;
    meetingUrl?: string;
    conferenceId?: string;
  } {
    // Check if it's a Teams meeting
    if (!event.isOnlineMeeting && !event.onlineMeetingUrl && !event.onlineMeeting) {
      return { enabled: false };
    }

    // Extract Teams URL from onlineMeeting object (preferred)
    if (event.onlineMeeting?.joinUrl) {
      return {
        enabled: true,
        meetingUrl: event.onlineMeeting.joinUrl,
        conferenceId: event.onlineMeeting.conferenceId,
      };
    }

    // Fallback to onlineMeetingUrl
    if (event.onlineMeetingUrl) {
      return {
        enabled: true,
        meetingUrl: event.onlineMeetingUrl,
      };
    }

    // Check body for Teams link (legacy events)
    if (event.body?.content) {
      const teamsLinkRegex = /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<]+/i;
      const match = event.body.content.match(teamsLinkRegex);
      if (match) {
        return {
          enabled: true,
          meetingUrl: match[0],
        };
      }
    }

    return { enabled: false };
  }

  /**
   * Convert Microsoft recurrence pattern to RFC 5545 RRULE format
   *
   * @param recurrence - Microsoft recurrence object
   * @returns RRULE string
   */
  convertRecurrenceToRRule(recurrence: MicrosoftEvent['recurrence']): string | null {
    if (!recurrence) return null;

    const { pattern, range } = recurrence;
    const rruleParts: string[] = ['RRULE:'];

    // Frequency mapping
    const freqMap: Record<string, string> = {
      daily: 'FREQ=DAILY',
      weekly: 'FREQ=WEEKLY',
      absoluteMonthly: 'FREQ=MONTHLY',
      relativeMonthly: 'FREQ=MONTHLY',
      absoluteYearly: 'FREQ=YEARLY',
      relativeYearly: 'FREQ=YEARLY',
    };

    rruleParts.push(freqMap[pattern.type] || 'FREQ=DAILY');

    // Interval
    if (pattern.interval > 1) {
      rruleParts.push(`INTERVAL=${pattern.interval}`);
    }

    // Days of week (for weekly recurrence)
    if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
      const days = pattern.daysOfWeek.map((d) => d.substring(0, 2).toUpperCase()).join(',');
      rruleParts.push(`BYDAY=${days}`);
    }

    // Day of month (for monthly)
    if (pattern.dayOfMonth) {
      rruleParts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
    }

    // Month (for yearly)
    if (pattern.month) {
      rruleParts.push(`BYMONTH=${pattern.month}`);
    }

    // End condition
    if (range.type === 'endDate' && range.endDate) {
      const endDate = range.endDate.replace(/-/g, '');
      rruleParts.push(`UNTIL=${endDate}`);
    } else if (range.type === 'numbered' && range.numberOfOccurrences) {
      rruleParts.push(`COUNT=${range.numberOfOccurrences}`);
    }
    // If type is 'noEnd', don't add UNTIL or COUNT

    return rruleParts.join(';');
  }

  /**
   * Map Microsoft color enum to hex color code
   *
   * @param color - Microsoft color name
   * @returns Hex color code
   */
  private mapMicrosoftColor(color: string | undefined): string {
    const colorMap: Record<string, string> = {
      auto: '#1F77B4',
      lightBlue: '#5B9BD5',
      lightGreen: '#70AD47',
      lightOrange: '#FFC000',
      lightGray: '#A6A6A6',
      lightYellow: '#FFD966',
      lightTeal: '#4BACC6',
      lightPink: '#F4B4C4',
      lightBrown: '#C65911',
      lightRed: '#E74856',
      maxColor: '#333333',
    };

    return colorMap[color || 'auto'] || '#1F77B4';
  }
}
