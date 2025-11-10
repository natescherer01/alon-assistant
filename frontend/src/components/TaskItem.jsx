import { useState } from 'react';
import { tasksAPI } from '../api/client';

function TaskItem({ task, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const getIntensityColor = (intensity) => {
    const colors = {
      1: 'bg-green-100 text-green-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-orange-100 text-orange-800',
      5: 'bg-red-100 text-red-800',
    };
    return colors[intensity] || colors[3];
  };

  const getStatusColor = (status) => {
    const colors = {
      not_started: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      waiting_on: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
    };
    return colors[status] || colors.not_started;
  };

  const formatDeadline = (deadline) => {
    if (!deadline) return null;

    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="text-red-600 font-semibold">
          OVERDUE by {Math.abs(diffDays)} days
        </span>
      );
    } else if (diffDays === 0) {
      return <span className="text-red-600 font-semibold">DUE TODAY</span>;
    } else if (diffDays === 1) {
      return <span className="text-orange-600">Due tomorrow</span>;
    } else {
      return <span className="text-gray-600">Due in {diffDays} days</span>;
    }
  };

  const handleComplete = async () => {
    if (confirm('Mark this task as completed?')) {
      setIsCompleting(true);
      try {
        await tasksAPI.completeTask(task.id);
        onUpdate();
      } catch (error) {
        alert('Failed to complete task');
      } finally {
        setIsCompleting(false);
      }
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await tasksAPI.updateTask(task.id, { status: newStatus });
      onUpdate();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this task?')) {
      try {
        await tasksAPI.deleteTask(task.id);
        onDelete(task.id);
      } catch (error) {
        alert('Failed to delete task');
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${getIntensityColor(
                task.intensity
              )}`}
            >
              Intensity {task.intensity}
            </span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                task.status
              )}`}
            >
              {task.status.replace('_', ' ')}
            </span>
          </div>

          {task.description && (
            <p className="text-gray-600 text-sm mb-2">{task.description}</p>
          )}

          <div className="flex flex-wrap gap-2 text-sm">
            {task.deadline && (
              <div className="flex items-center gap-1">
                <span>📅</span>
                {formatDeadline(task.deadline)}
              </div>
            )}

            {task.waiting_on && (
              <div className="text-yellow-700">
                ⏳ Waiting on: {task.waiting_on}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 ml-4">
          {task.status !== 'completed' && (
            <>
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                ✓ Complete
              </button>

              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_on">Waiting On</option>
              </select>
            </>
          )}

          <button
            onClick={handleDelete}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskItem;
