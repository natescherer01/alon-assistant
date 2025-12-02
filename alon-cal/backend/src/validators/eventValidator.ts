/**
 * Event Validator
 *
 * Zod schemas for event creation and management
 * Validates all event fields, recurrence rules, attendees, and reminders
 */

import { z } from 'zod';
import { validateEmail } from '../utils/validation';

/**
 * Day of week enum for recurrence
 */
const DayOfWeekEnum = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

/**
 * Recurrence frequency enum
 */
const RecurrenceFrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

/**
 * Recurrence end type enum
 */
const RecurrenceEndTypeEnum = z.enum(['NEVER', 'DATE', 'COUNT']);

/**
 * Month day type enum for monthly recurrence
 */
const MonthDayTypeEnum = z.enum(['DAY_OF_MONTH', 'RELATIVE_DAY']);

/**
 * Reminder method enum
 */
const ReminderMethodEnum = z.enum(['EMAIL', 'POPUP', 'SMS']);

/**
 * Recurrence schema
 */
export const RecurrenceSchema = z
  .object({
    frequency: RecurrenceFrequencyEnum,
    interval: z.number().int().min(1).max(999).optional().default(1),
    byDay: z.array(DayOfWeekEnum).optional(),
    monthDayType: MonthDayTypeEnum.optional(),
    byMonthDay: z.number().int().min(1).max(31).optional(),
    bySetPos: z.number().int().min(-4).max(4).optional(),
    byDayOfWeek: DayOfWeekEnum.optional(),
    byMonth: z.array(z.number().int().min(1).max(12)).optional(),
    endType: RecurrenceEndTypeEnum,
    endDate: z.string().datetime().optional(),
    count: z.number().int().min(1).max(999).optional(),
    exceptionDates: z.array(z.string().datetime()).optional(),
  })
  .refine(
    (data) => {
      // If endType is DATE, endDate is required
      if (data.endType === 'DATE') {
        return !!data.endDate;
      }
      return true;
    },
    {
      message: 'endDate is required when endType is DATE',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      // If endType is COUNT, count is required
      if (data.endType === 'COUNT') {
        return !!data.count;
      }
      return true;
    },
    {
      message: 'count is required when endType is COUNT',
      path: ['count'],
    }
  )
  .refine(
    (data) => {
      // If frequency is WEEKLY, byDay should be provided
      if (data.frequency === 'WEEKLY' && (!data.byDay || data.byDay.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'byDay is required for WEEKLY recurrence',
      path: ['byDay'],
    }
  )
  .refine(
    (data) => {
      // If frequency is MONTHLY and monthDayType is RELATIVE_DAY, bySetPos and byDayOfWeek are required
      if (data.frequency === 'MONTHLY' && data.monthDayType === 'RELATIVE_DAY') {
        return !!data.bySetPos && !!data.byDayOfWeek;
      }
      return true;
    },
    {
      message: 'bySetPos and byDayOfWeek are required for RELATIVE_DAY monthly recurrence',
      path: ['bySetPos'],
    }
  )
  .refine(
    (data) => {
      // If frequency is MONTHLY and monthDayType is DAY_OF_MONTH, byMonthDay is required
      if (data.frequency === 'MONTHLY' && data.monthDayType === 'DAY_OF_MONTH') {
        return !!data.byMonthDay;
      }
      return true;
    },
    {
      message: 'byMonthDay is required for DAY_OF_MONTH monthly recurrence',
      path: ['byMonthDay'],
    }
  );

/**
 * Attendee schema
 */
export const AttendeeSchema = z.object({
  email: z
    .string()
    .email()
    .refine((email) => validateEmail(email), {
      message: 'Invalid email address format',
    }),
  isOrganizer: z.boolean().optional().default(false),
  isOptional: z.boolean().optional().default(false),
});

/**
 * Reminder schema
 */
export const ReminderSchema = z.object({
  method: ReminderMethodEnum,
  minutesBefore: z.number().int().min(0).max(40320), // Max 4 weeks (40320 minutes)
});

/**
 * Create event request schema
 */
export const CreateEventSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(500, 'Title must not exceed 500 characters'),
    description: z.string().max(2000, 'Description must not exceed 2000 characters').optional(),
    location: z.string().max(500, 'Location must not exceed 500 characters').optional(),
    startTime: z.string().datetime('Invalid start time format. Use ISO 8601 format'),
    endTime: z.string().datetime('Invalid end time format. Use ISO 8601 format'),
    isAllDay: z.boolean().optional().default(false),
    timezone: z.string().optional().default('UTC'),
    calendarConnectionId: z.string().uuid('Invalid calendar connection ID'),

    // Recurrence
    recurrence: RecurrenceSchema.optional(),

    // Attendees
    attendees: z
      .array(AttendeeSchema)
      .max(100, 'Maximum 100 attendees allowed')
      .optional()
      .default([]),

    // Reminders
    reminders: z.array(ReminderSchema).max(10, 'Maximum 10 reminders allowed').optional(),
  })
  .refine(
    (data) => {
      // End time must be after start time
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return end > start;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  )
  .refine(
    (data) => {
      // Event duration should not exceed 30 days
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      const durationMs = end.getTime() - start.getTime();
      const maxDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
      return durationMs <= maxDurationMs;
    },
    {
      message: 'Event duration cannot exceed 30 days',
      path: ['endTime'],
    }
  )
  .refine(
    (data) => {
      // Validate that only one organizer exists
      const organizers = data.attendees?.filter((att) => att.isOrganizer) || [];
      return organizers.length <= 1;
    },
    {
      message: 'Only one organizer is allowed',
      path: ['attendees'],
    }
  )
  .refine(
    (data) => {
      // Validate unique email addresses
      const emails = data.attendees?.map((att) => att.email.toLowerCase()) || [];
      const uniqueEmails = new Set(emails);
      return emails.length === uniqueEmails.size;
    },
    {
      message: 'Duplicate email addresses are not allowed',
      path: ['attendees'],
    }
  );

/**
 * Update event request schema (all fields optional except validation rules)
 */
export const UpdateEventSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(500, 'Title must not exceed 500 characters').optional(),
    description: z.string().max(2000, 'Description must not exceed 2000 characters').optional(),
    location: z.string().max(500, 'Location must not exceed 500 characters').optional(),
    startTime: z.string().datetime('Invalid start time format. Use ISO 8601 format').optional(),
    endTime: z.string().datetime('Invalid end time format. Use ISO 8601 format').optional(),
    isAllDay: z.boolean().optional(),
    timezone: z.string().optional(),

    // Recurrence
    recurrence: RecurrenceSchema.optional(),

    // Attendees
    attendees: z
      .array(AttendeeSchema)
      .max(100, 'Maximum 100 attendees allowed')
      .optional(),

    // Reminders
    reminders: z.array(ReminderSchema).max(10, 'Maximum 10 reminders allowed').optional(),
  })
  .refine(
    (data) => {
      // If both start and end time are provided, end time must be after start time
      if (data.startTime && data.endTime) {
        const start = new Date(data.startTime);
        const end = new Date(data.endTime);
        return end > start;
      }
      return true;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  )
  .refine(
    (data) => {
      // If both start and end time are provided, duration should not exceed 30 days
      if (data.startTime && data.endTime) {
        const start = new Date(data.startTime);
        const end = new Date(data.endTime);
        const durationMs = end.getTime() - start.getTime();
        const maxDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        return durationMs <= maxDurationMs;
      }
      return true;
    },
    {
      message: 'Event duration cannot exceed 30 days',
      path: ['endTime'],
    }
  )
  .refine(
    (data) => {
      // Validate that only one organizer exists if attendees are provided
      if (data.attendees) {
        const organizers = data.attendees.filter((att) => att.isOrganizer);
        return organizers.length <= 1;
      }
      return true;
    },
    {
      message: 'Only one organizer is allowed',
      path: ['attendees'],
    }
  )
  .refine(
    (data) => {
      // Validate unique email addresses if attendees are provided
      if (data.attendees) {
        const emails = data.attendees.map((att) => att.email.toLowerCase());
        const uniqueEmails = new Set(emails);
        return emails.length === uniqueEmails.size;
      }
      return true;
    },
    {
      message: 'Duplicate email addresses are not allowed',
      path: ['attendees'],
    }
  );

/**
 * Type inference for CreateEventSchema
 */
export type CreateEventRequest = z.infer<typeof CreateEventSchema>;

/**
 * Type inference for UpdateEventSchema
 */
export type UpdateEventRequest = z.infer<typeof UpdateEventSchema>;

/**
 * Type inference for RecurrenceSchema
 */
export type RecurrenceRequest = z.infer<typeof RecurrenceSchema>;

/**
 * Type inference for AttendeeSchema
 */
export type AttendeeRequest = z.infer<typeof AttendeeSchema>;

/**
 * Type inference for ReminderSchema
 */
export type ReminderRequest = z.infer<typeof ReminderSchema>;

/**
 * Validate event creation request
 *
 * @param data - Request data to validate
 * @returns Validated and parsed data
 * @throws ZodError if validation fails
 */
export function validateCreateEventRequest(data: unknown): CreateEventRequest {
  return CreateEventSchema.parse(data);
}

/**
 * Validate event update request
 *
 * @param data - Request data to validate
 * @returns Validated and parsed data
 * @throws ZodError if validation fails
 */
export function validateUpdateEventRequest(data: unknown): UpdateEventRequest {
  return UpdateEventSchema.parse(data);
}
