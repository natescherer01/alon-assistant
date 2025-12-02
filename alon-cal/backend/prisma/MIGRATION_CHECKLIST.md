# Database Migration Checklist

## Pre-Migration Steps

### 1. Backup Database

```bash
# PostgreSQL backup
pg_dump -h hostname -U username -d database_name -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump

# Alternative: SQL format
pg_dump -h hostname -U username -d database_name > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Review Migration File

- [ ] Review `/Users/natescherer/alon-cal/backend/prisma/migrations/20251122_add_calendar_events_and_oauth_state/migration.sql`
- [ ] Verify all SQL statements are correct
- [ ] Check for proper indexes
- [ ] Verify foreign key constraints
- [ ] Ensure enum values are correct

### 3. Test in Development

```bash
# Navigate to backend directory
cd /Users/natescherer/alon-cal/backend

# Generate Prisma Client
npm run prisma:generate

# Apply migration
npm run prisma:migrate
```

### 4. Run Tests

```bash
# Run all tests
npm test

# Run specific database tests
npm test -- --grep "database|schema|migration"
```

## Migration Steps

### Development Environment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm install

# 3. Generate Prisma Client
npm run prisma:generate

# 4. Run migration
npm run prisma:migrate

# 5. Verify schema
npx prisma migrate status

# 6. Test with Prisma Studio
npm run prisma:studio
```

### Production Environment

```bash
# 1. Set environment variables
export DATABASE_URL="postgresql://user:password@host:port/database"
export ENCRYPTION_KEY="your-encryption-key-hex"

# 2. Generate Prisma Client
npm run prisma:generate

# 3. Apply migration (non-interactive)
npm run prisma:migrate:prod

# 4. Verify migration
npx prisma migrate status
```

## Post-Migration Verification

### 1. Verify Tables

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('oauth_states', 'calendar_events');

-- Expected: 2 rows
```

### 2. Verify Enums

```sql
-- Check enum values
SELECT e.enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'calendar_provider';

-- Expected: GOOGLE, MICROSOFT, APPLE

SELECT e.enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname IN ('event_status', 'sync_status', 'recurrence_frequency');

-- Expected: Multiple rows for each enum
```

### 3. Verify Indexes

```sql
-- Check indexes on oauth_states
SELECT indexname
FROM pg_indexes
WHERE tablename = 'oauth_states';

-- Expected indexes:
-- oauth_states_pkey
-- oauth_states_state_key
-- oauth_states_state_idx
-- oauth_states_expires_at_idx
-- oauth_states_user_id_provider_idx

-- Check indexes on calendar_events
SELECT indexname
FROM pg_indexes
WHERE tablename = 'calendar_events';

-- Expected: 14+ indexes
```

### 4. Verify Foreign Keys

```sql
-- Check foreign key constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('oauth_states', 'calendar_events');

-- Expected: 3 foreign keys with CASCADE delete rules
```

### 5. Verify Column on calendar_connections

```sql
-- Check if sync_token column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'calendar_connections'
  AND column_name = 'sync_token';

-- Expected: 1 row (sync_token, text, YES)
```

### 6. Test CRUD Operations

```typescript
// Test OAuth State CRUD
const testOAuthState = async () => {
  // Create
  const state = await prisma.oAuthState.create({
    data: {
      userId: 'test-user-id',
      provider: 'GOOGLE',
      state: 'test-state-token',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });
  console.log('Created OAuth state:', state.id);

  // Read
  const found = await prisma.oAuthState.findUnique({
    where: { state: 'test-state-token' }
  });
  console.log('Found OAuth state:', found?.id);

  // Update
  const updated = await prisma.oAuthState.update({
    where: { id: state.id },
    data: { consumed: true }
  });
  console.log('Updated consumed:', updated.consumed);

  // Delete
  await prisma.oAuthState.delete({
    where: { id: state.id }
  });
  console.log('Deleted OAuth state');
};

// Test Calendar Event CRUD
const testCalendarEvent = async () => {
  // Create
  const event = await prisma.calendarEvent.create({
    data: {
      calendarConnectionId: 'test-connection-id',
      providerEventId: 'test-event-123',
      title: 'Test Event',
      startTime: new Date('2025-11-22T10:00:00Z'),
      endTime: new Date('2025-11-22T11:00:00Z'),
      timezone: 'UTC',
      attendees: [
        { email: 'test@example.com', responseStatus: 'accepted' }
      ],
      reminders: [
        { method: 'popup', minutes: 15 }
      ]
    }
  });
  console.log('Created event:', event.id);

  // Read
  const events = await prisma.calendarEvent.findMany({
    where: {
      calendarConnectionId: 'test-connection-id',
      startTime: { gte: new Date('2025-11-22T00:00:00Z') }
    }
  });
  console.log('Found events:', events.length);

  // Update
  const updated = await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { syncStatus: 'SYNCED' }
  });
  console.log('Updated sync status:', updated.syncStatus);

  // Soft Delete
  const softDeleted = await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { deletedAt: new Date() }
  });
  console.log('Soft deleted:', softDeleted.deletedAt);

  // Hard Delete
  await prisma.calendarEvent.delete({
    where: { id: event.id }
  });
  console.log('Hard deleted event');
};
```

### 7. Performance Testing

```sql
-- Explain query for date range
EXPLAIN ANALYZE
SELECT ce.*
FROM calendar_events ce
JOIN calendar_connections cc ON ce.calendar_connection_id = cc.id
WHERE cc.user_id = 'test-user-id'
  AND ce.start_time >= '2025-11-22 00:00:00+00'
  AND ce.end_time <= '2025-11-29 23:59:59+00'
  AND ce.deleted_at IS NULL;

-- Should use: Index Scan on calendar_events_connection_date_range_idx
```

## Rollback Procedure (If Needed)

### Create Rollback Script

```sql
-- Save as rollback_migration.sql

BEGIN;

-- Drop foreign keys first
ALTER TABLE calendar_events
DROP CONSTRAINT IF EXISTS calendar_events_calendar_connection_id_fkey CASCADE;

ALTER TABLE calendar_events
DROP CONSTRAINT IF EXISTS calendar_events_parent_event_id_fkey CASCADE;

ALTER TABLE oauth_states
DROP CONSTRAINT IF EXISTS oauth_states_user_id_fkey CASCADE;

-- Drop tables
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS oauth_states CASCADE;

-- Remove column from calendar_connections
ALTER TABLE calendar_connections
DROP COLUMN IF EXISTS sync_token;

-- Drop enums (be careful - check dependencies first)
DROP TYPE IF EXISTS event_status CASCADE;
DROP TYPE IF EXISTS sync_status CASCADE;
DROP TYPE IF EXISTS recurrence_frequency CASCADE;

-- Note: Cannot easily remove APPLE from calendar_provider enum
-- Would require recreating the enum and all dependent tables
-- Only do this if absolutely necessary in development

COMMIT;
```

### Execute Rollback

```bash
# Apply rollback script
psql -h hostname -U username -d database_name -f rollback_migration.sql

# Restore from backup
pg_restore -h hostname -U username -d database_name -v backup_file.dump
```

## Common Issues & Solutions

### Issue 1: Enum Value Already Exists

**Error**: `duplicate key value violates unique constraint "pg_enum_typid_label_index"`

**Solution**:
```sql
-- Check if value exists
SELECT EXISTS (
  SELECT 1
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'calendar_provider' AND e.enumlabel = 'APPLE'
);

-- If true, skip adding APPLE
```

### Issue 2: Column Already Exists

**Error**: `column "sync_token" of relation "calendar_connections" already exists`

**Solution**:
```sql
-- Use IF NOT EXISTS (already in migration)
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS sync_token TEXT;
```

### Issue 3: Migration Lock

**Error**: `database is locked`

**Solution**:
```bash
# Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

# Kill blocking processes (development only)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'your_database'
  AND pid <> pg_backend_pid();
```

### Issue 4: Out of Sync Migration

**Error**: `Migration history is inconsistent`

**Solution**:
```bash
# Mark migration as applied (if already manually applied)
npx prisma migrate resolve --applied migration_name

# Or reset database (development only)
npx prisma migrate reset
```

## Environment-Specific Notes

### Development

- Use `prisma migrate dev` for interactive migrations
- Prisma Studio is available for visual inspection
- Can use `prisma migrate reset` safely

### Staging

- Use `prisma migrate deploy` for non-interactive migrations
- Test OAuth flows with test credentials
- Verify event syncing with test calendars

### Production

- Use `prisma migrate deploy` only
- Schedule migration during low-traffic window
- Monitor application logs for errors
- Have rollback plan ready
- Keep backup for 30 days minimum

## Monitoring After Migration

### 1. Application Logs

```bash
# Monitor for migration-related errors
tail -f /var/log/app.log | grep -i "prisma\|migration\|calendar_event\|oauth_state"
```

### 2. Database Metrics

```sql
-- Monitor table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('oauth_states', 'calendar_events')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Monitor index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('oauth_states', 'calendar_events')
ORDER BY idx_scan DESC;
```

### 3. Query Performance

```sql
-- Enable query logging (postgresql.conf)
-- log_min_duration_statement = 1000  # Log queries > 1 second

-- Monitor slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%calendar_events%' OR query LIKE '%oauth_states%'
ORDER BY mean_time DESC
LIMIT 10;
```

## Success Criteria

- [ ] All tables created successfully
- [ ] All indexes created successfully
- [ ] All foreign keys created successfully
- [ ] All enums created successfully
- [ ] CRUD operations work correctly
- [ ] Query performance is acceptable (< 100ms for common queries)
- [ ] No errors in application logs
- [ ] OAuth flow works end-to-end
- [ ] Event syncing works for all providers
- [ ] Backup created and verified
- [ ] Rollback procedure documented and tested

## Sign-off

- **Migration Date**: _________________
- **Applied By**: _________________
- **Environment**: Development / Staging / Production
- **Backup Location**: _________________
- **Issues Encountered**: _________________
- **Resolution**: _________________
- **Verified By**: _________________

## Next Steps After Migration

1. **Update API Documentation**
   - Document new endpoints for event syncing
   - Update OAuth flow documentation
   - Add examples for JSONB field queries

2. **Implement Background Jobs**
   - OAuth state cleanup (every 15 minutes)
   - Token refresh (every hour)
   - Event sync (every 5 minutes)

3. **Add Monitoring**
   - Set up alerts for sync failures
   - Monitor database performance
   - Track API error rates

4. **Security Audit**
   - Verify token encryption
   - Test CSRF protection
   - Review access control

5. **Performance Optimization**
   - Monitor query performance
   - Optimize slow queries
   - Consider caching strategies
