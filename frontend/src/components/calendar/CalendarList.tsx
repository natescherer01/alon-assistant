import type { Calendar } from '../../api/calendar/calendar';
import CalendarCard from './CalendarCard';

interface CalendarListProps {
  calendars: Calendar[];
}

/**
 * Grid layout of connected calendars
 * Responsive: 1 column on mobile, 2 on tablet, 3 on desktop
 */
export default function CalendarList({ calendars }: CalendarListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {calendars.map((calendar) => (
        <CalendarCard key={calendar.id} calendar={calendar} />
      ))}
    </div>
  );
}
