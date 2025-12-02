# Frontend Tests

Comprehensive test suite for the Calendar Integration React frontend.

## Test Coverage

### Component Tests
- **CalendarSelectionModal** - Multi-select calendar picker after OAuth
- **UnifiedCalendarView** - Week/month calendar view with events
- **IntegrationPrompt** - Empty state for no connected calendars
- **ConnectCalendarModal** - Provider selection modal

### Page Tests
- **OAuthCallbackPage** - OAuth redirect handling
- **CalendarsPage** - Calendar management page

### API Client Tests
- **calendar.ts** - All calendar API methods
- Error handling and response parsing
- Token handling

### Integration Tests
- Complete OAuth flow
- Event fetching and display
- Calendar connection/disconnection

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

### Run with UI
```bash
npm run test:ui
```

### Run specific test file
```bash
npm test -- CalendarSelectionModal.test.tsx
```

## Test Structure

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
│   └── handlers.ts                  # MSW request handlers
├── setup.ts                         # Global test setup
└── README.md                        # This file
```

## Testing Libraries

- **Vitest**: Fast unit test framework
- **React Testing Library**: Component testing utilities
- **MSW (Mock Service Worker)**: API mocking
- **@testing-library/user-event**: User interaction simulation
- **@testing-library/jest-dom**: Custom matchers

## Example Test: Component

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarSelectionModal } from '../components/CalendarSelectionModal';

describe('CalendarSelectionModal', () => {
  it('should render calendar list', () => {
    const calendars = [
      { id: '1', name: 'Work Calendar', provider: 'GOOGLE' },
      { id: '2', name: 'Personal Calendar', provider: 'GOOGLE' },
    ];

    render(
      <CalendarSelectionModal
        calendars={calendars}
        isOpen={true}
        onClose={() => {}}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('Work Calendar')).toBeInTheDocument();
    expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
  });

  it('should handle multi-select', async () => {
    const calendars = [
      { id: '1', name: 'Work Calendar', provider: 'GOOGLE' },
      { id: '2', name: 'Personal Calendar', provider: 'GOOGLE' },
    ];
    const onSelect = vi.fn();

    render(
      <CalendarSelectionModal
        calendars={calendars}
        isOpen={true}
        onClose={() => {}}
        onSelect={onSelect}
      />
    );

    // Select first calendar
    fireEvent.click(screen.getByLabelText('Work Calendar'));

    // Select second calendar
    fireEvent.click(screen.getByLabelText('Personal Calendar'));

    // Submit
    fireEvent.click(screen.getByText('Connect Calendars'));

    expect(onSelect).toHaveBeenCalledWith(['1', '2']);
  });
});
```

## Example Test: API Client

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { calendarApi } from '../api/calendar';

const server = setupServer(
  rest.get('http://localhost:3001/api/calendars', (req, res, ctx) => {
    return res(
      ctx.json({
        calendars: [
          { id: '1', name: 'Calendar 1', provider: 'GOOGLE' },
        ],
      })
    );
  })
);

beforeEach(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Calendar API', () => {
  it('should fetch user calendars', async () => {
    const calendars = await calendarApi.getUserCalendars();

    expect(calendars).toHaveLength(1);
    expect(calendars[0].name).toBe('Calendar 1');
  });

  it('should handle API errors', async () => {
    server.use(
      rest.get('http://localhost:3001/api/calendars', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Server error' }));
      })
    );

    await expect(calendarApi.getUserCalendars()).rejects.toThrow();
  });
});
```

## Example Test: User Interaction

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedCalendarView } from '../components/UnifiedCalendarView';

describe('UnifiedCalendarView', () => {
  it('should switch between week and month view', async () => {
    const user = userEvent.setup();
    render(<UnifiedCalendarView />);

    // Default is week view
    expect(screen.getByText(/week/i)).toBeInTheDocument();

    // Click month button
    await user.click(screen.getByRole('button', { name: /month/i }));

    expect(screen.getByText(/month/i)).toBeInTheDocument();
  });

  it('should navigate to next week', async () => {
    const user = userEvent.setup();
    render(<UnifiedCalendarView />);

    const currentWeek = screen.getByText(/current week/i);

    await user.click(screen.getByLabelText('Next week'));

    expect(screen.getByText(/next week/i)).toBeInTheDocument();
  });
});
```

## Best Practices

### 1. Test User Behavior, Not Implementation
```typescript
// Bad - testing implementation details
expect(component.state.isOpen).toBe(true);

// Good - testing user-visible behavior
expect(screen.getByRole('dialog')).toBeInTheDocument();
```

### 2. Use Semantic Queries
```typescript
// Preferred order:
// 1. getByRole
screen.getByRole('button', { name: /submit/i })

// 2. getByLabelText (for forms)
screen.getByLabelText(/email/i)

// 3. getByPlaceholderText
screen.getByPlaceholderText(/search/i)

// 4. getByText (last resort)
screen.getByText(/welcome/i)
```

### 3. Wait for Async Updates
```typescript
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(screen.getByText('Data loaded')).toBeInTheDocument();
});
```

### 4. Mock API Calls with MSW
```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/events', (req, res, ctx) => {
    return res(ctx.json({ events: [] }));
  })
);
```

### 5. Test Accessibility
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('should have no accessibility violations', async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Coverage Goals

- **Overall**: >80% code coverage
- **Components**: >90% coverage
- **API Client**: 100% coverage
- **Critical Paths**: 100% coverage

## Debugging Tests

### View component output
```typescript
import { screen } from '@testing-library/react';

screen.debug(); // Print entire DOM
screen.debug(screen.getByRole('button')); // Print specific element
```

### Interactive debugging
```bash
npm run test:ui
```

### Check what's in the document
```typescript
screen.logTestingPlaygroundURL(); // Opens in browser
```

## CI/CD Integration

Tests run automatically:
- Pre-commit: Type checking
- Pre-push: Full test suite
- PR: Full test suite + coverage
- Main: Full test suite + E2E

## Common Issues

### "Unable to find role"
- Check component is rendered
- Use screen.debug() to see DOM
- Verify role exists on element

### "Act warning"
- Wrap state updates in `await waitFor()`
- Use `await user.click()` for events

### "Not wrapped in act()"
- All async operations should use `await`
- Use `waitFor()` for assertions

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW Documentation](https://mswjs.io/)
- [Testing Playground](https://testing-playground.com/)
