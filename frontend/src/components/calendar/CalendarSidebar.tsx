import { useState, useMemo } from 'react';
import type { Calendar } from '../../api/calendar/calendar';
import ProviderIcon from './ProviderIcon';
import { formatRelativeTime } from '../../utils/calendar/time';
import { useCalendars } from '../../hooks/calendar/useCalendars';
import { useToast } from '../../hooks/calendar/useToast';
import ConfirmationModal from './ConfirmationModal';
import ConnectCalendarModal from './ConnectCalendarModal';
import {
  getProviderName,
  getCalendarColor,
  type Provider,
} from '../../utils/calendar/calendarColors';

interface CalendarSidebarProps {
  calendars: Calendar[];
  isCollapsed: boolean;
  onToggle: () => void;
}

/**
 * Collapsible sidebar for calendar management
 * Shows minimal indicators when collapsed, full details when expanded
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
      onToggle();
      setExpandedCalendarId(calendarId);
    } else {
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

  const getProviderBadgeStyle = (provider: Provider): React.CSSProperties => {
    const styles: Record<Provider, React.CSSProperties> = {
      GOOGLE: { background: 'rgba(66, 133, 244, 0.1)', color: '#4285F4' },
      MICROSOFT: { background: 'rgba(0, 120, 212, 0.1)', color: '#0078D4' },
      ICS: { background: 'rgba(107, 114, 128, 0.1)', color: '#6B7280' },
    };
    return styles[provider] || styles.ICS;
  };

  const getStatusColor = (calendar: Calendar): string => {
    if (calendar.isSyncing) return '#EAB308';
    if (calendar.isConnected) return '#22C55E';
    return '#EF4444';
  };

  return (
    <>
      {/* Mobile Overlay */}
      {!isCollapsed && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 40,
          }}
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: '64px',
          left: 0,
          height: 'calc(100vh - 64px)',
          background: '#fff',
          borderRight: '1px solid #E5E7EB',
          transition: 'all 0.3s ease-in-out',
          zIndex: 40,
          width: isCollapsed ? '64px' : '288px',
          boxShadow: !isCollapsed ? '0 10px 25px rgba(0, 0, 0, 0.1)' : 'none',
        }}
        aria-label="Calendar sidebar"
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {!isCollapsed && (
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#000', margin: 0 }}>Calendars</h2>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                  {calendars.length} connected
                </p>
              </div>
            )}

            {/* Toggle Button */}
            <button
              onClick={onToggle}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                style={{
                  width: '20px',
                  height: '20px',
                  color: '#666',
                  transition: 'transform 0.2s',
                  transform: isCollapsed ? 'rotate(180deg)' : 'none',
                }}
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
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isCollapsed ? (
              // Collapsed view: Show colored dots/indicators
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {calendars.map((calendar) => {
                  const calColor = getCalendarColor(calendar.calendarColor, calendar.provider as Provider);
                  return (
                    <button
                      key={calendar.id}
                      onClick={() => handleCalendarClick(calendar.id)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        position: 'relative',
                        background: `${calColor}33`,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      aria-label={calendar.calendarName}
                      title={calendar.calendarName}
                    >
                      {/* Status indicator */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          border: '2px solid #fff',
                          background: getStatusColor(calendar),
                          animation: calendar.isSyncing ? 'pulse 2s infinite' : 'none',
                        }}
                      />

                      {/* Calendar color dot */}
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: calColor,
                        }}
                      />
                    </button>
                  );
                })}

                {/* Add calendar button */}
                <button
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    border: '2px dashed #D1D5DB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  aria-label="Connect calendar"
                  title="Connect calendar"
                >
                  <svg style={{ width: '20px', height: '20px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ) : (
              // Expanded view: Show full calendar details
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Provider Statistics */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {Object.entries(providerCounts).map(([provider, count]) => (
                    <span
                      key={provider}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: '500',
                        ...getProviderBadgeStyle(provider as Provider),
                      }}
                    >
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'currentColor',
                      }} />
                      {count}
                    </span>
                  ))}
                </div>

                {/* Calendar Items */}
                {calendars.map((calendar) => {
                  const calColor = getCalendarColor(calendar.calendarColor, calendar.provider as Provider);
                  return (
                    <div
                      key={calendar.id}
                      style={{
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        borderLeft: `4px solid ${calColor}`,
                      }}
                    >
                      {/* Calendar Header */}
                      <button
                        onClick={() => handleCalendarClick(calendar.id)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                      >
                        <ProviderIcon provider={calendar.provider} size="sm" />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#000',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            margin: 0,
                          }} title={calendar.calendarName}>
                            {calendar.calendarName}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <div
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: getStatusColor(calendar),
                                animation: calendar.isSyncing ? 'pulse 2s infinite' : 'none',
                              }}
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              {calendar.isSyncing ? 'Syncing...' : calendar.isConnected ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>

                        <svg
                          style={{
                            width: '16px',
                            height: '16px',
                            color: '#9CA3AF',
                            transition: 'transform 0.2s',
                            transform: expandedCalendarId === calendar.id ? 'rotate(180deg)' : 'none',
                          }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Expanded Calendar Details */}
                      {expandedCalendarId === calendar.id && (
                        <div style={{
                          padding: '16px',
                          background: 'linear-gradient(to bottom, #FAFBFC, #F5F5F7)',
                          borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                        }}>
                          {/* Badges Row */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexWrap: 'wrap',
                            marginBottom: '16px',
                          }}>
                            {/* Provider badge */}
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              letterSpacing: '0.3px',
                              textTransform: 'uppercase',
                              ...getProviderBadgeStyle(calendar.provider as Provider),
                            }}>
                              {getProviderName(calendar.provider as Provider)}
                            </span>
                            {calendar.isPrimary && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase',
                                background: 'rgba(147, 51, 234, 0.1)',
                                color: '#9333EA',
                              }}>
                                Primary
                              </span>
                            )}
                            {calendar.isReadOnly && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase',
                                background: 'rgba(0, 0, 0, 0.05)',
                                color: '#6B7280',
                              }}>
                                <svg style={{ width: '10px', height: '10px' }} fill="currentColor" viewBox="0 0 20 20">
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

                          {/* Info Section */}
                          <div style={{
                            background: '#fff',
                            borderRadius: '10px',
                            padding: '12px',
                            marginBottom: '12px',
                            border: '1px solid rgba(0, 0, 0, 0.06)',
                          }}>
                            {/* Owner Email */}
                            {calendar.ownerEmail && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                paddingBottom: calendar.lastSyncedAt ? '10px' : 0,
                                marginBottom: calendar.lastSyncedAt ? '10px' : 0,
                                borderBottom: calendar.lastSyncedAt ? '1px solid rgba(0, 0, 0, 0.06)' : 'none',
                              }}>
                                <svg style={{ width: '14px', height: '14px', color: '#9CA3AF', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {calendar.ownerEmail}
                                </span>
                              </div>
                            )}

                            {/* Last Synced */}
                            {calendar.lastSyncedAt && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg style={{ width: '14px', height: '14px', color: '#9CA3AF', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span style={{ fontSize: '12px', color: '#666' }}>
                                  Synced {formatRelativeTime(calendar.lastSyncedAt)}
                                </span>
                              </div>
                            )}

                            {/* Sync Error */}
                            {calendar.syncError && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '10px',
                                padding: '8px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                borderRadius: '6px',
                              }} title={calendar.syncError}>
                                <svg style={{ width: '14px', height: '14px', color: '#EF4444', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: '500' }}>
                                  Sync failed
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {/* Sync Button */}
                            {!calendar.isReadOnly && (
                              <button
                                onClick={() => handleSync(calendar)}
                                disabled={isSyncing === calendar.id}
                                style={{
                                  flex: 1,
                                  padding: '10px 16px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#fff',
                                  background: '#0066FF',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: isSyncing === calendar.id ? 'not-allowed' : 'pointer',
                                  opacity: isSyncing === calendar.id ? 0.7 : 1,
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                }}
                              >
                                {isSyncing === calendar.id ? (
                                  <>
                                    <svg style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Syncing
                                  </>
                                ) : (
                                  <>
                                    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Sync Now
                                  </>
                                )}
                              </button>
                            )}

                            {/* Disconnect Button */}
                            <button
                              onClick={() => handleDisconnectClick(calendar)}
                              style={{
                                padding: '10px 16px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#DC2626',
                                background: 'transparent',
                                border: '1px solid rgba(220, 38, 38, 0.3)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                (e.target as HTMLButtonElement).style.background = 'rgba(220, 38, 38, 0.08)';
                              }}
                              onMouseLeave={(e) => {
                                (e.target as HTMLButtonElement).style.background = 'transparent';
                              }}
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
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px dashed #D1D5DB',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#666',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
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

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
