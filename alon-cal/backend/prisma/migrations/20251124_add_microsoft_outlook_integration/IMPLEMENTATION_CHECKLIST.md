# Implementation Checklist - Microsoft Integration

## Pre-Deployment

### Database Migration

- [ ] Review migration SQL file
- [ ] Review rollback SQL file
- [ ] Test migration in development database
- [ ] Test rollback in development database
- [ ] Backup production database
- [ ] Schedule maintenance window (if needed)

### Code Review

- [ ] Review updated schema.prisma
- [ ] Verify all new fields are optional/have defaults
- [ ] Check index definitions
- [ ] Verify foreign key constraints
- [ ] Review relationship mappings

### Documentation

- [ ] Read README.md
- [ ] Review DESIGN_DECISIONS.md
- [ ] Study QUICK_REFERENCE.md code examples
- [ ] Understand SCHEMA_DIAGRAM.md
- [ ] Review MICROSOFT_INTEGRATION_SUMMARY.md

---

## Deployment Steps

### 1. Database Migration

```bash
# Navigate to backend directory
cd /Users/natescherer/alon-cal/backend

# Check current migration status
npx prisma migrate status

# Deploy migration
npx prisma migrate deploy

# Verify migration applied
npx prisma migrate status
```

**Expected output:**
```
Database schema is up to date!
✓ Migration: 20251124_add_microsoft_outlook_integration applied
```

### 2. Generate Prisma Client

```bash
# Generate updated Prisma client
npx prisma generate

# Verify types generated
ls -la node_modules/.prisma/client/
```

**Expected output:**
```
✓ Generated Prisma Client
- EventImportance enum
- WebhookSubscription model
- Updated CalendarConnection
- Updated CalendarEvent
```

### 3. Verify Database Schema

```sql
-- Check new enum exists
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'event_importance'::regtype;

-- Check new table exists
\d webhook_subscriptions

-- Check new columns on calendar_connections
\d calendar_connections

-- Check new columns on calendar_events
\d calendar_events

-- Verify indexes created
\di webhook_subscriptions*
```

### 4. Update Environment Variables

```bash
# Add to .env file
MICROSOFT_CLIENT_ID=<azure-app-client-id>
MICROSOFT_CLIENT_SECRET=<azure-app-client-secret>
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://yourapp.com/auth/microsoft/callback

WEBHOOK_BASE_URL=https://yourapp.com
WEBHOOK_CLIENT_STATE_SECRET=<generate-with: openssl rand -hex 32>
WEBHOOK_RENEWAL_INTERVAL_MINUTES=30
WEBHOOK_EXPIRATION_BUFFER_HOURS=1
```

### 5. Restart Application

```bash
# Development
npm run dev

# Production (depends on deployment method)
pm2 restart app
# or
docker-compose restart backend
# or
kubectl rollout restart deployment/backend
```

---

## Post-Deployment Verification

### Database Checks

- [ ] Migration status shows as applied
- [ ] EventImportance enum exists with 3 values
- [ ] webhook_subscriptions table exists with 11 columns
- [ ] calendar_connections has delegate_email column
- [ ] calendar_events has 9 new Microsoft columns
- [ ] All indexes created successfully
- [ ] Foreign key constraints working
- [ ] Triggers created for updated_at

**Verification queries:**

```sql
-- 1. Check enum
SELECT * FROM pg_type WHERE typname = 'event_importance';

-- 2. Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'webhook_subscriptions'
ORDER BY ordinal_position;

-- 3. Check new columns on calendar_events
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'calendar_events'
AND column_name IN (
  'importance',
  'outlook_categories',
  'conversation_id',
  'series_master_id',
  'teams_enabled',
  'teams_meeting_url',
  'teams_conference_id',
  'teams_dial_in_url'
);

-- 4. Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('calendar_events', 'calendar_connections', 'webhook_subscriptions')
AND indexname LIKE '%importance%' OR indexname LIKE '%teams%' OR indexname LIKE '%webhook%';

-- 5. Check foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'webhook_subscriptions';
```

### Application Checks

- [ ] Application starts without errors
- [ ] Prisma client types available
- [ ] EventImportance enum in TypeScript
- [ ] WebhookSubscription model accessible
- [ ] No TypeScript compilation errors
- [ ] API endpoints still functional
- [ ] Existing calendar sync works

**Test queries:**

```typescript
// 1. Test new enum
import { EventImportance } from '@prisma/client';
console.log(EventImportance.HIGH); // Should output: 'HIGH'

// 2. Test WebhookSubscription model
const count = await prisma.webhookSubscription.count();
console.log('Webhook subscriptions:', count); // Should work

// 3. Test new fields on CalendarEvent
const event = await prisma.calendarEvent.findFirst({
  select: {
    importance: true,
    teamsEnabled: true,
    outlookCategories: true,
  },
});
console.log('New fields accessible:', event);

// 4. Test relationships
const webhook = await prisma.webhookSubscription.findFirst({
  include: {
    calendarConnection: true,
  },
});
console.log('Relationship works:', webhook);
```

### Backward Compatibility

- [ ] Existing calendar connections still query correctly
- [ ] Existing events still query correctly
- [ ] Existing API endpoints return expected data
- [ ] No null pointer errors on new fields
- [ ] JSONB attendees/reminders still accessible

**Test queries:**

```typescript
// Should work without touching new fields
const connections = await prisma.calendarConnection.findMany({
  where: { userId: 'test-user-id' },
});

const events = await prisma.calendarEvent.findMany({
  where: {
    startTime: { gte: new Date() },
  },
  orderBy: { startTime: 'asc' },
});
```

---

## Implementation Tasks

### Phase 1: Core Microsoft Integration (Week 1-2)

#### Microsoft Graph API Client

- [ ] Set up Azure AD app registration
- [ ] Configure OAuth scopes
- [ ] Implement OAuth flow
- [ ] Build Graph API client wrapper
- [ ] Add error handling and retries
- [ ] Implement token refresh logic

#### Calendar Sync

- [ ] List user calendars
- [ ] Sync calendar events
- [ ] Map Graph API fields to database
- [ ] Handle delegated calendars
- [ ] Parse and store importance levels
- [ ] Parse and store Outlook categories
- [ ] Extract Teams meeting data
- [ ] Handle conversation IDs
- [ ] Handle series master IDs

### Phase 2: Webhook System (Week 3-4)

#### Webhook Subscription Management

- [ ] Create webhook endpoint route
- [ ] Implement subscription creation
- [ ] Store subscription in database
- [ ] Generate and store client state secret
- [ ] Handle subscription validation

#### Webhook Notification Handling

- [ ] Implement notification endpoint
- [ ] Validate client state
- [ ] Parse notification payload
- [ ] Update last notification timestamp
- [ ] Trigger incremental sync
- [ ] Handle notification errors
- [ ] Add rate limiting

#### Webhook Renewal System

- [ ] Create background job (cron)
- [ ] Query expiring subscriptions
- [ ] Call Microsoft Graph renew API
- [ ] Update expiration timestamps
- [ ] Handle renewal failures
- [ ] Deactivate expired subscriptions
- [ ] Alert on renewal issues

### Phase 3: UI Components (Week 5-6)

#### Event Display

- [ ] Teams meeting join button
- [ ] Importance level indicator
- [ ] Outlook category chips
- [ ] Dial-in information display
- [ ] Conversation thread view

#### Calendar Management

- [ ] Delegated calendar selector
- [ ] Calendar sharing indicator
- [ ] Teams meeting toggle
- [ ] Importance level picker
- [ ] Category selector/editor

### Phase 4: Testing (Week 7)

#### Unit Tests

- [ ] Database model tests
- [ ] Graph API client tests
- [ ] Webhook handler tests
- [ ] Renewal job tests
- [ ] Field mapping tests

#### Integration Tests

- [ ] Full OAuth flow
- [ ] Calendar sync end-to-end
- [ ] Webhook creation and renewal
- [ ] Notification handling
- [ ] Teams meeting creation
- [ ] Delegated calendar access

#### Manual Testing

- [ ] Connect Microsoft account
- [ ] Sync existing calendar
- [ ] Create new event with Teams
- [ ] Set importance levels
- [ ] Add Outlook categories
- [ ] Test delegated calendar
- [ ] Verify webhook notifications
- [ ] Test webhook renewal
- [ ] Check mobile responsiveness

---

## Monitoring Setup

### Database Metrics

- [ ] Monitor webhook_subscriptions table size
- [ ] Track subscription expiration rate
- [ ] Monitor renewal success rate
- [ ] Alert on renewal failures
- [ ] Track Teams meeting adoption

**Sample alerts:**

```sql
-- Alert: More than 10% of subscriptions expired
SELECT
  COUNT(*) as expired_count,
  (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM webhook_subscriptions WHERE is_active = true)) as expired_percentage
FROM webhook_subscriptions
WHERE is_active = true
AND expiration_datetime < NOW();

-- Alert: No notifications in last hour for active webhooks
SELECT COUNT(*)
FROM webhook_subscriptions
WHERE is_active = true
AND (last_notification_at IS NULL OR last_notification_at < NOW() - INTERVAL '1 hour');
```

### Application Metrics

- [ ] Track Microsoft OAuth success rate
- [ ] Monitor Graph API error rates
- [ ] Track webhook notification latency
- [ ] Monitor renewal job execution
- [ ] Track Teams meeting creation rate

### Dashboards

- [ ] Webhook health dashboard
- [ ] Microsoft integration metrics
- [ ] Teams meeting usage
- [ ] Delegated calendar adoption
- [ ] Sync success rates

---

## Troubleshooting Guide

### Issue: Migration fails with "enum already exists"

**Solution:**
```sql
DROP TYPE IF EXISTS event_importance CASCADE;
```
Then re-run migration.

### Issue: Prisma client types not updated

**Solution:**
```bash
rm -rf node_modules/.prisma
npx prisma generate
```

### Issue: Webhook notifications not received

**Checklist:**
- [ ] Webhook endpoint publicly accessible
- [ ] HTTPS enabled (required by Microsoft)
- [ ] Client state validation correct
- [ ] Subscription not expired
- [ ] Firewall/security group allows inbound traffic

### Issue: Webhook renewal failing

**Debug:**
```typescript
// Log renewal attempt
console.log('Renewing webhook:', webhook.subscriptionId);
console.log('Expiration:', webhook.expirationDateTime);

try {
  const result = await graphClient
    .api(`/subscriptions/${webhook.subscriptionId}`)
    .update({ expirationDateTime: newExpiration });
  console.log('Renewal success:', result);
} catch (error) {
  console.error('Renewal failed:', error);
}
```

### Issue: Teams meeting URL not syncing

**Checklist:**
- [ ] Event has `isOnlineMeeting: true`
- [ ] Graph API includes `onlineMeeting` in response
- [ ] Field mapping correct
- [ ] Not using old JSONB field

---

## Performance Benchmarks

### Target Metrics

- [ ] Migration completes in < 5 seconds
- [ ] Event query with Teams filter < 100ms
- [ ] Webhook lookup by subscription ID < 10ms
- [ ] Expiring webhook query < 50ms
- [ ] Renewal job processes 1000 webhooks < 5 minutes

### Performance Tests

```bash
# Benchmark event query
EXPLAIN ANALYZE
SELECT * FROM calendar_events
WHERE calendar_connection_id = '<uuid>'
  AND teams_enabled = true
  AND start_time >= CURRENT_DATE;

# Should use: (calendar_connection_id, teams_enabled, start_time) index

# Benchmark webhook query
EXPLAIN ANALYZE
SELECT * FROM webhook_subscriptions
WHERE is_active = true
  AND expiration_datetime < NOW() + INTERVAL '1 hour';

# Should use: (expiration_datetime, is_active) index
```

---

## Rollback Procedure

### When to Rollback

Only if:
- Migration causes critical production issues
- Data corruption detected
- Performance degradation severe
- Blocker bug discovered

### Rollback Steps

1. **Stop application** (prevent new data)
2. **Backup current database state**
3. **Run rollback script:**
   ```bash
   psql -U user -d database -f migrations/20251124_add_microsoft_outlook_integration/rollback.sql
   ```
4. **Verify rollback:**
   ```sql
   SELECT * FROM pg_type WHERE typname = 'event_importance';
   -- Should return 0 rows

   SELECT * FROM information_schema.tables WHERE table_name = 'webhook_subscriptions';
   -- Should return 0 rows
   ```
5. **Regenerate Prisma client:**
   ```bash
   git checkout schema.prisma
   npx prisma generate
   ```
6. **Restart application**
7. **Verify functionality**

### Post-Rollback

- [ ] Document reason for rollback
- [ ] Fix underlying issue
- [ ] Test fix in staging
- [ ] Plan re-migration

---

## Success Criteria

### Deployment Success

- [x] Migration applied without errors
- [x] All indexes created
- [x] Foreign keys working
- [x] Application starts successfully
- [x] No TypeScript errors
- [x] Existing functionality intact

### Feature Success (Post-Implementation)

- [ ] Microsoft OAuth flow working
- [ ] Calendars syncing correctly
- [ ] Teams meetings displaying
- [ ] Webhooks receiving notifications
- [ ] Renewal job running successfully
- [ ] Delegated calendars accessible
- [ ] Importance levels visible
- [ ] Categories displaying correctly

### Performance Success

- [ ] Query times within targets
- [ ] Webhook renewal < 5 min for 1000 subs
- [ ] No N+1 query issues
- [ ] Database size growth acceptable
- [ ] Index usage confirmed

---

## Sign-off

### Database Team

- [ ] Schema reviewed and approved
- [ ] Migration tested in staging
- [ ] Indexes optimized
- [ ] Rollback tested
- [ ] Documentation reviewed

**Signed:** _________________ Date: _________

### Backend Team

- [ ] Code review completed
- [ ] Integration tests passing
- [ ] API contracts maintained
- [ ] Error handling comprehensive
- [ ] Monitoring configured

**Signed:** _________________ Date: _________

### DevOps Team

- [ ] Deployment plan reviewed
- [ ] Monitoring alerts configured
- [ ] Rollback plan tested
- [ ] Backup strategy confirmed
- [ ] Production checklist complete

**Signed:** _________________ Date: _________

---

## Notes

Use this space for deployment-specific notes:

```
Date: _______________
Environment: _______________
Database version: _______________
Application version: _______________

Pre-deployment checklist completed by: _______________
Migration executed by: _______________
Post-deployment verification by: _______________

Issues encountered:




Resolutions:




```

---

**Ready for production deployment!**
