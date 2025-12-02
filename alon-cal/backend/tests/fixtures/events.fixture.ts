/**
 * Calendar Event Test Fixtures
 *
 * Sample event data for testing
 */

import { CalendarEvent, EventStatus, SyncStatus, RecurrenceFrequency } from '@prisma/client';

const baseEvent = {
  id: 'evt-123e4567-e89b-12d3-a456-426614174000',
  calendarConnectionId: 'cal-123e4567-e89b-12d3-a456-426614174000',
  providerEventId: 'google_event_123',
  title: 'Team Meeting',
  description: 'Weekly team sync meeting',
  location: 'Conference Room A',
  startTime: new Date('2024-02-01T10:00:00Z'),
  endTime: new Date('2024-02-01T11:00:00Z'),
  isAllDay: false,
  timezone: 'America/New_York',
  status: EventStatus.CONFIRMED,
  syncStatus: SyncStatus.SYNCED,
  isRecurring: false,
  recurrenceRule: null,
  recurrenceFrequency: null,
  recurrenceInterval: null,
  recurrenceEndDate: null,
  recurrenceCount: null,
  parentEventId: null,
  attendees: [
    {
      email: 'attendee1@example.com',
      name: 'John Doe',
      responseStatus: 'accepted',
      organizer: false,
    },
    {
      email: 'attendee2@example.com',
      name: 'Jane Smith',
      responseStatus: 'tentative',
      organizer: false,
    },
  ],
  reminders: [
    { method: 'popup', minutes: 10 },
    { method: 'email', minutes: 30 },
  ],
  providerMetadata: {
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
    creator: { email: 'creator@example.com' },
  },
  htmlLink: 'https://calendar.google.com/event?eid=abc123',
  lastSyncedAt: new Date('2024-01-01T00:00:00Z'),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  deletedAt: null,
};

export const mockEvent: CalendarEvent = baseEvent as CalendarEvent;

export const mockAllDayEvent: CalendarEvent = {
  ...baseEvent,
  id: 'evt-223e4567-e89b-12d3-a456-426614174000',
  providerEventId: 'google_event_allday',
  title: 'All Day Conference',
  startTime: new Date('2024-02-05T00:00:00Z'),
  endTime: new Date('2024-02-05T23:59:59Z'),
  isAllDay: true,
  location: 'Virtual',
} as CalendarEvent;

export const mockRecurringEvent: CalendarEvent = {
  ...baseEvent,
  id: 'evt-323e4567-e89b-12d3-a456-426614174000',
  providerEventId: 'google_event_recurring',
  title: 'Weekly Standup',
  isRecurring: true,
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  recurrenceFrequency: RecurrenceFrequency.WEEKLY,
  recurrenceInterval: 1,
  recurrenceEndDate: new Date('2024-12-31T00:00:00Z'),
  recurrenceCount: null,
} as CalendarEvent;

export const mockCancelledEvent: CalendarEvent = {
  ...baseEvent,
  id: 'evt-423e4567-e89b-12d3-a456-426614174000',
  providerEventId: 'google_event_cancelled',
  title: 'Cancelled Meeting',
  status: EventStatus.CANCELLED,
  syncStatus: SyncStatus.DELETED,
  deletedAt: new Date('2024-01-10T00:00:00Z'),
} as CalendarEvent;

export const mockTentativeEvent: CalendarEvent = {
  ...baseEvent,
  id: 'evt-523e4567-e89b-12d3-a456-426614174000',
  providerEventId: 'google_event_tentative',
  title: 'Tentative Meeting',
  status: EventStatus.TENTATIVE,
} as CalendarEvent;

// Events spanning multiple days
export const mockMultiDayEvent: CalendarEvent = {
  ...baseEvent,
  id: 'evt-623e4567-e89b-12d3-a456-426614174000',
  providerEventId: 'google_event_multiday',
  title: 'Company Retreat',
  startTime: new Date('2024-03-15T00:00:00Z'),
  endTime: new Date('2024-03-17T23:59:59Z'),
  isAllDay: true,
  location: 'Mountain Resort',
} as CalendarEvent;

export const mockEvents = {
  regular: mockEvent,
  allDay: mockAllDayEvent,
  recurring: mockRecurringEvent,
  cancelled: mockCancelledEvent,
  tentative: mockTentativeEvent,
  multiDay: mockMultiDayEvent,
};

// Generate array of mock events for bulk testing
export function generateMockEvents(count: number, connectionId: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const startTime = new Date(now.getTime() + i * 24 * 60 * 60 * 1000); // Each day
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    events.push({
      ...baseEvent,
      id: `evt-${i.toString().padStart(36, '0')}`,
      calendarConnectionId: connectionId,
      providerEventId: `event_${i}`,
      title: `Event ${i}`,
      startTime,
      endTime,
    } as CalendarEvent);
  }

  return events;
}
