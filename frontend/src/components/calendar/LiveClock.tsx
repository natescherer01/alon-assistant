import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/calendar/useAuth';
import { formatTime24Hour, getUserTimezone } from '../../utils/calendar/dateTime';

/**
 * Live clock display with modern styling
 * Shows current time in 24-hour format with timezone
 * Updates every second
 */
export default function LiveClock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user } = useAuth();

  // Get timezone (user preference or browser default)
  const timezone = user?.timezone || getUserTimezone();

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format timezone for display (e.g., "America/Chicago" -> "Chicago")
  const displayTimezone = timezone.includes('/')
    ? timezone.split('/').pop()?.replace(/_/g, ' ')
    : timezone;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium">
      <svg
        className="w-5 h-5 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="font-mono tabular-nums tracking-tight">
        {formatTime24Hour(currentTime, timezone)}
      </span>
      <span className="text-gray-500 text-sm">
        {displayTimezone}
      </span>
    </div>
  );
}
