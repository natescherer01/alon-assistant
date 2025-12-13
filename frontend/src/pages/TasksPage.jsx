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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: isMobile ? '12px 16px' : '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img
              src="/alon-logo.png"
              alt="Alon"
              style={{ height: isMobile ? '28px' : '32px', cursor: 'pointer' }}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5">
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>
          )}

          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
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
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: item.active ? '500' : '400',
                    color: item.active ? '#111' : '#666',
                    background: item.active ? '#f5f5f5' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: item.active ? 'default' : 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
              <div style={{ width: '1px', height: '16px', background: '#e5e5e5', margin: '0 8px' }} />
              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
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
            background: '#fff',
            padding: '8px',
            borderBottom: '1px solid #f0f0f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
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
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: item.active ? '500' : '400',
                  color: item.active ? '#111' : '#666',
                  background: item.active ? '#f5f5f5' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {item.label}
              </button>
            ))}
            <div style={{ height: '1px', background: '#f0f0f0', margin: '8px 0' }} />
            <button
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
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
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '20px 16px' : '32px 24px',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize: isMobile ? '24px' : '28px',
            fontWeight: '600',
            color: '#111',
            margin: '0 0 4px 0',
            letterSpacing: '-0.02em',
          }}>
            Tasks
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: 0,
          }}>
            {counts.all} active{counts.upcoming > 0 ? ` · ${counts.upcoming} with due dates` : ''}
          </p>
        </div>

        {/* Add Task */}
        <div style={{ marginBottom: '24px' }}>
          <AddTaskForm onTaskAdded={handleTaskUpdate} />
        </div>

        {/* Filters & Search */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '12px',
          marginBottom: '20px',
          alignItems: isMobile ? 'stretch' : 'center',
        }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex',
            gap: '4px',
            background: '#f5f5f5',
            borderRadius: '8px',
            padding: '4px',
            overflowX: 'auto',
            flexShrink: 0,
          }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'upcoming', label: 'Scheduled' },
              { key: 'waiting', label: 'Waiting' },
              { key: 'completed', label: 'Done' },
              { key: 'deleted', label: 'Trash' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: filter === f.key ? '500' : '400',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: filter === f.key ? '#fff' : 'transparent',
                  color: filter === f.key ? '#111' : '#666',
                  boxShadow: filter === f.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search & Project filter */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flex: 1,
          }}>
            <div style={{
              flex: 1,
              position: 'relative',
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
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  fontSize: '13px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  outline: 'none',
                  background: '#fff',
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
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    color: '#9ca3af',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  padding: '8px 12px',
                  fontSize: '13px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  outline: 'none',
                  background: projectFilter !== 'all' ? '#111' : '#fff',
                  color: projectFilter !== 'all' ? '#fff' : '#666',
                  cursor: 'pointer',
                  minWidth: '120px',
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
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', color: '#991b1b' }}>{error.message}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#991b1b',
                padding: '4px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Task List */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e5e5e5',
          padding: isMobile ? '8px 16px' : '8px 20px',
        }}>
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid #e5e5e5',
                borderTop: '2px solid #666',
                borderRadius: '50%',
                margin: '0 auto 12px',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Loading...</p>
            </div>
          ) : displayedTasks.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
                {searchQuery
                  ? `No tasks matching "${searchQuery}"`
                  : filter === 'completed'
                    ? 'No completed tasks'
                    : filter === 'deleted'
                      ? 'Trash is empty'
                      : filter === 'waiting'
                        ? 'No waiting tasks'
                        : 'No tasks yet. Add one above!'}
              </p>
            </div>
          ) : (
            displayedTasks.map((task) => (
              <div
                key={task.id}
                ref={(el) => { taskRefs.current[task.id] = el; }}
                style={{
                  transition: 'all 0.3s ease',
                  borderRadius: '8px',
                  background: highlightedTaskId === task.id ? '#fffbeb' : 'transparent',
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

        {/* Keyboard hint */}
        {!isMobile && (
          <p style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#9ca3af',
            marginTop: '24px',
          }}>
            Click a task to edit · Press <kbd style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>Esc</kbd> to cancel
          </p>
        )}
      </main>

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
