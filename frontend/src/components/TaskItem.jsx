import { useState, useEffect, useRef } from 'react';
import { tasksAPI } from '../api/client';
import useConfirm from '../hooks/useConfirm';
import useAuthStore from '../utils/authStore';
import { useIsMobile } from '../hooks/useIsMobile';

function TaskItem({ task, onUpdate, onDelete, onError, markSaving, isSaving = false }) {
  const { user } = useAuthStore();
  const isMobile = useIsMobile(768);
  const { ConfirmDialog, confirm, alert } = useConfirm();
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isMountedRef = useRef(true);
  const previousTaskRef = useRef(task);

  // Update previous task ref when task changes
  useEffect(() => {
    previousTaskRef.current = task;
  }, [task]);

  // Cleanup on unmount to prevent state updates
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
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

  const getIntensityStyle = (intensity) => {
    // Minimalist monochrome intensity display
    const opacity = 0.3 + (intensity * 0.14);
    return {
      bg: `rgba(0, 0, 0, ${opacity * 0.15})`,
      text: '#666',
    };
  };

  const getStatusStyle = (status) => {
    // Minimalist status colors
    const styles = {
      not_started: { bg: '#f5f5f5', text: '#999' },
      in_progress: { bg: '#f5f5f5', text: '#000' },
      waiting_on: { bg: '#fafafa', text: '#666' },
      completed: { bg: '#f5f5f5', text: '#999' },
      deleted: { bg: '#fafafa', text: '#999' },
    };
    return styles[status] || styles.not_started;
  };

  const formatDeadline = (deadline) => {
    if (!deadline) return null;

    // Get user's timezone, default to UTC
    const userTimezone = user?.timezone || 'UTC';

    // Parse deadline as a date (deadline is YYYY-MM-DD format)
    // Add time to avoid timezone issues when parsing
    const deadlineDate = new Date(deadline + 'T00:00:00');

    // Get today's date in user's timezone
    const now = new Date();
    const todayInUserTz = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    const today = new Date(todayInUserTz.getFullYear(), todayInUserTz.getMonth(), todayInUserTz.getDate());

    // Calculate difference in days
    const deadlineDateOnly = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    const diffTime = deadlineDateOnly - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `Overdue by ${Math.abs(diffDays)} days`,
        color: '#000',
        fontWeight: '600',
      };
    } else if (diffDays === 0) {
      return {
        text: 'Due today',
        color: '#000',
        fontWeight: '600',
      };
    } else if (diffDays === 1) {
      return {
        text: 'Due tomorrow',
        color: '#666',
        fontWeight: '500',
      };
    } else {
      return {
        text: `Due in ${diffDays} days`,
        color: '#999',
        fontWeight: '400',
      };
    }
  };

  const formatRecurrence = () => {
    if (!task.is_recurring || !task.recurrence_type) return null;

    const interval = task.recurrence_interval || 1;
    const type = task.recurrence_type;
    const userTimezone = user?.timezone || 'UTC';

    let text = 'Repeats ';
    if (interval === 1) {
      text += type;
    } else {
      text += `every ${interval} ${type === 'daily' ? 'days' : type === 'weekly' ? 'weeks' : type === 'monthly' ? 'months' : 'years'}`;
    }

    if (task.recurrence_end_date) {
      const endDate = new Date(task.recurrence_end_date + 'T00:00:00');
      text += ` until ${endDate.toLocaleDateString('en-US', { timeZone: userTimezone })}`;
    }

    return text;
  };

  const handleComplete = async () => {
    const confirmed = await confirm('Complete task?', 'Mark this task as completed?', 'Complete', 'Cancel');
    if (!confirmed) return;
    if (isSaving) return; // Prevent duplicate requests

    setIsCompleting(true);
    const previousTask = previousTaskRef.current;

    // Create optimistically updated task
    const optimisticTask = {
      ...task,
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Mark as saving
    if (markSaving) markSaving(task.id, true);

    // Optimistically update UI
    onUpdate(optimisticTask, null, 'complete');
    setIsCompleting(false);

    try {
      // Make API call in background
      const updatedTask = await tasksAPI.completeTask(task.id);

      if (!isMountedRef.current) return;

      // Update with real data from server
      onUpdate(updatedTask, null, 'complete');
    } catch (error) {
      if (!isMountedRef.current) return;

      // Rollback to previous state
      onUpdate(previousTask, null, 'update');

      // Show error
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to complete task';
      if (onError) {
        onError(errorMessage, task.id);
      } else {
        await alert('Failed to complete task', errorMessage);
      }

      setIsCompleting(false);
    } finally {
      if (isMountedRef.current && markSaving) {
        markSaving(task.id, false);
      }
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (isSaving) return; // Prevent duplicate requests

    const previousTask = previousTaskRef.current;

    // Create optimistically updated task
    const optimisticTask = {
      ...task,
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Mark as saving
    if (markSaving) markSaving(task.id, true);

    // Optimistically update UI
    onUpdate(optimisticTask, null, 'update');

    try {
      // Make API call in background
      const updatedTask = await tasksAPI.updateTask(task.id, { status: newStatus });

      if (!isMountedRef.current) return;

      // Update with real data from server
      onUpdate(updatedTask, null, 'update');
    } catch (error) {
      if (!isMountedRef.current) return;

      // Rollback to previous state
      onUpdate(previousTask, null, 'update');

      // Show error
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update status';
      if (onError) {
        onError(errorMessage, task.id);
      } else {
        await alert('Failed to update status', errorMessage);
      }
    } finally {
      if (isMountedRef.current && markSaving) {
        markSaving(task.id, false);
      }
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm('Delete task?', 'Are you sure you want to delete this task?', 'Delete', 'Cancel');
    if (!confirmed) return;
    if (isSaving) return; // Prevent duplicate requests

    const previousTask = previousTaskRef.current;

    // Mark as saving
    if (markSaving) markSaving(task.id, true);

    // Optimistically remove from UI
    onUpdate(null, task.id, 'delete');

    try {
      // Make API call in background
      await tasksAPI.deleteTask(task.id);

      if (!isMountedRef.current) return;

      // Task successfully deleted, already removed from UI
    } catch (error) {
      if (!isMountedRef.current) return;

      // Restore task to UI
      onUpdate(previousTask, null, 'update');

      // Show error
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete task';
      if (onError) {
        onError(errorMessage, task.id);
      } else {
        await alert('Failed to delete task', errorMessage);
      }
    } finally {
      if (isMountedRef.current && markSaving) {
        markSaving(task.id, false);
      }
    }
  };

  const handleRestore = async () => {
    if (isSaving) return; // Prevent duplicate requests

    const previousTask = previousTaskRef.current;

    // Create optimistically updated task
    const optimisticTask = {
      ...task,
      status: 'not_started',
      updated_at: new Date().toISOString()
    };

    // Mark as saving
    if (markSaving) markSaving(task.id, true);

    // Optimistically update UI
    onUpdate(optimisticTask, null, 'restore');

    try {
      // Make API call in background
      const updatedTask = await tasksAPI.restoreTask(task.id);

      if (!isMountedRef.current) return;

      // Update with real data from server
      onUpdate(updatedTask, null, 'restore');
    } catch (error) {
      if (!isMountedRef.current) return;

      // Rollback to previous state
      onUpdate(previousTask, null, 'update');

      // Show error
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to restore task';
      if (onError) {
        onError(errorMessage, task.id);
      } else {
        await alert('Failed to restore task', errorMessage);
      }
    } finally {
      if (isMountedRef.current && markSaving) {
        markSaving(task.id, false);
      }
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

    // Prevent saving if already saving
    if (isSaving) return;

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

    // Save previous state for rollback
    const previousTask = previousTaskRef.current;

    // Create optimistically updated task
    const optimisticTask = {
      ...task,
      ...updateData,
      updated_at: new Date().toISOString()
    };

    // Mark as saving
    if (markSaving) markSaving(task.id, true);

    // Optimistically update UI
    onUpdate(optimisticTask, null, 'update');
    setIsEditing(false);

    try {
      // Make API call in background
      const updatedTask = await tasksAPI.updateTask(task.id, updateData);

      // Only update if component is still mounted
      if (!isMountedRef.current) return;

      // Update with real data from server
      onUpdate(updatedTask, null, 'update');
    } catch (error) {
      // Only handle error if component is still mounted
      if (!isMountedRef.current) return;

      // Rollback to previous state
      onUpdate(previousTask, null, 'update');

      // Show error to user
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update task';
      if (onError) {
        onError(errorMessage, task.id);
      } else {
        await alert('Failed to update task', errorMessage);
      }

      setIsEditing(true); // Re-open edit form
    } finally {
      // Clear saving state
      if (isMountedRef.current && markSaving) {
        markSaving(task.id, false);
      }
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const intensityStyle = getIntensityStyle(task.intensity);
  const statusStyle = getStatusStyle(task.status);
  const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;

  // If editing, show edit form
  if (isEditing) {
    return (
      <>
        <ConfirmDialog />
        <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #eee',
        padding: '20px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '600',
            color: '#000',
            margin: 0,
          }}>
            Edit Task
          </h3>
        </div>

        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="title" style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
            }}>
              Title
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
                padding: '10px 12px',
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
          </div>

          <div>
            <label htmlFor="description" style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
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
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #eee',
                borderRadius: '6px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
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
          </div>

          <div>
            <label htmlFor="project" style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
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
                padding: '10px 12px',
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
          </div>

          <div className="task-form-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="deadline" style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '6px',
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
                  padding: '10px 12px',
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
            </div>

            <div>
              <label htmlFor="intensity" style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '6px',
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
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #eee',
                  borderRadius: '6px',
                  outline: 'none',
                  background: '#fafafa',
                  cursor: 'pointer',
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
              fontSize: '12px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
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
                padding: '10px 12px',
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
          </div>

          {/* Recurring Task Section */}
          <div style={{
            borderTop: '1px solid #eee',
            paddingTop: '16px',
            marginTop: '4px',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: formData.is_recurring ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                name="is_recurring"
                checked={formData.is_recurring}
                onChange={handleChange}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  accentColor: '#000',
                }}
              />
              <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#666',
              }}>
                Make this a recurring task
              </span>
            </label>

            {formData.is_recurring && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                  <div>
                    <label htmlFor="recurrence_type" style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#999',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
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
                        padding: '10px 12px',
                        fontSize: '13px',
                        border: '1px solid #eee',
                        borderRadius: '6px',
                        outline: 'none',
                        background: '#fafafa',
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
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#999',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
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
                        padding: '10px 12px',
                        fontSize: '13px',
                        border: '1px solid #eee',
                        borderRadius: '6px',
                        outline: 'none',
                        background: '#fafafa',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="recurrence_end_date" style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#999',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '6px',
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
                      padding: '10px 12px',
                      fontSize: '13px',
                      border: '1px solid #eee',
                      borderRadius: '6px',
                      outline: 'none',
                      background: '#fafafa',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '8px' }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#fff',
                background: isSaving ? '#ccc' : '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSaving) e.target.style.background = '#333';
              }}
              onMouseLeave={(e) => {
                if (!isSaving) e.target.style.background = '#000';
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              style={{
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: '500',
                color: isSaving ? '#ccc' : '#666',
                background: 'transparent',
                border: '1px solid #eee',
                borderRadius: '6px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSaving) e.target.style.background = '#fafafa';
              }}
              onMouseLeave={(e) => {
                if (!isSaving) e.target.style.background = 'transparent';
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      </>
    );
  }

  // Otherwise show normal task view
  return (
    <>
      <ConfirmDialog />
      <div className="task-item" style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #eee',
      padding: isMobile ? '14px' : '16px 20px',
      transition: 'all 0.2s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = '#fafafa';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = '#fff';
    }}
    >
      <div className="task-item-header" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? '12px' : '16px' }}>
        {/* Main Content */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <h3 style={{
              fontSize: '15px',
              fontWeight: '500',
              color: '#000',
              margin: 0,
            }}>
              {task.title}
            </h3>

            {isSaving && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '500',
                background: '#f5f5f5',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  border: '1.5px solid #666',
                  borderTop: '1.5px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}></span>
                Saving
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: task.description ? '8px' : '0' }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '500',
              background: intensityStyle.bg,
              color: intensityStyle.text,
            }}>
              {task.intensity}
            </span>

            <span style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '500',
              background: statusStyle.bg,
              color: statusStyle.text,
            }}>
              {task.status.replace('_', ' ')}
            </span>

            {task.is_recurring && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '500',
                background: '#f5f5f5',
                color: '#666',
              }}>
                Recurring
              </span>
            )}

            {task.project && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '500',
                background: '#f5f5f5',
                color: '#666',
              }}>
                {task.project}
              </span>
            )}
          </div>

          {task.description && (
            <p style={{
              fontSize: '13px',
              color: '#666',
              lineHeight: '1.5',
              marginBottom: '8px',
              margin: 0,
            }}>
              {task.description}
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', marginTop: '8px' }}>
            {deadlineInfo && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
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
                gap: '4px',
                color: '#666',
              }}>
                Waiting on: {task.waiting_on}
              </div>
            )}

            {formatRecurrence() && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#999',
              }}>
                {formatRecurrence()}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="task-item-actions" style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: '6px', flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
          {task.status === 'deleted' ? (
            <button
              onClick={handleRestore}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '500',
                color: '#000',
                background: '#f5f5f5',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#eee';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f5f5f5';
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
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#fff',
                      background: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isCompleting ? 'not-allowed' : 'pointer',
                      opacity: isCompleting ? 0.6 : 1,
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCompleting) e.target.style.background = '#333';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#000';
                    }}
                  >
                    Done
                  </button>

                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#f5f5f5',
                      cursor: 'pointer',
                      outline: 'none',
                      color: '#666',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#eee';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#f5f5f5';
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
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#666',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#eee';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f5f5f5';
                }}
              >
                Edit
              </button>

              <button
                onClick={handleDelete}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#999',
                  background: 'transparent',
                  border: '1px solid #eee',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#fafafa';
                  e.target.style.color = '#666';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#999';
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default TaskItem;
