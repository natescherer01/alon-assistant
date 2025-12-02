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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Mobile Navigation */}
      {isMobile && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <button
            onClick={handleMobilePrevDay}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Previous day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-sm font-medium text-gray-900">
              {getWeekdayName(mobileDay)}
            </div>
            <div className="text-xs text-gray-600">
              {mobileDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <button
            onClick={handleMobileNextDay}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Next day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Calendar Grid Container */}
      <div className="overflow-auto max-h-[calc(100vh-300px)]">
        {/* Header Row - Day Names and Dates */}
        {!isMobile && (
          <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
            <div className="p-2 border-r border-gray-200" />
            {displayDays.map(day => {
              const today = isToday(day);
              return (
                <div
                  key={day.toDateString()}
                  className={`p-2 text-center border-r border-gray-200 ${
                    today ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`text-xs font-medium ${today ? 'text-blue-600' : 'text-gray-600'}`}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div
                    className={`text-lg font-semibold ${
                      today ? 'text-blue-600' : 'text-gray-900'
                    }`}
                  >
                    {day.getDate()}
                  </div>
                  {today && (
                    <div className="text-xs text-blue-600 font-medium">Today</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* All-Day Events Section */}
        {Array.from(allDayEventsByDay.values()).some(events => events.length > 0) && (
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-[80px_repeat(7,1fr)]'} border-b-2 border-gray-300 bg-gray-50 sticky ${isMobile ? 'top-0' : 'top-[73px]'} z-10`}>
            {!isMobile && (
              <div className="p-2 border-r border-gray-200 text-xs text-gray-600 font-medium">
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
                  className={`min-h-[60px] p-1 border-r border-gray-200 space-y-1 ${
                    today ? 'bg-blue-50' : ''
                  }`}
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
                    <div className="text-xs text-gray-400 text-center py-2">No all-day events</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Time Grid */}
        <div className={`grid ${isMobile ? 'grid-cols-[60px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'} relative`}>
          {/* Time Labels Column */}
          <div className="border-r border-gray-200">
            {timeSlots.map((slot, index) => {
              // Only show labels on the hour
              const showLabel = slot.minute === 0;
              // Show border on hour (every 4 slots) and half-hour (every 2 slots), skip 15-min lines
              const isHour = index % 4 === 0;
              const isHalfHour = index % 2 === 0 && !isHour;

              return (
                <div
                  key={slot.index}
                  className={`h-3 text-right pr-2 ${
                    isHour ? 'border-t border-gray-200' : isHalfHour ? 'border-t border-gray-100' : ''
                  }`}
                >
                  {showLabel && (
                    <span className="text-xs text-gray-500 -mt-2 inline-block">
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
    <div className={`relative border-r border-gray-200 ${isToday ? 'bg-blue-50/30' : ''}`}>
      {/* Time slot grid lines - only show hour and half-hour lines */}
      {timeSlots.map((slot, index) => {
        const isHour = index % 4 === 0;
        const isHalfHour = index % 2 === 0 && !isHour;
        return (
          <div
            key={slot.index}
            className={`h-3 ${
              isHour ? 'border-t border-gray-200' : isHalfHour ? 'border-t border-gray-100' : ''
            }`}
          />
        );
      })}

      {/* Sleep hour overlay blocks - rendered first so events appear on top */}
      {sleepBlocks.map((block, i) => (
        <div
          key={`sleep-${i}`}
          className="absolute inset-x-0 bg-slate-100/40 pointer-events-none z-0"
          style={{
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
      <div className="absolute inset-0 pointer-events-none overflow-visible">
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
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top: `${topPosition}%` }}
    >
      <div className="h-0.5 bg-red-500 relative">
        <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
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
      className="absolute z-[5] pointer-events-none"
      style={{
        top: `${startPercent}%`,
        height: `${heightPercent}%`,
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      {/* Simple dashed connector line */}
      <div
        className="absolute left-1/2 w-0.5 h-full -translate-x-1/2 opacity-60"
        style={{
          background: `repeating-linear-gradient(180deg, ${eventColor} 0px, ${eventColor} 6px, transparent 6px, transparent 12px)`,
        }}
      />

      {/* Small arrow pointing to next event */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -bottom-1"
        style={{ color: eventColor }}
      >
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="currentColor"
          className="opacity-70"
        >
          <path d="M5 6L0 0h10L5 6z" />
        </svg>
      </div>

      {/* Minimal countdown badge */}
      <div
        className="absolute left-full ml-1.5 px-2 py-0.5 rounded-full text-xs font-medium tabular-nums whitespace-nowrap"
        style={{
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
  const getBorderStyle = () => {
    if (event.status === 'tentative') return 'border-2 border-dashed';
    if (event.status === 'cancelled') return 'border-2';
    return 'border-l-4';
  };

  // Get calendar color (uses calendar color if available, falls back to provider color)
  const safeColor = getCalendarColor(event.calendarColor, event.provider as Provider);

  return (
    <>
      <div
        className={`absolute px-1 py-0.5 text-xs rounded-md cursor-pointer transition-all hover:shadow-lg hover:z-20 pointer-events-auto ${getBorderStyle()} ${
          event.status === 'cancelled' ? 'opacity-60' : ''
        }`}
        style={{
          top: `${top}%`,
          height: `${height}%`,
          width,
          left,
          backgroundColor: safeColor,
          borderColor: adjustColorBrightness(safeColor, -20),
          color: getContrastColor(safeColor),
          minHeight: '20px',
        }}
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="button"
        tabIndex={0}
        aria-label={`${event.title} at ${formatTime(new Date(event.startTime), timezone)}`}
      >
        <div className="flex items-center gap-1">
          <div className={`flex-1 font-medium truncate ${event.status === 'cancelled' ? 'line-through' : ''}`}>
            {sanitizeEventText(event.title, 200) || '(No title)'}
          </div>
          {event.teamsEnabled && (
            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-label="Teams meeting">
              <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
            </svg>
          )}
          {event.importance === 'high' && (
            <span className="text-red-500 text-xs font-bold flex-shrink-0" aria-label="High importance">!</span>
          )}
        </div>
        {!isSmall && (
          <>
            <div className="text-xs opacity-90 truncate">
              {formatTime(new Date(event.startTime), timezone)}
            </div>
            {event.location && (
              <div className="text-xs opacity-80 truncate mt-0.5">
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
      className={`px-2 py-1 text-xs rounded cursor-pointer hover:shadow-md transition-all ${
        event.status === 'cancelled' ? 'opacity-60 line-through' : ''
      } ${
        event.status === 'tentative' ? 'border-2 border-dashed' : ''
      }`}
      style={{
        backgroundColor: safeColor,
        color: getContrastColor(safeColor),
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-1">
        <div className="flex-1 font-medium truncate">{sanitizeEventText(event.title, 200) || '(No title)'}</div>
        {event.teamsEnabled && (
          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-label="Teams meeting">
            <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
          </svg>
        )}
        {event.importance === 'high' && (
          <span className="text-red-500 font-bold flex-shrink-0" aria-label="High importance">!</span>
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
    <div className="absolute z-50 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-3 min-w-[250px] max-w-[350px] pointer-events-none">
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 font-semibold text-gray-900">{event.title || '(No title)'}</div>
          {event.importance === 'high' && (
            <span className="text-red-500 text-xs font-bold px-1.5 py-0.5 bg-red-50 rounded">High</span>
          )}
        </div>

        <div className="text-sm text-gray-600">
          {formatTime(startTime, timezone)} - {formatTime(endTime, timezone)}
        </div>

        {event.teamsEnabled && event.teamsMeetingUrl && (
          <a
            href={event.teamsMeetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
            </svg>
            Join Teams Meeting
          </a>
        )}

        {event.location && (
          <div className="text-sm text-gray-600 flex items-start gap-1">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span>{event.location}</span>
          </div>
        )}

        {event.description && (
          <div className="text-sm text-gray-600 line-clamp-3">{event.description}</div>
        )}

        {event.attendees && event.attendees.length > 0 && (
          <div className="text-sm text-gray-600">
            {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
          </div>
        )}

        {event.outlookCategories && event.outlookCategories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.outlookCategories.map((category, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
              >
                {category}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
          {event.calendarColor && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: event.calendarColor }}
            />
          )}
          <span className="text-xs text-gray-600">{event.calendarName}</span>
          {event.provider === 'MICROSOFT' && (
            <span className="text-xs text-orange-600 font-medium">Outlook</span>
          )}
        </div>

        {event.delegateEmail && (
          <div className="text-xs text-gray-500">From: {event.delegateEmail}</div>
        )}

        {event.status && event.status !== 'confirmed' && (
          <div className="text-xs text-gray-500 capitalize">Status: {event.status}</div>
        )}
      </div>
    </div>
  );
}

