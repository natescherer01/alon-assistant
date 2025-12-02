/**
 * Calendar Test Fixtures
 *
 * Sample calendar connection data for testing
 */

import { CalendarConnection, CalendarProvider } from '@prisma/client';

const baseConnection = {
  id: 'cal-123e4567-e89b-12d3-a456-426614174000',
  userId: '123e4567-e89b-12d3-a456-426614174000',
  provider: CalendarProvider.GOOGLE,
  calendarId: 'primary',
  calendarName: 'Test Calendar',
  accessToken: 'encrypted_access_token',
  refreshToken: 'encrypted_refresh_token',
  tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
  calendarColor: '#1F77B4',
  isPrimary: true,
  isConnected: true,
  lastSyncedAt: new Date('2024-01-01T00:00:00Z'),
  syncToken: 'sync_token_123',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  deletedAt: null,
};

export const mockGoogleConnection: CalendarConnection = {
  ...baseConnection,
};

export const mockMicrosoftConnection: CalendarConnection = {
  ...baseConnection,
  id: 'cal-223e4567-e89b-12d3-a456-426614174000',
  provider: CalendarProvider.MICROSOFT,
  calendarId: 'AAMkAGI2TGTG',
  calendarName: 'Outlook Calendar',
  calendarColor: '#0078D4',
};

export const mockAppleConnection: CalendarConnection = {
  ...baseConnection,
  id: 'cal-323e4567-e89b-12d3-a456-426614174000',
  provider: CalendarProvider.APPLE,
  calendarId: 'primary',
  calendarName: 'iCloud Calendar',
  calendarColor: '#FF9500',
};

export const mockExpiredConnection: CalendarConnection = {
  ...baseConnection,
  id: 'cal-423e4567-e89b-12d3-a456-426614174000',
  tokenExpiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
};

export const mockDisconnectedConnection: CalendarConnection = {
  ...baseConnection,
  id: 'cal-523e4567-e89b-12d3-a456-426614174000',
  isConnected: false,
  deletedAt: new Date('2024-01-15T00:00:00Z'),
};

export const mockCalendars = {
  google: mockGoogleConnection,
  microsoft: mockMicrosoftConnection,
  apple: mockAppleConnection,
  expired: mockExpiredConnection,
  disconnected: mockDisconnectedConnection,
};
