# Backend Tests

Comprehensive test suite for the Calendar Integration backend API.

## Test Coverage

### OAuth Integration Tests
- **Google Calendar** (`tests/oauth/google.test.ts`)
  - Authorization URL generation with CSRF protection
  - Token exchange and refresh
  - Calendar listing and metadata retrieval
  - Token revocation
  - Error handling for invalid/expired tokens
  - Edge cases (100+ calendars, special characters, etc.)

- **Microsoft Outlook** (`tests/oauth/microsoft.test.ts`)
  - MSAL-based OAuth flow
  - Token exchange and refresh
  - Calendar listing with color mapping
  - Graph API integration
  - Error handling

### Service Layer Tests
- **Event Sync Service** (`tests/services/eventSyncService.test.ts`)
  - Full sync and incremental sync with sync tokens
  - Google and Microsoft event syncing
  - Recurring event handling
  - Deleted event handling
  - Multi-calendar syncing
  - Date range queries
  - Performance tests (1000+ events)

- **Token Refresh Service** (`tests/services/tokenRefreshService.test.ts`)
  - Automatic token refresh before expiry
  - Multi-provider token refresh
  - Background refresh jobs
  - Error handling and disconnection on failure
  - Edge cases (expired tokens, threshold testing)

### Utility Tests
- **Encryption** (`tests/utils/encryption.test.ts`)
  - AES-256-GCM encryption/decryption
  - Round-trip testing
  - Security properties (no plaintext leakage, authenticated encryption)
  - SHA-256 hashing
  - Secure token generation
  - Performance testing (bulk operations)
  - Edge cases (unicode, special characters, long tokens)

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run with coverage report
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- google.test.ts
```

### Run tests matching pattern
```bash
npm test -- --testNamePattern="should sync events"
```

## Test Structure

```
backend/tests/
├── oauth/                    # OAuth integration tests
│   ├── google.test.ts
│   ├── microsoft.test.ts
│   └── apple.test.ts
├── services/                 # Service layer tests
│   ├── eventSyncService.test.ts
│   ├── tokenRefreshService.test.ts
│   └── oauthService.test.ts
├── controllers/              # API controller tests
│   ├── oauthController.test.ts
│   ├── calendarController.test.ts
│   └── eventController.test.ts
├── integration/              # End-to-end integration tests
│   └── calendar-flow.test.ts
├── mocks/                    # Mock implementations
│   ├── prisma.mock.ts        # Prisma client mock
│   └── logger.mock.ts        # Logger mock
├── fixtures/                 # Test data fixtures
│   ├── users.fixture.ts
│   ├── calendars.fixture.ts
│   ├── events.fixture.ts
│   └── provider-responses.fixture.ts
├── utils/                    # Utility tests
│   └── encryption.test.ts
├── setup.ts                  # Global test setup
└── README.md                 # This file
```

## Test Fixtures

### Users
- `mockUser`: Standard test user
- `mockUsers`: Collection of test users
- `deletedUser`: Soft-deleted user for testing

### Calendars
- `mockGoogleConnection`: Google Calendar connection
- `mockMicrosoftConnection`: Microsoft Outlook connection
- `mockAppleConnection`: Apple Calendar connection
- `mockExpiredConnection`: Connection with expired token
- `mockDisconnectedConnection`: Disconnected calendar

### Events
- `mockEvent`: Standard calendar event
- `mockAllDayEvent`: All-day event
- `mockRecurringEvent`: Recurring event with RRULE
- `mockCancelledEvent`: Cancelled/deleted event
- `mockMultiDayEvent`: Event spanning multiple days
- `generateMockEvents(count)`: Generate bulk events for testing

### Provider API Responses
- Google Calendar API responses (events, calendars, tokens)
- Microsoft Graph API responses
- Apple Calendar responses (CalDAV stub)

## Mocking Strategy

### Prisma Client
- Uses `jest-mock-extended` for type-safe mocking
- All database operations are mocked
- Automatically reset before each test

### External APIs
- Google APIs (`googleapis`) mocked
- Microsoft Graph (`@microsoft/microsoft-graph-client`) mocked
- MSAL (`@azure/msal-node`) mocked
- No actual API calls made during tests

### Services
- Audit service mocked
- Token refresh service mocked in dependent tests
- Logger mocked to prevent console noise

## Coverage Goals

- **Overall**: >80% code coverage
- **Critical Paths**: 100% coverage
  - OAuth flows
  - Token encryption/decryption
  - Event syncing logic
  - Error handling

## Writing New Tests

### Test Structure (AAA Pattern)
```typescript
it('should do something', async () => {
  // Arrange - Set up test data and mocks
  const mockData = { ... };
  prismaMock.model.method.mockResolvedValue(mockData);

  // Act - Execute the function under test
  const result = await serviceUnderTest.method(params);

  // Assert - Verify the results
  expect(result).toEqual(expectedValue);
  expect(mockMethod).toHaveBeenCalledWith(expectedArgs);
});
```

### Best Practices
1. **Descriptive test names**: Use "should [expected behavior] when [condition]"
2. **One assertion per test**: Test one thing at a time
3. **Mock external dependencies**: Don't make real API calls or database queries
4. **Use fixtures**: Reuse test data from fixture files
5. **Test error cases**: Always test both success and failure paths
6. **Test edge cases**: Boundary values, empty data, null values, etc.
7. **Clean up**: Reset mocks before each test (handled in `beforeEach`)

### Async Testing
```typescript
// Async/await (preferred)
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

// Promises
it('should handle promise', () => {
  return asyncFunction().then(result => {
    expect(result).toBe(expected);
  });
});

// Error testing
it('should throw error', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error message');
});
```

### Parametrized Tests
```typescript
const testCases = [
  { input: 'a', expected: 'A' },
  { input: 'b', expected: 'B' },
];

testCases.forEach(({ input, expected }) => {
  it(`should convert ${input} to ${expected}`, () => {
    expect(convert(input)).toBe(expected);
  });
});
```

## CI/CD Integration

Tests are automatically run in CI/CD pipeline:
- Pre-commit: Lint and type checking
- Pre-push: Full test suite
- PR: Full test suite + coverage report
- Main branch: Full test suite + coverage upload

## Troubleshooting

### Tests timeout
- Increase timeout in jest.config.js (default: 10s)
- Or per-test: `it('test', () => {...}, 30000);`

### Mock not working
- Ensure mock is set up before importing the module
- Check mock is reset in `beforeEach`
- Verify mock path matches import path

### Coverage not accurate
- Check `collectCoverageFrom` in jest.config.js
- Ensure all source files are included
- Run with `--coverage --verbose` for details

### Type errors in tests
- Ensure @types packages are installed
- Use `as any` sparingly for complex mocks
- Check tsconfig.json includes test files

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Supertest API](https://github.com/visionmedia/supertest)
- [jest-mock-extended](https://github.com/marchaos/jest-mock-extended)
