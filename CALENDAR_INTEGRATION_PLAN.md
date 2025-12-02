# Calendar Integration Plan

## Overview

Integrate the alon-cal calendar application into the main Personal AI app as a new "Calendar" tab in the navbar. Both apps will share authentication and run their backends independently.

---

## Architecture Decision

**Approach: Unified Frontend with Dual Backends**

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Unified)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Dashboard│  │ Calendar │  │ Profile  │  │  Login   │    │
│  │  (Tasks) │  │  (NEW)   │  │          │  │          │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│  ┌────▼─────────────▼─────────────▼─────────────▼────┐     │
│  │              Shared Auth Store (Zustand)           │     │
│  │              Shared API Client (Axios)             │     │
│  └────┬─────────────┬─────────────────────────────────┘     │
└───────┼─────────────┼───────────────────────────────────────┘
        │             │
        ▼             ▼
┌───────────────┐  ┌───────────────┐
│ FastAPI       │  │ Express       │
│ Backend       │  │ Backend       │
│ (Tasks/Chat)  │  │ (Calendar)    │
│ Port: 8000    │  │ Port: 3001    │
└───────────────┘  └───────────────┘
        │                   │
        ▼                   ▼
┌───────────────┐  ┌───────────────┐
│ PostgreSQL    │  │ PostgreSQL    │
│ (Tasks DB)    │  │ (Calendar DB) │
└───────────────┘  └───────────────┘
```

---

## Implementation Steps

### Phase 1: Shared Authentication Setup

**Goal**: Make both backends accept the same JWT tokens

#### 1.1 Align JWT Configuration
- [ ] Update alon-cal backend to use the same `JWT_SECRET` as the main app
- [ ] Ensure token format compatibility (both use Bearer tokens)
- [ ] Test cross-authentication

**Files to modify:**
- `alon-cal/backend/.env` - Set JWT_SECRET to match main app
- `alon-cal/backend/src/utils/auth.ts` - Verify JWT verification logic

#### 1.2 User ID Mapping Strategy
- [ ] Option A: Use email as the shared identifier (recommended - simpler)
- [ ] Option B: Create a user mapping table
- [ ] Decision: Use **email** since both systems store user email

---

### Phase 2: Frontend Integration

**Goal**: Add Calendar tab to main app navbar and route to calendar page

#### 2.1 Add TypeScript Support to Main Frontend
- [ ] Install TypeScript and related dependencies
- [ ] Create `tsconfig.json`
- [ ] Rename key files from `.jsx` to `.tsx` (incremental migration)

**OR** (Alternative - Keep JSX):
- [ ] Copy calendar components as JSX versions
- [ ] Create JSX wrappers for TypeScript components

**Recommendation**: Keep as JSX, convert calendar components to JSX for consistency.

#### 2.2 Update Navigation/Navbar
- [ ] Add "Calendar" tab to Dashboard navbar
- [ ] Use React Router to navigate between Dashboard and Calendar views

**File to modify:** `frontend/src/pages/Dashboard.jsx`

```jsx
// Add to navbar alongside Tasks/Chat toggle:
<NavLink to="/calendar">Calendar</NavLink>
```

#### 2.3 Create Calendar Page
- [ ] Create new page: `frontend/src/pages/Calendar.jsx`
- [ ] Import and adapt components from alon-cal

**New file:** `frontend/src/pages/Calendar.jsx`

#### 2.4 Copy Calendar Components
Copy from `alon-cal/frontend/src/` to `frontend/src/`:

**Core Components (required):**
- [ ] `components/UnifiedCalendarView.tsx` → `.jsx`
- [ ] `components/MonthCalendarGrid.tsx` → `.jsx`
- [ ] `components/WeekCalendarGrid.tsx` → `.jsx`
- [ ] `components/CalendarSidebar.tsx` → `.jsx`
- [ ] `components/CalendarCard.tsx` → `.jsx`
- [ ] `components/CalendarEventCard.tsx` → `.jsx`
- [ ] `components/EventDetailsModal.tsx` → `.jsx`
- [ ] `components/CreateEventModal.tsx` → `.jsx`
- [ ] `components/ConnectCalendarModal.tsx` → `.jsx`
- [ ] `components/CalendarSelectionModal.tsx` → `.jsx`
- [ ] `components/TodaysPlanPanel.tsx` → `.jsx`
- [ ] `components/LiveClock.tsx` → `.jsx`
- [ ] `components/EmptyState.tsx` → `.jsx`
- [ ] `components/CreateEventButton.tsx` → `.jsx`

**Supporting Components:**
- [ ] `components/AddICSCalendar.tsx` → `.jsx`
- [ ] `components/AttendeeInput.tsx` → `.jsx`
- [ ] `components/RecurrenceSelector.tsx` → `.jsx`
- [ ] `components/ProviderIcon.tsx` → `.jsx`
- [ ] `components/ImportanceBadge.tsx` → `.jsx`
- [ ] `components/OutlookCategoriesBadges.tsx` → `.jsx`
- [ ] `components/TeamsMeetingBadge.tsx` → `.jsx`
- [ ] `components/CalendarSkeleton.tsx` → `.jsx`

**Utilities:**
- [ ] `utils/calendarGrid.ts` → `.js`
- [ ] `utils/calendarColors.ts` → `.js`
- [ ] `utils/dateTime.ts` → `.js`
- [ ] `utils/time.ts` → `.js`

**Types (convert to JSDoc or PropTypes):**
- [ ] `types/event.ts` - Convert to PropTypes or JSDoc
- [ ] `types/index.ts` - Convert to PropTypes or JSDoc

**Hooks:**
- [ ] `hooks/useCalendars.ts` → `.js`
- [ ] `hooks/useCreateEvent.ts` → `.js`
- [ ] `hooks/useToast.ts` → `.js`

**API Layer:**
- [ ] `api/calendar.ts` → `.js`
- [ ] `api/events.ts` → `.js`

#### 2.5 Create Calendar API Client
- [ ] Create `frontend/src/api/calendarClient.js`
- [ ] Configure to point to alon-cal backend (port 3001)
- [ ] Use shared auth token from localStorage

**New file:** `frontend/src/api/calendarClient.js`

```javascript
import axios from 'axios';

const CALENDAR_API_URL = import.meta.env.VITE_CALENDAR_API_URL || 'http://localhost:3001';

export const calendarApi = axios.create({
  baseURL: CALENDAR_API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Use same token as main app
calendarApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### 2.6 Update App.jsx Routes
- [ ] Add `/calendar` route
- [ ] Add `/calendar/oauth/callback` route for OAuth flows

**File to modify:** `frontend/src/App.jsx`

```jsx
<Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
<Route path="/calendar/oauth/:provider/callback" element={<ProtectedRoute><OAuthCallback /></ProtectedRoute>} />
```

---

### Phase 3: OAuth Flow Handling

**Goal**: Make Google/Microsoft OAuth work within unified frontend

#### 3.1 Update OAuth Callback URLs
- [ ] Update Google Cloud Console redirect URI
- [ ] Update Microsoft Azure AD redirect URI
- [ ] Point both to main frontend URL + `/calendar/oauth/:provider/callback`

#### 3.2 Create OAuth Callback Page
- [ ] Create `frontend/src/pages/OAuthCallback.jsx`
- [ ] Handle OAuth code exchange via alon-cal backend
- [ ] Redirect back to calendar page after success

---

### Phase 4: Environment Configuration

#### 4.1 Frontend Environment Variables
Add to `frontend/.env`:
```
VITE_API_BASE_URL=http://localhost:8000  # Main backend (tasks/chat)
VITE_CALENDAR_API_URL=http://localhost:3001  # Calendar backend
```

#### 4.2 Backend Environment Variables
Ensure `alon-cal/backend/.env` has:
```
JWT_SECRET=<same as main app>
FRONTEND_URL=http://localhost:5173  # Same frontend URL
```

---

### Phase 5: Styling Consistency

#### 5.1 Align Design Systems
- [ ] alon-cal uses TailwindCSS - main app uses inline styles + TailwindCSS
- [ ] Ensure TailwindCSS config includes calendar component classes
- [ ] Adjust colors to match main app's glassmorphism theme if desired

#### 5.2 Component Styling Updates
- [ ] Update calendar components to use main app's color palette
- [ ] Match navbar styling between Dashboard and Calendar views

---

### Phase 6: User Experience Enhancements

#### 6.1 Unified Navbar Component
- [ ] Extract navbar from Dashboard.jsx into shared component
- [ ] Use across Dashboard, Calendar, and Profile pages
- [ ] Add active state styling for current tab

**New file:** `frontend/src/components/Navbar.jsx`

#### 6.2 Cross-Feature Integration
- [ ] Show upcoming calendar events in Dashboard sidebar
- [ ] Allow Claude AI to reference calendar for scheduling suggestions
- [ ] Add "Create Task from Event" functionality (future)

---

## File Structure After Integration

```
frontend/src/
├── api/
│   ├── client.js           # Main app API (tasks/chat)
│   └── calendarClient.js   # Calendar API (NEW)
├── components/
│   ├── ChatInterface.jsx
│   ├── TaskItem.jsx
│   ├── AddTaskForm.jsx
│   ├── Navbar.jsx          # (NEW) Shared navbar
│   └── calendar/           # (NEW) Calendar components folder
│       ├── UnifiedCalendarView.jsx
│       ├── MonthCalendarGrid.jsx
│       ├── WeekCalendarGrid.jsx
│       ├── CalendarSidebar.jsx
│       ├── CalendarCard.jsx
│       ├── CalendarEventCard.jsx
│       ├── EventDetailsModal.jsx
│       ├── CreateEventModal.jsx
│       ├── ConnectCalendarModal.jsx
│       ├── CalendarSelectionModal.jsx
│       ├── TodaysPlanPanel.jsx
│       ├── LiveClock.jsx
│       ├── EmptyState.jsx
│       ├── CreateEventButton.jsx
│       ├── AddICSCalendar.jsx
│       ├── AttendeeInput.jsx
│       ├── RecurrenceSelector.jsx
│       ├── ProviderIcon.jsx
│       ├── ImportanceBadge.jsx
│       ├── OutlookCategoriesBadges.jsx
│       ├── TeamsMeetingBadge.jsx
│       └── CalendarSkeleton.jsx
├── hooks/
│   ├── useTasks.js
│   └── calendar/           # (NEW) Calendar hooks folder
│       ├── useCalendars.js
│       ├── useCreateEvent.js
│       └── useToast.js
├── pages/
│   ├── Dashboard.jsx
│   ├── Calendar.jsx        # (NEW)
│   ├── OAuthCallback.jsx   # (NEW)
│   ├── Profile.jsx
│   ├── Login.jsx
│   └── Signup.jsx
├── utils/
│   ├── authStore.js
│   ├── chatStore.js
│   └── calendar/           # (NEW) Calendar utilities folder
│       ├── calendarGrid.js
│       ├── calendarColors.js
│       ├── dateTime.js
│       └── time.js
└── App.jsx                 # Updated with new routes
```

---

## Implementation Order

1. **Phase 1** (30 min): Configure shared JWT secret between backends
2. **Phase 2.5** (15 min): Create calendar API client
3. **Phase 2.4** (2-3 hrs): Copy and convert calendar components to JSX
4. **Phase 2.2-2.3** (1 hr): Create Calendar page and update navbar
5. **Phase 2.6** (15 min): Add routes to App.jsx
6. **Phase 3** (1 hr): Set up OAuth callback handling
7. **Phase 4** (15 min): Configure environment variables
8. **Phase 5** (1 hr): Style adjustments for consistency
9. **Phase 6.1** (30 min): Extract shared Navbar component

---

## Testing Checklist

- [ ] User can log in and access both tasks and calendar
- [ ] Calendar tab appears in navbar
- [ ] Calendar page loads and shows empty state
- [ ] User can connect Google Calendar via OAuth
- [ ] User can connect Microsoft Outlook via OAuth
- [ ] User can add ICS calendar subscriptions
- [ ] Events display correctly in month/week views
- [ ] User can create new events
- [ ] User can view event details
- [ ] User can edit and delete events
- [ ] Logout clears both task and calendar state
- [ ] OAuth redirects work correctly

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| JWT incompatibility | Auth fails | Test token format early; align secret and algorithm |
| TypeScript → JSX conversion errors | Components break | Convert incrementally; test each component |
| OAuth redirect issues | Can't connect calendars | Update callback URLs in provider consoles |
| CORS issues between frontends | API calls fail | Ensure both backends allow frontend origin |
| Styling conflicts | UI looks inconsistent | Use scoped CSS or CSS modules for calendar |

---

## Future Enhancements (Out of Scope)

- Single sign-on between apps (full user account merge)
- Calendar events as task deadlines
- AI-suggested scheduling based on calendar availability
- Mobile responsive calendar view improvements
- Push notifications for upcoming events
