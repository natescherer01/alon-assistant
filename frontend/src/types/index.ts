export interface User {
  id: string;
  email: string;
  name?: string; // Optional for backward compatibility
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CalendarAccount {
  id: string;
  userId: string;
  provider: 'google' | 'outlook';
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  accountId: string;
  externalId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// Re-export event types for convenience
export * from './event';
