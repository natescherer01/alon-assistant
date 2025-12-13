import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../utils/authStore';
import { tasksAPI } from '../api/client';
import { queryKeys } from '../lib/queryKeys';
import ChatInterface from '../components/ChatInterface';
import { useIsMobile } from '../hooks/useIsMobile';
import calendarApi from '../api/calendar/calendar';

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();
  const isMobile = useIsMobile(768);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch tasks for preview
  const { data: allTasks = [] } = useQuery({
    queryKey: queryKeys.tasks.list({ listType: 'all', days: 7 }),
    queryFn: () => tasksAPI.getTasks('all', 7),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch next task
  const { data: nextTask = null } = useQuery({
    queryKey: queryKeys.tasks.next(null),
    queryFn: () => tasksAPI.getNextTask(),
    staleTime: 1 * 60 * 1000,
  });

  // Fetch calendar events for today and upcoming
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: calendarEvents = [] } = useQuery({
    queryKey: queryKeys.calendar.eventsForRange(
      today.toISOString().split('T')[0],
      weekEnd.toISOString().split('T')[0]
    ),
    queryFn: () => calendarApi.getEvents(today, weekEnd),
    staleTime: 5 * 60 * 1000,
  });

  // Get active tasks count
  const activeTasks = useMemo(() => {
    return allTasks.filter(t => t.status !== 'completed' && t.status !== 'deleted');
  }, [allTasks]);

  // Get today's events
  const todayEvents = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    return calendarEvents
      .filter(event => {
        const eventDate = new Date(event.startTime).toISOString().split('T')[0];
        return eventDate === todayStr;
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .slice(0, 5);
  }, [calendarEvents]);

  // Get upcoming events (next 7 days, excluding today)
  const upcomingEvents = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    return calendarEvents
      .filter(event => {
        const eventDate = new Date(event.startTime).toISOString().split('T')[0];
        return eventDate > todayStr;
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .slice(0, 3);
  }, [calendarEvents]);

  const handleTaskUpdate = (updatedTask = null, taskId = null, action = 'update') => {
    if (updatedTask || taskId) {
      queryClient.setQueryData(
        queryKeys.tasks.list({ listType: 'all', days: 7 }),
        (prevTasks = []) => {
          if (action === 'delete') {
            return prevTasks.filter(t => t.id !== taskId);
          } else if (action === 'add') {
            return [...prevTasks, updatedTask];
          } else if (action === 'update' || action === 'complete' || action === 'restore') {
            const taskExists = prevTasks.some(t => t.id === updatedTask.id);
            if (taskExists) {
              return prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
            } else {
              return [...prevTasks, updatedTask];
            }
          }
          return prevTasks;
        }
      );

      if (action === 'delete' || updatedTask?.status !== 'completed') {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.next(null) });
      }
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Format time for events
  const formatEventTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Format date for events
  const formatEventDate = (dateStr) => {
    const date = new Date(dateStr);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Get status color for tasks
  const getStatusColor = (status) => {
    switch (status) {
      case 'in_progress': return '#0066FF';
      case 'waiting_on': return '#F59E0B';
      case 'completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  // Get provider icon for calendar
  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'GOOGLE': return '🔴';
      case 'MICROSOFT': return '🔵';
      case 'ICS': return '📅';
      default: return '📅';
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F5F7' }}>
      {/* Glassmorphism Navbar */}
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
        <div className="navbar-container" style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: isMobile ? '12px 16px' : '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <img
              src="/alon-logo.png"
              alt="Alon"
              style={{
                height: isMobile ? '28px' : '36px',
              }}
            />
          </div>

          {/* Mobile: Hamburger Menu Button */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Toggle Sidebar Button */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#fff',
                  background: '#0066FF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                {sidebarCollapsed ? 'Show' : 'Hide'}
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
              {/* Chat Button - Active state since we're on chat page */}
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Tasks
              </button>

              {/* Calendar Button */}
              <button
                onClick={() => navigate('/calendar')}
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
                  e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
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
                  e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
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
                  e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
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
          }}>
            <button
              onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '500',
                color: '#fff',
                background: '#0066FF',
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
              onClick={() => { navigate('/calendar'); setMobileMenuOpen(false); }}
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
              📅 Calendar
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

      {/* Main Content - Chat with Right Sidebar */}
      <main style={{
        flex: 1,
        display: 'flex',
        maxWidth: '1600px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '0' : '0 24px',
        gap: '24px',
        overflow: 'auto',
      }}>
        {/* Chat Section - Takes most of the space */}
        <div style={{
          flex: 1,
          height: isMobile ? 'calc(100vh - 64px)' : 'calc(100vh - 88px)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}>
          <ChatInterface onTaskUpdate={handleTaskUpdate} />
        </div>

        {/* Right Sidebar - Task & Calendar Preview */}
        {!isMobile && !sidebarCollapsed && (
          <aside style={{
            width: '320px',
            flexShrink: 0,
            height: 'calc(100vh - 88px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '16px 0',
          }}>
            {/* Tasks Preview Card */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: 0 }}>
                    Tasks
                  </h3>
                </div>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#fff',
                }}>
                  {activeTasks.length}
                </span>
              </div>

              {/* Next Task */}
              {nextTask && (
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#0066FF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                  }}>
                    Next Up
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.08) 0%, rgba(0, 82, 204, 0.04) 100%)',
                    borderRadius: '12px',
                    padding: '14px',
                    border: '1px solid rgba(0, 102, 255, 0.12)',
                  }}>
                    <h4 style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1a1a1a',
                      margin: '0 0 6px 0',
                      lineHeight: '1.4',
                    }}>
                      {nextTask.title}
                    </h4>
                    {nextTask.deadline && (
                      <p style={{
                        fontSize: '12px',
                        color: '#666',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {nextTask.deadline}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Task List Preview */}
              <div style={{ padding: '12px 20px 16px' }}>
                {activeTasks.length === 0 ? (
                  <p style={{
                    fontSize: '13px',
                    color: '#9CA3AF',
                    textAlign: 'center',
                    padding: '16px 0',
                    margin: 0,
                  }}>
                    No active tasks
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeTasks.slice(0, 4).map((task) => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          background: '#F9FAFB',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onClick={() => navigate('/tasks')}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#F3F4F6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#F9FAFB';
                        }}
                      >
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: getStatusColor(task.status),
                          marginTop: '5px',
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#1a1a1a',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {task.title}
                          </p>
                          {task.deadline && (
                            <p style={{
                              fontSize: '11px',
                              color: '#9CA3AF',
                              margin: '2px 0 0 0',
                            }}>
                              Due: {task.deadline}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* View All Link */}
                <button
                  onClick={() => navigate('/tasks')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#0066FF',
                    background: 'transparent',
                    border: '1px solid rgba(0, 102, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(0, 102, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                  }}
                >
                  View All Tasks →
                </button>
              </div>
            </div>

            {/* Calendar Preview Card */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #4040B0 0%, #00D4DD 100%)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: 0 }}>
                    Calendar
                  </h3>
                </div>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#fff',
                }}>
                  {todayEvents.length} today
                </span>
              </div>

              {/* Today's Events */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#4040B0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                }}>
                  Today
                </div>

                {todayEvents.length === 0 ? (
                  <p style={{
                    fontSize: '13px',
                    color: '#9CA3AF',
                    textAlign: 'center',
                    padding: '16px 0',
                    margin: 0,
                  }}>
                    No events today
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {todayEvents.map((event) => (
                      <div
                        key={event.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          background: '#F9FAFB',
                          borderRadius: '10px',
                          borderLeft: `3px solid ${event.calendarColor || '#00D4DD'}`,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#1a1a1a',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {event.title}
                          </p>
                          <p style={{
                            fontSize: '11px',
                            color: '#9CA3AF',
                            margin: '2px 0 0 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            {getProviderIcon(event.provider)} {event.isAllDay ? 'All day' : formatEventTime(event.startTime)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 && (
                  <>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginTop: '16px',
                      marginBottom: '12px',
                    }}>
                      Upcoming
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {upcomingEvents.map((event) => (
                        <div
                          key={event.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '10px 12px',
                            background: '#F9FAFB',
                            borderRadius: '10px',
                            borderLeft: `3px solid ${event.calendarColor || '#6B7280'}`,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#1a1a1a',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {event.title}
                            </p>
                            <p style={{
                              fontSize: '11px',
                              color: '#9CA3AF',
                              margin: '2px 0 0 0',
                            }}>
                              {formatEventDate(event.startTime)} • {event.isAllDay ? 'All day' : formatEventTime(event.startTime)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* View All Link */}
                <button
                  onClick={() => navigate('/calendar')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '16px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#4040B0',
                    background: 'transparent',
                    border: '1px solid rgba(64, 64, 176, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(64, 64, 176, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                  }}
                >
                  View Full Calendar →
                </button>
              </div>
            </div>

            {/* Collapse Sidebar Button */}
            <button
              onClick={() => setSidebarCollapsed(true)}
              style={{
                padding: '8px',
                fontSize: '12px',
                fontWeight: '500',
                color: '#9CA3AF',
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
              onMouseEnter={(e) => {
                e.target.style.color = '#666';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#9CA3AF';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
              Hide Sidebar
            </button>
          </aside>
        )}

        {/* Collapsed Sidebar Toggle */}
        {!isMobile && sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            style={{
              position: 'fixed',
              right: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '80px',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '12px 0 0 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
          </button>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
