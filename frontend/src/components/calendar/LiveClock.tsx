import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/calendar/useAuth';
import { formatTime24Hour, getUserTimezone } from '../../utils/calendar/dateTime';

/**
 * Live clock display styled like a digital LED clock
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
        padding: '8px 16px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        border: '2px solid #333',
        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3)',
      }}
    >
      <span
        style={{
          fontFamily: '"SF Mono", "Roboto Mono", "Consolas", monospace',
          fontSize: '28px',
          fontWeight: 600,
          color: '#00ff88',
          textShadow: '0 0 10px rgba(0, 255, 136, 0.7), 0 0 20px rgba(0, 255, 136, 0.4)',
          letterSpacing: '2px',
        }}
      >
        {formatTime24Hour(currentTime, timezone)}
      </span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        {displayTimezone}
      </span>
    </div>
  );
}
