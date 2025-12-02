# Quick Reference Guide: Recurring Events, Attendees & Reminders

## Table of Contents
- [Common Queries](#common-queries)
- [RRULE Patterns](#rrule-patterns)
- [Data Validation](#data-validation)
- [Performance Tips](#performance-tips)
- [Migration Commands](#migration-commands)

---

## Common Queries

### Find Events by Attendee Email

```typescript
const userEvents = await prisma.calendarEvent.findMany({
  where: {
    eventAttendees: {
      some: {
        email: 'user@example.com'
      }
    },
    startTime: { gte: new Date() } // Upcoming only
  },
  include: {
    eventAttendees: true,
    eventReminders: true
  }
});
```

### Find Events Pending RSVP

```typescript
const pendingEvents = await prisma.calendarEvent.findMany({
  where: {
    eventAttendees: {
      some: {
        email: 'user@example.com',
        rsvpStatus: 'NEEDS_ACTION'
      }
    }
  }
});
```

### Find Recurring Weekly Events

```typescript
const weeklyEvents = await prisma.calendarEvent.findMany({
  where: {
    isRecurring: true,
    recurrenceFrequency: 'WEEKLY'
  }
});
```

### Update RSVP Status

```typescript
await prisma.eventAttendee.updateMany({
  where: {
    eventId: eventId,
    email: 'user@example.com'
  },
  data: {
    rsvpStatus: 'ACCEPTED',
    responseTime: new Date()
  }
});
```

### Get Event with All Relations

```typescript
const event = await prisma.calendarEvent.findUnique({
  where: { id: eventId },
  include: {
    eventAttendees: {
      orderBy: { isOrganizer: 'desc' } // Organizer first
    },
    eventReminders: {
      orderBy: { minutesBefore: 'asc' } // Earliest first
    },
    parentEvent: true,
    childEvents: true,
    calendarConnection: {
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true }
        }
      }
    }
  }
});
```

---

## RRULE Patterns

### Weekly on Multiple Days

```typescript
{
  isRecurring: true,
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  recurrenceFrequency: 'WEEKLY',
  recurrenceInterval: 1,
  recurrenceByDay: 'MONDAY,WEDNESDAY,FRIDAY',
  recurrenceEndType: 'NEVER'
}
```

### Every 2 Weeks on Tuesday

```typescript
{
  isRecurring: true,
  recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU',
  recurrenceFrequency: 'WEEKLY',
  recurrenceInterval: 2,
  recurrenceByDay: 'TUESDAY',
  recurrenceEndType: 'NEVER'
}
```

### First Monday of Every Month

```typescript
{
  isRecurring: true,
  recurrenceRule: 'FREQ=MONTHLY;BYDAY=1MO',
  recurrenceFrequency: 'MONTHLY',
  recurrenceInterval: 1,
  monthDayType: 'RELATIVE_DAY',
  recurrenceBySetPos: 1,
  recurrenceByDayOfWeek: 'MONDAY',
  recurrenceEndType: 'NEVER'
}
```

### Last Friday of Every Month

```typescript
{
  isRecurring: true,
  recurrenceRule: 'FREQ=MONTHLY;BYDAY=-1FR',
  recurrenceFrequency: 'MONTHLY',
  recurrenceInterval: 1,
  monthDayType: 'RELATIVE_DAY',
  recurrenceBySetPos: -1,
  recurrenceByDayOfWeek: 'FRIDAY',
  recurrenceEndType: 'NEVER'
}
```

### 15th of Every Month

```typescript
{
  isRecurring: true,
  recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=15',
  recurrenceFrequency: 'MONTHLY',
  recurrenceInterval: 1,
  monthDayType: 'DAY_OF_MONTH',
  recurrenceByMonthDay: 15,
  recurrenceEndType: 'NEVER'
}
```

### End After 10 Occurrences

```typescript
{
  isRecurring: true,
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=10',
  recurrenceFrequency: 'WEEKLY',
  recurrenceInterval: 1,
  recurrenceByDay: 'MONDAY',
  recurrenceEndType: 'COUNT',
  recurrenceCount: 10
}
```

### End on Specific Date

```typescript
{
  isRecurring: true,
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20241231T235959Z',
  recurrenceFrequency: 'WEEKLY',
  recurrenceInterval: 1,
  recurrenceByDay: 'MONDAY',
  recurrenceEndType: 'DATE',
  recurrenceEndDate: new Date('2024-12-31T23:59:59Z')
}
```

### Quarterly (Every 3 Months)

```typescript
{
  isRecurring: true,
  recurrenceRule: 'FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1',
  recurrenceFrequency: 'MONTHLY',
  recurrenceInterval: 3,
  monthDayType: 'DAY_OF_MONTH',
  recurrenceByMonthDay: 1,
  recurrenceEndType: 'NEVER'
}
```

### Yearly on Specific Months

```typescript
{
  isRecurring: true,
  recurrenceRule: 'FREQ=YEARLY;BYMONTH=1,4,7,10;BYMONTHDAY=15',
  recurrenceFrequency: 'YEARLY',
  recurrenceInterval: 1,
  recurrenceByMonth: '1,4,7,10', // Jan, Apr, Jul, Oct
  recurrenceByMonthDay: 15,
  recurrenceEndType: 'NEVER'
}
```

---

## Data Validation

### Check Constraints

```sql
-- Day of month must be 1-31
CHECK (recurrence_by_month_day IS NULL
  OR (recurrence_by_month_day >= 1 AND recurrence_by_month_day <= 31))

-- Set position must be -5 to 5, excluding 0
CHECK (recurrence_by_set_pos IS NULL
  OR (recurrence_by_set_pos >= -5 AND recurrence_by_set_pos <= 5
      AND recurrence_by_set_pos != 0))

-- Minutes before must be non-negative
CHECK (minutes_before >= 0)
```

### Application-Level Validation

```typescript
// Validate email format
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate recurrence by day
function isValidRecurrenceByDay(days: string): boolean {
  const validDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY',
                     'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days.split(',').every(day => validDays.includes(day.trim()));
}

// Validate recurrence by month
function isValidRecurrenceByMonth(months: string): boolean {
  return months.split(',').every(m => {
    const month = parseInt(m.trim());
    return month >= 1 && month <= 12;
  });
}

// Validate reminder minutes
function isValidReminderMinutes(minutes: number): boolean {
  return minutes >= 0 && minutes <= 40320; // Max 4 weeks
}

// Example usage
if (!isValidEmail(attendeeEmail)) {
  throw new Error('Invalid email format');
}

if (recurrenceByDay && !isValidRecurrenceByDay(recurrenceByDay)) {
  throw new Error('Invalid days of week');
}
```

---

## Performance Tips

### 1. Use Indexes Effectively

```typescript
// ✅ GOOD: Uses index on (email, rsvp_status)
const events = await prisma.calendarEvent.findMany({
  where: {
    eventAttendees: {
      some: {
        email: 'user@example.com',
        rsvpStatus: 'ACCEPTED'
      }
    }
  }
});

// ❌ BAD: No index on description (full table scan)
const events = await prisma.calendarEvent.findMany({
  where: {
    description: { contains: 'meeting' }
  }
});
```

### 2. Limit Included Relations

```typescript
// ✅ GOOD: Only include what you need
const events = await prisma.calendarEvent.findMany({
  where: { calendarConnectionId },
  select: {
    id: true,
    title: true,
    startTime: true,
    endTime: true,
    eventAttendees: {
      select: {
        email: true,
        rsvpStatus: true
      }
    }
  }
});

// ❌ BAD: Includes all fields and relations
const events = await prisma.calendarEvent.findMany({
  where: { calendarConnectionId },
  include: {
    eventAttendees: true,
    eventReminders: true,
    calendarConnection: {
      include: {
        user: true
      }
    }
  }
});
```

### 3. Batch Operations

```typescript
// ✅ GOOD: Bulk create attendees
await prisma.eventAttendee.createMany({
  data: attendees.map(a => ({
    eventId,
    email: a.email,
    displayName: a.name,
    rsvpStatus: a.status
  }))
});

// ❌ BAD: Individual creates in loop
for (const attendee of attendees) {
  await prisma.eventAttendee.create({
    data: { eventId, ...attendee }
  });
}
```

### 4. Use Transactions for Related Updates

```typescript
// ✅ GOOD: Atomic transaction
await prisma.$transaction([
  prisma.calendarEvent.update({
    where: { id: eventId },
    data: { title: newTitle }
  }),
  prisma.eventAttendee.deleteMany({
    where: { eventId }
  }),
  prisma.eventAttendee.createMany({
    data: newAttendees
  })
]);

// ❌ BAD: Separate operations (not atomic)
await prisma.calendarEvent.update({ /* ... */ });
await prisma.eventAttendee.deleteMany({ /* ... */ });
await prisma.eventAttendee.createMany({ /* ... */ });
```

### 5. Cursor-Based Pagination

```typescript
// ✅ GOOD: Cursor pagination for large datasets
async function getEventsPaginated(cursor?: string, limit = 20) {
  return await prisma.calendarEvent.findMany({
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { startTime: 'asc' }
  });
}

// ❌ BAD: Offset pagination (slow for large offsets)
const events = await prisma.calendarEvent.findMany({
  skip: page * pageSize,
  take: pageSize
});
```

---

## Migration Commands

### Run Migration (Development)

```bash
cd /Users/natescherer/alon-cal/backend

# Create and apply migration
npx prisma migrate dev --name add_recurring_events_attendees_reminders

# Generate Prisma client
npx prisma generate

# Check migration status
npx prisma migrate status
```

### Deploy Migration (Production)

```bash
# Review migration SQL
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma

# Deploy to production
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

### Rollback Migration

```bash
# Connect to database
psql $DATABASE_URL

# Run rollback script
\i prisma/migrations/20251124_add_recurring_events_attendees_reminders/rollback.sql

# Mark as rolled back
npx prisma migrate resolve --rolled-back 20251124_add_recurring_events_attendees_reminders

# Regenerate client
npx prisma generate
```

### Inspect Database

```bash
# Open Prisma Studio (GUI)
npx prisma studio

# Or use psql
psql $DATABASE_URL

# Useful queries
\dt                          # List tables
\d calendar_events          # Describe table
\d+ event_attendees         # Describe with details
\di                          # List indexes
\di event_attendees*        # Indexes for specific table

# Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'event_attendees';
```

---

## Common Pitfalls & Solutions

### 1. Duplicate Attendees

```typescript
// ❌ PROBLEM: Trying to add duplicate attendee
await prisma.eventAttendee.create({
  data: {
    eventId,
    email: 'user@example.com',
    // ...
  }
});
// Error: Unique constraint violation

// ✅ SOLUTION: Use upsert
await prisma.eventAttendee.upsert({
  where: {
    eventId_email: {
      eventId,
      email: 'user@example.com'
    }
  },
  update: {
    rsvpStatus: 'ACCEPTED',
    responseTime: new Date()
  },
  create: {
    eventId,
    email: 'user@example.com',
    rsvpStatus: 'ACCEPTED'
  }
});
```

### 2. Cascading Deletes

```typescript
// ⚠️ WARNING: Deleting event deletes all attendees and reminders
await prisma.calendarEvent.delete({
  where: { id: eventId }
});
// This automatically deletes:
// - All event_attendees records
// - All event_reminders records
// - All child events (recurring instances)

// ✅ SOLUTION: Use soft delete if you need history
await prisma.calendarEvent.update({
  where: { id: eventId },
  data: {
    deletedAt: new Date(),
    syncStatus: 'DELETED'
  }
});
```

### 3. Backward Compatibility

```typescript
// ✅ GOOD: Check both sources
function getEventAttendees(event: CalendarEvent) {
  // New events use relational model
  if (event.eventAttendees && event.eventAttendees.length > 0) {
    return event.eventAttendees;
  }

  // Legacy events use JSONB
  if (event.attendees && Array.isArray(event.attendees)) {
    return parseJsonAttendees(event.attendees);
  }

  return [];
}

function parseJsonAttendees(jsonAttendees: any[]): EventAttendee[] {
  return jsonAttendees.map(a => ({
    email: a.email,
    displayName: a.name,
    rsvpStatus: mapRsvpStatus(a.responseStatus),
    isOrganizer: a.organizer || false,
    isOptional: a.optional || false
  }));
}
```

### 4. Date/Time Handling

```typescript
// ✅ GOOD: Always use UTC in database
const event = await prisma.calendarEvent.create({
  data: {
    startTime: new Date('2024-01-15T14:00:00Z'), // UTC
    endTime: new Date('2024-01-15T15:00:00Z'),   // UTC
    timezone: 'America/New_York' // Store timezone for display
  }
});

// Convert to user's timezone for display
import { formatInTimeZone } from 'date-fns-tz';
const displayTime = formatInTimeZone(
  event.startTime,
  event.timezone,
  'yyyy-MM-dd HH:mm:ss zzz'
);
```

---

## Testing Checklist

```typescript
// Test 1: Create weekly recurring event
test('creates weekly recurring event', async () => {
  const event = await createWeeklyRecurringEvent(connectionId);
  expect(event.isRecurring).toBe(true);
  expect(event.recurrenceFrequency).toBe('WEEKLY');
  expect(event.eventAttendees.length).toBeGreaterThan(0);
});

// Test 2: Update RSVP status
test('updates attendee RSVP status', async () => {
  await updateAttendeeRsvp(eventId, email, 'ACCEPTED');
  const attendee = await prisma.eventAttendee.findUnique({
    where: { eventId_email: { eventId, email } }
  });
  expect(attendee.rsvpStatus).toBe('ACCEPTED');
  expect(attendee.responseTime).not.toBeNull();
});

// Test 3: Query events by attendee
test('finds events by attendee email', async () => {
  const events = await getEventsForAttendee(email);
  expect(events.length).toBeGreaterThan(0);
  expect(events[0].eventAttendees.some(a => a.email === email)).toBe(true);
});

// Test 4: Cascade delete
test('deletes attendees when event is deleted', async () => {
  await prisma.calendarEvent.delete({ where: { id: eventId } });
  const attendees = await prisma.eventAttendee.findMany({
    where: { eventId }
  });
  expect(attendees.length).toBe(0);
});

// Test 5: Unique constraint
test('prevents duplicate attendees', async () => {
  await prisma.eventAttendee.create({
    data: { eventId, email, displayName: 'Test' }
  });

  await expect(
    prisma.eventAttendee.create({
      data: { eventId, email, displayName: 'Duplicate' }
    })
  ).rejects.toThrow(/Unique constraint/);
});
```

---

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [RFC 5545 - iCalendar](https://tools.ietf.org/html/rfc5545)
- [Google Calendar API](https://developers.google.com/calendar/api/v3/reference/events)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Migration README](./README.md)
- [Schema Diagram](./SCHEMA_DIAGRAM.md)
- [Code Examples](./examples.ts)
