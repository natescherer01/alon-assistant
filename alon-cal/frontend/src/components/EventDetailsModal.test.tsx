/**
 * EventDetailsModal Component Tests
 *
 * Test Coverage:
 * - Modal open/close behavior
 * - Event details display (view mode)
 * - Edit mode transitions
 * - Form validation
 * - Update event flow
 * - Delete event flow with confirmation
 * - Error handling
 * - Loading states
 * - Read-only calendar behavior
 * - Provider-specific features
 * - Edge cases (long content, missing fields, etc.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventDetailsModal from './EventDetailsModal';
import { eventsApi } from '../api/events';

// Mock the APIs
vi.mock('../api/events', () => ({
  eventsApi: {
    getEventById: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

// Mock hooks
vi.mock('../hooks/useCalendars', () => ({
  useCalendars: () => ({
    calendars: [
      { id: 'cal1', name: 'Work Calendar', provider: 'GOOGLE', isReadOnly: false },
      { id: 'cal2', name: 'ICS Calendar', provider: 'ICS', isReadOnly: true },
    ],
    fetchCalendars: vi.fn(),
  }),
}));

describe('EventDetailsModal', () => {
  const mockEvent = {
    id: 'event1',
    title: 'Team Meeting',
    description: 'Weekly sync meeting',
    location: 'Conference Room A',
    startTime: '2025-12-10T09:00:00.000Z',
    endTime: '2025-12-10T10:00:00.000Z',
    isAllDay: false,
    timezone: 'America/New_York',
    status: 'CONFIRMED',
    isRecurring: false,
    recurrenceRule: null,
    attendees: [
      {
        email: 'john@example.com',
        displayName: 'John Doe',
        isOrganizer: true,
        responseStatus: 'accepted',
      },
      {
        email: 'jane@example.com',
        displayName: 'Jane Smith',
        isOrganizer: false,
        responseStatus: 'tentative',
      },
    ],
    reminders: [
      { method: 'EMAIL', minutesBefore: 30 },
      { method: 'POPUP', minutesBefore: 10 },
    ],
    htmlLink: 'https://calendar.google.com/event/123',
    calendar: {
      provider: 'GOOGLE',
      name: 'Work Calendar',
      color: '#4285f4',
      isReadOnly: false,
    },
    providerMetadata: null,
    createdAt: '2025-12-01T10:00:00.000Z',
    updatedAt: '2025-12-01T10:00:00.000Z',
  };

  const mockReadOnlyEvent = {
    ...mockEvent,
    id: 'event2',
    calendar: {
      ...mockEvent.calendar,
      provider: 'ICS',
      isReadOnly: true,
    },
  };

  const mockMicrosoftEvent = {
    ...mockEvent,
    id: 'event3',
    calendar: {
      ...mockEvent.calendar,
      provider: 'MICROSOFT',
    },
    providerMetadata: {
      teamsEnabled: true,
      teamsMeetingUrl: 'https://teams.microsoft.com/l/meetup/123',
      importance: 'high',
      outlookCategories: ['Work', 'Important'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eventsApi.getEventById).mockResolvedValue(mockEvent);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== Basic Rendering Tests ====================
  describe('Basic Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <EventDetailsModal
          isOpen={false}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render modal when isOpen is true', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      vi.mocked(eventsApi.getEventById).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockEvent), 1000))
      );

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should fetch event details on mount', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(eventsApi.getEventById).toHaveBeenCalledWith('event1');
        expect(eventsApi.getEventById).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ==================== View Mode Display Tests ====================
  describe('View Mode Display', () => {
    it('should display event title', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });
    });

    it('should display event description', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Weekly sync meeting')).toBeInTheDocument();
      });
    });

    it('should display event location', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Conference Room A')).toBeInTheDocument();
      });
    });

    it('should display start and end times', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        // Check for date/time display (format may vary)
        expect(screen.getByText(/Dec/i)).toBeInTheDocument();
      });
    });

    it('should display event status', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
      });
    });

    it('should display attendees', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Organizer')).toBeInTheDocument();
      });
    });

    it('should display attendee RSVP status', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('accepted')).toBeInTheDocument();
        expect(screen.getByText('tentative')).toBeInTheDocument();
      });
    });

    it('should display reminders', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/EMAIL.*30 minutes/i)).toBeInTheDocument();
        expect(screen.getByText(/POPUP.*10 minutes/i)).toBeInTheDocument();
      });
    });

    it('should display calendar information', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Work Calendar')).toBeInTheDocument();
        expect(screen.getByText('GOOGLE')).toBeInTheDocument();
      });
    });

    it('should display link to provider calendar', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        const link = screen.getByText(/View in Google Calendar/i);
        expect(link).toHaveAttribute('href', 'https://calendar.google.com/event/123');
        expect(link).toHaveAttribute('target', '_blank');
      });
    });

    it('should not display optional fields if missing', async () => {
      const eventWithoutOptionals = {
        ...mockEvent,
        description: null,
        location: null,
        attendees: [],
        reminders: [],
      };

      vi.mocked(eventsApi.getEventById).mockResolvedValue(eventWithoutOptionals);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Description')).not.toBeInTheDocument();
        expect(screen.queryByText('Location')).not.toBeInTheDocument();
        expect(screen.queryByText('Attendees')).not.toBeInTheDocument();
        expect(screen.queryByText('Reminders')).not.toBeInTheDocument();
      });
    });
  });

  // ==================== Microsoft-Specific Features Tests ====================
  describe('Microsoft-Specific Features', () => {
    it('should display Teams meeting badge for Microsoft events', async () => {
      vi.mocked(eventsApi.getEventById).mockResolvedValue(mockMicrosoftEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event3"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Teams/i)).toBeInTheDocument();
      });
    });

    it('should display importance badge for non-normal importance', async () => {
      vi.mocked(eventsApi.getEventById).mockResolvedValue(mockMicrosoftEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event3"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/high/i)).toBeInTheDocument();
      });
    });

    it('should display Outlook categories', async () => {
      vi.mocked(eventsApi.getEventById).mockResolvedValue(mockMicrosoftEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event3"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
        expect(screen.getByText('Important')).toBeInTheDocument();
      });
    });

    it('should not show Microsoft features for Google events', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Teams/i)).not.toBeInTheDocument();
      });
    });
  });

  // ==================== Close Behavior Tests ====================
  describe('Close Behavior', () => {
    it('should call onClose when close button clicked', async () => {
      const handleClose = vi.fn();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={handleClose}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Close'));

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking outside modal', async () => {
      const handleClose = vi.fn();

      const { container } = render(
        <EventDetailsModal
          isOpen={true}
          onClose={handleClose}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click the backdrop
      const backdrop = container.querySelector('[role="dialog"]')?.parentElement;
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when ESC key pressed', async () => {
      const handleClose = vi.fn();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={handleClose}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking inside modal', async () => {
      const handleClose = vi.fn();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={handleClose}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Team Meeting'));

      expect(handleClose).not.toHaveBeenCalled();
    });

    it('should not close while saving', async () => {
      const handleClose = vi.fn();

      vi.mocked(eventsApi.updateEvent).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({} as any), 1000))
      );

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={handleClose}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit'));

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });

      // Trigger save
      fireEvent.click(screen.getByText('Save Changes'));

      // Try to close
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  // ==================== Edit Mode Tests ====================
  describe('Edit Mode', () => {
    it('should switch to edit mode when Edit button clicked', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('should pre-populate form with event data', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Team Meeting');
        expect(titleInput).toBeInTheDocument();

        const descriptionInput = screen.getByDisplayValue('Weekly sync meeting');
        expect(descriptionInput).toBeInTheDocument();

        const locationInput = screen.getByDisplayValue('Conference Room A');
        expect(locationInput).toBeInTheDocument();
      });
    });

    it('should return to view mode when Cancel clicked', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Cancel'));
      });

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
      });
    });

    it('should reset form data when Cancel clicked', async () => {
      const user = userEvent.setup();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      // Modify title
      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);
      await user.type(titleInput, 'Modified Title');

      // Cancel
      fireEvent.click(screen.getByText('Cancel'));

      // Re-enter edit mode
      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      // Original title should be restored
      await waitFor(() => {
        expect(screen.getByDisplayValue('Team Meeting')).toBeInTheDocument();
      });
    });
  });

  // ==================== Form Validation Tests ====================
  describe('Form Validation', () => {
    it('should require title field', async () => {
      const user = userEvent.setup();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });
    });

    it('should validate title length (max 500 chars)', async () => {
      const user = userEvent.setup();
      const longTitle = 'A'.repeat(501);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);
      await user.type(titleInput, longTitle);

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(screen.getByText(/must be 500 characters or less/i)).toBeInTheDocument();
      });
    });

    it('should validate end time after start time', async () => {
      const user = userEvent.setup();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      // Set end time before start time
      const endTimeInput = screen.getByLabelText('End Time');
      await user.clear(endTimeInput);
      await user.type(endTimeInput, '08:00'); // Before 09:00 start

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(screen.getByText(/End time must be after start time/i)).toBeInTheDocument();
      });
    });

    it('should clear validation errors when field is corrected', async () => {
      const user = userEvent.setup();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      // Clear title to trigger error
      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      // Fix the error
      await user.type(titleInput, 'New Title');

      await waitFor(() => {
        expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
      });
    });
  });

  // ==================== Update Event Tests ====================
  describe('Update Event', () => {
    it('should call updateEvent API with modified data', async () => {
      const user = userEvent.setup();
      vi.mocked(eventsApi.updateEvent).mockResolvedValue({
        id: 'event1',
        title: 'Updated Meeting',
        startTime: '2025-12-10T09:00:00.000Z',
        endTime: '2025-12-10T10:00:00.000Z',
        syncStatus: 'SYNCED',
      });

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Meeting');

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(eventsApi.updateEvent).toHaveBeenCalledWith(
          'event1',
          expect.objectContaining({
            title: 'Updated Meeting',
          })
        );
      });
    });

    it('should reload event details after successful update', async () => {
      const user = userEvent.setup();
      vi.mocked(eventsApi.updateEvent).mockResolvedValue({
        id: 'event1',
        title: 'Updated Meeting',
        startTime: '2025-12-10T09:00:00.000Z',
        endTime: '2025-12-10T10:00:00.000Z',
        syncStatus: 'SYNCED',
      });

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(eventsApi.getEventById).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Meeting');

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(eventsApi.getEventById).toHaveBeenCalledTimes(2);
      });
    });

    it('should call onEventUpdated callback after successful update', async () => {
      const user = userEvent.setup();
      const handleEventUpdated = vi.fn();

      vi.mocked(eventsApi.updateEvent).mockResolvedValue({
        id: 'event1',
        title: 'Updated Meeting',
        startTime: '2025-12-10T09:00:00.000Z',
        endTime: '2025-12-10T10:00:00.000Z',
        syncStatus: 'SYNCED',
      });

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
          onEventUpdated={handleEventUpdated}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Meeting');

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(handleEventUpdated).toHaveBeenCalledTimes(1);
      });
    });

    it('should return to view mode after successful update', async () => {
      const user = userEvent.setup();
      vi.mocked(eventsApi.updateEvent).mockResolvedValue({
        id: 'event1',
        title: 'Updated Meeting',
        startTime: '2025-12-10T09:00:00.000Z',
        endTime: '2025-12-10T10:00:00.000Z',
        syncStatus: 'SYNCED',
      });

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Meeting');

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
      });
    });

    it('should show error message on update failure', async () => {
      const user = userEvent.setup();
      vi.mocked(eventsApi.updateEvent).mockRejectedValue(
        new Error('Network error')
      );

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Meeting');

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to update event/i)).toBeInTheDocument();
      });
    });

    it('should handle 403 error for read-only calendar', async () => {
      const user = userEvent.setup();
      const error: any = new Error('Forbidden');
      error.response = { status: 403 };

      vi.mocked(eventsApi.updateEvent).mockRejectedValue(error);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Meeting');

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(screen.getByText(/Cannot edit read-only calendar/i)).toBeInTheDocument();
      });
    });
  });

  // ==================== Delete Event Tests ====================
  describe('Delete Event', () => {
    it('should show confirmation dialog when Delete clicked', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete this event/i)).toBeInTheDocument();
        expect(screen.getByText('Delete Event')).toBeInTheDocument();
      });
    });

    it('should cancel delete when Cancel clicked', async () => {
      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      });

      // Click the Cancel button in confirmation dialog
      const cancelButtons = screen.getAllByText('Cancel');
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);

      await waitFor(() => {
        expect(screen.queryByText(/Are you sure/i)).not.toBeInTheDocument();
      });
    });

    it('should call deleteEvent API when confirmed', async () => {
      vi.mocked(eventsApi.deleteEvent).mockResolvedValue();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete Event'));
      });

      await waitFor(() => {
        expect(eventsApi.deleteEvent).toHaveBeenCalledWith('event1');
      });
    });

    it('should close modal after successful delete', async () => {
      const handleClose = vi.fn();
      vi.mocked(eventsApi.deleteEvent).mockResolvedValue();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={handleClose}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete Event'));
      });

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onEventDeleted callback', async () => {
      const handleEventDeleted = vi.fn();
      vi.mocked(eventsApi.deleteEvent).mockResolvedValue();

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
          onEventDeleted={handleEventDeleted}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete Event'));
      });

      await waitFor(() => {
        expect(handleEventDeleted).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error message on delete failure', async () => {
      vi.mocked(eventsApi.deleteEvent).mockRejectedValue(
        new Error('Network error')
      );

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete Event'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to delete event/i)).toBeInTheDocument();
      });
    });

    it('should handle 403 error for read-only calendar', async () => {
      const error: any = new Error('Forbidden');
      error.response = { status: 403 };

      vi.mocked(eventsApi.deleteEvent).mockRejectedValue(error);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete Event'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Cannot delete from read-only calendar/i)).toBeInTheDocument();
      });
    });
  });

  // ==================== Read-Only Calendar Tests ====================
  describe('Read-Only Calendar Behavior', () => {
    it('should not show Edit button for ICS calendar events', async () => {
      vi.mocked(eventsApi.getEventById).mockResolvedValue(mockReadOnlyEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event2"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      });
    });

    it('should not show Delete button for ICS calendar events', async () => {
      vi.mocked(eventsApi.getEventById).mockResolvedValue(mockReadOnlyEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event2"
        />
      );

      await waitFor(() => {
        const deleteButtons = screen.queryAllByText('Delete');
        expect(deleteButtons.length).toBe(0);
      });
    });

    it('should show read-only indicator', async () => {
      vi.mocked(eventsApi.getEventById).mockResolvedValue(mockReadOnlyEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event2"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/This calendar is read-only/i)).toBeInTheDocument();
      });
    });

    it('should show read-only badge on calendar info', async () => {
      vi.mocked(eventsApi.getEventById).mockResolvedValue(mockReadOnlyEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event2"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Read-only')).toBeInTheDocument();
      });
    });
  });

  // ==================== Error Handling Tests ====================
  describe('Error Handling', () => {
    it('should show error message when event not found (404)', async () => {
      const error: any = new Error('Not found');
      error.response = { status: 404 };

      vi.mocked(eventsApi.getEventById).mockRejectedValue(error);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Event not found or was deleted/i)).toBeInTheDocument();
      });
    });

    it('should show error message when access forbidden (403)', async () => {
      const error: any = new Error('Forbidden');
      error.response = { status: 403 };

      vi.mocked(eventsApi.getEventById).mockRejectedValue(error);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/You do not have permission to view this event/i)).toBeInTheDocument();
      });
    });

    it('should show generic error message for other errors', async () => {
      vi.mocked(eventsApi.getEventById).mockRejectedValue(
        new Error('Unknown error')
      );

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Failed to load event details/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on load error', async () => {
      vi.mocked(eventsApi.getEventById).mockRejectedValue(
        new Error('Network error')
      );

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should retry loading when retry button clicked', async () => {
      vi.mocked(eventsApi.getEventById)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });
    });
  });

  // ==================== Edge Cases Tests ====================
  describe('Edge Cases', () => {
    it('should handle event with very long description', async () => {
      const longDescription = 'A'.repeat(2000);
      const eventWithLongDescription = {
        ...mockEvent,
        description: longDescription,
      };

      vi.mocked(eventsApi.getEventById).mockResolvedValue(eventWithLongDescription);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(longDescription)).toBeInTheDocument();
      });
    });

    it('should handle event with many attendees', async () => {
      const manyAttendees = Array.from({ length: 50 }, (_, i) => ({
        email: `attendee${i}@example.com`,
        displayName: `Attendee ${i}`,
        isOrganizer: false,
        responseStatus: 'needsAction',
      }));

      const eventWithManyAttendees = {
        ...mockEvent,
        attendees: manyAttendees,
      };

      vi.mocked(eventsApi.getEventById).mockResolvedValue(eventWithManyAttendees);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Attendees (50)')).toBeInTheDocument();
      });
    });

    it('should handle all-day event', async () => {
      const allDayEvent = {
        ...mockEvent,
        isAllDay: true,
      };

      vi.mocked(eventsApi.getEventById).mockResolvedValue(allDayEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('All-day event')).toBeInTheDocument();
      });
    });

    it('should handle recurring event', async () => {
      const recurringEvent = {
        ...mockEvent,
        isRecurring: true,
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      };

      vi.mocked(eventsApi.getEventById).mockResolvedValue(recurringEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBeInTheDocument();
      });
    });

    it('should handle event with special characters in title', async () => {
      const specialCharEvent = {
        ...mockEvent,
        title: 'Meeting <script>alert("xss")</script> & "quotes"',
      };

      vi.mocked(eventsApi.getEventById).mockResolvedValue(specialCharEvent);

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        // React should escape the content
        const title = screen.getByText(/Meeting.*script.*alert.*xss.*quotes/);
        expect(title).toBeInTheDocument();
        // Script should not execute
        expect(window.alert).not.toHaveBeenCalled();
      });
    });
  });

  // ==================== Loading State Tests ====================
  describe('Loading States', () => {
    it('should disable buttons while saving', async () => {
      const user = userEvent.setup();
      vi.mocked(eventsApi.updateEvent).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({} as any), 1000))
      );

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit'));
      });

      const titleInput = screen.getByDisplayValue('Team Meeting');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated');

      fireEvent.click(screen.getByText('Save Changes'));

      // Buttons should be disabled
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeDisabled();
        expect(screen.getByText('Cancel')).toBeDisabled();
      });
    });

    it('should disable buttons while deleting', async () => {
      vi.mocked(eventsApi.deleteEvent).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(), 1000))
      );

      render(
        <EventDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          eventId="event1"
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete'));
      });

      fireEvent.click(screen.getByText('Delete Event'));

      // Buttons should be disabled
      await waitFor(() => {
        expect(screen.getByText('Delete Event')).toBeDisabled();
      });
    });
  });
});
