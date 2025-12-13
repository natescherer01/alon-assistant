import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../utils/authStore';
import { tasksAPI } from '../api/client';
import { queryKeys } from '../lib/queryKeys';
import TaskItem from '../components/TaskItem';
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

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: queryKeys.tasks.list({ listType: 'all', days: 7 }),
    queryFn: () => tasksAPI.getTasks('all', 7),
    staleTime: 2 * 60 * 1000,
  });

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
      return titleMatch || descriptionMatch || projectMatch;
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

  const handleError = (message) => {
    setError({ message });
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

  useEffect(() => {
    const state = location.state;
    if (state?.selectedTaskId) {
      setHighlightedTaskId(state.selectedTaskId);
      navigate(location.pathname, { replace: true, state: null });
      setTimeout(() => {
        const taskElement = taskRefs.current[state.selectedTaskId];
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => setHighlightedTaskId(null), 2000);
      }, 100);
    }
  }, [location.state, navigate, location.pathname]);

  const counts = useMemo(() => {
    const all = allTasks.filter((t) => t.status !== 'completed' && t.status !== 'deleted').length;
    const waiting = allTasks.filter((t) => t.status === 'waiting_on').length;
    const upcoming = allTasks.filter((t) => t.deadline && t.status !== 'completed' && t.status !== 'deleted').length;
    const completed = allTasks.filter((t) => t.status === 'completed').length;
    return { all, waiting, upcoming, completed };
  }, [allTasks]);

  const filterButtons = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'upcoming', label: 'Scheduled', count: counts.upcoming },
    { key: 'waiting', label: 'Waiting', count: counts.waiting },
    { key: 'completed', label: 'Done', count: counts.completed },
    { key: 'deleted', label: 'Trash' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8f9fa',
    }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <div style={{
          maxWidth: isMobile ? '720px' : '1400px',
          margin: '0 auto',
          padding: isMobile ? '14px 20px' : '14px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img
              src="/alon-logo.png"
              alt="Alon"
              style={{ height: isMobile ? '26px' : '28px', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard')}
            />
          </div>

          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>
          )}

          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[
                { label: 'Chat', path: '/dashboard' },
                { label: 'Tasks', path: '/tasks', active: true },
                { label: 'Calendar', path: '/calendar' },
                { label: 'Profile', path: '/profile' },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => !item.active && navigate(item.path)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: item.active ? '500' : '400',
                    color: item.active ? '#111' : '#6b7280',
                    background: item.active ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: item.active ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.label}
                </button>
              ))}
              <div style={{ width: '1px', height: '20px', background: 'rgba(0, 0, 0, 0.08)', margin: '0 8px' }} />
              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  color: '#9ca3af',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {isMobile && mobileMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            padding: '8px 12px 12px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          }}>
            {[
              { label: 'Chat', path: '/dashboard' },
              { label: 'Tasks', path: '/tasks', active: true },
              { label: 'Calendar', path: '/calendar' },
              { label: 'Profile', path: '/profile' },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => { !item.active && navigate(item.path); setMobileMenuOpen(false); }}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '15px',
                  fontWeight: item.active ? '500' : '400',
                  color: item.active ? '#111' : '#6b7280',
                  background: item.active ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '2px',
                }}
              >
                {item.label}
              </button>
            ))}
            <div style={{ height: '1px', background: 'rgba(0, 0, 0, 0.06)', margin: '8px 0' }} />
            <button
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                color: '#9ca3af',
                background: 'transparent',
                border: 'none',
                borderRadius: '10px',
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
        maxWidth: isMobile ? '720px' : '1400px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '24px 20px 40px' : '40px 48px 60px',
      }}>
        {/* Header Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '16px' : '24px',
          marginBottom: '32px',
        }}>
          <div>
            <h1 style={{
              fontSize: isMobile ? '28px' : '28px',
              fontWeight: '600',
              color: '#111827',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
            }}>
              Tasks
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0,
            }}>
              {counts.all === 0 ? 'No active tasks' : `${counts.all} active${counts.upcoming > 0 ? ` · ${counts.upcoming} scheduled` : ''}`}
            </p>
          </div>
        </div>

        {/* Filters & Search Row */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: '16px',
          marginBottom: '20px',
        }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex',
            gap: '4px',
            overflowX: 'auto',
            background: '#fff',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid #e5e7eb',
          }}>
            {filterButtons.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: filter === f.key ? '500' : '400',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: filter === f.key ? '#111827' : 'transparent',
                  color: filter === f.key ? '#fff' : '#6b7280',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {f.label}
                {f.count !== undefined && f.count > 0 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '500',
                    opacity: filter === f.key ? 0.8 : 0.6,
                    background: filter === f.key ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search & Project filter */}
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}>
            <div style={{
              position: 'relative',
              width: isMobile ? '100%' : '280px',
            }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 38px',
                  fontSize: '13px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  background: '#fff',
                  transition: 'all 0.15s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#111827';
                  e.target.style.boxShadow = '0 0 0 3px rgba(17, 24, 39, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#f3f4f6',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    color: '#6b7280',
                    borderRadius: '4px',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {projects.length > 0 && (
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                style={{
                  padding: '9px 12px',
                  fontSize: '13px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  background: projectFilter !== 'all' ? '#111827' : '#fff',
                  color: projectFilter !== 'all' ? '#fff' : '#6b7280',
                  cursor: 'pointer',
                  minWidth: '140px',
                  transition: 'all 0.15s ease',
                }}
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%)',
            border: '1px solid #fecaca',
            borderRadius: '14px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'slideIn 0.3s ease',
          }}>
            <span style={{ fontSize: '14px', color: '#b91c1c', fontWeight: '450' }}>{error.message}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#dc2626',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Task List */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
        }}>
          {/* Desktop Table Header */}
          {!isMobile && displayedTasks.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '44px 1fr 140px 120px 100px 80px',
              gap: '12px',
              padding: '12px 20px',
              background: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
              fontSize: '12px',
              fontWeight: '500',
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <div></div>
              <div>Task</div>
              <div>Status</div>
              <div>Due Date</div>
              <div>Priority</div>
              <div></div>
            </div>
          )}

          {isLoading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #111827',
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Loading tasks...</p>
            </div>
          ) : displayedTasks.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  {filter === 'deleted' ? (
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  ) : filter === 'completed' ? (
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  )}
                </svg>
              </div>
              <p style={{ color: '#374151', fontSize: '15px', margin: '0 0 4px', fontWeight: '500' }}>
                {searchQuery
                  ? 'No matching tasks'
                  : filter === 'completed'
                    ? 'No completed tasks'
                    : filter === 'deleted'
                      ? 'Trash is empty'
                      : filter === 'waiting'
                        ? 'No waiting tasks'
                        : 'No tasks yet'}
              </p>
              <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
                {searchQuery
                  ? `Try a different search term`
                  : filter === 'all'
                    ? 'Add your first task above'
                    : ''}
              </p>
            </div>
          ) : (
            <div>
              {displayedTasks.map((task, index) => (
                <div
                  key={task.id}
                  ref={(el) => { taskRefs.current[task.id] = el; }}
                  style={{
                    transition: 'background 0.2s ease',
                    background: highlightedTaskId === task.id ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
                  }}
                >
                  <TaskItem
                    task={task}
                    onUpdate={handleTaskUpdate}
                    onDelete={handleTaskUpdate}
                    onError={handleError}
                    markSaving={markTaskSaving}
                    isSaving={savingTasks.has(task.id)}
                    isLast={index === displayedTasks.length - 1}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Keyboard hint */}
        {!isMobile && displayedTasks.length > 0 && (
          <p style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#9ca3af',
            marginTop: '20px',
          }}>
            Click a task to edit · Press <kbd style={{
              background: '#f3f4f6',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'inherit',
              fontWeight: '500',
              border: '1px solid #e5e7eb',
            }}>Esc</kbd> to cancel
          </p>
        )}
      </main>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default TasksPage;
