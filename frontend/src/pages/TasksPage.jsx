import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../utils/authStore';
import { tasksAPI } from '../api/client';
import { queryKeys } from '../lib/queryKeys';
import TaskItem from '../components/TaskItem';
import AddTaskForm from '../components/AddTaskForm';
import { useIsMobile } from '../hooks/useIsMobile';

function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();
  const isMobile = useIsMobile(768);

  const [filter, setFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingTasks, setSavingTasks] = useState(new Set());
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Memoized counts
  const counts = useMemo(() => {
    const all = allTasks.filter((t) => t.status !== 'completed' && t.status !== 'deleted').length;
    const waiting = allTasks.filter((t) => t.status === 'waiting_on').length;
    const upcoming = allTasks.filter((t) => t.deadline && t.status !== 'completed' && t.status !== 'deleted').length;
    return { all, waiting, upcoming };
  }, [allTasks]);

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
                cursor: 'pointer',
              }}
              onClick={() => navigate('/dashboard')}
            />
          </div>

          {/* Mobile: Hamburger Menu Button */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat
              </button>

              {/* Tasks Button (active) */}
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

      {/* Main Content */}
      <main className="dashboard-container" style={{
        flex: 1,
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '16px' : '24px',
      }}>
        <div className="dashboard-grid" style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 320px',
          gap: isMobile ? '16px' : '24px',
        }}>
          {/* Tasks Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Next Task */}
            {nextTask && (
              <div style={{
                background: '#0066FF',
                borderRadius: '16px',
                padding: '24px',
                color: '#fff',
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
                  Next Task
                </h2>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  padding: '16px',
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                    {nextTask.title}
                  </h3>
                  {nextTask.description && (
                    <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>
                      {nextTask.description}
                    </p>
                  )}
                  {nextTask.deadline && (
                    <p style={{ fontSize: '14px', opacity: 0.8 }}>
                      Due: {nextTask.deadline}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Add Task */}
            <AddTaskForm onTaskAdded={handleTaskUpdate} />

            {/* Search Bar */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '16px',
            }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search tasks by title, description, project..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 44px',
                    fontSize: '15px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0066FF';
                    e.target.style.boxShadow = '0 0 0 3px rgba(0, 102, 255, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <span style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '18px',
                  color: '#9CA3AF',
                }}>
                  🔍
                </span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#9CA3AF',
                      fontSize: '20px',
                      cursor: 'pointer',
                      padding: '4px',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Task Filters */}
            <div className="task-filters" style={{
              background: '#fff',
              borderRadius: '16px',
              padding: isMobile ? '12px' : '16px',
              display: 'flex',
              gap: '8px',
              flexWrap: isMobile ? 'nowrap' : 'wrap',
              alignItems: 'center',
              overflowX: isMobile ? 'auto' : 'visible',
              WebkitOverflowScrolling: 'touch',
            }}>
              <button
                onClick={() => setFilter('all')}
                className="task-filter-btn"
                style={{
                  padding: isMobile ? '10px 14px' : '12px 20px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: filter === 'all' ? '#0066FF' : '#F3F4F6',
                  color: filter === 'all' ? '#fff' : '#000',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                All ({counts.all})
              </button>
              <button
                onClick={() => setFilter('waiting')}
                className="task-filter-btn"
                style={{
                  padding: isMobile ? '10px 14px' : '12px 20px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: filter === 'waiting' ? '#0066FF' : '#F3F4F6',
                  color: filter === 'waiting' ? '#fff' : '#000',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Waiting ({counts.waiting})
              </button>
              <button
                onClick={() => setFilter('upcoming')}
                className="task-filter-btn"
                style={{
                  padding: isMobile ? '10px 14px' : '12px 20px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: filter === 'upcoming' ? '#0066FF' : '#F3F4F6',
                  color: filter === 'upcoming' ? '#fff' : '#000',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Upcoming ({counts.upcoming})
              </button>
              <button
                onClick={() => setFilter('completed')}
                className="task-filter-btn"
                style={{
                  padding: isMobile ? '10px 14px' : '12px 20px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: filter === 'completed' ? '#0066FF' : '#F3F4F6',
                  color: filter === 'completed' ? '#fff' : '#000',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Done
              </button>
              <button
                onClick={() => setFilter('deleted')}
                className="task-filter-btn"
                style={{
                  padding: isMobile ? '10px 14px' : '12px 20px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: filter === 'deleted' ? '#0066FF' : '#F3F4F6',
                  color: filter === 'deleted' ? '#fff' : '#000',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Trash
              </button>

              {/* Project Filter Dropdown */}
              {projects.length > 0 && (
                <>
                  <div style={{ width: '1px', height: '32px', background: 'rgba(0, 0, 0, 0.1)', margin: '0 4px' }} />
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    style={{
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: '#F3F4F6',
                      color: '#000',
                      outline: 'none',
                    }}
                  >
                    <option value="all">All Projects</option>
                    {projects.map((project) => (
                      <option key={project} value={project}>
                        📁 {project}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Error Banner */}
            {error && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <p style={{ color: '#991B1B', margin: 0, fontSize: '14px', fontWeight: '500' }}>
                  {error.message}
                </p>
                <button
                  onClick={() => setError(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#991B1B',
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: '4px 8px',
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Task List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isLoading ? (
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
                  <p style={{ color: '#666' }}>Loading tasks...</p>
                </div>
              ) : displayedTasks.length === 0 ? (
                <div style={{
                  background: '#fff',
                  borderRadius: '16px',
                  padding: '48px',
                  textAlign: 'center',
                }}>
                  <p style={{ color: '#666' }}>
                    {searchQuery ? `No tasks found matching "${searchQuery}"` : 'No tasks found. Add your first task to get started!'}
                  </p>
                </div>
              ) : (
                displayedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onUpdate={handleTaskUpdate}
                    onDelete={handleTaskUpdate}
                    onError={handleError}
                    markSaving={markTaskSaving}
                    isSaving={savingTasks.has(task.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Sidebar - Hidden on mobile */}
          {!isMobile && (
            <div className="dashboard-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Stats */}
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '24px',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#000' }}>
                  Overview
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)' }}>Active Tasks</span>
                    <span style={{ fontWeight: 'bold', color: '#0066FF' }}>{counts.all}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)' }}>Waiting On</span>
                    <span style={{ fontWeight: 'bold', color: '#F59E0B' }}>{counts.waiting}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)' }}>With Deadlines</span>
                    <span style={{ fontWeight: 'bold', color: '#000' }}>{counts.upcoming}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '24px',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#000' }}>
                  Quick Actions
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#0066FF',
                      background: 'rgba(0, 102, 255, 0.08)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(0, 102, 255, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(0, 102, 255, 0.08)';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Chat with Sam
                  </button>
                  <button
                    onClick={() => navigate('/calendar')}
                    style={{
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#10B981',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(16, 185, 129, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(16, 185, 129, 0.08)';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    View Calendar
                  </button>
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
