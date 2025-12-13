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
        gap: '12px',
        padding: '10px 20px',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
      }}
    >
      <span
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
          fontSize: '28px',
          fontWeight: 600,
          color: '#0066FF',
          letterSpacing: '1px',
        }}
      >
        {formatTime24Hour(currentTime, timezone)}
      </span>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {displayTimezone}
      </span>
    </div>
  );
}
