import { useEffect, useMemo, useCallback } from 'react';
import type { CalendarEvent } from '../../api/calendar/calendar';
import { formatTime } from '../../utils/calendar/calendarGrid';
import { getCalendarColor, type Provider } from '../../utils/calendar/calendarColors';
import { useAuth } from '../../hooks/calendar/useAuth';

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
    let dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    if (sleepEnd) {
      dayStart.setHours(sleepEnd.hours, sleepEnd.minutes, 0, 0);
      if (now < dayStart) {
        dayStart.setDate(dayStart.getDate() - 1);
        dayStart.setHours(sleepEnd.hours, sleepEnd.minutes, 0, 0);
      }
    }

    // Evening boundary: stop counting at sleep time
    let dayEnd = new Date(now);
    if (sleepStart && sleepEnd) {
      dayEnd.setHours(sleepStart.hours, sleepStart.minutes, 0, 0);

      const sleepCrossesMidnight = sleepStart.hours < sleepEnd.hours ||
        (sleepStart.hours === sleepEnd.hours && sleepStart.minutes < sleepEnd.minutes);

      if (sleepCrossesMidnight) {
        if (now.getHours() >= sleepEnd.hours) {
          dayEnd.setDate(dayEnd.getDate() + 1);
        }
      } else {
        if (now.getHours() >= sleepStart.hours) {
          dayEnd.setDate(dayEnd.getDate() + 1);
        }
      }

      if (dayEnd <= now) {
        dayEnd.setDate(dayEnd.getDate() + 1);
      }
    } else {
      dayEnd.setHours(23, 59, 59, 999);
    }

    // Filter to today's timed events (not all-day) that haven't ended yet
    const todaysEvents = events
      .filter(event => {
        if (event.isAllDay) return false;
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
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

    let effectiveEnd = dayEnd;
    if (todaysEvents.length > 0) {
      const lastEventEnd = new Date(todaysEvents[todaysEvents.length - 1].endTime);
      effectiveEnd = new Date(Math.max(dayEnd.getTime(), lastEventEnd.getTime()));
    }

    for (const event of todaysEvents) {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      const displayStart = eventStart < now ? now : eventStart;

      if (displayStart > lastEndTime) {
        const gapMinutes = Math.round((displayStart.getTime() - lastEndTime.getTime()) / 60000);
        if (gapMinutes >= 5) {
          blocks.push({
            type: 'free',
            startTime: lastEndTime,
            endTime: displayStart,
          });
        }
      }

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

    if (lastEndTime < effectiveEnd) {
      blocks.push({
        type: 'free',
        startTime: lastEndTime,
        endTime: effectiveEnd,
      });
    }

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
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 40,
          }}
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        style={{
          position: 'fixed',
          top: '64px',
          right: 0,
          height: 'calc(100vh - 64px)',
          background: '#fff',
          borderLeft: '1px solid #E5E7EB',
          transition: 'all 0.3s ease-in-out',
          zIndex: 40,
          width: isExpanded ? '320px' : '48px',
          boxShadow: isExpanded ? '0 10px 25px rgba(0, 0, 0, 0.1)' : 'none',
        }}
        aria-label="Today's plan panel"
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Collapsed State - Vertical Tab */}
          {!isExpanded && (
            <button
              onClick={onToggle}
              style={{
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              aria-label="Expand today's plan"
              title="Today's Plan"
            >
              {/* Event count badge */}
              {remainingEventCount > 0 && (
                <div style={{
                  background: '#0066FF',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '700',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {remainingEventCount}
                </div>
              )}

              {/* Rotated "Today" text */}
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#666',
                  letterSpacing: '0.05em',
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                }}
              >
                TODAY
              </div>

              {/* Expand chevron */}
              <svg
                style={{ width: '16px', height: '16px', color: '#9CA3AF' }}
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
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(to right, rgba(0, 102, 255, 0.05), #fff)',
              }}>
                <div>
                  <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#000', margin: 0 }}>Today's Plan</h2>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    {remainingEventCount} event{remainingEventCount !== 1 ? 's' : ''} remaining
                  </p>
                </div>

                {/* Collapse Button */}
                <button
                  onClick={onToggle}
                  style={{
                    padding: '8px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  aria-label="Collapse panel"
                  title="Collapse panel"
                >
                  <svg
                    style={{ width: '20px', height: '20px', color: '#666' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                {timeBlocks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      margin: '0 auto 16px',
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg style={{ width: '32px', height: '32px', color: '#10B981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>All clear!</p>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>No more events scheduled for today</p>
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
                <div style={{
                  padding: '16px',
                  borderTop: '1px solid #E5E7EB',
                  background: '#F9FAFB',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#666' }}>
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{remainingEventCount} event{remainingEventCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontWeight: '500' }}>
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div style={{
        borderRadius: '12px',
        border: '2px dashed #E5E7EB',
        background: '#F9FAFB',
        padding: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
          <svg style={{ width: '16px', height: '16px', color: '#10B981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span style={{ fontSize: '12px', fontWeight: '500', color: '#10B981' }}>Free Time</span>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>-</span>
          <span style={{ fontSize: '12px', color: '#666' }}>{formatDuration(durationMinutes)}</span>
        </div>
        <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
          {formatTimeRange(block.startTime, block.endTime)}
        </p>
      </div>
    );
  }

  // Event block
  const event = block.event!;
  const calendarColor = getCalendarColor(event.calendarColor, event.provider as Provider);

  const getBlockStyle = (): React.CSSProperties => {
    if (block.isCurrent) {
      return {
        background: 'rgba(16, 185, 129, 0.1)',
        border: '2px solid #10B981',
        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
      };
    }
    if (block.isNext) {
      return {
        background: 'rgba(0, 102, 255, 0.05)',
        border: '2px solid #0066FF',
        boxShadow: '0 2px 8px rgba(0, 102, 255, 0.1)',
      };
    }
    return {
      background: '#fff',
      border: '1px solid #E5E7EB',
    };
  };

  return (
    <div
      style={{
        borderRadius: '12px',
        padding: '12px',
        transition: 'all 0.2s',
        ...getBlockStyle(),
      }}
    >
      {/* Badge */}
      {(block.isCurrent || block.isNext) && (
        <div style={{ marginBottom: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: block.isCurrent ? '#10B981' : '#0066FF',
              color: '#fff',
            }}
          >
            {block.isCurrent ? 'Now' : 'Next'}
          </span>
        </div>
      )}

      {/* Event Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        {/* Calendar color dot */}
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            flexShrink: 0,
            marginTop: '2px',
            backgroundColor: calendarColor,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <p style={{
            fontSize: '14px',
            fontWeight: '500',
            color: '#000',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
          }} title={event.title}>
            {event.title || '(No title)'}
          </p>

          {/* Time */}
          <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            {formatTime(new Date(event.startTime), timezone)} - {formatTime(new Date(event.endTime), timezone)}
          </p>

          {/* Location */}
          {event.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '12px', color: '#666' }}>
              <svg style={{ width: '12px', height: '12px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.location}</span>
            </div>
          )}

          {/* Teams meeting indicator */}
          {event.teamsEnabled && event.teamsMeetingUrl && (
            <a
              href={event.teamsMeetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '8px',
                padding: '4px 8px',
                background: '#0066FF',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '500',
                borderRadius: '6px',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <svg style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
              </svg>
              Join Teams
            </a>
          )}
        </div>
      </div>

      {/* Calendar name */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F3F4F6' }}>
        <p style={{ fontSize: '12px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{event.calendarName}</p>
      </div>
    </div>
  );
}
