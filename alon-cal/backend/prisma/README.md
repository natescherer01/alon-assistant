# Calendar Integration Database Schema

## Overview

This directory contains the complete database schema for a calendar integration application supporting Google Calendar, Microsoft Outlook, and Apple Calendar with full event syncing capabilities.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and ENCRYPTION_KEY

# 3. Generate Prisma Client
npm run prisma:generate

# 4. Run migration
npm run prisma:migrate

# 5. Verify with Prisma Studio
npm run prisma:studio
```

## Documentation Files

### Core Documentation

1. **[schema.prisma](./schema.prisma)** - Main Prisma schema definition
   - All table definitions
   - Enum types
   - Relationships and constraints
   - Indexes

2. **[SCHEMA_DESIGN.md](./SCHEMA_DESIGN.md)** - Comprehensive design documentation
   - Schema rationale and decisions
   - Index strategy and optimization
   - Security considerations
   - Scalability guidelines
   - Maintenance tasks

3. **[SCHEMA_DIAGRAM.md](./SCHEMA_DIAGRAM.md)** - Visual schema representation
   - Entity relationship diagrams
   - Data flow diagrams
   - Query optimization examples
   - Performance benchmarks

4. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Developer quick reference
   - Common query patterns
   - JSONB field examples
   - Background job templates
   - Testing examples

5. **[MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)** - Migration deployment guide
   - Pre-migration steps
   - Migration execution
   - Post-migration verification
   - Rollback procedures

## Schema Summary

### Tables (6 Total)

| Table | Purpose | Key Features |
|-------|---------|--------------|
| **users** | User authentication | Soft delete, bcrypt passwords |
| **sessions** | JWT session tracking | Auto-expiry, device context |
| **calendar_connections** | OAuth calendar links | Token encryption, sync tracking |
| **calendar_events** | Synced calendar events | JSONB metadata, recurring events |
| **oauth_states** | CSRF protection | 15-min expiry, one-time use |
| **audit_logs** | Compliance & debugging | Immutable, rich metadata |

### Key Features

#### OAuth State Management (CSRF Protection)
- Random state tokens generated before OAuth redirect
- 15-minute expiration for security
- Consumed flag prevents replay attacks
- Automatic cleanup of expired tokens

#### Calendar Event Syncing
- Unified schema for Google, Microsoft, and Apple events
- Incremental sync using provider sync tokens
- Recurring event support with parent/child relationships
- JSONB fields for provider-specific data
- Soft delete for sync history preservation

#### Token Management
- AES-256-GCM encryption for OAuth tokens
- Automatic refresh before expiration
- Secure storage with environment-based keys

#### Performance Optimization
- 35+ indexes across all tables
- Composite indexes for common query patterns
- Date range optimization for calendar views
- JSONB indexing for metadata queries

## Database Statistics (1000 Users)

```
Total Database Size: ~850 MB
├─ calendar_events:        ~600 MB (300,000 events)
├─ audit_logs:             ~50 MB (50,000 logs)
├─ calendar_connections:   ~2.4 MB (3,000 connections)
├─ sessions:               ~900 KB (3,000 sessions)
├─ users:                  ~500 KB (1,000 users)
├─ oauth_states:           ~20 KB (temporary)
└─ indexes:                ~200 MB (30% overhead)
```

## Migration History

### 20251122072857_init
- Initial schema
- Users, sessions, calendar connections, audit logs
- Google and Microsoft provider support

### 20251122_add_calendar_events_and_oauth_state (NEW)
- Added Apple Calendar support
- Created calendar_events table for event syncing
- Created oauth_states table for CSRF protection
- Added sync_token to calendar_connections
- Added 4 new enums (EventStatus, SyncStatus, RecurrenceFrequency)
- Added 14+ indexes for performance

## Common Use Cases

### 1. OAuth Flow with CSRF Protection

```typescript
// Step 1: Generate OAuth URL
const state = crypto.randomBytes(32).toString('hex');
await prisma.oAuthState.create({
  data: {
    userId, provider: 'GOOGLE', state,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000)
  }
});
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&...`;

// Step 2: Validate callback
const oauthState = await prisma.oAuthState.findUnique({
  where: { state: callbackState }
});
if (!oauthState || oauthState.consumed || oauthState.expiresAt < new Date()) {
  throw new Error('Invalid OAuth state');
}
await prisma.oAuthState.update({
  where: { id: oauthState.id },
  data: { consumed: true }
});
```

### 2. Sync Calendar Events

```typescript
// Incremental sync using sync token
const connection = await prisma.calendarConnection.findUnique({
  where: { id: connectionId }
});

const events = await fetchFromProvider(
  connection.accessToken,
  connection.syncToken // null for first sync
);

for (const event of events.items) {
  await prisma.calendarEvent.upsert({
    where: {
      calendarConnectionId_providerEventId: {
        calendarConnectionId: connection.id,
        providerEventId: event.id
      }
    },
    create: { /* event data */ },
    update: { /* event data */ }
  });
}

await prisma.calendarConnection.update({
  where: { id: connection.id },
  data: {
    syncToken: events.nextSyncToken,
    lastSyncedAt: new Date()
  }
});
```

### 3. Query Events for Date Range

```typescript
const events = await prisma.calendarEvent.findMany({
  where: {
    calendarConnection: {
      userId: userId,
      isConnected: true
    },
    startTime: { gte: startDate },
    endTime: { lte: endDate },
    deletedAt: null
  },
  include: {
    calendarConnection: {
      select: {
        calendarName: true,
        calendarColor: true,
        provider: true
      }
    }
  },
  orderBy: { startTime: 'asc' }
});
```

## Background Jobs

### Required Cron Jobs

```javascript
// Every 15 minutes: Cleanup expired OAuth states
cron.schedule('*/15 * * * *', async () => {
  await prisma.oAuthState.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { consumed: true }
      ]
    }
  });
});

// Every hour: Refresh expiring tokens
cron.schedule('0 * * * *', async () => {
  const expiring = await prisma.calendarConnection.findMany({
    where: {
      tokenExpiresAt: { lt: new Date(Date.now() + 60 * 60 * 1000) },
      isConnected: true
    }
  });
  for (const conn of expiring) {
    await refreshOAuthToken(conn);
  }
});

// Every 5 minutes: Sync calendar events
cron.schedule('*/5 * * * *', async () => {
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
});
```

## Security Checklist

- [ ] OAuth tokens encrypted with AES-256-GCM
- [ ] Encryption key stored in environment variable
- [ ] State tokens use crypto.randomBytes (not Math.random)
- [ ] OAuth states expire in 15 minutes
- [ ] Passwords hashed with bcrypt (10-12 rounds)
- [ ] Session tokens hashed before storage
- [ ] Rate limiting on OAuth endpoints
- [ ] SQL injection prevented by Prisma parameterization
- [ ] Foreign keys enforce referential integrity
- [ ] Soft deletes preserve audit trail

## Performance Benchmarks

Expected query latency with proper indexes:

| Query | Expected Time | Index Used |
|-------|--------------|------------|
| User login | < 10ms | users_email_key |
| Fetch calendars | < 20ms | calendar_connections_user_id_idx |
| Week view events | < 10ms | calendar_events_connection_date_range_idx |
| Validate OAuth state | < 1ms | oauth_states_state_key |
| Sync pending events | < 5ms | calendar_events_connection_sync_status_idx |

## Database Maintenance

### Daily (00:00 UTC)
- Hard delete soft-deleted records (> 30 days)
- Vacuum and analyze tables
- Update table statistics

### Hourly
- Refresh expiring OAuth tokens
- Cleanup expired OAuth states
- Archive old audit logs (> 90 days)

### Every 5 Minutes
- Sync calendar events (incremental)

## Development Workflow

```bash
# Create new migration after schema changes
npx prisma migrate dev --name descriptive_name

# Generate Prisma Client (after pull)
npm run prisma:generate

# View database in GUI
npm run prisma:studio

# Reset database (DEV ONLY - destroys data)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

## Production Deployment

```bash
# 1. Backup database
pg_dump -h hostname -U username -d dbname -F c > backup.dump

# 2. Apply migration
npm run prisma:migrate:prod

# 3. Verify migration
npx prisma migrate status

# 4. Monitor logs
tail -f /var/log/app.log | grep -i "prisma\|migration"
```

## Railway Deployment

### Environment Variables

Set these in Railway dashboard:

```bash
# Database (auto-provisioned by Railway PostgreSQL plugin)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Application
NODE_ENV=production
JWT_SECRET=<generate-secure-random-string>
ENCRYPTION_KEY=<generate-32-character-key>

# OAuth credentials
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
MICROSOFT_CLIENT_ID=<your-microsoft-client-id>
MICROSOFT_CLIENT_SECRET=<your-microsoft-client-secret>
```

### Build Configuration

**railway.json** (in backend root):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npx prisma generate && npx prisma migrate deploy && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Troubleshooting

### Migration fails with "enum value already exists"
The migration script uses `ADD VALUE IF NOT EXISTS` which requires PostgreSQL 9.5+. Upgrade or manually check enum values.

### "Database is locked" error
Another process is holding a lock. Check `pg_locks` and terminate if necessary (development only).

### Slow queries after migration
Run `ANALYZE` on new tables to update statistics:
```sql
ANALYZE calendar_events;
ANALYZE oauth_states;
```

### Missing indexes
Verify indexes exist:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'calendar_events';
```

## Support & Resources

- **Prisma Docs**: https://www.prisma.io/docs/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Schema Design**: See [SCHEMA_DESIGN.md](./SCHEMA_DESIGN.md)
- **Quick Reference**: See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Migration Guide**: See [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)

## Contributing

When making schema changes:

1. Update `schema.prisma`
2. Create migration: `npx prisma migrate dev --name change_description`
3. Update documentation (SCHEMA_DESIGN.md, QUICK_REFERENCE.md)
4. Add tests for new queries
5. Update this README if adding new tables

## Change Log

### 2025-11-22
- Added calendar_events table for event syncing
- Added oauth_states table for CSRF protection
- Added Apple Calendar provider support
- Added 4 new enums (EventStatus, SyncStatus, RecurrenceFrequency)
- Enhanced calendar_connections with syncToken field
- Added 14+ indexes for performance
- Created comprehensive documentation

### 2024-11-22
- Initial schema creation
- Users, sessions, calendar_connections, audit_logs
- Google and Microsoft provider support
