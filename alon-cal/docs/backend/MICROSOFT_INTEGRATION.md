# Microsoft Outlook Calendar Integration

## Overview

Complete read-only integration with Microsoft Outlook Calendar using Microsoft Graph API. Supports real-time webhooks, incremental delta sync, Teams meeting extraction, and full Microsoft-specific features.

## Features

### Core Functionality
- OAuth 2.0 authentication with MSAL
- Calendar listing and selection
- Event synchronization (read-only)
- Real-time webhook notifications
- Incremental delta sync
- Automatic token refresh

### Microsoft-Specific Features
- Teams meeting link extraction
- Shared/delegated calendar support
- Event importance levels (LOW, NORMAL, HIGH)
- Outlook categories
- Recurring event patterns (RRULE conversion)
- Series master ID tracking

## Architecture

### Components

#### 1. **Microsoft Calendar Client** (`src/integrations/microsoft.ts`)
Main client for Microsoft Graph API interactions:
- `listCalendars()` - Get all accessible calendars
- `listEvents(calendarId, startDate, endDate)` - Fetch events in date range
- `getEvent(calendarId, eventId)` - Get single event
- `getDeltaEvents(calendarId, deltaToken)` - Incremental sync
- `subscribeToCalendar(...)` - Create webhook subscription
- `renewSubscription(subscriptionId)` - Extend subscription
- `deleteSubscription(subscriptionId)` - Remove webhook
- `extractTeamsMeetingInfo(event)` - Extract Teams data
- `convertRecurrenceToRRule(recurrence)` - Convert to RFC 5545

#### 2. **Event Sync Service** (`src/services/eventSyncService.ts`)
Handles event synchronization:
- Delta query for incremental updates
- Full sync fallback on invalid delta tokens
- Microsoft-specific field mapping
- Teams meeting detection
- Recurrence pattern conversion
- Error handling with retry logic

#### 3. **Webhook Service** (`src/services/webhookService.ts`)
Manages webhook lifecycle:
- `createSubscription()` - Set up webhook
- `renewSubscription()` - Extend before expiration
- `deleteSubscription()` - Remove webhook
- `processMicrosoftNotifications()` - Handle incoming events
- `renewExpiringSubscriptions()` - Auto-renewal job
- `cleanupExpiredSubscriptions()` - Cleanup job

#### 4. **Background Jobs** (`src/services/backgroundJobs.ts`)
Automated maintenance:
- Subscription renewal every 12 hours
- Expired subscription cleanup every hour
- Graceful shutdown handling

#### 5. **Webhook Controller** (`src/controllers/webhookController.ts`)
HTTP handlers for webhooks:
- Validation handshake response
- Change notification processing
- 202 Accepted immediate response

## API Endpoints

### OAuth Flow
```
GET  /api/oauth/microsoft/login         - Initiate OAuth
GET  /api/oauth/microsoft/callback      - OAuth callback
POST /api/oauth/microsoft/select        - Select calendars
```

### Calendar Management
```
GET    /api/calendars                   - List all calendars
GET    /api/calendars/:id               - Get calendar details
DELETE /api/calendars/:id               - Disconnect calendar
POST   /api/calendars/:id/sync          - Manual sync trigger
POST   /api/calendars/sync-all          - Sync all calendars
```

### Webhook Management
```
POST   /api/calendars/:id/webhook       - Enable webhook
DELETE /api/calendars/:id/webhook       - Disable webhook
```

### Webhook Receiver
```
POST   /api/webhooks/microsoft/events   - Receive notifications
```

## Database Schema

### CalendarConnection Fields
```typescript
{
  id: string
  userId: string
  provider: 'MICROSOFT'
  calendarId: string
  calendarName: string
  accessToken: string (encrypted)
  refreshToken: string (encrypted)
  tokenExpiresAt: DateTime
  syncToken: string (delta link)
  delegateEmail: string? (for shared calendars)
  // ... standard fields
}
```

### CalendarEvent Fields (Microsoft-specific)
```typescript
{
  // Standard fields
  id, title, description, location, startTime, endTime, isAllDay, timezone, status

  // Recurrence
  isRecurring: boolean
  recurrenceRule: string (RRULE format)
  seriesMasterId: string?

  // Microsoft-specific
  importance: 'LOW' | 'NORMAL' | 'HIGH'
  outlookCategories: string (comma-separated)
  teamsEnabled: boolean
  teamsMeetingUrl: string?
  teamsConferenceId: string?

  // Metadata
  providerMetadata: JSON (full event data)
  htmlLink: string
  lastSyncedAt: DateTime
}
```

### WebhookSubscription Model
```typescript
{
  id: string
  calendarConnectionId: string
  provider: 'MICROSOFT'
  subscriptionId: string
  resourcePath: string
  expirationDateTime: DateTime
  clientState: string
  notificationUrl: string
  lastNotificationAt: DateTime?
  isActive: boolean
}
```

## Implementation Details

### Delta Sync Flow

1. **Initial Sync**: Full event fetch + initialize delta link
2. **Incremental Sync**: Use delta link to get only changes
3. **Invalid Token (410 Gone)**: Fall back to full sync
4. **Store New Delta Link**: For next incremental sync

```typescript
// Delta query example
const deltaResponse = await microsoftClient.getDeltaEvents(
  accessToken,
  calendarId,
  deltaToken // null for initial sync
);

// Returns: { events: [...], deltaLink: 'new-delta-link' }
```

### Webhook Lifecycle

**Creation:**
```typescript
POST https://graph.microsoft.com/v1.0/subscriptions
{
  "changeType": "created,updated,deleted",
  "notificationUrl": "https://your-app.com/api/webhooks/microsoft/events",
  "resource": "/me/calendars/{calendarId}/events",
  "expirationDateTime": "2024-01-15T12:00:00Z",
  "clientState": "secret-validation-token"
}
```

**Validation Handshake:**
```
Microsoft → GET /api/webhooks/microsoft/events?validationToken=abc123
Your App → 200 OK (plain text: "abc123")
```

**Change Notification:**
```json
{
  "value": [
    {
      "subscriptionId": "sub-123",
      "changeType": "updated",
      "resource": "/me/calendars/cal-123/events",
      "clientState": "secret-validation-token"
    }
  ]
}
```

**Renewal (every ~2 days):**
```typescript
PATCH https://graph.microsoft.com/v1.0/subscriptions/{subscriptionId}
{
  "expirationDateTime": "2024-01-18T12:00:00Z"
}
```

### Teams Meeting Detection

The integration checks multiple fields for Teams meeting information:

1. **Primary**: `event.onlineMeeting.joinUrl`
2. **Fallback**: `event.onlineMeetingUrl`
3. **Legacy**: Regex search in `event.body.content`

```typescript
const teamsInfo = microsoftClient.extractTeamsMeetingInfo(event);
// Returns: { enabled: true, meetingUrl: '...', conferenceId: '...' }
```

### Recurrence Pattern Conversion

Microsoft's recurrence format is converted to RFC 5545 RRULE:

```typescript
// Microsoft format
{
  pattern: {
    type: "weekly",
    interval: 2,
    daysOfWeek: ["monday", "wednesday", "friday"]
  },
  range: {
    type: "endDate",
    endDate: "2024-12-31"
  }
}

// Converted to RRULE
"RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;UNTIL=20241231"
```

### Error Handling

**Rate Limiting (429):**
- Respect `Retry-After` header
- Exponential backoff
- Log and retry

**Invalid Delta Token (410 Gone):**
- Automatically fall back to full sync
- Clear stored delta token
- Re-initialize delta query

**Token Expiration:**
- Automatic refresh via `tokenRefreshService`
- Update stored tokens
- Retry failed request

**Webhook Failures:**
- Non-blocking webhook creation
- Calendar sync continues without webhooks
- Manual webhook enablement available

## Configuration

### Environment Variables

```bash
# Microsoft OAuth
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=common  # or specific tenant

# Application
API_URL=https://your-app.com
FRONTEND_URL=https://your-frontend.com

# Security
ENCRYPTION_KEY=32_character_hex_key
```

### Microsoft Graph API Permissions

Required scopes in Azure App Registration:
- `Calendars.Read` - Read calendar events
- `User.Read` - Read user profile
- `offline_access` - Refresh token access

### Webhook Requirements

- **Public HTTPS endpoint** (no localhost)
- **Responds within 3 seconds**
- **Handles validation handshake**
- **Max expiration: 3 days** (4230 minutes)

## Usage Examples

### 1. Connect Microsoft Calendar

```typescript
// Frontend initiates OAuth
const response = await fetch('/api/oauth/microsoft/login', {
  headers: { Authorization: `Bearer ${token}` }
});
const { authUrl } = await response.json();

// Redirect user to authUrl
window.location.href = authUrl;

// After callback, select calendars
await fetch('/api/oauth/microsoft/select', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: sessionId,
    selectedCalendarIds: ['calendar-1', 'calendar-2']
  })
});
```

### 2. Manual Sync Trigger

```typescript
const response = await fetch('/api/calendars/connection-id/sync', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});

const result = await response.json();
console.log(result.stats);
// { totalEvents: 50, newEvents: 10, updatedEvents: 5, deletedEvents: 2 }
```

### 3. Enable Webhook

```typescript
const response = await fetch('/api/calendars/connection-id/webhook', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});

const { subscription } = await response.json();
console.log(subscription.expiresAt); // ISO date string
```

### 4. Query Events

```typescript
const events = await fetch('/api/events?start=2024-01-01&end=2024-01-31', {
  headers: { Authorization: `Bearer ${token}` }
});

const data = await events.json();
data.events.forEach(event => {
  console.log(event.title);

  // Check for Teams meeting
  if (event.teamsEnabled) {
    console.log('Teams link:', event.teamsMeetingUrl);
  }

  // Check importance
  if (event.importance === 'HIGH') {
    console.log('Important!');
  }
});
```

## Monitoring & Maintenance

### Background Jobs Status

Check logs for:
- `Subscription renewal job started` (every 12 hours)
- `Subscription cleanup job started` (every hour)
- `Found X subscriptions expiring within 24 hours`

### Webhook Health

Monitor:
- Subscription creation success rate
- Notification processing latency
- Failed renewal attempts
- Expired subscription count

### Sync Performance

Track:
- Delta sync vs full sync ratio
- Average sync duration
- Error rates by type (401, 403, 410, 429)
- Events synced per calendar

## Troubleshooting

### Webhooks Not Receiving Notifications

1. **Check subscription status**: Query `WebhookSubscription` table
2. **Verify expiration**: Ensure not expired
3. **Check webhook URL**: Must be publicly accessible HTTPS
4. **Review logs**: Look for validation handshake failures
5. **Manual renewal**: Call renewal endpoint to extend

### Delta Sync Failing

1. **410 Gone error**: Delta token expired, full sync will auto-trigger
2. **Check sync token**: Should be stored in `CalendarConnection.syncToken`
3. **Force full sync**: Pass `fullSync: true` to sync endpoint

### Token Refresh Errors

1. **Invalid refresh token**: User must re-authorize
2. **Token encryption**: Verify `ENCRYPTION_KEY` is consistent
3. **Check expiration**: `tokenExpiresAt` field in database

### Teams Meeting Not Detected

1. **Check event.isOnlineMeeting**: Should be true
2. **Review providerMetadata**: Raw Microsoft event data
3. **Verify meeting provider**: Should be 'teamsForBusiness'

## Performance Considerations

- **Delta sync**: ~90% reduction in API calls vs full sync
- **Webhook notifications**: Real-time updates within seconds
- **Batch processing**: Multiple calendars synced in parallel
- **Background jobs**: Non-blocking subscription management
- **Rate limiting**: Automatic backoff on 429 responses

## Security

- **Token encryption**: Access/refresh tokens encrypted at rest
- **Client state validation**: Webhooks validated with secret
- **User authorization**: All endpoints verify ownership
- **Audit logging**: OAuth and sync events tracked
- **No token exposure**: Never sent to frontend

## Future Enhancements

- [ ] Google Calendar webhook support
- [ ] Write operations (create/update events)
- [ ] Conflict resolution for recurring events
- [ ] Calendar sharing permissions
- [ ] Meeting room booking
- [ ] Attachment handling
- [ ] Event categories sync

## References

- [Microsoft Graph Calendar API](https://docs.microsoft.com/en-us/graph/api/resources/calendar)
- [Delta Query](https://docs.microsoft.com/en-us/graph/delta-query-overview)
- [Webhooks/Subscriptions](https://docs.microsoft.com/en-us/graph/webhooks)
- [RFC 5545 (iCalendar)](https://tools.ietf.org/html/rfc5545)
