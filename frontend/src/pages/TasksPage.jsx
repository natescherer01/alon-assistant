import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../utils/authStore';
import { tasksAPI } from '../api/client';
import { queryKeys } from '../lib/queryKeys';
import TaskItem from '../components/TaskItem';
import AddTaskForm from '../components/AddTaskForm';
import { useIsMobile } from '../hooks/useIsMobile';

function TasksPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();
  const isMobile = useIsMobile(768);

  const [filter, setFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingTasks, setSavingTasks] = useState(new Set());
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const taskRefs = useRef({});

  // Use React Query
  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: queryKeys.tasks.list({ listType: 'all', days: 7 }),
    queryFn: () => tasksAPI.getTasks('all', 7),
    staleTime: 2 * 60 * 1000,
  });

  const { data: nextTask = null } = useQuery({
    queryKey: queryKeys.tasks.next(null),
    queryFn: () => tasksAPI.getNextTask(),
    staleTime: 1 * 60 * 1000,
  });

  // Extract unique projects from tasks
  const projects = useMemo(() => {
    return [...new Set(allTasks.map(t => t.project).filter(p => p))];
  }, [allTasks]);

  const sortTasksByDeadline = (tasksToSort) => {
    return [...tasksToSort].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
  };

  const filterTasksBySearch = (tasksToFilter) => {
    if (!searchQuery.trim()) return tasksToFilter;

    const query = searchQuery.toLowerCase();
    return tasksToFilter.filter((task) => {
      const titleMatch = task.title?.toLowerCase().includes(query);
      const descriptionMatch = task.description?.toLowerCase().includes(query);
      const projectMatch = task.project?.toLowerCase().includes(query);
      const waitingOnMatch = task.waiting_on?.toLowerCase().includes(query);

      return titleMatch || descriptionMatch || projectMatch || waitingOnMatch;
    });
  };

  const handleTaskUpdate = (updatedTask = null, taskId = null, action = 'update') => {
    if (updatedTask || taskId) {
      setError(null);

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

  const handleError = (message, taskId = null) => {
    setError({ message, taskId });
    setTimeout(() => setError(null), 5000);
  };

  const markTaskSaving = (taskId, isSaving) => {
    setSavingTasks(prev => {
      const next = new Set(prev);
      if (isSaving) {
        next.add(taskId);
        setTimeout(() => {
          setSavingTasks(current => {
            if (current.has(taskId)) {
              const updated = new Set(current);
              updated.delete(taskId);
              return updated;
            }
            return current;
          });
        }, 10000);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Client-side filtering
  const displayedTasks = useMemo(() => {
    let filtered = allTasks;

    switch (filter) {
      case 'all':
        filtered = filtered.filter(t => t.status !== 'completed' && t.status !== 'deleted');
        break;
      case 'waiting':
        filtered = filtered.filter(t => t.status === 'waiting_on');
        break;
      case 'upcoming':
        filtered = filtered.filter(t => t.deadline && t.status !== 'completed' && t.status !== 'deleted');
        break;
      case 'completed':
        filtered = filtered.filter(t => t.status === 'completed');
        break;
      case 'deleted':
        filtered = filtered.filter(t => t.status === 'deleted');
        break;
      default:
        filtered = filtered.filter(t => t.status !== 'completed' && t.status !== 'deleted');
    }

    if (projectFilter !== 'all') {
      filtered = filtered.filter(t => t.project === projectFilter);
    }

    const sorted = sortTasksByDeadline(filtered);
    return filterTasksBySearch(sorted);
  }, [allTasks, filter, projectFilter, searchQuery]);

  // Clean up saving states
  useEffect(() => {
    const displayedTaskIds = new Set(displayedTasks.map(t => t.id));
    setSavingTasks(prevSaving => {
      const newSaving = new Set(prevSaving);
      let hasChanges = false;

      prevSaving.forEach(taskId => {
        if (!displayedTaskIds.has(taskId)) {
          newSaving.delete(taskId);
          hasChanges = true;
        }
      });

      return hasChanges ? newSaving : prevSaving;
    });
  }, [displayedTasks]);

  // Handle navigation state from dashboard preview click
  useEffect(() => {
    const state = location.state;
    if (state?.selectedTaskId) {
      setHighlightedTaskId(state.selectedTaskId);
      // Clear the state to prevent re-highlighting on refresh
      navigate(location.pathname, { replace: true, state: null });

      // Scroll to the task after a short delay to ensure it's rendered
      setTimeout(() => {
        const taskElement = taskRefs.current[state.selectedTaskId];
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Remove highlight after animation
        setTimeout(() => setHighlightedTaskId(null), 2000);
      }, 100);
    }
  }, [location.state, navigate, location.pathname]);

  // Memoized counts
  const counts = useMemo(() => {
    const all = allTasks.filter((t) => t.status !== 'completed' && t.status !== 'deleted').length;
    const waiting = allTasks.filter((t) => t.status === 'waiting_on').length;
    const upcoming = allTasks.filter((t) => t.deadline && t.status !== 'completed' && t.status !== 'deleted').length;
    return { all, waiting, upcoming };
  }, [allTasks]);

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
                height: isMobile ? '24px' : '28px',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/dashboard')}
            />
          </div>

          {/* Mobile: Menu Button */}
          {isMobile && (
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
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Chat
              </button>

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
                }}
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
              onClick={() => setMobileMenuOpen(false)}
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
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '16px' : '24px 32px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 280px',
          gap: isMobile ? '16px' : '32px',
        }}>
          {/* Tasks Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Next Task - Minimalist Style */}
            {nextTask && (
              <div style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #eee',
              }}>
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
                    {nextTask.description && (
                      <p style={{
                        fontSize: '13px',
                        color: '#666',
                        margin: '0 0 4px 0',
                        lineHeight: '1.4',
                      }}>
                        {nextTask.description}
                      </p>
                    )}
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
              </div>
            )}

            {/* Add Task */}
            <AddTaskForm onTaskAdded={handleTaskUpdate} />

            {/* Search Bar - Minimalist */}
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #eee',
              padding: '12px 16px',
            }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    fontSize: '14px',
                    border: '1px solid #eee',
                    borderRadius: '6px',
                    outline: 'none',
                    background: '#fafafa',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#ccc';
                    e.target.style.background = '#fff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#eee';
                    e.target.style.background = '#fafafa';
                  }}
                />
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#999"
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#999',
                      fontSize: '16px',
                      cursor: 'pointer',
                      padding: '4px',
                      lineHeight: 1,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Task Filters - Minimalist */}
            <div style={{
              display: 'flex',
              gap: '6px',
              flexWrap: isMobile ? 'nowrap' : 'wrap',
              alignItems: 'center',
              overflowX: isMobile ? 'auto' : 'visible',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: isMobile ? '4px' : '0',
            }}>
              {[
                { key: 'all', label: 'All', count: counts.all },
                { key: 'waiting', label: 'Waiting', count: counts.waiting },
                { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
                { key: 'completed', label: 'Done', count: null },
                { key: 'deleted', label: 'Trash', count: null },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: filter === f.key ? '#000' : '#f5f5f5',
                    color: filter === f.key ? '#fff' : '#666',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (filter !== f.key) e.target.style.background = '#eee';
                  }}
                  onMouseLeave={(e) => {
                    if (filter !== f.key) e.target.style.background = '#f5f5f5';
                  }}
                >
                  {f.label}{f.count !== null ? ` (${f.count})` : ''}
                </button>
              ))}

              {/* Project Filter Dropdown */}
              {projects.length > 0 && (
                <>
                  <div style={{ width: '1px', height: '24px', background: '#eee', margin: '0 4px' }} />
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: '#f5f5f5',
                      color: '#666',
                      outline: 'none',
                    }}
                  >
                    <option value="all">All Projects</option>
                    {projects.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Error Banner */}
            {error && (
              <div style={{
                background: '#fafafa',
                border: '1px solid #eee',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <p style={{ color: '#666', margin: 0, fontSize: '13px' }}>
                  {error.message}
                </p>
                <button
                  onClick={() => setError(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#999',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px 8px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Task List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isLoading ? (
                <div style={{
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #eee',
                  padding: '48px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '2px solid #eee',
                    borderTop: '2px solid #000',
                    borderRadius: '50%',
                    margin: '0 auto 12px',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>Loading tasks...</p>
                </div>
              ) : displayedTasks.length === 0 ? (
                <div style={{
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #eee',
                  padding: '48px',
                  textAlign: 'center',
                }}>
                  <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
                    {searchQuery ? `No tasks found matching "${searchQuery}"` : 'No tasks yet'}
                  </p>
                </div>
              ) : (
                displayedTasks.map((task) => (
                  <div
                    key={task.id}
                    ref={(el) => { taskRefs.current[task.id] = el; }}
                    style={{
                      transition: 'all 0.3s ease',
                      borderRadius: '12px',
                      boxShadow: highlightedTaskId === task.id ? '0 0 0 2px #000' : 'none',
                    }}
                  >
                    <TaskItem
                      task={task}
                      onUpdate={handleTaskUpdate}
                      onDelete={handleTaskUpdate}
                      onError={handleError}
                      markSaving={markTaskSaving}
                      isSaving={savingTasks.has(task.id)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar - Hidden on mobile */}
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Overview Card */}
              <div style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #eee',
              }}>
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #eee',
                }}>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#000', letterSpacing: '-0.01em' }}>
                    Overview
                  </span>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>Active</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{counts.all}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>Waiting</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#666' }}>{counts.waiting}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>With Deadlines</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#666' }}>{counts.upcoming}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #eee',
              }}>
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #eee',
                }}>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#000', letterSpacing: '-0.01em' }}>
                    Quick Actions
                  </span>
                </div>
                <div style={{ padding: '12px 20px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      onClick={() => navigate('/dashboard')}
                      style={{
                        padding: '8px 10px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#333',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#fafafa'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      Go to Chat
                    </button>
                    <button
                      onClick={() => navigate('/calendar')}
                      style={{
                        padding: '8px 10px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#333',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#fafafa'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      View Calendar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

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

export default TasksPage;
