import { useEffect, useState } from 'react';
import type { CalendarEvent } from '../../api/calendar/calendar';
import calendarApi from '../../api/calendar/calendar';
import { useToast } from '../../hooks/calendar/useToast';
import { useAuth } from '../../hooks/calendar/useAuth';
import WeekCalendarGrid from './WeekCalendarGrid';
import MonthCalendarGrid from './MonthCalendarGrid';
import { getUserTimezone } from '../../utils/calendar/dateTime';

interface UnifiedCalendarViewProps {
  /** Optional callback when an event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** Controlled view mode (if provided, component won't manage view mode internally) */
  viewMode?: 'week' | 'month';
  /** Callback when view mode changes (used with controlled viewMode) */
  onViewModeChange?: (mode: 'week' | 'month') => void;
  /** Callback when events are loaded - useful for external components like Today's Plan */
  onEventsLoaded?: (events: CalendarEvent[]) => void;
}

/**
 * Unified calendar view showing all events from connected calendars
 * Displays events in a week view with navigation controls
 */
export default function UnifiedCalendarView({
  onEventClick,
  viewMode: controlledViewMode,
  onViewModeChange,
  onEventsLoaded,
}: UnifiedCalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [internalViewMode, setInternalViewMode] = useState<'week' | 'month'>('week');
  const [currentTime, setCurrentTime] = useState(new Date());
  const { error: showError } = useToast();
  const { user } = useAuth();

  // Use controlled mode if provided, otherwise use internal state
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = (mode: 'week' | 'month') => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  // Calculate date range based on view mode
  const getDateRange = (date: Date, mode: 'week' | 'month') => {
    if (mode === 'week') {
      // Get start of week (Sunday)
      const start = new Date(date);
      start.setDate(date.getDate() - date.getDay());
      start.setHours(0, 0, 0, 0);

      // Get end of week (Saturday)
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      return { start, end };
    } else {
      // For month view, fetch data for entire grid (including adjacent month days)
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      // Get the Sunday before or on the first day of month
      const start = new Date(firstDay);
      start.setDate(1 - firstDay.getDay());
      start.setHours(0, 0, 0, 0);

      // Get the Saturday after or on the last day of month
      const end = new Date(lastDay);
      end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
      end.setHours(23, 59, 59, 999);

      return { start, end };
    }
  };

  // Fetch events for current date range
  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange(currentDate, viewMode);
      const fetchedEvents = await calendarApi.getEvents(start, end);
      setEvents(fetchedEvents);
      onEventsLoaded?.(fetchedEvents);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load events';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch events when date or view mode changes
  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, viewMode]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Navigation handlers
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() - 7);
    } else {
      newDate.setMonth(currentDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + 7);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const { start, end } = getDateRange(currentDate, viewMode);

  // Get current week start for week view
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // Handle cell click in month view (navigate to week view or show day details)
  const handleMonthCellClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode('week');
  };

  // Format header text
  const getHeaderText = () => {
    if (viewMode === 'week') {
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      const year = start.getFullYear();

      if (startMonth === endMonth) {
        return `${startMonth} ${start.getDate()}-${end.getDate()}, ${year}`;
      } else {
        return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`;
      }
    } else {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  // Get timezone (user preference or browser default)
  const timezone = user?.timezone || getUserTimezone();

  // Get next event or current event for countdown
  const getCountdownInfo = () => {
    const now = currentTime.getTime();

    // Filter out cancelled events and sort by start time
    const upcomingEvents = events
      .filter((event) => event.status !== 'cancelled')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Check if currently in an event
    const currentEvent = upcomingEvents.find((event) => {
      const eventStart = new Date(event.startTime).getTime();
      const eventEnd = new Date(event.endTime).getTime();
      return now >= eventStart && now < eventEnd;
    });

    if (currentEvent) {
      const eventEnd = new Date(currentEvent.endTime).getTime();
      const secondsRemaining = Math.floor((eventEnd - now) / 1000);
      return {
        type: 'current' as const,
        event: currentEvent,
        secondsRemaining,
      };
    }

    // Find next upcoming event
    const nextEvent = upcomingEvents.find((event) => {
      const eventStart = new Date(event.startTime).getTime();
      return eventStart > now;
    });

    if (nextEvent) {
      const eventStart = new Date(nextEvent.startTime).getTime();
      const secondsUntil = Math.floor((eventStart - now) / 1000);
      return {
        type: 'upcoming' as const,
        event: nextEvent,
        secondsUntil,
      };
    }

    return null;
  };

  const countdownInfo = getCountdownInfo();

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevious}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Previous"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="min-w-[200px] text-center">
              <h2 className="text-lg font-semibold text-gray-900">{getHeaderText()}</h2>
            </div>

            <button
              onClick={handleNext}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Next"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={handleToday}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Today
            </button>

            <button
              onClick={fetchEvents}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <svg
                className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <svg
            className="animate-spin h-10 w-10 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-red-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-red-800 font-semibold mb-1">Failed to load events</h4>
              <p className="text-red-700 text-sm mb-3">{error}</p>
              <button
                onClick={fetchEvents}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid Views */}
      {!isLoading && !error && (
        <>
          {viewMode === 'week' ? (
            <WeekCalendarGrid
              events={events}
              weekStart={weekStart}
              onEventClick={onEventClick}
              countdownInfo={countdownInfo}
              timezone={timezone}
            />
          ) : (
            <MonthCalendarGrid
              events={events}
              month={currentDate.getMonth()}
              year={currentDate.getFullYear()}
              onEventClick={onEventClick}
              onCellClick={handleMonthCellClick}
              timezone={timezone}
            />
          )}
        </>
      )}
    </div>
  );
}
