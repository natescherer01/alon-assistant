import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCalendars } from '../hooks/calendar/useCalendars';
import useAuthStore from '../utils/authStore';
import CalendarSidebar from '../components/calendar/CalendarSidebar';
import UnifiedCalendarView from '../components/calendar/UnifiedCalendarView';
import ConnectCalendarModal from '../components/calendar/ConnectCalendarModal';
import CreateEventButton from '../components/calendar/CreateEventButton';
import CreateEventModal from '../components/calendar/CreateEventModal';
import EventDetailsModal from '../components/calendar/EventDetailsModal';
import TodaysPlanPanel from '../components/calendar/TodaysPlanPanel';
import type { CalendarEvent } from '../api/calendar/calendar';
import type { FreeSlot } from '../api/calendar/users';
import LiveClock from '../components/calendar/LiveClock';

/**
 * Calendar page - matches Dashboard styling exactly
 * Uses React Query for data caching - no loading on subsequent visits
 */
export default function CalendarPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { calendars, isLoading, error, fetchCalendars } = useCalendars();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isTodaysPlanExpanded, setIsTodaysPlanExpanded] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  // Multi-user calendar state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [freeTimeSlots, setFreeTimeSlots] = useState<FreeSlot[] | null>(null);
  const currentUserId = String(useAuthStore.getState().user?.id || '');

  // No useEffect needed - React Query automatically fetches and caches data

  const handleOpenConnectModal = () => {
    setShowConnectModal(true);
  };

  const handleCloseConnectModal = () => {
    setShowConnectModal(false);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEventId(event.id);
  };

  const handleEventCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleEventUpdated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleEventDeleted = () => {
    setRefreshKey((prev) => prev + 1);
    setSelectedEventId(null);
  };

  const handleEventsLoaded = (events: CalendarEvent[]) => {
    setCalendarEvents(events);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F5F7' }}>
      {/* Glassmorphism Navbar - Matching Dashboard exactly */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/alon-logo.png"
              alt="Alon"
              style={{ height: '36px', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard')}
            />
          </div>

          {/* User Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Tasks Button */}
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#666',
                background: 'transparent',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              Tasks
            </button>

            {/* Calendar Button (active) */}
            <button
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#fff',
                background: '#0066FF',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Calendar
            </button>

            {/* Profile Button */}
            <button
              onClick={() => navigate('/profile')}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#666',
                background: 'transparent',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              Profile
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#666',
                background: 'transparent',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar - Only show if calendars are loaded */}
        {!isLoading && calendars.length > 0 && (
          <CalendarSidebar
            calendars={calendars}
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            currentUserId={currentUserId}
            selectedUserIds={selectedUserIds}
            onUserSelectionChange={setSelectedUserIds}
            onFreeTimeSlotsChange={setFreeTimeSlots}
          />
        )}

        {/* Right Sidebar - Today's Plan Panel */}
        {!isLoading && calendars.length > 0 && (
          <TodaysPlanPanel
            events={calendarEvents}
            isExpanded={isTodaysPlanExpanded}
            onToggle={() => setIsTodaysPlanExpanded(!isTodaysPlanExpanded)}
          />
        )}

        {/* Main Content Area */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          marginLeft: !isLoading && calendars.length > 0 ? (isSidebarCollapsed ? '64px' : '288px') : '0',
          marginRight: !isLoading && calendars.length > 0 ? (isTodaysPlanExpanded ? '320px' : '48px') : '0',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
          }}>
            {/* Loading State */}
            {isLoading && (
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '48px',
                textAlign: 'center',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  border: '4px solid #F3F4F6',
                  borderTop: '4px solid #0066FF',
                  borderRadius: '50%',
                  margin: '0 auto 16px',
                  animation: 'spin 1s linear infinite',
                }} />
                <p style={{ color: '#666', margin: 0 }}>Loading calendars...</p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: '16px',
                padding: '24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ color: '#991B1B', fontWeight: '600', margin: '0 0 8px 0' }}>
                      Failed to load calendars
                    </h4>
                    <p style={{ color: '#B91C1C', fontSize: '14px', margin: '0 0 16px 0' }}>{error}</p>
                    <button
                      onClick={() => fetchCalendars()}
                      style={{
                        background: '#DC2626',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State - No calendars connected */}
            {!isLoading && !error && calendars.length === 0 && (
              <div>
                {/* Header Card - Matching Dashboard "Next Task" style */}
                <div style={{
                  background: '#0066FF',
                  borderRadius: '16px',
                  padding: '24px',
                  color: '#fff',
                  marginBottom: '24px',
                }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                    Calendar
                  </h2>
                  <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>
                    Connect your calendars to see all your events in one place.
                  </p>
                </div>

                {/* Empty State Card */}
                <div style={{
                  background: '#fff',
                  borderRadius: '16px',
                  padding: '48px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#000', margin: '0 0 8px 0' }}>
                    No calendars connected yet
                  </h3>
                  <p style={{ color: '#666', fontSize: '14px', margin: '0 0 24px 0', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Connect your Google Calendar, Microsoft Outlook, or Apple Calendar to start managing all your events in one unified view.
                  </p>
                  <button
                    onClick={handleOpenConnectModal}
                    style={{
                      background: '#0066FF',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.background = '#0052CC';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.background = '#0066FF';
                    }}
                  >
                    Connect Your First Calendar
                  </button>
                </div>
              </div>
            )}

            {/* Calendar View - Show when calendars are connected */}
            {!isLoading && !error && calendars.length > 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Header with Clock and Create Button */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  flexShrink: 0,
                }}>
                  <LiveClock />
                  <CreateEventButton onClick={() => setShowCreateEventModal(true)} />
                </div>

                {/* Unified Calendar View */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <UnifiedCalendarView
                    key={refreshKey}
                    onEventClick={handleEventClick}
                    onEventsLoaded={handleEventsLoaded}
                    freeSlots={freeTimeSlots}
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Connect Calendar Modal */}
      <ConnectCalendarModal
        isOpen={showConnectModal}
        onClose={handleCloseConnectModal}
      />

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        onSuccess={handleEventCreated}
      />

      {/* Event Details Modal */}
      {selectedEventId && (
        <EventDetailsModal
          isOpen={selectedEventId !== null}
          onClose={() => setSelectedEventId(null)}
          eventId={selectedEventId}
          onEventUpdated={handleEventUpdated}
          onEventDeleted={handleEventDeleted}
        />
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
