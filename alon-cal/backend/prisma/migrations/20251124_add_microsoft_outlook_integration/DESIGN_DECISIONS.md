# Microsoft Outlook/Exchange Integration - Schema Design Decisions

## Overview

This migration enhances the database schema to support Microsoft Outlook/Exchange calendar integration with full feature parity including shared calendars, Teams meetings, Outlook categories, and webhook-based real-time synchronization.

## Design Decisions

### 1. CalendarConnection Enhancements

#### Addition: `delegateEmail` field

**Purpose:** Support shared and delegated calendar access in Microsoft 365.

**Implementation:**
- Type: `VARCHAR(255)`, nullable
- Indexed for efficient lookups
- Stores the email address of the calendar owner when accessing a delegated calendar

**Rationale:**
- Microsoft allows users to grant delegate access to their calendars
- When User B accesses User A's calendar, we need to track that User A is the actual owner
- This enables proper permission handling and sync scope management
- Nullable because not all calendars are delegated (primary calendars won't have this)

**Use Cases:**
- Executive assistant managing executive's calendar
- Team lead accessing team members' calendars
- Shared team/resource calendars

### 2. CalendarEvent Microsoft-Specific Fields

#### Addition: `importance` field (EventImportance enum)

**Purpose:** Track Outlook event importance levels (Low, Normal, High).

**Implementation:**
- Type: `event_importance` enum with values: `LOW`, `NORMAL`, `HIGH`
- Default: `NORMAL`
- Indexed for filtering queries

**Rationale:**
- Core Outlook feature used for prioritizing events
- Affects UI display (high importance shows red exclamation mark)
- Used in filtering and search
- Maps directly to Microsoft Graph API `importance` property

**Microsoft Graph API Mapping:**
```json
{
  "importance": "high" // low | normal | high
}
```

#### Addition: `outlookCategories` field

**Purpose:** Store Outlook categories for color coding and organization.

**Implementation:**
- Type: `TEXT`, nullable
- Stored as comma-separated values: "Red Category,Work,Project Alpha"
- Not indexed (rarely used in WHERE clauses)

**Rationale:**
- Outlook categories are user-defined and provide color coding
- Categories can be renamed by users, so we store the actual names
- Comma-separated format is simple and efficient for typical usage (1-5 categories per event)
- Alternative considered: Separate `event_categories` table (rejected as over-engineering)

**Microsoft Graph API Mapping:**
```json
{
  "categories": ["Red category", "Work", "Important"]
}
```

#### Addition: `conversationId` field

**Purpose:** Link related events together for threading and history tracking.

**Implementation:**
- Type: `VARCHAR(255)`, nullable
- Indexed for threading queries

**Rationale:**
- Microsoft assigns conversation IDs to group related items
- Enables tracking of meeting history (original + rescheduled versions)
- Useful for conflict resolution in sync
- Helps identify duplicate/modified events

**Microsoft Graph API Mapping:**
```json
{
  "conversationId": "AAQkAGI1M..."
}
```

#### Addition: `seriesMasterId` field

**Purpose:** Reference the series master for recurring event instances.

**Implementation:**
- Type: `VARCHAR(255)`, nullable
- Indexed for finding all instances of a series

**Rationale:**
- Microsoft's recurring event model uses series master + instances
- Different from our internal `parentEventId` (which is a UUID)
- Needed for proper sync of recurring event modifications
- Enables "Update this occurrence" vs "Update entire series" logic

**Distinction from `parentEventId`:**
- `parentEventId`: Our internal UUID linking instances to parent in our database
- `seriesMasterId`: Microsoft's external ID for the series master event

**Microsoft Graph API Mapping:**
```json
{
  "seriesMasterId": "AAMkAGI1M..."
}
```

### 3. Microsoft Teams Meeting Fields

#### Addition: Teams-related fields

**Purpose:** Support Teams meeting integration within calendar events.

**Implementation:**
- `teamsEnabled` (BOOLEAN, default false): Flag for Teams meetings
- `teamsMeetingUrl` (TEXT): Join URL for the Teams meeting
- `teamsConferenceId` (VARCHAR(255)): Unique conference identifier
- `teamsDialInUrl` (TEXT): Dial-in numbers and access codes

**Rationale:**
- Teams meetings are deeply integrated with Outlook calendars
- Essential data for users to join meetings
- Teams meeting creation happens automatically when scheduling in Outlook
- Users expect to see Teams join links in calendar apps

**Why indexed on `teamsEnabled`:**
- Common filter: "Show me all my Teams meetings"
- Composite index with `calendar_connection_id` and `start_time` for efficient querying
- Partial index (WHERE teams_enabled = true) saves space

**Microsoft Graph API Mapping:**
```json
{
  "isOnlineMeeting": true,
  "onlineMeetingProvider": "teamsForBusiness",
  "onlineMeeting": {
    "joinUrl": "https://teams.microsoft.com/l/meetup-join/...",
    "conferenceId": "123456789",
    "tollNumber": "+1-xxx-xxx-xxxx"
  }
}
```

### 4. WebhookSubscription Model

#### Purpose: Track webhook subscriptions for real-time calendar sync.

**Implementation:**
```prisma
model WebhookSubscription {
  id                   UUID
  calendarConnectionId UUID (FK -> CalendarConnection)
  provider             CalendarProvider (MICROSOFT | GOOGLE)
  subscriptionId       VARCHAR(255) (from provider)
  resourcePath         VARCHAR(500)
  expirationDateTime   TIMESTAMPTZ
  clientState          VARCHAR(255) (optional secret)
  notificationUrl      TEXT
  lastNotificationAt   TIMESTAMPTZ (nullable)
  isActive             BOOLEAN
  timestamps...
}
```

**Rationale:**

1. **Separate table instead of JSON in CalendarConnection:**
   - Proper relational model for querying and updates
   - One-to-many relationship (one calendar can have multiple subscriptions)
   - Need to efficiently query by expiration time for renewal
   - Enables audit trail of subscription history

2. **Provider-agnostic design:**
   - Both Microsoft Graph and Google Calendar support webhooks
   - Different expiration models but same core concept
   - Future-proof for other providers

3. **Key fields explained:**
   - `subscriptionId`: Unique ID from the provider (Microsoft/Google assigns this)
   - `resourcePath`: What resource is being monitored (e.g., `/me/calendars/{id}/events`)
   - `expirationDateTime`: Critical for renewal scheduling
   - `clientState`: Secret token for validating notification authenticity
   - `lastNotificationAt`: Tracking for monitoring and debugging
   - `isActive`: Soft delete when subscription expires or is cancelled

**Indexes:**
- `subscriptionId`: Fast lookup when notification arrives
- `expirationDateTime`: Find subscriptions needing renewal
- `isActive`: Filter active subscriptions
- `provider`: Group by provider type
- Composite `(subscriptionId, provider)`: Unique constraint
- Composite `(expiration, isActive)`: Renewal queries with filter
- Composite `(provider, isActive)`: Provider-specific active subscriptions

**Webhook Lifecycle:**

```
1. Create subscription
   ↓
2. Receive notifications (update lastNotificationAt)
   ↓
3. Monitor expiration (query by expirationDateTime)
   ↓
4. Renew before expiration (update expirationDateTime)
   ↓
5. If renewal fails → set isActive = false
```

**Microsoft Graph Webhook Specifics:**
- Maximum subscription duration: 4230 minutes (3 days)
- Must renew before expiration
- Notifications sent to `notificationUrl`
- Validation: Microsoft sends `clientState` in notifications
- Resource format: `/me/calendars/{calendarId}/events`

**Example Query - Find subscriptions expiring in 1 hour:**
```sql
SELECT * FROM webhook_subscriptions
WHERE is_active = true
  AND expiration_datetime < NOW() + INTERVAL '1 hour'
ORDER BY expiration_datetime ASC;
```

## Index Strategy

### CalendarConnection Indexes

- `delegate_email`: Support queries for delegated calendars
  - Example: "Show all calendars I'm delegated to"
  - Cardinality: Medium (some users have delegated access, most don't)

### CalendarEvent Indexes

- `importance`: Filter by priority level
  - Example: "Show high-importance meetings"
  - Cardinality: Low (3 values), but useful for filtering

- `conversation_id`: Threading related events
  - Example: "Find all versions of this meeting"
  - Cardinality: High, selective index

- `series_master_id`: Find all instances of recurring event
  - Example: "Show all occurrences of this series"
  - Cardinality: High, selective index

- `teams_enabled`: Filter Teams meetings
  - Example: "Show all my Teams meetings today"
  - Cardinality: Low (boolean), but very common query
  - Partial index for space efficiency

- Composite `(calendar_connection_id, teams_enabled, start_time)`:
  - Optimizes: "Show Teams meetings for this calendar in time range"
  - WHERE clause: teams_enabled = true (partial index)

### WebhookSubscription Indexes

- `calendar_connection_id`: Foreign key index (mandatory)
- `subscription_id`: Lookup when notification arrives (high frequency)
- `expiration_datetime`: Renewal monitoring (scheduled job)
- `is_active`: Filter out inactive subscriptions (common WHERE clause)
- `provider`: Group by provider type (MICROSOFT vs GOOGLE)

- Composite `(subscription_id, provider)`: Unique constraint
  - Prevents duplicate subscriptions
  - Efficient lookup with provider context

- Composite `(expiration_datetime, is_active)`: Renewal queries
  - Partial index: WHERE is_active = true
  - Optimizes background job that finds subscriptions to renew

- Composite `(provider, is_active)`: Provider-specific queries
  - Partial index: WHERE is_active = true
  - Example: "Show all active Microsoft webhooks"

## Performance Considerations

### Time-based Queries

The most common query pattern is "events in time range":
```sql
SELECT * FROM calendar_events
WHERE calendar_connection_id = ?
  AND start_time >= ?
  AND end_time <= ?
```

Existing composite index `(calendar_connection_id, start_time, end_time)` handles this efficiently.

### Teams Meeting Queries

Common query: "Show my Teams meetings today":
```sql
SELECT * FROM calendar_events
WHERE calendar_connection_id = ?
  AND teams_enabled = true
  AND start_time >= ?
  AND end_time <= ?
```

Composite index `(calendar_connection_id, teams_enabled, start_time)` with partial index optimizes this.

### Webhook Renewal Job

Background job runs every 30 minutes:
```sql
SELECT * FROM webhook_subscriptions
WHERE is_active = true
  AND expiration_datetime < NOW() + INTERVAL '1 hour'
ORDER BY expiration_datetime ASC;
```

Index `(expiration_datetime, is_active)` with partial index makes this efficient.

## Migration Safety

### Backward Compatibility

All changes are backward compatible:
- New fields are nullable (except teams_enabled with default false)
- Existing queries continue to work
- No data migration required
- Application can check for NULL and handle gracefully

### Rollback Support

Provided `rollback.sql` removes all changes:
- Drops webhook_subscriptions table
- Removes all Microsoft-specific columns
- Drops event_importance enum
- Removes all new indexes

**WARNING:** Rollback permanently deletes:
- All webhook subscriptions
- Microsoft-specific event data
- Delegate email information

## Data Integrity

### Constraints

1. **Foreign Keys:**
   - webhook_subscriptions.calendar_connection_id → calendar_connections.id (CASCADE)
   - Deleting a calendar connection removes all its webhooks

2. **Unique Constraints:**
   - webhook_subscriptions: `(subscription_id, provider)` UNIQUE
   - Prevents duplicate webhook subscriptions

3. **Check Constraints:**
   - None added (importance is enum-constrained)

### Triggers

- `update_webhook_subscriptions_updated_at`: Auto-update timestamp on modification

## Security Considerations

### Sensitive Data

1. **clientState field:**
   - Contains secret token for webhook validation
   - Should be cryptographically random (e.g., UUID v4)
   - Consider encryption at application layer

2. **delegateEmail field:**
   - Contains PII (email address)
   - Index creates additional storage of this data
   - Consider data retention policies

### Access Patterns

1. **Webhook endpoint:**
   - Must validate clientState in incoming notifications
   - Prevent replay attacks (check lastNotificationAt)
   - Rate limit webhook endpoint

2. **Delegate calendar access:**
   - Verify user has permission to access delegateEmail's calendar
   - Check Microsoft Graph API permissions before syncing

## Future Enhancements

### Potential Additions

1. **Subscription change types:**
   - Track what type of changes trigger notifications
   - Add `change_type` field (created, updated, deleted)

2. **Notification history:**
   - Separate table for notification audit trail
   - Link to webhook_subscriptions for debugging

3. **Outlook categories normalization:**
   - Create `outlook_categories` table
   - Many-to-many relationship with calendar_events
   - Benefits: Consistent category names, color standardization
   - Trade-off: Adds complexity for marginal benefit

4. **Teams meeting attendance:**
   - Track who joined Teams meetings
   - Requires separate API calls to Teams
   - Consider separate `teams_attendance` table

## Testing Considerations

### Test Cases

1. **CalendarConnection:**
   - Create connection with delegateEmail
   - Create connection without delegateEmail
   - Query connections by delegateEmail

2. **CalendarEvent:**
   - Create event with all Microsoft fields
   - Create event with minimal fields (backward compatibility)
   - Query Teams meetings by date range
   - Query by importance level
   - Thread events by conversationId

3. **WebhookSubscription:**
   - Create subscription
   - Update lastNotificationAt
   - Find expiring subscriptions
   - Deactivate expired subscriptions
   - Delete calendar connection (cascade)

### Sample Data

```sql
-- Delegated calendar
INSERT INTO calendar_connections (
  id, user_id, provider, calendar_id, calendar_name,
  delegate_email, ...
) VALUES (
  gen_random_uuid(), '<user_uuid>', 'MICROSOFT', 'AAMk...', 'CEO Calendar',
  'ceo@company.com', ...
);

-- Teams meeting event
INSERT INTO calendar_events (
  id, calendar_connection_id, provider_event_id, title,
  importance, teams_enabled, teams_meeting_url, ...
) VALUES (
  gen_random_uuid(), '<connection_uuid>', 'AAMk...', 'Quarterly Review',
  'HIGH', true, 'https://teams.microsoft.com/l/meetup-join/...', ...
);

-- Webhook subscription
INSERT INTO webhook_subscriptions (
  id, calendar_connection_id, provider, subscription_id,
  resource_path, expiration_datetime, client_state, notification_url
) VALUES (
  gen_random_uuid(), '<connection_uuid>', 'MICROSOFT', 'sub-123...',
  '/me/calendars/AAMk.../events', NOW() + INTERVAL '3 days',
  gen_random_uuid()::text, 'https://app.example.com/webhooks/microsoft'
);
```

## Breaking Changes

**None.** This migration is fully backward compatible.

All new fields are:
- Optional (nullable)
- Have sensible defaults
- Don't affect existing queries
- Can be ignored by application code until implemented

## References

- [Microsoft Graph Calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [Microsoft Graph Webhooks](https://learn.microsoft.com/en-us/graph/webhooks)
- [Microsoft Graph Event Resource](https://learn.microsoft.com/en-us/graph/api/resources/event)
- [Teams Meeting Integration](https://learn.microsoft.com/en-us/graph/api/resources/onlinemeeting)
- [Outlook Categories](https://learn.microsoft.com/en-us/graph/api/outlookuser-post-mastercategories)
