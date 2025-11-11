import { useState } from 'react';
import { tasksAPI } from '../api/client';

function TaskItem({ task, onUpdate, onDelete }) {
  const [isCompleting, setIsCompleting] = useState(false);

  const getIntensityColor = (intensity) => {
    const colors = {
      1: { bg: '#D1FAE5', text: '#065F46' },
      2: { bg: '#DBEAFE', text: '#1E40AF' },
      3: { bg: '#FEF3C7', text: '#92400E' },
      4: { bg: '#FED7AA', text: '#9A3412' },
      5: { bg: '#FEE2E2', text: '#991B1B' },
    };
    return colors[intensity] || colors[3];
  };

  const getStatusColor = (status) => {
    const colors = {
      not_started: { bg: '#F3F4F6', text: '#4B5563' },
      in_progress: { bg: '#DBEAFE', text: '#1E40AF' },
      waiting_on: { bg: '#FEF3C7', text: '#92400E' },
      completed: { bg: '#D1FAE5', text: '#065F46' },
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
      return {
        text: `OVERDUE by ${Math.abs(diffDays)} days`,
        color: '#DC2626',
        fontWeight: '600',
      };
    } else if (diffDays === 0) {
      return {
        text: 'DUE TODAY',
        color: '#DC2626',
        fontWeight: '600',
      };
    } else if (diffDays === 1) {
      return {
        text: 'Due tomorrow',
        color: '#EA580C',
        fontWeight: '500',
      };
    } else {
      return {
        text: `Due in ${diffDays} days`,
        color: '#6B7280',
        fontWeight: '400',
      };
    }
  };

  const formatRecurrence = () => {
    if (!task.is_recurring || !task.recurrence_type) return null;

    const interval = task.recurrence_interval || 1;
    const type = task.recurrence_type;

    let text = 'Repeats ';
    if (interval === 1) {
      text += type;
    } else {
      text += `every ${interval} ${type === 'daily' ? 'days' : type === 'weekly' ? 'weeks' : type === 'monthly' ? 'months' : 'years'}`;
    }

    if (task.recurrence_end_date) {
      const endDate = new Date(task.recurrence_end_date);
      text += ` until ${endDate.toLocaleDateString()}`;
    }

    return text;
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

  const intensityColors = getIntensityColor(task.intensity);
  const statusColors = getStatusColor(task.status);
  const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      transition: 'box-shadow 0.2s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        {/* Main Content */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#000',
              margin: 0,
            }}>
              {task.title}
            </h3>

            <span style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              background: intensityColors.bg,
              color: intensityColors.text,
            }}>
              Intensity {task.intensity}
            </span>

            <span style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              background: statusColors.bg,
              color: statusColors.text,
            }}>
              {task.status.replace('_', ' ')}
            </span>

            {task.is_recurring && (
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: '#E0E7FF',
                color: '#4338CA',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                🔁 Recurring
              </span>
            )}
          </div>

          {task.description && (
            <p style={{
              fontSize: '14px',
              color: '#6B7280',
              lineHeight: '1.6',
              marginBottom: '12px',
            }}>
              {task.description}
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '14px' }}>
            {deadlineInfo && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: deadlineInfo.color,
                fontWeight: deadlineInfo.fontWeight,
              }}>
                {deadlineInfo.text}
              </div>
            )}

            {task.waiting_on && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#92400E',
              }}>
                Waiting on: {task.waiting_on}
              </div>
            )}

            {formatRecurrence() && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#4338CA',
                fontWeight: '500',
              }}>
                {formatRecurrence()}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {task.status !== 'completed' && (
            <>
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#fff',
                  background: '#10B981',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isCompleting ? 'not-allowed' : 'pointer',
                  opacity: isCompleting ? 0.6 : 1,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isCompleting) e.target.style.background = '#059669';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#10B981';
                }}
              >
                Complete
              </button>

              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                style={{
                  padding: '8px 10px',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  background: '#fff',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_on">Waiting On</option>
              </select>
            </>
          )}

          <button
            onClick={handleDelete}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#fff',
              background: '#EF4444',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#DC2626';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#EF4444';
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskItem;
