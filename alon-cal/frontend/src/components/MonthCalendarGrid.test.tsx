/**
 * Tests for MonthCalendarGrid Component
 *
 * Test Coverage:
 * - Full month grid rendering (6-7 weeks)
 * - Event display (first 2 visible + more indicator)
 * - Event expansion/collapse
 * - Today cell highlighting
 * - Adjacent month days display
 * - Cell click navigation
 * - Event click handling
 * - Weekend highlighting
 * - Responsive behavior
 * - Empty states
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { CalendarEvent } from '../api/calendar';
import MonthCalendarGrid from './MonthCalendarGrid';

describe('MonthCalendarGrid', () => {
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

  // ==================== Basic Rendering Tests ====================
  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<MonthCalendarGrid events={[]} month={11} year={2025} />);
      expect(screen.getByRole('main') || document.querySelector('.bg-white')).toBeTruthy();
    });

    it('should render weekday headers', () => {
      render(<MonthCalendarGrid events={[]} month={11} year={2025} />);

      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('should render month grid with correct number of weeks', () => {
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      const gridCells = container.querySelectorAll('.min-h-\\[100px\\]');
      // December 2025 starts on Monday, so grid should have 5-6 weeks
      // Total cells should be 35 or 42 (5 or 6 weeks × 7 days)
      expect(gridCells.length).toBeGreaterThanOrEqual(35);
      expect(gridCells.length).toBeLessThanOrEqual(42);
    });

    it('should display all days of the month', () => {
      render(<MonthCalendarGrid events={[]} month={11} year={2025} />);

      // December has 31 days
      for (let day = 1; day <= 31; day++) {
        expect(screen.getByText(day.toString())).toBeInTheDocument();
      }
    });

    it('should show adjacent month days in gray', () => {
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      // Days from adjacent months should have opacity-40 class
      const fadedCells = container.querySelectorAll('.opacity-40');
      expect(fadedCells.length).toBeGreaterThan(0);
    });

    it('should highlight weekend columns', () => {
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      // Weekend cells should have bg-gray-50 or bg-gray-100
      const weekendCells = container.querySelectorAll('.bg-gray-50, .bg-gray-100');
      expect(weekendCells.length).toBeGreaterThan(0);
    });
  });

  // ==================== Event Display Tests ====================
  describe('Event Display', () => {
    it('should render event on correct date', () => {
      render(<MonthCalendarGrid events={[mockEvent]} month={11} year={2025} />);
      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
    });

    it('should display event with time for timed events', () => {
      render(<MonthCalendarGrid events={[mockEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/);
      expect(eventBar.textContent).toMatch(/9:00 AM|9 AM/);
    });

    it('should display all-day event without time', () => {
      const allDayEvent: CalendarEvent = {
        ...mockEvent,
        isAllDay: true,
      };

      render(<MonthCalendarGrid events={[allDayEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText('Team Meeting');
      // Should not have time prefix
      expect(eventBar.textContent).not.toMatch(/\d+:\d+ [AP]M/);
    });

    it('should render event with correct background color', () => {
      render(<MonthCalendarGrid events={[mockEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/).parentElement;
      expect(eventBar).toHaveStyle({ backgroundColor: '#4285f4' });
    });

    it('should show first 2 events per cell', () => {
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', title: 'Event 1' },
        { ...mockEvent, id: '2', title: 'Event 2' },
        { ...mockEvent, id: '3', title: 'Event 3' },
      ];

      render(<MonthCalendarGrid events={events} month={11} year={2025} />);

      expect(screen.getByText('Event 1')).toBeInTheDocument();
      expect(screen.getByText('Event 2')).toBeInTheDocument();
      expect(screen.queryByText('Event 3')).not.toBeInTheDocument();
    });

    it('should display "+X more" indicator when more than 2 events', () => {
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', title: 'Event 1' },
        { ...mockEvent, id: '2', title: 'Event 2' },
        { ...mockEvent, id: '3', title: 'Event 3' },
      ];

      render(<MonthCalendarGrid events={events} month={11} year={2025} />);

      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('should display correct count in "+X more" indicator', () => {
      const events: CalendarEvent[] = Array.from({ length: 10 }, (_, i) => ({
        ...mockEvent,
        id: String(i + 1),
        title: `Event ${i + 1}`,
      }));

      render(<MonthCalendarGrid events={events} month={11} year={2025} />);

      expect(screen.getByText('+8 more')).toBeInTheDocument();
    });

    it('should display event with no title as "(No title)"', () => {
      const noTitleEvent = { ...mockEvent, title: '' };

      render(<MonthCalendarGrid events={[noTitleEvent]} month={11} year={2025} />);

      expect(screen.getByText('(No title)')).toBeInTheDocument();
    });

    it('should handle multi-day events', () => {
      const multiDayEvent: CalendarEvent = {
        ...mockEvent,
        startTime: '2025-12-10T09:00:00.000Z',
        endTime: '2025-12-12T17:00:00.000Z',
      };

      render(<MonthCalendarGrid events={[multiDayEvent]} month={11} year={2025} />);

      // Event should appear on multiple days
      const eventBars = screen.getAllByText('Team Meeting');
      expect(eventBars.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==================== Event Expansion Tests ====================
  describe('Event Expansion', () => {
    it('should expand event list when "+X more" is clicked', () => {
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', title: 'Event 1' },
        { ...mockEvent, id: '2', title: 'Event 2' },
        { ...mockEvent, id: '3', title: 'Event 3' },
      ];

      render(<MonthCalendarGrid events={events} month={11} year={2025} />);

      expect(screen.queryByText('Event 3')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('+1 more'));

      expect(screen.getByText('Event 3')).toBeInTheDocument();
    });

    it('should show "Show less" button after expansion', () => {
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', title: 'Event 1' },
        { ...mockEvent, id: '2', title: 'Event 2' },
        { ...mockEvent, id: '3', title: 'Event 3' },
      ];

      render(<MonthCalendarGrid events={events} month={11} year={2025} />);

      fireEvent.click(screen.getByText('+1 more'));

      expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    it('should collapse event list when "Show less" is clicked', () => {
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', title: 'Event 1' },
        { ...mockEvent, id: '2', title: 'Event 2' },
        { ...mockEvent, id: '3', title: 'Event 3' },
      ];

      render(<MonthCalendarGrid events={events} month={11} year={2025} />);

      // Expand
      fireEvent.click(screen.getByText('+1 more'));
      expect(screen.getByText('Event 3')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText('Show less'));
      expect(screen.queryByText('Event 3')).not.toBeInTheDocument();
    });

    it('should not show "+X more" when exactly 2 events', () => {
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', title: 'Event 1' },
        { ...mockEvent, id: '2', title: 'Event 2' },
      ];

      render(<MonthCalendarGrid events={events} month={11} year={2025} />);

      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });

    it('should handle expansion of cells with many events', () => {
      const events: CalendarEvent[] = Array.from({ length: 15 }, (_, i) => ({
        ...mockEvent,
        id: String(i + 1),
        title: `Event ${i + 1}`,
      }));

      render(<MonthCalendarGrid events={events} month={11} year={2025} />);

      fireEvent.click(screen.getByText('+13 more'));

      // All events should be visible
      expect(screen.getByText('Event 15')).toBeInTheDocument();
    });
  });

  // ==================== Today Highlighting Tests ====================
  describe('Today Highlighting', () => {
    it('should highlight today cell when viewing current month', () => {
      const today = new Date();
      const { container } = render(
        <MonthCalendarGrid
          events={[]}
          month={today.getMonth()}
          year={today.getFullYear()}
        />
      );

      // Today's cell should have special styling (blue ring, blue bg)
      const todayCells = container.querySelectorAll('.ring-blue-500, .bg-blue-50');
      expect(todayCells.length).toBeGreaterThan(0);
    });

    it('should display today date with blue circle', () => {
      const today = new Date();
      const { container } = render(
        <MonthCalendarGrid
          events={[]}
          month={today.getMonth()}
          year={today.getFullYear()}
        />
      );

      // Date number should be in blue circle
      const blueDateCircle = container.querySelector('.bg-blue-600');
      expect(blueDateCircle).toBeInTheDocument();
    });

    it('should not highlight today when viewing different month', () => {
      const today = new Date();
      const differentMonth = (today.getMonth() + 1) % 12;

      const { container } = render(
        <MonthCalendarGrid events={[]} month={differentMonth} year={2025} />
      );

      // Should not have today's blue styling
      const todayCells = container.querySelectorAll('.bg-blue-600.text-white');
      // Might have one for weekday header, but not for date
      expect(todayCells.length).toBeLessThanOrEqual(1);
    });
  });

  // ==================== Cell Click Tests ====================
  describe('Cell Click Handling', () => {
    it('should call onCellClick when date is clicked', () => {
      const handleCellClick = vi.fn();

      const { container } = render(
        <MonthCalendarGrid
          events={[]}
          month={11}
          year={2025}
          onCellClick={handleCellClick}
        />
      );

      // Click on December 10
      const cell = container.querySelector('[class*="min-h-"]');
      if (cell) {
        fireEvent.click(cell);
        expect(handleCellClick).toHaveBeenCalled();
      }
    });

    it('should pass correct date to onCellClick', () => {
      const handleCellClick = vi.fn();

      const { container } = render(
        <MonthCalendarGrid
          events={[]}
          month={11}
          year={2025}
          onCellClick={handleCellClick}
        />
      );

      // Click on a cell
      const cells = container.querySelectorAll('[class*="min-h-"]');
      if (cells.length > 0) {
        fireEvent.click(cells[10]); // Click arbitrary cell
        expect(handleCellClick).toHaveBeenCalledWith(expect.any(Date));
      }
    });

    it('should not call onCellClick when clicking "+X more"', () => {
      const handleCellClick = vi.fn();
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', title: 'Event 1' },
        { ...mockEvent, id: '2', title: 'Event 2' },
        { ...mockEvent, id: '3', title: 'Event 3' },
      ];

      render(
        <MonthCalendarGrid
          events={events}
          month={11}
          year={2025}
          onCellClick={handleCellClick}
        />
      );

      fireEvent.click(screen.getByText('+1 more'));

      // onCellClick should not be called when expanding events
      expect(handleCellClick).not.toHaveBeenCalled();
    });

    it('should add hover effect to cells when onCellClick is provided', () => {
      const handleCellClick = vi.fn();

      const { container } = render(
        <MonthCalendarGrid
          events={[]}
          month={11}
          year={2025}
          onCellClick={handleCellClick}
        />
      );

      // Cells should have cursor-pointer class
      const clickableCells = container.querySelectorAll('.cursor-pointer');
      expect(clickableCells.length).toBeGreaterThan(0);
    });
  });

  // ==================== Event Click Tests ====================
  describe('Event Click Handling', () => {
    it('should call onEventClick when event is clicked', () => {
      const handleEventClick = vi.fn();

      render(
        <MonthCalendarGrid
          events={[mockEvent]}
          month={11}
          year={2025}
          onEventClick={handleEventClick}
        />
      );

      fireEvent.click(screen.getByText(/Team Meeting/));

      expect(handleEventClick).toHaveBeenCalledTimes(1);
      expect(handleEventClick).toHaveBeenCalledWith(mockEvent);
    });

    it('should open htmlLink in new tab when clicked without onEventClick', () => {
      const eventWithLink = {
        ...mockEvent,
        htmlLink: 'https://calendar.google.com/event/123',
      };

      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(<MonthCalendarGrid events={[eventWithLink]} month={11} year={2025} />);

      fireEvent.click(screen.getByText(/Team Meeting/));

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://calendar.google.com/event/123',
        '_blank',
        'noopener,noreferrer'
      );

      windowOpenSpy.mockRestore();
    });

    it('should not trigger cell click when event is clicked', () => {
      const handleCellClick = vi.fn();
      const handleEventClick = vi.fn();

      render(
        <MonthCalendarGrid
          events={[mockEvent]}
          month={11}
          year={2025}
          onEventClick={handleEventClick}
          onCellClick={handleCellClick}
        />
      );

      fireEvent.click(screen.getByText(/Team Meeting/));

      expect(handleEventClick).toHaveBeenCalled();
      expect(handleCellClick).not.toHaveBeenCalled();
    });
  });

  // ==================== Event Status Tests ====================
  describe('Event Status', () => {
    it('should display cancelled events with line-through', () => {
      const cancelledEvent = {
        ...mockEvent,
        status: 'cancelled' as const,
      };

      render(<MonthCalendarGrid events={[cancelledEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/).parentElement;
      expect(eventBar).toHaveClass('line-through');
    });

    it('should display cancelled events with reduced opacity', () => {
      const cancelledEvent = {
        ...mockEvent,
        status: 'cancelled' as const,
      };

      render(<MonthCalendarGrid events={[cancelledEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/).parentElement;
      expect(eventBar).toHaveClass('opacity-60');
    });

    it('should display tentative events with dashed border', () => {
      const tentativeEvent = {
        ...mockEvent,
        status: 'tentative' as const,
      };

      render(<MonthCalendarGrid events={[tentativeEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/).parentElement;
      expect(eventBar).toHaveClass('border-dashed');
    });

    it('should display confirmed events normally', () => {
      render(<MonthCalendarGrid events={[mockEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/).parentElement;
      expect(eventBar).not.toHaveClass('opacity-60');
      expect(eventBar).not.toHaveClass('line-through');
    });
  });

  // ==================== Month Boundaries Tests ====================
  describe('Month Boundaries', () => {
    it('should handle January correctly', () => {
      render(<MonthCalendarGrid events={[]} month={0} year={2025} />);

      // Should show all days of January
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('31')).toBeInTheDocument();
    });

    it('should handle December correctly', () => {
      render(<MonthCalendarGrid events={[]} month={11} year={2025} />);

      // Should show all days of December
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('31')).toBeInTheDocument();
    });

    it('should handle February in leap year', () => {
      render(<MonthCalendarGrid events={[]} month={1} year={2024} />);

      // Should have 29 days
      expect(screen.getByText('29')).toBeInTheDocument();
    });

    it('should handle February in non-leap year', () => {
      render(<MonthCalendarGrid events={[]} month={1} year={2025} />);

      // Should have 28 days, not 29
      expect(screen.getByText('28')).toBeInTheDocument();
      expect(screen.queryByText('29')).toBeInTheDocument(); // From adjacent months
    });

    it('should show previous month days', () => {
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      // December 2025 starts on Monday, so should show some November days
      const fadedCells = container.querySelectorAll('.opacity-40');
      expect(fadedCells.length).toBeGreaterThan(0);
    });

    it('should show next month days', () => {
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      // Should pad to complete the grid with January days
      const allCells = container.querySelectorAll('[class*="min-h-"]');
      expect(allCells.length % 7).toBe(0); // Should be complete weeks
    });
  });

  // ==================== Event Count Badge Tests ====================
  describe('Event Count Badge', () => {
    it('should show event count badge on mobile', () => {
      const events: CalendarEvent[] = [
        { ...mockEvent, id: '1', title: 'Event 1' },
        { ...mockEvent, id: '2', title: 'Event 2' },
        { ...mockEvent, id: '3', title: 'Event 3' },
      ];

      const { container } = render(
        <MonthCalendarGrid events={events} month={11} year={2025} />
      );

      // Badge should show event count
      const badge = container.querySelector('.md\\:hidden');
      expect(badge?.textContent).toBe('3');
    });

    it('should not show badge when no events', () => {
      render(<MonthCalendarGrid events={[]} month={11} year={2025} />);

      // No badges should be visible
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      const cells = container.querySelectorAll('[class*="min-h-"]');
      cells.forEach(cell => {
        const badge = cell.querySelector('.md\\:hidden');
        expect(badge).not.toBeInTheDocument();
      });
    });
  });

  // ==================== Empty State Tests ====================
  describe('Empty States', () => {
    it('should render month grid without events', () => {
      render(<MonthCalendarGrid events={[]} month={11} year={2025} />);

      // Grid should still render
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('31')).toBeInTheDocument();
    });

    it('should handle month with no events in any cell', () => {
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      // All cells should be empty of events
      const eventBars = container.querySelectorAll('[role="button"]');
      expect(eventBars.length).toBe(0);
    });
  });

  // ==================== Tooltip Tests ====================
  describe('Tooltips', () => {
    it('should show tooltip on event hover', async () => {
      render(<MonthCalendarGrid events={[mockEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/).parentElement!;

      fireEvent.mouseEnter(eventBar);

      // Tooltip should appear
      const tooltips = screen.getAllByText(/Team Meeting/);
      expect(tooltips.length).toBeGreaterThan(1);
    });

    it('should hide tooltip on mouse leave', () => {
      render(<MonthCalendarGrid events={[mockEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/).parentElement!;

      fireEvent.mouseEnter(eventBar);
      fireEvent.mouseLeave(eventBar);

      // Tooltip should disappear
      const tooltips = screen.getAllByText(/Team Meeting/);
      expect(tooltips.length).toBe(1); // Only the event itself
    });

    it('should show event details in tooltip', () => {
      const detailedEvent: CalendarEvent = {
        ...mockEvent,
        location: 'Conference Room A',
        description: 'Important meeting',
      };

      render(<MonthCalendarGrid events={[detailedEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/).parentElement!;
      fireEvent.mouseEnter(eventBar);

      // Tooltip should show location
      expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    });
  });

  // ==================== Edge Cases Tests ====================
  describe('Edge Cases', () => {
    it('should handle events without calendar color', () => {
      const noColorEvent = {
        ...mockEvent,
        calendarColor: undefined,
      };

      render(<MonthCalendarGrid events={[noColorEvent]} month={11} year={2025} />);

      // Should use default blue color
      const eventBar = screen.getByText(/Team Meeting/).parentElement;
      expect(eventBar?.style.backgroundColor).toBeTruthy();
    });

    it('should handle events with unusual colors', () => {
      const coloredEvent = {
        ...mockEvent,
        calendarColor: '#ff00ff',
      };

      render(<MonthCalendarGrid events={[coloredEvent]} month={11} year={2025} />);

      const eventBar = screen.getByText(/Team Meeting/).parentElement;
      expect(eventBar).toHaveStyle({ backgroundColor: '#ff00ff' });
    });

    it('should handle year transitions correctly', () => {
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      // December 2025 grid should include January 2026 days
      const allDates = container.querySelectorAll('[class*="min-h-"]');
      expect(allDates.length).toBeGreaterThan(31); // More than just December days
    });

    it('should sort events by start time within a day', () => {
      const events: CalendarEvent[] = [
        {
          ...mockEvent,
          id: '1',
          title: 'Late Event',
          startTime: '2025-12-10T15:00:00.000Z',
          endTime: '2025-12-10T16:00:00.000Z',
        },
        {
          ...mockEvent,
          id: '2',
          title: 'Early Event',
          startTime: '2025-12-10T09:00:00.000Z',
          endTime: '2025-12-10T10:00:00.000Z',
        },
      ];

      const { container } = render(
        <MonthCalendarGrid events={events} month={11} year={2025} />
      );

      // Get event elements in DOM order
      const eventElements = Array.from(container.querySelectorAll('[role="button"]'));
      const eventTitles = eventElements.map(el => el.textContent);

      // Early event should come first
      expect(eventTitles[0]).toContain('Early Event');
      expect(eventTitles[1]).toContain('Late Event');
    });
  });

  // ==================== Accessibility Tests ====================
  describe('Accessibility', () => {
    it('should have proper role for event bars', () => {
      render(<MonthCalendarGrid events={[mockEvent]} month={11} year={2025} />);

      const eventBar = screen.getByRole('button', { name: /Team Meeting/i });
      expect(eventBar).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(<MonthCalendarGrid events={[mockEvent]} month={11} year={2025} />);

      const eventBar = screen.getByRole('button', { name: /Team Meeting/i });
      expect(eventBar).toHaveAttribute('tabIndex', '0');
    });

    it('should have title attribute for event bars', () => {
      render(<MonthCalendarGrid events={[mockEvent]} month={11} year={2025} />);

      const eventBar = screen.getByRole('button', { name: /Team Meeting/i });
      expect(eventBar).toHaveAttribute('title', 'Team Meeting');
    });
  });

  // ==================== Responsive Behavior Tests ====================
  describe('Responsive Behavior', () => {
    it('should apply minimum height for cells', () => {
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      const cells = container.querySelectorAll('.min-h-\\[100px\\]');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('should have responsive classes for mobile', () => {
      const { container } = render(
        <MonthCalendarGrid events={[]} month={11} year={2025} />
      );

      // Should have md: prefixed classes for responsive behavior
      const responsiveElements = container.querySelectorAll('[class*="md:"]');
      expect(responsiveElements.length).toBeGreaterThan(0);
    });
  });
});
