/**
 * Event-related type definitions
 */

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RecurrenceEndType = 'NEVER' | 'DATE' | 'COUNT';
export type MonthDayType = 'DAY_OF_MONTH' | 'RELATIVE_DAY';
export type ReminderMethod = 'EMAIL' | 'POPUP' | 'SMS';
export type EventSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  interval?: number;
  byDay?: string[]; // ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
  monthDayType?: MonthDayType;
  byMonthDay?: number; // 1-31
  bySetPos?: number; // -1, 1, 2, 3, 4 (first, second, third, fourth, last)
  byDayOfWeek?: string; // 'MO', 'TU', etc.
  byMonth?: number[]; // [1-12]
  endType: RecurrenceEndType;
  endDate?: string; // ISO 8601
  count?: number;
  exceptionDates?: string[]; // ISO 8601 dates to skip
}

export interface AttendeeInput {
  email: string;
  isOrganizer?: boolean;
  isOptional?: boolean;
}

export interface ReminderInput {
  method: ReminderMethod;
  minutesBefore: number;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  location?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  isAllDay?: boolean;
  timezone?: string;
  calendarConnectionId: string;
  recurrence?: RecurrenceInput;
  attendees?: AttendeeInput[];
  reminders?: ReminderInput[];
}

export interface CreateEventResponse {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  syncStatus: EventSyncStatus;
  googleEventId?: string;
  microsoftEventId?: string;
  appleEventId?: string;
  message: string;
}

export interface EventFormData {
  title: string;
  description: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endDate: string; // YYYY-MM-DD
  endTime: string; // HH:MM
  isAllDay: boolean;
  timezone: string;
  calendarConnectionId: string;
  recurrence: RecurrenceInput | null;
  attendees: AttendeeInput[];
  reminders: ReminderInput[];
}

export interface EventFormErrors {
  title?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  calendarConnectionId?: string;
  attendees?: string;
  general?: string;
}
