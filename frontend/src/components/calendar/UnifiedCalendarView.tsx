import { useEffect, useState, useCallback } from 'react';
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

  // Styles matching Dashboard minimalism
  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    background: isActive ? '#f5f5f5' : 'transparent',
    color: isActive ? '#000' : '#666',
  });

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
      {/* Header with Navigation */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #eee',
        padding: '12px 20px',
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setViewMode('week')}
              style={buttonStyle(viewMode === 'week')}
              onMouseEnter={(e) => { if (viewMode !== 'week') e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { if (viewMode !== 'week') e.currentTarget.style.background = 'transparent'; }}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              style={buttonStyle(viewMode === 'month')}
              onMouseEnter={(e) => { if (viewMode !== 'month') e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { if (viewMode !== 'month') e.currentTarget.style.background = 'transparent'; }}
            >
              Month
            </button>
          </div>

          {/* Date Navigation - Hide week navigation on mobile since WeekCalendarGrid has day-by-day navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Previous button - hidden on mobile for week view (mobile has its own day navigation) */}
            {!(isMobile && viewMode === 'week') && (
              <button
                onClick={handlePrevious}
                disabled={isLoading}
                style={navButtonStyle}
                aria-label="Previous"
                onMouseEnter={(e) => {
                  if (!isLoading) (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Date range header - hidden on mobile for week view */}
            {!(isMobile && viewMode === 'week') && (
              <h2 style={{
                minWidth: '180px',
                textAlign: 'center',
                fontSize: '15px',
                fontWeight: '600',
                color: '#000',
                margin: 0,
                letterSpacing: '-0.01em',
              }}>
                {getHeaderText()}
              </h2>
            )}

            {/* Next button - hidden on mobile for week view (mobile has its own day navigation) */}
            {!(isMobile && viewMode === 'week') && (
              <button
                onClick={handleNext}
                disabled={isLoading}
                style={navButtonStyle}
                aria-label="Next"
                onMouseEnter={(e) => {
                  if (!isLoading) (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            <button
              onClick={handleToday}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: '500',
                background: '#f5f5f5',
                border: 'none',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.background = '#eee';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f5f5f5';
              }}
            >
              Today
            </button>

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              style={navButtonStyle}
              aria-label="Refresh"
              onMouseEnter={(e) => {
                if (!isLoading) (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <svg
                style={{
                  width: '20px',
                  height: '20px',
                  animation: isLoading ? 'spin 1s linear infinite' : 'none',
                }}
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
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #eee',
          padding: '48px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '2px solid #eee',
            borderTop: '2px solid #000',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Loading events...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div style={{
          background: '#fff',
          border: '1px solid #eee',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#DC2626',
              marginTop: '8px',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <h4 style={{ color: '#000', fontWeight: '600', fontSize: '15px', margin: '0 0 8px 0' }}>
                Failed to load events
              </h4>
              <p style={{ color: '#666', fontSize: '14px', margin: '0 0 16px 0' }}>{error}</p>
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
                Try Again
              </button>
            </div>
          </div>
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
