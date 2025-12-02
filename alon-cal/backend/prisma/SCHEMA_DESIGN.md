# Calendar Integration Database Schema Design

## Overview

This document describes the database schema for the calendar integration system supporting Google Calendar, Microsoft Outlook, and Apple Calendar with event syncing capabilities.

## Changes from Previous Schema

### 1. Enhanced CalendarProvider Enum
- **Added**: `APPLE` provider support
- **Impact**: Supports Apple Calendar OAuth integration

### 2. New Enums

#### EventStatus
```prisma
enum EventStatus {
  CONFIRMED   // Event is confirmed
  TENTATIVE   // Event is tentative
  CANCELLED   // Event is cancelled
}
```

#### SyncStatus
```prisma
enum SyncStatus {
  PENDING     // Event sync is pending
  SYNCED      // Event successfully synced
  FAILED      // Event sync failed
  DELETED     // Event deleted from provider
}
```

#### RecurrenceFrequency
```prisma
enum RecurrenceFrequency {
  DAILY       // Repeats daily
  WEEKLY      // Repeats weekly
  MONTHLY     // Repeats monthly
  YEARLY      // Repeats yearly
}
```

### 3. New Table: OAuthState (CSRF Protection)

**Purpose**: Secure OAuth flow with state token validation

**Schema**:
```sql
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  state VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed BOOLEAN NOT NULL DEFAULT false
);
```

**Key Features**:
- **State Token**: Random unique token for CSRF protection
- **Expiry**: 15-minute expiration for security
- **Consumed Flag**: Prevents replay attacks
- **Provider Tracking**: Links state to specific calendar provider

**Indexes**:
- `state` (unique) - Fast lookup during OAuth callback
- `expires_at` - Efficient cleanup of expired tokens
- `(user_id, provider)` - User-specific provider lookups

### 4. New Table: CalendarEvent (Event Syncing)

**Purpose**: Store synced calendar events from all providers in unified schema

**Schema**:
```sql
CREATE TABLE calendar_events (
  -- Core fields
  id UUID PRIMARY KEY,
  calendar_connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  provider_event_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  location VARCHAR(500),

  -- Timing
  start_time TIMESTAMPTZ(3) NOT NULL,
  end_time TIMESTAMPTZ(3) NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',

  -- Status
  status event_status NOT NULL DEFAULT 'CONFIRMED',
  sync_status sync_status NOT NULL DEFAULT 'SYNCED',

  -- Recurrence
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  recurrence_frequency recurrence_frequency,
  recurrence_interval INTEGER,
  recurrence_end_date TIMESTAMPTZ(3),
  recurrence_count INTEGER,
  parent_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- JSONB fields
  attendees JSONB,
  reminders JSONB,
  provider_metadata JSONB,

  -- Additional
  html_link TEXT,
  last_synced_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  deleted_at TIMESTAMPTZ(3)
);
```

**Key Features**:
- **Unified Schema**: Works for Google, Microsoft, and Apple events
- **Recurring Events**: Full support with parent/child relationships
- **Soft Delete**: `deleted_at` for sync tracking
- **JSONB Flexibility**: Provider-specific data without schema changes
- **Timezone Aware**: All timestamps in UTC with timezone tracking

**JSONB Field Structures**:

```typescript
// attendees JSONB
[
  {
    email: string,
    name?: string,
    responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction',
    organizer: boolean
  }
]

// reminders JSONB
[
  {
    method: 'email' | 'popup' | 'sms',
    minutes: number  // Minutes before event
  }
]

// provider_metadata JSONB
{
  // Google-specific
  googleMeetLink?: string,
  conferenceData?: object,

  // Microsoft-specific
  teamsLink?: string,
  onlineMeetingUrl?: string,

  // Apple-specific
  appleSpecificField?: any,

  // Provider-agnostic
  rawData?: object  // Full provider response if needed
}
```

### 5. Enhanced CalendarConnection Table

**New Field**:
- `sync_token` (TEXT) - Provider-specific token for incremental sync

**Purpose**: Enables efficient incremental syncing instead of full sync every time

**Provider-Specific Usage**:
- **Google**: syncToken from Calendar API
- **Microsoft**: deltaLink from Graph API
- **Apple**: syncToken from CalDAV

## Index Strategy

### Performance Optimization Goals

1. **Fast date range queries** (most common use case)
2. **Efficient sync operations**
3. **Quick OAuth flow validation**
4. **Optimized recurring event lookups**

### OAuthState Indexes

```sql
-- Primary lookup during OAuth callback
CREATE UNIQUE INDEX oauth_states_state_key ON oauth_states(state);
CREATE INDEX oauth_states_state_idx ON oauth_states(state);

-- Cleanup expired tokens (background job)
CREATE INDEX oauth_states_expires_at_idx ON oauth_states(expires_at);

-- User-specific provider lookups
CREATE INDEX oauth_states_user_id_provider_idx ON oauth_states(user_id, provider);
```

**Query Patterns**:
- OAuth callback validation: `WHERE state = ?` (< 1ms with unique index)
- Expired token cleanup: `WHERE expires_at < NOW()` (efficient scan)
- User provider states: `WHERE user_id = ? AND provider = ?`

### CalendarEvent Indexes

```sql
-- Foreign key index (required for CASCADE deletes)
CREATE INDEX calendar_events_calendar_connection_id_idx
ON calendar_events(calendar_connection_id);

-- Provider event lookups
CREATE INDEX calendar_events_provider_event_id_idx
ON calendar_events(provider_event_id);

-- Date range queries (CRITICAL for performance)
CREATE INDEX calendar_events_start_time_idx ON calendar_events(start_time);
CREATE INDEX calendar_events_end_time_idx ON calendar_events(end_time);

-- Status filtering
CREATE INDEX calendar_events_status_idx ON calendar_events(status);
CREATE INDEX calendar_events_sync_status_idx ON calendar_events(sync_status);

-- Recurring events
CREATE INDEX calendar_events_is_recurring_idx ON calendar_events(is_recurring);
CREATE INDEX calendar_events_parent_event_id_idx ON calendar_events(parent_event_id);

-- Soft delete support
CREATE INDEX calendar_events_deleted_at_idx ON calendar_events(deleted_at);

-- COMPOSITE INDEXES (Query Optimization)

-- Most common query: Get events for calendar in date range
-- Query: SELECT * FROM calendar_events
--        WHERE calendar_connection_id = ?
--        AND start_time >= ? AND end_time <= ?
--        AND deleted_at IS NULL
CREATE INDEX calendar_events_connection_date_range_idx
ON calendar_events(calendar_connection_id, start_time, end_time);

-- Sync operations: Get pending/failed syncs for calendar
-- Query: SELECT * FROM calendar_events
--        WHERE calendar_connection_id = ?
--        AND sync_status IN ('PENDING', 'FAILED')
CREATE INDEX calendar_events_connection_sync_status_idx
ON calendar_events(calendar_connection_id, sync_status);

-- Unique constraint prevents duplicate events
CREATE UNIQUE INDEX calendar_events_calendar_connection_id_provider_event_id_key
ON calendar_events(calendar_connection_id, provider_event_id);
```

### Index Usage Analysis

#### Query: Get User's Events for Week View
```sql
SELECT e.*
FROM calendar_events e
JOIN calendar_connections c ON e.calendar_connection_id = c.id
WHERE c.user_id = 'user-uuid'
  AND e.start_time >= '2025-11-22 00:00:00'
  AND e.end_time <= '2025-11-29 23:59:59'
  AND e.deleted_at IS NULL
ORDER BY e.start_time;
```

**Index Usage**:
- `calendar_events_connection_date_range_idx` (optimal)
- PostgreSQL uses index scan on composite index
- Expected: < 10ms for 1000s of events

#### Query: Sync Pending Events
```sql
SELECT *
FROM calendar_events
WHERE calendar_connection_id = 'connection-uuid'
  AND sync_status = 'PENDING'
ORDER BY created_at;
```

**Index Usage**:
- `calendar_events_connection_sync_status_idx` (optimal)
- Returns only unsynchronized events
- Expected: < 5ms

#### Query: Get Recurring Event Instances
```sql
SELECT *
FROM calendar_events
WHERE parent_event_id = 'parent-uuid'
  AND deleted_at IS NULL
ORDER BY start_time;
```

**Index Usage**:
- `calendar_events_parent_event_id_idx`
- Efficient for recurring event expansion
- Expected: < 5ms for 100s of instances

### Index Maintenance

**Auto-Vacuum Configuration**:
```sql
-- Recommended settings for high-churn tables
ALTER TABLE calendar_events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
```

**Why**: Calendar events have frequent updates (sync status changes), so aggressive auto-vacuum keeps indexes efficient.

## Data Integrity Constraints

### Unique Constraints

1. **Unique User Calendar**:
   ```sql
   UNIQUE (user_id, provider, calendar_id)
   ```
   Prevents duplicate calendar connections

2. **Unique Calendar Event**:
   ```sql
   UNIQUE (calendar_connection_id, provider_event_id)
   ```
   Prevents duplicate events from same provider

3. **Unique OAuth State**:
   ```sql
   UNIQUE (state)
   ```
   CSRF protection requires unique state tokens

### Foreign Key Cascades

1. **User Deletion**:
   - Cascades to: `calendar_connections`, `sessions`, `oauth_states`
   - Sets NULL: `audit_logs.user_id`

2. **Calendar Connection Deletion**:
   - Cascades to: `calendar_events`
   - **Impact**: Deleting a calendar removes all its events

3. **Recurring Event Parent Deletion**:
   - Cascades to: All child instances
   - **Impact**: Deleting parent removes all instances

### Check Constraints (Future Enhancement)

```sql
-- Ensure end time is after start time
ALTER TABLE calendar_events
ADD CONSTRAINT check_event_time_order
CHECK (end_time > start_time);

-- Ensure recurrence count is positive
ALTER TABLE calendar_events
ADD CONSTRAINT check_recurrence_count_positive
CHECK (recurrence_count IS NULL OR recurrence_count > 0);

-- Ensure recurrence interval is positive
ALTER TABLE calendar_events
ADD CONSTRAINT check_recurrence_interval_positive
CHECK (recurrence_interval IS NULL OR recurrence_interval > 0);
```

## Security Considerations

### Encrypted Fields

**CalendarConnection**:
- `access_token` - Encrypted at application layer
- `refresh_token` - Encrypted at application layer

**Encryption Method** (Application Layer):
- Algorithm: AES-256-GCM
- Key: Stored in environment variable `ENCRYPTION_KEY`
- Implementation: Node.js `crypto` module

**Example Encryption**:
```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### OAuth State Token Security

1. **Random Generation**: Use `crypto.randomBytes(32)` for state tokens
2. **Short Expiry**: 15 minutes maximum
3. **One-Time Use**: `consumed` flag prevents replay
4. **Automatic Cleanup**: Background job removes expired tokens

### Rate Limiting

Recommended rate limits for calendar operations:

```typescript
// OAuth endpoints
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 OAuth attempts per IP
  message: 'Too many OAuth attempts'
});

// Event sync endpoints
const syncLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 sync requests per minute per user
  message: 'Too many sync requests'
});
```

## Scalability Considerations

### Partitioning Strategy (Future)

When event count > 10 million, consider partitioning `calendar_events`:

```sql
-- Partition by date range (monthly)
CREATE TABLE calendar_events (
  -- ... columns
) PARTITION BY RANGE (start_time);

-- Create partitions for each month
CREATE TABLE calendar_events_2025_11
PARTITION OF calendar_events
FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE calendar_events_2025_12
PARTITION OF calendar_events
FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- etc.
```

**Benefits**:
- Faster queries (scan only relevant partitions)
- Easier archival (drop old partitions)
- Better index performance

### Connection Pooling

```typescript
// Recommended Prisma connection pool settings
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool configuration
  // connection_limit = 20
  // pool_timeout = 10
}
```

### Read Replicas

For high-traffic applications:

1. **Write**: Primary database
2. **Read**: Replica for event queries

```typescript
// Prisma with read replica
const prismaWrite = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

const prismaRead = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_READ_URL } }
});

// Use read replica for queries
const events = await prismaRead.calendarEvent.findMany({
  where: { calendarConnectionId: connectionId }
});

// Use primary for writes
await prismaWrite.calendarEvent.create({ data: eventData });
```

## Migration Workflow

### Running the Migration

```bash
# Development
npm run prisma:migrate

# Production
npm run prisma:migrate:prod
```

### Rollback Strategy

If migration fails, rollback using:

```bash
# Reset database (DESTRUCTIVE - dev only)
npx prisma migrate reset

# In production, manually revert:
psql -d your_database -f rollback.sql
```

**Rollback Script** (`rollback.sql`):
```sql
-- Drop new tables
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS oauth_states CASCADE;

-- Remove new column
ALTER TABLE calendar_connections DROP COLUMN IF EXISTS sync_token;

-- Drop new enums
DROP TYPE IF EXISTS event_status CASCADE;
DROP TYPE IF EXISTS sync_status CASCADE;
DROP TYPE IF EXISTS recurrence_frequency CASCADE;

-- Revert enum (cannot remove value, requires recreation)
-- WARNING: This will require re-creating all dependent tables
-- Not recommended in production with existing data
```

### Zero-Downtime Migration

For production with existing users:

1. **Add new tables** (no impact on existing code)
2. **Deploy application** with dual-write support
3. **Backfill data** if needed
4. **Switch reads** to new tables
5. **Remove old code** after verification

## Maintenance Tasks

### Scheduled Jobs

1. **OAuth State Cleanup** (every 15 minutes):
   ```sql
   DELETE FROM oauth_states
   WHERE expires_at < NOW() OR consumed = true;
   ```

2. **Hard Delete Soft-Deleted Events** (daily):
   ```sql
   DELETE FROM calendar_events
   WHERE deleted_at < NOW() - INTERVAL '30 days';
   ```

3. **Token Refresh** (hourly):
   ```typescript
   // Refresh tokens expiring in next hour
   const connections = await prisma.calendarConnection.findMany({
     where: {
       tokenExpiresAt: {
         lt: new Date(Date.now() + 60 * 60 * 1000)
       },
       isConnected: true
     }
   });

   for (const conn of connections) {
     await refreshOAuthToken(conn);
   }
   ```

4. **Sync Events** (every 5 minutes per connection):
   ```typescript
   // Incremental sync using sync_token
   const connections = await prisma.calendarConnection.findMany({
     where: {
       isConnected: true,
       OR: [
         { lastSyncedAt: null },
         { lastSyncedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }
       ]
     }
   });

   for (const conn of connections) {
     await syncCalendarEvents(conn);
   }
   ```

## Testing Recommendations

### Database Tests

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('CalendarEvent Schema', () => {
  it('should prevent duplicate events', async () => {
    const event1 = await prisma.calendarEvent.create({
      data: {
        calendarConnectionId: 'conn-uuid',
        providerEventId: 'event-123',
        title: 'Test Event',
        startTime: new Date(),
        endTime: new Date()
      }
    });

    // Should throw unique constraint violation
    await expect(
      prisma.calendarEvent.create({
        data: {
          calendarConnectionId: 'conn-uuid',
          providerEventId: 'event-123', // Duplicate
          title: 'Test Event',
          startTime: new Date(),
          endTime: new Date()
        }
      })
    ).rejects.toThrow();
  });

  it('should cascade delete events when calendar deleted', async () => {
    const connection = await prisma.calendarConnection.create({
      data: { /* ... */ }
    });

    await prisma.calendarEvent.create({
      data: {
        calendarConnectionId: connection.id,
        providerEventId: 'event-456',
        title: 'Test Event',
        startTime: new Date(),
        endTime: new Date()
      }
    });

    await prisma.calendarConnection.delete({
      where: { id: connection.id }
    });

    const events = await prisma.calendarEvent.findMany({
      where: { calendarConnectionId: connection.id }
    });

    expect(events).toHaveLength(0);
  });
});
```

## Summary of Changes

### New Tables
1. **oauth_states** - CSRF protection for OAuth flow
2. **calendar_events** - Unified event storage from all providers

### Schema Enhancements
1. **CalendarProvider enum** - Added APPLE
2. **New enums** - EventStatus, SyncStatus, RecurrenceFrequency
3. **CalendarConnection** - Added syncToken field

### Indexes Added
- 3 indexes on oauth_states
- 14 indexes on calendar_events (including 2 composite)

### Total Database Objects
- **Tables**: 6 (users, sessions, calendar_connections, calendar_events, oauth_states, audit_logs)
- **Enums**: 5 (CalendarProvider, AuditStatus, EventStatus, SyncStatus, RecurrenceFrequency)
- **Indexes**: 35+ total across all tables
- **Foreign Keys**: 8 with appropriate CASCADE/SET NULL behavior
