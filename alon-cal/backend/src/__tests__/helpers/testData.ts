/**
 * Test Data Fixtures
 *
 * Sample data for testing
 */

export const validEmails = [
  'user@example.com',
  'test.user@domain.co.uk',
  'user+tag@example.com',
  'first.last@company.com',
  'user123@test.org',
];

export const invalidEmails = [
  'invalid-email',
  'user@',
  '@example.com',
  '',
  'user @example.com',
  'user@.com',
  'user..name@example.com',
];

export const validPasswords = [
  'SecurePass123!',
  'MyP@ssw0rd!',
  'Test1234!@#',
  'Str0ng!Pass',
  'C0mplex#Pass',
];

export const invalidPasswords = [
  { password: 'short', reason: 'too short' },
  { password: 'NoNumber!', reason: 'no number' },
  { password: 'NoSpecial123', reason: 'no special character' },
  { password: 'nouppercase123!', reason: 'no uppercase' },
  { password: 'NOLOWERCASE123!', reason: 'no lowercase' },
  { password: 'password123', reason: 'common password' },
  { password: '12345678', reason: 'common password' },
];

export const testUsers = [
  {
    email: 'john.doe@example.com',
    password: 'JohnDoe123!',
    firstName: 'John',
    lastName: 'Doe',
  },
  {
    email: 'jane.smith@example.com',
    password: 'JaneSmith456!',
    firstName: 'Jane',
    lastName: 'Smith',
  },
  {
    email: 'bob.wilson@example.com',
    password: 'BobWilson789!',
    firstName: 'Bob',
    lastName: 'Wilson',
  },
];

export const mockGoogleCalendars = [
  {
    id: 'primary',
    name: 'Primary Calendar',
    backgroundColor: '#4285f4',
    isPrimary: true,
    accessRole: 'owner' as const,
    timeZone: 'America/New_York',
  },
  {
    id: 'work-calendar-id',
    name: 'Work Calendar',
    backgroundColor: '#e67c73',
    isPrimary: false,
    accessRole: 'owner' as const,
    timeZone: 'America/New_York',
  },
  {
    id: 'personal-calendar-id',
    name: 'Personal Calendar',
    backgroundColor: '#33b679',
    isPrimary: false,
    accessRole: 'owner' as const,
    timeZone: 'America/New_York',
  },
];

export const mockMicrosoftCalendars = [
  {
    id: 'AAMkAGI2THVSAAA=',
    name: 'Calendar',
    color: 'auto',
    isDefaultCalendar: true,
    canEdit: true,
    owner: {
      name: 'Test User',
      address: 'test@outlook.com',
    },
  },
  {
    id: 'AAMkAGI2THVSAAB=',
    name: 'Work Calendar',
    color: 'lightBlue',
    isDefaultCalendar: false,
    canEdit: true,
    owner: {
      name: 'Test User',
      address: 'test@outlook.com',
    },
  },
];

export const mockOAuthTokens = {
  google: {
    accessToken: 'ya29.a0AfH6SMBx...',
    refreshToken: '1//0gZ8X...',
    expiresIn: 3600,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    tokenType: 'Bearer',
  },
  microsoft: {
    accessToken: 'EwBgA+l3BAAUANk...',
    refreshToken: 'M.R3_BAY...',
    expiresIn: 3600,
    scope: 'Calendars.Read',
    tokenType: 'Bearer',
  },
};

export const mockIPAddresses = [
  '127.0.0.1',
  '192.168.1.1',
  '10.0.0.1',
  '203.0.113.0',
  '2001:0db8:85a3:0000:0000:8a2e:0370:7334', // IPv6
];

export const mockUserAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];
