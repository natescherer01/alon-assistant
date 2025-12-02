# Critical Fixes Required - Event Details Feature

**PRIORITY: HIGH**
**Estimated Time: 4-6 hours**
**Status: BLOCKING PRODUCTION DEPLOYMENT**

---

## Fix #1: Add isReadOnly Flag to API Response

**File:** `/Users/natescherer/alon-cal/backend/src/controllers/eventController.ts`
**Line:** 387
**Severity:** CRITICAL

### Current Code
```typescript
res.status(200).json({
  event: {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    isAllDay: event.isAllDay,
    timezone: event.timezone,
    status: event.status,
    isRecurring: event.isRecurring,
    recurrenceRule: event.recurrenceRule,
    attendees: event.attendees,
    reminders: event.reminders,
    htmlLink: event.htmlLink,
    calendar: {
      provider: event.calendarConnection.provider,
      name: event.calendarConnection.calendarName,
      color: event.calendarConnection.calendarColor,
      // MISSING: isReadOnly flag
    },
    providerMetadata: event.providerMetadata,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  },
});
```

### Fixed Code
```typescript
res.status(200).json({
  event: {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    isAllDay: event.isAllDay,
    timezone: event.timezone,
    status: event.status,
    isRecurring: event.isRecurring,
    recurrenceRule: event.recurrenceRule,
    attendees: event.attendees,
    reminders: event.reminders,
    htmlLink: event.htmlLink,
    calendar: {
      provider: event.calendarConnection.provider,
      name: event.calendarConnection.calendarName,
      color: event.calendarConnection.calendarColor,
      isReadOnly: event.calendarConnection.isReadOnly,  // ADD THIS LINE
    },
    providerMetadata: event.providerMetadata,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  },
});
```

### Verification
```bash
# Test the API endpoint
curl -X GET http://localhost:3001/api/events/EVENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.event.calendar.isReadOnly'

# Should return: true or false
```

---

## Fix #2: Implement Optimistic Locking

**File:** `/Users/natescherer/alon-cal/backend/src/services/eventManagementService.ts`
**Line:** 48-119
**Severity:** CRITICAL

### Current Code
```typescript
async updateEvent(userId: string, eventId: string, data: UpdateEventRequest): Promise<UpdateEventResult> {
  try {
    logger.info('Updating event', { userId, eventId, fieldsUpdated: Object.keys(data) });

    // Get event with connection
    const event = await prisma.calendarEvent.findFirst({
      where: {
        id: eventId,
        calendarConnection: {
          userId,
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: {
        calendarConnection: true,
        eventAttendees: true,
        eventReminders: true,
      },
    });

    if (!event) {
      throw new Error('Event not found or not accessible');
    }

    // Check if calendar is read-only
    if (event.calendarConnection.isReadOnly) {
      throw new Error('Cannot modify read-only calendar. This calendar is synced from an external source.');
    }

    // ... rest of update logic

    // Update event in database using transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedEvent = await tx.calendarEvent.update({
        where: { id: eventId },  // PROBLEM: No version check
        data: updateData,
      });
      // ... rest of transaction
    });
```

### Fixed Code
```typescript
async updateEvent(userId: string, eventId: string, data: UpdateEventRequest): Promise<UpdateEventResult> {
  try {
    logger.info('Updating event', { userId, eventId, fieldsUpdated: Object.keys(data) });

    // Get event with connection
    const event = await prisma.calendarEvent.findFirst({
      where: {
        id: eventId,
        calendarConnection: {
          userId,
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: {
        calendarConnection: true,
        eventAttendees: true,
        eventReminders: true,
      },
    });

    if (!event) {
      throw new Error('Event not found or not accessible');
    }

    // Check if calendar is read-only
    if (event.calendarConnection.isReadOnly) {
      throw new Error('Cannot modify read-only calendar. This calendar is synced from an external source.');
    }

    // Store original updatedAt for optimistic locking
    const originalUpdatedAt = event.updatedAt;

    // ... rest of update logic

    // Update event in database using transaction
    const result = await prisma.$transaction(async (tx) => {
      // Optimistic locking: check if event was modified since we fetched it
      const updatedEvent = await tx.calendarEvent.updateMany({
        where: {
          id: eventId,
          updatedAt: originalUpdatedAt,  // ADD THIS: Only update if not modified
        },
        data: updateData,
      });

      // Check if update succeeded (count will be 0 if version mismatch)
      if (updatedEvent.count === 0) {
        throw new Error('Event was modified by another user. Please refresh and try again.');
      }

      // Fetch the updated event to return
      const refreshedEvent = await tx.calendarEvent.findUnique({
        where: { id: eventId },
      });

      if (!refreshedEvent) {
        throw new Error('Event not found after update');
      }

      // ... rest of transaction (attendees, reminders)

      return refreshedEvent;
    });
```

### Verification
```javascript
// Test concurrent updates
async function testConcurrentUpdates() {
  // Open event in two "tabs" (fetch twice)
  const event1 = await eventsApi.getEventById('event-id');
  const event2 = await eventsApi.getEventById('event-id');

  // Update from "tab 1"
  await eventsApi.updateEvent('event-id', { title: 'Title from Tab 1' });

  // Try to update from "tab 2" with stale data
  try {
    await eventsApi.updateEvent('event-id', { title: 'Title from Tab 2' });
    console.error('FAIL: Should have thrown conflict error');
  } catch (error) {
    if (error.message.includes('modified by another user')) {
      console.log('PASS: Optimistic locking working');
    } else {
      console.error('FAIL: Wrong error message');
    }
  }
}
```

---

## Fix #3: Fix All-Day Event End Time

**File:** `/Users/natescherer/alon-cal/frontend/src/components/EventDetailsModal.tsx`
**Line:** 287-292
**Severity:** HIGH

### Current Code
```typescript
const updateData: Partial<CreateEventRequest> = {
  title: formData.title.trim(),
  description: formData.description.trim() || undefined,
  location: formData.location.trim() || undefined,
  startTime: formData.isAllDay
    ? toISO8601(formData.startDate, '00:00', formData.timezone)
    : toISO8601(formData.startDate, formData.startTime, formData.timezone),
  endTime: formData.isAllDay
    ? toISO8601(formData.endDate, '23:59', formData.timezone)  // PROBLEM
    : toISO8601(formData.endDate, formData.endTime, formData.timezone),
  isAllDay: formData.isAllDay,
  timezone: formData.timezone,
  attendees: formData.attendees.length > 0 ? formData.attendees : undefined,
  reminders: formData.reminders.length > 0 ? formData.reminders : undefined,
};
```

### Fixed Code
```typescript
// Helper function to add one day to a date string
const addOneDay = (dateStr: string): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
};

const updateData: Partial<CreateEventRequest> = {
  title: formData.title.trim(),
  description: formData.description.trim() || undefined,
  location: formData.location.trim() || undefined,
  startTime: formData.isAllDay
    ? toISO8601(formData.startDate, '00:00', formData.timezone)
    : toISO8601(formData.startDate, formData.startTime, formData.timezone),
  endTime: formData.isAllDay
    ? toISO8601(addOneDay(formData.endDate), '00:00', formData.timezone)  // FIXED
    : toISO8601(formData.endDate, formData.endTime, formData.timezone),
  isAllDay: formData.isAllDay,
  timezone: formData.timezone,
  attendees: formData.attendees.length > 0 ? formData.attendees : undefined,
  reminders: formData.reminders.length > 0 ? formData.reminders : undefined,
};
```

### Also Fix in Form Initialization (Line 143-157)
```typescript
// CURRENT
endTime: eventData.isAllDay ? '23:59' : toLocalTime(eventData.endTime),

// FIXED
endTime: eventData.isAllDay ? '00:00' : toLocalTime(eventData.endTime),
```

### Verification
```javascript
// Test all-day event boundaries
async function testAllDayEvent() {
  // Create all-day event for Dec 10
  const event = await eventsApi.createEvent({
    title: 'All Day Event',
    startTime: '2025-12-10T00:00:00Z',
    endTime: '2025-12-11T00:00:00Z',  // Should be next day at 00:00
    isAllDay: true,
    // ... other fields
  });

  // Verify dates
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  console.assert(start.getDate() === 10, 'Start should be Dec 10');
  console.assert(end.getDate() === 11, 'End should be Dec 11');
  console.assert(end.getHours() === 0, 'End should be at midnight');
}
```

---

## Fix #4: Preserve RSVP Status on Update

**File:** `/Users/natescherer/alon-cal/backend/src/services/eventManagementService.ts`
**Line:** 122-141
**Severity:** HIGH

### Current Code
```typescript
// Update attendees if provided
if (data.attendees !== undefined) {
  // Delete existing attendees
  await tx.eventAttendee.deleteMany({
    where: { eventId },
  });

  // Create new attendees
  if (data.attendees.length > 0) {
    await tx.eventAttendee.createMany({
      data: data.attendees.map((attendee) => ({
        eventId,
        email: attendee.email,
        isOrganizer: attendee.isOrganizer || false,
        isOptional: attendee.isOptional || false,
        rsvpStatus: 'NEEDS_ACTION',  // PROBLEM: Always resets!
      })),
    });
    logger.debug('Updated attendees', { eventId, count: data.attendees.length });
  }
}
```

### Fixed Code
```typescript
// Update attendees if provided
if (data.attendees !== undefined) {
  // Get existing attendees before deleting
  const existingAttendees = await tx.eventAttendee.findMany({
    where: { eventId },
  });

  // Create map of email -> RSVP status
  const rsvpStatusMap = new Map(
    existingAttendees.map(a => [a.email.toLowerCase(), a.rsvpStatus])
  );

  // Delete existing attendees
  await tx.eventAttendee.deleteMany({
    where: { eventId },
  });

  // Create new attendees, preserving RSVP status for existing ones
  if (data.attendees.length > 0) {
    await tx.eventAttendee.createMany({
      data: data.attendees.map((attendee) => ({
        eventId,
        email: attendee.email,
        isOrganizer: attendee.isOrganizer || false,
        isOptional: attendee.isOptional || false,
        // Preserve existing RSVP status or default to NEEDS_ACTION for new attendees
        rsvpStatus: rsvpStatusMap.get(attendee.email.toLowerCase()) || 'NEEDS_ACTION',
      })),
    });
    logger.debug('Updated attendees', {
      eventId,
      count: data.attendees.length,
      preserved: rsvpStatusMap.size,
    });
  }
}
```

### Verification
```javascript
// Test RSVP status preservation
async function testRSVPPreservation() {
  // Create event with attendees
  const event = await eventsApi.createEvent({
    title: 'Test Event',
    attendees: [
      { email: 'john@example.com' },
      { email: 'jane@example.com' },
    ],
    // ... other fields
  });

  // Simulate attendees responding (this would happen via calendar provider)
  // In real scenario, attendees accept/decline via Google Calendar

  // Update event (e.g., change title)
  await eventsApi.updateEvent(event.id, {
    title: 'Updated Title',
    // Same attendees
    attendees: [
      { email: 'john@example.com' },
      { email: 'jane@example.com' },
    ],
  });

  // Fetch updated event
  const updated = await eventsApi.getEventById(event.id);

  // Verify RSVP statuses were preserved
  console.assert(
    updated.attendees[0].responseStatus !== 'NEEDS_ACTION',
    'RSVP status should be preserved'
  );
}
```

---

## Fix #5: Prevent Memory Leak on Unmount

**File:** `/Users/natescherer/alon-cal/frontend/src/components/EventDetailsModal.tsx`
**Line:** 327-352
**Severity:** MEDIUM

### Current Code
```typescript
const handleConfirmDelete = async () => {
  setIsDeleting(true);
  setError(null);

  try {
    await eventsApi.deleteEvent(eventId);

    // Close modal and notify parent
    handleClose();
    if (onEventDeleted) {
      onEventDeleted();
    }
  } catch (error: any) {
    console.error('Failed to delete event:', err);
    if (err.response?.status === 403) {
      setError('Cannot delete from read-only calendar');  // PROBLEM: May be unmounted
    } else if (err.response?.status === 404) {
      setError('Event not found or was already deleted');
    } else {
      setError('Failed to delete event. Please try again.');
    }
    setShowDeleteConfirm(false);
  } finally {
    setIsDeleting(false);  // PROBLEM: May be unmounted
  }
};
```

### Fixed Code
```typescript
// Add mounted ref at component level
const isMountedRef = useRef(true);

useEffect(() => {
  isMountedRef.current = true;
  return () => {
    isMountedRef.current = false;
  };
}, []);

const handleConfirmDelete = async () => {
  setIsDeleting(true);
  setError(null);

  try {
    await eventsApi.deleteEvent(eventId);

    // Only update state if component is still mounted
    if (!isMountedRef.current) return;

    // Close modal and notify parent
    handleClose();
    if (onEventDeleted) {
      onEventDeleted();
    }
  } catch (error: any) {
    console.error('Failed to delete event:', err);

    // Only update state if component is still mounted
    if (!isMountedRef.current) return;

    if (err.response?.status === 403) {
      setError('Cannot delete from read-only calendar');
    } else if (err.response?.status === 404) {
      setError('Event not found or was already deleted');
    } else {
      setError('Failed to delete event. Please try again.');
    }
    setShowDeleteConfirm(false);
  } finally {
    // Only update state if component is still mounted
    if (isMountedRef.current) {
      setIsDeleting(false);
    }
  }
};
```

### Apply Same Pattern to handleSaveEdit (Line 274-321)
```typescript
const handleSaveEdit = async () => {
  if (!validateForm()) {
    return;
  }

  setIsSaving(true);
  setError(null);

  try {
    const updateData: Partial<CreateEventRequest> = {
      // ... data preparation
    };

    await eventsApi.updateEvent(eventId, updateData);

    // Only update state if component is still mounted
    if (!isMountedRef.current) return;

    // Reload event details
    await loadEventDetails();
    setIsEditMode(false);

    // Notify parent
    if (onEventUpdated) {
      onEventUpdated();
    }
  } catch (err: any) {
    console.error('Failed to update event:', err);

    // Only update state if component is still mounted
    if (!isMountedRef.current) return;

    if (err.response?.status === 403) {
      setError('Cannot edit read-only calendar');
    } else if (err.response?.status === 404) {
      setError('Event not found or was deleted');
    } else {
      setError('Failed to update event. Please try again.');
    }
  } finally {
    // Only update state if component is still mounted
    if (isMountedRef.current) {
      setIsSaving(false);
    }
  }
};
```

### Verification
```javascript
// Test component unmount during async operation
async function testUnmountDuringDelete() {
  const { unmount } = render(
    <EventDetailsModal
      isOpen={true}
      onClose={() => {}}
      eventId="event1"
    />
  );

  // Trigger delete
  fireEvent.click(screen.getByText('Delete'));
  fireEvent.click(screen.getByText('Delete Event'));

  // Unmount before delete completes
  unmount();

  // Wait for async operation to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Should not see console warnings about setState on unmounted component
  // Check console for: "Can't perform a React state update on an unmounted component"
}
```

---

## Testing Checklist

After implementing all fixes:

### Manual Testing
- [ ] Read-only calendar shows correct UI (no Edit/Delete buttons)
- [ ] Concurrent updates show error message (test in two tabs)
- [ ] All-day events display correct dates in different timezones
- [ ] Attendee RSVP status preserved after event update
- [ ] No console warnings about unmounted component updates

### Automated Testing
```bash
cd /Users/natescherer/alon-cal/frontend
npm run test EventDetailsModal.test.tsx
```

### Integration Testing
- [ ] Create all-day event via API, verify end time
- [ ] Update event with attendees, verify RSVP preserved
- [ ] Attempt to edit ICS calendar event, verify 403 error
- [ ] Concurrent API calls, verify optimistic lock works

---

## Deployment Steps

1. **Apply Fixes**
   ```bash
   git checkout -b fix/event-details-critical-issues
   # Apply all 5 fixes above
   git add -A
   git commit -m "Fix critical issues in event details feature

   - Add isReadOnly flag to API response
   - Implement optimistic locking for concurrent updates
   - Fix all-day event boundary issues
   - Preserve RSVP status on attendee updates
   - Prevent memory leaks on component unmount"
   ```

2. **Run Tests**
   ```bash
   # Frontend tests
   cd frontend
   npm run test
   npm run lint

   # Backend tests (if available)
   cd ../backend
   npm run test
   npm run lint
   ```

3. **Manual QA**
   - Test all scenarios in checklist above
   - Verify in staging environment

4. **Deploy**
   ```bash
   git push origin fix/event-details-critical-issues
   # Create PR and merge
   # Deploy to staging
   # Smoke test in staging
   # Deploy to production
   ```

---

## Success Criteria

All fixes successfully implemented when:
- [ ] isReadOnly flag appears in API response
- [ ] Concurrent updates throw "modified by another user" error
- [ ] All-day events use next day at 00:00 for end time
- [ ] RSVP status preserved after updating attendees
- [ ] No memory leak warnings in console
- [ ] All automated tests pass
- [ ] Manual QA checklist complete

---

## Time Estimates

- Fix #1 (isReadOnly flag): 15 minutes
- Fix #2 (Optimistic locking): 1-2 hours
- Fix #3 (All-day events): 30 minutes
- Fix #4 (RSVP preservation): 45 minutes
- Fix #5 (Memory leaks): 30 minutes
- Testing: 1-2 hours

**Total: 4-6 hours**

---

## Contact

For questions about these fixes:
- Review detailed test report: `/Users/natescherer/alon-cal/TEST_REPORT_EVENT_DETAILS.md`
- Run test suite: `/Users/natescherer/alon-cal/frontend/src/components/EventDetailsModal.test.tsx`
- Check test summary: `/Users/natescherer/alon-cal/TEST_SUMMARY.md`
