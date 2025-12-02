# Component API Reference

## Core Components

### CalendarCard

Displays an individual calendar with actions.

```tsx
import CalendarCard from './components/CalendarCard';

<CalendarCard calendar={calendar} />
```

**Props:**
- `calendar: Calendar` - Calendar object from API

**Features:**
- Provider icon
- Calendar name (truncated if long)
- Provider badge (Google/Microsoft)
- Primary badge (if primary calendar)
- Connection status indicator
- Last synced timestamp
- Sync button (manual sync)
- Disconnect button (with confirmation)

---

### CalendarList

Grid layout of calendar cards.

```tsx
import CalendarList from './components/CalendarList';

<CalendarList calendars={calendars} />
```

**Props:**
- `calendars: Calendar[]` - Array of calendar objects

**Layout:**
- 1 column on mobile (< 768px)
- 2 columns on tablet (768-1024px)
- 3 columns on desktop (> 1024px)

---

### ConnectCalendarModal

Modal for selecting calendar provider to connect.

```tsx
import ConnectCalendarModal from './components/ConnectCalendarModal';

const [isOpen, setIsOpen] = useState(false);

<ConnectCalendarModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
/>
```

**Props:**
- `isOpen: boolean` - Modal visibility
- `onClose: () => void` - Close callback

**Features:**
- Google Calendar option
- Microsoft Outlook option
- Loading state during OAuth redirect
- ESC key to close
- Click outside to close

---

### ConfirmationModal

Generic confirmation dialog for destructive actions.

```tsx
import ConfirmationModal from './components/ConfirmationModal';

<ConfirmationModal
  isOpen={showModal}
  title="Disconnect Calendar"
  message="Are you sure you want to disconnect this calendar?"
  confirmText="Disconnect"
  cancelText="Cancel"
  variant="danger"
  onConfirm={handleConfirm}
  onCancel={() => setShowModal(false)}
  isLoading={isProcessing}
/>
```

**Props:**
- `isOpen: boolean` - Modal visibility
- `title: string` - Modal title
- `message: string` - Confirmation message
- `confirmText?: string` - Confirm button text (default: "Confirm")
- `cancelText?: string` - Cancel button text (default: "Cancel")
- `variant?: 'default' | 'danger'` - Visual style (default: "default")
- `onConfirm: () => void` - Confirm callback
- `onCancel: () => void` - Cancel callback
- `isLoading?: boolean` - Loading state (default: false)

**Features:**
- ESC key to close
- Click outside to close
- Focus trap
- Keyboard navigation

---

### EmptyState

Empty state when no calendars are connected.

```tsx
import EmptyState from './components/EmptyState';

<EmptyState onConnect={() => setShowModal(true)} />
```

**Props:**
- `onConnect: () => void` - Callback when user clicks connect button

**Features:**
- Calendar icon
- Friendly message
- Call-to-action button

---

### UserMenu

User dropdown menu in the header.

```tsx
import UserMenu from './components/UserMenu';

<UserMenu />
```

**Props:** None (uses `useAuth` hook internally)

**Features:**
- User avatar with initials
- User name and email
- Dashboard link
- Settings link
- Logout button
- Click outside to close
- ESC key to close
- Keyboard navigation

---

### ProviderIcon

Display calendar provider icon.

```tsx
import ProviderIcon from './components/ProviderIcon';

<ProviderIcon
  provider="GOOGLE"
  size="md"
  className="custom-class"
/>
```

**Props:**
- `provider: 'GOOGLE' | 'MICROSOFT'` - Calendar provider
- `size?: 'sm' | 'md' | 'lg'` - Icon size (default: "md")
- `className?: string` - Additional CSS classes

**Sizes:**
- `sm`: 24px (w-6 h-6)
- `md`: 32px (w-8 h-8)
- `lg`: 48px (w-12 h-12)

---

### Toast

Single toast notification.

```tsx
import Toast from './components/Toast';

<Toast
  message="Calendar connected successfully"
  type="success"
  duration={5000}
  onClose={() => removeToast(id)}
/>
```

**Props:**
- `message: string` - Notification message
- `type?: 'success' | 'error' | 'info'` - Toast type (default: "info")
- `duration?: number` - Auto-dismiss duration in ms (default: 5000)
- `onClose: () => void` - Close callback

**Features:**
- Auto-dismiss after duration
- Manual close button
- Slide-in animation
- Icon based on type

---

### ToastContainer

Container for managing multiple toasts.

```tsx
import { ToastContainer } from './components/Toast';
import { useToast } from './hooks/useToast';

const { toasts, removeToast } = useToast();

<ToastContainer toasts={toasts} onRemove={removeToast} />
```

**Props:**
- `toasts: ToastItem[]` - Array of toast items
- `onRemove: (id: string) => void` - Remove toast callback

---

### CalendarSkeleton

Loading skeleton for calendar cards.

```tsx
import CalendarSkeleton, { CalendarSkeletonGrid } from './components/CalendarSkeleton';

// Single skeleton
<CalendarSkeleton />

// Grid of skeletons
<CalendarSkeletonGrid count={3} />
```

**Props:**
- `count?: number` - Number of skeleton cards (default: 3)

**Features:**
- Animated shimmer effect
- Matches CalendarCard layout

---

## Hooks

### useCalendars

Zustand store for calendar state management.

```tsx
import { useCalendars } from './hooks/useCalendars';

const {
  calendars,
  isLoading,
  error,
  fetchCalendars,
  disconnectCalendar,
  syncCalendar,
  initiateOAuth,
  clearError
} = useCalendars();
```

**State:**
- `calendars: Calendar[]` - Array of calendars
- `isLoading: boolean` - Loading state
- `error: string | null` - Error message

**Actions:**
- `fetchCalendars(): Promise<void>` - Fetch all calendars
- `disconnectCalendar(id: string): Promise<void>` - Disconnect calendar
- `syncCalendar(id: string): Promise<void>` - Trigger manual sync
- `initiateOAuth(provider: 'GOOGLE' | 'MICROSOFT'): Promise<void>` - Start OAuth flow
- `clearError(): void` - Clear error message

---

### useToast

Zustand store for toast notifications.

```tsx
import { useToast } from './hooks/useToast';

const {
  toasts,
  addToast,
  removeToast,
  success,
  error,
  info
} = useToast();
```

**State:**
- `toasts: ToastItem[]` - Array of active toasts

**Actions:**
- `addToast(message: string, type?: ToastType): void` - Add toast
- `removeToast(id: string): void` - Remove toast
- `success(message: string): void` - Show success toast
- `error(message: string): void` - Show error toast
- `info(message: string): void` - Show info toast

**Example:**
```tsx
const { success, error } = useToast();

try {
  await someOperation();
  success('Operation completed!');
} catch (err) {
  error('Operation failed');
}
```

---

## Utilities

### formatRelativeTime

Format timestamp as relative time.

```tsx
import { formatRelativeTime } from './utils/time';

const relative = formatRelativeTime('2024-01-15T10:30:00Z');
// "2 hours ago"
```

**Returns:**
- "just now" (< 1 minute)
- "X minutes ago"
- "X hours ago"
- "X days ago"
- "X months ago"
- "X years ago"

---

### formatDate

Format timestamp as readable date.

```tsx
import { formatDate } from './utils/time';

const date = formatDate('2024-01-15T10:30:00Z');
// "Jan 15, 2024"
```

---

### formatDateTime

Format timestamp with date and time.

```tsx
import { formatDateTime } from './utils/time';

const datetime = formatDateTime('2024-01-15T10:30:00Z');
// "Jan 15, 2024, 10:30 AM"
```

---

## API Functions

### calendarApi

Calendar API integration functions.

```tsx
import calendarApi from './api/calendar';

// Fetch calendars
const calendars = await calendarApi.getCalendars();

// Disconnect calendar
await calendarApi.disconnectCalendar(calendarId);

// Sync calendar
await calendarApi.syncCalendar(calendarId);

// Get OAuth URL
const googleUrl = await calendarApi.getGoogleAuthUrl();
const microsoftUrl = await calendarApi.getMicrosoftAuthUrl();
```

**Methods:**
- `getCalendars(): Promise<Calendar[]>`
- `disconnectCalendar(id: string): Promise<void>`
- `syncCalendar(id: string): Promise<void>`
- `getGoogleAuthUrl(): Promise<string>`
- `getMicrosoftAuthUrl(): Promise<string>`

---

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

### ToastItem

```typescript
interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
```

---

## Usage Examples

### Complete Calendar Connection Flow

```tsx
import { useState, useEffect } from 'react';
import { useCalendars } from './hooks/useCalendars';
import { useToast } from './hooks/useToast';
import CalendarList from './components/CalendarList';
import ConnectCalendarModal from './components/ConnectCalendarModal';
import EmptyState from './components/EmptyState';
import { CalendarSkeletonGrid } from './components/CalendarSkeleton';

function CalendarPage() {
  const { calendars, isLoading, error, fetchCalendars } = useCalendars();
  const { success, error: showError } = useToast();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  const handleConnectSuccess = () => {
    success('Calendar connected successfully!');
    fetchCalendars();
  };

  if (isLoading) return <CalendarSkeletonGrid />;
  if (error) return <div>Error: {error}</div>;
  if (calendars.length === 0) {
    return <EmptyState onConnect={() => setShowModal(true)} />;
  }

  return (
    <div>
      <button onClick={() => setShowModal(true)}>
        Connect Calendar
      </button>
      <CalendarList calendars={calendars} />
      <ConnectCalendarModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
```

### Disconnect Calendar with Confirmation

```tsx
import { useState } from 'react';
import { useCalendars } from './hooks/useCalendars';
import { useToast } from './hooks/useToast';
import ConfirmationModal from './components/ConfirmationModal';

function DisconnectButton({ calendarId, calendarName }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { disconnectCalendar } = useCalendars();
  const { success, error } = useToast();

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectCalendar(calendarId);
      success('Calendar disconnected');
      setShowConfirm(false);
    } catch (err) {
      error('Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <>
      <button onClick={() => setShowConfirm(true)}>
        Disconnect
      </button>
      <ConfirmationModal
        isOpen={showConfirm}
        title="Disconnect Calendar"
        message={`Disconnect "${calendarName}"?`}
        variant="danger"
        onConfirm={handleDisconnect}
        onCancel={() => setShowConfirm(false)}
        isLoading={isDisconnecting}
      />
    </>
  );
}
```
