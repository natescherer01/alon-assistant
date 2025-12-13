import { useEffect, useState, useCallback, useMemo } from 'react';
import type { CalendarEvent } from '../../api/calendar/calendar';
import type { FreeSlot } from '../../api/calendar/users';
import { useAuth } from '../../hooks/calendar/useAuth';
import { useWeekEvents } from '../../hooks/calendar/useWeekEvents';
import { useMonthEvents } from '../../hooks/calendar/useMonthEvents';
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
  /** Free time slots to highlight with green overlay */
  freeSlots?: FreeSlot[] | null;
  /** Callback to create a new event */
  onCreateEvent?: () => void;
}

/**
 * Unified calendar view showing all events from connected calendars
 * Displays events in a week view with navigation controls
 */
export default function UnifiedCalendarView({
  onEventClick,
  viewMode: controlledViewMode,
  onViewModeChange,
  freeSlots,
  onCreateEvent,
}: UnifiedCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [internalViewMode, setInternalViewMode] = useState<'week' | 'month'>('week');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { user } = useAuth();

  // Handle window resize for responsive mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use controlled mode if provided, otherwise use internal state
  const viewMode = controlledViewMode ?? internalViewMode;

  // Week view: Use React Query hook with automatic prefetching (±2 weeks)
  const {
    events: weekEvents,
    isLoading: weekLoading,
    error: weekError,
    refetch: refetchWeek,
  } = useWeekEvents(currentDate, {
    enabled: viewMode === 'week',
    prefetchDistance: 2, // Preload 2 weeks ahead and behind
  });

  // Month view: Use React Query hook (events preloaded on app start)
  const {
    events: monthEvents,
    isLoading: monthLoading,
    error: monthError,
    refetch: refetchMonth,
  } = useMonthEvents(currentDate, {
    enabled: viewMode === 'month',
  });

  // Derive current events and loading state based on view mode
  const events = viewMode === 'week' ? weekEvents : monthEvents;
  const isLoading = viewMode === 'week' ? weekLoading : monthLoading;
  const error = viewMode === 'week' ? (weekError?.message ?? null) : (monthError?.message ?? null);

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

  // Handle refresh button - refetch based on current view
  const handleRefresh = useCallback(() => {
    if (viewMode === 'week') {
      refetchWeek();
    } else {
      refetchMonth();
    }
  }, [viewMode, refetchWeek, refetchMonth]);

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

  // Get current week start for week view - memoized to prevent unnecessary rerenders
  // This is important because WeekCalendarGrid uses weekStart in a useEffect dependency
  // Without memoization, the countdown timer's setCurrentTime would create a new Date object
  // every second, triggering the useEffect and resetting the mobile day view
  const weekStart = useMemo(() => {
    const ws = new Date(currentDate);
    ws.setDate(currentDate.getDate() - currentDate.getDay());
    ws.setHours(0, 0, 0, 0);
    return ws;
  }, [currentDate]);

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

  const navButtonStyle: React.CSSProperties = {
    padding: '8px',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Minimal Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Left: Date and navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!(isMobile && viewMode === 'week') && (
            <button
              onClick={handlePrevious}
              disabled={isLoading}
              style={navButtonStyle}
              aria-label="Previous"
              onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg style={{ width: '18px', height: '18px', color: '#666' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {!(isMobile && viewMode === 'week') && (
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#000',
              margin: 0,
              letterSpacing: '-0.02em',
              minWidth: '160px',
            }}>
              {getHeaderText()}
            </h2>
          )}

          {!(isMobile && viewMode === 'week') && (
            <button
              onClick={handleNext}
              disabled={isLoading}
              style={navButtonStyle}
              aria-label="Next"
              onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg style={{ width: '18px', height: '18px', color: '#666' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Mode Toggle - subtle pills */}
          <div style={{
            display: 'flex',
            background: '#f5f5f5',
            borderRadius: '6px',
            padding: '2px',
          }}>
            <button
              onClick={() => setViewMode('week')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: '500',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: viewMode === 'week' ? '#fff' : 'transparent',
                color: viewMode === 'week' ? '#000' : '#666',
                boxShadow: viewMode === 'week' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: '500',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: viewMode === 'month' ? '#fff' : 'transparent',
                color: viewMode === 'month' ? '#000' : '#666',
                boxShadow: viewMode === 'month' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Month
            </button>
          </div>

          <button
            onClick={handleToday}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '500',
              background: 'transparent',
              border: '1px solid #eee',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              color: '#666',
            }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Today
          </button>

          {!isMobile && onCreateEvent && (
            <button
              onClick={onCreateEvent}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: '500',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#000'; }}
            >
              <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
          )}
        </div>
      </div>

      {/* Loading State - minimal */}
      {isLoading && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid #eee',
            borderTop: '2px solid #000',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
        </div>
      )}

      {/* Error State - minimal */}
      {error && !isLoading && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}>
          <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Failed to load events</p>
          <button
            onClick={handleRefresh}
            style={{
              background: '#f5f5f5',
              color: '#000',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#eee'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
          >
            Retry
          </button>
        </div>
      )}

      {/* Calendar Grid Views */}
      {!isLoading && !error && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
          {viewMode === 'week' ? (
            <WeekCalendarGrid
              events={events}
              weekStart={weekStart}
              onEventClick={onEventClick}
              countdownInfo={countdownInfo}
              timezone={timezone}
              freeSlots={freeSlots}
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
        </div>
      )}

      {/* Spin Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
