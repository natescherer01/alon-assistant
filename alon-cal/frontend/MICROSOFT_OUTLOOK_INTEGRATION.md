# Microsoft Outlook Calendar Integration - Frontend Implementation

## Overview

This document describes the frontend UI components for Microsoft Outlook calendar integration in the Alon-Cal application.

## Features Implemented

### 1. Calendar Connection Flow

**Component:** `ConnectCalendarModal.tsx`
- Microsoft Outlook button with proper branding
- OAuth flow initiation via `/api/oauth/microsoft/login`
- Loading state during OAuth redirect
- Consistent with existing Google Calendar pattern

### 2. Calendar Selection UI

**Component:** `CalendarSelectionModal.tsx`
- Shows list of available Microsoft calendars after OAuth
- Displays calendar metadata:
  - Calendar name
  - Owner email (for shared/delegated calendars)
  - Calendar type badges (Personal, Shared, Delegated)
  - Primary calendar indicator
  - Calendar color
- Multi-select capability with checkboxes
- Select All / Deselect All functionality
- Saves selections via `POST /api/oauth/microsoft/select`

### 3. Calendar List Display

**Component:** `CalendarCard.tsx`
- Microsoft badge with orange branding (#FF8C00)
- Calendar type indicators (Shared, Delegated)
- Owner email display for shared/delegated calendars
- Real-time sync status:
  - Green dot: Connected
  - Yellow pulsing dot: Syncing
  - Red dot: Disconnected
- Sync error messages
- Manual sync button
- Disconnect button

### 4. Event Display Enhancements

**Components:** `WeekCalendarGrid.tsx`, `MonthCalendarGrid.tsx`

#### Teams Meeting Support
- Teams icon badge on events with Teams meetings
- Clickable "Join Teams Meeting" button in tooltips
- Opens Teams meeting in new tab
- Stops event propagation to prevent calendar navigation

#### High Priority Indicator
- Red exclamation mark (!) for high importance events
- Displays in both grid view and tooltips

#### Outlook Categories
- Purple category badges in event tooltips
- Shows all categories with proper styling
- Consistent with Outlook's category system

#### Shared Calendar Source
- "From: [email]" indicator for delegated calendar events
- Shows in event tooltips

#### Provider Badge
- "Outlook" badge in orange for Microsoft events
- Distinguishes from Google Calendar events

### 5. OAuth Callback Handling

**Component:** `OAuthCallbackPage.tsx`
- Already handles Microsoft OAuth callbacks
- Parses `session` and `provider` parameters
- Shows calendar selection modal after successful auth
- Error handling for:
  - Authorization denied
  - Session expired
  - Missing parameters
  - Network errors

### 6. API Client Functions

**File:** `api/calendar.ts`

Enhanced interfaces:
```typescript
interface Calendar {
  // ... existing fields
  ownerEmail?: string;
  calendarType?: 'personal' | 'shared' | 'delegated';
  isSyncing?: boolean;
  syncError?: string;
}

interface ProviderCalendar {
  // ... existing fields
  ownerEmail?: string;
  calendarType?: 'personal' | 'shared' | 'delegated';
}

interface CalendarEvent {
  // ... existing fields
  teamsEnabled?: boolean;
  teamsMeetingUrl?: string;
  importance?: 'low' | 'normal' | 'high';
  outlookCategories?: string[];
  delegateEmail?: string;
}
```

API functions already exist:
- `getMicrosoftAuthUrl()` - Get OAuth URL
- `selectMicrosoftCalendars()` - Select calendars to sync
- `getOAuthSession()` - Retrieve session data

### 7. Reusable Components

#### `TeamsMeetingBadge.tsx`
```typescript
<TeamsMeetingBadge
  teamsMeetingUrl="https://teams.microsoft.com/..."
  size="md"
  variant="button"
/>
```
- Two variants: icon or full button
- Three sizes: sm, md, lg
- Accessible with proper ARIA labels

#### `ImportanceBadge.tsx`
```typescript
<ImportanceBadge
  importance="high"
  variant="badge"
/>
```
- Shows high/low priority markers
- Icon or badge variant
- Only displays for non-normal importance

#### `OutlookCategoriesBadges.tsx`
```typescript
<OutlookCategoriesBadges
  categories={['Important', 'Work', 'Meeting']}
  maxDisplay={3}
/>
```
- Displays Outlook categories with purple badges
- Configurable max display count
- "+N more" indicator for overflow

#### `ProviderIcon.tsx`
Enhanced with Microsoft branding:
- SVG icon with official Outlook blue (#0078D4)
- Envelope design consistent with Outlook branding
- Responsive sizing (sm, md, lg)

## Microsoft Branding Guidelines

### Colors
- **Primary:** `#0078D4` (Microsoft Blue)
- **Secondary:** `#FF8C00` (Orange for badges)
- **Accent:** `#737373` (Gray for neutral elements)

### Typography
- Use "Microsoft Outlook" or "Outlook" (not just "Microsoft")
- Use "Microsoft 365" when referring to the broader suite

### Visual Elements
- Teams icon uses Microsoft's official SVG path
- Outlook icon uses simplified envelope design
- Consistent with Microsoft Fluent Design principles

## Accessibility Features

### Keyboard Navigation
- All interactive elements focusable
- Tab order logical
- Enter/Space for activation
- Escape to close modals

### Screen Reader Support
- Proper ARIA labels on all icons
- `role="button"` on clickable elements
- `aria-label` for icon-only elements
- Descriptive link text

### Visual Accessibility
- Color contrast meets WCAG 2.1 AA standards
- Focus indicators visible
- Text alternatives for icons
- Status indicators use both color and icons

## Responsive Design

### Mobile (< 768px)
- Single-day view in week calendar
- Stacked calendar cards
- Full-width modals
- Touch-friendly button sizes

### Tablet (768px - 1024px)
- 2-column calendar grid
- Side-by-side modal layout
- Optimized spacing

### Desktop (> 1024px)
- 3-column calendar grid
- Full week view in calendar
- Hover states and tooltips

## Error Handling

### OAuth Errors
- "Authorization denied" message
- "Session expired" with retry option
- Network error detection
- Missing parameter validation

### Sync Errors
- Visual indicator (red dot)
- Error message on hover
- Manual retry option
- Toast notification

### API Errors
- Graceful degradation
- User-friendly error messages
- Retry mechanisms
- Network timeout handling

## Performance Considerations

### Event Rendering
- Virtual scrolling for large event lists
- Debounced sync operations
- Lazy loading of calendar data
- Efficient re-rendering with React keys

### Image/Icon Optimization
- SVG icons for scalability
- Inline SVGs to reduce requests
- No external icon dependencies
- Optimized icon paths

### State Management
- Zustand for global state
- Local state for UI-only data
- Memoized expensive calculations
- Efficient event grouping algorithms

## Testing Checklist

### Integration Flow
- [ ] Connect Outlook button initiates OAuth
- [ ] OAuth callback processes correctly
- [ ] Calendar selection shows all available calendars
- [ ] Calendar selection saves successfully
- [ ] Connected calendars appear in dashboard

### Calendar Display
- [ ] Shared calendars show owner email
- [ ] Delegated calendars show proper badge
- [ ] Sync status updates in real-time
- [ ] Manual sync triggers successfully
- [ ] Disconnect removes calendar

### Event Display
- [ ] Teams icon appears on Teams meetings
- [ ] Teams link is clickable and opens correctly
- [ ] High importance shows red exclamation
- [ ] Outlook categories display properly
- [ ] Delegated event shows source email

### Error Handling
- [ ] OAuth errors show appropriate messages
- [ ] Sync errors display on calendar cards
- [ ] Network errors show retry option
- [ ] Session expiration handled gracefully

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Focus indicators visible
- [ ] Color contrast sufficient

### Responsive Design
- [ ] Mobile view displays correctly
- [ ] Tablet view optimized
- [ ] Desktop view uses full width
- [ ] Touch targets appropriate size

## Future Enhancements

### Potential Features
1. Real-time webhook integration for instant sync
2. Teams meeting creation from calendar UI
3. Category color customization
4. Advanced filtering by importance/category
5. Bulk operations (sync all, disconnect all)
6. Calendar sharing settings management
7. Out-of-office status display
8. Meeting room availability
9. Recurring event patterns visualization
10. Calendar overlay mode

### Performance Optimizations
1. Progressive Web App capabilities
2. Service worker for offline support
3. IndexedDB caching for events
4. WebSocket for real-time updates
5. Code splitting by route
6. Dynamic imports for modals
7. Image lazy loading
8. Bundle size optimization

## Support and Documentation

### User Documentation
- In-app help tooltips
- FAQ section for common issues
- Video tutorials for setup
- Troubleshooting guide

### Developer Documentation
- Component API documentation
- State management guide
- Testing guidelines
- Contribution guidelines

## Related Files

### Components
- `/frontend/src/components/ConnectCalendarModal.tsx`
- `/frontend/src/components/CalendarSelectionModal.tsx`
- `/frontend/src/components/CalendarCard.tsx`
- `/frontend/src/components/WeekCalendarGrid.tsx`
- `/frontend/src/components/MonthCalendarGrid.tsx`
- `/frontend/src/components/TeamsMeetingBadge.tsx`
- `/frontend/src/components/ImportanceBadge.tsx`
- `/frontend/src/components/OutlookCategoriesBadges.tsx`
- `/frontend/src/components/ProviderIcon.tsx`

### Pages
- `/frontend/src/pages/OAuthCallbackPage.tsx`
- `/frontend/src/pages/DashboardPage.tsx`

### API
- `/frontend/src/api/calendar.ts`

### Hooks
- `/frontend/src/hooks/useCalendars.ts`
- `/frontend/src/hooks/useToast.ts`

## Contact

For questions or issues related to Microsoft Outlook integration:
- Create an issue in the project repository
- Tag with `integration:outlook` label
- Include screenshots and error messages
- Provide browser and OS information
