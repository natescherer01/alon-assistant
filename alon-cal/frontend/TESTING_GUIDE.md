# Calendar Grid Testing Guide

## Quick Start

### Run All Tests
```bash
cd frontend
npm test
```

### Run Tests in Watch Mode
```bash
npm test:watch
```

### Run with Coverage
```bash
npm test:coverage
```

### Run with UI
```bash
npm test:ui
```

## Test File Locations

```
frontend/src/
├── utils/
│   └── calendarGrid.test.ts          # Utility function tests (96 tests)
├── components/
│   ├── WeekCalendarGrid.test.tsx     # Week view tests (81 tests)
│   ├── MonthCalendarGrid.test.tsx    # Month view tests (58 tests)
│   └── UnifiedCalendarView.test.tsx  # Main view tests (42 tests)
```

## What's Tested

### 1. Utility Functions (calendarGrid.test.ts)

#### Time Slot Generation
- 96 slots for 24 hours (15-minute intervals)
- Correct labeling (12:00 AM - 11:45 PM)
- Sequential indexing

#### Week Day Calculations
- Always starts on Sunday
- Adjusts mid-week dates to Sunday
- Handles year boundaries

#### Month Grid Generation
- 6-7 weeks of days
- Includes adjacent month days
- Handles leap years

#### Event Positioning
- Calculates slot index from time
- Handles midnight events
- Caps multi-day events at day boundary
- Minimum 1 slot for tiny events

#### Overlap Detection
- Detects side-by-side events
- Calculates widths (50%, 33%, etc.)
- Handles 3+ overlapping events
- Separates non-overlapping events

### 2. WeekCalendarGrid Component

#### Rendering
- 7-day grid (Sun-Sat)
- 96 time slots with labels
- Event blocks at correct positions
- All-day event section

#### Event Display
- Shows title, time, location
- Custom colors
- Status indicators (cancelled, tentative)
- Overlapping events side-by-side

#### Interactions
- Click events
- Hover tooltips
- Mobile navigation
- Today highlighting

#### Edge Cases
- Very short events (<15 min)
- Midnight events
- Year boundaries
- Empty states

### 3. MonthCalendarGrid Component

#### Rendering
- Full month grid with weekday headers
- Adjacent month days (faded)
- Weekend highlighting
- Today highlighting

#### Event Display
- First 2 events visible
- "+X more" indicator
- Expand/collapse functionality
- Event colors and status

#### Interactions
- Cell clicks (navigate to week view)
- Event clicks
- Hover tooltips
- Expansion toggle

#### Edge Cases
- Months with many events
- Empty months
- Leap year February
- Year boundaries

### 4. UnifiedCalendarView Component

#### View Management
- Week/month toggle
- Maintains state across switches
- Proper date range calculations

#### Navigation
- Previous/Next buttons
- Today button
- Refresh button
- Header text updates

#### Data Fetching
- Loads events on mount
- Refetches on navigation
- Refetches on view change
- Handles API errors

#### States
- Loading spinner
- Error display with retry
- Empty state message
- Success with grid display

## Test Patterns

### Basic Rendering Test
```typescript
it('should render without crashing', () => {
  render(<Component />);
  expect(screen.getByRole('...')).toBeInTheDocument();
});
```

### User Interaction Test
```typescript
it('should handle button click', () => {
  const handleClick = vi.fn();
  render(<Component onClick={handleClick} />);

  fireEvent.click(screen.getByText('Button'));

  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Async State Test
```typescript
it('should load data', async () => {
  render(<Component />);

  await waitFor(() => {
    expect(screen.getByText('Data')).toBeInTheDocument();
  });
});
```

### Mock API Test
```typescript
it('should fetch events', async () => {
  vi.mocked(calendarApi.getEvents).mockResolvedValue(mockEvents);

  render(<Component />);

  await waitFor(() => {
    expect(calendarApi.getEvents).toHaveBeenCalled();
  });
});
```

## Common Test Utilities

### Rendering
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

### Mocking
```typescript
import { vi } from 'vitest';

// Mock function
const mockFn = vi.fn();

// Mock module
vi.mock('../api/calendar');

// Mock return value
vi.mocked(calendarApi.getEvents).mockResolvedValue([]);
```

### Queries
```typescript
// Get by text
screen.getByText('Button')

// Get by role
screen.getByRole('button', { name: /submit/i })

// Get by test ID
screen.getByTestId('week-calendar-grid')

// Query (returns null if not found)
screen.queryByText('Optional')

// Find (async)
await screen.findByText('Async content')
```

## Known Test Issues

### 1. Timezone Failures (28 tests)
**Issue**: Test event times use UTC, but calculations use local timezone (PST/PDT)

**Example**:
```typescript
// This fails because 09:00 UTC = 01:00 PST
startTime: '2025-12-10T09:00:00.000Z' // Wrong

// Fix: Use local time string
startTime: '2025-12-10T09:00:00' // Right
```

**Affected Tests**:
- `calculateEventPosition` (6 tests)
- `groupEventsByDay` (3 tests)
- `detectOverlappingEvents` (3 tests)
- Event display tests (16 tests)

### 2. Missing ARIA Labels (16 tests)
**Issue**: Event blocks don't have proper accessibility attributes

**Fix needed in components**:
```tsx
<div
  role="button"
  tabIndex={0}
  aria-label={`${event.title} at ${formatTime(startTime)}`}
  onClick={handleClick}
>
```

### 3. React act() Warnings (7 tests)
**Issue**: State updates not wrapped in act()

**Fix**:
```typescript
// Before
fireEvent.click(button);
expect(screen.getByText('Result')).toBeInTheDocument();

// After
fireEvent.click(button);
await waitFor(() => {
  expect(screen.getByText('Result')).toBeInTheDocument();
});
```

## Debugging Tests

### Run Single Test File
```bash
npm test -- calendarGrid.test.ts
```

### Run Single Test
```bash
npm test -- -t "should generate 96 time slots"
```

### Debug with UI
```bash
npm test:ui
```
Then click on failing test to see details and re-run.

### Console Output
```typescript
// Print component HTML
const { container } = render(<Component />);
console.log(container.innerHTML);

// Print query results
screen.debug();
```

### Check What's Rendered
```typescript
// Get all text content
console.log(screen.getByRole('main').textContent);

// Find all buttons
console.log(screen.getAllByRole('button').map(b => b.textContent));
```

## Best Practices

### ✅ DO

1. **Use semantic queries**
   ```typescript
   screen.getByRole('button', { name: /submit/i })
   ```

2. **Wait for async operations**
   ```typescript
   await waitFor(() => expect(...))
   ```

3. **Mock external dependencies**
   ```typescript
   vi.mock('../api/calendar')
   ```

4. **Test user behavior, not implementation**
   ```typescript
   fireEvent.click(screen.getByText('Submit'))
   expect(screen.getByText('Success')).toBeInTheDocument()
   ```

5. **Clean up after each test**
   ```typescript
   afterEach(() => {
     vi.clearAllMocks();
   });
   ```

### ❌ DON'T

1. **Don't test implementation details**
   ```typescript
   // Bad
   expect(component.state.count).toBe(5)

   // Good
   expect(screen.getByText('Count: 5')).toBeInTheDocument()
   ```

2. **Don't use brittle selectors**
   ```typescript
   // Bad
   container.querySelector('.class-name-123')

   // Good
   screen.getByRole('button', { name: 'Submit' })
   ```

3. **Don't forget to await async operations**
   ```typescript
   // Bad
   fireEvent.click(button)
   expect(screen.getByText('Result'))

   // Good
   fireEvent.click(button)
   await waitFor(() => expect(screen.getByText('Result')))
   ```

4. **Don't test library code**
   ```typescript
   // Don't test that React renders - test your logic
   ```

5. **Don't create tightly coupled tests**
   ```typescript
   // Tests should be independent
   // Don't rely on test execution order
   ```

## Coverage Report

### View Coverage
```bash
npm test:coverage
```

### Open HTML Report
```bash
open coverage/index.html
```

### Coverage Thresholds
Set in `vitest.config.ts`:
```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
}
```

### Current Coverage
- **Utility Functions**: ~79%
- **WeekCalendarGrid**: ~80%
- **MonthCalendarGrid**: ~75%
- **UnifiedCalendarView**: ~85%

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

### Pre-commit Hook
```bash
# .husky/pre-commit
npm test -- --run
```

## Troubleshooting

### Tests Won't Run
```bash
# Clear cache
rm -rf node_modules/.vite
npm test
```

### Coverage Not Generating
```bash
# Install coverage plugin
npm install --save-dev @vitest/coverage-v8

# Run with coverage
npm test:coverage
```

### Tests Timing Out
```typescript
// Increase timeout for slow tests
it('slow test', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Mock Not Working
```typescript
// Make sure mock is at top of file
vi.mock('../module', () => ({
  default: { method: vi.fn() }
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Next Steps

1. **Fix timezone issues** - Update test data to use local times
2. **Add ARIA labels** - Improve component accessibility
3. **Fix act() warnings** - Wrap async operations properly
4. **Achieve 98% pass rate** - All tests should pass
5. **Add E2E tests** - Test full user workflows
6. **Add visual regression** - Screenshot testing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Component Testing Guide](https://react.dev/learn/testing)

---

**Last Updated**: 2025-11-24
**Test Framework**: Vitest + React Testing Library
**Total Tests**: 246
**Pass Rate**: 72% (target: 98%)
