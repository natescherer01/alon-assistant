# Calendar Integration - Quick Reference

Quick code snippets and integration examples for the calendar components.

## Import Statements

```typescript
// Components
import CalendarSelectionModal from './components/CalendarSelectionModal';
import CalendarEventCard from './components/CalendarEventCard';
import UnifiedCalendarView from './components/UnifiedCalendarView';
import IntegrationPrompt from './components/IntegrationPrompt';
import ConnectCalendarModal from './components/ConnectCalendarModal';
import EmptyState from './components/EmptyState';

// API
import calendarApi from './api/calendar';
import type { Calendar, CalendarEvent, ProviderCalendar } from './api/calendar';

// Hooks
import { useCalendars } from './hooks/useCalendars';
```

---

## Component Usage Examples

### ConnectCalendarModal

```tsx
function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Connect Calendar
      </button>

      <ConnectCalendarModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
```

### CalendarSelectionModal

```tsx
function OAuthCallback() {
  const [calendars, setCalendars] = useState<ProviderCalendar[]>([]);
  const [sessionToken, setSessionToken] = useState('');
  const [provider, setProvider] = useState<'GOOGLE' | 'MICROSOFT' | 'APPLE'>('GOOGLE');

  return (
    <CalendarSelectionModal
      isOpen={calendars.length > 0}
      onClose={() => navigate('/dashboard')}
      provider={provider}
      calendars={calendars}
      sessionToken={sessionToken}
    />
  );
}
```

### UnifiedCalendarView

```tsx
function CalendarPage() {
  const handleEventClick = (event: CalendarEvent) => {
    console.log('Event clicked:', event);
    // Open event details or external link
    if (event.htmlLink) {
      window.open(event.htmlLink, '_blank');
    }
  };

  return (
    <UnifiedCalendarView onEventClick={handleEventClick} />
  );
}
```

### CalendarEventCard

```tsx
function EventList({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {events.map(event => (
        <CalendarEventCard
          key={event.id}
          event={event}
          onClick={(e) => console.log('Clicked:', e.title)}
        />
      ))}
    </div>
  );
}
```

### IntegrationPrompt

```tsx
function Dashboard() {
  const { calendars } = useCalendars();
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      {calendars.length === 0 && (
        <IntegrationPrompt onConnect={() => setShowModal(true)} />
      )}

      {/* Rest of dashboard */}
    </div>
  );
}
```

### EmptyState

```tsx
function MyCalendars() {
  const { calendars, isLoading } = useCalendars();
  const [showModal, setShowModal] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (calendars.length === 0) {
    return <EmptyState onConnect={() => setShowModal(true)} />;
  }

  return <CalendarList calendars={calendars} />;
}
```

---

## API Usage Examples

### Initiating OAuth

```typescript
import { useCalendars } from './hooks/useCalendars';

function ConnectButton() {
  const { initiateOAuth } = useCalendars();

  const handleConnect = async (provider: 'GOOGLE' | 'MICROSOFT' | 'APPLE') => {
    try {
      await initiateOAuth(provider);
      // User will be redirected to OAuth page
    } catch (error) {
      console.error('OAuth failed:', error);
    }
  };

  return (
    <button onClick={() => handleConnect('GOOGLE')}>
      Connect Google Calendar
    </button>
  );
}
```

### Handling OAuth Callback

```typescript
import calendarApi from './api/calendar';

async function handleCallback(code: string, state: string, provider: string) {
  try {
    const response = await calendarApi.handleOAuthCallback(
      provider as 'google' | 'microsoft' | 'apple',
      code,
      state
    );

    // response.calendars - list of user's calendars
    // response.sessionToken - temporary token for selection

    return response;
  } catch (error) {
    console.error('Callback failed:', error);
    throw error;
  }
}
```

### Selecting Calendars

```typescript
import calendarApi from './api/calendar';

async function saveCalendarSelection(
  provider: 'google' | 'microsoft' | 'apple',
  calendarIds: string[],
  sessionToken: string
) {
  try {
    await calendarApi.selectCalendars(provider, calendarIds, sessionToken);
    console.log('Calendars connected successfully');
  } catch (error) {
    console.error('Failed to save selection:', error);
    throw error;
  }
}
```

### Fetching Events

```typescript
import calendarApi from './api/calendar';

async function loadEvents() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  try {
    const events = await calendarApi.getEvents(weekStart, weekEnd);
    console.log('Events:', events);
    return events;
  } catch (error) {
    console.error('Failed to fetch events:', error);
    throw error;
  }
}
```

### Managing Calendars

```typescript
import { useCalendars } from './hooks/useCalendars';

function CalendarManager() {
  const { calendars, disconnectCalendar, syncCalendar, fetchCalendars } = useCalendars();

  const handleDisconnect = async (calendarId: string) => {
    try {
      await disconnectCalendar(calendarId);
      console.log('Calendar disconnected');
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleSync = async (calendarId: string) => {
    try {
      await syncCalendar(calendarId);
      console.log('Sync triggered');
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchCalendars();
      console.log('Calendars refreshed');
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  };

  return (
    <div>
      {calendars.map(calendar => (
        <div key={calendar.id}>
          <span>{calendar.calendarName}</span>
          <button onClick={() => handleSync(calendar.id)}>Sync</button>
          <button onClick={() => handleDisconnect(calendar.id)}>Disconnect</button>
        </div>
      ))}
      <button onClick={handleRefresh}>Refresh All</button>
    </div>
  );
}
```

---

## Zustand Store Usage

### Reading State

```typescript
import { useCalendars } from './hooks/useCalendars';

function MyComponent() {
  // Subscribe to entire store
  const { calendars, isLoading, error } = useCalendars();

  // Or subscribe to specific values
  const calendars = useCalendars(state => state.calendars);
  const isLoading = useCalendars(state => state.isLoading);

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <p>Connected: {calendars.length} calendars</p>
    </div>
  );
}
```

### Calling Actions

```typescript
import { useCalendars } from './hooks/useCalendars';

function Actions() {
  const fetchCalendars = useCalendars(state => state.fetchCalendars);
  const disconnectCalendar = useCalendars(state => state.disconnectCalendar);
  const syncCalendar = useCalendars(state => state.syncCalendar);
  const initiateOAuth = useCalendars(state => state.initiateOAuth);
  const clearError = useCalendars(state => state.clearError);

  // All actions are async and can be awaited
  const loadData = async () => {
    await fetchCalendars();
  };

  return <button onClick={loadData}>Load Calendars</button>;
}
```

---

## Date Utility Functions

```typescript
import {
  formatRelativeTime,
  formatDate,
  formatDateTime,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  isSameDay,
  isToday,
} from './utils/time';

// Format timestamps
const lastSync = formatRelativeTime('2024-01-15T10:30:00Z');
// "2 hours ago"

const eventDate = formatDate('2024-01-20T14:00:00Z');
// "Jan 20, 2024"

const fullDate = formatDateTime('2024-01-20T14:00:00Z');
// "Jan 20, 2024, 2:00 PM"

// Date calculations
const weekStart = getStartOfWeek(new Date());
const weekEnd = getEndOfWeek(new Date());
const monthStart = getStartOfMonth(new Date());
const monthEnd = getEndOfMonth(new Date());

// Date comparisons
const same = isSameDay(new Date('2024-01-20'), new Date('2024-01-20T23:59:59'));
// true

const today = isToday(new Date());
// true or false
```

---

## Error Handling Patterns

### Component Error Boundaries

```typescript
function MyComponent() {
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    setError(null);
    try {
      await someAsyncAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded" role="alert">
          {error}
        </div>
      )}
      <button onClick={handleAction}>Do Something</button>
    </div>
  );
}
```

### Using Toast Notifications

```typescript
import { useToast } from './hooks/useToast';

function MyComponent() {
  const { success, error: showError, info } = useToast();

  const handleSuccess = async () => {
    try {
      await someAction();
      success('Action completed successfully!');
    } catch (err) {
      showError('Action failed. Please try again.');
    }
  };

  return <button onClick={handleSuccess}>Do Action</button>;
}
```

---

## TypeScript Type Guards

```typescript
// Check if event is all-day
function isAllDayEvent(event: CalendarEvent): boolean {
  return event.isAllDay;
}

// Check if event is ongoing
function isEventOngoing(event: CalendarEvent): boolean {
  const now = new Date();
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  return now >= start && now <= end;
}

// Check if event is past
function isEventPast(event: CalendarEvent): boolean {
  return new Date(event.endTime) < new Date();
}

// Get provider display name
function getProviderName(provider: 'GOOGLE' | 'MICROSOFT' | 'APPLE'): string {
  const names = {
    GOOGLE: 'Google Calendar',
    MICROSOFT: 'Microsoft Outlook',
    APPLE: 'Apple Calendar',
  };
  return names[provider];
}
```

---

## Routing Integration

```typescript
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  const goToCalendar = () => {
    navigate('/calendar');
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  const goToOAuthCallback = (provider: string) => {
    navigate(`/oauth/${provider}/callback`);
  };

  return (
    <div>
      <button onClick={goToCalendar}>View Calendar</button>
      <button onClick={goToDashboard}>Dashboard</button>
    </div>
  );
}
```

---

## Styling Examples

### Custom Event Card Styling

```tsx
// Override default styling with custom classes
<CalendarEventCard
  event={event}
  onClick={handleClick}
  className="shadow-lg hover:shadow-xl" // Custom classes
/>
```

### Provider-Specific Colors

```typescript
const providerColors = {
  GOOGLE: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-500',
  },
  MICROSOFT: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-500',
  },
  APPLE: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-500',
  },
};

// Usage
<div className={`${providerColors[calendar.provider].bg} ${providerColors[calendar.provider].text}`}>
  {calendar.calendarName}
</div>
```

---

## Testing Examples

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarEventCard from './CalendarEventCard';

test('renders event card with title', () => {
  const event: CalendarEvent = {
    id: '1',
    title: 'Test Event',
    startTime: '2024-01-20T10:00:00Z',
    endTime: '2024-01-20T11:00:00Z',
    // ... other required fields
  };

  render(<CalendarEventCard event={event} />);
  expect(screen.getByText('Test Event')).toBeInTheDocument();
});

test('calls onClick when clicked', () => {
  const handleClick = jest.fn();
  const event = { /* ... */ };

  render(<CalendarEventCard event={event} onClick={handleClick} />);
  fireEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalledWith(event);
});
```

### API Testing

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import calendarApi from './api/calendar';

const server = setupServer(
  rest.get('/api/events', (req, res, ctx) => {
    return res(ctx.json([
      {
        id: '1',
        title: 'Test Event',
        // ... other fields
      }
    ]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('fetches events successfully', async () => {
  const start = new Date('2024-01-01');
  const end = new Date('2024-01-31');
  const events = await calendarApi.getEvents(start, end);
  expect(events).toHaveLength(1);
  expect(events[0].title).toBe('Test Event');
});
```

---

## Common Issues & Solutions

### Issue: OAuth redirect doesn't work

**Solution:** Ensure OAuth redirect URIs are configured in provider console:
```
Google: https://yourdomain.com/oauth/google/callback
Microsoft: https://yourdomain.com/oauth/microsoft/callback
Apple: https://yourdomain.com/oauth/apple/callback
```

### Issue: Events not loading

**Solution:** Check date range and API endpoint:
```typescript
// Ensure dates are valid
const start = new Date('2024-01-01');
const end = new Date('2024-01-31');
console.log('Fetching events:', start.toISOString(), end.toISOString());

const events = await calendarApi.getEvents(start, end);
console.log('Received events:', events.length);
```

### Issue: Modal not showing

**Solution:** Check state and conditional rendering:
```typescript
const [isOpen, setIsOpen] = useState(false);
console.log('Modal open:', isOpen); // Debug

return (
  <>
    <button onClick={() => setIsOpen(true)}>Open</button>
    {isOpen && <CalendarSelectionModal isOpen={isOpen} onClose={() => setIsOpen(false)} />}
  </>
);
```

### Issue: TypeScript errors with providers

**Solution:** Use proper type assertions:
```typescript
const provider = 'google' as 'google' | 'microsoft' | 'apple';
// Or
const provider: 'GOOGLE' | 'MICROSOFT' | 'APPLE' = 'GOOGLE';
```

---

## Performance Tips

1. **Memoize expensive calculations:**
```typescript
import { useMemo } from 'react';

const groupedEvents = useMemo(() => {
  return groupEventsByDate(events);
}, [events]);
```

2. **Debounce navigation:**
```typescript
import { useCallback } from 'react';
import debounce from 'lodash/debounce';

const debouncedNavigate = useCallback(
  debounce((direction: 'prev' | 'next') => {
    navigate(direction);
  }, 300),
  []
);
```

3. **Lazy load components:**
```typescript
import { lazy, Suspense } from 'react';

const UnifiedCalendarView = lazy(() => import('./components/UnifiedCalendarView'));

function CalendarPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <UnifiedCalendarView />
    </Suspense>
  );
}
```

---

## Additional Resources

- [React Router Documentation](https://reactrouter.com/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [Google Calendar API](https://developers.google.com/calendar)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
