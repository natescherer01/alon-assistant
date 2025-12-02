import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCalendars } from '../hooks/calendar/useCalendars';
import useAuthStore from '../utils/authStore';
import CalendarSidebar from '../components/calendar/CalendarSidebar';
import UnifiedCalendarView from '../components/calendar/UnifiedCalendarView';
import EmptyState from '../components/calendar/EmptyState';
import ConnectCalendarModal from '../components/calendar/ConnectCalendarModal';
import CreateEventButton from '../components/calendar/CreateEventButton';
import CreateEventModal from '../components/calendar/CreateEventModal';
import EventDetailsModal from '../components/calendar/EventDetailsModal';
import TodaysPlanPanel from '../components/calendar/TodaysPlanPanel';
import type { CalendarEvent } from '../api/calendar/calendar';
import { CalendarSkeletonGrid } from '../components/calendar/CalendarSkeleton';
import LiveClock from '../components/calendar/LiveClock';

/**
 * Main dashboard page with calendar view and collapsible sidebar
 * Primary focus: UnifiedCalendarView for viewing/managing events
 * Secondary: Collapsible sidebar for calendar connections management
 */
export default function CalendarPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { calendars, isLoading, error, fetchCalendars } = useCalendars();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isTodaysPlanExpanded, setIsTodaysPlanExpanded] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch calendars on mount
  useEffect(() => {
    fetchCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ background: '#F5F5F7' }}>
      {/* Header - Matching main app style */}
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
          {/* Logo and Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <img
              src="/alon-logo.png"
              alt="Alon"
              style={{ height: '36px', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard')}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Tasks
              </button>
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
                }}
              >
                Calendar
              </button>
            </div>
          </div>

          {/* User Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              }}
            >
              Profile
            </button>
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
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Only show if calendars are loaded */}
        {!isLoading && calendars.length > 0 && (
          <CalendarSidebar
            calendars={calendars}
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
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

        {/* Main Content Area - Add margins to account for fixed sidebars */}
        <main className={`flex-1 overflow-y-auto ${!isLoading && calendars.length > 0 ? (isSidebarCollapsed ? 'ml-16' : 'ml-72') : ''} ${!isLoading && calendars.length > 0 ? (isTodaysPlanExpanded ? 'mr-80' : 'mr-12') : ''} transition-all duration-300`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Loading State */}
            {isLoading && (
              <div className="space-y-6">
                <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
                <CalendarSkeletonGrid count={1} />
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-red-800 font-semibold mb-1">
                      Failed to load calendars
                    </h4>
                    <p className="text-red-700 text-sm mb-3">{error}</p>
                    <button
                      onClick={() => fetchCalendars()}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
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
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Welcome to Alon-Cal, {user?.name || user?.email?.split('@')[0] || 'there'}!
                  </h2>
                  <p className="text-gray-600">
                    Get started by connecting your first calendar.
                  </p>
                </div>
                <EmptyState onConnect={handleOpenConnectModal} />
              </div>
            )}

            {/* Calendar View - Show when calendars are connected */}
            {!isLoading && !error && calendars.length > 0 && (
              <div>
                {/* Clock and Create Event Button */}
                <div className="mb-4 flex justify-between items-center">
                  <LiveClock />
                  <CreateEventButton onClick={() => setShowCreateEventModal(true)} />
                </div>

                {/* Unified Calendar View */}
                <UnifiedCalendarView
                  key={refreshKey}
                  onEventClick={handleEventClick}
                  onEventsLoaded={handleEventsLoaded}
                />
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
    </div>
  );
}
