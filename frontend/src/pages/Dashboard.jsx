import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../utils/authStore';
import { tasksAPI } from '../api/client';
import TaskItem from '../components/TaskItem';
import AddTaskForm from '../components/AddTaskForm';
import ChatInterface from '../components/ChatInterface';

function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [nextTask, setNextTask] = useState(null);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    loadTasks();
    loadNextTask();
  }, [filter]);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const data = await tasksAPI.getTasks(filter);
      setTasks(data);
      // Also load all tasks for accurate counts
      const allData = await tasksAPI.getTasks('all');
      setAllTasks(allData);
    } catch (error) {
      console.error('Failed to load tasks:', error);
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

  const handleTaskUpdate = () => {
    loadTasks();
    loadNextTask();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getFilterCounts = () => {
    const all = allTasks.filter((t) => t.status !== 'completed').length;
    const waiting = allTasks.filter((t) => t.status === 'waiting_on').length;
    const upcoming = allTasks.filter((t) => t.deadline).length;
    return { all, waiting, upcoming };
  };

  const counts = getFilterCounts();

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
      <main style={{
        flex: 1,
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        padding: '24px',
        position: 'relative',
      }}>
        {showChat ? (
          <div style={{
            height: 'calc(100vh - 120px)',
            position: 'relative',
          }}>
            {/* Gradient Background for Chat */}
            <div style={{
              position: 'absolute',
              inset: '-24px',
              zIndex: 0,
              backgroundImage: `
                radial-gradient(circle 1200px at 15% 20%,
                  rgba(64, 64, 176, 0.6) 0%,
                  rgba(64, 64, 176, 0.3) 30%,
                  rgba(64, 64, 176, 0.1) 50%,
                  transparent 70%
                ),
                radial-gradient(circle 900px at 5% 70%,
                  rgba(64, 64, 176, 0.45) 0%,
                  rgba(64, 64, 176, 0.2) 40%,
                  transparent 65%
                ),
                radial-gradient(circle 1100px at 90% 60%,
                  rgba(0, 212, 221, 0.5) 0%,
                  rgba(0, 212, 221, 0.25) 35%,
                  rgba(0, 212, 221, 0.1) 50%,
                  transparent 70%
                ),
                radial-gradient(circle 800px at 85% 10%,
                  rgba(0, 212, 221, 0.35) 0%,
                  rgba(0, 212, 221, 0.15) 40%,
                  transparent 60%
                )
              `,
              filter: 'blur(180px)',
              pointerEvents: 'none',
            }} />

            <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
              <ChatInterface onTaskUpdate={handleTaskUpdate} />
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Gradient Background for Tasks */}
            <div style={{
              position: 'absolute',
              inset: '-24px',
              zIndex: 0,
              backgroundImage: `
                radial-gradient(circle 1200px at 15% 20%,
                  rgba(64, 64, 176, 0.6) 0%,
                  rgba(64, 64, 176, 0.3) 30%,
                  rgba(64, 64, 176, 0.1) 50%,
                  transparent 70%
                ),
                radial-gradient(circle 900px at 5% 70%,
                  rgba(64, 64, 176, 0.45) 0%,
                  rgba(64, 64, 176, 0.2) 40%,
                  transparent 65%
                ),
                radial-gradient(circle 1100px at 90% 60%,
                  rgba(0, 212, 221, 0.5) 0%,
                  rgba(0, 212, 221, 0.25) 35%,
                  rgba(0, 212, 221, 0.1) 50%,
                  transparent 70%
                ),
                radial-gradient(circle 800px at 85% 10%,
                  rgba(0, 212, 221, 0.35) 0%,
                  rgba(0, 212, 221, 0.15) 40%,
                  transparent 60%
                )
              `,
              filter: 'blur(180px)',
              pointerEvents: 'none',
            }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
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

              {/* Task Filters */}
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
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
              </div>

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
                ) : tasks.length === 0 ? (
                  <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '48px',
                    textAlign: 'center',
                  }}>
                    <p style={{ color: '#666' }}>
                      No tasks found. Add your first task to get started!
                    </p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onUpdate={handleTaskUpdate}
                      onDelete={handleTaskUpdate}
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
        )}
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
