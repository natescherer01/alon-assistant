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
    const all = tasks.filter((t) => t.status !== 'completed').length;
    const waiting = tasks.filter((t) => t.status === 'waiting_on').length;
    const upcoming = tasks.filter((t) => t.deadline).length;
    return { all, waiting, upcoming };
  };

  const counts = getFilterCounts();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Personal AI Assistant</h1>
              <p className="text-sm text-gray-600">Welcome back, {user?.full_name || user?.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowChat(!showChat)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {showChat ? '📋 Show Tasks' : '💬 Show Chat'}
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {showChat ? (
              <div className="h-[700px]">
                <ChatInterface onTaskUpdate={handleTaskUpdate} />
              </div>
            ) : (
              <>
                {/* Next Task */}
                {nextTask && (
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                    <h2 className="text-xl font-semibold mb-4">🎯 Next Task</h2>
                    <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-2">{nextTask.title}</h3>
                      {nextTask.description && (
                        <p className="text-white/90 text-sm mb-2">{nextTask.description}</p>
                      )}
                      {nextTask.deadline && (
                        <p className="text-white/80 text-sm">📅 Deadline: {nextTask.deadline}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Add Task */}
                <AddTaskForm onTaskAdded={handleTaskUpdate} />

                {/* Task Filters */}
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        filter === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All Active ({counts.all})
                    </button>
                    <button
                      onClick={() => setFilter('waiting')}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        filter === 'waiting'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Waiting ({counts.waiting})
                    </button>
                    <button
                      onClick={() => setFilter('upcoming')}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        filter === 'upcoming'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Upcoming ({counts.upcoming})
                    </button>
                  </div>
                </div>

                {/* Task List */}
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="mt-4 text-gray-600">Loading tasks...</p>
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                      <p className="text-gray-600">No tasks found. Add your first task to get started!</p>
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
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Overview</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Tasks</span>
                  <span className="font-semibold text-indigo-600">{counts.all}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Waiting On</span>
                  <span className="font-semibold text-yellow-600">{counts.waiting}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">With Deadlines</span>
                  <span className="font-semibold text-gray-900">{counts.upcoming}</span>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-indigo-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-indigo-900 mb-3">💡 Tips</h3>
              <ul className="space-y-2 text-sm text-indigo-800">
                <li>• Use the chat to quickly manage tasks</li>
                <li>• Say "What's next?" to get your priority task</li>
                <li>• The system auto-detects task intensity</li>
                <li>• Tasks with deadlines are prioritized</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
