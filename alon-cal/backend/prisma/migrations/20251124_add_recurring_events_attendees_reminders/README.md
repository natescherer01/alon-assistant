# Migration: Enhanced Recurring Events, Attendees, and Reminders

**Migration ID:** 20251124_add_recurring_events_attendees_reminders
**Date:** 2025-11-24
**Status:** Ready for deployment

## Overview

This migration extends the calendar application with comprehensive support for:

1. **Complex Recurring Events** - Full Google Calendar RRULE (RFC 5545) compatibility
2. **Event Attendees** - Relational model for better RSVP tracking and querying
3. **Event Reminders** - Structured reminder management with multiple notification methods

## Design Decisions

### 1. Recurring Events Enhancement

**Problem:** The existing schema had basic recurrence support but lacked the granularity needed for complex patterns like "every first Monday of the month" or "weekly on Monday, Wednesday, and Friday."

**Solution:** Extended `CalendarEvent` with additional fields to support:

#### Weekly Recurrence
- **recurrence_by_day**: Comma-separated days (e.g., "MONDAY,WEDNESDAY,FRIDAY")
- Allows "every Tuesday and Thursday" patterns

#### Monthly Recurrence
Two patterns supported:

1. **DAY_OF_MONTH**: Specific day (e.g., 15th of each month)
   - Uses `recurrence_by_month_day` field (1-31)

2. **RELATIVE_DAY**: Relative position (e.g., first Monday, last Friday)
   - Uses `recurrence_by_set_pos` (1=first, -1=last, -2=second-to-last)
   - Uses `recurrence_by_day_of_week` (MONDAY, TUESDAY, etc.)

#### Yearly Recurrence
- **recurrence_by_month**: Comma-separated months (e.g., "1,6,12" for Jan, Jun, Dec)
- Combines with monthly patterns for complex yearly events

#### End Conditions
- **RecurrenceEndType** enum: NEVER, DATE, or COUNT
- **recurrence_end_date**: Specific end date
- **recurrence_count**: End after X occurrences

#### Exception Dates
- **exception_dates**: Comma-separated ISO dates to exclude (EXDATE in RRULE)
- Useful for holidays or one-time cancellations

### 2. Event Attendees Model

**Problem:** JSONB attendees field makes it difficult to:
- Query events by attendee email
- Track RSVP status changes over time
- Efficiently filter events by RSVP status
- Enforce data integrity (email validation, unique constraints)

**Solution:** New `EventAttendee` model with:

```prisma
model EventAttendee {
  id              UUID
  eventId         UUID
  email           String
  displayName     String?
  rsvpStatus      RsvpStatus  // NEEDS_ACTION, ACCEPTED, DECLINED, TENTATIVE
  isOrganizer     Boolean
  isOptional      Boolean
  comment         String?
  responseTime    DateTime?
  createdAt       DateTime
  updatedAt       DateTime
}
```

**Benefits:**
- Query all events for a specific attendee
- Filter events by RSVP status
- Track when attendees respond
- Unique constraint prevents duplicate attendees
- Cascade delete when event is removed

**Indexes:**
- `email` - Find all events for an attendee
- `rsvpStatus` - Filter by response status
- `(eventId, rsvpStatus)` - Composite for efficient event queries
- `(email, rsvpStatus)` - Find accepted/declined events for user
- Unique on `(eventId, email)` - Prevent duplicates

### 3. Event Reminders Model

**Problem:** JSONB reminders field:
- Hard to query events with specific reminder times
- Difficult to implement reminder scheduling logic
- No validation on reminder values

**Solution:** New `EventReminder` model with:

```prisma
model EventReminder {
  id            UUID
  eventId       UUID
  method        ReminderMethod  // EMAIL, POPUP, SMS
  minutesBefore Int             // 30 = 30 minutes before event
  createdAt     DateTime
  updatedAt     DateTime
}
```

**Benefits:**
- Multiple reminders per event
- Query events by reminder time
- Support different notification methods
- Validate minutes_before is positive
- Default: 30 minutes (Google Calendar standard)

**Indexes:**
- `eventId` - Get all reminders for event
- `minutesBefore` - Reminder scheduling queries
- `(eventId, minutesBefore)` - Prevent duplicate reminder times
- `(method, minutesBefore)` - Schedule by notification method

### 4. Backward Compatibility

**Critical Decision:** Maintain existing JSONB fields for backward compatibility.

**Strategy:**
1. Keep `attendees` and `reminders` JSONB columns
2. Mark as DEPRECATED in comments
3. New events use relational models
4. Existing events continue to work
5. Gradual migration path for existing data

**Application Layer Logic:**
```typescript
// Read attendees (check both sources)
const attendees = event.eventAttendees.length > 0
  ? event.eventAttendees
  : parseJsonAttendees(event.attendees);

// Write new attendees (use relational model)
await prisma.eventAttendee.create({
  data: { eventId, email, rsvpStatus }
});
```

## Schema Changes

### New Enums

1. **RsvpStatus**: NEEDS_ACTION, ACCEPTED, DECLINED, TENTATIVE
2. **ReminderMethod**: EMAIL, POPUP, SMS
3. **DayOfWeek**: SUNDAY - SATURDAY
4. **RecurrenceEndType**: NEVER, DATE, COUNT
5. **MonthDayType**: DAY_OF_MONTH, RELATIVE_DAY

### New Tables

1. **event_attendees**: Event participants with RSVP tracking
2. **event_reminders**: Event notification settings

### Extended Tables

**calendar_events** - New columns:
- `recurrence_end_type` - End condition type
- `recurrence_by_day` - Weekly: days of week
- `month_day_type` - Monthly pattern type
- `recurrence_by_month_day` - Monthly: specific day
- `recurrence_by_set_pos` - Monthly: relative position
- `recurrence_by_day_of_week` - Monthly: day of week
- `recurrence_by_month` - Yearly: months
- `exception_dates` - Excluded dates

## Performance Optimizations

### Indexes Added

**calendar_events:**
- `recurrence_end_type_idx` - Filter by end condition
- `month_day_type_idx` - Filter by monthly pattern
- `recurring_pattern_idx` - Composite for recurring queries
  - Includes: `(is_recurring, recurrence_frequency, recurrence_end_type)`
  - Partial index: `WHERE is_recurring = true`

**event_attendees:**
- Single-column: `event_id`, `email`, `rsvp_status`, `is_organizer`
- Composite: `(event_id, rsvp_status)`, `(email, rsvp_status)`
- Unique: `(event_id, email)`

**event_reminders:**
- Single-column: `event_id`, `minutes_before`
- Composite: `(event_id, minutes_before)`, `(method, minutes_before)`

### Query Performance Examples

```sql
-- Find all events for an attendee with RSVP status
-- Uses: event_attendees_email_rsvp_idx
SELECT ce.* FROM calendar_events ce
JOIN event_attendees ea ON ce.id = ea.event_id
WHERE ea.email = 'user@example.com'
  AND ea.rsvp_status = 'ACCEPTED';

-- Find recurring weekly events that end by date
-- Uses: calendar_events_recurring_pattern_idx
SELECT * FROM calendar_events
WHERE is_recurring = true
  AND recurrence_frequency = 'WEEKLY'
  AND recurrence_end_type = 'DATE'
  AND recurrence_end_date <= '2024-12-31';

-- Schedule reminders for next hour
-- Uses: event_reminders_method_minutes_idx + calendar_events_start_time_idx
SELECT ce.*, er.* FROM calendar_events ce
JOIN event_reminders er ON ce.id = er.event_id
WHERE ce.start_time BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
  AND er.method = 'EMAIL';
```

## Data Constraints

### Check Constraints

1. **calendar_events.recurrence_by_month_day**
   - Range: 1-31 (valid days of month)

2. **calendar_events.recurrence_by_set_pos**
   - Range: -5 to 5, excluding 0
   - -1 = last, -2 = second-to-last, 1 = first, 2 = second

3. **event_reminders.minutes_before**
   - Must be >= 0 (non-negative)

### Unique Constraints

1. **event_attendees**: `(event_id, email)` - Prevent duplicate attendees
2. **calendar_events**: `(calendar_connection_id, provider_event_id)` - Prevent duplicate synced events

### Foreign Keys

All foreign keys use `ON DELETE CASCADE`:
- Deleting an event removes all attendees and reminders
- Deleting a calendar connection removes all events

## RRULE Compatibility

This schema fully supports Google Calendar RRULE format (RFC 5545):

### Examples

**Every Monday and Wednesday:**
```
FREQ=WEEKLY;BYDAY=MO,WE

frequency: WEEKLY
interval: 1
recurrenceByDay: "MONDAY,WEDNESDAY"
```

**First Monday of every month:**
```
FREQ=MONTHLY;BYDAY=1MO

frequency: MONTHLY
interval: 1
monthDayType: RELATIVE_DAY
recurrenceBySetPos: 1
recurrenceByDayOfWeek: MONDAY
```

**Last Friday of every month:**
```
FREQ=MONTHLY;BYDAY=-1FR

frequency: MONTHLY
interval: 1
monthDayType: RELATIVE_DAY
recurrenceBySetPos: -1
recurrenceByDayOfWeek: FRIDAY
```

**15th of every month, ends after 12 occurrences:**
```
FREQ=MONTHLY;BYMONTHDAY=15;COUNT=12

frequency: MONTHLY
interval: 1
monthDayType: DAY_OF_MONTH
recurrenceByMonthDay: 15
recurrenceEndType: COUNT
recurrenceCount: 12
```

**Every year on January 1st and July 4th:**
```
FREQ=YEARLY;BYMONTH=1,7;BYMONTHDAY=1,4

frequency: YEARLY
interval: 1
recurrenceByMonth: "1,7"
recurrenceByMonthDay: 1 (or 4 for July)
```

## Migration Steps

### 1. Development Environment

```bash
# Navigate to backend directory
cd /Users/natescherer/alon-cal/backend

# Run migration
npx prisma migrate dev --name add_recurring_events_attendees_reminders

# Generate Prisma client
npx prisma generate

# Verify migration
npx prisma migrate status
```

### 2. Production Environment

```bash
# Review migration
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma

# Deploy to production
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

### 3. Rollback (if needed)

```bash
# Run rollback script
psql $DATABASE_URL -f prisma/migrations/20251124_add_recurring_events_attendees_reminders/rollback.sql

# Mark migration as rolled back in Prisma
npx prisma migrate resolve --rolled-back 20251124_add_recurring_events_attendees_reminders
```

## Data Migration (Optional)

To migrate existing JSONB data to relational tables:

```sql
-- Migrate attendees
INSERT INTO event_attendees (event_id, email, display_name, rsvp_status, is_organizer, created_at, updated_at)
SELECT
  ce.id,
  (attendee->>'email')::VARCHAR(255),
  (attendee->>'name')::VARCHAR(255),
  CASE (attendee->>'responseStatus')
    WHEN 'needsAction' THEN 'NEEDS_ACTION'::rsvp_status
    WHEN 'accepted' THEN 'ACCEPTED'::rsvp_status
    WHEN 'declined' THEN 'DECLINED'::rsvp_status
    WHEN 'tentative' THEN 'TENTATIVE'::rsvp_status
    ELSE 'NEEDS_ACTION'::rsvp_status
  END,
  COALESCE((attendee->>'organizer')::BOOLEAN, false),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM calendar_events ce,
  jsonb_array_elements(ce.attendees) AS attendee
WHERE ce.attendees IS NOT NULL
ON CONFLICT (event_id, email) DO NOTHING;

-- Migrate reminders
INSERT INTO event_reminders (event_id, method, minutes_before, created_at, updated_at)
SELECT
  ce.id,
  CASE (reminder->>'method')
    WHEN 'email' THEN 'EMAIL'::reminder_method
    WHEN 'sms' THEN 'SMS'::reminder_method
    ELSE 'POPUP'::reminder_method
  END,
  (reminder->>'minutes')::INTEGER,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM calendar_events ce,
  jsonb_array_elements(ce.reminders) AS reminder
WHERE ce.reminders IS NOT NULL;
```

## Testing Checklist

- [ ] Create event with weekly recurrence (specific days)
- [ ] Create event with monthly recurrence (first Monday)
- [ ] Create event with monthly recurrence (15th of month)
- [ ] Create event ending after X occurrences
- [ ] Create event ending on specific date
- [ ] Add multiple attendees to event
- [ ] Update attendee RSVP status
- [ ] Query events by attendee email
- [ ] Add multiple reminders to event
- [ ] Delete event and verify cascade delete
- [ ] Test backward compatibility with existing JSONB events
- [ ] Verify indexes are used in query plans (EXPLAIN)
- [ ] Test exception dates (excluded dates)
- [ ] Test yearly recurrence with multiple months

## Security Considerations

1. **Email Validation**: Validate email format in application layer
2. **RSVP Permissions**: Only event organizer or attendee can update RSVP
3. **Reminder Limits**: Enforce max reminders per event (prevent abuse)
4. **Data Isolation**: Foreign keys ensure data belongs to correct events
5. **Soft Deletes**: calendar_events uses soft delete (deleted_at)

## Known Limitations

1. **Comma-Separated Storage**: Some fields use CSV format (recurrenceByDay, recurrenceByMonth)
   - Future: Consider separate junction table for better querying
   - Current: Optimized for RRULE compatibility and simplicity

2. **Exception Dates**: Stored as text, not relational
   - Future: Separate exception_dates table for complex queries
   - Current: Simple comma-separated ISO dates

3. **No Attendee Groups**: Each attendee is individual
   - Future: Add attendee groups or distribution lists
   - Current: Add each attendee separately

## References

- [RFC 5545 - iCalendar](https://tools.ietf.org/html/rfc5545)
- [Google Calendar API - Events](https://developers.google.com/calendar/api/v3/reference/events)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)

## Support

For questions or issues with this migration:
1. Review this README
2. Check Prisma migration status: `npx prisma migrate status`
3. Inspect database directly: `psql $DATABASE_URL`
4. Review application logs for migration errors
