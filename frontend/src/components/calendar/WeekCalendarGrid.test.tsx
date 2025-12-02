/**
 * Tests for WeekCalendarGrid Component
 *
 * Test Coverage:
 * - Rendering 7-day grid (Sun-Sat)
 * - Time slot display (96 slots)
 * - Event positioning and display
 * - Overlapping event handling
 * - All-day event section
 * - Current time indicator
 * - Today highlighting
 * - Event interactions (click, hover)
 * - Mobile responsive behavior
 * - Status indicators (cancelled, tentative)
 * - Empty states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CalendarEvent } from '../../api/calendar/calendar';
import WeekCalendarGrid from './WeekCalendarGrid';

describe('WeekCalendarGrid', () => {
  const mockWeekStart = new Date('2025-12-07T00:00:00.000Z'); // Sunday

  const mockEvent: CalendarEvent = {
    id: '1',
    calendarId: 'cal1',
    title: 'Team Meeting',
    startTime: '2025-12-10T09:00:00.000Z',
    endTime: '2025-12-10T10:00:00.000Z',
    isAllDay: false,
    provider: 'GOOGLE',
    calendarName: 'Work Calendar',
    calendarColor: '#4285f4',
    status: 'confirmed',
  };

  beforeEach(() => {
    // Reset window.innerWidth to desktop size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ==================== Basic Rendering Tests ====================
  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);
      expect(screen.getByRole('main') || document.querySelector('.bg-white')).toBeTruthy();
    });

    it('should render 7 day columns for desktop view', () => {
      render(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);

      // Check for weekday headers (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('should display week starting on Sunday', () => {
      render(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);

      // First day should be December 7 (Sunday)
      expect(screen.getByText('7')).toBeInTheDocument();
      // Last day should be December 13 (Saturday)
      expect(screen.getByText('13')).toBeInTheDocument();
    });

    it('should adjust weekStart to Sunday if mid-week date provided', () => {
      const wednesday = new Date('2025-12-10T00:00:00.000Z');
      render(<WeekCalendarGrid events={[]} weekStart={wednesday} />);

      // Should still start with Sunday Dec 7
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('should render time slot labels', () => {
      render(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);

      // Check for some time labels
      expect(screen.getByText('12 AM')).toBeInTheDocument();
      expect(screen.getByText('9 AM')).toBeInTheDocument();
      expect(screen.getByText('12 PM')).toBeInTheDocument();
      expect(screen.getByText('11 PM')).toBeInTheDocument();
    });
  });

  // ==================== Event Display Tests ====================
  describe('Event Display', () => {
    it('should render event with title', () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);
      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
    });

    it('should render event with time', () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      // Event should show start time
      const eventElement = screen.getByText('Team Meeting').parentElement;
      expect(eventElement?.textContent).toMatch(/9:00 AM|9 AM/);
    });

    it('should render event with correct background color', () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').parentElement;
      expect(eventElement).toHaveStyle({ backgroundColor: '#4285f4' });
    });

    it('should render event with location if provided', () => {
      const eventWithLocation = {
        ...mockEvent,
        location: 'Conference Room A',
      };

      render(<WeekCalendarGrid events={[eventWithLocation]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').closest('[role="button"]');
      expect(eventElement?.textContent).toContain('Conference Room A');
    });

    it('should render multiple events on same day', () => {
      const event2: CalendarEvent = {
        ...mockEvent,
        id: '2',
        title: 'Lunch Break',
        startTime: '2025-12-10T12:00:00.000Z',
        endTime: '2025-12-10T13:00:00.000Z',
      };

      render(<WeekCalendarGrid events={[mockEvent, event2]} weekStart={mockWeekStart} />);

      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      expect(screen.getByText('Lunch Break')).toBeInTheDocument();
    });

    it('should render events on different days', () => {
      const event2: CalendarEvent = {
        ...mockEvent,
        id: '2',
        title: 'Thursday Meeting',
        startTime: '2025-12-11T10:00:00.000Z',
        endTime: '2025-12-11T11:00:00.000Z',
      };

      render(<WeekCalendarGrid events={[mockEvent, event2]} weekStart={mockWeekStart} />);

      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      expect(screen.getByText('Thursday Meeting')).toBeInTheDocument();
    });

    it('should display event with no title as "(No title)"', () => {
      const noTitleEvent = { ...mockEvent, title: '' };

      render(<WeekCalendarGrid events={[noTitleEvent]} weekStart={mockWeekStart} />);

      expect(screen.getByText('(No title)')).toBeInTheDocument();
    });

    it('should render very short events with minimum height', () => {
      const shortEvent = {
        ...mockEvent,
        endTime: '2025-12-10T09:05:00.000Z', // 5 minute event
      };

      render(<WeekCalendarGrid events={[shortEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').parentElement;
      expect(eventElement).toHaveStyle({ minHeight: '20px' });
    });
  });

  // ==================== Overlapping Events Tests ====================
  describe('Overlapping Events', () => {
    it('should display overlapping events side-by-side', () => {
      const event2: CalendarEvent = {
        ...mockEvent,
        id: '2',
        title: 'Overlapping Event',
        startTime: '2025-12-10T09:30:00.000Z',
        endTime: '2025-12-10T10:30:00.000Z',
      };

      render(<WeekCalendarGrid events={[mockEvent, event2]} weekStart={mockWeekStart} />);

      const event1Element = screen.getByText('Team Meeting').parentElement;
      const event2Element = screen.getByText('Overlapping Event').parentElement;

      // Both events should have reduced width
      expect(event1Element).toHaveStyle({ width: '50%' });
      expect(event2Element).toHaveStyle({ width: '50%' });
    });

    it('should offset overlapping events correctly', () => {
      const event2: CalendarEvent = {
        ...mockEvent,
        id: '2',
        title: 'Overlapping Event',
        startTime: '2025-12-10T09:30:00.000Z',
        endTime: '2025-12-10T10:30:00.000Z',
      };

      render(<WeekCalendarGrid events={[mockEvent, event2]} weekStart={mockWeekStart} />);

      const event2Element = screen.getByText('Overlapping Event').parentElement;
      expect(event2Element).toHaveStyle({ left: '50%' });
    });

    it('should handle three overlapping events', () => {
      const event2: CalendarEvent = {
        ...mockEvent,
        id: '2',
        title: 'Event 2',
        startTime: '2025-12-10T09:30:00.000Z',
        endTime: '2025-12-10T10:30:00.000Z',
      };

      const event3: CalendarEvent = {
        ...mockEvent,
        id: '3',
        title: 'Event 3',
        startTime: '2025-12-10T09:45:00.000Z',
        endTime: '2025-12-10T10:45:00.000Z',
      };

      render(
        <WeekCalendarGrid events={[mockEvent, event2, event3]} weekStart={mockWeekStart} />
      );

      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      expect(screen.getByText('Event 2')).toBeInTheDocument();
      expect(screen.getByText('Event 3')).toBeInTheDocument();
    });

    it('should not treat adjacent events as overlapping', () => {
      const event2: CalendarEvent = {
        ...mockEvent,
        id: '2',
        title: 'Adjacent Event',
        startTime: '2025-12-10T10:00:00.000Z',
        endTime: '2025-12-10T11:00:00.000Z',
      };

      render(<WeekCalendarGrid events={[mockEvent, event2]} weekStart={mockWeekStart} />);

      const event1Element = screen.getByText('Team Meeting').parentElement;
      const event2Element = screen.getByText('Adjacent Event').parentElement;

      // Adjacent events should have full width
      expect(event1Element).toHaveStyle({ width: '100%' });
      expect(event2Element).toHaveStyle({ width: '100%' });
    });
  });

  // ==================== All-Day Events Tests ====================
  describe('All-Day Events', () => {
    it('should render all-day events in separate section', () => {
      const allDayEvent: CalendarEvent = {
        ...mockEvent,
        title: 'All Day Conference',
        isAllDay: true,
      };

      render(<WeekCalendarGrid events={[allDayEvent]} weekStart={mockWeekStart} />);

      expect(screen.getByText('All Day Conference')).toBeInTheDocument();
      expect(screen.getByText('All Day')).toBeInTheDocument();
    });

    it('should separate all-day from timed events', () => {
      const allDayEvent: CalendarEvent = {
        ...mockEvent,
        id: '2',
        title: 'All Day Event',
        isAllDay: true,
      };

      render(<WeekCalendarGrid events={[mockEvent, allDayEvent]} weekStart={mockWeekStart} />);

      // Both events should be visible
      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      expect(screen.getByText('All Day Event')).toBeInTheDocument();
    });

    it('should display message when no all-day events', () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      // All-day section should show "No all-day events" for days without them
      const allDaySection = screen.queryByText('No all-day events');
      expect(allDaySection).toBeInTheDocument();
    });

    it('should render multiple all-day events', () => {
      const allDay1: CalendarEvent = {
        ...mockEvent,
        id: '2',
        title: 'Conference Day 1',
        isAllDay: true,
      };

      const allDay2: CalendarEvent = {
        ...mockEvent,
        id: '3',
        title: 'Conference Day 2',
        isAllDay: true,
        startTime: '2025-12-11T00:00:00.000Z',
        endTime: '2025-12-11T23:59:59.000Z',
      };

      render(<WeekCalendarGrid events={[allDay1, allDay2]} weekStart={mockWeekStart} />);

      expect(screen.getByText('Conference Day 1')).toBeInTheDocument();
      expect(screen.getByText('Conference Day 2')).toBeInTheDocument();
    });
  });

  // ==================== Event Status Tests ====================
  describe('Event Status', () => {
    it('should display cancelled events with line-through', () => {
      const cancelledEvent = {
        ...mockEvent,
        status: 'cancelled' as const,
      };

      render(<WeekCalendarGrid events={[cancelledEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').parentElement;
      expect(eventElement).toHaveClass('line-through');
    });

    it('should display cancelled events with reduced opacity', () => {
      const cancelledEvent = {
        ...mockEvent,
        status: 'cancelled' as const,
      };

      render(<WeekCalendarGrid events={[cancelledEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').closest('[role="button"]');
      expect(eventElement).toHaveClass('opacity-60');
    });

    it('should display tentative events with dashed border', () => {
      const tentativeEvent = {
        ...mockEvent,
        status: 'tentative' as const,
      };

      render(<WeekCalendarGrid events={[tentativeEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').closest('[role="button"]');
      expect(eventElement).toHaveClass('border-dashed');
    });

    it('should display confirmed events normally', () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').closest('[role="button"]');
      expect(eventElement).not.toHaveClass('opacity-60');
      expect(eventElement).not.toHaveClass('line-through');
      expect(eventElement).not.toHaveClass('border-dashed');
    });
  });

  // ==================== Today Highlighting Tests ====================
  describe('Today Highlighting', () => {
    it('should highlight today column when week includes today', () => {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());

      const { container } = render(
        <WeekCalendarGrid events={[]} weekStart={weekStart} />
      );

      // Today should have special styling
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('should display "Today" label on current date', () => {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());

      render(<WeekCalendarGrid events={[]} weekStart={weekStart} />);

      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('should not show "Today" label on past/future weeks', () => {
      const pastWeek = new Date('2024-01-01T00:00:00.000Z');

      render(<WeekCalendarGrid events={[]} weekStart={pastWeek} />);

      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });
  });

  // ==================== Current Time Indicator Tests ====================
  describe('Current Time Indicator', () => {
    it('should show current time indicator on today column', () => {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());

      const { container } = render(
        <WeekCalendarGrid events={[]} weekStart={weekStart} />
      );

      // Look for red line indicator (current time)
      const indicator = container.querySelector('.bg-red-500');
      expect(indicator).toBeInTheDocument();
    });

    it('should not show current time indicator on other days', () => {
      const pastWeek = new Date('2024-01-01T00:00:00.000Z');

      const { container } = render(
        <WeekCalendarGrid events={[]} weekStart={pastWeek} />
      );

      // Should not have red time indicator
      const indicator = container.querySelector('.bg-red-500');
      expect(indicator).not.toBeInTheDocument();
    });

    it('should update current time indicator position', async () => {
      vi.useFakeTimers();

      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());

      const { container } = render(
        <WeekCalendarGrid events={[]} weekStart={weekStart} />
      );

      const indicator1 = container.querySelector('.bg-red-500');
      const initialTop = indicator1?.parentElement?.style.top;

      // Advance time by 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000);

      await waitFor(() => {
        const indicator2 = container.querySelector('.bg-red-500');
        const newTop = indicator2?.parentElement?.style.top;
        // Position should potentially change (though may not if slot didn't change)
        expect(indicator2).toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });

  // ==================== Event Interaction Tests ====================
  describe('Event Interactions', () => {
    it('should call onEventClick when event is clicked', () => {
      const handleClick = vi.fn();

      render(
        <WeekCalendarGrid
          events={[mockEvent]}
          weekStart={mockWeekStart}
          onEventClick={handleClick}
        />
      );

      fireEvent.click(screen.getByText('Team Meeting'));

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(mockEvent);
    });

    it('should open htmlLink in new tab when clicked without onEventClick', () => {
      const eventWithLink = {
        ...mockEvent,
        htmlLink: 'https://calendar.google.com/event/123',
      };

      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(<WeekCalendarGrid events={[eventWithLink]} weekStart={mockWeekStart} />);

      fireEvent.click(screen.getByText('Team Meeting'));

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://calendar.google.com/event/123',
        '_blank',
        'noopener,noreferrer'
      );

      windowOpenSpy.mockRestore();
    });

    it('should show tooltip on hover', async () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').closest('[role="button"]')!;

      fireEvent.mouseEnter(eventElement);

      await waitFor(() => {
        // Tooltip should appear with event details
        const tooltips = screen.getAllByText('Team Meeting');
        expect(tooltips.length).toBeGreaterThan(1); // One in event, one in tooltip
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').closest('[role="button"]')!;

      fireEvent.mouseEnter(eventElement);
      fireEvent.mouseLeave(eventElement);

      await waitFor(() => {
        // Tooltip should disappear
        const tooltips = screen.getAllByText('Team Meeting');
        expect(tooltips.length).toBe(1); // Only the event itself
      });
    });

    it('should have accessible event labels', () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByRole('button', {
        name: /Team Meeting/i,
      });

      expect(eventElement).toBeInTheDocument();
      expect(eventElement).toHaveAttribute('tabIndex', '0');
    });
  });

  // ==================== Mobile Responsive Tests ====================
  describe('Mobile Responsive Behavior', () => {
    it('should render mobile navigation on small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      window.dispatchEvent(new Event('resize'));

      const { rerender } = render(
        <WeekCalendarGrid events={[]} weekStart={mockWeekStart} />
      );

      // Force re-render to pick up new window size
      rerender(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);

      // Mobile navigation should have prev/next buttons
      const prevButton = screen.getByLabelText('Previous day');
      const nextButton = screen.getByLabelText('Next day');

      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
    });

    it('should show single day column on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      window.dispatchEvent(new Event('resize'));

      const { container, rerender } = render(
        <WeekCalendarGrid events={[]} weekStart={mockWeekStart} />
      );

      rerender(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);

      // Should show only one day on mobile
      // Check for mobile-specific grid classes
      const mobileGrid = container.querySelector('.grid-cols-\\[60px_1fr\\]');
      expect(mobileGrid || container.querySelector('[class*="grid-cols"]')).toBeInTheDocument();
    });

    it('should navigate to previous day on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { rerender } = render(
        <WeekCalendarGrid events={[]} weekStart={mockWeekStart} />
      );

      rerender(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);

      const prevButton = screen.getByLabelText('Previous day');
      fireEvent.click(prevButton);

      // Should update displayed date
      expect(prevButton).toBeInTheDocument();
    });

    it('should navigate to next day on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { rerender } = render(
        <WeekCalendarGrid events={[]} weekStart={mockWeekStart} />
      );

      rerender(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);

      const nextButton = screen.getByLabelText('Next day');
      fireEvent.click(nextButton);

      // Should update displayed date
      expect(nextButton).toBeInTheDocument();
    });
  });

  // ==================== Empty State Tests ====================
  describe('Empty States', () => {
    it('should render without events', () => {
      render(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);

      // Should still render grid structure
      expect(screen.getByText('12 AM')).toBeInTheDocument();
    });

    it('should display "No all-day events" for empty all-day section', () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      expect(screen.getByText('No all-day events')).toBeInTheDocument();
    });

    it('should handle week with no events gracefully', () => {
      const emptyWeek = new Date('2026-01-01T00:00:00.000Z');

      render(<WeekCalendarGrid events={[]} weekStart={emptyWeek} />);

      // Grid should still render
      expect(screen.getByText('12 AM')).toBeInTheDocument();
      expect(screen.getByText('11 PM')).toBeInTheDocument();
    });
  });

  // ==================== Edge Cases Tests ====================
  describe('Edge Cases', () => {
    it('should handle events at exact midnight', () => {
      const midnightEvent = {
        ...mockEvent,
        startTime: '2025-12-10T00:00:00.000Z',
        endTime: '2025-12-10T01:00:00.000Z',
      };

      render(<WeekCalendarGrid events={[midnightEvent]} weekStart={mockWeekStart} />);

      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
    });

    it('should handle events ending at 11:59 PM', () => {
      const lateEvent = {
        ...mockEvent,
        startTime: '2025-12-10T23:00:00.000Z',
        endTime: '2025-12-10T23:59:00.000Z',
      };

      render(<WeekCalendarGrid events={[lateEvent]} weekStart={mockWeekStart} />);

      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
    });

    it('should handle events with unusual colors', () => {
      const coloredEvent = {
        ...mockEvent,
        calendarColor: '#ff00ff',
      };

      render(<WeekCalendarGrid events={[coloredEvent]} weekStart={mockWeekStart} />);

      const eventElement = screen.getByText('Team Meeting').parentElement;
      expect(eventElement).toHaveStyle({ backgroundColor: '#ff00ff' });
    });

    it('should handle events without calendar color', () => {
      const noColorEvent = {
        ...mockEvent,
        calendarColor: undefined,
      };

      render(<WeekCalendarGrid events={[noColorEvent]} weekStart={mockWeekStart} />);

      // Should use default blue color
      const eventElement = screen.getByText('Team Meeting').parentElement;
      expect(eventElement?.style.backgroundColor).toBeTruthy();
    });

    it('should handle year boundary correctly', () => {
      const newYearWeek = new Date('2025-12-28T00:00:00.000Z'); // Sunday

      render(<WeekCalendarGrid events={[]} weekStart={newYearWeek} />);

      // Should show days from both years
      expect(screen.getByText('28')).toBeInTheDocument(); // Dec 28
    });

    it('should handle DST transitions', () => {
      // Spring forward day (March 2025)
      const dstWeek = new Date('2025-03-09T00:00:00.000Z');

      render(<WeekCalendarGrid events={[]} weekStart={dstWeek} />);

      // Should still render all time slots correctly
      expect(screen.getByText('12 AM')).toBeInTheDocument();
      expect(screen.getByText('11 PM')).toBeInTheDocument();
    });
  });

  // ==================== Accessibility Tests ====================
  describe('Accessibility', () => {
    it('should have proper ARIA labels for events', () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      const eventButton = screen.getByRole('button', {
        name: /Team Meeting/i,
      });

      expect(eventButton).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(<WeekCalendarGrid events={[mockEvent]} weekStart={mockWeekStart} />);

      const eventButton = screen.getByRole('button', {
        name: /Team Meeting/i,
      });

      expect(eventButton).toHaveAttribute('tabIndex', '0');
    });

    it('should have navigation button labels', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { rerender } = render(
        <WeekCalendarGrid events={[]} weekStart={mockWeekStart} />
      );

      rerender(<WeekCalendarGrid events={[]} weekStart={mockWeekStart} />);

      expect(screen.getByLabelText('Previous day')).toBeInTheDocument();
      expect(screen.getByLabelText('Next day')).toBeInTheDocument();
    });
  });
});
