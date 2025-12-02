import { useEffect, useMemo, useCallback } from 'react';
import type { CalendarEvent } from '../api/calendar';
import { formatTime } from '../utils/calendarGrid';
import { getCalendarColor, type Provider } from '../utils/calendarColors';
import { useAuth } from '../hooks/useAuth';

interface TodaysPlanPanelProps {
  /** All events - component filters to today's remaining events */
  events: CalendarEvent[];
  /** Whether the panel is expanded */
  isExpanded: boolean;
  /** Toggle panel expand/collapse */
  onToggle: () => void;
  /** User's timezone for displaying times */
  timezone?: string;
}

interface TimeBlock {
  type: 'event' | 'free';
  startTime: Date;
  endTime: Date;
  event?: CalendarEvent;
  isCurrent?: boolean;
  isNext?: boolean;
}

/**
 * Parse time string in "HH:MM" format to hours and minutes
 */
const parseTime = (time: string): { hours: number; minutes: number } => {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
};

/**
 * Today's Plan slide-out panel
 * Shows remaining events for today with free time gaps highlighted
 */
export default function TodaysPlanPanel({
  events,
  isExpanded,
  onToggle,
  timezone,
}: TodaysPlanPanelProps) {
  // Get user's sleep hours from auth
  const { user } = useAuth();

  // Handle escape key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        onToggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, onToggle]);

  // Filter and process today's events
  const { timeBlocks, remainingEventCount, totalFreeMinutes } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Parse user's sleep hours
    const sleepStart = user?.sleepStartTime ? parseTime(user.sleepStartTime) : null;
    const sleepEnd = user?.sleepEndTime ? parseTime(user.sleepEndTime) : null;

    // Calculate active day boundaries (waking hours)
    // Morning boundary: start counting from wake-up time
    let dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    if (sleepEnd) {
      dayStart.setHours(sleepEnd.hours, sleepEnd.minutes, 0, 0);
      // If we're currently before wake-up time, we're still in yesterday's active period
      if (now < dayStart) {
        dayStart.setDate(dayStart.getDate() - 1);
        dayStart.setHours(sleepEnd.hours, sleepEnd.minutes, 0, 0);
      }
    }

    // Evening boundary: stop counting at sleep time
    let dayEnd = new Date(now);
    if (sleepStart && sleepEnd) {
      dayEnd.setHours(sleepStart.hours, sleepStart.minutes, 0, 0);

      // Determine if sleep crosses midnight by comparing start and end times
      // Sleep crosses midnight if start time > end time (e.g., 23:00 > 07:00, or 01:00 > 08:00 is false)
      const sleepCrossesMidnight = sleepStart.hours < sleepEnd.hours ||
        (sleepStart.hours === sleepEnd.hours && sleepStart.minutes < sleepEnd.minutes);

      if (sleepCrossesMidnight) {
        // Sleep is within same day (e.g., 01:00 to 08:00 means sleep is early morning)
        // This is the case where user sleeps in early morning hours
        // If we're currently before the sleep start time, day end is today
        // If we're past midnight but before sleep start, day end is today's early morning
        if (now.getHours() >= sleepEnd.hours) {
          // We're awake, past wake-up time. Day ends at next sleep start (tomorrow early AM)
          dayEnd.setDate(dayEnd.getDate() + 1);
        }
        // else: We're in the early morning hours before sleep - day end is today
      } else {
        // Sleep crosses midnight (e.g., 22:00 to 06:00, or 23:00 to 08:00)
        // Day ends at sleep start time today (if not passed) or extends to next day
        if (now.getHours() < sleepStart.hours) {
          // Haven't hit bedtime yet today, day ends at tonight's sleep start
        } else if (now.getHours() >= sleepStart.hours) {
          // Past bedtime - shouldn't normally happen as user would be asleep
          // Extend to tomorrow
          dayEnd.setDate(dayEnd.getDate() + 1);
        }
      }

      // Safety: if calculated dayEnd is still in the past, extend to next occurrence
      if (dayEnd <= now) {
        dayEnd.setDate(dayEnd.getDate() + 1);
      }
    } else {
      // No sleep time set, use end of day
      dayEnd.setHours(23, 59, 59, 999);
    }

    // Filter to today's timed events (not all-day) that haven't ended yet
    const todaysEvents = events
      .filter(event => {
        if (event.isAllDay) return false;
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
        // Event must be today and not completely in the past
        return eventStart <= todayEnd && eventEnd >= todayStart && eventEnd > now;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Find current and next events
    let current: CalendarEvent | null = null;
    let next: CalendarEvent | null = null;

    for (const event of todaysEvents) {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      if (eventStart <= now && eventEnd > now) {
        current = event;
      } else if (eventStart > now && !next) {
        next = event;
      }
    }

    // Build time blocks with free time gaps
    const blocks: TimeBlock[] = [];
    let lastEndTime = now;

    // Effective end for free time calculation
    // Use sleep start time, or end of last event, or end of day
    let effectiveEnd = dayEnd;
    if (todaysEvents.length > 0) {
      const lastEventEnd = new Date(todaysEvents[todaysEvents.length - 1].endTime);
      // Show free time up to the later of: last event or day end
      effectiveEnd = new Date(Math.max(dayEnd.getTime(), lastEventEnd.getTime()));
    }

    for (const event of todaysEvents) {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      // Adjust for events that started in the past
      const displayStart = eventStart < now ? now : eventStart;

      // Add free time block if there's a gap
      if (displayStart > lastEndTime) {
        const gapMinutes = Math.round((displayStart.getTime() - lastEndTime.getTime()) / 60000);
        if (gapMinutes >= 5) { // Only show gaps of 5+ minutes
          blocks.push({
            type: 'free',
            startTime: lastEndTime,
            endTime: displayStart,
          });
        }
      }

      // Add event block
      blocks.push({
        type: 'event',
        startTime: eventStart,
        endTime: eventEnd,
        event,
        isCurrent: current?.id === event.id,
        isNext: next?.id === event.id,
      });

      lastEndTime = eventEnd > lastEndTime ? eventEnd : lastEndTime;
    }

    // Add trailing free time if there's time left in the day
    if (lastEndTime < effectiveEnd) {
      blocks.push({
        type: 'free',
        startTime: lastEndTime,
        endTime: effectiveEnd,
      });
    }

    // Calculate total free minutes
    const freeMinutes = blocks
      .filter(b => b.type === 'free')
      .reduce((acc, b) => acc + Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000), 0);

    return {
      timeBlocks: blocks,
      remainingEventCount: todaysEvents.length,
      totalFreeMinutes: freeMinutes,
    };
  }, [events, user?.sleepStartTime, user?.sleepEndTime]);

  // Format duration for display
  const formatDuration = useCallback((minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  }, []);

  // Format free time range
  const formatTimeRange = useCallback((start: Date, end: Date): string => {
    return `${formatTime(start, timezone)} - ${formatTime(end, timezone)}`;
  }, [timezone]);

  return (
    <>
      {/* Mobile Overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 top-16 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        className={`
          fixed top-16 right-0 h-[calc(100vh-4rem)] bg-white border-l border-gray-200
          transition-all duration-300 ease-in-out z-40
          ${isExpanded ? 'w-80 shadow-xl lg:shadow-lg' : 'w-12'}
        `}
        aria-label="Today's plan panel"
      >
        <div className="h-full flex flex-col">
          {/* Collapsed State - Vertical Tab */}
          {!isExpanded && (
            <button
              onClick={onToggle}
              className="h-full w-full flex flex-col items-center justify-center gap-3 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-label="Expand today's plan"
              title="Today's Plan"
            >
              {/* Event count badge */}
              {remainingEventCount > 0 && (
                <div className="bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {remainingEventCount}
                </div>
              )}

              {/* Rotated "Today" text */}
              <div
                className="text-xs font-semibold text-gray-600 tracking-wider"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                TODAY
              </div>

              {/* Expand chevron */}
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Expanded State */}
          {isExpanded && (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Today's Plan</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {remainingEventCount} event{remainingEventCount !== 1 ? 's' : ''} remaining
                  </p>
                </div>

                {/* Collapse Button */}
                <button
                  onClick={onToggle}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Collapse panel"
                  title="Collapse panel"
                >
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {timeBlocks.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900">All clear!</p>
                    <p className="text-xs text-gray-500 mt-1">No more events scheduled for today</p>
                  </div>
                ) : (
                  timeBlocks.map((block, index) => (
                    <TimeBlockCard
                      key={`${block.type}-${index}-${block.startTime.getTime()}`}
                      block={block}
                      timezone={timezone}
                      formatTimeRange={formatTimeRange}
                      formatDuration={formatDuration}
                    />
                  ))
                )}
              </div>

              {/* Summary Footer */}
              {(remainingEventCount > 0 || totalFreeMinutes > 0) && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{remainingEventCount} event{remainingEventCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-600 font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatDuration(totalFreeMinutes)} free</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

/**
 * Individual time block card (event or free time)
 */
interface TimeBlockCardProps {
  block: TimeBlock;
  timezone?: string;
  formatTimeRange: (start: Date, end: Date) => string;
  formatDuration: (minutes: number) => string;
}

function TimeBlockCard({ block, timezone, formatTimeRange, formatDuration }: TimeBlockCardProps) {
  if (block.type === 'free') {
    const durationMinutes = Math.round((block.endTime.getTime() - block.startTime.getTime()) / 60000);

    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium text-green-600">Free Time</span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">{formatDuration(durationMinutes)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {formatTimeRange(block.startTime, block.endTime)}
        </p>
      </div>
    );
  }

  // Event block
  const event = block.event!;
  const calendarColor = getCalendarColor(event.calendarColor, event.provider as Provider);

  return (
    <div
      className={`
        rounded-lg p-3 transition-all
        ${block.isCurrent
          ? 'bg-green-50 border-2 border-green-400 shadow-md'
          : block.isNext
            ? 'bg-blue-50 border-2 border-blue-400 shadow-sm'
            : 'bg-white border border-gray-200 hover:shadow-sm'
        }
      `}
    >
      {/* Badge */}
      {(block.isCurrent || block.isNext) && (
        <div className="mb-2">
          <span
            className={`
              inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide
              ${block.isCurrent
                ? 'bg-green-500 text-white'
                : 'bg-blue-500 text-white'
              }
            `}
          >
            {block.isCurrent ? 'Now' : 'Next'}
          </span>
        </div>
      )}

      {/* Event Header */}
      <div className="flex items-start gap-2">
        {/* Calendar color dot */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: calendarColor }}
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-sm font-medium text-gray-900 truncate" title={event.title}>
            {event.title || '(No title)'}
          </p>

          {/* Time */}
          <p className="text-xs text-gray-500 mt-0.5">
            {formatTime(new Date(event.startTime), timezone)} - {formatTime(new Date(event.endTime), timezone)}
          </p>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {/* Teams meeting indicator */}
          {event.teamsEnabled && event.teamsMeetingUrl && (
            <a
              href={event.teamsMeetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
              </svg>
              Join Teams
            </a>
          )}
        </div>
      </div>

      {/* Calendar name */}
      <div className="mt-2 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 truncate">{event.calendarName}</p>
      </div>
    </div>
  );
}
