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

  // Get today's events (no limit for scrollable view)
  const todayEvents = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    return calendarEvents
      .filter(event => {
        const eventDate = new Date(event.startTime).toISOString().split('T')[0];
        return eventDate === todayStr;
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }, [calendarEvents]);

  // Get upcoming events (next 7 days, excluding today - no limit for scrollable view)
  const upcomingEvents = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    return calendarEvents
      .filter(event => {
        const eventDate = new Date(event.startTime).toISOString().split('T')[0];
        return eventDate > todayStr;
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
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
      case 'in_progress': return '#000';
      case 'waiting_on': return '#666';
      case 'completed': return '#999';
      default: return '#ccc';
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* Minimal Navbar */}
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
              style={{
                height: isMobile ? '32px' : '40px',
              }}
            />
          </div>

          {/* Mobile: Menu Button */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
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
                {sidebarCollapsed ? 'Show' : 'Hide'}
              </button>

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
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#000',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
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
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Tasks
              </button>

              <button
                onClick={() => navigate('/calendar')}
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
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Calendar
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
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
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
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
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
              onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#000',
                background: '#f5f5f5',
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
              onClick={() => { navigate('/calendar'); setMobileMenuOpen(false); }}
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
              Calendar
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

      {/* Main Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '0' : '0 32px',
        gap: '32px',
        overflow: 'auto',
      }}>
        {/* Chat Section */}
        <div style={{
          flex: 1,
          height: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 60px)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}>
          <ChatInterface onTaskUpdate={handleTaskUpdate} />
        </div>

        {/* Right Sidebar */}
        {!isMobile && !sidebarCollapsed && (
          <aside style={{
            width: '300px',
            flexShrink: 0,
            height: 'calc(100vh - 60px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            padding: '24px 0',
          }}>
            {/* Tasks Card */}
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #eee',
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#000', letterSpacing: '-0.01em' }}>
                  Tasks
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: '#f5f5f5',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}>
                  {activeTasks.length}
                </span>
              </div>

              {/* Next Task */}
              {nextTask && (
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #eee',
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#999',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                  }}>
                    Next
                  </div>
                  <div style={{
                    background: '#fafafa',
                    borderRadius: '8px',
                    padding: '12px',
                  }}>
                    <h4 style={{
                      fontSize: '15px',
                      fontWeight: '500',
                      color: '#000',
                      margin: '0 0 4px 0',
                      lineHeight: '1.4',
                    }}>
                      {nextTask.title}
                    </h4>
                    {nextTask.deadline && (
                      <p style={{
                        fontSize: '13px',
                        color: '#999',
                        margin: 0,
                      }}>
                        {nextTask.deadline}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Task List */}
              <div style={{ padding: '12px 20px 16px' }}>
                {activeTasks.length === 0 ? (
                  <p style={{
                    fontSize: '14px',
                    color: '#999',
                    textAlign: 'center',
                    padding: '16px 0',
                    margin: 0,
                  }}>
                    No active tasks
                  </p>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                  }}>
                    {activeTasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate('/tasks', { state: { selectedTaskId: task.id } })}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: getStatusColor(task.status),
                          flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: '14px',
                          color: '#333',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => navigate('/tasks')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '12px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#666',
                    background: '#fafafa',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#f0f0f0'}
                  onMouseLeave={(e) => e.target.style.background = '#fafafa'}
                >
                  View all
                </button>
              </div>
            </div>

            {/* Calendar Card */}
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #eee',
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#000', letterSpacing: '-0.01em' }}>
                  Calendar
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: '#f5f5f5',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}>
                  {todayEvents.length} today
                </span>
              </div>

              {/* Events */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}>
                  {/* Today */}
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#999',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                  }}>
                    Today
                  </div>

                  {todayEvents.length === 0 ? (
                    <p style={{
                      fontSize: '14px',
                      color: '#999',
                      padding: '12px 0',
                      margin: 0,
                    }}>
                      No events
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {todayEvents.map((event) => (
                        <div
                          key={event.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          onClick={() => navigate('/calendar', { state: { selectedEventId: event.id, eventDate: event.startTime } })}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{
                            width: '3px',
                            height: '18px',
                            borderRadius: '2px',
                            background: event.calendarColor || '#000',
                            flexShrink: 0,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: '14px',
                              color: '#333',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {event.title}
                            </p>
                            <p style={{
                              fontSize: '12px',
                              color: '#999',
                              margin: 0,
                            }}>
                              {event.isAllDay ? 'All day' : formatEventTime(event.startTime)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upcoming */}
                  {upcomingEvents.length > 0 && (
                    <>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#999',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginTop: '16px',
                        marginBottom: '8px',
                      }}>
                        Upcoming
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {upcomingEvents.map((event) => (
                          <div
                            key={event.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                            onClick={() => navigate('/calendar', { state: { selectedEventId: event.id, eventDate: event.startTime } })}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{
                              width: '3px',
                              height: '18px',
                              borderRadius: '2px',
                              background: event.calendarColor || '#ccc',
                              flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: '14px',
                                color: '#333',
                                margin: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {event.title}
                              </p>
                              <p style={{
                                fontSize: '12px',
                                color: '#999',
                                margin: 0,
                              }}>
                                {formatEventDate(event.startTime)} · {event.isAllDay ? 'All day' : formatEventTime(event.startTime)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => navigate('/calendar')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#666',
                    background: '#fafafa',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#f0f0f0'}
                  onMouseLeave={(e) => e.target.style.background = '#fafafa'}
                >
                  View all
                </button>
              </div>
            </div>

            {/* Hide Sidebar */}
            <button
              onClick={() => setSidebarCollapsed(true)}
              style={{
                padding: '6px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#999',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
              onMouseEnter={(e) => e.target.style.color = '#666'}
              onMouseLeave={(e) => e.target.style.color = '#999'}
            >
              Hide sidebar
            </button>
          </aside>
        )}

        {/* Collapsed Sidebar Toggle */}
        {!isMobile && sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            style={{
              position: 'fixed',
              right: '0',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '32px',
              height: '64px',
              background: '#fff',
              border: '1px solid #eee',
              borderRight: 'none',
              borderRadius: '8px 0 0 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
