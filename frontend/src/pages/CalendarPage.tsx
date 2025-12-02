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
    <div className="min-h-screen bg-light-gray flex flex-col">
      {/* Header - Matching main app style with glassmorphism */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <img
              src="/alon-logo.png"
              alt="Alon"
              className="h-9 cursor-pointer"
              onClick={() => navigate('/dashboard')}
            />
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {/* Tasks Button */}
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-transparent border border-black/10 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Tasks
            </button>
            {/* Calendar Button (active) */}
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-primary border-none rounded-lg"
            >
              Calendar
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-transparent border border-black/10 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Profile
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-transparent border border-black/10 rounded-lg hover:bg-gray-50 transition-colors"
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
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading calendars...</p>
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
                    Calendar
                  </h2>
                  <p className="text-gray-600">
                    Connect your calendars to see all your events in one place.
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
