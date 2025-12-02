# Quick Reference Guide

## Essential Commands

```bash
# Start development server
cd /Users/natescherer/alon-cal/frontend
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Common Tasks

### Add a new toast notification
```typescript
import { useToast } from './hooks/useToast';

const { success, error, info } = useToast();

// Success
success('Operation completed!');

// Error
error('Something went wrong');

// Info
info('Processing...');
```

### Fetch calendars
```typescript
import { useCalendars } from './hooks/useCalendars';

const { calendars, isLoading, error, fetchCalendars } = useCalendars();

useEffect(() => {
  fetchCalendars();
}, [fetchCalendars]);
```

### Open connect modal
```typescript
const [showModal, setShowModal] = useState(false);

<button onClick={() => setShowModal(true)}>
  Connect Calendar
</button>

<ConnectCalendarModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
/>
```

### Format timestamps
```typescript
import { formatRelativeTime, formatDate } from './utils/time';

// "2 hours ago"
formatRelativeTime('2024-01-15T10:30:00Z');

// "Jan 15, 2024"
formatDate('2024-01-15T10:30:00Z');
```

### Show confirmation dialog
```typescript
const [showConfirm, setShowConfirm] = useState(false);

<ConfirmationModal
  isOpen={showConfirm}
  title="Delete Item"
  message="Are you sure?"
  variant="danger"
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
/>
```

## File Locations

### Components
```
/Users/natescherer/alon-cal/frontend/src/components/
├── CalendarCard.tsx
├── CalendarList.tsx
├── CalendarSkeleton.tsx
├── ConfirmationModal.tsx
├── ConnectCalendarModal.tsx
├── EmptyState.tsx
├── ProviderIcon.tsx
├── Toast.tsx
└── UserMenu.tsx
```

### Hooks
```
/Users/natescherer/alon-cal/frontend/src/hooks/
├── useAuth.ts (existing)
├── useCalendars.ts
└── useToast.ts
```

### API
```
/Users/natescherer/alon-cal/frontend/src/api/
└── calendar.ts
```

### Pages
```
/Users/natescherer/alon-cal/frontend/src/pages/
├── DashboardPage.tsx
└── OAuthCallbackPage.tsx
```

## API Endpoints

```typescript
// Fetch calendars
GET /api/calendars

// Disconnect calendar
DELETE /api/calendars/:id

// Sync calendar
POST /api/calendars/:id/sync

// Get OAuth URL
GET /api/oauth/google/login
GET /api/oauth/microsoft/login

// OAuth callback
GET /api/oauth/google/callback?code=...&state=...
GET /api/oauth/microsoft/callback?code=...&state=...
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate elements |
| Enter/Space | Activate buttons |
| Esc | Close modals |
| Arrow keys | Navigate dropdowns |

## Responsive Breakpoints

| Breakpoint | Width | Columns |
|------------|-------|---------|
| Mobile | < 768px | 1 |
| Tablet | 768-1024px | 2 |
| Desktop | > 1024px | 3 |

## Color Scheme

| Purpose | Color | Class |
|---------|-------|-------|
| Primary | Blue #2563EB | bg-blue-600 |
| Google | Blue #3B82F6 | text-blue-600 |
| Microsoft | Orange #F97316 | text-orange-600 |
| Success | Green #10B981 | bg-green-600 |
| Error | Red #DC2626 | bg-red-600 |
| Warning | Yellow #F59E0B | bg-yellow-600 |

## Common Patterns

### Loading State
```tsx
{isLoading && <CalendarSkeletonGrid />}
```

### Empty State
```tsx
{calendars.length === 0 && (
  <EmptyState onConnect={() => setShowModal(true)} />
)}
```

### Error State
```tsx
{error && (
  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
    <p className="text-red-800">{error}</p>
    <button onClick={retry}>Retry</button>
  </div>
)}
```

### List Display
```tsx
{calendars.length > 0 && (
  <CalendarList calendars={calendars} />
)}
```

## TypeScript Interfaces

### Calendar
```typescript
interface Calendar {
  id: string;
  provider: 'GOOGLE' | 'MICROSOFT';
  calendarId: string;
  calendarName: string;
  calendarColor?: string;
  isPrimary: boolean;
  isConnected: boolean;
  lastSyncedAt?: string;
  createdAt: string;
}
```

### User (from useAuth)
```typescript
interface User {
  id: string;
  email: string;
  name?: string;
}
```

## Testing URLs

| Page | URL |
|------|-----|
| Home | http://localhost:5173/ |
| Login | http://localhost:5173/login |
| Signup | http://localhost:5173/signup |
| Dashboard | http://localhost:5173/dashboard |
| Google Callback | http://localhost:5173/oauth/google/callback |
| Microsoft Callback | http://localhost:5173/oauth/microsoft/callback |

## Backend URLs

| Endpoint | URL |
|----------|-----|
| Base API | http://localhost:3001 |
| Calendars | http://localhost:3001/api/calendars |
| Google OAuth | http://localhost:3001/api/oauth/google/login |
| Microsoft OAuth | http://localhost:3001/api/oauth/microsoft/login |

## Environment Variables

```bash
# Frontend (.env)
VITE_API_URL=http://localhost:3001

# Backend (.env)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/oauth/google/callback

MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/oauth/microsoft/callback

FRONTEND_URL=http://localhost:5173
```

## Debugging

### Check Auth Token
```javascript
// In browser console
localStorage.getItem('token')
```

### Check Auth State
```javascript
// In React DevTools
// Find component using useAuth
// Inspect state
```

### Check Calendar State
```javascript
// In React DevTools
// Find component using useCalendars
// Inspect calendars, isLoading, error
```

### Network Debugging
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Check request/response for API calls

### Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check token in localStorage |
| CORS error | Verify backend CORS config |
| OAuth redirect fails | Check redirect URI matches OAuth app config |
| Calendars not loading | Verify backend is running on port 3001 |
| Toast not showing | Check ToastContainer in App.tsx |

## Code Style

### Component Structure
```tsx
import { useState } from 'react';

interface Props {
  // Props interface first
}

/**
 * Component description
 */
export default function Component({ prop }: Props) {
  // Hooks
  const [state, setState] = useState();

  // Event handlers
  const handleEvent = () => {};

  // Render
  return <div>...</div>;
}
```

### File Naming
- Components: PascalCase (CalendarCard.tsx)
- Hooks: camelCase with 'use' prefix (useCalendars.ts)
- Utils: camelCase (time.ts)
- Pages: PascalCase with 'Page' suffix (DashboardPage.tsx)

### Import Order
1. React imports
2. Third-party libraries
3. Local hooks
4. Local components
5. Local utilities
6. Types/interfaces

## Git Workflow

```bash
# Feature branch
git checkout -b feature/calendar-dashboard

# Commit changes
git add .
git commit -m "Add calendar dashboard UI"

# Push to remote
git push origin feature/calendar-dashboard
```

## Performance Tips

1. Use `useCallback` for event handlers passed to children
2. Use `useMemo` for expensive computations
3. Lazy load routes with React.lazy()
4. Optimize images (use WebP, compress)
5. Code split large components
6. Use React.memo() for pure components

## Accessibility Checklist

- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] ARIA labels on icon buttons
- [ ] Semantic HTML (header, main, nav)
- [ ] Alt text on images
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader tested

## Browser DevTools

### React DevTools
- Components tab: Inspect props/state
- Profiler tab: Performance analysis

### Chrome DevTools
- Elements: Inspect DOM/CSS
- Console: View logs/errors
- Network: Monitor API calls
- Application: Check localStorage

## Quick Fixes

### Clear Auth State
```javascript
localStorage.clear();
window.location.href = '/';
```

### Reset Calendar State
```typescript
const { fetchCalendars } = useCalendars();
fetchCalendars(); // Re-fetch from API
```

### Force Re-render
```typescript
const [, forceUpdate] = useReducer(x => x + 1, 0);
forceUpdate(); // Triggers re-render
```

## Documentation Files

1. `IMPLEMENTATION_SUMMARY.md` - Overview and checklist
2. `DASHBOARD_IMPLEMENTATION.md` - Testing guide
3. `COMPONENT_API.md` - Component reference
4. `ARCHITECTURE.md` - Technical details
5. `QUICK_REFERENCE.md` - This file

## Need Help?

1. Check documentation files above
2. Review component examples in COMPONENT_API.md
3. Check browser console for errors
4. Review backend logs
5. Test API endpoints directly with curl/Postman

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
