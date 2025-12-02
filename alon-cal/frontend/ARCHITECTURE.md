# Frontend Architecture

## Component Hierarchy

```
App.tsx
├── ToastContainer (global)
│   └── Toast (per notification)
│
└── Routes
    ├── HomePage
    ├── LoginPage
    ├── SignupPage
    ├── DashboardPage
    │   ├── UserMenu
    │   │   └── Dropdown (user info, logout)
    │   ├── CalendarList
    │   │   └── CalendarCard (per calendar)
    │   │       ├── ProviderIcon
    │   │       └── ConfirmationModal (disconnect)
    │   ├── EmptyState (no calendars)
    │   ├── CalendarSkeletonGrid (loading)
    │   └── ConnectCalendarModal
    │       └── ProviderIcon (per provider)
    └── OAuthCallbackPage
        └── Status display (loading/success/error)
```

## State Management Flow

```
User Action → Component → Hook/Store → API → Backend
                ↓            ↓
            Local State   Global State
                          (Zustand)
```

### Global State (Zustand)

**useCalendars**
- Calendars list
- Loading states
- Error messages
- API operations

**useToast**
- Toast notifications queue
- Add/remove toasts

**useAuth** (existing)
- User authentication
- Token management
- Login/logout

### Local State (React useState)

- Modal visibility
- Form inputs
- UI interactions
- Temporary data

## Data Flow

### 1. Fetch Calendars
```
DashboardPage
  ↓
useCalendars.fetchCalendars()
  ↓
calendarApi.getCalendars()
  ↓
api.get('/api/calendars')
  ↓
Backend returns Calendar[]
  ↓
Update calendars state
  ↓
Re-render CalendarList
```

### 2. Connect Calendar
```
User clicks "Connect Calendar"
  ↓
ConnectCalendarModal opens
  ↓
User selects provider (Google/Microsoft)
  ↓
useCalendars.initiateOAuth(provider)
  ↓
calendarApi.getGoogleAuthUrl()
  ↓
api.get('/api/oauth/google/login')
  ↓
Backend returns { authUrl }
  ↓
window.location.href = authUrl
  ↓
User authorizes on Google
  ↓
Google redirects to /oauth/google/callback?code=...
  ↓
OAuthCallbackPage processes callback
  ↓
api.get('/api/oauth/google/callback?code=...')
  ↓
Backend creates calendar connection
  ↓
Redirect to /dashboard
  ↓
fetchCalendars() updates list
```

### 3. Disconnect Calendar
```
User clicks disconnect button
  ↓
ConfirmationModal opens
  ↓
User confirms
  ↓
useCalendars.disconnectCalendar(id)
  ↓
calendarApi.disconnectCalendar(id)
  ↓
api.delete(`/api/calendars/${id}`)
  ↓
Remove from local state
  ↓
Show success toast
  ↓
Re-render CalendarList
```

### 4. Sync Calendar
```
User clicks sync button
  ↓
useCalendars.syncCalendar(id)
  ↓
calendarApi.syncCalendar(id)
  ↓
api.post(`/api/calendars/${id}/sync`)
  ↓
Update lastSyncedAt in state
  ↓
Show success toast
  ↓
Re-render CalendarCard
```

## API Integration

### Base Configuration
```typescript
// lib/api.ts
const api = axios.create({
  baseURL: 'http://localhost:3001',
  withCredentials: true
});

// Request interceptor adds auth token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor handles 401
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/calendars` | GET | Fetch all calendars |
| `/api/calendars/:id` | DELETE | Disconnect calendar |
| `/api/calendars/:id/sync` | POST | Trigger sync |
| `/api/oauth/google/login` | GET | Get Google OAuth URL |
| `/api/oauth/microsoft/login` | GET | Get Microsoft OAuth URL |
| `/api/oauth/google/callback` | GET | Handle Google callback |
| `/api/oauth/microsoft/callback` | GET | Handle Microsoft callback |

## Routing

```typescript
// App.tsx routes
/                              → HomePage
/login                         → LoginPage
/signup                        → SignupPage
/dashboard                     → DashboardPage (protected)
/oauth/google/callback         → OAuthCallbackPage (protected)
/oauth/microsoft/callback      → OAuthCallbackPage (protected)
*                              → Navigate to /
```

## Error Handling Strategy

### API Errors
```typescript
try {
  await calendarApi.getCalendars();
} catch (error) {
  // Store error in state
  set({ error: error.message });

  // Show user-friendly toast
  showError('Failed to load calendars');

  // Log for debugging
  console.error('Calendar fetch error:', error);
}
```

### OAuth Errors
```typescript
// Check URL params for errors
const error = searchParams.get('error');
const errorDescription = searchParams.get('error_description');

if (error) {
  setStatus('error');
  setErrorMessage(errorDescription || 'Authorization denied');
}
```

### Network Errors
- 401: Redirect to login
- 403: Show permission error
- 404: Show not found
- 500: Show server error + retry option

## Loading States

### Skeleton Loading
- Show while fetching calendars
- Matches final layout
- Animated shimmer effect

### Spinner Loading
- OAuth callback processing
- Modal actions (disconnect, sync)
- Button actions

### Inline Loading
- Sync button (spinning icon)
- Form submissions

## Toast Notification Strategy

### Success Messages
- "Calendar connected successfully"
- "Calendar disconnected"
- "Calendar sync triggered"

### Error Messages
- "Failed to load calendars"
- "Failed to connect calendar"
- "Failed to disconnect calendar"
- "Failed to sync calendar"

### Info Messages
- Used for general notifications
- Not critical success/error

## Accessibility Features

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate buttons
- ESC to close modals
- Arrow keys in dropdowns

### ARIA Attributes
```tsx
// Modals
role="dialog"
aria-modal="true"
aria-labelledby="modal-title"

// Icon buttons
aria-label="Disconnect calendar"
title="Disconnect calendar"

// Status indicators
role="img"
aria-label="Google Calendar"

// Alerts
role="alert"
aria-live="polite"
```

### Focus Management
- Trap focus in modals
- Auto-focus on modal open
- Return focus on close
- Visible focus states

## Performance Optimizations

### React Query (configured)
- Cache API responses (5 min stale time)
- Automatic retry on failure
- No refetch on window focus

### Component Optimization
- Use `useCallback` for event handlers
- Memoize expensive computations
- Avoid unnecessary re-renders

### Code Splitting (future)
- Lazy load routes
- Lazy load modals
- Dynamic imports for large components

## Security Considerations

### Authentication
- Token stored in localStorage
- Token sent in Authorization header
- Automatic logout on 401

### OAuth Security
- State parameter validation
- HTTPS required in production
- Token exchange server-side only

### XSS Prevention
- React auto-escapes content
- Validate user input
- Sanitize HTML if needed

## Testing Strategy

### Unit Tests (future)
- Utility functions (time formatting)
- API functions (mocked)
- Component logic

### Integration Tests (future)
- Component interactions
- State management
- API integration

### E2E Tests (future)
- Complete user flows
- OAuth flow
- Calendar management

## Environment Variables

```bash
# .env
VITE_API_URL=http://localhost:3001
```

## Build and Deploy

### Development
```bash
npm run dev
# Runs on http://localhost:5173
```

### Production Build
```bash
npm run build
# Creates optimized build in dist/
```

### Preview
```bash
npm run preview
# Preview production build locally
```

## Browser Support

- Chrome/Edge (Chromium) - last 2 versions
- Firefox - last 2 versions
- Safari - last 2 versions
- Mobile browsers - iOS Safari, Chrome Mobile

## Dependencies

### Production
- `react` - UI library
- `react-dom` - DOM rendering
- `react-router-dom` - Routing
- `@tanstack/react-query` - Data fetching
- `axios` - HTTP client
- `zustand` - State management

### Development
- `vite` - Build tool
- `typescript` - Type checking
- `tailwindcss` - CSS framework
- `eslint` - Linting

## File Size Budget

- Initial bundle: < 200 KB (gzipped)
- Component chunks: < 50 KB each
- Total page load: < 1 MB

## Future Enhancements

### Planned Features
1. Real-time sync via WebSocket
2. Calendar event display
3. Event creation/editing
4. Bulk operations
5. Calendar search/filter
6. Export calendars
7. Calendar sharing

### Technical Improvements
1. Add unit tests
2. Add E2E tests
3. Implement error boundaries
4. Add logging service
5. Add analytics
6. Optimize bundle size
7. Add service worker (PWA)

## Debugging Tips

### React DevTools
- Inspect component props
- View state updates
- Profile performance

### Network Tab
- Monitor API calls
- Check request/response
- Verify auth headers

### Console Logging
- API errors logged to console
- State changes logged in dev mode
- OAuth flow steps logged

### Zustand DevTools
```typescript
// Add devtools in development
import { devtools } from 'zustand/middleware';

export const useCalendars = create<CalendarState>()(
  devtools(
    (set, get) => ({ ... }),
    { name: 'CalendarStore' }
  )
);
```
