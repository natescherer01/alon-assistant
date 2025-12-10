import { useState, useCallback } from 'react';
import { useFindFreeTimes } from '../../hooks/calendar/useCalendarUsers';
import type { FreeSlot } from '../../api/calendar/users';

interface Props {
  selectedUserIds: string[];
  currentUserId: string;
  viewDate: Date;
  onHighlightFreeSlots: (slots: FreeSlot[] | null) => void;
}

export function FreeTimeFinderPanel({
  selectedUserIds,
  currentUserId,
  viewDate,
  onHighlightFreeSlots,
}: Props) {
  const [showResults, setShowResults] = useState(false);
  const findFreeTimes = useFindFreeTimes();

  // Include current user in free time calculation
  const allUserIds = [String(currentUserId), ...selectedUserIds];

  const handleFindFreeTime = useCallback(() => {
    const startDate = new Date(viewDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    findFreeTimes.mutate(
      {
        userIds: allUserIds,
        startDate,
        endDate,
        minSlotMinutes: 30,
        excludedHoursStart: 0,
        excludedHoursEnd: 6,
      },
      {
        onSuccess: (data) => {
          onHighlightFreeSlots(data.freeSlots);
          setShowResults(true);
        },
      }
    );
  }, [allUserIds, viewDate, findFreeTimes, onHighlightFreeSlots]);

  const handleClearHighlights = useCallback(() => {
    onHighlightFreeSlots(null);
    setShowResults(false);
  }, [onHighlightFreeSlots]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Find Button */}
      <button
        onClick={handleFindFreeTime}
        disabled={findFreeTimes.isPending}
        style={{
          width: '100%',
          padding: '10px 16px',
          fontSize: '13px',
          fontWeight: '500',
          color: '#fff',
          background: findFreeTimes.isPending ? '#9CA3AF' : '#22C55E',
          border: 'none',
          borderRadius: '8px',
          cursor: findFreeTimes.isPending ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {findFreeTimes.isPending ? (
          <>
            <div style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid #fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            Finding...
          </>
        ) : (
          'Find Free Time'
        )}
      </button>

      {/* Helper Text */}
      <p style={{
        fontSize: '11px',
        color: '#888',
        margin: '8px 0 0 0',
        lineHeight: '1.4',
      }}>
        {selectedUserIds.length > 0
          ? `Shows mutual availability with ${selectedUserIds.length} team member${selectedUserIds.length > 1 ? 's' : ''}`
          : 'Shows your available time slots'}
      </p>

      {/* Results */}
      {showResults && findFreeTimes.data && (
        <div style={{ marginTop: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#333' }}>
              {findFreeTimes.data.freeSlots.length} slot{findFreeTimes.data.freeSlots.length !== 1 ? 's' : ''} found
            </span>
            <button
              onClick={handleClearHighlights}
              style={{
                fontSize: '11px',
                color: '#666',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
            {findFreeTimes.data.freeSlots.length === 0 ? (
              <div style={{
                fontSize: '12px',
                color: '#888',
                padding: '12px',
                textAlign: 'center',
                background: '#F9FAFB',
                borderRadius: '8px',
              }}>
                No free time found this week
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {findFreeTimes.data.freeSlots.slice(0, 8).map((slot, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(34, 197, 94, 0.1)',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#166534', fontWeight: '500' }}>
                      {formatTime(slot.startTime)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#22C55E' }}>
                      {formatDuration(slot.durationMinutes)}
                    </span>
                  </div>
                ))}
                {findFreeTimes.data.freeSlots.length > 8 && (
                  <div style={{
                    fontSize: '11px',
                    color: '#888',
                    textAlign: 'center',
                    padding: '4px',
                  }}>
                    +{findFreeTimes.data.freeSlots.length - 8} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spin Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
