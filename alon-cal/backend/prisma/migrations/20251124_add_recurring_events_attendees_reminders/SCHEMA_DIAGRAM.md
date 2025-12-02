# Database Schema Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CALENDAR EVENT SCHEMA                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│   User               │
├──────────────────────┤
│ id (UUID)           │◄────────┐
│ email               │         │
│ password_hash       │         │
│ first_name          │         │
│ last_name           │         │
│ created_at          │         │
│ updated_at          │         │
│ deleted_at          │         │
└──────────────────────┘         │
         │                       │
         │ 1                     │ 1
         │                       │
         │ N                     │
         ▼                       │
┌──────────────────────┐         │
│ CalendarConnection   │         │
├──────────────────────┤         │
│ id (UUID)           │         │
│ user_id (FK)        ├─────────┘
│ provider            │
│ calendar_id         │
│ calendar_name       │
│ access_token        │
│ refresh_token       │
│ token_expires_at    │
│ calendar_color      │
│ is_primary          │
│ is_connected        │
│ last_synced_at      │
│ sync_token          │
│ created_at          │
│ updated_at          │
│ deleted_at          │
└──────────────────────┘
         │
         │ 1
         │
         │ N
         ▼
┌─────────────────────────────────────────────────────────────┐
│ CalendarEvent                                               │
├─────────────────────────────────────────────────────────────┤
│ id (UUID)                                                  │◄──────┐
│ calendar_connection_id (FK)                                 │       │
│ provider_event_id                                           │       │
│ title                                                       │       │
│ description                                                 │       │
│ location                                                    │       │
│ start_time                                                  │       │
│ end_time                                                    │       │
│ is_all_day                                                  │       │
│ timezone                                                    │       │
│ status (CONFIRMED/TENTATIVE/CANCELLED)                     │       │
│ sync_status (PENDING/SYNCED/FAILED/DELETED)                │       │
│                                                             │       │
│ ┌─── RECURRENCE FIELDS ────────────────────────────┐       │       │
│ │ is_recurring                                     │       │       │
│ │ recurrence_rule (RRULE format)                   │       │       │
│ │ recurrence_frequency (DAILY/WEEKLY/MONTHLY/...)  │       │       │
│ │ recurrence_interval                              │       │       │
│ │ recurrence_end_type (NEVER/DATE/COUNT)          │       │       │
│ │ recurrence_end_date                              │       │       │
│ │ recurrence_count                                 │       │       │
│ │                                                  │       │       │
│ │ ┌─ Weekly Recurrence ────────────────┐          │       │       │
│ │ │ recurrence_by_day (CSV)            │          │       │       │
│ │ │ e.g., "MONDAY,WEDNESDAY,FRIDAY"    │          │       │       │
│ │ └────────────────────────────────────┘          │       │       │
│ │                                                  │       │       │
│ │ ┌─ Monthly Recurrence ───────────────┐          │       │       │
│ │ │ month_day_type                     │          │       │       │
│ │ │   - DAY_OF_MONTH (e.g., 15th)      │          │       │       │
│ │ │   - RELATIVE_DAY (e.g., 1st Mon)   │          │       │       │
│ │ │ recurrence_by_month_day (1-31)     │          │       │       │
│ │ │ recurrence_by_set_pos (1=first)    │          │       │       │
│ │ │ recurrence_by_day_of_week          │          │       │       │
│ │ └────────────────────────────────────┘          │       │       │
│ │                                                  │       │       │
│ │ ┌─ Yearly Recurrence ────────────────┐          │       │       │
│ │ │ recurrence_by_month (CSV)          │          │       │       │
│ │ │ e.g., "1,6,12" (Jan,Jun,Dec)       │          │       │       │
│ │ └────────────────────────────────────┘          │       │       │
│ │                                                  │       │       │
│ │ exception_dates (CSV ISO dates)                 │       │       │
│ │ parent_event_id (FK - self-reference)           │       │  Self │
│ └──────────────────────────────────────────────────┘       │  Ref  │
│                                                             ├───────┘
│ ┌─── DEPRECATED (Backward Compatibility) ─────────┐       │   (parent/child)
│ │ attendees (JSONB)                               │       │
│ │ reminders (JSONB)                               │       │
│ └─────────────────────────────────────────────────┘       │
│                                                             │
│ provider_metadata (JSONB)                                   │
│ html_link                                                   │
│ last_synced_at                                              │
│ created_at                                                  │
│ updated_at                                                  │
│ deleted_at                                                  │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │ 1                            │ 1
         │                              │
         │ N                            │ N
         ▼                              ▼
┌──────────────────────┐      ┌──────────────────────┐
│ EventAttendee        │      │ EventReminder        │
├──────────────────────┤      ├──────────────────────┤
│ id (UUID)           │      │ id (UUID)           │
│ event_id (FK)       │      │ event_id (FK)       │
│ email               │      │ method              │
│ display_name        │      │   - EMAIL           │
│ rsvp_status         │      │   - POPUP           │
│   - NEEDS_ACTION    │      │   - SMS             │
│   - ACCEPTED        │      │ minutes_before      │
│   - DECLINED        │      │ created_at          │
│   - TENTATIVE       │      │ updated_at          │
│ is_organizer        │      └──────────────────────┘
│ is_optional         │
│ comment             │
│ response_time       │
│ created_at          │
│ updated_at          │
└──────────────────────┘
```

## Index Strategy

### High-Performance Indexes

```
CalendarEvent Indexes:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Single Column:
  ✓ calendar_connection_id    (Foreign key lookup)
  ✓ provider_event_id         (Provider sync)
  ✓ start_time                (Date range queries)
  ✓ end_time                  (Date range queries)
  ✓ status                    (Filter by status)
  ✓ sync_status               (Sync operations)
  ✓ is_recurring              (Recurring filter)
  ✓ parent_event_id           (Parent/child lookup)
  ✓ recurrence_frequency      (Filter by frequency)
  ✓ recurrence_end_date       (End date queries)
  ✓ recurrence_end_type       (End type filter)
  ✓ month_day_type            (Monthly pattern filter)
  ✓ deleted_at                (Soft delete filter)

Composite (Multi-column):
  ✓ (calendar_connection_id, start_time, end_time)
      → Calendar date range queries
  ✓ (calendar_connection_id, sync_status)
      → Sync status per calendar
  ✓ (is_recurring, recurrence_frequency, recurrence_end_type)
      → Recurring event queries (partial index)

Unique Constraints:
  ✓ (calendar_connection_id, provider_event_id)
      → Prevent duplicate synced events


EventAttendee Indexes:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Single Column:
  ✓ event_id                  (Event lookup)
  ✓ email                     (Attendee lookup)
  ✓ rsvp_status               (Status filter)
  ✓ is_organizer              (Organizer filter)

Composite (Multi-column):
  ✓ (event_id, rsvp_status)
      → Event attendees by status
  ✓ (email, rsvp_status)
      → User's events by RSVP status

Unique Constraints:
  ✓ (event_id, email)
      → Prevent duplicate attendees


EventReminder Indexes:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Single Column:
  ✓ event_id                  (Event lookup)
  ✓ minutes_before            (Reminder scheduling)

Composite (Multi-column):
  ✓ (event_id, minutes_before)
      → Event reminder queries
  ✓ (method, minutes_before)
      → Reminder scheduler queries
```

## Data Flow Examples

### 1. Create Recurring Event Flow

```
User Request
    │
    ▼
┌──────────────────────────────────────┐
│ POST /api/events                     │
│ {                                    │
│   title: "Weekly Standup",           │
│   recurrence: "FREQ=WEEKLY;..."      │
│   attendees: [...],                  │
│   reminders: [...]                   │
│ }                                    │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ Parse RRULE → Database Fields        │
│ "FREQ=WEEKLY;BYDAY=MO,WE,FR"        │
│    ↓                                 │
│ recurrence_frequency: WEEKLY         │
│ recurrence_by_day: "MONDAY,WE..."   │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ Transaction:                         │
│ 1. Insert CalendarEvent              │
│ 2. Insert EventAttendees (bulk)      │
│ 3. Insert EventReminders (bulk)      │
└──────────────────────────────────────┘
    │
    ▼
Success Response
```

### 2. Query Events by Attendee Flow

```
GET /api/events?attendee=john@example.com
    │
    ▼
┌──────────────────────────────────────┐
│ Prisma Query with Join               │
│                                      │
│ CalendarEvent.findMany({             │
│   where: {                           │
│     eventAttendees: {                │
│       some: { email: "john@..." }    │
│     }                                │
│   },                                 │
│   include: { eventAttendees: true }  │
│ })                                   │
└──────────────────────────────────────┘
    │
    ▼
PostgreSQL Execution Plan:
┌──────────────────────────────────────┐
│ 1. Index Scan on                     │
│    event_attendees_email_idx         │
│    WHERE email = 'john@...'          │
│                                      │
│ 2. Nested Loop Join                  │
│    calendar_events ON id = event_id  │
│                                      │
│ 3. Index Scan on                     │
│    calendar_events_start_time_idx    │
│    (for date filtering)              │
└──────────────────────────────────────┘
    │
    ▼
Return Events with Attendees
```

### 3. RSVP Update Flow

```
PATCH /api/events/:id/attendees/:email
{ rsvpStatus: "ACCEPTED" }
    │
    ▼
┌──────────────────────────────────────┐
│ Authorization Check:                 │
│ - Is user the attendee?              │
│ - Or is user the organizer?          │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ Update EventAttendee:                │
│                                      │
│ UPDATE event_attendees               │
│ SET rsvp_status = 'ACCEPTED',        │
│     response_time = NOW(),           │
│     updated_at = NOW()               │
│ WHERE event_id = ? AND email = ?     │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ Trigger: update_updated_at_column    │
│ (automatically updates updated_at)   │
└──────────────────────────────────────┘
    │
    ▼
Success Response + Notification
```

## Recurrence Pattern Examples

### Weekly: Monday, Wednesday, Friday

```
Database Fields:
┌─────────────────────────────────────┐
│ is_recurring: true                  │
│ recurrence_frequency: WEEKLY        │
│ recurrence_interval: 1              │
│ recurrence_by_day: "MONDAY,WED..." │
│ recurrence_end_type: COUNT          │
│ recurrence_count: 20                │
└─────────────────────────────────────┘

RRULE Equivalent:
FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20

Generated Occurrences:
2024-01-01 Mon ✓
2024-01-02 Tue ✗
2024-01-03 Wed ✓
2024-01-04 Thu ✗
2024-01-05 Fri ✓
2024-01-08 Mon ✓
...
```

### Monthly: First Monday

```
Database Fields:
┌─────────────────────────────────────┐
│ is_recurring: true                  │
│ recurrence_frequency: MONTHLY       │
│ recurrence_interval: 1              │
│ month_day_type: RELATIVE_DAY        │
│ recurrence_by_set_pos: 1            │
│ recurrence_by_day_of_week: MONDAY   │
│ recurrence_end_type: NEVER          │
└─────────────────────────────────────┘

RRULE Equivalent:
FREQ=MONTHLY;BYDAY=1MO

Generated Occurrences:
2024-01-01 (1st Monday of Jan)
2024-02-05 (1st Monday of Feb)
2024-03-04 (1st Monday of Mar)
...
```

### Monthly: 15th of Month

```
Database Fields:
┌─────────────────────────────────────┐
│ is_recurring: true                  │
│ recurrence_frequency: MONTHLY       │
│ recurrence_interval: 1              │
│ month_day_type: DAY_OF_MONTH        │
│ recurrence_by_month_day: 15         │
│ recurrence_end_type: DATE           │
│ recurrence_end_date: 2024-12-31     │
└─────────────────────────────────────┘

RRULE Equivalent:
FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=20241231T235959Z

Generated Occurrences:
2024-01-15
2024-02-15
2024-03-15
...
2024-12-15
```

### Yearly: Quarterly (Jan, Apr, Jul, Oct)

```
Database Fields:
┌─────────────────────────────────────┐
│ is_recurring: true                  │
│ recurrence_frequency: YEARLY        │
│ recurrence_interval: 1              │
│ recurrence_by_month: "1,4,7,10"    │
│ recurrence_by_month_day: 15         │
│ recurrence_end_type: NEVER          │
└─────────────────────────────────────┘

RRULE Equivalent:
FREQ=YEARLY;BYMONTH=1,4,7,10;BYMONTHDAY=15

Generated Occurrences:
2024-01-15
2024-04-15
2024-07-15
2024-10-15
2025-01-15
2025-04-15
...
```

## Storage Efficiency

### CSV vs Relational Trade-offs

```
┌─────────────────────────────────────────────────────────────┐
│ Field Type: recurrence_by_day (CSV)                         │
├─────────────────────────────────────────────────────────────┤
│ Storage: "MONDAY,WEDNESDAY,FRIDAY" = ~25 bytes              │
│ Pros:                                                       │
│   ✓ Simple storage                                          │
│   ✓ RRULE compatible                                        │
│   ✓ No joins needed                                         │
│ Cons:                                                       │
│   ✗ Can't query "events on Monday"                          │
│   ✗ Need parsing in application                             │
│                                                             │
│ Alternative: Junction Table                                 │
│   event_recurrence_days (event_id, day_of_week)            │
│   Pros: Queryable, normalized                               │
│   Cons: 3 rows instead of 1, requires join                  │
│                                                             │
│ Decision: CSV for RRULE simplicity                          │
│   - Recurring events are created, not queried by pattern    │
│   - RRULE string is canonical source                        │
│   - Expansion happens in application layer                  │
└─────────────────────────────────────────────────────────────┘
```

## Migration Compatibility

```
┌────────────────────────────────────────────────────────────┐
│ BEFORE MIGRATION                                           │
├────────────────────────────────────────────────────────────┤
│ calendar_events:                                           │
│   attendees: [{email, name, responseStatus, organizer}]   │
│   reminders: [{method, minutes}]                           │
└────────────────────────────────────────────────────────────┘
         │
         │ Migration Applied
         ▼
┌────────────────────────────────────────────────────────────┐
│ AFTER MIGRATION                                            │
├────────────────────────────────────────────────────────────┤
│ calendar_events:                                           │
│   attendees (JSONB) - DEPRECATED but still works           │
│   reminders (JSONB) - DEPRECATED but still works           │
│   + Enhanced recurrence fields                             │
│                                                            │
│ event_attendees (NEW):                                     │
│   Relational model for attendees                           │
│                                                            │
│ event_reminders (NEW):                                     │
│   Relational model for reminders                           │
└────────────────────────────────────────────────────────────┘

Application reads both sources:
  if (eventAttendees.length > 0)
    use eventAttendees
  else
    parse JSONB attendees
```

## Key Design Principles

1. **Backward Compatibility First**
   - No breaking changes to existing data
   - Gradual migration path
   - Dual-read strategy

2. **Google Calendar RRULE Compliance**
   - RFC 5545 standard
   - Direct RRULE string storage
   - Parsed fields for querying

3. **Performance Optimization**
   - Strategic indexes for common queries
   - Composite indexes for joins
   - Partial indexes for filtered queries

4. **Data Integrity**
   - Foreign key constraints
   - Check constraints for valid ranges
   - Unique constraints prevent duplicates
   - Cascade deletes for cleanup

5. **Scalability**
   - CSV for low-cardinality fields
   - Relational for queryable data
   - Soft deletes for sync compatibility
   - Efficient indexing strategy
