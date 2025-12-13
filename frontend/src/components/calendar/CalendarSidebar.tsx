import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Calendar } from '../../api/calendar/calendar';
import type { FreeSlot } from '../../api/calendar/users';
import ProviderIcon from './ProviderIcon';
import { formatRelativeTime } from '../../utils/calendar/time';
import { useCalendars } from '../../hooks/calendar/useCalendars';
import { useToast } from '../../hooks/calendar/useToast';
import { useCalendarUsers, useFindFreeTimes } from '../../hooks/calendar/useCalendarUsers';
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
  currentUserId: string;
  selectedUserIds: string[];
  onUserSelectionChange: (userIds: string[]) => void;
  onFreeTimeSlotsChange: (slots: FreeSlot[] | null) => void;
}

/**
 * Collapsible sidebar for calendar management
 * Shows minimal indicators when collapsed, full details when expanded
 */
export default function CalendarSidebar({
  calendars,
  isCollapsed,
  onToggle,
  currentUserId,
  selectedUserIds,
  onUserSelectionChange,
  onFreeTimeSlotsChange,
}: CalendarSidebarProps) {
  const [expandedCalendarId, setExpandedCalendarId] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [calendarToDisconnect, setCalendarToDisconnect] = useState<Calendar | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [showTeamSection, setShowTeamSection] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize for responsive mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { disconnectCalendar, syncCalendar } = useCalendars();
  const { success, error: showError } = useToast();

  // Team calendar hooks
  const { data: teamUsers = [] } = useCalendarUsers();
  const findFreeTimes = useFindFreeTimes();

  // Filter team users (exclude current user, only those with calendars)
  const filteredTeamUsers = useMemo(() => {
    return teamUsers
      .filter(u => String(u.id) !== String(currentUserId))
      .filter(u => u.hasCalendar);
  }, [teamUsers, currentUserId]);

  const toggleUserSelection = useCallback((userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onUserSelectionChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onUserSelectionChange([...selectedUserIds, userId]);
    }
  }, [selectedUserIds, onUserSelectionChange]);

  const handleFindFreeTime = useCallback(() => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const allUserIds = [String(currentUserId), ...selectedUserIds];

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
          onFreeTimeSlotsChange(data.freeSlots);
          success(`Found ${data.freeSlots.length} free time slots`);
        },
        onError: () => {
          showError('Failed to find free times');
        },
      }
    );
  }, [currentUserId, selectedUserIds, findFreeTimes, onFreeTimeSlotsChange, success, showError]);

  const clearFreeTimeSlots = useCallback(() => {
    onFreeTimeSlotsChange(null);
    onUserSelectionChange([]);
  }, [onFreeTimeSlotsChange, onUserSelectionChange]);

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
      {/* Mobile Overlay - Only show on mobile when expanded */}
      {!isCollapsed && isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 45,
          }}
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Part of flex layout on desktop, fixed overlay on mobile */}
      <aside
        style={{
          // Mobile: fixed overlay | Desktop: relative in flex container
          position: isMobile ? 'fixed' : 'relative',
          top: isMobile ? 0 : undefined,
          left: isMobile ? 0 : undefined,
          height: isMobile ? '100vh' : '100%',
          background: '#FAFBFC',
          borderRight: '1px solid #E5E7EB',
          transition: 'width 0.3s ease-in-out',
          zIndex: isMobile ? 50 : 1,
          width: isCollapsed ? '64px' : '280px',
          minWidth: isCollapsed ? '64px' : '280px',
          flexShrink: 0,
          // Hide sidebar completely on mobile when collapsed (accessed via hamburger menu instead)
          display: isCollapsed && isMobile ? 'none' : 'flex',
          flexDirection: 'column',
        }}
        aria-label="Calendar sidebar"
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            padding: isCollapsed ? '12px' : '16px 16px 12px 16px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            gap: '12px',
            background: '#fff',
          }}>
            {!isCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#111', margin: 0, letterSpacing: '-0.01em' }}>Calendars</h2>
                <p style={{ fontSize: '12px', color: '#888', marginTop: '2px', margin: 0 }}>
                  {calendars.length} connected
                </p>
              </div>
            )}

            {/* Toggle Button */}
            <button
              onClick={onToggle}
              style={{
                padding: '8px',
                background: isCollapsed ? '#fff' : 'rgba(0, 0, 0, 0.04)',
                border: isCollapsed ? '1px solid #E5E7EB' : 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                style={{
                  width: '18px',
                  height: '18px',
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
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {isCollapsed ? (
              // Collapsed view: Show colored dots/indicators
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                {calendars.map((calendar) => {
                  const calColor = getCalendarColor(calendar.calendarColor, calendar.provider as Provider);
                  return (
                    <button
                      key={calendar.id}
                      onClick={() => handleCalendarClick(calendar.id)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        position: 'relative',
                        background: `${calColor}20`,
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
                          top: '-2px',
                          right: '-2px',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          border: '2px solid #FAFBFC',
                          background: getStatusColor(calendar),
                          animation: calendar.isSyncing ? 'pulse 2s infinite' : 'none',
                        }}
                      />

                      {/* Calendar color dot */}
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
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
                    borderRadius: '10px',
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
                  <svg style={{ width: '18px', height: '18px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ) : (
              // Expanded view: Show full calendar details
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Provider Statistics */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
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
                        background: '#fff',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        borderLeft: `3px solid ${calColor}`,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                      }}
                    >
                      {/* Calendar Header */}
                      <button
                        onClick={() => handleCalendarClick(calendar.id)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
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
                    padding: '10px',
                    border: '1px dashed #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#888',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  + Connect Calendar
                </button>

                {/* Team Section Divider */}
                <div style={{
                  marginTop: '8px',
                  paddingTop: '12px',
                  borderTop: '1px solid #E5E7EB',
                }}>
                  {/* Team Header */}
                  <button
                    onClick={() => setShowTeamSection(!showTeamSection)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#111' }}>
                      Team
                    </span>
                    <svg
                      style={{
                        width: '16px',
                        height: '16px',
                        color: '#9CA3AF',
                        transition: 'transform 0.2s',
                        transform: showTeamSection ? 'rotate(180deg)' : 'none',
                      }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Team Content */}
                  {showTeamSection && (
                    <div style={{ marginTop: '8px' }}>
                      {filteredTeamUsers.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
                          No team members with calendars
                        </p>
                      ) : (
                        <>
                          {/* User List */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                            {filteredTeamUsers.map(user => (
                              <label
                                key={user.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  background: selectedUserIds.includes(String(user.id)) ? 'rgba(0, 102, 255, 0.08)' : 'transparent',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedUserIds.includes(String(user.id))}
                                  onChange={() => toggleUserSelection(String(user.id))}
                                  style={{ accentColor: '#0066FF', cursor: 'pointer' }}
                                />
                                <span style={{
                                  fontSize: '13px',
                                  color: '#333',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {user.fullName || user.email.split('@')[0]}
                                </span>
                              </label>
                            ))}
                          </div>

                          {/* Find Free Time Button */}
                          <button
                            onClick={handleFindFreeTime}
                            disabled={findFreeTimes.isPending}
                            style={{
                              width: '100%',
                              padding: '10px',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#fff',
                              background: findFreeTimes.isPending ? '#9CA3AF' : '#22C55E',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: findFreeTimes.isPending ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {findFreeTimes.isPending ? 'Finding...' : 'Find Free Time'}
                          </button>

                          {/* Clear Button */}
                          {selectedUserIds.length > 0 && (
                            <button
                              onClick={clearFreeTimeSlots}
                              style={{
                                width: '100%',
                                marginTop: '8px',
                                padding: '8px',
                                fontSize: '12px',
                                color: '#666',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              Clear selection
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
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
