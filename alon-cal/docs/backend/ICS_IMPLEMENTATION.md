# ICS Calendar Implementation Guide

## Overview

This document describes the complete ICS (iCalendar subscription) backend implementation, including SSRF protection, ICS parsing, and background sync functionality.

## Architecture

### Components

1. **URL Validator** (`src/utils/urlValidator.ts`)
   - SSRF protection for ICS URLs
   - Private IP blocking
   - DNS rebinding protection
   - Redirect validation

2. **ICS Client** (`src/integrations/ics/icsClient.ts`)
   - HTTP client for fetching ICS feeds
   - ETag/Last-Modified caching
   - ICS parsing with `node-ical`
   - Event extraction and normalization

3. **ICS Service** (`src/services/icsService.ts`)
   - Business logic for ICS calendar management
   - URL validation and encryption
   - Event synchronization
   - Connection lifecycle management

4. **ICS Controller** (`src/controllers/icsController.ts`)
   - HTTP request handlers
   - Input validation with Zod
   - Error handling

5. **ICS Routes** (`src/routes/ics.ts`)
   - RESTful API endpoints
   - Authentication middleware

6. **Background Sync Job** (`src/jobs/icsSyncJob.ts`)
   - Periodic polling of ICS feeds
   - Staggered sync to avoid thundering herd
   - Configurable interval (default: 15 minutes)

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install
```

This will install:
- `node-ical@^0.18.0` - ICS parser
- `@types/node-ical@^0.17.1` - TypeScript types

### 2. Environment Configuration

Add to your `.env` file:

```bash
# ICS Calendar Configuration
ICS_SYNC_INTERVAL_MINUTES=15
ICS_FETCH_TIMEOUT_MS=10000
ICS_MAX_FILE_SIZE_MB=10
ICS_ALLOW_HTTP=false  # Set to 'true' only in development
```

### 3. Database Migration

The database migration should already be created. Verify the schema includes:

```prisma
model CalendarConnection {
  // ICS-specific fields
  icsUrl         String?  @map("ics_url") @db.Text
  icsETag        String?  @map("ics_etag") @db.VarChar(255)
  icsLastModified String? @map("ics_last_modified") @db.VarChar(255)
  isReadOnly     Boolean  @default(false) @map("is_read_only")

  // OAuth fields now nullable
  accessToken    String?  @map("access_token") @db.Text
  refreshToken   String?  @map("refresh_token") @db.Text
  tokenExpiresAt DateTime? @map("token_expires_at") @db.Timestamptz(3)
}

enum CalendarProvider {
  GOOGLE
  MICROSOFT
  APPLE
  ICS  // Added
}
```

Run migration:

```bash
npm run prisma:migrate
```

## API Endpoints

### 1. Validate ICS URL

**POST** `/api/calendars/ics/validate`

Request:
```json
{
  "url": "https://example.com/calendar.ics"
}
```

Response:
```json
{
  "valid": true,
  "calendarName": "My Calendar",
  "eventCount": 42
}
```

### 2. Connect ICS Calendar

**POST** `/api/calendars/ics/connect`

Request:
```json
{
  "url": "https://example.com/calendar.ics",
  "displayName": "External Calendar"  // optional
}
```

Response:
```json
{
  "message": "ICS calendar connected successfully",
  "connection": {
    "id": "uuid",
    "provider": "ICS",
    "calendarName": "External Calendar",
    "isReadOnly": true,
    "isConnected": true,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### 3. Get ICS Calendar Details

**GET** `/api/calendars/ics/:connectionId`

Response:
```json
{
  "connection": {
    "id": "uuid",
    "provider": "ICS",
    "calendarName": "External Calendar",
    "url": "https://example.com/calendar.ics",
    "isReadOnly": true,
    "lastSyncedAt": "2025-01-01T00:15:00Z",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### 4. Update ICS Calendar

**PUT** `/api/calendars/ics/:connectionId`

Request:
```json
{
  "url": "https://example.com/new-calendar.ics",  // optional
  "displayName": "Updated Name"  // optional
}
```

### 5. Delete ICS Calendar

**DELETE** `/api/calendars/ics/:connectionId`

Response:
```json
{
  "message": "ICS calendar deleted successfully"
}
```

### 6. Manual Sync

**POST** `/api/calendars/ics/:connectionId/sync`

Response:
```json
{
  "message": "ICS calendar synced successfully",
  "stats": {
    "eventsAdded": 5,
    "eventsUpdated": 10,
    "eventsDeleted": 2
  }
}
```

## Security Features

### SSRF Protection

The URL validator implements comprehensive SSRF protection:

1. **Protocol Whitelist**: HTTPS only (HTTP allowed in dev with `ICS_ALLOW_HTTP=true`)
2. **Private IP Blocking**:
   - 10.0.0.0/8
   - 172.16.0.0/12
   - 192.168.0.0/16
   - 127.0.0.0/8 (localhost)
   - 169.254.169.254 (AWS metadata)
3. **DNS Resolution**: Validates resolved IPs before fetching
4. **Redirect Validation**: Validates each redirect URL (max 3 redirects)

### Encryption

All ICS URLs are encrypted before storage using AES-256-GCM:

```typescript
// Encryption
const encryptedUrl = encryptToken(url);

// Decryption
const url = decryptToken(connection.icsUrl);
```

### Read-Only Enforcement

ICS calendars are automatically marked as read-only:

```typescript
if (connection.isReadOnly) {
  throw new Error('Cannot modify read-only calendar');
}
```

## Background Sync Job

The ICS sync job runs automatically every 15 minutes (configurable):

### Features

- **Staggered Sync**: Spreads syncs over 1 minute to avoid thundering herd
- **Error Handling**: Continues on individual calendar failures
- **Logging**: Comprehensive sync statistics

### Configuration

```env
ICS_SYNC_INTERVAL_MINUTES=15  # Poll every 15 minutes
```

### Manual Trigger (for testing)

```typescript
import icsSyncJob from './jobs/icsSyncJob';

// Trigger sync manually
await icsSyncJob.triggerSync();

// Get status
const status = icsSyncJob.getStatus();
console.log(status);
// {
//   running: true,
//   intervalMs: 900000,
//   intervalMinutes: 15,
//   isSyncing: false
// }
```

## Event Sync Integration

ICS sync is integrated into the existing `eventSyncService`:

```typescript
// In eventSyncService.ts
case CalendarProvider.ICS:
  const icsResult = await icsService.syncIcsEvents(connectionId);
  result = {
    totalEvents: icsResult.eventsAdded + icsResult.eventsUpdated,
    newEvents: icsResult.eventsAdded,
    updatedEvents: icsResult.eventsUpdated,
    deletedEvents: icsResult.eventsDeleted,
    errors: icsResult.error ? [icsResult.error] : [],
  };
  break;
```

## Testing Checklist

### SSRF Protection Tests

- [ ] Valid HTTPS URL passes validation
- [ ] HTTP URL rejected in production (allowed in dev with flag)
- [ ] Private IP `192.168.1.1` rejected
- [ ] Localhost `127.0.0.1` rejected
- [ ] AWS metadata `169.254.169.254` rejected
- [ ] DNS rebinding: hostname resolving to private IP rejected

### ICS Parsing Tests

- [ ] Simple ICS event parsed correctly
- [ ] Recurring event (RRULE) parsed correctly
- [ ] All-day event detected
- [ ] Attendees extracted
- [ ] Exception dates (EXDATE) handled
- [ ] Multiple events in one feed

### HTTP Caching Tests

- [ ] ETag header stored and sent on next fetch
- [ ] Last-Modified header stored and sent
- [ ] 304 Not Modified response handled correctly
- [ ] Content updated when feed changes

### Sync Tests

- [ ] New events created in database
- [ ] Updated events modified in database
- [ ] Deleted events marked as deleted
- [ ] Duplicate UIDs handled correctly

### Security Tests

- [ ] ICS URL encrypted before storage
- [ ] Decryption works correctly
- [ ] Read-only calendar rejects event creation
- [ ] SSRF attempts logged and blocked

### Background Job Tests

- [ ] Job starts on application startup
- [ ] Job polls at configured interval
- [ ] Staggered sync prevents overload
- [ ] Job stops on application shutdown
- [ ] Manual trigger works

## Error Handling

### Common Errors

1. **Invalid URL**
   ```json
   {
     "error": "Bad Request",
     "message": "Invalid ICS URL: Only HTTPS URLs are allowed in production"
   }
   ```

2. **SSRF Blocked**
   ```json
   {
     "error": "Bad Request",
     "message": "Invalid ICS URL: Hostname resolves to a private IP address"
   }
   ```

3. **Fetch Timeout**
   ```json
   {
     "error": "Internal Server Error",
     "message": "Failed to sync ICS calendar",
     "details": "Request timeout - ICS feed took too long to respond"
   }
   ```

4. **File Too Large**
   ```json
   {
     "error": "Internal Server Error",
     "message": "ICS file too large: 15.2MB (max: 10MB)"
   }
   ```

5. **Read-Only Modification**
   ```json
   {
     "error": "Bad Request",
     "message": "Cannot modify read-only calendar. This calendar is synced from an external source."
   }
   ```

## Performance Considerations

### HTTP Caching

- Use ETag and Last-Modified headers to minimize bandwidth
- 304 responses skip parsing and database updates
- Average response time: <100ms for cached feeds

### Staggered Sync

- Prevents thundering herd when many calendars sync at once
- Spreads load over 1 minute window
- Configurable per-calendar delay

### Database Queries

- Batch upsert operations for events
- Indexed lookups on `providerEventId`
- Soft deletes prevent data loss

## Monitoring and Logging

### Key Log Events

```typescript
// URL validation
logger.info('Validating ICS URL', { url });
logger.warn('Blocked private IP in ICS URL', { ip, url });

// Sync operations
logger.info('Starting ICS event sync', { connectionId });
logger.info('ICS event sync completed', { connectionId, eventsAdded, eventsUpdated, eventsDeleted });
logger.error('ICS event sync failed', { connectionId, error });

// Background job
logger.info('Starting ICS sync cycle');
logger.info('ICS sync cycle completed', { total, success, failed });
```

### Metrics to Monitor

- Sync success rate
- Average sync duration
- Feed fetch latency
- Parse errors
- SSRF attempts blocked

## Deployment

### Production Checklist

- [ ] `ICS_ALLOW_HTTP=false` (enforce HTTPS)
- [ ] `ICS_SYNC_INTERVAL_MINUTES` configured appropriately
- [ ] `ICS_MAX_FILE_SIZE_MB` set based on expected feeds
- [ ] `ENCRYPTION_KEY` configured (32 characters)
- [ ] Database migration applied
- [ ] Background job enabled
- [ ] Monitoring and alerting configured
- [ ] Rate limiting for ICS endpoints

### Environment Variables

```bash
# Production settings
NODE_ENV=production
ICS_SYNC_INTERVAL_MINUTES=15
ICS_FETCH_TIMEOUT_MS=10000
ICS_MAX_FILE_SIZE_MB=10
ICS_ALLOW_HTTP=false
```

## File Structure

```
backend/
├── src/
│   ├── controllers/
│   │   └── icsController.ts          # HTTP handlers
│   ├── integrations/
│   │   └── ics/
│   │       └── icsClient.ts          # ICS client
│   ├── jobs/
│   │   └── icsSyncJob.ts             # Background job
│   ├── routes/
│   │   └── ics.ts                    # API routes
│   ├── services/
│   │   ├── icsService.ts             # Business logic
│   │   ├── eventSyncService.ts       # Updated with ICS support
│   │   ├── eventCreateService.ts     # Updated with read-only check
│   │   └── backgroundJobs.ts         # Updated with ICS job
│   └── utils/
│       └── urlValidator.ts           # SSRF protection
└── prisma/
    └── schema.prisma                 # Database schema
```

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Verify environment configuration
3. Test with a known-good ICS feed (e.g., Google Calendar export)
4. Check SSRF protection isn't blocking legitimate URLs

## Future Enhancements

Potential improvements:
- [ ] Custom sync intervals per calendar
- [ ] Webhook support for ICS providers that support it
- [ ] Calendar color extraction from ICS metadata
- [ ] Import/export ICS files (not just subscriptions)
- [ ] Advanced RRULE parsing (complex recurrence patterns)
- [ ] Timezone conversion improvements
- [ ] Attachment handling
