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
  PROVIDER_HEX_COLORS,
} from '../../utils/calendar/calendarColors';

// Preset colors for calendar color picker
const PRESET_COLORS = [
  '#4285F4', // Google Blue
  '#0078D4', // Microsoft Blue
  '#9333EA', // Purple
  '#DC2626', // Red
  '#EA4335', // Google Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#8B5CF6', // Violet
  '#6B7280', // Gray
  '#78716C', // Warm Gray
  '#000000', // Black
];

interface CalendarSidebarProps {
  calendars: Calendar[];
  isCollapsed: boolean;
  onToggle: () => void;
  currentUserId: string;
  selectedUserIds: string[];
  onUserSelectionChange: (userIds: string[]) => void;
  onFreeTimeSlotsChange: (slots: FreeSlot[] | null) => void;
  /** When true, renders as a full-page view instead of a sidebar (for mobile calendars tab) */
  isMobileFullPage?: boolean;
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
  isMobileFullPage = false,
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
  const { disconnectCalendar, syncCalendar, updateCalendarColor, isUpdatingColor } = useCalendars();
  const { success, error: showError } = useToast();
  const [updatingColorId, setUpdatingColorId] = useState<string | null>(null);

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

  const handleColorChange = async (calendar: Calendar, color: string) => {
    setUpdatingColorId(calendar.id);
    try {
      await updateCalendarColor(calendar.id, color);
      success('Calendar color updated');
    } catch (error) {
      console.error('Failed to update calendar color:', error);
      showError('Failed to update calendar color');
    } finally {
      setUpdatingColorId(null);
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

  // Mobile full page view - render as a simple list without sidebar chrome
  if (isMobileFullPage) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: '600', color: '#000' }}>Calendars</span>
              <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#666',
                background: '#f5f5f5',
                padding: '2px 8px',
                borderRadius: '10px',
              }}>
                {calendars.length}
              </span>
            </div>
          </div>

          {/* Calendar Items */}
          {calendars.map((calendar) => {
            const calColor = getCalendarColor(calendar.calendarColor, calendar.provider as Provider);
            return (
              <div
                key={calendar.id}
                style={{
                  background: '#fafafa',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {/* Calendar Header */}
                <button
                  onClick={() => handleCalendarClick(calendar.id)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: '4px',
                    height: '24px',
                    borderRadius: '2px',
                    background: calColor,
                    flexShrink: 0,
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '15px',
                      fontWeight: '500',
                      color: '#333',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }} title={calendar.calendarName}>
                      {calendar.calendarName}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: getStatusColor(calendar),
                          animation: calendar.isSyncing ? 'pulse 2s infinite' : 'none',
                        }}
                      />
                      <span style={{ fontSize: '13px', color: '#999' }}>
                        {calendar.isSyncing ? 'Syncing...' : calendar.isConnected ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <svg
                    style={{
                      width: '16px',
                      height: '16px',
                      color: '#999',
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
                    padding: '14px',
                    background: '#fff',
                    borderTop: '1px solid #eee',
                  }}>
                    {/* Color Picker */}
                    <div style={{ marginBottom: '14px' }}>
                      <p style={{ fontSize: '12px', fontWeight: '500', color: '#666', marginBottom: '8px' }}>
                        Calendar Color
                      </p>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(8, 1fr)',
                        gap: '6px',
                      }}>
                        {PRESET_COLORS.map((color) => {
                          const isSelected = calColor.toUpperCase() === color.toUpperCase();
                          const isUpdating = updatingColorId === calendar.id;
                          return (
                            <button
                              key={color}
                              onClick={() => !isUpdating && handleColorChange(calendar, color)}
                              disabled={isUpdating}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: color,
                                border: isSelected ? '2px solid #000' : '2px solid transparent',
                                cursor: isUpdating ? 'wait' : 'pointer',
                                opacity: isUpdating ? 0.5 : 1,
                                boxShadow: isSelected ? '0 0 0 2px #fff, 0 0 0 4px #000' : 'none',
                                transition: 'transform 0.1s, box-shadow 0.1s',
                              }}
                              title={color}
                              onMouseEnter={(e) => {
                                if (!isUpdating) e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            />
                          );
                        })}
                      </div>
                      {updatingColorId === calendar.id && (
                        <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                          Updating...
                        </p>
                      )}
                    </div>

                    {/* Info Row */}
                    <div style={{ marginBottom: '14px' }}>
                      {calendar.ownerEmail && (
                        <p style={{ fontSize: '13px', color: '#999', margin: '0 0 4px 0' }}>
                          {calendar.ownerEmail}
                        </p>
                      )}
                      {calendar.lastSyncedAt && (
                        <p style={{ fontSize: '13px', color: '#999', margin: 0 }}>
                          Synced {formatRelativeTime(calendar.lastSyncedAt)}
                        </p>
                      )}
                      {calendar.syncError && (
                        <p style={{ fontSize: '13px', color: '#DC2626', margin: '4px 0 0 0' }}>
                          Sync failed
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!calendar.isReadOnly && (
                        <button
                          onClick={() => handleSync(calendar)}
                          disabled={isSyncing === calendar.id}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#000',
                            background: '#f5f5f5',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: isSyncing === calendar.id ? 'not-allowed' : 'pointer',
                            opacity: isSyncing === calendar.id ? 0.7 : 1,
                          }}
                        >
                          {isSyncing === calendar.id ? 'Syncing...' : 'Sync'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDisconnectClick(calendar)}
                        style={{
                          padding: '10px 14px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#999',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
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
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '500',
              color: '#666',
              background: '#fafafa',
              cursor: 'pointer',
            }}
          >
            + Add calendar
          </button>

          {/* Team Section */}
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #eee',
          }}>
            <button
              onClick={() => setShowTeamSection(!showTeamSection)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Team
              </span>
              <svg
                style={{
                  width: '16px',
                  height: '16px',
                  color: '#999',
                  transform: showTeamSection ? 'rotate(180deg)' : 'none',
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showTeamSection && (
              <div style={{ marginTop: '12px' }}>
                {filteredTeamUsers.length === 0 ? (
                  <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>
                    No team members
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '12px' }}>
                      {filteredTeamUsers.map(user => (
                        <label
                          key={user.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: selectedUserIds.includes(String(user.id)) ? '#f5f5f5' : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(String(user.id))}
                            onChange={() => toggleUserSelection(String(user.id))}
                            style={{ accentColor: '#000', cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                          <span style={{
                            fontSize: '15px',
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

                    <button
                      onClick={handleFindFreeTime}
                      disabled={findFreeTimes.isPending}
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '15px',
                        fontWeight: '500',
                        color: '#000',
                        background: '#f5f5f5',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: findFreeTimes.isPending ? 'not-allowed' : 'pointer',
                        opacity: findFreeTimes.isPending ? 0.7 : 1,
                      }}
                    >
                      {findFreeTimes.isPending ? 'Finding...' : 'Find free time'}
                    </button>

                    {selectedUserIds.length > 0 && (
                      <button
                        onClick={clearFreeTimeSlots}
                        style={{
                          width: '100%',
                          marginTop: '8px',
                          padding: '8px',
                          fontSize: '14px',
                          color: '#999',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

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
        `}</style>
      </>
    );
  }

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
          background: '#fff',
          borderRight: '1px solid #eee',
          transition: 'width 0.3s ease-in-out',
          zIndex: isMobile ? 50 : 1,
          width: isCollapsed ? '56px' : '260px',
          minWidth: isCollapsed ? '56px' : '260px',
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
            padding: isCollapsed ? '12px' : '16px 20px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            gap: '12px',
          }}>
            {!isCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#000', letterSpacing: '-0.01em' }}>Calendars</span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: '#f5f5f5',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  marginLeft: '8px',
                }}>
                  {calendars.length}
                </span>
              </div>
            )}

            {/* Toggle Button */}
            <button
              onClick={onToggle}
              style={{
                padding: '6px',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                style={{
                  width: '16px',
                  height: '16px',
                  color: '#666',
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
              <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                {calendars.map((calendar) => {
                  const calColor = getCalendarColor(calendar.calendarColor, calendar.provider as Provider);
                  return (
                    <button
                      key={calendar.id}
                      onClick={() => handleCalendarClick(calendar.id)}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        background: '#fafafa',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fafafa'}
                      aria-label={calendar.calendarName}
                      title={calendar.calendarName}
                    >
                      {/* Status indicator */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '-1px',
                          right: '-1px',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          border: '2px solid #fff',
                          background: getStatusColor(calendar),
                          animation: calendar.isSyncing ? 'pulse 2s infinite' : 'none',
                        }}
                      />

                      {/* Calendar color dot */}
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
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
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px dashed #ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  aria-label="Connect calendar"
                  title="Connect calendar"
                >
                  <svg style={{ width: '16px', height: '16px', color: '#999' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ) : (
              // Expanded view: Show full calendar details
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Calendar Items */}
                {calendars.map((calendar) => {
                  const calColor = getCalendarColor(calendar.calendarColor, calendar.provider as Provider);
                  return (
                    <div
                      key={calendar.id}
                      style={{
                        background: '#fafafa',
                        borderRadius: '8px',
                        overflow: 'hidden',
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
                        }}
                      >
                        <div style={{
                          width: '3px',
                          height: '18px',
                          borderRadius: '2px',
                          background: calColor,
                          flexShrink: 0,
                        }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#333',
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
                            <span style={{ fontSize: '12px', color: '#999' }}>
                              {calendar.isSyncing ? 'Syncing...' : calendar.isConnected ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>

                        <svg
                          style={{
                            width: '14px',
                            height: '14px',
                            color: '#999',
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
                          padding: '12px',
                          background: '#fff',
                          borderTop: '1px solid #eee',
                        }}>
                          {/* Color Picker */}
                          <div style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '500', color: '#666', marginBottom: '6px' }}>
                              Calendar Color
                            </p>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(8, 1fr)',
                              gap: '4px',
                            }}>
                              {PRESET_COLORS.map((color) => {
                                const isSelected = calColor.toUpperCase() === color.toUpperCase();
                                const isUpdating = updatingColorId === calendar.id;
                                return (
                                  <button
                                    key={color}
                                    onClick={() => !isUpdating && handleColorChange(calendar, color)}
                                    disabled={isUpdating}
                                    style={{
                                      width: '22px',
                                      height: '22px',
                                      borderRadius: '4px',
                                      background: color,
                                      border: isSelected ? '2px solid #000' : '2px solid transparent',
                                      cursor: isUpdating ? 'wait' : 'pointer',
                                      opacity: isUpdating ? 0.5 : 1,
                                      boxShadow: isSelected ? '0 0 0 1px #fff, 0 0 0 2px #000' : 'none',
                                      transition: 'transform 0.1s, box-shadow 0.1s',
                                    }}
                                    title={color}
                                    onMouseEnter={(e) => {
                                      if (!isUpdating) e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                  />
                                );
                              })}
                            </div>
                            {updatingColorId === calendar.id && (
                              <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                Updating...
                              </p>
                            )}
                          </div>

                          {/* Info Row */}
                          <div style={{ marginBottom: '12px' }}>
                            {calendar.ownerEmail && (
                              <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px 0' }}>
                                {calendar.ownerEmail}
                              </p>
                            )}
                            {calendar.lastSyncedAt && (
                              <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
                                Synced {formatRelativeTime(calendar.lastSyncedAt)}
                              </p>
                            )}
                            {calendar.syncError && (
                              <p style={{ fontSize: '12px', color: '#DC2626', margin: '4px 0 0 0' }}>
                                Sync failed
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {!calendar.isReadOnly && (
                              <button
                                onClick={() => handleSync(calendar)}
                                disabled={isSyncing === calendar.id}
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  color: '#000',
                                  background: '#f5f5f5',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: isSyncing === calendar.id ? 'not-allowed' : 'pointer',
                                  opacity: isSyncing === calendar.id ? 0.7 : 1,
                                }}
                              >
                                {isSyncing === calendar.id ? 'Syncing...' : 'Sync'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDisconnectClick(calendar)}
                              style={{
                                padding: '8px 12px',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#999',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#666'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
                            >
                              Remove
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
                    padding: '8px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#666',
                    background: '#fafafa',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fafafa'}
                >
                  + Add calendar
                </button>

                {/* Team Section */}
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #eee',
                }}>
                  <button
                    onClick={() => setShowTeamSection(!showTeamSection)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Team
                    </span>
                    <svg
                      style={{
                        width: '14px',
                        height: '14px',
                        color: '#999',
                        transform: showTeamSection ? 'rotate(180deg)' : 'none',
                      }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showTeamSection && (
                    <div style={{ marginTop: '12px' }}>
                      {filteredTeamUsers.length === 0 ? (
                        <p style={{ fontSize: '13px', color: '#999', margin: 0 }}>
                          No team members
                        </p>
                      ) : (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '12px' }}>
                            {filteredTeamUsers.map(user => (
                              <label
                                key={user.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  background: selectedUserIds.includes(String(user.id)) ? '#f5f5f5' : 'transparent',
                                }}
                                onMouseEnter={(e) => { if (!selectedUserIds.includes(String(user.id))) e.currentTarget.style.background = '#fafafa'; }}
                                onMouseLeave={(e) => { if (!selectedUserIds.includes(String(user.id))) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedUserIds.includes(String(user.id))}
                                  onChange={() => toggleUserSelection(String(user.id))}
                                  style={{ accentColor: '#000', cursor: 'pointer' }}
                                />
                                <span style={{
                                  fontSize: '14px',
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

                          <button
                            onClick={handleFindFreeTime}
                            disabled={findFreeTimes.isPending}
                            style={{
                              width: '100%',
                              padding: '8px',
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#000',
                              background: '#f5f5f5',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: findFreeTimes.isPending ? 'not-allowed' : 'pointer',
                              opacity: findFreeTimes.isPending ? 0.7 : 1,
                            }}
                            onMouseEnter={(e) => { if (!findFreeTimes.isPending) e.currentTarget.style.background = '#eee'; }}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                          >
                            {findFreeTimes.isPending ? 'Finding...' : 'Find free time'}
                          </button>

                          {selectedUserIds.length > 0 && (
                            <button
                              onClick={clearFreeTimeSlots}
                              style={{
                                width: '100%',
                                marginTop: '8px',
                                padding: '6px',
                                fontSize: '13px',
                                color: '#999',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#666'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
                            >
                              Clear
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
