import type { CalendarEvent } from '../../api/calendar/calendar';
import ProviderIcon from './ProviderIcon';
import {
  getCalendarColor,
  type Provider,
} from '../../utils/calendar/calendarColors';

interface CalendarEventCardProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
}

/**
 * Card component for displaying individual calendar events
 * Shows event details including time, title, location, and calendar source
 */
export default function CalendarEventCard({ event, onClick }: CalendarEventCardProps) {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  // Format time display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Calculate if event is multi-day
  const isMultiDay = startDate.toDateString() !== endDate.toDateString();

  // Determine if event is ongoing, past, or future
  const now = new Date();
  const isOngoing = now >= startDate && now <= endDate;
  const isPast = now > endDate;

  // Get event status styling (border color comes from calendar color)
  const getStatusStyles = () => {
    if (event.status === 'cancelled') {
      return 'opacity-60 line-through';
    }
    if (isOngoing) {
      return 'border-l-4 border-l-green-500'; // Keep green for live events
    }
    if (isPast) {
      return 'opacity-75 border-l-4';
    }
    return 'border-l-4';
  };

  // Get calendar's effective color
  const calendarColor = getCalendarColor(event.calendarColor, event.provider as Provider);

  const handleClick = () => {
    if (onClick) {
      onClick(event);
    } else if (event.htmlLink) {
      window.open(event.htmlLink, '_blank', 'noopener,noreferrer');
    }
  };

  // Determine if we should use calendar color for border (not for ongoing events which use green)
  const shouldUseCalendarBorder = !isOngoing && event.status !== 'cancelled';

  return (
    <div
      className={`bg-white rounded-lg border-2 border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-4 ${getStatusStyles()} ${
        onClick || event.htmlLink ? 'cursor-pointer' : ''
      }`}
      style={shouldUseCalendarBorder ? { borderLeftColor: calendarColor } : undefined}
      onClick={handleClick}
      role={onClick || event.htmlLink ? 'button' : undefined}
      tabIndex={onClick || event.htmlLink ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && (onClick || event.htmlLink)) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Time and Status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          {event.isAllDay ? (
            <p className="text-sm font-medium text-gray-900">All Day</p>
          ) : (
            <p className="text-sm font-medium text-gray-900">
              {formatTime(startDate)} - {formatTime(endDate)}
              {isMultiDay && (
                <span className="text-xs text-gray-600 ml-1">(multi-day)</span>
              )}
            </p>
          )}
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          {isOngoing && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Live
            </span>
          )}
          {event.status === 'tentative' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Tentative
            </span>
          )}
          {event.status === 'cancelled' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Cancelled
            </span>
          )}
        </div>
      </div>

      {/* Event Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
        {event.title || '(No title)'}
      </h3>

      {/* Location */}
      {event.location && (
        <div className="flex items-start gap-2 mb-2">
          <svg
            className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-sm text-gray-600 line-clamp-1">{event.location}</p>
        </div>
      )}

      {/* Description */}
      {event.description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{event.description}</p>
      )}

      {/* Attendees */}
      {event.attendees && event.attendees.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <svg
            className="w-4 h-4 text-gray-500 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-sm text-gray-600">
            {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
          </p>
        </div>
      )}

      {/* Calendar and Provider Info */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <ProviderIcon provider={event.provider} size="sm" />
          <div className="flex items-center gap-2">
            {event.calendarColor && (
              <div
                className="w-3 h-3 rounded-full border border-gray-300"
                style={{ backgroundColor: event.calendarColor }}
                aria-label="Calendar color"
              />
            )}
            <span className="text-sm text-gray-600 truncate max-w-[150px]">
              {event.calendarName}
            </span>
          </div>
        </div>

        {(onClick || event.htmlLink) && (
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
