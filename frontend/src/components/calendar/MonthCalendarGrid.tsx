import { useMemo, useState, useEffect } from 'react';
import type { CalendarEvent } from '../../api/calendar/calendar';
import {
  getMonthGrid,
  isToday,
  isCurrentMonth,
  getWeekdayNameShort,
  formatTime,
  validateAndSanitizeUrl,
  sanitizeEventText,
} from '../../utils/calendar/calendarGrid';
import {
  getCalendarColor,
  adjustColorBrightness,
  getContrastColor,
  type Provider,
} from '../../utils/calendar/calendarColors';

interface MonthCalendarGridProps {
  /** Array of calendar events to display */
  events: CalendarEvent[];
  /** Month (0-11) */
  month: number;
  /** Year */
  year: number;
  /** Callback when an event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** Callback when a cell is clicked (for navigation or day view) */
  onCellClick?: (date: Date) => void;
  /** User's timezone for displaying events (e.g., "America/Los_Angeles") */
  timezone?: string;
}

/**
 * Month calendar grid component showing full month with event density
 * Displays 6-7 weeks × 7 days with event previews
 */
export default function MonthCalendarGrid({
  events,
  month,
  year,
  onEventClick,
  onCellClick,
  timezone,
}: MonthCalendarGridProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize for responsive mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate month grid (6-7 weeks × 7 days)
  const monthGrid = useMemo(() => getMonthGrid(month, year), [month, year]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    events.forEach(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      // Add event to all days it spans
      monthGrid.flat().forEach(day => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        // Check if event overlaps with this day
        if (eventStart <= dayEnd && eventEnd >= dayStart) {
          const dateKey = day.toDateString();
          if (!grouped.has(dateKey)) {
            grouped.set(dateKey, []);
          }
          grouped.get(dateKey)!.push(event);
        }
      });
    });

    // Sort events by start time within each day
    grouped.forEach(dayEvents => {
      dayEvents.sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });

    return grouped;
  }, [events, monthGrid]);

  // Get first day for weekday headers
  const weekdayNames = useMemo(() => {
    return monthGrid[0]?.map(day => getWeekdayNameShort(day)) || [];
  }, [monthGrid]);

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    }}>
      {/* Weekday Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid #E5E7EB',
        background: '#F9FAFB',
      }}>
        {weekdayNames.map((name, index) => {
          const isWeekend = index === 0 || index === 6;
          return (
            <div
              key={index}
              style={{
                padding: isMobile ? '8px 4px' : '12px 8px',
                textAlign: 'center',
                fontSize: isMobile ? '12px' : '14px',
                fontWeight: '600',
                color: isWeekend ? '#9CA3AF' : '#374151',
                borderRight: index < 6 ? '1px solid #E5E7EB' : 'none',
                background: isWeekend ? '#F3F4F6' : 'transparent',
              }}
            >
              {name}
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
      }}>
        {monthGrid.flat().map((date, index) => {
          const dateKey = date.toDateString();
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isTodayDate = isToday(date);
          const isInCurrentMonth = isCurrentMonth(date, month);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <MonthDayCell
              key={dateKey}
              date={date}
              events={dayEvents}
              isToday={isTodayDate}
              isCurrentMonth={isInCurrentMonth}
              isWeekend={isWeekend}
              onEventClick={onEventClick}
              onCellClick={onCellClick}
              timezone={timezone}
              isMobile={isMobile}
              isLastInRow={(index + 1) % 7 === 0}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Individual day cell in month view
 */
interface MonthDayCellProps {
  date: Date;
  events: CalendarEvent[];
  isToday: boolean;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  onCellClick?: (date: Date) => void;
  /** User's timezone for displaying events */
  timezone?: string;
  isMobile: boolean;
  isLastInRow: boolean;
}

const MAX_VISIBLE_EVENTS = 2;

function MonthDayCell({
  date,
  events,
  isToday,
  isCurrentMonth,
  isWeekend,
  onEventClick,
  onCellClick,
  timezone,
  isMobile,
  isLastInRow,
}: MonthDayCellProps) {
  const [showAll, setShowAll] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const visibleEvents = showAll ? events : events.slice(0, MAX_VISIBLE_EVENTS);
  const hiddenCount = events.length - MAX_VISIBLE_EVENTS;

  const handleCellClick = () => {
    if (onCellClick) {
      onCellClick(date);
    }
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAll(!showAll);
  };

  // Determine background color
  const getBackgroundColor = () => {
    if (isToday) return 'rgba(0, 102, 255, 0.05)';
    if (isHovered && onCellClick) return '#F9FAFB';
    if (isWeekend) return '#FAFAFA';
    return '#fff';
  };

  return (
    <div
      style={{
        minHeight: isMobile ? '80px' : '120px',
        borderRight: isLastInRow ? 'none' : '1px solid #E5E7EB',
        borderBottom: '1px solid #E5E7EB',
        padding: isMobile ? '4px' : '8px',
        transition: 'background 0.15s ease',
        position: 'relative',
        background: getBackgroundColor(),
        opacity: isCurrentMonth ? 1 : 0.4,
        cursor: onCellClick ? 'pointer' : 'default',
        boxShadow: isToday ? 'inset 0 0 0 2px #0066FF' : 'none',
      }}
      onClick={handleCellClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Date Number */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '4px',
      }}>
        <div
          style={{
            fontSize: isMobile ? '13px' : '14px',
            fontWeight: '600',
            ...(isToday ? {
              background: '#0066FF',
              color: '#fff',
              borderRadius: '50%',
              width: isMobile ? '24px' : '28px',
              height: isMobile ? '24px' : '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            } : {
              color: isCurrentMonth ? '#111827' : '#9CA3AF',
            }),
          }}
        >
          {date.getDate()}
        </div>

        {/* Event count badge for mobile */}
        {isMobile && events.length > 0 && (
          <div style={{
            fontSize: '11px',
            color: '#6B7280',
            background: '#E5E7EB',
            padding: '2px 6px',
            borderRadius: '9999px',
            fontWeight: '500',
          }}>
            {events.length}
          </div>
        )}
      </div>

      {/* Events */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflow: 'hidden',
      }}>
        {visibleEvents.map(event => (
          <MonthEventBar
            key={event.id}
            event={event}
            onClick={onEventClick}
            timezone={timezone}
            isMobile={isMobile}
          />
        ))}

        {/* "+X more" indicator */}
        {!showAll && hiddenCount > 0 && (
          <button
            style={{
              fontSize: '12px',
              color: '#0066FF',
              fontWeight: '500',
              width: '100%',
              textAlign: 'left',
              padding: '2px 4px',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onClick={handleMoreClick}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 102, 255, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            +{hiddenCount} more
          </button>
        )}

        {/* "Show less" button */}
        {showAll && events.length > MAX_VISIBLE_EVENTS && (
          <button
            style={{
              fontSize: '12px',
              color: '#6B7280',
              fontWeight: '500',
              width: '100%',
              textAlign: 'left',
              padding: '2px 4px',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onClick={handleMoreClick}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Event bar component for month view
 */
interface MonthEventBarProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  /** User's timezone for displaying events */
  timezone?: string;
  isMobile: boolean;
}

function MonthEventBar({ event, onClick, timezone, isMobile }: MonthEventBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(event);
    } else if (event.htmlLink) {
      const safeUrl = validateAndSanitizeUrl(event.htmlLink);
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const safeColor = getCalendarColor(event.calendarColor, event.provider as Provider);
  const isCancelled = event.status === 'cancelled';
  const isTentative = event.status === 'tentative';

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          fontSize: isMobile ? '11px' : '12px',
          padding: isMobile ? '2px 4px' : '3px 6px',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          backgroundColor: safeColor,
          borderLeft: `3px solid ${adjustColorBrightness(safeColor, -20)}`,
          borderTop: isTentative ? '1px dashed rgba(0,0,0,0.3)' : 'none',
          borderBottom: isTentative ? '1px dashed rgba(0,0,0,0.3)' : 'none',
          borderRight: isTentative ? '1px dashed rgba(0,0,0,0.3)' : 'none',
          color: getContrastColor(safeColor),
          opacity: isCancelled ? 0.6 : 1,
          textDecoration: isCancelled ? 'line-through' : 'none',
          boxShadow: isHovered ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
          transform: isHovered ? 'translateY(-1px)' : 'none',
        }}
        onClick={handleClick}
        onMouseEnter={() => {
          setShowTooltip(true);
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setShowTooltip(false);
          setIsHovered(false);
        }}
        role="button"
        tabIndex={0}
        title={sanitizeEventText(event.title, 100)}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{
            flex: 1,
            fontWeight: '500',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {event.isAllDay ? '' : `${formatTime(new Date(event.startTime), timezone)} `}
            {sanitizeEventText(event.title, 100) || '(No title)'}
          </span>
          {event.teamsEnabled && (
            <svg style={{ width: '12px', height: '12px', flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor" aria-label="Teams meeting">
              <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
            </svg>
          )}
          {event.importance === 'high' && (
            <span style={{
              color: '#EF4444',
              fontWeight: 'bold',
              flexShrink: 0,
              textShadow: '0 0 2px rgba(255,255,255,0.8)',
            }} aria-label="High importance">!</span>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && !isMobile && (
        <MonthEventTooltip event={event} timezone={timezone} />
      )}
    </div>
  );
}

/**
 * Event tooltip for month view
 */
interface MonthEventTooltipProps {
  event: CalendarEvent;
  /** User's timezone for displaying events */
  timezone?: string;
}

function MonthEventTooltip({ event, timezone }: MonthEventTooltipProps) {
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  return (
    <div style={{
      position: 'absolute',
      zIndex: 50,
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
      padding: '12px',
      minWidth: '260px',
      maxWidth: '350px',
      pointerEvents: 'none',
      left: 0,
      top: '100%',
      marginTop: '4px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Title and importance */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1, fontWeight: '600', color: '#111827', fontSize: '14px' }}>
            {event.title || '(No title)'}
          </div>
          {event.importance === 'high' && (
            <span style={{
              color: '#EF4444',
              fontSize: '11px',
              fontWeight: '600',
              padding: '2px 8px',
              background: '#FEE2E2',
              borderRadius: '9999px',
            }}>High</span>
          )}
        </div>

        {/* Time */}
        {event.isAllDay ? (
          <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: '500' }}>All day</div>
        ) : (
          <div style={{ fontSize: '13px', color: '#6B7280' }}>
            {formatTime(startTime, timezone)} - {formatTime(endTime, timezone)}
          </div>
        )}

        {/* Teams meeting button */}
        {event.teamsEnabled && event.teamsMeetingUrl && (
          <a
            href={event.teamsMeetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: '#0066FF',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              textDecoration: 'none',
              pointerEvents: 'auto',
              transition: 'background 0.15s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
            </svg>
            Join Teams Meeting
          </a>
        )}

        {/* Location */}
        {event.location && (
          <div style={{ fontSize: '13px', color: '#6B7280', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <svg style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '1px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span style={{ wordBreak: 'break-word' }}>{event.location}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div style={{
            fontSize: '13px',
            color: '#6B7280',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}>{event.description}</div>
        )}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <div style={{ fontSize: '13px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg style={{ width: '14px', height: '14px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
          </div>
        )}

        {/* Outlook categories */}
        {event.outlookCategories && event.outlookCategories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {event.outlookCategories.map((category, index) => (
              <span
                key={index}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: '500',
                  background: '#F3E8FF',
                  color: '#7C3AED',
                }}
              >
                {category}
              </span>
            ))}
          </div>
        )}

        {/* Calendar info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #E5E7EB',
        }}>
          {event.calendarColor && (
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: event.calendarColor,
              }}
            />
          )}
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{event.calendarName}</span>
          {event.provider === 'MICROSOFT' && (
            <span style={{ fontSize: '11px', color: '#EA580C', fontWeight: '500' }}>Outlook</span>
          )}
          {event.provider === 'GOOGLE' && (
            <span style={{ fontSize: '11px', color: '#4285F4', fontWeight: '500' }}>Google</span>
          )}
          {event.provider === 'ICS' && (
            <span style={{ fontSize: '11px', color: '#9333EA', fontWeight: '500' }}>ICS</span>
          )}
        </div>

        {/* Delegate email */}
        {event.delegateEmail && (
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>From: {event.delegateEmail}</div>
        )}

        {/* Status */}
        {event.status && event.status !== 'confirmed' && (
          <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'capitalize' }}>
            Status: {event.status}
          </div>
        )}
      </div>
    </div>
  );
}
