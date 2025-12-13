import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCalendars } from '../hooks/calendar/useCalendars';
import useAuthStore from '../utils/authStore';
import CalendarSidebar from '../components/calendar/CalendarSidebar';
import UnifiedCalendarView from '../components/calendar/UnifiedCalendarView';
import ConnectCalendarModal from '../components/calendar/ConnectCalendarModal';
import CreateEventButton from '../components/calendar/CreateEventButton';
import CreateEventModal from '../components/calendar/CreateEventModal';
import EventDetailsModal from '../components/calendar/EventDetailsModal';
import type { CalendarEvent } from '../api/calendar/calendar';
import type { FreeSlot } from '../api/calendar/users';
import LiveClock from '../components/calendar/LiveClock';
import { useIsMobile } from '../hooks/useIsMobile';

/**
 * Calendar page - matches Dashboard styling exactly
 * Uses React Query for data caching - no loading on subsequent visits
 */
export default function CalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const { calendars, isLoading, error, fetchCalendars } = useCalendars();
  const isMobile = useIsMobile(768);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Multi-user calendar state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [freeTimeSlots, setFreeTimeSlots] = useState<FreeSlot[] | null>(null);
  const currentUserId = String(useAuthStore.getState().user?.id || '');

  // Handle navigation state from dashboard preview click
  useEffect(() => {
    const state = location.state as { selectedEventId?: string; eventDate?: string } | null;
    if (state?.selectedEventId) {
      setSelectedEventId(state.selectedEventId);
      // Clear the state to prevent re-opening on refresh
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

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
          padding: isMobile ? '12px 16px' : '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/alon-logo.png"
              alt="Alon"
              style={{ height: isMobile ? '28px' : '36px', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard')}
            />
          </div>

          {/* Mobile: Hamburger Menu Button */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Create Event Button - always visible on mobile */}
              <button
                onClick={() => setShowCreateEventModal(true)}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#fff',
                  background: '#0066FF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '16px' }}>+</span>
              </button>

              {/* Hamburger Menu */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{
                  padding: '8px',
                  background: 'transparent',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                  {mobileMenuOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <>
                      <path d="M3 12h18M3 6h18M3 18h18" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          )}

          {/* Desktop: Full Navigation */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Chat Button */}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat
              </button>

              {/* Tasks Button */}
              <button
                onClick={() => navigate('/tasks')}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
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
                  cursor: 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
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
          )}
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobile && mobileMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            padding: '16px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 100,
          }}>
            <button
              onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '500',
                color: '#333',
                background: '#F3F4F6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              💬 Chat
            </button>
            <button
              onClick={() => { navigate('/tasks'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '500',
                color: '#333',
                background: '#F3F4F6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              ✅ Tasks
            </button>
            <button
              onClick={() => { setIsSidebarCollapsed(!isSidebarCollapsed); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '500',
                color: '#333',
                background: '#F3F4F6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              📅 Calendars
            </button>
            <button
              onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '500',
                color: '#333',
                background: '#F3F4F6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              👤 Profile
            </button>
            <button
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '500',
                color: '#DC2626',
                background: '#FEE2E2',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              🚪 Logout
            </button>
          </div>
        )}
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

        {/* Main Content Area */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          minWidth: 0, // Prevent flex item from overflowing
          background: '#F5F5F7',
        }}>
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: isMobile ? '12px' : '16px',
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
                  marginBottom: isMobile ? '12px' : '16px',
                  flexShrink: 0,
                }}>
                  <LiveClock />
                  {/* Hide create button on mobile - it's in the navbar */}
                  {!isMobile && <CreateEventButton onClick={() => setShowCreateEventModal(true)} />}
                </div>

                {/* Unified Calendar View */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <UnifiedCalendarView
                    key={refreshKey}
                    onEventClick={handleEventClick}
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
