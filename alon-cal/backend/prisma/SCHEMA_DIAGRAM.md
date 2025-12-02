# Database Schema Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    User                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ id                UUID (PK)                                                 │
│ email             VARCHAR(255) UNIQUE                                       │
│ passwordHash      VARCHAR(255)                                              │
│ firstName         VARCHAR(100) NULL                                         │
│ lastName          VARCHAR(100) NULL                                         │
│ createdAt         TIMESTAMPTZ(3)                                            │
│ updatedAt         TIMESTAMPTZ(3)                                            │
│ deletedAt         TIMESTAMPTZ(3) NULL                                       │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ├──────────────────────────┬──────────────────────┬────────────────┐
         │                          │                      │                │
         ▼                          ▼                      ▼                ▼
┌─────────────────────┐  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐
│ CalendarConnection  │  │   OAuthState     │  │    Session     │  │   AuditLog     │
├─────────────────────┤  ├──────────────────┤  ├────────────────┤  ├────────────────┤
│ id        UUID (PK) │  │ id     UUID (PK) │  │ id   UUID (PK) │  │ id   UUID (PK) │
│ userId    UUID (FK) │  │ userId UUID (FK) │  │ userId UUID FK │  │ userId UUID FK │
│ provider  ENUM      │  │ provider ENUM    │  │ tokenHash TEXT │  │ action VARCHAR │
│ calendarId VARCHAR  │  │ state  VARCHAR   │  │ expiresAt TSTZ │  │ resourceType   │
│ calendarName TEXT   │  │ expiresAt TSTZ   │  │ createdAt TSTZ │  │ resourceId     │
│ accessToken TEXT    │  │ createdAt TSTZ   │  │ userAgent TEXT │  │ status ENUM    │
│ refreshToken TEXT   │  │ consumed BOOLEAN │  │ ipAddress VCHAR│  │ errorMessage   │
│ tokenExpiresAt TSTZ │  └──────────────────┘  └────────────────┘  │ ipAddress      │
│ calendarColor VCHAR │                                             │ userAgent      │
│ isPrimary BOOLEAN   │                                             │ metadata JSONB │
│ isConnected BOOLEAN │                                             │ createdAt TSTZ │
│ lastSyncedAt TSTZ   │                                             └────────────────┘
│ syncToken TEXT      │
│ createdAt TSTZ      │
│ updatedAt TSTZ      │
│ deletedAt TSTZ NULL │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CalendarEvent                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ id                    UUID (PK)                                             │
│ calendarConnectionId  UUID (FK) → CalendarConnection.id                     │
│ providerEventId       VARCHAR(255)                                          │
│ title                 VARCHAR(500)                                          │
│ description           TEXT NULL                                             │
│ location              VARCHAR(500) NULL                                     │
│ startTime             TIMESTAMPTZ(3)                                        │
│ endTime               TIMESTAMPTZ(3)                                        │
│ isAllDay              BOOLEAN                                               │
│ timezone              VARCHAR(100)                                          │
│ status                ENUM(CONFIRMED, TENTATIVE, CANCELLED)                 │
│ syncStatus            ENUM(PENDING, SYNCED, FAILED, DELETED)                │
│                                                                             │
│ -- Recurrence fields                                                        │
│ isRecurring           BOOLEAN                                               │
│ recurrenceRule        TEXT NULL                                             │
│ recurrenceFrequency   ENUM(DAILY, WEEKLY, MONTHLY, YEARLY) NULL            │
│ recurrenceInterval    INTEGER NULL                                          │
│ recurrenceEndDate     TIMESTAMPTZ(3) NULL                                   │
│ recurrenceCount       INTEGER NULL                                          │
│ parentEventId         UUID (FK) → CalendarEvent.id (self-reference)         │
│                                                                             │
│ -- JSONB fields                                                             │
│ attendees             JSONB NULL [{email, name, responseStatus, organizer}] │
│ reminders             JSONB NULL [{method, minutes}]                        │
│ providerMetadata      JSONB NULL {provider-specific fields}                 │
│                                                                             │
│ -- Additional                                                               │
│ htmlLink              TEXT NULL                                             │
│ lastSyncedAt          TIMESTAMPTZ(3) NULL                                   │
│ createdAt             TIMESTAMPTZ(3)                                        │
│ updatedAt             TIMESTAMPTZ(3)                                        │
│ deletedAt             TIMESTAMPTZ(3) NULL                                   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ Self-referencing (Recurring Events)
         │ Parent (1) ────> Children (N)
         └─────────────────────────────────────────────────────┐
                                                               │
                                                               ▼
                                                  ┌──────────────────────────┐
                                                  │  CalendarEvent Instance  │
                                                  │  (Child Event)           │
                                                  └──────────────────────────┘
```

## Enums

```
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  CalendarProvider    │  │   EventStatus    │  │    SyncStatus        │
├──────────────────────┤  ├──────────────────┤  ├──────────────────────┤
│ • GOOGLE             │  │ • CONFIRMED      │  │ • PENDING            │
│ • MICROSOFT          │  │ • TENTATIVE      │  │ • SYNCED             │
│ • APPLE              │  │ • CANCELLED      │  │ • FAILED             │
└──────────────────────┘  └──────────────────┘  │ • DELETED            │
                                                  └──────────────────────┘

┌──────────────────────┐  ┌──────────────────┐
│ RecurrenceFrequency  │  │  AuditStatus     │
├──────────────────────┤  ├──────────────────┤
│ • DAILY              │  │ • SUCCESS        │
│ • WEEKLY             │  │ • FAILURE        │
│ • MONTHLY            │  └──────────────────┘
│ • YEARLY             │
└──────────────────────┘
```

## Index Strategy Visualization

### CalendarEvent Indexes

```
Primary Key: id (UUID)
Unique: (calendarConnectionId, providerEventId)

Single Column Indexes:
├─ calendarConnectionId  ← Foreign key, most queries filter by this
├─ providerEventId       ← Provider sync operations
├─ startTime             ← Date range queries (start)
├─ endTime               ← Date range queries (end)
├─ status                ← Filter by event status
├─ syncStatus            ← Sync operations
├─ isRecurring           ← Filter recurring events
├─ parentEventId         ← Find child instances
└─ deletedAt             ← Soft delete filtering

Composite Indexes (Query Optimization):
├─ (calendarConnectionId, startTime, endTime)  ← Most common: calendar + date range
└─ (calendarConnectionId, syncStatus)          ← Sync operations per calendar
```

### OAuthState Indexes

```
Primary Key: id (UUID)
Unique: state

Single Column Indexes:
├─ state                 ← OAuth callback validation (unique)
└─ expiresAt             ← Cleanup expired tokens

Composite Indexes:
└─ (userId, provider)    ← User's OAuth states per provider
```

### CalendarConnection Indexes

```
Primary Key: id (UUID)
Unique: (userId, provider, calendarId)

Single Column Indexes:
├─ userId                ← User's calendars
├─ provider              ← Filter by provider
├─ isConnected           ← Active connections only
├─ lastSyncedAt          ← Find calendars needing sync
└─ deletedAt             ← Soft delete filtering
```

## Data Flow Diagram

### OAuth Flow with CSRF Protection

```
┌──────────┐                                                    ┌──────────────┐
│  Client  │                                                    │   Provider   │
│ (Browser)│                                                    │  (Google/MS) │
└────┬─────┘                                                    └──────┬───────┘
     │                                                                 │
     │ 1. Request OAuth URL                                            │
     ├────────────────────────────────────────────────────────┐        │
     │                                                        │        │
     │                                          ┌─────────────▼────────┴────┐
     │                                          │    Backend Server         │
     │                                          │─────────────────────────│
     │                                          │ 2. Generate state token │
     │                                          │ 3. Store in oauth_states│
     │ 4. Return OAuth URL with state           │    with 15min expiry    │
     │◄─────────────────────────────────────────┤                         │
     │                                          └─────────────────────────┘
     │
     │ 5. Redirect to Provider with state
     ├──────────────────────────────────────────────────────────────────►
     │                                                                 │
     │                    6. User authorizes                           │
     │                                                                 │
     │ 7. Redirect back with state & code
     │◄────────────────────────────────────────────────────────────────┤
     │                                                                 │
     │ 8. Send code & state to backend                                 │
     ├────────────────────────────────────────────────────────────┐    │
     │                                                            │    │
     │                                          ┌─────────────────▼────┴────┐
     │                                          │    Backend Server         │
     │                                          │─────────────────────────│
     │                                          │ 9. Validate state token │
     │                                          │ 10. Mark consumed       │
     │                                          │ 11. Exchange code       │
     │                                          │ 12. Store tokens        │
     │                                          │     in calendar_        │
     │                                          │     connections         │
     │ 13. Success response                     │ 13. Create audit log    │
     │◄─────────────────────────────────────────┤                         │
     │                                          └─────────────────────────┘
```

### Event Sync Flow

```
┌─────────────────┐                    ┌─────────────────┐
│  Sync Scheduler │                    │  Calendar API   │
│  (Background)   │                    │  (Provider)     │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ 1. Find calendars to sync            │
         │    (lastSyncedAt > 5 min ago)        │
         ├──────────────────────────────────┐   │
         │                                  │   │
         │                    ┌─────────────▼───┴─────────┐
         │                    │  calendar_connections     │
         │                    │  WHERE isConnected = true  │
         │                    │  AND lastSyncedAt < now-5m │
         │                    └─────────────┬──────────────┘
         │                                  │
         │ 2. For each connection:          │
         │    Get syncToken                 │
         │◄──────────────────────────────────┤
         │                                  │
         │ 3. Fetch events from provider
         │    with syncToken (incremental)
         ├──────────────────────────────────────────────────►
         │                                      │
         │ 4. Return new/updated events         │
         │    + new syncToken                   │
         │◄──────────────────────────────────────────────────┤
         │                                      │
         │ 5. Upsert events                     │
         │    into calendar_events              │
         ├──────────────────────────────────┐   │
         │                                  │   │
         │                    ┌─────────────▼───┴─────────┐
         │                    │  calendar_events          │
         │                    │  UPSERT by (              │
         │                    │    calendarConnectionId,  │
         │                    │    providerEventId        │
         │                    │  )                        │
         │                    └─────────────┬─────────────┘
         │                                  │
         │ 6. Update connection             │
         │    with new syncToken            │
         │    and lastSyncedAt              │
         ├──────────────────────────────────►
         │                                  │
         │ 7. Log audit entry               │
         ├──────────────────────────────────┐
         │                                  │
         │                    ┌─────────────▼──────────────┐
         │                    │  audit_logs               │
         │                    │  action: EVENT_SYNC_SUCCESS│
         │                    └───────────────────────────┘
```

## Query Optimization Examples

### Query 1: Get User's Events for Week View

```sql
-- Query
SELECT e.*, cc.calendar_name, cc.calendar_color
FROM calendar_events e
JOIN calendar_connections cc ON e.calendar_connection_id = cc.id
WHERE cc.user_id = 'user-uuid'
  AND e.start_time >= '2025-11-22'
  AND e.end_time <= '2025-11-29'
  AND e.deleted_at IS NULL
ORDER BY e.start_time;

-- Index Usage
┌───────────────────────────────────────────────────────────────┐
│ Query Plan                                                    │
├───────────────────────────────────────────────────────────────┤
│ 1. Index Scan on calendar_events_connection_date_range_idx   │
│    (composite index: calendarConnectionId, startTime, endTime)│
│ 2. Nested Loop Join with calendar_connections                │
│ 3. Filter: deletedAt IS NULL                                  │
│ 4. Sort: startTime ASC                                        │
└───────────────────────────────────────────────────────────────┘

Execution Time: ~5-10ms for 1000s of events
```

### Query 2: Find Pending Sync Events

```sql
-- Query
SELECT *
FROM calendar_events
WHERE calendar_connection_id = 'connection-uuid'
  AND sync_status IN ('PENDING', 'FAILED')
ORDER BY created_at;

-- Index Usage
┌───────────────────────────────────────────────────────────────┐
│ Query Plan                                                    │
├───────────────────────────────────────────────────────────────┤
│ 1. Index Scan on calendar_events_connection_sync_status_idx  │
│    (composite index: calendarConnectionId, syncStatus)        │
│ 2. Filter: syncStatus IN ('PENDING', 'FAILED')                │
│ 3. Sort: createdAt ASC                                        │
└───────────────────────────────────────────────────────────────┘

Execution Time: ~2-5ms
```

### Query 3: OAuth State Validation

```sql
-- Query
SELECT *
FROM oauth_states
WHERE state = 'random-state-token'
  AND expires_at > NOW()
  AND consumed = false;

-- Index Usage
┌───────────────────────────────────────────────────────────────┐
│ Query Plan                                                    │
├───────────────────────────────────────────────────────────────┤
│ 1. Index Scan on oauth_states_state_key (unique index)       │
│ 2. Filter: expires_at > NOW() AND consumed = false            │
└───────────────────────────────────────────────────────────────┘

Execution Time: <1ms (unique index lookup)
```

## Table Size Estimates

Based on typical usage patterns:

```
┌─────────────────────────┬──────────────┬──────────────┬─────────────┐
│ Table                   │ Row Size     │ Rows (1000u) │ Total Size  │
├─────────────────────────┼──────────────┼──────────────┼─────────────┤
│ users                   │ ~500 bytes   │ 1,000        │ ~500 KB     │
│ sessions                │ ~300 bytes   │ 3,000        │ ~900 KB     │
│ calendar_connections    │ ~800 bytes   │ 3,000        │ ~2.4 MB     │
│ calendar_events         │ ~2 KB        │ 300,000      │ ~600 MB     │
│ oauth_states            │ ~200 bytes   │ ~100 (temp)  │ ~20 KB      │
│ audit_logs              │ ~1 KB        │ 50,000       │ ~50 MB      │
├─────────────────────────┼──────────────┼──────────────┼─────────────┤
│ Total Data              │              │              │ ~653 MB     │
│ Indexes (~30% of data)  │              │              │ ~200 MB     │
│ Total Database Size     │              │              │ ~850 MB     │
└─────────────────────────┴──────────────┴──────────────┴─────────────┘

Notes:
- 1000 users
- Average 3 calendar connections per user
- Average 100 events per calendar
- oauth_states is temporary (15min lifetime)
- Assumes 6 months of audit logs
```

## Maintenance Windows

```
Daily:
├─ 00:00 UTC: Hard delete soft-deleted events (> 30 days)
├─ 00:30 UTC: Vacuum and analyze tables
└─ 01:00 UTC: Update table statistics

Hourly:
├─ XX:00: Refresh expiring OAuth tokens
├─ XX:15: Cleanup expired oauth_states
├─ XX:30: Archive old audit logs (> 90 days)
└─ XX:45: Check database health metrics

Every 5 Minutes:
└─ XX:X5: Sync calendar events (incremental)

Continuous:
├─ Auto-vacuum (when 5% of rows change)
└─ Index maintenance (PostgreSQL auto)
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                         │
│  • OAuth state validation (CSRF protection)                    │
│  • Token encryption (AES-256-GCM)                               │
│  • Rate limiting (API endpoints)                                │
│  • JWT session validation                                       │
└──────────────────────────┬──────────────────────────────────────┘
                          │
┌──────────────────────────▼──────────────────────────────────────┐
│                      Database Layer                             │
│  • Foreign key constraints (referential integrity)              │
│  • Unique constraints (prevent duplicates)                      │
│  • Check constraints (data validation)                          │
│  • Row-level security (RLS) - optional                          │
└──────────────────────────┬──────────────────────────────────────┘
                          │
┌──────────────────────────▼──────────────────────────────────────┐
│                   Infrastructure Layer                          │
│  • SSL/TLS encryption (in transit)                              │
│  • Database encryption (at rest) - optional                     │
│  • Network isolation (VPC)                                      │
│  • Backup encryption                                            │
└─────────────────────────────────────────────────────────────────┘
```
