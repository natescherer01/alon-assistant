import { useState } from 'react';
import type { Calendar } from '../api/calendar';
import { formatRelativeTime } from '../utils/time';
import ProviderIcon from './ProviderIcon';
import ConfirmationModal from './ConfirmationModal';
import { useCalendars } from '../hooks/useCalendars';
import { useToast } from '../hooks/useToast';
import {
  getProviderBadgeClasses,
  getProviderName,
  getCalendarColor,
  type Provider,
} from '../utils/calendarColors';

interface CalendarCardProps {
  calendar: Calendar;
}

/**
 * Card component for displaying individual calendar information
 * Shows provider icon, calendar name, status, and actions
 */
export default function CalendarCard({ calendar }: CalendarCardProps) {
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { disconnectCalendar, syncCalendar } = useCalendars();
  const { success, error: showError } = useToast();

  // Get calendar's effective color (uses calendar color if available, falls back to provider color)
  const calendarColor = getCalendarColor(calendar.calendarColor, calendar.provider as Provider);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectCalendar(calendar.id);
      success('Calendar disconnected successfully');
      setShowDisconnectModal(false);
    } catch (error) {
      showError('Failed to disconnect calendar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncCalendar(calendar.id);
      success('Calendar sync triggered');
    } catch (error) {
      showError('Failed to sync calendar');
    } finally {
      setIsSyncing(false);
    }
  };

  // Truncate long calendar names
  const truncateName = (name: string, maxLength: number = 30) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  return (
    <>
      <div
        className="bg-white rounded-lg border-2 border-gray-200 border-l-4 shadow-sm hover:shadow-md transition-all duration-200 p-6"
        style={{ borderLeftColor: calendarColor }}
      >
        <div className="flex items-start gap-4">
          {/* Provider Icon */}
          <ProviderIcon provider={calendar.provider} size="lg" className="flex-shrink-0" />

          {/* Calendar Info */}
          <div className="flex-1 min-w-0">
            {/* Calendar Name */}
            <h3
              className="text-lg font-semibold text-gray-900 mb-1"
              title={calendar.calendarName}
            >
              {truncateName(calendar.calendarName)}
            </h3>

            {/* Provider Badge and Calendar Color Indicator */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Calendar color indicator */}
              <div
                className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: calendarColor }}
                title="Calendar color"
              />
              {/* Provider badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProviderBadgeClasses(calendar.provider as Provider)}`}
              >
                {getProviderName(calendar.provider as Provider)}
              </span>
              {calendar.isPrimary && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Primary
                </span>
              )}
              {calendar.isReadOnly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Read-only
                </span>
              )}
              {calendar.calendarType === 'shared' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Shared
                </span>
              )}
              {calendar.calendarType === 'delegated' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Delegated
                </span>
              )}
            </div>

            {/* Owner Email (for shared/delegated calendars) */}
            {calendar.ownerEmail && (
              <p className="text-sm text-gray-600 mb-2">
                From: {calendar.ownerEmail}
              </p>
            )}

            {/* Status */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div
                className={`w-2 h-2 rounded-full ${
                  calendar.isSyncing
                    ? 'bg-yellow-500 animate-pulse'
                    : calendar.isConnected
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}
              />
              <span>
                {calendar.isSyncing
                  ? 'Syncing...'
                  : calendar.isConnected
                  ? 'Connected'
                  : 'Disconnected'}
              </span>
            </div>

            {/* Last Synced */}
            {calendar.lastSyncedAt && (
              <p className="text-sm text-gray-500 mt-1">
                Last synced {formatRelativeTime(calendar.lastSyncedAt)}
              </p>
            )}

            {/* Sync Error */}
            {calendar.syncError && (
              <p className="text-sm text-red-600 mt-1" title={calendar.syncError}>
                Sync failed
              </p>
            )}
          </div>

          {/* Actions Menu */}
          <div className="flex flex-col gap-2">
            {/* Sync Button - Disabled for read-only calendars */}
            {!calendar.isReadOnly && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Sync calendar"
                title="Sync calendar"
              >
                <svg
                  className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}

            {/* Disconnect Button */}
            <button
              onClick={() => setShowDisconnectModal(true)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Disconnect calendar"
              title="Disconnect calendar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDisconnectModal}
        title="Disconnect Calendar"
        message={`Are you sure you want to disconnect "${calendar.calendarName}"? This will remove all synced events.`}
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnectModal(false)}
        isLoading={isDisconnecting}
      />
    </>
  );
}
