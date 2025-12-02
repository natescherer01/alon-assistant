import { useState, useMemo } from 'react';
import type { Calendar } from '../api/calendar';
import ProviderIcon from './ProviderIcon';
import { formatRelativeTime } from '../utils/time';
import { useCalendars } from '../hooks/useCalendars';
import { useToast } from '../hooks/useToast';
import ConfirmationModal from './ConfirmationModal';
import ConnectCalendarModal from './ConnectCalendarModal';
import {
  getProviderBadgeClasses,
  getProviderDotClasses,
  getProviderName,
  getCalendarColor,
  type Provider,
} from '../utils/calendarColors';

interface CalendarSidebarProps {
  calendars: Calendar[];
  isCollapsed: boolean;
  onToggle: () => void;
}

/**
 * Collapsible sidebar for calendar management
 * Shows minimal indicators when collapsed, full details when expanded
 * On mobile: becomes a drawer that slides in from left
 */
export default function CalendarSidebar({
  calendars,
  isCollapsed,
  onToggle,
}: CalendarSidebarProps) {
  const [expandedCalendarId, setExpandedCalendarId] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [calendarToDisconnect, setCalendarToDisconnect] = useState<Calendar | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const { disconnectCalendar, syncCalendar } = useCalendars();
  const { success, error: showError } = useToast();


  const handleCalendarClick = (calendarId: string) => {
    if (isCollapsed) {
      // Expand sidebar when clicking a calendar dot while collapsed
      onToggle();
      setExpandedCalendarId(calendarId);
    } else {
      // Toggle calendar details when sidebar is expanded
      setExpandedCalendarId(expandedCalendarId === calendarId ? null : calendarId);
    }
  };

  const handleDisconnectClick = (calendar: Calendar) => {
    setCalendarToDisconnect(calendar);
    setShowDisconnectModal(true);
  };

  const handleDisconnectConfirm = async () => {
    if (!calendarToDisconnect) return;

    try {
      await disconnectCalendar(calendarToDisconnect.id);
      success('Calendar disconnected successfully');
      setShowDisconnectModal(false);
      setCalendarToDisconnect(null);
      if (expandedCalendarId === calendarToDisconnect.id) {
        setExpandedCalendarId(null);
      }
    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
      showError('Failed to disconnect calendar');
    }
  };

  const handleSync = async (calendar: Calendar) => {
    if (calendar.isReadOnly) return;

    setIsSyncing(calendar.id);
    try {
      await syncCalendar(calendar.id);
      success('Calendar sync triggered');
    } catch (error) {
      console.error('Failed to sync calendar:', error);
      showError('Failed to sync calendar');
    } finally {
      setIsSyncing(null);
    }
  };

  // Count calendars by provider
  const providerCounts = useMemo(
    () =>
      calendars.reduce((acc, cal) => {
        acc[cal.provider] = (acc[cal.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [calendars]
  );

  return (
    <>
      {/* Mobile Overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 top-16 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out z-40
          ${isCollapsed ? 'w-16' : 'w-72'}
          ${!isCollapsed ? 'shadow-xl lg:shadow-none' : ''}
        `}
        aria-label="Calendar sidebar"
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-gray-900">Calendars</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {calendars.length} connected
                </p>
              </div>
            )}

            {/* Toggle Button */}
            <button
              onClick={onToggle}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                className={`w-5 h-5 text-gray-600 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          {/* Calendar List */}
          <div className="flex-1 overflow-y-auto">
            {isCollapsed ? (
              // Collapsed view: Show colored dots/indicators
              <div className="p-3 space-y-3">
                {calendars.map((calendar) => {
                  const calColor = getCalendarColor(calendar.calendarColor, calendar.provider as Provider);
                  return (
                    <button
                      key={calendar.id}
                      onClick={() => handleCalendarClick(calendar.id)}
                      className="w-10 h-10 rounded-lg flex items-center justify-center transition-all relative group hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ backgroundColor: `${calColor}33` }} // 20% opacity
                      aria-label={calendar.calendarName}
                      title={calendar.calendarName}
                    >
                      {/* Status indicator */}
                      <div
                        className={`
                          absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white
                          ${calendar.isSyncing ? 'bg-yellow-500 animate-pulse' :
                            calendar.isConnected ? 'bg-green-500' : 'bg-red-500'}
                        `}
                      />

                      {/* Calendar color dot */}
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: calColor }}
                      />
                    </button>
                  );
                })}

                {/* Add calendar button */}
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Connect calendar"
                  title="Connect calendar"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ) : (
              // Expanded view: Show full calendar details
              <div className="p-4 space-y-3">
                {/* Provider Statistics */}
                <div className="flex gap-2 flex-wrap mb-4">
                  {Object.entries(providerCounts).map(([provider, count]) => (
                    <span
                      key={provider}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getProviderBadgeClasses(provider as Provider)}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${getProviderDotClasses(provider as Provider)}`} />
                      {count}
                    </span>
                  ))}
                </div>

                {/* Calendar Items */}
                {calendars.map((calendar) => {
                  const calColor = getCalendarColor(calendar.calendarColor, calendar.provider as Provider);
                  return (
                  <div key={calendar.id} className="border border-gray-200 rounded-lg overflow-hidden border-l-4" style={{ borderLeftColor: calColor }}>
                    {/* Calendar Header */}
                    <button
                      onClick={() => handleCalendarClick(calendar.id)}
                      className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    >
                      <ProviderIcon provider={calendar.provider} size="sm" />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" title={calendar.calendarName}>
                          {calendar.calendarName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              calendar.isSyncing
                                ? 'bg-yellow-500 animate-pulse'
                                : calendar.isConnected
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            }`}
                          />
                          <span className="text-xs text-gray-500">
                            {calendar.isSyncing ? 'Syncing...' : calendar.isConnected ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          expandedCalendarId === calendar.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded Calendar Details */}
                    {expandedCalendarId === calendar.id && (
                      <div className="px-3 pb-3 pt-1 bg-gray-50 border-t border-gray-200 space-y-3">
                        {/* Calendar Info */}
                        <div className="space-y-2 text-xs">
                          {/* Calendar Color and Provider Badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Calendar color indicator */}
                            <div
                              className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                              style={{ backgroundColor: getCalendarColor(calendar.calendarColor, calendar.provider as Provider) }}
                              title="Calendar color"
                            />
                            {/* Provider badge */}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getProviderBadgeClasses(calendar.provider as Provider)}`}
                            >
                              {getProviderName(calendar.provider as Provider)}
                            </span>
                            {calendar.isPrimary && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Primary
                              </span>
                            )}
                            {calendar.isReadOnly && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
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
                          </div>

                          {/* Owner Email */}
                          {calendar.ownerEmail && (
                            <p className="text-gray-600">
                              <span className="font-medium">Owner:</span> {calendar.ownerEmail}
                            </p>
                          )}

                          {/* Last Synced */}
                          {calendar.lastSyncedAt && (
                            <p className="text-gray-600">
                              <span className="font-medium">Last synced:</span>{' '}
                              {formatRelativeTime(calendar.lastSyncedAt)}
                            </p>
                          )}

                          {/* Sync Error */}
                          {calendar.syncError && (
                            <p className="text-red-600" title={calendar.syncError}>
                              <span className="font-medium">Error:</span> Sync failed
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {/* Sync Button */}
                          {!calendar.isReadOnly && (
                            <button
                              onClick={() => handleSync(calendar)}
                              disabled={isSyncing === calendar.id}
                              className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {isSyncing === calendar.id ? (
                                <span className="flex items-center justify-center gap-1">
                                  <svg className="animate-spin w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                  Syncing...
                                </span>
                              ) : (
                                'Sync Now'
                              )}
                            </button>
                          )}

                          {/* Disconnect Button */}
                          <button
                            onClick={() => handleDisconnectClick(calendar)}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Calendar Button */}
              <button
                onClick={() => setShowConnectModal(true)}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                + Connect Calendar
              </button>
            </div>
            )}
          </div>
        </div>
      </aside>

      {/* Disconnect Confirmation Modal */}
      {calendarToDisconnect && (
        <ConfirmationModal
          isOpen={showDisconnectModal}
          title="Disconnect Calendar"
          message={`Are you sure you want to disconnect "${calendarToDisconnect.calendarName}"? This will remove all synced events.`}
          confirmText="Disconnect"
          cancelText="Cancel"
          variant="danger"
          onConfirm={handleDisconnectConfirm}
          onCancel={() => {
            setShowDisconnectModal(false);
            setCalendarToDisconnect(null);
          }}
          isLoading={false}
        />
      )}

      {/* Connect Calendar Modal */}
      <ConnectCalendarModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />
    </>
  );
}
