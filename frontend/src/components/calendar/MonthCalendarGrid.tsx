import { useMemo, useState } from 'react';
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {weekdayNames.map((name, index) => (
          <div
            key={index}
            className={`p-2 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 ${
              index === 0 || index === 6 ? 'bg-gray-100' : ''
            }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
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
}: MonthDayCellProps) {
  const [showAll, setShowAll] = useState(false);

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

  return (
    <div
      className={`min-h-[100px] md:min-h-[120px] border-r border-b border-gray-200 p-1 md:p-2 transition-colors relative ${
        isWeekend ? 'bg-gray-50' : 'bg-white'
      } ${
        isToday ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : ''
      } ${
        !isCurrentMonth ? 'opacity-40' : ''
      } ${
        onCellClick ? 'cursor-pointer hover:bg-gray-50' : ''
      }`}
      onClick={handleCellClick}
    >
      {/* Date Number */}
      <div className="flex items-center justify-between mb-1">
        <div
          className={`text-sm md:text-base font-semibold ${
            isToday
              ? 'bg-blue-600 text-white rounded-full w-6 h-6 md:w-7 md:h-7 flex items-center justify-center'
              : isCurrentMonth
              ? 'text-gray-900'
              : 'text-gray-400'
          }`}
        >
          {date.getDate()}
        </div>

        {/* Event count badge for mobile */}
        {events.length > 0 && (
          <div className="text-xs text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded-full md:hidden">
            {events.length}
          </div>
        )}
      </div>

      {/* Events */}
      <div className="space-y-1 overflow-hidden">
        {visibleEvents.map(event => (
          <MonthEventBar
            key={event.id}
            event={event}
            onClick={onEventClick}
            timezone={timezone}
          />
        ))}

        {/* "+X more" indicator */}
        {!showAll && hiddenCount > 0 && (
          <button
            className="text-xs text-blue-600 hover:text-blue-800 font-medium w-full text-left px-1 py-0.5 hover:bg-blue-50 rounded"
            onClick={handleMoreClick}
          >
            +{hiddenCount} more
          </button>
        )}

        {/* "Show less" button */}
        {showAll && events.length > MAX_VISIBLE_EVENTS && (
          <button
            className="text-xs text-gray-600 hover:text-gray-800 font-medium w-full text-left px-1 py-0.5 hover:bg-gray-100 rounded"
            onClick={handleMoreClick}
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
}

function MonthEventBar({ event, onClick, timezone }: MonthEventBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

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

  const getBorderStyle = () => {
    if (event.status === 'tentative') return 'border-l-2 border-dashed';
    if (event.status === 'cancelled') return 'border-l-2';
    return 'border-l-2';
  };

  const safeColor = getCalendarColor(event.calendarColor, event.provider as Provider);

  return (
    <div className="relative">
      <div
        className={`text-xs px-1 py-0.5 rounded cursor-pointer hover:shadow-md transition-all truncate ${getBorderStyle()} ${
          event.status === 'cancelled' ? 'opacity-60 line-through' : ''
        }`}
        style={{
          backgroundColor: safeColor,
          borderColor: adjustColorBrightness(safeColor, -20),
          color: getContrastColor(safeColor),
        }}
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="button"
        tabIndex={0}
        title={sanitizeEventText(event.title, 100)}
      >
        <div className="flex items-center gap-1">
          <span className="flex-1 font-medium truncate">
            {event.isAllDay ? '' : `${formatTime(new Date(event.startTime), timezone)} `}
            {sanitizeEventText(event.title, 100) || '(No title)'}
          </span>
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

      {/* Tooltip */}
      {showTooltip && (
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
    <div className="absolute z-50 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-3 min-w-[250px] max-w-[350px] pointer-events-none left-0 top-full mt-1">
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 font-semibold text-gray-900">{event.title || '(No title)'}</div>
          {event.importance === 'high' && (
            <span className="text-red-500 text-xs font-bold px-1.5 py-0.5 bg-red-50 rounded">High</span>
          )}
        </div>

        {event.isAllDay ? (
          <div className="text-sm text-gray-600">All day</div>
        ) : (
          <div className="text-sm text-gray-600">
            {formatTime(startTime, timezone)} - {formatTime(endTime, timezone)}
          </div>
        )}

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
            <span className="break-words">{event.location}</span>
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

