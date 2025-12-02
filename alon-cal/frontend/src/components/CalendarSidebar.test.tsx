/**
 * Tests for CalendarSidebar Component
 *
 * Test Coverage:
 * - Component rendering (collapsed/expanded states)
 * - Props validation
 * - Toggle functionality
 * - Calendar list display
 * - Provider colors and indicators
 * - Calendar expansion/collapse
 * - Disconnect functionality
 * - Sync functionality
 * - Empty calendars state
 * - Error handling
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Mobile overlay behavior
 * - Modal interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CalendarSidebar from './CalendarSidebar';
import type { Calendar } from '../api/calendar';
import { useCalendars } from '../hooks/useCalendars';
import { useToast } from '../hooks/useToast';

// Mock dependencies
vi.mock('../hooks/useCalendars');
vi.mock('../hooks/useToast');
vi.mock('./ProviderIcon', () => ({
  default: ({ provider, size }: { provider: string; size: string }) => (
    <div data-testid={`provider-icon-${provider}`} data-size={size}>
      {provider} Icon
    </div>
  ),
}));
vi.mock('./ConfirmationModal', () => ({
  default: ({ isOpen, title, message, onConfirm, onCancel, confirmText }: any) =>
    isOpen ? (
      <div data-testid="confirmation-modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm}>{confirmText}</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));
vi.mock('./ConnectCalendarModal', () => ({
  default: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="connect-calendar-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

describe('CalendarSidebar', () => {
  const mockDisconnect = vi.fn();
  const mockSync = vi.fn();
  const mockSuccess = vi.fn();
  const mockError = vi.fn();
  const mockOnToggle = vi.fn();

  const mockCalendars: Calendar[] = [
    {
      id: 'cal-1',
      provider: 'GOOGLE',
      calendarId: 'primary',
      calendarName: 'Work Calendar',
      calendarColor: '#4285f4',
      isPrimary: true,
      isConnected: true,
      isReadOnly: false,
      lastSyncedAt: '2025-11-25T10:00:00Z',
      createdAt: '2025-11-01T00:00:00Z',
      isSyncing: false,
    },
    {
      id: 'cal-2',
      provider: 'MICROSOFT',
      calendarId: 'outlook-cal',
      calendarName: 'Personal Calendar',
      calendarColor: '#f78234',
      isPrimary: false,
      isConnected: true,
      isReadOnly: false,
      ownerEmail: 'user@outlook.com',
      lastSyncedAt: '2025-11-25T09:30:00Z',
      createdAt: '2025-11-10T00:00:00Z',
      isSyncing: false,
    },
    {
      id: 'cal-3',
      provider: 'ICS',
      calendarId: 'ics-sub',
      calendarName: 'Holidays',
      isPrimary: false,
      isConnected: true,
      isReadOnly: true,
      createdAt: '2025-11-15T00:00:00Z',
      isSyncing: false,
    },
    {
      id: 'cal-4',
      provider: 'GOOGLE',
      calendarId: 'secondary',
      calendarName: 'Syncing Calendar',
      isPrimary: false,
      isConnected: true,
      isReadOnly: false,
      createdAt: '2025-11-20T00:00:00Z',
      isSyncing: true,
    },
    {
      id: 'cal-5',
      provider: 'MICROSOFT',
      calendarId: 'error-cal',
      calendarName: 'Error Calendar',
      isPrimary: false,
      isConnected: false,
      isReadOnly: false,
      createdAt: '2025-11-22T00:00:00Z',
      isSyncing: false,
      syncError: 'Authentication failed',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCalendars).mockReturnValue({
      calendars: mockCalendars,
      isLoading: false,
      error: null,
      fetchCalendars: vi.fn(),
      disconnectCalendar: mockDisconnect,
      syncCalendar: mockSync,
      initiateOAuth: vi.fn(),
      validateIcsUrl: vi.fn(),
      connectIcsCalendar: vi.fn(),
      updateIcsCalendar: vi.fn(),
      clearError: vi.fn(),
      setLoading: vi.fn(),
    });
    vi.mocked(useToast).mockReturnValue({
      toasts: [],
      addToast: vi.fn(),
      removeToast: vi.fn(),
      success: mockSuccess,
      error: mockError,
      info: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== Basic Rendering Tests ====================
  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByLabelText('Calendar sidebar')).toBeInTheDocument();
    });

    it('should render in collapsed state', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      const sidebar = screen.getByLabelText('Calendar sidebar');
      expect(sidebar).toHaveClass('w-16');
    });

    it('should render in expanded state', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const sidebar = screen.getByLabelText('Calendar sidebar');
      expect(sidebar).toHaveClass('w-72');
    });

    it('should show header with calendar count in expanded state', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Calendars')).toBeInTheDocument();
      expect(screen.getByText('5 connected')).toBeInTheDocument();
    });

    it('should hide header text in collapsed state', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.queryByText('Calendars')).not.toBeInTheDocument();
      expect(screen.queryByText('5 connected')).not.toBeInTheDocument();
    });

    it('should display toggle button with correct aria-label', () => {
      const { rerender } = render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();

      rerender(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
    });
  });

  // ==================== Props Validation Tests ====================
  describe('Props Validation', () => {
    it('should handle empty calendars array', () => {
      render(
        <CalendarSidebar calendars={[]} isCollapsed={false} onToggle={mockOnToggle} />
      );

      expect(screen.getByText('0 connected')).toBeInTheDocument();
      expect(screen.getByText('+ Connect Calendar')).toBeInTheDocument();
    });

    it('should handle single calendar', () => {
      render(
        <CalendarSidebar
          calendars={[mockCalendars[0]]}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('1 connected')).toBeInTheDocument();
      expect(screen.getByText('Work Calendar')).toBeInTheDocument();
    });

    it('should call onToggle when toggle button clicked', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      fireEvent.click(screen.getByLabelText('Collapse sidebar'));

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== Collapsed View Tests ====================
  describe('Collapsed View', () => {
    it('should show colored dots for each calendar', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      mockCalendars.forEach((cal) => {
        const button = screen.getByLabelText(cal.calendarName);
        expect(button).toBeInTheDocument();
      });
    });

    it('should show status indicators on dots', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      const syncingCalButton = screen.getByLabelText('Syncing Calendar');
      const statusDot = syncingCalButton.querySelector('.animate-pulse');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show add calendar button', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByLabelText('Connect calendar')).toBeInTheDocument();
    });

    it('should expand sidebar when calendar dot clicked', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      const calendarButton = screen.getByLabelText('Work Calendar');
      fireEvent.click(calendarButton);

      expect(mockOnToggle).toHaveBeenCalled();
    });
  });

  // ==================== Expanded View Tests ====================
  describe('Expanded View', () => {
    it('should show provider statistics', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      // 2 Google, 2 Microsoft, 1 ICS
      const badges = screen.getAllByText('2');
      expect(badges).toHaveLength(2); // Google and Microsoft both have 2

      const icsBadge = screen.getByText('1');
      expect(icsBadge).toBeInTheDocument();
    });

    it('should display all calendar names', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      mockCalendars.forEach((cal) => {
        expect(screen.getByText(cal.calendarName)).toBeInTheDocument();
      });
    });

    it('should show calendar status (Active/Inactive/Syncing)', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getAllByText('Active')).toHaveLength(3);
      expect(screen.getByText('Inactive')).toBeInTheDocument();
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });

    it('should show provider icons', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      // There are multiple Google and Microsoft calendars, so use getAllByTestId
      expect(screen.getAllByTestId('provider-icon-GOOGLE')).toHaveLength(2);
      expect(screen.getAllByTestId('provider-icon-MICROSOFT')).toHaveLength(2);
      expect(screen.getAllByTestId('provider-icon-ICS')).toHaveLength(1);
    });

    it('should show add calendar button', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('+ Connect Calendar')).toBeInTheDocument();
    });
  });

  // ==================== Calendar Expansion Tests ====================
  describe('Calendar Expansion', () => {
    it('should expand calendar details when clicked', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      // Should show details
      expect(screen.getByText('Primary')).toBeInTheDocument();
      expect(screen.getByText('Sync Now')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('should collapse calendar when clicked again', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      expect(screen.getByText('Primary')).toBeInTheDocument();

      fireEvent.click(workCalendar!);

      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
    });

    it('should show Primary badge for primary calendars', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      expect(screen.getByText('Primary')).toBeInTheDocument();
    });

    it('should show Read-only badge for read-only calendars', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const holidaysCalendar = screen.getByText('Holidays').closest('button');
      fireEvent.click(holidaysCalendar!);

      expect(screen.getByText('Read-only')).toBeInTheDocument();
    });

    it('should show owner email if available', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const personalCalendar = screen.getByText('Personal Calendar').closest('button');
      fireEvent.click(personalCalendar!);

      expect(screen.getByText('user@outlook.com')).toBeInTheDocument();
    });

    it('should show last synced time', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
    });

    it('should show sync error message', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const errorCalendar = screen.getByText('Error Calendar').closest('button');
      fireEvent.click(errorCalendar!);

      expect(screen.getByText(/Sync failed/)).toBeInTheDocument();
    });

    it('should not show Sync Now button for read-only calendars', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const holidaysCalendar = screen.getByText('Holidays').closest('button');
      fireEvent.click(holidaysCalendar!);

      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });
  });

  // ==================== Sync Functionality Tests ====================
  describe('Sync Functionality', () => {
    it('should trigger sync when Sync Now clicked', async () => {
      mockSync.mockResolvedValueOnce(undefined);

      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      const syncButton = screen.getByText('Sync Now');
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(mockSync).toHaveBeenCalledWith('cal-1');
        expect(mockSuccess).toHaveBeenCalledWith('Calendar sync triggered');
      });
    });

    it('should show loading state during sync', async () => {
      mockSync.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 500))
      );

      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      const syncButton = screen.getByText('Sync Now');
      fireEvent.click(syncButton);

      // Find the "Syncing..." text within the expanded calendar details section
      // Use a more specific query to avoid the status "Syncing..." from other calendars
      const expandedSection = workCalendar?.parentElement?.querySelector('.bg-gray-50');
      expect(expandedSection).toBeTruthy();
      expect(within(expandedSection as HTMLElement).getByText('Syncing...')).toBeInTheDocument();
      expect(syncButton).toBeDisabled();

      await waitFor(() => {
        expect(mockSync).toHaveBeenCalled();
      });
    });

    it('should handle sync errors', async () => {
      mockSync.mockRejectedValueOnce(new Error('Sync failed'));

      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      const syncButton = screen.getByText('Sync Now');
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Failed to sync calendar');
      });
    });

    it('should not sync read-only calendars', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const holidaysCalendar = screen.getByText('Holidays').closest('button');
      fireEvent.click(holidaysCalendar!);

      // Sync button should not exist for read-only calendars
      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
    });
  });

  // ==================== Disconnect Functionality Tests ====================
  describe('Disconnect Functionality', () => {
    it('should show confirmation modal when Disconnect clicked', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
      expect(screen.getByText('Disconnect Calendar')).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to disconnect "Work Calendar"/)
      ).toBeInTheDocument();
    });

    it('should disconnect calendar when confirmed', async () => {
      mockDisconnect.mockResolvedValueOnce(undefined);

      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      const modal = screen.getByTestId('confirmation-modal');
      const confirmButton = within(modal).getByText('Disconnect');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalledWith('cal-1');
        expect(mockSuccess).toHaveBeenCalledWith('Calendar disconnected successfully');
      });
    });

    it('should cancel disconnect when Cancel clicked', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      const modal = screen.getByTestId('confirmation-modal');
      const cancelButton = within(modal).getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('should handle disconnect errors', async () => {
      mockDisconnect.mockRejectedValueOnce(new Error('Disconnect failed'));

      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      const modal = screen.getByTestId('confirmation-modal');
      const confirmButton = within(modal).getByText('Disconnect');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Failed to disconnect calendar');
      });
    });

    it('should collapse calendar details after disconnect', async () => {
      mockDisconnect.mockResolvedValueOnce(undefined);

      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      expect(screen.getByText('Primary')).toBeInTheDocument();

      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      const modal = screen.getByTestId('confirmation-modal');
      const confirmButton = within(modal).getByText('Disconnect');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled();
      });
    });
  });

  // ==================== Connect Calendar Modal Tests ====================
  describe('Connect Calendar Modal', () => {
    it('should show connect modal when add button clicked in collapsed view', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      const addButton = screen.getByLabelText('Connect calendar');
      fireEvent.click(addButton);

      expect(screen.getByTestId('connect-calendar-modal')).toBeInTheDocument();
    });

    it('should show connect modal when add button clicked in expanded view', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const addButton = screen.getByText('+ Connect Calendar');
      fireEvent.click(addButton);

      expect(screen.getByTestId('connect-calendar-modal')).toBeInTheDocument();
    });

    it('should close connect modal', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const addButton = screen.getByText('+ Connect Calendar');
      fireEvent.click(addButton);

      const modal = screen.getByTestId('connect-calendar-modal');
      const closeButton = within(modal).getByText('Close');
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('connect-calendar-modal')).not.toBeInTheDocument();
    });
  });

  // ==================== Mobile Overlay Tests ====================
  describe('Mobile Overlay', () => {
    it('should show overlay when expanded on mobile', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      // Overlay should exist but hidden on desktop (lg:hidden class)
      const overlay = document.querySelector('.bg-black.bg-opacity-50');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('lg:hidden');
    });

    it('should not show overlay when collapsed', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      const overlay = document.querySelector('.bg-black.bg-opacity-50');
      expect(overlay).not.toBeInTheDocument();
    });

    it('should close sidebar when overlay clicked', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const overlay = document.querySelector('.bg-black.bg-opacity-50');
      fireEvent.click(overlay!);

      expect(mockOnToggle).toHaveBeenCalled();
    });
  });

  // ==================== Accessibility Tests ====================
  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByLabelText('Calendar sidebar')).toBeInTheDocument();
      expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
    });

    it('should have proper button titles for tooltips', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      const toggleButton = screen.getByLabelText('Expand sidebar');
      expect(toggleButton).toHaveAttribute('title', 'Expand sidebar');

      mockCalendars.forEach((cal) => {
        const button = screen.getByLabelText(cal.calendarName);
        expect(button).toHaveAttribute('title', cal.calendarName);
      });
    });

    it('should support keyboard navigation', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const toggleButton = screen.getByLabelText('Collapse sidebar');
      toggleButton.focus();

      expect(document.activeElement).toBe(toggleButton);
    });

    it('should have focus:ring styles for keyboard users', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const toggleButton = screen.getByLabelText('Collapse sidebar');
      expect(toggleButton).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
    });

    it('should have aria-hidden on mobile overlay', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const overlay = document.querySelector('.bg-black.bg-opacity-50');
      expect(overlay).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ==================== Edge Cases Tests ====================
  describe('Edge Cases', () => {
    it('should handle calendar with no lastSyncedAt', () => {
      const calendarWithoutSync: Calendar = {
        id: 'cal-new',
        provider: 'GOOGLE',
        calendarId: 'new-cal',
        calendarName: 'New Calendar',
        isPrimary: false,
        isConnected: true,
        createdAt: '2025-11-25T00:00:00Z',
        isSyncing: false,
      };

      render(
        <CalendarSidebar
          calendars={[calendarWithoutSync]}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const calendar = screen.getByText('New Calendar').closest('button');
      fireEvent.click(calendar!);

      expect(screen.queryByText(/Last synced:/)).not.toBeInTheDocument();
    });

    it('should handle calendar with no ownerEmail', () => {
      render(
        <CalendarSidebar
          calendars={[mockCalendars[0]]}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const calendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(calendar!);

      expect(screen.queryByText(/Owner:/)).not.toBeInTheDocument();
    });

    it('should handle APPLE provider', () => {
      const appleCalendar: Calendar = {
        id: 'cal-apple',
        provider: 'APPLE' as any,
        calendarId: 'apple-cal',
        calendarName: 'Apple Calendar',
        isPrimary: false,
        isConnected: true,
        createdAt: '2025-11-25T00:00:00Z',
        isSyncing: false,
      };

      render(
        <CalendarSidebar
          calendars={[appleCalendar]}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Apple Calendar')).toBeInTheDocument();
    });

    it('should display correct provider name in badge', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const workCalendar = screen.getByText('Work Calendar').closest('button');
      fireEvent.click(workCalendar!);

      expect(screen.getByText('Google')).toBeInTheDocument();

      const personalCalendar = screen.getByText('Personal Calendar').closest('button');
      fireEvent.click(personalCalendar!);

      expect(screen.getByText('Microsoft')).toBeInTheDocument();

      const holidaysCalendar = screen.getByText('Holidays').closest('button');
      fireEvent.click(holidaysCalendar!);

      expect(screen.getByText('ICS')).toBeInTheDocument();
    });

    it('should handle rapid toggle clicks', () => {
      render(
        <CalendarSidebar
          calendars={mockCalendars}
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const toggleButton = screen.getByLabelText('Collapse sidebar');

      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);

      expect(mockOnToggle).toHaveBeenCalledTimes(3);
    });
  });
});
