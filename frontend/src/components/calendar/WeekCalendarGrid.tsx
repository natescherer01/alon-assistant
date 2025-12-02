import { useMemo, useState, useEffect } from 'react';
import type { CalendarEvent } from '../../api/calendar/calendar';
import {
  getTimeSlots,
  getWeekDays,
  groupEventsByDay,
  separateAllDayEvents,
  getCurrentTimeSlot,
  isToday,
  getWeekdayName,
  formatTime,
  validateAndSanitizeUrl,
  sanitizeEventText,
  type GridEvent,
  type TimeSlot,
} from '../../utils/calendar/calendarGrid';
import {
  getCalendarColor,
  adjustColorBrightness,
  getContrastColor,
  type Provider,
} from '../../utils/calendar/calendarColors';
import { useAuth } from '../../hooks/calendar/useAuth';

/** Countdown info from parent component */
interface CountdownInfo {
  type: 'current' | 'upcoming';
  event: CalendarEvent;
  secondsRemaining?: number;
  secondsUntil?: number;
}

interface WeekCalendarGridProps {
  /** Array of calendar events to display */
  events: CalendarEvent[];
  /** Start date for the week view (will be adjusted to Sunday) */
  weekStart: Date;
  /** Callback when an event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** Countdown information for next/current event */
  countdownInfo?: CountdownInfo | null;
  /** User's timezone for displaying events (e.g., "America/Los_Angeles") */
  timezone?: string;
}

/**
 * Week calendar grid component with 15-minute time slots
 * Displays 7 columns (Sun-Sat) with full day view (12 AM - 11 PM)
 */
export default function WeekCalendarGrid({
  events,
  weekStart,
  onEventClick,
  countdownInfo,
  timezone,
}: WeekCalendarGridProps) {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileDay, setMobileDay] = useState(new Date());

  // Handle window resize for responsive mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate week days (Sun-Sat)
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Use single day for mobile
  const displayDays = useMemo(
    () => (isMobile ? [mobileDay] : weekDays),
    [isMobile, mobileDay, weekDays]
  );

  // Generate time slots (96 slots for 24 hours)
  const timeSlots = useMemo(() => getTimeSlots(), []);

  // Group events by day with grid positions (timezone-aware)
  const eventsByDay = useMemo(
    () => groupEventsByDay(events, displayDays, timezone),
    [events, displayDays, timezone]
  );

  // Separate all-day events from timed events
  const allDayEventsByDay = useMemo(() => {
    const result = new Map<string, CalendarEvent[]>();

    displayDays.forEach(day => {
      const dayKey = day.toDateString();
      const dayEvents = eventsByDay.get(dayKey) || [];
      const { allDayEvents } = separateAllDayEvents(dayEvents);
      result.set(dayKey, allDayEvents);
    });

    return result;
  }, [eventsByDay, displayDays]);

  // Get current time slot for time indicator (update every minute)
  const [currentTimeSlot, setCurrentTimeSlot] = useState(getCurrentTimeSlot());

  useEffect(() => {
    // Update current time slot every minute
    const interval = setInterval(() => {
      setCurrentTimeSlot(getCurrentTimeSlot());
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Calculate sleep hour blocks from user settings
  const sleepBlocks = useMemo(() => {
    if (!user?.sleepStartTime || !user?.sleepEndTime) {
      return [];
    }

    const parseToSlot = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return h * 4 + Math.floor(m / 15); // 4 slots per hour (15-min increments)
    };

    const startSlot = parseToSlot(user.sleepStartTime);
    const endSlot = parseToSlot(user.sleepEndTime);

    // Handle sleep periods that cross midnight
    if (startSlot > endSlot) {
      // Sleep crosses midnight (e.g., 22:00 to 08:00)
      // Split into two blocks: [start to midnight] and [midnight to end]
      return [
        { start: startSlot, end: 96 },  // Late night (bedtime to midnight)
        { start: 0, end: endSlot },     // Early morning (midnight to wake up)
      ];
    } else {
      // Sleep within same day (e.g., 01:00 to 08:00)
      return [{ start: startSlot, end: endSlot }];
    }
  }, [user?.sleepStartTime, user?.sleepEndTime]);

  // Handle mobile day navigation
  const handleMobilePrevDay = () => {
    const prevDay = new Date(mobileDay);
    prevDay.setDate(mobileDay.getDate() - 1);
    setMobileDay(prevDay);
  };

  const handleMobileNextDay = () => {
    const nextDay = new Date(mobileDay);
    nextDay.setDate(mobileDay.getDate() + 1);
    setMobileDay(nextDay);
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    }}>
      {/* Mobile Navigation */}
      {isMobile && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #E5E7EB',
          background: '#F9FAFB',
        }}>
          <button
            onClick={handleMobilePrevDay}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            aria-label="Previous day"
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>
              {getWeekdayName(mobileDay)}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {mobileDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <button
            onClick={handleMobileNextDay}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            aria-label="Next day"
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Calendar Grid Container */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        {/* Header Row - Day Names and Dates */}
        {!isMobile && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '80px repeat(7, 1fr)',
            borderBottom: '1px solid #E5E7EB',
            background: '#F9FAFB',
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}>
            <div style={{ padding: '8px', borderRight: '1px solid #E5E7EB' }} />
            {displayDays.map(day => {
              const today = isToday(day);
              return (
                <div
                  key={day.toDateString()}
                  style={{
                    padding: '8px',
                    textAlign: 'center',
                    borderRight: '1px solid #E5E7EB',
                    background: today ? 'rgba(0, 102, 255, 0.05)' : 'transparent',
                  }}
                >
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: today ? '#0066FF' : '#666',
                  }}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: today ? '#0066FF' : '#000',
                  }}>
                    {day.getDate()}
                  </div>
                  {today && (
                    <div style={{ fontSize: '12px', color: '#0066FF', fontWeight: '500' }}>Today</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* All-Day Events Section */}
        {Array.from(allDayEventsByDay.values()).some(events => events.length > 0) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '80px repeat(7, 1fr)',
            borderBottom: '2px solid #D1D5DB',
            background: '#F9FAFB',
            position: 'sticky',
            top: isMobile ? 0 : '73px',
            zIndex: 10,
          }}>
            {!isMobile && (
              <div style={{
                padding: '8px',
                borderRight: '1px solid #E5E7EB',
                fontSize: '12px',
                color: '#666',
                fontWeight: '500',
              }}>
                All Day
              </div>
            )}
            {displayDays.map(day => {
              const dayKey = day.toDateString();
              const allDayEvents = allDayEventsByDay.get(dayKey) || [];
              const today = isToday(day);

              return (
                <div
                  key={dayKey}
                  style={{
                    minHeight: '60px',
                    padding: '4px',
                    borderRight: '1px solid #E5E7EB',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: today ? 'rgba(0, 102, 255, 0.05)' : 'transparent',
                  }}
                >
                  {allDayEvents.length > 0 ? (
                    allDayEvents.map(event => (
                      <AllDayEventBlock
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                      />
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', padding: '8px' }}>
                      No all-day events
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Time Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '60px 1fr' : '80px repeat(7, 1fr)',
          position: 'relative',
        }}>
          {/* Time Labels Column */}
          <div style={{ borderRight: '1px solid #E5E7EB' }}>
            {timeSlots.map((slot, index) => {
              // Only show labels on the hour
              const showLabel = slot.minute === 0;
              // Show border on hour (every 4 slots) and half-hour (every 2 slots), skip 15-min lines
              const isHour = index % 4 === 0;
              const isHalfHour = index % 2 === 0 && !isHour;

              return (
                <div
                  key={slot.index}
                  style={{
                    height: '12px',
                    textAlign: 'right',
                    paddingRight: '8px',
                    borderTop: isHour ? '1px solid #E5E7EB' : isHalfHour ? '1px solid #F3F4F6' : 'none',
                  }}
                >
                  {showLabel && (
                    <span style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      marginTop: '-8px',
                      display: 'inline-block',
                    }}>
                      {slot.labelShort}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Day Columns */}
          {displayDays.map(day => {
            const dayKey = day.toDateString();
            const dayEvents = eventsByDay.get(dayKey) || [];
            const { timedEvents } = separateAllDayEvents(dayEvents);
            const today = isToday(day);

            return (
              <DayColumn
                key={dayKey}
                day={day}
                events={timedEvents}
                timeSlots={timeSlots}
                isToday={today}
                currentTimeSlot={currentTimeSlot}
                onEventClick={onEventClick}
                countdownInfo={today ? countdownInfo : undefined}
                timezone={timezone}
                sleepBlocks={sleepBlocks}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Single day column component
 */
interface DayColumnProps {
  day: Date;
  events: GridEvent[];
  timeSlots: TimeSlot[];
  isToday: boolean;
  currentTimeSlot: number;
  onEventClick?: (event: CalendarEvent) => void;
  countdownInfo?: CountdownInfo | null;
  timezone?: string;
  sleepBlocks: Array<{ start: number; end: number }>;
}

function DayColumn({
  // day is passed but unused - kept in props interface for API consistency
  events,
  timeSlots,
  isToday,
  currentTimeSlot,
  onEventClick,
  countdownInfo,
  timezone,
  sleepBlocks,
}: DayColumnProps) {
  // Find the next event's grid position for the connector
  const getNextEventSlot = (): { slot: number; color: string } | null => {
    if (!countdownInfo || countdownInfo.type !== 'upcoming') return null;

    const nextEventStart = new Date(countdownInfo.event.startTime);
    const nextEventHour = nextEventStart.getHours();
    const nextEventMinute = nextEventStart.getMinutes();
    const nextEventSlot = (nextEventHour * 4) + Math.floor(nextEventMinute / 15);

    // Only show connector if the event is visible in today's column
    if (nextEventSlot <= currentTimeSlot || nextEventSlot > 95) return null;

    return {
      slot: nextEventSlot,
      color: countdownInfo.event.calendarColor || '#3B82F6',
    };
  };

  const nextEventInfo = getNextEventSlot();

  // Format countdown for display
  const formatCountdown = (): string => {
    if (!countdownInfo) return '';
    const seconds = countdownInfo.type === 'current'
      ? countdownInfo.secondsRemaining || 0
      : countdownInfo.secondsUntil || 0;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div style={{
      position: 'relative',
      borderRight: '1px solid #E5E7EB',
      background: isToday ? 'rgba(0, 102, 255, 0.03)' : 'transparent',
    }}>
      {/* Time slot grid lines - only show hour and half-hour lines */}
      {timeSlots.map((slot, index) => {
        const isHour = index % 4 === 0;
        const isHalfHour = index % 2 === 0 && !isHour;
        return (
          <div
            key={slot.index}
            style={{
              height: '12px',
              borderTop: isHour ? '1px solid #E5E7EB' : isHalfHour ? '1px solid #F3F4F6' : 'none',
            }}
          />
        );
      })}

      {/* Sleep hour overlay blocks - rendered first so events appear on top */}
      {sleepBlocks.map((block, i) => (
        <div
          key={`sleep-${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            background: 'rgba(100, 116, 139, 0.1)',
            pointerEvents: 'none',
            zIndex: 0,
            top: `${(block.start / 96) * 100}%`,
            height: `${((block.end - block.start) / 96) * 100}%`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Current time indicator */}
      {isToday && (
        <CurrentTimeIndicator slot={currentTimeSlot} />
      )}

      {/* Countdown connector to next event */}
      {isToday && nextEventInfo && (
        <CountdownConnector
          currentSlot={currentTimeSlot}
          nextEventSlot={nextEventInfo.slot}
          eventColor={nextEventInfo.color}
          countdownText={formatCountdown()}
        />
      )}

      {/* Event blocks */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}>
        {events.map(event => (
          <EventBlock
            key={event.id}
            event={event}
            onClick={onEventClick}
            timezone={timezone}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Current time indicator (red line)
 */
interface CurrentTimeIndicatorProps {
  slot: number;
}

function CurrentTimeIndicator({ slot }: CurrentTimeIndicatorProps) {
  const topPosition = (slot / 96) * 100;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10,
        pointerEvents: 'none',
        top: `${topPosition}%`,
      }}
    >
      <div style={{
        height: '2px',
        background: '#EF4444',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          left: '-4px',
          top: '-3px',
          width: '8px',
          height: '8px',
          background: '#EF4444',
          borderRadius: '50%',
        }} />
      </div>
    </div>
  );
}

/**
 * Countdown connector - clean visual indicator from current time to next event
 */
interface CountdownConnectorProps {
  currentSlot: number;
  nextEventSlot: number;
  eventColor: string;
  countdownText: string;
}

function CountdownConnector({
  currentSlot,
  nextEventSlot,
  eventColor,
  countdownText,
}: CountdownConnectorProps) {
  const startPercent = (currentSlot / 96) * 100;
  const endPercent = (nextEventSlot / 96) * 100;
  const heightPercent = endPercent - startPercent;

  // Don't render if too small
  if (heightPercent < 1) return null;

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 5,
        pointerEvents: 'none',
        top: `${startPercent}%`,
        height: `${heightPercent}%`,
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      {/* Simple dashed connector line */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          width: '2px',
          height: '100%',
          transform: 'translateX(-50%)',
          opacity: 0.6,
          background: `repeating-linear-gradient(180deg, ${eventColor} 0px, ${eventColor} 6px, transparent 6px, transparent 12px)`,
        }}
      />

      {/* Small arrow pointing to next event */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: '-4px',
          color: eventColor,
        }}
      >
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="currentColor"
          style={{ opacity: 0.7 }}
        >
          <path d="M5 6L0 0h10L5 6z" />
        </svg>
      </div>

      {/* Minimal countdown badge */}
      <div
        style={{
          position: 'absolute',
          left: '100%',
          marginLeft: '6px',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: '500',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          top: '50%',
          transform: 'translateY(-50%)',
          backgroundColor: eventColor,
          color: '#ffffff',
          opacity: 0.85,
        }}
      >
        {countdownText}
      </div>
    </div>
  );
}

/**
 * Event block component for timed events
 */
interface EventBlockProps {
  event: GridEvent;
  onClick?: (event: CalendarEvent) => void;
  timezone?: string;
}

function EventBlock({ event, onClick, timezone }: EventBlockProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(event);
    } else if (event.htmlLink) {
      const safeUrl = validateAndSanitizeUrl(event.htmlLink);
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      } else {
        console.error('[Security] Invalid or unsafe URL blocked');
      }
    }
  };

  // Calculate position
  const top = (event.gridPosition.startSlot / 96) * 100;
  const height = (event.gridPosition.spanSlots / 96) * 100;
  const width = event.gridPosition.width;
  const left = event.gridPosition.offset;

  // Determine if event is too small to show details
  const isSmall = event.gridPosition.spanSlots < 2;

  // Get border style based on status
  const getBorderStyle = (): React.CSSProperties => {
    if (event.status === 'tentative') return { border: '2px dashed' };
    if (event.status === 'cancelled') return { border: '2px solid' };
    return { borderLeft: '4px solid' };
  };

  // Get calendar color (uses calendar color if available, falls back to provider color)
  const safeColor = getCalendarColor(event.calendarColor, event.provider as Provider);

  return (
    <>
      <div
        style={{
          position: 'absolute',
          padding: '2px 4px',
          fontSize: '12px',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          pointerEvents: 'auto',
          top: `${top}%`,
          height: `${height}%`,
          width,
          left,
          backgroundColor: safeColor,
          borderColor: adjustColorBrightness(safeColor, -20),
          color: getContrastColor(safeColor),
          minHeight: '20px',
          opacity: event.status === 'cancelled' ? 0.6 : 1,
          ...getBorderStyle(),
        }}
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="button"
        tabIndex={0}
        aria-label={`${event.title} at ${formatTime(new Date(event.startTime), timezone)}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            flex: 1,
            fontWeight: '500',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: event.status === 'cancelled' ? 'line-through' : 'none',
          }}>
            {sanitizeEventText(event.title, 200) || '(No title)'}
          </div>
          {event.teamsEnabled && (
            <svg style={{ width: '12px', height: '12px', flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor" aria-label="Teams meeting">
              <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
            </svg>
          )}
          {event.importance === 'high' && (
            <span style={{ color: '#EF4444', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }} aria-label="High importance">!</span>
          )}
        </div>
        {!isSmall && (
          <>
            <div style={{ fontSize: '11px', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatTime(new Date(event.startTime), timezone)}
            </div>
            {event.location && (
              <div style={{ fontSize: '11px', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                {sanitizeEventText(event.location, 100)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <EventTooltip event={event} timezone={timezone} />
      )}
    </>
  );
}

/**
 * All-day event block component
 */
interface AllDayEventBlockProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
}

function AllDayEventBlock({ event, onClick }: AllDayEventBlockProps) {
  const handleClick = () => {
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

  return (
    <div
      style={{
        padding: '4px 8px',
        fontSize: '12px',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        backgroundColor: safeColor,
        color: getContrastColor(safeColor),
        opacity: event.status === 'cancelled' ? 0.6 : 1,
        textDecoration: event.status === 'cancelled' ? 'line-through' : 'none',
        border: event.status === 'tentative' ? '2px dashed' : 'none',
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ flex: 1, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sanitizeEventText(event.title, 200) || '(No title)'}
        </div>
        {event.teamsEnabled && (
          <svg style={{ width: '12px', height: '12px', flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor" aria-label="Teams meeting">
            <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
          </svg>
        )}
        {event.importance === 'high' && (
          <span style={{ color: '#EF4444', fontWeight: 'bold', flexShrink: 0 }} aria-label="High importance">!</span>
        )}
      </div>
    </div>
  );
}

/**
 * Event tooltip component
 */
interface EventTooltipProps {
  event: CalendarEvent;
  timezone?: string;
}

function EventTooltip({ event, timezone }: EventTooltipProps) {
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  return (
    <div style={{
      position: 'absolute',
      zIndex: 50,
      background: '#fff',
      border: '2px solid #D1D5DB',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
      padding: '12px',
      minWidth: '250px',
      maxWidth: '350px',
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1, fontWeight: '600', color: '#000' }}>{event.title || '(No title)'}</div>
          {event.importance === 'high' && (
            <span style={{
              color: '#EF4444',
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '2px 6px',
              background: '#FEE2E2',
              borderRadius: '4px',
            }}>High</span>
          )}
        </div>

        <div style={{ fontSize: '14px', color: '#666' }}>
          {formatTime(startTime, timezone)} - {formatTime(endTime, timezone)}
        </div>

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
              fontSize: '14px',
              fontWeight: '500',
              textDecoration: 'none',
              pointerEvents: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
            </svg>
            Join Teams Meeting
          </a>
        )}

        {event.location && (
          <div style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
            <svg style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span>{event.location}</span>
          </div>
        )}

        {event.description && (
          <div style={{
            fontSize: '14px',
            color: '#666',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}>{event.description}</div>
        )}

        {event.attendees && event.attendees.length > 0 && (
          <div style={{ fontSize: '14px', color: '#666' }}>
            {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
          </div>
        )}

        {event.outlookCategories && event.outlookCategories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {event.outlookCategories.map((category, index) => (
              <span
                key={index}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
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
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: event.calendarColor,
              }}
            />
          )}
          <span style={{ fontSize: '12px', color: '#666' }}>{event.calendarName}</span>
          {event.provider === 'MICROSOFT' && (
            <span style={{ fontSize: '12px', color: '#EA580C', fontWeight: '500' }}>Outlook</span>
          )}
        </div>

        {event.delegateEmail && (
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>From: {event.delegateEmail}</div>
        )}

        {event.status && event.status !== 'confirmed' && (
          <div style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'capitalize' }}>Status: {event.status}</div>
        )}
      </div>
    </div>
  );
}
