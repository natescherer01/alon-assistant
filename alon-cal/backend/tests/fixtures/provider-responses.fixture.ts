/**
 * Provider API Response Fixtures
 *
 * Mock responses from Google, Microsoft, and Apple APIs
 */

import { calendar_v3 } from 'googleapis';

// Google Calendar API Responses
export const mockGoogleCalendars = [
  {
    id: 'primary',
    summary: 'Test User Calendar',
    description: 'Primary calendar',
    timeZone: 'America/New_York',
    backgroundColor: '#1F77B4',
    primary: true,
  },
  {
    id: 'work@example.com',
    summary: 'Work Calendar',
    description: 'Work events',
    timeZone: 'America/New_York',
    backgroundColor: '#FF5722',
    primary: false,
  },
  {
    id: 'personal@example.com',
    summary: 'Personal Calendar',
    timeZone: 'America/Los_Angeles',
    backgroundColor: '#4CAF50',
    primary: false,
  },
];

export const mockGoogleEvent: calendar_v3.Schema$Event = {
  id: 'google_event_123',
  status: 'confirmed',
  htmlLink: 'https://calendar.google.com/event?eid=abc123',
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z',
  summary: 'Team Meeting',
  description: 'Weekly team sync meeting',
  location: 'Conference Room A',
  creator: {
    email: 'creator@example.com',
    displayName: 'Creator',
  },
  organizer: {
    email: 'organizer@example.com',
    displayName: 'Organizer',
  },
  start: {
    dateTime: '2024-02-01T10:00:00-05:00',
    timeZone: 'America/New_York',
  },
  end: {
    dateTime: '2024-02-01T11:00:00-05:00',
    timeZone: 'America/New_York',
  },
  attendees: [
    {
      email: 'attendee1@example.com',
      displayName: 'John Doe',
      responseStatus: 'accepted',
      organizer: false,
    },
  ],
  reminders: {
    useDefault: false,
    overrides: [
      { method: 'popup', minutes: 10 },
      { method: 'email', minutes: 30 },
    ],
  },
};

export const mockGoogleRecurringEvent: calendar_v3.Schema$Event = {
  ...mockGoogleEvent,
  id: 'google_event_recurring',
  summary: 'Weekly Standup',
  recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'],
};

export const mockGoogleCancelledEvent: calendar_v3.Schema$Event = {
  ...mockGoogleEvent,
  id: 'google_event_cancelled',
  status: 'cancelled',
  summary: 'Cancelled Meeting',
};

export const mockGoogleAllDayEvent: calendar_v3.Schema$Event = {
  ...mockGoogleEvent,
  id: 'google_event_allday',
  summary: 'All Day Conference',
  start: {
    date: '2024-02-05',
  },
  end: {
    date: '2024-02-05',
  },
};

export const mockGoogleEventsListResponse = {
  items: [mockGoogleEvent, mockGoogleRecurringEvent, mockGoogleAllDayEvent],
  nextPageToken: undefined,
  nextSyncToken: 'sync_token_new_123',
};

// Microsoft Calendar API Responses
export const mockMicrosoftCalendars = [
  {
    id: 'AAMkAGI2TGTG',
    name: 'Calendar',
    color: 'auto',
    isDefaultCalendar: true,
    canEdit: true,
    owner: {
      name: 'Test User',
      address: 'test@example.com',
    },
  },
  {
    id: 'AAMkAGI2WORK',
    name: 'Work',
    color: 'lightBlue',
    isDefaultCalendar: false,
    canEdit: true,
    owner: {
      name: 'Test User',
      address: 'test@example.com',
    },
  },
];

export const mockMicrosoftEvent = {
  id: 'microsoft_event_123',
  subject: 'Team Meeting',
  bodyPreview: 'Weekly team sync meeting',
  start: {
    dateTime: '2024-02-01T10:00:00',
    timeZone: 'Eastern Standard Time',
  },
  end: {
    dateTime: '2024-02-01T11:00:00',
    timeZone: 'Eastern Standard Time',
  },
  location: {
    displayName: 'Conference Room A',
  },
  isAllDay: false,
  isCancelled: false,
  organizer: {
    emailAddress: {
      name: 'Organizer',
      address: 'organizer@example.com',
    },
  },
  attendees: [
    {
      emailAddress: {
        name: 'John Doe',
        address: 'attendee1@example.com',
      },
      status: {
        response: 'accepted',
      },
      type: 'required',
    },
  ],
  webLink: 'https://outlook.office.com/calendar/event',
  originalStartTimeZone: 'Eastern Standard Time',
  lastModifiedDateTime: '2024-01-01T00:00:00Z',
};

export const mockMicrosoftRecurringEvent = {
  ...mockMicrosoftEvent,
  id: 'microsoft_event_recurring',
  subject: 'Weekly Standup',
  recurrence: {
    pattern: {
      type: 'weekly',
      interval: 1,
      daysOfWeek: ['monday', 'wednesday', 'friday'],
    },
    range: {
      type: 'endDate',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    },
  },
};

export const mockMicrosoftEventsResponse = {
  value: [mockMicrosoftEvent, mockMicrosoftRecurringEvent],
  '@odata.nextLink': undefined,
  '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/calendars/events/delta?$deltatoken=abc123',
};

// Apple Calendar API Responses (CalDAV stub)
export const mockAppleCalendars = [
  {
    id: 'primary',
    name: 'iCloud Calendar',
    description: 'Default iCloud calendar',
    color: '#FF9500',
    isPrimary: true,
  },
];

// OAuth Token Responses
export const mockGoogleTokens = {
  access_token: 'google_access_token_123',
  refresh_token: 'google_refresh_token_123',
  expiry_date: Date.now() + 3600 * 1000, // 1 hour from now
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
  token_type: 'Bearer',
};

export const mockMicrosoftTokens = {
  accessToken: 'microsoft_access_token_123',
  refreshToken: 'microsoft_refresh_token_123',
  expiresOn: new Date(Date.now() + 3600 * 1000),
  tokenType: 'Bearer',
  account: {
    username: 'test@example.com',
  },
};

export const mockAppleTokens = {
  access_token: 'apple_access_token_123',
  refresh_token: 'apple_refresh_token_123',
  expires_in: 3600,
  token_type: 'Bearer',
  id_token: 'apple_id_token_123',
};
