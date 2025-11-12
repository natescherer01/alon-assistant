import { useState } from 'react';
import { tasksAPI } from '../api/client';

function TaskItem({ task, onUpdate, onDelete }) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || '',
    project: task.project || '',
    deadline: task.deadline || '',
    intensity: task.intensity,
    waiting_on: task.waiting_on || '',
    is_recurring: task.is_recurring || false,
    recurrence_type: task.recurrence_type || 'daily',
    recurrence_interval: task.recurrence_interval || 1,
    recurrence_end_date: task.recurrence_end_date || '',
  });

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
      deleted: { bg: '#FEE2E2', text: '#991B1B' },
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

  const handleRestore = async () => {
    try {
      await tasksAPI.restoreTask(task.id);
      onUpdate();
    } catch (error) {
      alert('Failed to restore task');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form data to original task values
    setFormData({
      title: task.title,
      description: task.description || '',
      project: task.project || '',
      deadline: task.deadline || '',
      intensity: task.intensity,
      waiting_on: task.waiting_on || '',
      is_recurring: task.is_recurring || false,
      recurrence_type: task.recurrence_type || 'daily',
      recurrence_interval: task.recurrence_interval || 1,
      recurrence_end_date: task.recurrence_end_date || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        title: formData.title,
        description: formData.description,
        intensity: parseInt(formData.intensity),
        is_recurring: formData.is_recurring,
      };

      if (formData.project) {
        updateData.project = formData.project;
      }

      if (formData.deadline) {
        updateData.deadline = formData.deadline;
      }

      if (formData.waiting_on) {
        updateData.waiting_on = formData.waiting_on;
      }

      // Only include recurrence data if task is recurring
      if (formData.is_recurring) {
        updateData.recurrence_type = formData.recurrence_type;
        updateData.recurrence_interval = parseInt(formData.recurrence_interval);
        if (formData.recurrence_end_date) {
          updateData.recurrence_end_date = formData.recurrence_end_date;
        }
      }

      await tasksAPI.updateTask(task.id, updateData);
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      alert('Failed to update task: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const intensityColors = getIntensityColor(task.intensity);
  const statusColors = getStatusColor(task.status);
  const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;

  // If editing, show edit form
  if (isEditing) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#000',
            margin: 0,
          }}>
            Edit Task
          </h3>
        </div>

        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label htmlFor="title" style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
            }}>
              Task Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '12px 16px',
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
          </div>

          <div>
            <label htmlFor="description" style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
            }}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
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
          </div>

          <div>
            <label htmlFor="project" style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
            }}>
              Project
            </label>
            <input
              type="text"
              id="project"
              name="project"
              value={formData.project}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '12px 16px',
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label htmlFor="deadline" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
              }}>
                Deadline
              </label>
              <input
                type="date"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '12px 16px',
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
            </div>

            <div>
              <label htmlFor="intensity" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
              }}>
                Intensity
              </label>
              <select
                id="intensity"
                name="intensity"
                value={formData.intensity}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  outline: 'none',
                  background: '#fff',
                  cursor: 'pointer',
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
              >
                <option value={1}>1 - Very Light</option>
                <option value={2}>2 - Light</option>
                <option value={3}>3 - Medium</option>
                <option value={4}>4 - Heavy</option>
                <option value={5}>5 - Very Heavy</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="waiting_on" style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
            }}>
              Waiting On
            </label>
            <input
              type="text"
              id="waiting_on"
              name="waiting_on"
              value={formData.waiting_on}
              onChange={handleChange}
              placeholder="Who or what are you waiting on?"
              style={{
                width: '100%',
                padding: '12px 16px',
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
          </div>

          {/* Recurring Task Section */}
          <div style={{
            borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            paddingTop: '20px',
            marginTop: '8px',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              marginBottom: formData.is_recurring ? '16px' : '0',
            }}>
              <input
                type="checkbox"
                name="is_recurring"
                checked={formData.is_recurring}
                onChange={handleChange}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#0066FF',
                }}
              />
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
              }}>
                Make this a recurring task
              </span>
            </label>

            {formData.is_recurring && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '28px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="recurrence_type" style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px',
                    }}>
                      Repeats
                    </label>
                    <select
                      id="recurrence_type"
                      name="recurrence_type"
                      value={formData.recurrence_type}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        outline: 'none',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="recurrence_interval" style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px',
                    }}>
                      Every
                    </label>
                    <input
                      type="number"
                      id="recurrence_interval"
                      name="recurrence_interval"
                      min="1"
                      value={formData.recurrence_interval}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="recurrence_end_date" style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px',
                  }}>
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    id="recurrence_end_date"
                    name="recurrence_end_date"
                    value={formData.recurrence_end_date}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '14px',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '15px',
                fontWeight: '600',
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
              Save Changes
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              style={{
                padding: '14px 20px',
                fontSize: '15px',
                fontWeight: '600',
                color: '#6B7280',
                background: 'transparent',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#F3F4F6';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Otherwise show normal task view
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

            {task.project && (
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                background: '#FEF3C7',
                color: '#92400E',
              }}>
                📁 {task.project}
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
          {task.status === 'deleted' ? (
            <button
              onClick={handleRestore}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#fff',
                background: '#0066FF',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#0052CC';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#0066FF';
              }}
            >
              Restore
            </button>
          ) : (
            <>
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
                onClick={handleEdit}
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#fff',
                  background: '#0066FF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#0052CC';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#0066FF';
                }}
              >
                Edit
              </button>

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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskItem;
