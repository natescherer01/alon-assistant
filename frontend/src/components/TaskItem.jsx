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
  const [isHovered, setIsHovered] = useState(false);
  const isMountedRef = useRef(true);
  const previousTaskRef = useRef(task);
  const titleInputRef = useRef(null);

  useEffect(() => {
    previousTaskRef.current = task;
  }, [task]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);

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

  const formatDeadline = (deadline) => {
    if (!deadline) return null;
    const userTimezone = user?.timezone || 'UTC';
    const deadlineDate = new Date(deadline + 'T00:00:00');
    const now = new Date();
    const todayInUserTz = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    const today = new Date(todayInUserTz.getFullYear(), todayInUserTz.getMonth(), todayInUserTz.getDate());
    const deadlineDateOnly = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    const diffTime = deadlineDateOnly - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Today', isOverdue: false, isToday: true };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', isOverdue: false };
    } else if (diffDays <= 7) {
      return { text: `${diffDays}d`, isOverdue: false };
    } else {
      const options = { month: 'short', day: 'numeric' };
      return { text: deadlineDate.toLocaleDateString('en-US', options), isOverdue: false };
    }
  };

  const handleComplete = async () => {
    if (isSaving || isCompleting) return;

    setIsCompleting(true);
    const previousTask = previousTaskRef.current;

    const optimisticTask = {
      ...task,
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (markSaving) markSaving(task.id, true);
    onUpdate(optimisticTask, null, 'complete');

    try {
      const updatedTask = await tasksAPI.completeTask(task.id);
      if (!isMountedRef.current) return;
      onUpdate(updatedTask, null, 'complete');
    } catch (error) {
      if (!isMountedRef.current) return;
      onUpdate(previousTask, null, 'update');
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to complete task';
      if (onError) {
        onError(errorMessage, task.id);
      }
    } finally {
      if (isMountedRef.current) {
        setIsCompleting(false);
        if (markSaving) markSaving(task.id, false);
      }
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (isSaving) return;
    const previousTask = previousTaskRef.current;
    const optimisticTask = { ...task, status: newStatus, updated_at: new Date().toISOString() };

    if (markSaving) markSaving(task.id, true);
    onUpdate(optimisticTask, null, 'update');

    try {
      const updatedTask = await tasksAPI.updateTask(task.id, { status: newStatus });
      if (!isMountedRef.current) return;
      onUpdate(updatedTask, null, 'update');
    } catch (error) {
      if (!isMountedRef.current) return;
      onUpdate(previousTask, null, 'update');
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update status';
      if (onError) onError(errorMessage, task.id);
    } finally {
      if (isMountedRef.current && markSaving) markSaving(task.id, false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm('Delete task?', 'This will move the task to trash.', 'Delete', 'Cancel');
    if (!confirmed || isSaving) return;

    const previousTask = previousTaskRef.current;
    if (markSaving) markSaving(task.id, true);
    onUpdate(null, task.id, 'delete');

    try {
      await tasksAPI.deleteTask(task.id);
    } catch (error) {
      if (!isMountedRef.current) return;
      onUpdate(previousTask, null, 'update');
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete task';
      if (onError) onError(errorMessage, task.id);
    } finally {
      if (isMountedRef.current && markSaving) markSaving(task.id, false);
    }
  };

  const handleRestore = async () => {
    if (isSaving) return;
    const previousTask = previousTaskRef.current;
    const optimisticTask = { ...task, status: 'not_started', updated_at: new Date().toISOString() };

    if (markSaving) markSaving(task.id, true);
    onUpdate(optimisticTask, null, 'restore');

    try {
      const updatedTask = await tasksAPI.restoreTask(task.id);
      if (!isMountedRef.current) return;
      onUpdate(updatedTask, null, 'restore');
    } catch (error) {
      if (!isMountedRef.current) return;
      onUpdate(previousTask, null, 'update');
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to restore task';
      if (onError) onError(errorMessage, task.id);
    } finally {
      if (isMountedRef.current && markSaving) markSaving(task.id, false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
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
    if (isSaving) return;

    const updateData = {
      title: formData.title,
      description: formData.description,
      intensity: parseInt(formData.intensity),
      is_recurring: formData.is_recurring,
    };

    if (formData.project) updateData.project = formData.project;
    if (formData.deadline) updateData.deadline = formData.deadline;
    if (formData.waiting_on) updateData.waiting_on = formData.waiting_on;

    if (formData.is_recurring) {
      updateData.recurrence_type = formData.recurrence_type;
      updateData.recurrence_interval = parseInt(formData.recurrence_interval);
      if (formData.recurrence_end_date) updateData.recurrence_end_date = formData.recurrence_end_date;
    }

    const previousTask = previousTaskRef.current;
    const optimisticTask = { ...task, ...updateData, updated_at: new Date().toISOString() };

    if (markSaving) markSaving(task.id, true);
    onUpdate(optimisticTask, null, 'update');
    setIsEditing(false);

    try {
      const updatedTask = await tasksAPI.updateTask(task.id, updateData);
      if (!isMountedRef.current) return;
      onUpdate(updatedTask, null, 'update');
    } catch (error) {
      if (!isMountedRef.current) return;
      onUpdate(previousTask, null, 'update');
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update task';
      if (onError) onError(errorMessage, task.id);
      setIsEditing(true);
    } finally {
      if (isMountedRef.current && markSaving) markSaving(task.id, false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
  const isDeleted = task.status === 'deleted';
  const isCompleted = task.status === 'completed';
  const isWaiting = task.status === 'waiting_on';
  const isInProgress = task.status === 'in_progress';

  // Edit mode
  if (isEditing) {
    return (
      <>
        <ConfirmDialog />
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          padding: isMobile ? '16px' : '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <form onSubmit={handleSaveEdit} onKeyDown={handleKeyDown}>
            <input
              ref={titleInputRef}
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              placeholder="Task title"
              style={{
                width: '100%',
                padding: '8px 0',
                fontSize: '15px',
                fontWeight: '500',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                marginBottom: '12px',
              }}
            />

            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add notes..."
              rows={2}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #e5e5e5',
                borderRadius: '6px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                background: '#fafafa',
                marginBottom: '12px',
              }}
            />

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '12px',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  Project
                </label>
                <input
                  type="text"
                  name="project"
                  value={formData.project}
                  onChange={handleChange}
                  placeholder="None"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    outline: 'none',
                    background: '#fafafa',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  Due date
                </label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    outline: 'none',
                    background: '#fafafa',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  Priority
                </label>
                <select
                  name="intensity"
                  value={formData.intensity}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    outline: 'none',
                    background: '#fafafa',
                    cursor: 'pointer',
                  }}
                >
                  <option value={1}>P4 - Low</option>
                  <option value={2}>P3</option>
                  <option value={3}>P2</option>
                  <option value={4}>P1</option>
                  <option value={5}>P0 - Critical</option>
                </select>
              </div>
            </div>

            {/* Waiting On */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                Waiting on (optional)
              </label>
              <input
                type="text"
                name="waiting_on"
                value={formData.waiting_on}
                onChange={handleChange}
                placeholder="Person or thing you're waiting on"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  outline: 'none',
                  background: '#fafafa',
                }}
              />
            </div>

            {/* Recurring */}
            <div style={{
              borderTop: '1px solid #eee',
              paddingTop: '12px',
              marginBottom: '16px',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="is_recurring"
                  checked={formData.is_recurring}
                  onChange={handleChange}
                  style={{ width: '14px', height: '14px', accentColor: '#000' }}
                />
                <span style={{ fontSize: '13px', color: '#666' }}>Repeat this task</span>
              </label>

              {formData.is_recurring && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 80px 1fr',
                  gap: '8px',
                  marginTop: '12px',
                  paddingLeft: '22px',
                }}>
                  <select
                    name="recurrence_type"
                    value={formData.recurrence_type}
                    onChange={handleChange}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      outline: 'none',
                      background: '#fafafa',
                    }}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>

                  <input
                    type="number"
                    name="recurrence_interval"
                    min="1"
                    value={formData.recurrence_interval}
                    onChange={handleChange}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      outline: 'none',
                      background: '#fafafa',
                      textAlign: 'center',
                    }}
                  />

                  <input
                    type="date"
                    name="recurrence_end_date"
                    value={formData.recurrence_end_date}
                    onChange={handleChange}
                    placeholder="End date"
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      outline: 'none',
                      background: '#fafafa',
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#fff',
                  background: isSaving ? '#999' : '#000',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </>
    );
  }

  // Normal view
  return (
    <>
      <ConfirmDialog />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: isMobile ? '12px 0' : '10px 0',
          borderBottom: '1px solid #f0f0f0',
          background: isHovered && !isMobile ? '#fafafa' : 'transparent',
          marginLeft: isMobile ? 0 : '-8px',
          marginRight: isMobile ? 0 : '-8px',
          paddingLeft: isMobile ? 0 : '8px',
          paddingRight: isMobile ? 0 : '8px',
          borderRadius: '6px',
          transition: 'background 0.1s ease',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Checkbox */}
        <button
          onClick={isDeleted ? handleRestore : (isCompleted ? null : handleComplete)}
          disabled={isCompleting || isSaving}
          style={{
            width: '20px',
            height: '20px',
            minWidth: '20px',
            marginTop: '2px',
            borderRadius: '50%',
            border: isCompleted
              ? '2px solid #22c55e'
              : isDeleted
                ? '2px solid #d1d5db'
                : `2px solid ${isHovered || isMobile ? '#9ca3af' : '#d1d5db'}`,
            background: isCompleted
              ? '#22c55e'
              : 'transparent',
            cursor: isCompleting || isSaving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            opacity: isCompleting || isSaving ? 0.5 : 1,
          }}
          title={isDeleted ? 'Restore' : (isCompleted ? 'Completed' : 'Complete task')}
        >
          {isCompleted && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {isDeleted && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div
          style={{ flex: 1, minWidth: 0, cursor: isDeleted || isCompleted ? 'default' : 'pointer' }}
          onClick={() => !isDeleted && !isCompleted && setIsEditing(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '14px',
              fontWeight: '400',
              color: isCompleted || isDeleted ? '#9ca3af' : '#111',
              textDecoration: isCompleted ? 'line-through' : 'none',
              lineHeight: '1.4',
            }}>
              {task.title}
            </span>

            {/* Priority indicator */}
            {task.intensity >= 4 && !isCompleted && !isDeleted && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                borderRadius: '3px',
                background: task.intensity === 5 ? '#dc2626' : '#f97316',
                color: '#fff',
                fontSize: '10px',
                fontWeight: '600',
              }}>
                {task.intensity === 5 ? '!' : 'P'}
              </span>
            )}

            {/* Recurring indicator */}
            {task.is_recurring && !isCompleted && !isDeleted && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            )}

            {isSaving && (
              <span style={{
                width: '14px',
                height: '14px',
                border: '2px solid #e5e5e5',
                borderTop: '2px solid #666',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p style={{
              fontSize: '13px',
              color: '#6b7280',
              margin: '4px 0 0 0',
              lineHeight: '1.4',
              textDecoration: isCompleted ? 'line-through' : 'none',
            }}>
              {task.description}
            </p>
          )}

          {/* Meta row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: '6px',
            flexWrap: 'wrap',
          }}>
            {/* Project */}
            {task.project && (
              <span style={{
                fontSize: '12px',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                {task.project}
              </span>
            )}

            {/* Deadline */}
            {deadlineInfo && !isCompleted && !isDeleted && (
              <span style={{
                fontSize: '12px',
                color: deadlineInfo.isOverdue ? '#dc2626' : deadlineInfo.isToday ? '#ea580c' : '#6b7280',
                fontWeight: deadlineInfo.isOverdue || deadlineInfo.isToday ? '500' : '400',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {deadlineInfo.text}
              </span>
            )}

            {/* Waiting on */}
            {isWaiting && task.waiting_on && (
              <span style={{
                fontSize: '12px',
                color: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Waiting: {task.waiting_on}
              </span>
            )}

            {/* In progress indicator */}
            {isInProgress && !isCompleted && !isDeleted && (
              <span style={{
                fontSize: '12px',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                In progress
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {(isHovered || isMobile) && !isDeleted && !isCompleted && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}>
            {/* Status dropdown */}
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer',
                outline: 'none',
                color: '#666',
              }}
            >
              <option value="not_started">To Do</option>
              <option value="in_progress">Doing</option>
              <option value="waiting_on">Waiting</option>
            </select>

            {/* Delete button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              style={{
                padding: '4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
              }}
              title="Delete"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        )}

        {/* Deleted actions */}
        {isDeleted && (isHovered || isMobile) && (
          <button
            onClick={(e) => { e.stopPropagation(); handleRestore(); }}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#666',
              background: '#f5f5f5',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Restore
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

export default TaskItem;
