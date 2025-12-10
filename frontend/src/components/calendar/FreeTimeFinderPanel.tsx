import React, { useState, useCallback } from 'react';
import { useFindFreeTimes } from '../../hooks/calendar/useCalendarUsers';
import { FreeSlot } from '../../api/calendar/users';

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
    // Calculate for the current week view
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
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="p-4 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Find Free Time</h3>

      <button
        onClick={handleFindFreeTime}
        disabled={findFreeTimes.isPending}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {findFreeTimes.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Finding...
          </span>
        ) : (
          'Find Mutual Free Time'
        )}
      </button>

      <p className="text-xs text-gray-500 mt-2">
        Shows times when{' '}
        {selectedUserIds.length > 0
          ? 'you and selected team members are'
          : 'you are'}{' '}
        all available (excludes midnight-6am)
      </p>

      {showResults && findFreeTimes.data && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">
              {findFreeTimes.data.freeSlots.length} free slot
              {findFreeTimes.data.freeSlots.length !== 1 ? 's' : ''} found
            </span>
            <button
              onClick={handleClearHighlights}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {findFreeTimes.data.freeSlots.length === 0 ? (
              <div className="text-sm text-gray-500 py-2 text-center">
                No mutual free time found in this week
              </div>
            ) : (
              <>
                {findFreeTimes.data.freeSlots.slice(0, 10).map((slot, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-green-50 border border-green-200 rounded text-xs cursor-pointer hover:bg-green-100 transition-colors"
                  >
                    <div className="font-medium text-green-800">
                      {formatTime(slot.startTime)}
                    </div>
                    <div className="text-green-600">
                      {formatDuration(slot.durationMinutes)} available
                    </div>
                  </div>
                ))}
                {findFreeTimes.data.freeSlots.length > 10 && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    +{findFreeTimes.data.freeSlots.length - 10} more slots
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
