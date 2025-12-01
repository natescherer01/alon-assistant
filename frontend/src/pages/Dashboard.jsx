import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../utils/authStore';
import { tasksAPI } from '../api/client';
import TaskItem from '../components/TaskItem';
import AddTaskForm from '../components/AddTaskForm';
import ChatInterface from '../components/ChatInterface';

function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [allTasks, setAllTasks] = useState([]); // Store ALL tasks locally
  const [nextTask, setNextTask] = useState(null);
  const [filter, setFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Only true on initial load
  const [showChat, setShowChat] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingTasks, setSavingTasks] = useState(new Set());
  const [error, setError] = useState(null);

  // Load all tasks ONCE on mount (no dependency on filter!)
  useEffect(() => {
    loadAllTasks();
    loadNextTask();
  }, []); // Empty dependency array = run once on mount

  const sortTasksByDeadline = (tasksToSort) => {
    return [...tasksToSort].sort((a, b) => {
      // Tasks without deadlines go to the end
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;

      // Sort by deadline chronologically (earliest first)
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

  // Load ALL tasks once - no filter parameter, fetch everything
  const loadAllTasks = async () => {
    setIsLoading(true);
    try {
      // Fetch all tasks at once (all statuses: active, completed, deleted, waiting, etc.)
      const allData = await tasksAPI.getTasks('all');
      setAllTasks(allData);

      // Extract unique projects from all tasks
      const uniqueProjects = [...new Set(allData.map(t => t.project).filter(p => p))];
      setProjects(uniqueProjects);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setError({ message: 'Failed to load tasks. Please refresh the page.' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadNextTask = async () => {
    try {
      const data = await tasksAPI.getNextTask();
      setNextTask(data);
    } catch (error) {
      console.error('Failed to load next task:', error);
    }
  };

  /**
   * Handle task updates with optimistic UI updates
   * @param {Object|null} updatedTask - The updated task object (for optimistic updates)
   * @param {string|null} taskId - The ID of task to delete (for delete operations)
   * @param {string} action - The action type: 'update', 'delete', 'complete', 'restore', 'add'
   */
  const handleTaskUpdate = (updatedTask = null, taskId = null, action = 'update') => {
    if (updatedTask || taskId) {
      // Clear any previous errors
      setError(null);

      // Optimistic update - update allTasks immediately (client-side state)
      setAllTasks(prevTasks => {
        if (action === 'delete') {
          return prevTasks.filter(t => t.id !== taskId);
        } else if (action === 'add') {
          // Add new task to the list
          return [...prevTasks, updatedTask];
        } else if (action === 'update' || action === 'complete' || action === 'restore') {
          // Update existing task
          const taskExists = prevTasks.some(t => t.id === updatedTask.id);
          if (taskExists) {
            return prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
          } else {
            // Task doesn't exist yet, add it
            return [...prevTasks, updatedTask];
          }
        }
        return prevTasks;
      });

      // Only reload next task if the updated/deleted task could affect it
      // (i.e., if task is not completed or if we deleted a task)
      if (action === 'delete' || updatedTask?.status !== 'completed') {
        loadNextTask();
      }
    } else {
      // Fallback: full reload (for error recovery)
      loadAllTasks();
      loadNextTask();
    }
  };

  const handleError = (message, taskId = null) => {
    setError({ message, taskId });
    // Auto-dismiss error after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  const markTaskSaving = (taskId, isSaving) => {
    setSavingTasks(prev => {
      const next = new Set(prev);
      if (isSaving) {
        next.add(taskId);

        // Safety timeout: auto-clear saving state after 10 seconds if it gets stuck
        setTimeout(() => {
          setSavingTasks(current => {
            if (current.has(taskId)) {
              console.warn(`Clearing stuck saving state for task ${taskId}`);
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

  // CLIENT-SIDE FILTERING: Memoized filtering for performance with large task lists
  const displayedTasks = useMemo(() => {
    let filtered = allTasks;

    // Apply status filter
    switch (filter) {
      case 'all':
        // All active tasks (not completed, not deleted)
        filtered = filtered.filter(t => t.status !== 'completed' && t.status !== 'deleted');
        break;
      case 'waiting':
        // Only waiting tasks
        filtered = filtered.filter(t => t.status === 'waiting_on');
        break;
      case 'upcoming':
        // Tasks with deadlines (not completed, not deleted)
        filtered = filtered.filter(t => t.deadline && t.status !== 'completed' && t.status !== 'deleted');
        break;
      case 'completed':
        // Only completed tasks
        filtered = filtered.filter(t => t.status === 'completed');
        break;
      case 'deleted':
        // Only deleted tasks
        filtered = filtered.filter(t => t.status === 'deleted');
        break;
      default:
        filtered = filtered.filter(t => t.status !== 'completed' && t.status !== 'deleted');
    }

    // Apply project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter(t => t.project === projectFilter);
    }

    // Sort by deadline
    const sorted = sortTasksByDeadline(filtered);

    // Apply search filter
    return filterTasksBySearch(sorted);
  }, [allTasks, filter, projectFilter, searchQuery]);

  // Clean up saving states for tasks that are no longer displayed
  useEffect(() => {
    const displayedTaskIds = new Set(displayedTasks.map(t => t.id));
    setSavingTasks(prevSaving => {
      const newSaving = new Set(prevSaving);
      let hasChanges = false;

      // Remove saving state for tasks that are no longer displayed
      prevSaving.forEach(taskId => {
        if (!displayedTaskIds.has(taskId)) {
          newSaving.delete(taskId);
          hasChanges = true;
        }
      });

      return hasChanges ? newSaving : prevSaving;
    });
  }, [displayedTasks]);

  // Memoized counts for performance
  const counts = useMemo(() => {
    const all = allTasks.filter((t) => t.status !== 'completed' && t.status !== 'deleted').length;
    const waiting = allTasks.filter((t) => t.status === 'waiting_on').length;
    const upcoming = allTasks.filter((t) => t.deadline && t.status !== 'completed' && t.status !== 'deleted').length;
    return { all, waiting, upcoming };
  }, [allTasks]);

  // Get user initials
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <img
            src="/alon-logo.png"
            alt="Alon"
            style={{
              height: '36px',
            }}
          />

          {/* User Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Toggle Chat/Tasks Button */}
            <button
              onClick={() => setShowChat(!showChat)}
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
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#0052CC';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#0066FF';
              }}
            >
              {showChat ? 'Tasks' : 'Chat'}
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
        </div>
      </nav>

      {/* Main Content */}
      <main className="dashboard-container" style={{
        flex: 1,
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        padding: '24px',
        position: 'relative',
      }}>
        {/* Chat View - Keep mounted but hide when not active */}
        <div style={{
          height: 'calc(100vh - 120px)',
          position: 'relative',
          display: showChat ? 'block' : 'none',
        }}>

          <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
            <ChatInterface onTaskUpdate={handleTaskUpdate} />
          </div>
        </div>

        {/* Tasks View - Keep mounted but hide when not active */}
        <div style={{
          position: 'relative',
          display: showChat ? 'none' : 'block',
        }}>

            <div className="dashboard-grid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
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
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}>
                <button
                  onClick={() => setFilter('all')}
                  style={{
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: filter === 'all' ? '#0066FF' : '#F3F4F6',
                    color: filter === 'all' ? '#fff' : '#000',
                  }}
                >
                  All Active ({counts.all})
                </button>
                <button
                  onClick={() => setFilter('waiting')}
                  style={{
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: filter === 'waiting' ? '#0066FF' : '#F3F4F6',
                    color: filter === 'waiting' ? '#fff' : '#000',
                  }}
                >
                  Waiting ({counts.waiting})
                </button>
                <button
                  onClick={() => setFilter('upcoming')}
                  style={{
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: filter === 'upcoming' ? '#0066FF' : '#F3F4F6',
                    color: filter === 'upcoming' ? '#fff' : '#000',
                  }}
                >
                  Upcoming ({counts.upcoming})
                </button>
                <button
                  onClick={() => setFilter('completed')}
                  style={{
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: filter === 'completed' ? '#0066FF' : '#F3F4F6',
                    color: filter === 'completed' ? '#fff' : '#000',
                  }}
                >
                  Completed
                </button>
                <button
                  onClick={() => setFilter('deleted')}
                  style={{
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: filter === 'deleted' ? '#0066FF' : '#F3F4F6',
                    color: filter === 'deleted' ? '#fff' : '#000',
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

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
            </div>
            </div>
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

export default Dashboard;
