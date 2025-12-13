import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCalendars } from '../hooks/calendar/useCalendars';
import useAuthStore from '../utils/authStore';
import CalendarSidebar from '../components/calendar/CalendarSidebar';
import UnifiedCalendarView from '../components/calendar/UnifiedCalendarView';
import ConnectCalendarModal from '../components/calendar/ConnectCalendarModal';
import CreateEventModal from '../components/calendar/CreateEventModal';
import EventDetailsModal from '../components/calendar/EventDetailsModal';
import type { CalendarEvent } from '../api/calendar/calendar';
import type { FreeSlot } from '../api/calendar/users';
import { useIsMobile } from '../hooks/useIsMobile';

// Constants for auto-sync throttling
const SYNC_THROTTLE_KEY = 'calendar_last_auto_sync';
const SYNC_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes minimum between auto-syncs

/**
 * Calendar page - matches Dashboard styling exactly
 * Uses React Query for data caching - no loading on subsequent visits
 */
export default function CalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const { calendars, isLoading, error, fetchCalendars, syncAllCalendars, isSyncingAll } = useCalendars();
  const isMobile = useIsMobile(768);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Mobile view state: 'calendar' shows the calendar grid, 'calendars' shows the calendars list
  const [mobileView, setMobileView] = useState<'calendar' | 'calendars'>('calendar');
  // Multi-user calendar state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [freeTimeSlots, setFreeTimeSlots] = useState<FreeSlot[] | null>(null);
  const currentUserId = String(useAuthStore.getState().user?.id || '');

  // Track if auto-sync has been attempted this mount
  const autoSyncAttempted = useRef(false);

  // Auto-sync calendars on page mount (throttled to once every 5 minutes)
  useEffect(() => {
    // Only attempt once per mount
    if (autoSyncAttempted.current) return;
    autoSyncAttempted.current = true;

    // Check if we should sync based on throttle
    const lastSyncTime = localStorage.getItem(SYNC_THROTTLE_KEY);
    const now = Date.now();

    if (lastSyncTime) {
      const timeSinceLastSync = now - parseInt(lastSyncTime, 10);
      if (timeSinceLastSync < SYNC_THROTTLE_MS) {
        // Skip sync - too recent
        return;
      }
    }

    // Trigger sync in background (don't block UI)
    syncAllCalendars()
      .then(() => {
        localStorage.setItem(SYNC_THROTTLE_KEY, String(Date.now()));
        setRefreshKey((prev) => prev + 1);
      })
      .catch((err) => {
        console.error('Auto-sync failed:', err);
        // Don't update throttle time on failure so retry happens sooner
      });
  }, [syncAllCalendars]);

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* Minimal Navbar - Matching Dashboard exactly */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #eee',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: isMobile ? '12px 16px' : '12px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/alon-logo.png"
              alt="Alon"
              style={{ height: isMobile ? '32px' : '40px', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard')}
            />
          </div>

          {/* Mobile: Menu Button */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Create Event Button */}
              <button
                onClick={() => setShowCreateEventModal(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#000',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                + New
              </button>

              {/* Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{
                  padding: '8px',
                  background: 'transparent',
                  border: '1px solid #eee',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5">
                  {mobileMenuOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  )}
                </svg>
              </button>
            </div>
          )}

          {/* Desktop: Navigation */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Chat
              </button>

              <button
                onClick={() => navigate('/tasks')}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Tasks
              </button>

              {/* Calendar Button (active) with sync indicator */}
              <button
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#000',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Calendar
                {isSyncingAll && (
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid #ddd',
                      borderTop: '2px solid #666',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                    title="Syncing calendars..."
                  />
                )}
              </button>

              <button
                onClick={() => navigate('/profile')}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Profile
              </button>

              <div style={{ width: '1px', height: '20px', background: '#eee', margin: '0 8px' }} />

              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
            background: '#fff',
            padding: '8px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}>
            <button
              onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Chat
            </button>
            <button
              onClick={() => { navigate('/tasks'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Tasks
            </button>
            <button
              onClick={() => { setMobileView('calendar'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: mobileView === 'calendar' ? '#000' : '#333',
                background: mobileView === 'calendar' ? '#f5f5f5' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Calendar
              {isSyncingAll && (
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid #ddd',
                    borderTop: '2px solid #666',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                  title="Syncing calendars..."
                />
              )}
            </button>
            <button
              onClick={() => { setMobileView('calendars'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: mobileView === 'calendars' ? '#000' : '#333',
                background: mobileView === 'calendars' ? '#f5f5f5' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Calendars
            </button>
            <button
              onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Profile
            </button>
            <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
            <button
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#999',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Logout
            </button>
          </div>
        )}
      </nav>

      {/* Main Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar - Only show on desktop when calendars are loaded */}
        {!isMobile && !isLoading && calendars.length > 0 && (
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

        {/* Mobile Calendars View - Full page list of calendars */}
        {isMobile && mobileView === 'calendars' && (
          <main style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            minWidth: 0,
            background: '#fff',
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
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid #eee',
                    borderTop: '2px solid #000',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                }}>
                  <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Failed to load calendars</p>
                  <button
                    onClick={() => fetchCalendars()}
                    style={{
                      background: '#f5f5f5',
                      color: '#000',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && calendars.length === 0 && (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#000', fontSize: '15px', fontWeight: '500', margin: '0 0 4px 0' }}>
                      No calendars connected
                    </p>
                    <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
                      Connect a calendar to see your events
                    </p>
                  </div>
                  <button
                    onClick={handleOpenConnectModal}
                    style={{
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Connect Calendar
                  </button>
                </div>
              )}

              {/* Mobile Calendars List */}
              {!isLoading && !error && calendars.length > 0 && (
                <CalendarSidebar
                  calendars={calendars}
                  isCollapsed={false}
                  onToggle={() => {}}
                  currentUserId={currentUserId}
                  selectedUserIds={selectedUserIds}
                  onUserSelectionChange={setSelectedUserIds}
                  onFreeTimeSlotsChange={setFreeTimeSlots}
                  isMobileFullPage={true}
                />
              )}
            </div>
          </main>
        )}

        {/* Main Content Area - Calendar Grid */}
        {(!isMobile || mobileView === 'calendar') && (
          <main style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            minWidth: 0,
            background: '#fff',
          }}>
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: isMobile ? '16px' : '24px',
            }}>
              {/* Loading State - minimal */}
              {isLoading && (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid #eee',
                    borderTop: '2px solid #000',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                </div>
              )}

              {/* Error State - minimal */}
              {error && !isLoading && (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                }}>
                  <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Failed to load calendars</p>
                  <button
                    onClick={() => fetchCalendars()}
                    style={{
                      background: '#f5f5f5',
                      color: '#000',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#eee'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty State - No calendars connected */}
              {!isLoading && !error && calendars.length === 0 && (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#000', fontSize: '15px', fontWeight: '500', margin: '0 0 4px 0' }}>
                      No calendars connected
                    </p>
                    <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
                      Connect a calendar to see your events
                    </p>
                  </div>
                  <button
                    onClick={handleOpenConnectModal}
                    style={{
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#000'}
                  >
                    Connect Calendar
                  </button>
                </div>
              )}

              {/* Calendar View - Show when calendars are connected */}
              {!isLoading && !error && calendars.length > 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <UnifiedCalendarView
                    key={refreshKey}
                    onEventClick={handleEventClick}
                    freeSlots={freeTimeSlots}
                    onCreateEvent={() => setShowCreateEventModal(true)}
                  />
                </div>
              )}
            </div>
          </main>
        )}
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
