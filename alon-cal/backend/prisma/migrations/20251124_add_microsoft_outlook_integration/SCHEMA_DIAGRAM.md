# Database Schema Diagram - Microsoft Integration

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ PK  id: UUID                                                            │
│ UQ  email: VARCHAR(255)                                                 │
│     password_hash: VARCHAR(255)                                         │
│     first_name: VARCHAR(100)                                            │
│     last_name: VARCHAR(100)                                             │
│     created_at: TIMESTAMPTZ                                             │
│     updated_at: TIMESTAMPTZ                                             │
│     deleted_at: TIMESTAMPTZ                                             │
└─────────────────────────────────────────────────────────────────────────┘
           │
           │ 1:N
           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       CALENDAR_CONNECTIONS                              │
├─────────────────────────────────────────────────────────────────────────┤
│ PK  id: UUID                                                            │
│ FK  user_id: UUID → users.id (CASCADE)                                  │
│     provider: CalendarProvider (GOOGLE|MICROSOFT|APPLE)                 │
│     calendar_id: VARCHAR(255)                                           │
│     calendar_name: VARCHAR(255)                                         │
│     access_token: TEXT (encrypted)                                      │
│     refresh_token: TEXT (encrypted)                                     │
│     token_expires_at: TIMESTAMPTZ                                       │
│     calendar_color: VARCHAR(7)                                          │
│     is_primary: BOOLEAN                                                 │
│     is_connected: BOOLEAN                                               │
│     last_synced_at: TIMESTAMPTZ                                         │
│     sync_token: TEXT                                                    │
│ ┌─────────────────────────────────────────────────────────────────┐    │
│ │ 🆕 MICROSOFT FIELDS                                             │    │
│ │ delegate_email: VARCHAR(255) - Shared calendar owner email      │    │
│ └─────────────────────────────────────────────────────────────────┘    │
│     created_at: TIMESTAMPTZ                                             │
│     updated_at: TIMESTAMPTZ                                             │
│     deleted_at: TIMESTAMPTZ                                             │
│                                                                         │
│ UQ  (user_id, provider, calendar_id)                                    │
│ IDX user_id, provider, is_connected, last_synced_at, deleted_at        │
│ IDX delegate_email 🆕                                                   │
└─────────────────────────────────────────────────────────────────────────┘
           │                              │
           │ 1:N                          │ 1:N
           ↓                              ↓
┌──────────────────────────────┐  ┌─────────────────────────────────────────┐
│   WEBHOOK_SUBSCRIPTIONS 🆕   │  │        CALENDAR_EVENTS                  │
├──────────────────────────────┤  ├─────────────────────────────────────────┤
│ PK  id: UUID                 │  │ PK  id: UUID                            │
│ FK  calendar_connection_id   │  │ FK  calendar_connection_id: UUID        │
│     → calendar_connections   │  │     → calendar_connections (CASCADE)    │
│       (CASCADE)              │  │     provider_event_id: VARCHAR(255)     │
│     provider: CalendarProvider│  │     title: VARCHAR(500)                 │
│     subscription_id: VARCHAR  │  │     description: TEXT                   │
│     resource_path: VARCHAR   │  │     location: VARCHAR(500)              │
│     expiration_datetime      │  │     start_time: TIMESTAMPTZ             │
│     client_state: VARCHAR    │  │     end_time: TIMESTAMPTZ               │
│     notification_url: TEXT   │  │     is_all_day: BOOLEAN                 │
│     last_notification_at     │  │     timezone: VARCHAR(100)              │
│     is_active: BOOLEAN       │  │     status: EventStatus                 │
│     created_at: TIMESTAMPTZ  │  │     sync_status: SyncStatus             │
│     updated_at: TIMESTAMPTZ  │  │                                         │
│                              │  │ [RECURRENCE FIELDS]                     │
│ UQ  (subscription_id,        │  │     is_recurring: BOOLEAN               │
│      provider)               │  │     recurrence_rule: TEXT               │
│ IDX calendar_connection_id   │  │     recurrence_frequency                │
│ IDX subscription_id          │  │     recurrence_interval: INT            │
│ IDX expiration_datetime      │  │     recurrence_end_type                 │
│ IDX is_active                │  │     recurrence_end_date: TIMESTAMPTZ    │
│ IDX provider                 │  │     recurrence_count: INT               │
│ IDX (provider, is_active)    │  │     recurrence_by_day: VARCHAR          │
│ IDX (expiration, is_active)  │  │     month_day_type                      │
│                              │  │     recurrence_by_month_day: INT        │
└──────────────────────────────┘  │     recurrence_by_set_pos: INT          │
                                  │     recurrence_by_day_of_week           │
                                  │     recurrence_by_month: VARCHAR        │
                                  │     exception_dates: TEXT               │
                                  │ FK  parent_event_id: UUID               │
                                  │     → calendar_events (CASCADE)         │
                                  │                                         │
                                  │ ┌─────────────────────────────────────┐ │
                                  │ │ 🆕 MICROSOFT OUTLOOK FIELDS         │ │
                                  │ │ importance: EventImportance         │ │
                                  │ │ outlook_categories: TEXT            │ │
                                  │ │ conversation_id: VARCHAR(255)       │ │
                                  │ │ series_master_id: VARCHAR(255)      │ │
                                  │ └─────────────────────────────────────┘ │
                                  │                                         │
                                  │ ┌─────────────────────────────────────┐ │
                                  │ │ 🆕 MICROSOFT TEAMS FIELDS           │ │
                                  │ │ teams_enabled: BOOLEAN              │ │
                                  │ │ teams_meeting_url: TEXT             │ │
                                  │ │ teams_conference_id: VARCHAR(255)   │ │
                                  │ │ teams_dial_in_url: TEXT             │ │
                                  │ └─────────────────────────────────────┘ │
                                  │                                         │
                                  │ [LEGACY FIELDS]                         │
                                  │     attendees: JSONB (deprecated)       │
                                  │     reminders: JSONB (deprecated)       │
                                  │     provider_metadata: JSONB            │
                                  │     html_link: TEXT                     │
                                  │     last_synced_at: TIMESTAMPTZ         │
                                  │     created_at: TIMESTAMPTZ             │
                                  │     updated_at: TIMESTAMPTZ             │
                                  │     deleted_at: TIMESTAMPTZ             │
                                  │                                         │
                                  │ UQ  (calendar_connection_id,            │
                                  │      provider_event_id)                 │
                                  │ IDX calendar_connection_id              │
                                  │ IDX provider_event_id                   │
                                  │ IDX start_time, end_time                │
                                  │ IDX status, sync_status                 │
                                  │ IDX is_recurring, parent_event_id       │
                                  │ IDX importance 🆕                        │
                                  │ IDX conversation_id 🆕                   │
                                  │ IDX series_master_id 🆕                  │
                                  │ IDX teams_enabled 🆕                     │
                                  │ IDX (calendar_connection_id,            │
                                  │      start_time, end_time)              │
                                  │ IDX (calendar_connection_id,            │
                                  │      teams_enabled, start_time) 🆕      │
                                  └─────────────────────────────────────────┘
                                             │                │
                                             │ 1:N            │ 1:N
                    ┌────────────────────────┴────────┐       │
                    ↓                                 ↓       ↓
          ┌──────────────────────┐        ┌────────────────────────┐
          │  EVENT_ATTENDEES     │        │   EVENT_REMINDERS      │
          ├──────────────────────┤        ├────────────────────────┤
          │ PK  id: UUID         │        │ PK  id: UUID           │
          │ FK  event_id: UUID   │        │ FK  event_id: UUID     │
          │     → calendar_events│        │     → calendar_events  │
          │       (CASCADE)      │        │       (CASCADE)        │
          │     email: VARCHAR   │        │     method:            │
          │     display_name     │        │       ReminderMethod   │
          │     rsvp_status      │        │     minutes_before: INT│
          │     is_organizer     │        │     created_at         │
          │     is_optional      │        │     updated_at         │
          │     comment: TEXT    │        │                        │
          │     response_time    │        │ IDX event_id           │
          │     created_at       │        │ IDX minutes_before     │
          │     updated_at       │        │ IDX (event_id,         │
          │                      │        │      minutes_before)   │
          │ UQ  (event_id, email)│        └────────────────────────┘
          │ IDX event_id         │
          │ IDX email            │
          │ IDX rsvp_status      │
          │ IDX is_organizer     │
          │ IDX (event_id,       │
          │      rsvp_status)    │
          └──────────────────────┘
```

## New Enums

```
┌─────────────────────────────┐
│ EventImportance (🆕)        │
├─────────────────────────────┤
│ • LOW                       │
│ • NORMAL (default)          │
│ • HIGH                      │
└─────────────────────────────┘
```

## Data Flow Diagrams

### Microsoft Calendar Sync Flow

```
┌──────────────┐
│ User         │
│ Connects     │
│ Calendar     │
└──────┬───────┘
       │
       ↓
┌─────────────────────────────┐
│ CalendarConnection          │
│ • provider = MICROSOFT      │
│ • delegate_email (optional) │
└──────┬──────────────────────┘
       │
       ├─────────────────────────────────┐
       │                                 │
       ↓                                 ↓
┌──────────────────────┐      ┌────────────────────────┐
│ WebhookSubscription  │      │ CalendarEvent          │
│ • subscription_id    │      │ • importance           │
│ • resource_path      │      │ • outlook_categories   │
│ • expiration_datetime│      │ • conversation_id      │
│ • client_state       │      │ • series_master_id     │
└──────┬───────────────┘      │ • teams_enabled        │
       │                      │ • teams_meeting_url    │
       │                      └────────────────────────┘
       │
       ↓
┌──────────────────────┐
│ Webhook Notification │
│ • Validate client    │
│   state              │
│ • Update last        │
│   notification time  │
│ • Trigger sync       │
└──────────────────────┘
```

### Teams Meeting Creation Flow

```
┌────────────────┐
│ User creates   │
│ Teams meeting  │
│ in Outlook     │
└───────┬────────┘
        │
        ↓
┌────────────────────────────┐
│ Microsoft Graph API        │
│ Event object includes:     │
│ • isOnlineMeeting: true    │
│ • onlineMeeting object     │
└───────┬────────────────────┘
        │
        ↓
┌────────────────────────────┐
│ Sync to CalendarEvent      │
│ • teams_enabled = true     │
│ • teams_meeting_url = URL  │
│ • teams_conference_id      │
│ • teams_dial_in_url        │
└────────────────────────────┘
```

### Webhook Renewal Flow

```
┌──────────────────────┐
│ Background Job       │
│ (runs every 30 min)  │
└──────┬───────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│ Query: Find expiring subscriptions  │
│ WHERE is_active = true              │
│   AND expiration_datetime <         │
│       NOW() + 1 hour                │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│ For each subscription:              │
│ 1. Call Microsoft Graph renew API   │
│ 2. Update expiration_datetime       │
│ 3. On failure: set is_active=false  │
└─────────────────────────────────────┘
```

## Index Usage Patterns

### Common Query: Today's Teams Meetings

```sql
SELECT * FROM calendar_events
WHERE calendar_connection_id = ?
  AND teams_enabled = true
  AND start_time >= CURRENT_DATE
  AND end_time < CURRENT_DATE + INTERVAL '1 day';
```

**Indexes Used:**
1. Primary: `(calendar_connection_id, teams_enabled, start_time)` - Composite partial index
2. Fallback: `calendar_connection_id` + `teams_enabled` + `start_time` separate indexes

### Common Query: Expiring Webhooks

```sql
SELECT * FROM webhook_subscriptions
WHERE is_active = true
  AND expiration_datetime < NOW() + INTERVAL '1 hour'
ORDER BY expiration_datetime;
```

**Indexes Used:**
1. Primary: `(expiration_datetime, is_active)` - Composite partial index
2. Sort optimization: `expiration_datetime` in index order

### Common Query: Event Thread

```sql
SELECT * FROM calendar_events
WHERE conversation_id = ?
ORDER BY created_at;
```

**Indexes Used:**
1. Primary: `conversation_id` - Direct lookup
2. Sort: Separate `created_at` index

## Storage Estimates

### New Fields per CalendarEvent (avg)

```
importance:           4 bytes (enum)
outlook_categories:   ~50 bytes (avg 2-3 categories)
conversation_id:      ~40 bytes (typical Microsoft GUID)
series_master_id:     ~40 bytes (typical Microsoft GUID)
teams_enabled:        1 byte (boolean)
teams_meeting_url:    ~150 bytes (typical URL)
teams_conference_id:  ~15 bytes (numeric string)
teams_dial_in_url:    ~100 bytes (typical URL)
───────────────────────────────────────────────────
Total per event:      ~400 bytes
```

### WebhookSubscription per Calendar

```
Fixed columns:        ~200 bytes
Variable strings:     ~800 bytes (URLs, paths)
Indexes overhead:     ~150 bytes
───────────────────────────────────────────────────
Total per webhook:    ~1,150 bytes
```

### Projected Growth (10,000 users)

```
Assumptions:
- 10,000 users
- 2 calendars per user (avg)
- 100 events per calendar (avg)
- 2 webhooks per calendar (avg)

Events: 10,000 × 2 × 100 = 2,000,000 events
  Microsoft fields: 2M × 400 bytes = 800 MB

Webhooks: 10,000 × 2 × 2 = 40,000 subscriptions
  Storage: 40,000 × 1,150 bytes = 46 MB

Total additional storage: ~850 MB
```

## Key Relationships

1. **User → CalendarConnection** (1:N)
   - One user can connect multiple calendars
   - Each connection is provider-specific
   - Cascade delete: Deleting user removes all their calendar connections

2. **CalendarConnection → CalendarEvent** (1:N)
   - One calendar connection has many events
   - Cascade delete: Deleting connection removes all events

3. **CalendarConnection → WebhookSubscription** (1:N) 🆕
   - One calendar connection can have multiple webhook subscriptions
   - Typically 1-2 subscriptions per connection (active + renewal overlap)
   - Cascade delete: Deleting connection removes all webhooks

4. **CalendarEvent → EventAttendee** (1:N)
   - One event has many attendees
   - Cascade delete: Deleting event removes all attendees

5. **CalendarEvent → EventReminder** (1:N)
   - One event has many reminders
   - Cascade delete: Deleting event removes all reminders

6. **CalendarEvent → CalendarEvent** (1:N - self-referential)
   - Recurring events: parent_event_id references master event
   - Cascade delete: Deleting master event removes all instances

## Microsoft-Specific Features Matrix

| Feature | Field(s) | When Populated | Provider |
|---------|----------|----------------|----------|
| Shared Calendar | `delegate_email` | Microsoft 365 delegated access | Microsoft only |
| Event Priority | `importance` | All Microsoft events | Microsoft only |
| Color Categories | `outlook_categories` | User-assigned categories | Microsoft only |
| Event Threading | `conversation_id` | All Microsoft events | Microsoft only |
| Recurring Series | `series_master_id` | Recurring event instances | Microsoft only |
| Teams Meeting | `teams_*` fields | Events with Teams meeting | Microsoft only |
| Webhook Sync | `webhook_subscriptions` table | Real-time sync enabled | Microsoft + Google |

## Comparison: Before vs After Migration

### CalendarConnection

```
BEFORE:
├── Basic OAuth fields
├── Sync token
└── No delegation support

AFTER:
├── Basic OAuth fields
├── Sync token
├── 🆕 delegate_email (shared calendars)
└── 🆕 Relationship to webhooks
```

### CalendarEvent

```
BEFORE:
├── Basic event fields (title, time, location)
├── Recurrence support
├── JSONB attendees/reminders
└── Generic provider_metadata

AFTER:
├── Basic event fields (title, time, location)
├── Recurrence support
├── JSONB attendees/reminders (deprecated)
├── Relational attendees/reminders (preferred)
├── 🆕 Importance level
├── 🆕 Outlook categories
├── 🆕 Conversation threading
├── 🆕 Series master ID
└── 🆕 Full Teams meeting integration
```

### Webhook Support

```
BEFORE:
❌ No webhook tracking
❌ Manual polling required
❌ No real-time sync

AFTER:
✅ Full webhook lifecycle tracking
✅ Expiration monitoring
✅ Automatic renewal support
✅ Real-time sync enabled
```

## Notes

🆕 = New in this migration
🔄 = Modified in this migration
⚠️  = Requires attention during migration
✅ = Backward compatible

All changes are backward compatible. Existing applications will continue to work without modifications.
