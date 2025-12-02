# Calendar Integration Testing Guide

Comprehensive testing documentation for the Calendar Integration application.

## Overview

This project includes extensive test coverage for both backend and frontend components, focusing on OAuth flows, event syncing, token management, and user interactions.

### Test Statistics

**Backend Tests:**
- OAuth Integration Tests: 3 files (Google, Microsoft, Apple)
- Service Layer Tests: 3 files (Event Sync, Token Refresh, OAuth Service)
- Controller Tests: 3 files (OAuth, Calendar, Event)
- Utility Tests: 1 file (Encryption)
- Integration Tests: 1 file (End-to-end flows)
- **Total: 11+ test files with 150+ test cases**

**Frontend Tests:**
- Component Tests: 4 files
- Page Tests: 1 file
- API Tests: 1 file
- Integration Tests: 1 file
- **Total: 7+ test files**

### Coverage Requirements

- **Overall Coverage**: >80%
- **Critical Paths**: 100%
- **Unit Tests**: >85%
- **Integration Tests**: All critical user journeys

## Backend Testing

### Test Structure

```
backend/tests/
├── oauth/                          # OAuth integration tests
│   ├── google.test.ts             # Google Calendar OAuth (25+ tests)
│   ├── microsoft.test.ts          # Microsoft Outlook OAuth (20+ tests)
│   └── apple.test.ts              # Apple Calendar OAuth (15+ tests)
├── services/                       # Service layer tests
│   ├── eventSyncService.test.ts   # Event syncing (30+ tests)
│   ├── tokenRefreshService.test.ts # Token refresh (15+ tests)
│   └── oauthService.test.ts       # OAuth service
├── controllers/                    # API controller tests
│   ├── oauthController.test.ts    # OAuth endpoints
│   ├── calendarController.test.ts # Calendar management
│   └── eventController.test.ts    # Event endpoints
├── integration/                    # Integration tests
│   └── calendar-flow.test.ts      # End-to-end flows (20+ tests)
├── utils/                          # Utility tests
│   └── encryption.test.ts         # Encryption/decryption (40+ tests)
├── mocks/                          # Mock implementations
│   ├── prisma.mock.ts
│   └── logger.mock.ts
├── fixtures/                       # Test data
│   ├── users.fixture.ts
│   ├── calendars.fixture.ts
│   ├── events.fixture.ts
│   └── provider-responses.fixture.ts
└── setup.ts                        # Global test setup
```

### Running Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- google.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should sync events"
```

### Key Backend Test Areas

#### 1. OAuth Flow Tests (`oauth/`)

**Google Calendar:**
- Authorization URL generation with CSRF protection
- Token exchange (authorization code → access/refresh tokens)
- Token refresh (refresh token → new access token)
- Calendar listing and pagination (handles 100+ calendars)
- Calendar metadata retrieval
- Token revocation on disconnect
- Error handling (invalid codes, expired tokens, API errors)

**Microsoft Outlook:**
- MSAL-based OAuth URL generation
- Token acquisition via authorization code
- Token refresh via MSAL
- Calendar listing with Graph API
- Color code mapping (Microsoft colors → hex)
- Error handling for Graph API failures

**Apple Calendar:**
- Client secret JWT generation
- Token exchange with form_post response
- CalDAV stub implementation
- Token revocation

#### 2. Event Sync Tests (`services/eventSyncService.test.ts`)

**Full Sync:**
- Initial event sync from provider
- Date range filtering
- Event creation in database
- All-day event handling
- Multi-day event handling
- Time zone handling

**Incremental Sync:**
- Sync token usage (Google)
- Delta link usage (Microsoft)
- Only fetch changed events
- Invalid token fallback to full sync

**Recurring Events:**
- RRULE parsing and storage
- Recurring event instances
- Exception handling

**Deleted Events:**
- Soft delete in database
- Sync status update to DELETED
- Cancelled event handling

**Edge Cases:**
- Events without start/end times
- Events with special characters in titles
- Very long descriptions (10,000+ characters)
- 1,000+ events in single sync
- Pagination handling

**Performance:**
- Bulk event syncing (1000+ events in <10s)
- Multiple calendar syncing
- Concurrent sync operations

#### 3. Token Refresh Tests (`services/tokenRefreshService.test.ts`)

**Automatic Refresh:**
- Check token expiry before operations
- Refresh if expiring within 5 minutes
- Store new token and expiry
- Audit log entry

**Provider-Specific:**
- Google OAuth2 token refresh
- Microsoft MSAL token refresh
- Apple token refresh

**Error Handling:**
- Invalid refresh token → mark connection as disconnected
- Network errors → retry logic
- Token revoked by user → disconnect calendar

**Background Jobs:**
- Scheduled refresh job
- Batch token refresh (find all expiring tokens)
- Continue on individual failures

#### 4. Encryption Tests (`utils/encryption.test.ts`)

**AES-256-GCM Encryption:**
- Encrypt/decrypt roundtrip
- Random IV generation
- Authentication tag validation
- No plaintext leakage

**Security Properties:**
- Tamper detection (modified ciphertext fails)
- Authentication tag validation
- IV length validation

**Edge Cases:**
- Unicode characters (emojis, Asian characters)
- Special characters
- Very long tokens (10,000+ characters)
- Empty strings (should throw error)

**Performance:**
- Single encryption <100ms
- Bulk encryption (100 tokens) <1s

#### 5. Integration Tests (`integration/calendar-flow.test.ts`)

**Complete OAuth Flow:**
1. Initiate OAuth (generate state token)
2. User authorizes (redirect to provider)
3. Callback with authorization code
4. Validate state token (CSRF protection)
5. Exchange code for tokens
6. List available calendars
7. User selects calendars
8. Create calendar connections
9. Encrypt and store tokens

**Event Syncing Flow:**
1. Connected calendar exists
2. Check token expiry
3. Refresh if needed
4. Fetch events from provider
5. Store events in database
6. Update last synced timestamp

**Disconnect Flow:**
1. User disconnects calendar
2. Soft delete calendar connection
3. Revoke OAuth token at provider
4. Mark as disconnected
5. Audit log entry

**Error Recovery:**
- API rate limiting
- Token revoked by user
- Network failures
- Invalid sync tokens

**Data Consistency:**
- Event updates (not duplicates)
- Multi-calendar syncing
- Pagination handling

### Test Fixtures

**Users** (`fixtures/users.fixture.ts`):
- Standard test user
- Deleted user
- Multiple users

**Calendars** (`fixtures/calendars.fixture.ts`):
- Google Calendar connection
- Microsoft Outlook connection
- Apple Calendar connection
- Expired token connection
- Disconnected connection

**Events** (`fixtures/events.fixture.ts`):
- Regular event
- All-day event
- Recurring event
- Cancelled event
- Multi-day event
- Bulk event generator (for performance tests)

**Provider Responses** (`fixtures/provider-responses.fixture.ts`):
- Google Calendar API responses
- Microsoft Graph API responses
- Apple Calendar responses
- OAuth token responses

### Mocking Strategy

**Prisma Client:**
- Deep mock using `jest-mock-extended`
- Type-safe mocking
- Auto-reset before each test

**External APIs:**
- Google APIs (`googleapis`) - fully mocked
- Microsoft Graph (`@microsoft/microsoft-graph-client`) - fully mocked
- MSAL (`@azure/msal-node`) - fully mocked
- No actual API calls during tests

**Services:**
- Logger mocked (prevent console noise)
- Audit service mocked (prevent audit log clutter)
- Token refresh service mocked in dependent tests

## Frontend Testing

### Test Structure

```
frontend/tests/
├── components/
│   ├── CalendarSelectionModal.test.tsx
│   ├── UnifiedCalendarView.test.tsx
│   ├── IntegrationPrompt.test.tsx
│   └── ConnectCalendarModal.test.tsx
├── pages/
│   └── OAuthCallbackPage.test.tsx
├── api/
│   └── calendar.test.ts
├── integration/
│   └── calendar-flow.test.tsx
├── mocks/
│   └── handlers.ts
└── setup.ts
```

### Running Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

### Key Frontend Test Areas

#### 1. Component Tests

**CalendarSelectionModal:**
- Render calendar list
- Multi-select functionality
- Select All / Deselect All
- Submit selected calendars
- Close modal

**UnifiedCalendarView:**
- Week view rendering
- Month view rendering
- View toggle (week ↔ month)
- Event display
- Date navigation (prev/next)
- Event grouping by date

**IntegrationPrompt:**
- Empty state display
- Connect button click
- Dismissal handling

**ConnectCalendarModal:**
- Provider selection (Google, Microsoft, Apple)
- OAuth redirect on selection

#### 2. Page Tests

**OAuthCallbackPage:**
- Parse URL parameters (code, state)
- Show loading state
- Display calendar selection modal
- Error handling (missing params, invalid state)
- Redirect after success

#### 3. API Client Tests

**calendar.ts:**
- getUserCalendars()
- connectCalendar()
- disconnectCalendar()
- syncCalendar()
- getEvents()
- Error handling
- Token handling (Authorization header)

#### 4. Integration Tests

**Complete User Journey:**
1. User clicks "Connect Calendar"
2. Selects provider (Google)
3. Redirects to OAuth
4. Returns with authorization code
5. Sees calendar selection modal
6. Selects calendars
7. Calendars appear in list
8. Events are synced and displayed

## Test Coverage Reports

### Backend Coverage

```bash
cd backend
npm run test:coverage
```

Coverage report generated in `backend/coverage/`:
- `lcov-report/index.html` - Interactive HTML report
- `coverage-summary.json` - JSON summary

**Expected Coverage:**
- Statements: >80%
- Branches: >80%
- Functions: >80%
- Lines: >80%

### Frontend Coverage

```bash
cd frontend
npm run test:coverage
```

Coverage report generated in `frontend/coverage/`:
- `index.html` - Interactive HTML report
- `coverage-final.json` - JSON summary

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd backend && npm ci
      - run: cd backend && npm run test:coverage
      - uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend && npm ci
      - run: cd frontend && npm run test:coverage
      - uses: codecov/codecov-action@v3
```

## Writing New Tests

### Backend Test Template

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { prismaMock } from '../mocks/prisma.mock';
import { mockUser } from '../fixtures/users.fixture';

describe('ServiceName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something when condition', async () => {
      // Arrange
      prismaMock.model.method.mockResolvedValue(mockData);

      // Act
      const result = await service.method(params);

      // Assert
      expect(result).toEqual(expected);
      expect(prismaMock.model.method).toHaveBeenCalledWith(expectedArgs);
    });

    it('should throw error when invalid input', async () => {
      // Arrange & Act & Assert
      await expect(service.method(invalidParams)).rejects.toThrow('Error message');
    });
  });
});
```

### Frontend Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    const onClickMock = vi.fn();

    render(<ComponentName onClick={onClickMock} />);

    await user.click(screen.getByRole('button'));

    expect(onClickMock).toHaveBeenCalled();
  });
});
```

## Best Practices

### 1. Test Behavior, Not Implementation
- Test what the user sees and does
- Don't test internal state or private methods
- Focus on inputs and outputs

### 2. Follow AAA Pattern
- **Arrange**: Set up test data and mocks
- **Act**: Execute the function/interaction
- **Assert**: Verify the results

### 3. Use Descriptive Test Names
```typescript
// Good
it('should sync events when calendar is connected')
it('should throw error when token is expired')
it('should refresh token before syncing if expiring soon')

// Bad
it('works')
it('test sync')
it('should do stuff')
```

### 4. One Assertion Per Test (Generally)
- Each test should verify one specific behavior
- Makes failures easier to debug
- Exception: Related assertions (e.g., multiple properties of same object)

### 5. Mock External Dependencies
- Don't make real API calls
- Don't access real database
- Use mocks and fixtures

### 6. Test Error Cases
- Test happy path AND error cases
- Invalid input
- Network failures
- API errors
- Edge cases

### 7. Keep Tests Fast
- Unit tests should run in milliseconds
- Integration tests in seconds
- Use mocks to avoid slow operations

## Troubleshooting

### Common Issues

**Backend:**
1. **"Cannot find module"**
   - Check import paths
   - Ensure mocks are set up before imports

2. **"Timeout of 10000ms exceeded"**
   - Increase timeout in jest.config.js
   - Check for unresolved promises

3. **"Mock not called"**
   - Verify mock setup
   - Check if mock was reset
   - Use `mockImplementation` instead of `mockReturnValue` for async

**Frontend:**
1. **"Unable to find role"**
   - Use `screen.debug()` to see rendered HTML
   - Check element has correct role
   - Try different query method

2. **"Not wrapped in act()"**
   - Use `await` for all async operations
   - Wrap state updates in `waitFor()`
   - Use `userEvent` instead of `fireEvent`

3. **"Cannot read property of undefined"**
   - Component not rendered
   - Missing required props
   - Mock not set up

## Resources

### Documentation
- [Jest](https://jestjs.io/)
- [Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW](https://mswjs.io/)
- [Supertest](https://github.com/visionmedia/supertest)

### Tools
- [Testing Playground](https://testing-playground.com/) - Find best queries
- [CodeCov](https://codecov.io/) - Coverage tracking
- [Percy](https://percy.io/) - Visual regression testing

### Best Practices
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [AAA Pattern](https://medium.com/@pjbgf/title-testing-code-ocd-and-the-aaa-pattern-df453975ab80)

## Contributing

When adding new features:
1. Write tests FIRST (TDD)
2. Ensure >80% coverage
3. Test both success and error cases
4. Add integration tests for critical paths
5. Update this documentation

## License

MIT
