# Migration: Microsoft Outlook/Exchange Integration

**Migration ID:** 20251124_add_microsoft_outlook_integration
**Date:** 2025-11-24
**Type:** Schema Enhancement (Non-breaking)

## Summary

This migration adds comprehensive Microsoft Outlook/Exchange calendar integration support including:

- Shared/delegated calendar access tracking
- Microsoft Teams meeting integration
- Outlook categories and importance levels
- Event threading via conversation IDs
- Recurring event series tracking
- Webhook subscriptions for real-time sync

## Files

- `migration.sql` - Forward migration script
- `rollback.sql` - Rollback script (use with caution)
- `DESIGN_DECISIONS.md` - Detailed design rationale and architecture decisions

## Changes Overview

### 1. New Enum: EventImportance

```sql
CREATE TYPE "event_importance" AS ENUM ('LOW', 'NORMAL', 'HIGH');
```

Used for Outlook event priority levels.

### 2. CalendarConnection Table

**Added columns:**
- `delegate_email` VARCHAR(255) - Email of shared/delegated calendar owner

**New indexes:**
- `delegate_email` - For querying delegated calendars

### 3. CalendarEvent Table

**Added columns:**
- `importance` event_importance - Event priority (LOW/NORMAL/HIGH)
- `outlook_categories` TEXT - Comma-separated category names
- `conversation_id` VARCHAR(255) - Thread related events
- `series_master_id` VARCHAR(255) - Recurring event series master ID
- `teams_enabled` BOOLEAN - Is this a Teams meeting?
- `teams_meeting_url` TEXT - Teams join URL
- `teams_conference_id` VARCHAR(255) - Teams conference ID
- `teams_dial_in_url` TEXT - Dial-in numbers URL

**New indexes:**
- `importance` - Filter by priority
- `conversation_id` - Event threading
- `series_master_id` - Find recurring instances
- `teams_enabled` - Filter Teams meetings
- Composite: `(calendar_connection_id, teams_enabled, start_time)` - Teams meetings by time

### 4. New Table: WebhookSubscription

Tracks Microsoft Graph and Google Calendar webhook subscriptions for real-time synchronization.

**Columns:**
- `id` UUID PRIMARY KEY
- `calendar_connection_id` UUID FK (CASCADE)
- `provider` CalendarProvider (MICROSOFT/GOOGLE)
- `subscription_id` VARCHAR(255) - Provider's subscription ID
- `resource_path` VARCHAR(500) - Resource being monitored
- `expiration_datetime` TIMESTAMPTZ - When subscription expires
- `client_state` VARCHAR(255) - Secret for validation
- `notification_url` TEXT - Webhook endpoint
- `last_notification_at` TIMESTAMPTZ - Last notification received
- `is_active` BOOLEAN - Is subscription active?
- `created_at`, `updated_at` - Timestamps

**Indexes:**
- `calendar_connection_id` - Foreign key
- `subscription_id` - Lookup notifications
- `expiration_datetime` - Find expiring subscriptions
- `is_active` - Filter active subscriptions
- `provider` - Group by provider
- Composite: `(subscription_id, provider)` UNIQUE - Prevent duplicates
- Composite: `(expiration_datetime, is_active)` - Renewal queries
- Composite: `(provider, is_active)` - Provider-specific queries

## Running the Migration

### Using Prisma

```bash
# Navigate to backend directory
cd /Users/natescherer/alon-cal/backend

# Run migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Manual SQL Execution

```bash
# Connect to PostgreSQL
psql -U your_user -d your_database

# Run migration
\i /Users/natescherer/alon-cal/backend/prisma/migrations/20251124_add_microsoft_outlook_integration/migration.sql
```

## Rollback

**WARNING:** Rollback will permanently delete all webhook subscriptions and Microsoft-specific event data.

```bash
# Connect to PostgreSQL
psql -U your_user -d your_database

# Run rollback
\i /Users/natescherer/alon-cal/backend/prisma/migrations/20251124_add_microsoft_outlook_integration/rollback.sql
```

## Backward Compatibility

This migration is **100% backward compatible**:

- All new fields are nullable (except `teams_enabled` with default `false`)
- Existing queries continue to work unchanged
- No data migration required
- Application can check for NULL values and handle gracefully

## Data Impact

- **No data loss** during migration
- **No data modification** to existing records
- New columns added with NULL or default values

## Performance Impact

**Minimal impact:**

- Indexes created efficiently with IF NOT EXISTS checks
- Partial indexes used where appropriate (e.g., teams_enabled)
- No table locks during migration (ADD COLUMN IF NOT EXISTS)
- Estimated migration time: < 5 seconds

## Application Changes Required

### 1. Prisma Client Regeneration

After running migration, regenerate Prisma client:

```bash
npx prisma generate
```

### 2. TypeScript Type Updates

New types available:
- `EventImportance` enum
- `WebhookSubscription` model
- Updated `CalendarConnection` with `delegateEmail`
- Updated `CalendarEvent` with Microsoft fields

### 3. Code Examples

**Creating a Teams meeting event:**

```typescript
await prisma.calendarEvent.create({
  data: {
    calendarConnectionId: connectionId,
    providerEventId: microsoftEventId,
    title: "Team Standup",
    startTime: new Date("2024-01-15T10:00:00Z"),
    endTime: new Date("2024-01-15T10:30:00Z"),
    importance: "NORMAL",
    teamsEnabled: true,
    teamsMeetingUrl: "https://teams.microsoft.com/l/meetup-join/...",
    teamsConferenceId: "123456789",
  },
});
```

**Creating a webhook subscription:**

```typescript
await prisma.webhookSubscription.create({
  data: {
    calendarConnectionId: connectionId,
    provider: "MICROSOFT",
    subscriptionId: microsoftSubscriptionId,
    resourcePath: `/me/calendars/${calendarId}/events`,
    expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    clientState: crypto.randomUUID(),
    notificationUrl: "https://app.example.com/webhooks/microsoft",
    isActive: true,
  },
});
```

**Querying expiring subscriptions:**

```typescript
const expiringSubscriptions = await prisma.webhookSubscription.findMany({
  where: {
    isActive: true,
    expirationDateTime: {
      lt: new Date(Date.now() + 60 * 60 * 1000), // Within 1 hour
    },
  },
  include: {
    calendarConnection: true,
  },
});
```

**Querying Teams meetings:**

```typescript
const teamsMeetings = await prisma.calendarEvent.findMany({
  where: {
    calendarConnectionId: connectionId,
    teamsEnabled: true,
    startTime: {
      gte: new Date(),
    },
  },
  orderBy: {
    startTime: "asc",
  },
});
```

## Testing Checklist

- [ ] Migration runs successfully
- [ ] Rollback runs successfully
- [ ] Existing calendar connections still work
- [ ] Existing events query correctly
- [ ] New fields accept NULL values
- [ ] Webhook subscriptions can be created
- [ ] Webhook expiration queries work
- [ ] Teams meeting queries work
- [ ] Delegated calendar queries work
- [ ] Prisma client regenerates without errors
- [ ] TypeScript types are correct

## Common Queries

### Find all Teams meetings today

```sql
SELECT * FROM calendar_events
WHERE teams_enabled = true
  AND start_time >= CURRENT_DATE
  AND start_time < CURRENT_DATE + INTERVAL '1 day'
ORDER BY start_time;
```

### Find subscriptions expiring soon

```sql
SELECT
  ws.*,
  cc.calendar_name,
  cc.provider
FROM webhook_subscriptions ws
JOIN calendar_connections cc ON cc.id = ws.calendar_connection_id
WHERE ws.is_active = true
  AND ws.expiration_datetime < NOW() + INTERVAL '1 hour'
ORDER BY ws.expiration_datetime;
```

### Find high-importance events

```sql
SELECT * FROM calendar_events
WHERE importance = 'HIGH'
  AND start_time >= CURRENT_DATE
ORDER BY start_time;
```

### Find events in a conversation thread

```sql
SELECT * FROM calendar_events
WHERE conversation_id = 'AAQkAGI1M...'
ORDER BY created_at;
```

### Find delegated calendars for a user

```sql
SELECT * FROM calendar_connections
WHERE user_id = '<user_uuid>'
  AND delegate_email IS NOT NULL;
```

## Troubleshooting

### Migration fails with "enum already exists"

If re-running migration:
```sql
DROP TYPE IF EXISTS event_importance CASCADE;
```

Then re-run migration.

### Prisma client generation fails

Clear cache and regenerate:
```bash
rm -rf node_modules/.prisma
npx prisma generate
```

### Performance issues after migration

Analyze tables:
```sql
ANALYZE calendar_events;
ANALYZE calendar_connections;
ANALYZE webhook_subscriptions;
```

### Indexes not being used

Check query plan:
```sql
EXPLAIN ANALYZE
SELECT * FROM calendar_events
WHERE teams_enabled = true;
```

## Monitoring

### Webhook Health Check

Monitor subscription expiration:

```sql
SELECT
  provider,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as active,
  COUNT(*) FILTER (WHERE expiration_datetime < NOW() + INTERVAL '1 hour') as expiring_soon,
  COUNT(*) FILTER (WHERE expiration_datetime < NOW()) as expired
FROM webhook_subscriptions
GROUP BY provider;
```

### Teams Meeting Usage

Track Teams meeting adoption:

```sql
SELECT
  DATE(start_time) as date,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE teams_enabled = true) as teams_meetings,
  ROUND(100.0 * COUNT(*) FILTER (WHERE teams_enabled = true) / COUNT(*), 2) as teams_percentage
FROM calendar_events
WHERE start_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(start_time)
ORDER BY date DESC;
```

## Support

For questions or issues with this migration:

1. Check `DESIGN_DECISIONS.md` for detailed rationale
2. Review migration SQL comments
3. Test in development environment first
4. Contact database team before production deployment

## References

- [Microsoft Graph Calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [Microsoft Graph Webhooks](https://learn.microsoft.com/en-us/graph/webhooks)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
