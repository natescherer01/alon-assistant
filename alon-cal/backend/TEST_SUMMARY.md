# ICS Calendar Subscription Feature - Test Suite

## Overview
Comprehensive test coverage for the ICS (iCalendar subscription URL) feature, including SSRF protection, ICS parsing, event synchronization, and background polling.

## Test Files Created

### 1. URL Validator Tests
**File:** `/Users/natescherer/alon-cal/backend/src/__tests__/utils/urlValidator.test.ts`

**Coverage:**
- Valid HTTPS URLs ✅
- Valid HTTP URLs in dev mode ✅
- HTTP rejection in production ✅
- Private IP blocking (192.168.x.x, 10.x.x.x, 172.16-31.x.x) ✅
- Localhost blocking (127.0.0.1, localhost, ::1) ✅
- AWS metadata endpoint blocking (169.254.169.254) ✅
- Azure metadata endpoint blocking ✅
- GCP metadata endpoint blocking (metadata.google.internal) ✅
- AWS IMDSv2 IPv6 endpoint blocking ✅
- Invalid URL format rejection ✅
- File protocol rejection ✅
- Javascript protocol rejection ✅
- FTP protocol rejection ✅
- Data URL rejection ✅
- DNS rebinding protection ✅
- Mixed public/private IP resolution ✅
- DNS resolution failure handling ✅
- Special IP addresses (0.0.0.0, 255.255.255.255) ✅
- IPv6 private ranges ✅
- Public IP acceptance ✅
- Edge cases (auth in URL, fragments, long URLs, IDN) ✅

**Test Count:** 40+ tests

### 2. ICS Client Tests
**File:** `/Users/natescherer/alon-cal/backend/src/__tests__/integrations/ics/icsClient.test.ts`

**Coverage:**
- Fetch valid ICS feed ✅
- ETag header handling ✅
- Last-Modified header handling ✅
- 304 Not Modified response ✅
- Request timeout handling ✅
- File size limit enforcement (10MB) ✅
- Content-Type validation ✅
- Simple VEVENT parsing ✅
- Recurring event (RRULE) parsing ✅
- All-day event parsing ✅
- Event with attendees parsing ✅
- Event with organizer parsing ✅
- EXDATE (exception dates) parsing ✅
- VTIMEZONE handling ✅
- Malformed ICS graceful handling ✅
- Missing required fields (UID, DTSTART) ✅
- UTF-8 encoding support ✅
- Mixed line endings (CRLF vs LF) ✅
- Status field parsing (CONFIRMED, TENTATIVE, CANCELLED) ✅
- Events without end time ✅
- Large feed handling ✅
- Complex RRULE parsing ✅
- Feed validation with metadata ✅

**Test Count:** 35+ tests

### 3. ICS Service Tests
**File:** `/Users/natescherer/alon-cal/backend/src/__tests__/services/icsService.test.ts`

**Coverage:**
- validateIcsUrl() returns calendar info ✅
- validateIcsUrl() returns error for invalid URL ✅
- createIcsConnection() creates with encrypted URL ✅
- createIcsConnection() sets isReadOnly to true ✅
- createIcsConnection() prevents duplicates ✅
- createIcsConnection() uses custom display name ✅
- createIcsConnection() logs audit event ✅
- updateIcsConnection() updates URL and re-syncs ✅
- updateIcsConnection() updates display name ✅
- updateIcsConnection() resets ETag/Last-Modified ✅
- syncIcsEvents() creates new events ✅
- syncIcsEvents() updates existing events ✅
- syncIcsEvents() deletes removed events ✅
- syncIcsEvents() uses ETag for caching ✅
- syncIcsEvents() uses Last-Modified for caching ✅
- syncIcsEvents() handles sync failures gracefully ✅
- syncIcsEvents() logs audit events ✅
- getIcsConnection() returns decrypted URL ✅
- deleteIcsConnection() soft-deletes connection and events ✅

**Test Count:** 25+ tests

### 4. ICS Controller Tests
**File:** `/Users/natescherer/alon-cal/backend/src/__tests__/controllers/icsController.test.ts`

**Coverage:**
- POST /validate returns 200 with valid URL ✅
- POST /validate returns 400 with invalid URL ✅
- POST /validate returns 401 without auth ✅
- POST /connect creates connection ✅
- POST /connect triggers initial sync ✅
- POST /connect returns 409 for duplicate URL ✅
- POST /connect uses custom display name ✅
- GET /:connectionId returns calendar details ✅
- GET /:connectionId returns 404 if not found ✅
- PUT /:connectionId updates display name ✅
- PUT /:connectionId updates URL and triggers sync ✅
- DELETE /:connectionId soft-deletes connection ✅
- POST /:connectionId/sync triggers manual sync ✅
- POST /:connectionId/sync returns stats ✅
- POST /:connectionId/sync returns 500 on failure ✅
- All endpoints return 401 without authentication ✅

**Test Count:** 20+ tests

### 5. ICS Sync Job Tests
**File:** `/Users/natescherer/alon-cal/backend/src/__tests__/jobs/icsSyncJob.test.ts`

**Coverage:**
- Job starts on schedule (15 minutes) ✅
- Job runs immediately on startup ✅
- Job syncs all active ICS connections ✅
- Job staggers sync to avoid thundering herd ✅
- Job stops gracefully on shutdown ✅
- Job handles sync failures without crashing ✅
- Job logs sync statistics ✅
- Job prevents concurrent sync cycles ✅
- Job handles database errors gracefully ✅
- Job handles missing fields ✅
- Job handles very large number of connections ✅
- Job handles service exceptions ✅
- getStatus() returns correct information ✅

**Test Count:** 20+ tests

### 6. ICS API Integration Tests
**File:** `/Users/natescherer/alon-cal/backend/src/__tests__/integration/icsApi.test.ts`

**Coverage:**
- POST /api/calendars/ics/validate with valid URL returns 200 ✅
- POST /api/calendars/ics/validate with invalid URL returns 400 ✅
- POST /api/calendars/ics/validate without auth returns 401 ✅
- POST /api/calendars/ics/connect creates connection and syncs events ✅
- POST /api/calendars/ics/connect with invalid URL returns 400 ✅
- POST /api/calendars/ics/connect with duplicate URL returns 409 ✅
- GET /api/calendars/ics/:connectionId returns calendar details ✅
- GET /api/calendars/ics/:connectionId for other user returns 404 ✅
- PUT /api/calendars/ics/:connectionId updates calendar ✅
- DELETE /api/calendars/ics/:connectionId soft-deletes connection ✅
- POST /api/calendars/ics/:connectionId/sync triggers manual sync ✅
- Very large ICS feeds handled ✅
- UTF-8 characters handled ✅
- Concurrent sync requests handled ✅
- Connection deletion during sync handled ✅
- Authentication and authorization enforced ✅

**Test Count:** 25+ tests

## Test Fixtures Created

### ICS Sample Files
**Location:** `/Users/natescherer/alon-cal/backend/src/__tests__/fixtures/ics/`

1. **valid-simple.ics** - Simple calendar with 2 events
2. **valid-recurring.ics** - Calendar with recurring events (RRULE)
3. **valid-allday.ics** - Calendar with all-day events
4. **valid-attendees.ics** - Calendar with attendees and organizer
5. **valid-large.ics** - Calendar with 10+ events
6. **valid-exdates.ics** - Recurring event with exception dates
7. **invalid-missing-fields.ics** - Events missing required fields (UID, DTSTART)
8. **invalid-malformed.ics** - Malformed ICS content

## Test Execution

### Run All ICS Tests
```bash
cd /Users/natescherer/alon-cal/backend
npm test -- src/__tests__
```

### Run Specific Test Suites
```bash
# URL Validator tests
npm test -- src/__tests__/utils/urlValidator.test.ts

# ICS Client tests
npm test -- src/__tests__/integrations/ics/icsClient.test.ts

# ICS Service tests
npm test -- src/__tests__/services/icsService.test.ts

# ICS Controller tests
npm test -- src/__tests__/controllers/icsController.test.ts

# ICS Sync Job tests
npm test -- src/__tests__/jobs/icsSyncJob.test.ts

# Integration tests
npm test -- src/__tests__/integration/icsApi.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage src/__tests__
```

## Coverage Goals

| Metric | Target | Status |
|--------|--------|--------|
| Line Coverage | >80% | Pending |
| Branch Coverage | >75% | Pending |
| Function Coverage | >90% | Pending |

## Test Statistics

- **Total Test Files:** 6
- **Total Test Cases:** 165+
- **Test Fixtures:** 8 ICS files
- **Mocking Strategy:** Jest mocks for Prisma, Axios, DNS, Encryption
- **Integration Tests:** Supertest for API endpoints

## Security Testing Coverage

### SSRF Protection Tests
- ✅ Private IP ranges blocked
- ✅ Localhost blocked
- ✅ Cloud metadata endpoints blocked
- ✅ DNS rebinding protection
- ✅ Protocol validation
- ✅ Redirect validation

### Authentication Tests
- ✅ Unauthorized access rejection
- ✅ Cross-user access prevention
- ✅ Token validation

### Data Validation Tests
- ✅ URL format validation
- ✅ ICS content parsing
- ✅ Large file handling
- ✅ Malformed data handling

## Edge Cases Tested

1. **Concurrent Operations**
   - Multiple sync requests
   - Connection deletion during sync
   - Job preventing concurrent cycles

2. **Data Volume**
   - Large ICS feeds (10,000+ events)
   - Very large number of connections (1000+)

3. **Error Conditions**
   - Network timeouts
   - Database errors
   - Service unavailability
   - Malformed ICS data

4. **Internationalization**
   - UTF-8 character support
   - Mixed line endings
   - IDN (Internationalized Domain Names)

5. **HTTP Caching**
   - ETag support
   - Last-Modified support
   - 304 Not Modified responses

## Testing Best Practices Applied

1. **Arrange-Act-Assert (AAA) Pattern**
   - Clear test structure
   - Isolated test setup
   - Explicit assertions

2. **Mocking Strategy**
   - External dependencies mocked
   - Database operations mocked
   - HTTP requests mocked
   - Consistent mock cleanup

3. **Test Naming**
   - Descriptive test names
   - Clear intent (should_xxx_when_yyy)
   - Grouped by functionality

4. **Test Independence**
   - No shared state between tests
   - beforeEach/afterEach cleanup
   - Mock reset after each test

5. **Fixtures**
   - Realistic test data
   - Valid and invalid samples
   - Edge case examples

## Known Issues & Notes

1. **TypeScript Compilation:**
   - Tests are written in TypeScript
   - Requires Prisma client generation before running
   - May need `npm run prisma:generate` if types are missing

2. **Integration Tests:**
   - Require mocked Prisma client
   - Use supertest for HTTP assertions
   - Authentication middleware mocked

3. **Async Operations:**
   - Background sync is fire-and-forget
   - Tests use fake timers for job scheduling
   - Proper async/await usage throughout

## Future Enhancements

1. **Performance Tests:**
   - Sync duration benchmarks
   - Memory usage monitoring
   - Concurrent connection limits

2. **E2E Tests:**
   - Real ICS feed testing (with test server)
   - Full flow from connect to sync
   - Webhook notification testing

3. **Snapshot Tests:**
   - ICS parsing output snapshots
   - API response snapshots

## Test Maintenance

### Before Running Tests
```bash
# Ensure dependencies are installed
npm install

# Generate Prisma client
npm run prisma:generate

# Ensure environment variables are set
# (tests use setup.ts for test env vars)
```

### After Code Changes
```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Run tests in watch mode during development
npm run test:watch
```

### Updating Fixtures
When updating ICS fixtures:
1. Validate ICS format with online validators
2. Test with actual calendar clients if possible
3. Update related test expectations

## Success Criteria

- [x] All test files created
- [x] All test fixtures created
- [x] Tests follow Jest best practices
- [x] Comprehensive edge case coverage
- [x] Security tests included
- [x] Integration tests included
- [ ] All tests passing (pending environment setup)
- [ ] >80% line coverage
- [ ] >75% branch coverage
- [ ] >90% function coverage
- [ ] No flaky tests (run 3 times to verify)
- [ ] Tests run in <30 seconds total

## Running Test Suite

To execute the complete test suite:

```bash
cd /Users/natescherer/alon-cal/backend

# Run all tests (will need some fixes for missing modules)
npm test

# Run with verbose output
npm test -- --verbose

# Run with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Documentation References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [iCalendar RFC 5545](https://tools.ietf.org/html/rfc5545)

---

**Created:** 2025-11-25
**Test Framework:** Jest 30.2.0
**Node Version:** >=18.0.0
**Total Test Coverage:** 165+ test cases across 6 test files
