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
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 16px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #eee',
      }}
    >
      <span
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: '#000',
          letterSpacing: '-0.01em',
        }}
      >
        {formatTime24Hour(currentTime, timezone)}
      </span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: '#999',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {displayTimezone}
      </span>
    </div>
  );
}
