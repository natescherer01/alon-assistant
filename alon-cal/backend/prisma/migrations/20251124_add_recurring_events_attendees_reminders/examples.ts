/**
 * Example Usage: Enhanced Recurring Events, Attendees, and Reminders
 *
 * This file demonstrates how to use the new schema features with Prisma Client.
 * These examples can be integrated into your service layer.
 */

import { PrismaClient, RecurrenceFrequency, RecurrenceEndType, MonthDayType, DayOfWeek, RsvpStatus, ReminderMethod } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// 1. CREATE EVENT WITH WEEKLY RECURRENCE
// ============================================================================

/**
 * Create a weekly recurring event on Monday, Wednesday, Friday
 * Ends after 20 occurrences
 */
async function createWeeklyRecurringEvent(calendarConnectionId: string) {
  const event = await prisma.calendarEvent.create({
    data: {
      calendarConnectionId,
      providerEventId: 'weekly-meeting-001',
      title: 'Team Stand-up',
      description: 'Daily team sync (MWF)',
      startTime: new Date('2024-01-08T09:00:00Z'), // Monday
      endTime: new Date('2024-01-08T09:30:00Z'),
      timezone: 'America/New_York',

      // Weekly recurrence configuration
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20',
      recurrenceFrequency: RecurrenceFrequency.WEEKLY,
      recurrenceInterval: 1,
      recurrenceByDay: 'MONDAY,WEDNESDAY,FRIDAY', // Comma-separated
      recurrenceEndType: RecurrenceEndType.COUNT,
      recurrenceCount: 20,

      // Create attendees
      eventAttendees: {
        create: [
          {
            email: 'john@example.com',
            displayName: 'John Doe',
            isOrganizer: true,
            rsvpStatus: RsvpStatus.ACCEPTED,
          },
          {
            email: 'jane@example.com',
            displayName: 'Jane Smith',
            rsvpStatus: RsvpStatus.NEEDS_ACTION,
          },
          {
            email: 'bob@example.com',
            displayName: 'Bob Johnson',
            isOptional: true,
            rsvpStatus: RsvpStatus.NEEDS_ACTION,
          },
        ],
      },

      // Create reminders
      eventReminders: {
        create: [
          {
            method: ReminderMethod.POPUP,
            minutesBefore: 30, // 30 minutes before (Google Calendar default)
          },
          {
            method: ReminderMethod.EMAIL,
            minutesBefore: 1440, // 1 day before
          },
        ],
      },
    },
    include: {
      eventAttendees: true,
      eventReminders: true,
    },
  });

  console.log('Created weekly recurring event:', event.id);
  return event;
}

// ============================================================================
// 2. CREATE EVENT WITH MONTHLY RECURRENCE (FIRST MONDAY)
// ============================================================================

/**
 * Create a monthly recurring event on the first Monday of each month
 * Ends on a specific date
 */
async function createMonthlyRecurringEventRelative(calendarConnectionId: string) {
  const event = await prisma.calendarEvent.create({
    data: {
      calendarConnectionId,
      providerEventId: 'monthly-meeting-001',
      title: 'Monthly Review',
      description: 'First Monday of every month',
      startTime: new Date('2024-01-01T14:00:00Z'), // First Monday
      endTime: new Date('2024-01-01T15:00:00Z'),
      timezone: 'UTC',

      // Monthly recurrence (first Monday)
      isRecurring: true,
      recurrenceRule: 'FREQ=MONTHLY;BYDAY=1MO;UNTIL=20241231T235959Z',
      recurrenceFrequency: RecurrenceFrequency.MONTHLY,
      recurrenceInterval: 1,
      monthDayType: MonthDayType.RELATIVE_DAY, // Relative day pattern
      recurrenceBySetPos: 1, // First occurrence
      recurrenceByDayOfWeek: DayOfWeek.MONDAY,
      recurrenceEndType: RecurrenceEndType.DATE,
      recurrenceEndDate: new Date('2024-12-31T23:59:59Z'),

      // Attendees
      eventAttendees: {
        create: [
          {
            email: 'manager@example.com',
            displayName: 'Sarah Manager',
            isOrganizer: true,
            rsvpStatus: RsvpStatus.ACCEPTED,
          },
        ],
      },

      // Single reminder
      eventReminders: {
        create: {
          method: ReminderMethod.EMAIL,
          minutesBefore: 60, // 1 hour before
        },
      },
    },
    include: {
      eventAttendees: true,
      eventReminders: true,
    },
  });

  console.log('Created monthly recurring event (first Monday):', event.id);
  return event;
}

// ============================================================================
// 3. CREATE EVENT WITH MONTHLY RECURRENCE (15TH OF MONTH)
// ============================================================================

/**
 * Create a monthly recurring event on the 15th of each month
 * Never ends
 */
async function createMonthlyRecurringEventDayOfMonth(calendarConnectionId: string) {
  const event = await prisma.calendarEvent.create({
    data: {
      calendarConnectionId,
      providerEventId: 'monthly-payment-001',
      title: 'Monthly Payment Reminder',
      description: 'Payment due on the 15th',
      startTime: new Date('2024-01-15T12:00:00Z'),
      endTime: new Date('2024-01-15T12:30:00Z'),
      timezone: 'UTC',

      // Monthly recurrence (15th of month)
      isRecurring: true,
      recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=15',
      recurrenceFrequency: RecurrenceFrequency.MONTHLY,
      recurrenceInterval: 1,
      monthDayType: MonthDayType.DAY_OF_MONTH, // Specific day pattern
      recurrenceByMonthDay: 15,
      recurrenceEndType: RecurrenceEndType.NEVER, // Never ends

      // Reminder 3 days before
      eventReminders: {
        create: {
          method: ReminderMethod.EMAIL,
          minutesBefore: 4320, // 3 days = 72 hours = 4320 minutes
        },
      },
    },
    include: {
      eventReminders: true,
    },
  });

  console.log('Created monthly recurring event (15th of month):', event.id);
  return event;
}

// ============================================================================
// 4. CREATE EVENT WITH YEARLY RECURRENCE
// ============================================================================

/**
 * Create a yearly recurring event on specific months
 * (e.g., Quarterly business reviews in Jan, Apr, Jul, Oct)
 */
async function createYearlyRecurringEvent(calendarConnectionId: string) {
  const event = await prisma.calendarEvent.create({
    data: {
      calendarConnectionId,
      providerEventId: 'quarterly-review-001',
      title: 'Quarterly Business Review',
      description: 'Q1, Q2, Q3, Q4 Reviews',
      startTime: new Date('2024-01-15T10:00:00Z'),
      endTime: new Date('2024-01-15T12:00:00Z'),
      timezone: 'America/New_York',

      // Yearly recurrence on specific months
      isRecurring: true,
      recurrenceRule: 'FREQ=YEARLY;BYMONTH=1,4,7,10;BYMONTHDAY=15',
      recurrenceFrequency: RecurrenceFrequency.YEARLY,
      recurrenceInterval: 1,
      recurrenceByMonth: '1,4,7,10', // Jan, Apr, Jul, Oct
      recurrenceByMonthDay: 15,
      recurrenceEndType: RecurrenceEndType.NEVER,

      // Multiple attendees
      eventAttendees: {
        create: [
          {
            email: 'ceo@example.com',
            displayName: 'CEO',
            isOrganizer: true,
            rsvpStatus: RsvpStatus.ACCEPTED,
          },
          {
            email: 'cfo@example.com',
            displayName: 'CFO',
            rsvpStatus: RsvpStatus.ACCEPTED,
          },
          {
            email: 'cto@example.com',
            displayName: 'CTO',
            rsvpStatus: RsvpStatus.ACCEPTED,
          },
        ],
      },

      // Multiple reminders
      eventReminders: {
        create: [
          {
            method: ReminderMethod.EMAIL,
            minutesBefore: 10080, // 1 week before
          },
          {
            method: ReminderMethod.EMAIL,
            minutesBefore: 1440, // 1 day before
          },
          {
            method: ReminderMethod.POPUP,
            minutesBefore: 30, // 30 minutes before
          },
        ],
      },
    },
    include: {
      eventAttendees: true,
      eventReminders: true,
    },
  });

  console.log('Created yearly recurring event:', event.id);
  return event;
}

// ============================================================================
// 5. UPDATE ATTENDEE RSVP STATUS
// ============================================================================

/**
 * Update an attendee's RSVP status (accept/decline invitation)
 */
async function updateAttendeeRsvp(eventId: string, email: string, newStatus: RsvpStatus) {
  const attendee = await prisma.eventAttendee.updateMany({
    where: {
      eventId,
      email,
    },
    data: {
      rsvpStatus: newStatus,
      responseTime: new Date(),
    },
  });

  console.log(`Updated RSVP for ${email} to ${newStatus}`);
  return attendee;
}

// ============================================================================
// 6. QUERY EVENTS BY ATTENDEE
// ============================================================================

/**
 * Find all upcoming events for a specific attendee
 */
async function getEventsForAttendee(email: string) {
  const events = await prisma.calendarEvent.findMany({
    where: {
      eventAttendees: {
        some: {
          email,
        },
      },
      startTime: {
        gte: new Date(), // Upcoming events only
      },
      deletedAt: null, // Not deleted
    },
    include: {
      eventAttendees: {
        where: {
          email, // Include this attendee's RSVP status
        },
      },
      eventReminders: true,
      calendarConnection: {
        select: {
          calendarName: true,
          provider: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  console.log(`Found ${events.length} upcoming events for ${email}`);
  return events;
}

// ============================================================================
// 7. QUERY EVENTS BY RSVP STATUS
// ============================================================================

/**
 * Find all events where attendee has not responded
 */
async function getPendingRsvpEvents(email: string) {
  const events = await prisma.calendarEvent.findMany({
    where: {
      eventAttendees: {
        some: {
          email,
          rsvpStatus: RsvpStatus.NEEDS_ACTION,
        },
      },
      startTime: {
        gte: new Date(),
      },
      deletedAt: null,
    },
    include: {
      eventAttendees: true,
      calendarConnection: {
        select: {
          calendarName: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  console.log(`Found ${events.length} events pending RSVP for ${email}`);
  return events;
}

// ============================================================================
// 8. QUERY RECURRING EVENTS
// ============================================================================

/**
 * Find all weekly recurring events that end by a specific date
 */
async function getWeeklyRecurringEvents(calendarConnectionId: string, endBefore: Date) {
  const events = await prisma.calendarEvent.findMany({
    where: {
      calendarConnectionId,
      isRecurring: true,
      recurrenceFrequency: RecurrenceFrequency.WEEKLY,
      recurrenceEndType: RecurrenceEndType.DATE,
      recurrenceEndDate: {
        lte: endBefore,
      },
      deletedAt: null,
    },
    include: {
      eventAttendees: true,
      eventReminders: true,
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  console.log(`Found ${events.length} weekly recurring events`);
  return events;
}

// ============================================================================
// 9. ADD EXCEPTION DATE TO RECURRING EVENT
// ============================================================================

/**
 * Add exception dates to a recurring event (skip specific occurrences)
 */
async function addExceptionDates(eventId: string, datesToExclude: Date[]) {
  // Convert dates to ISO strings and join with commas
  const isoDateStrings = datesToExclude.map(d => d.toISOString().split('T')[0]);

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: { exceptionDates: true },
  });

  const existingDates = event?.exceptionDates ? event.exceptionDates.split(',') : [];
  const allDates = [...new Set([...existingDates, ...isoDateStrings])]; // Remove duplicates

  const updated = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      exceptionDates: allDates.join(','),
    },
  });

  console.log(`Added exception dates to event ${eventId}`);
  return updated;
}

// ============================================================================
// 10. GET EVENTS WITH REMINDERS DUE SOON
// ============================================================================

/**
 * Find events with reminders due in the next hour (for reminder scheduler)
 */
async function getEventsWithUpcomingReminders() {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  const events = await prisma.calendarEvent.findMany({
    where: {
      startTime: {
        gte: now,
        lte: oneHourFromNow,
      },
      deletedAt: null,
    },
    include: {
      eventReminders: {
        where: {
          minutesBefore: {
            gte: 0,
            lte: 60, // Reminders in next hour
          },
        },
      },
      eventAttendees: {
        where: {
          rsvpStatus: {
            in: [RsvpStatus.ACCEPTED, RsvpStatus.TENTATIVE, RsvpStatus.NEEDS_ACTION],
          },
        },
      },
      calendarConnection: {
        select: {
          userId: true,
        },
      },
    },
  });

  console.log(`Found ${events.length} events with upcoming reminders`);
  return events;
}

// ============================================================================
// 11. BACKWARD COMPATIBILITY - READ JSONB ATTENDEES
// ============================================================================

/**
 * Read attendees from both relational model and legacy JSONB field
 * This ensures backward compatibility with existing events
 */
async function getEventAttendeesCompat(eventId: string) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      eventAttendees: true,
    },
  });

  if (!event) return [];

  // If relational attendees exist, use them
  if (event.eventAttendees.length > 0) {
    return event.eventAttendees;
  }

  // Otherwise, parse JSONB attendees (legacy)
  if (event.attendees && Array.isArray(event.attendees)) {
    return (event.attendees as any[]).map((a: any) => ({
      email: a.email,
      displayName: a.name,
      rsvpStatus: mapLegacyRsvpStatus(a.responseStatus),
      isOrganizer: a.organizer || false,
      isOptional: a.optional || false,
    }));
  }

  return [];
}

function mapLegacyRsvpStatus(status?: string): RsvpStatus {
  switch (status) {
    case 'needsAction': return RsvpStatus.NEEDS_ACTION;
    case 'accepted': return RsvpStatus.ACCEPTED;
    case 'declined': return RsvpStatus.DECLINED;
    case 'tentative': return RsvpStatus.TENTATIVE;
    default: return RsvpStatus.NEEDS_ACTION;
  }
}

// ============================================================================
// 12. HELPER FUNCTION - PARSE RRULE TO SCHEMA FIELDS
// ============================================================================

/**
 * Parse a Google Calendar RRULE string into database fields
 * Example RRULE: "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20"
 */
interface RecurrenceData {
  isRecurring: boolean;
  recurrenceRule: string;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceInterval?: number;
  recurrenceByDay?: string;
  monthDayType?: MonthDayType;
  recurrenceByMonthDay?: number;
  recurrenceBySetPos?: number;
  recurrenceByDayOfWeek?: DayOfWeek;
  recurrenceByMonth?: string;
  recurrenceEndType: RecurrenceEndType;
  recurrenceEndDate?: Date;
  recurrenceCount?: number;
}

function parseRRule(rrule: string): RecurrenceData {
  const parts = rrule.split(';').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const data: RecurrenceData = {
    isRecurring: true,
    recurrenceRule: rrule,
    recurrenceFrequency: parts.FREQ as RecurrenceFrequency,
    recurrenceInterval: parts.INTERVAL ? parseInt(parts.INTERVAL) : 1,
    recurrenceEndType: RecurrenceEndType.NEVER,
  };

  // End conditions
  if (parts.COUNT) {
    data.recurrenceEndType = RecurrenceEndType.COUNT;
    data.recurrenceCount = parseInt(parts.COUNT);
  } else if (parts.UNTIL) {
    data.recurrenceEndType = RecurrenceEndType.DATE;
    data.recurrenceEndDate = new Date(parts.UNTIL);
  }

  // Weekly: BYDAY
  if (parts.BYDAY && data.recurrenceFrequency === RecurrenceFrequency.WEEKLY) {
    const days = parts.BYDAY.split(',').map(d => {
      const dayMap: Record<string, string> = {
        'SU': 'SUNDAY', 'MO': 'MONDAY', 'TU': 'TUESDAY', 'WE': 'WEDNESDAY',
        'TH': 'THURSDAY', 'FR': 'FRIDAY', 'SA': 'SATURDAY',
      };
      return dayMap[d];
    });
    data.recurrenceByDay = days.join(',');
  }

  // Monthly: BYMONTHDAY (specific day)
  if (parts.BYMONTHDAY) {
    data.monthDayType = MonthDayType.DAY_OF_MONTH;
    data.recurrenceByMonthDay = parseInt(parts.BYMONTHDAY);
  }

  // Monthly: BYDAY with position (relative day)
  if (parts.BYDAY && data.recurrenceFrequency === RecurrenceFrequency.MONTHLY) {
    const match = parts.BYDAY.match(/^(-?\d+)?([A-Z]{2})$/);
    if (match) {
      data.monthDayType = MonthDayType.RELATIVE_DAY;
      data.recurrenceBySetPos = match[1] ? parseInt(match[1]) : 1;
      const dayMap: Record<string, DayOfWeek> = {
        'SU': DayOfWeek.SUNDAY, 'MO': DayOfWeek.MONDAY, 'TU': DayOfWeek.TUESDAY,
        'WE': DayOfWeek.WEDNESDAY, 'TH': DayOfWeek.THURSDAY,
        'FR': DayOfWeek.FRIDAY, 'SA': DayOfWeek.SATURDAY,
      };
      data.recurrenceByDayOfWeek = dayMap[match[2]];
    }
  }

  // Yearly: BYMONTH
  if (parts.BYMONTH) {
    data.recurrenceByMonth = parts.BYMONTH;
  }

  return data;
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

async function main() {
  // Get a calendar connection (replace with actual ID)
  const connection = await prisma.calendarConnection.findFirst();
  if (!connection) {
    console.log('No calendar connection found');
    return;
  }

  // Create various recurring events
  await createWeeklyRecurringEvent(connection.id);
  await createMonthlyRecurringEventRelative(connection.id);
  await createMonthlyRecurringEventDayOfMonth(connection.id);
  await createYearlyRecurringEvent(connection.id);

  // Query events
  await getEventsForAttendee('john@example.com');
  await getPendingRsvpEvents('jane@example.com');
  await getWeeklyRecurringEvents(connection.id, new Date('2024-12-31'));

  // Update RSVP
  const event = await prisma.calendarEvent.findFirst();
  if (event) {
    await updateAttendeeRsvp(event.id, 'jane@example.com', RsvpStatus.ACCEPTED);
  }
}

// Uncomment to run examples
// main()
//   .catch(console.error)
//   .finally(() => prisma.$disconnect());

export {
  createWeeklyRecurringEvent,
  createMonthlyRecurringEventRelative,
  createMonthlyRecurringEventDayOfMonth,
  createYearlyRecurringEvent,
  updateAttendeeRsvp,
  getEventsForAttendee,
  getPendingRsvpEvents,
  getWeeklyRecurringEvents,
  addExceptionDates,
  getEventsWithUpcomingReminders,
  getEventAttendeesCompat,
  parseRRule,
};
