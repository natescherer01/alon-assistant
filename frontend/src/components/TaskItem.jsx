import { useState, useEffect, useRef } from 'react';
import { tasksAPI } from '../api/client';
import useConfirm from '../hooks/useConfirm';
import useAuthStore from '../utils/authStore';
import { useIsMobile } from '../hooks/useIsMobile';

function TaskItem({ task, onUpdate, onDelete, onError, markSaving, isSaving = false, isLast = false }) {
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

  // Shared input styles
  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '10px',
    outline: 'none',
    background: '#fafafa',
    transition: 'all 0.2s ease',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: '6px',
    letterSpacing: '0.01em',
  };

  // Edit mode
  if (isEditing) {
    return (
      <>
        <ConfirmDialog />
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
          margin: isMobile ? '12px 16px' : '12px 20px',
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
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                marginBottom: '16px',
                color: '#111',
                letterSpacing: '-0.01em',
              }}
            />

            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add notes..."
              rows={2}
              style={{
                ...inputStyle,
                resize: 'none',
                fontFamily: 'inherit',
                marginBottom: '16px',
              }}
            />

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: '14px',
              marginBottom: '16px',
            }}>
              <div>
                <label style={labelStyle}>Project</label>
                <input
                  type="text"
                  name="project"
                  value={formData.project}
                  onChange={handleChange}
                  placeholder="None"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Due date</label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Priority</label>
                <select
                  name="intensity"
                  value={formData.intensity}
                  onChange={handleChange}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value={1}>P4 - Low</option>
                  <option value={2}>P3</option>
                  <option value={3}>P2</option>
                  <option value={4}>P1 - High</option>
                  <option value={5}>P0 - Critical</option>
                </select>
              </div>
            </div>

            {/* Waiting On */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Waiting on (optional)</label>
              <input
                type="text"
                name="waiting_on"
                value={formData.waiting_on}
                onChange={handleChange}
                placeholder="Person or thing you're waiting on"
                style={inputStyle}
              />
            </div>

            {/* Recurring */}
            <div style={{
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
              paddingTop: '16px',
              marginBottom: '20px',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '5px',
                  border: formData.is_recurring ? 'none' : '1.5px solid rgba(0, 0, 0, 0.2)',
                  background: formData.is_recurring ? '#111' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}>
                  {formData.is_recurring && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  name="is_recurring"
                  checked={formData.is_recurring}
                  onChange={handleChange}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '14px', color: '#374151', fontWeight: '450' }}>Repeat this task</span>
              </label>

              {formData.is_recurring && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 80px 1fr',
                  gap: '10px',
                  marginTop: '14px',
                  paddingLeft: '28px',
                }}>
                  <select
                    name="recurrence_type"
                    value={formData.recurrence_type}
                    onChange={handleChange}
                    style={{ ...inputStyle, cursor: 'pointer' }}
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
                    style={{ ...inputStyle, textAlign: 'center' }}
                  />

                  <input
                    type="date"
                    name="recurrence_end_date"
                    value={formData.recurrence_end_date}
                    onChange={handleChange}
                    placeholder="End date"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#6b7280',
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#fff',
                  background: isSaving ? '#9ca3af' : '#111',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
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

  // Get status label and color
  const getStatusInfo = (status) => {
    switch (status) {
      case 'not_started':
        return { label: 'To Do', color: '#6b7280', bg: '#f3f4f6' };
      case 'in_progress':
        return { label: 'In Progress', color: '#2563eb', bg: '#eff6ff' };
      case 'waiting_on':
        return { label: 'Waiting', color: '#7c3aed', bg: '#f5f3ff' };
      case 'completed':
        return { label: 'Done', color: '#059669', bg: '#ecfdf5' };
      default:
        return { label: 'To Do', color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const statusInfo = getStatusInfo(task.status);

  // Get priority info
  const getPriorityInfo = (intensity) => {
    switch (intensity) {
      case 5:
        return { label: 'P0', color: '#dc2626', bg: '#fef2f2' };
      case 4:
        return { label: 'P1', color: '#ea580c', bg: '#fff7ed' };
      case 3:
        return { label: 'P2', color: '#d97706', bg: '#fffbeb' };
      case 2:
        return { label: 'P3', color: '#6b7280', bg: '#f3f4f6' };
      default:
        return { label: 'P4', color: '#9ca3af', bg: '#f9fafb' };
    }
  };

  const priorityInfo = getPriorityInfo(task.intensity);

  // Mobile view - simpler layout
  if (isMobile) {
    return (
      <>
        <ConfirmDialog />
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px 16px',
            borderBottom: isLast ? 'none' : '1px solid #e5e7eb',
            background: isHovered ? '#f9fafb' : 'transparent',
            cursor: isDeleted || isCompleted ? 'default' : 'pointer',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => !isDeleted && !isCompleted && setIsEditing(true)}
        >
          {/* Checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isDeleted) handleRestore();
              else if (!isCompleted) handleComplete();
            }}
            disabled={isCompleting || isSaving}
            style={{
              width: '20px',
              height: '20px',
              minWidth: '20px',
              marginTop: '2px',
              borderRadius: '6px',
              border: isCompleted ? 'none' : '2px solid #d1d5db',
              background: isCompleted ? '#059669' : '#fff',
              cursor: isCompleting || isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              opacity: isCompleting || isSaving ? 0.5 : 1,
            }}
          >
            {isCompleted && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: isCompleted || isDeleted ? '#9ca3af' : '#111827',
                textDecoration: isCompleted ? 'line-through' : 'none',
              }}>
                {task.title}
              </span>
              {task.intensity >= 4 && !isCompleted && !isDeleted && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: priorityInfo.bg,
                  color: priorityInfo.color,
                  fontSize: '10px',
                  fontWeight: '600',
                }}>
                  {priorityInfo.label}
                </span>
              )}
            </div>

            {task.description && (
              <p style={{
                fontSize: '13px',
                color: '#6b7280',
                margin: '4px 0 0 0',
                textDecoration: isCompleted ? 'line-through' : 'none',
              }}>
                {task.description}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {deadlineInfo && !isCompleted && !isDeleted && (
                <span style={{
                  fontSize: '12px',
                  color: deadlineInfo.isOverdue ? '#dc2626' : deadlineInfo.isToday ? '#ea580c' : '#6b7280',
                  fontWeight: deadlineInfo.isOverdue || deadlineInfo.isToday ? '500' : '400',
                }}>
                  {deadlineInfo.text}
                </span>
              )}
              {!isCompleted && !isDeleted && (
                <select
                  value={task.status}
                  onChange={(e) => { e.stopPropagation(); handleStatusChange(e.target.value); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    background: '#fff',
                    cursor: 'pointer',
                    outline: 'none',
                    color: '#374151',
                  }}
                >
                  <option value="not_started">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_on">Waiting</option>
                </select>
              )}
            </div>
          </div>

          {/* Delete */}
          {!isDeleted && !isCompleted && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              style={{
                padding: '6px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#9ca3af',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}

          {isDeleted && (
            <button
              onClick={(e) => { e.stopPropagation(); handleRestore(); }}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '500',
                color: '#374151',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Restore
            </button>
          )}
        </div>
      </>
    );
  }

  // Desktop view - table row layout
  return (
    <>
      <ConfirmDialog />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 140px 120px 100px 80px',
          gap: '12px',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
          background: isHovered ? '#f9fafb' : 'transparent',
          transition: 'background 0.1s ease',
          cursor: isDeleted || isCompleted ? 'default' : 'pointer',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => !isDeleted && !isCompleted && setIsEditing(true)}
      >
        {/* Checkbox Column */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isDeleted) handleRestore();
              else if (!isCompleted) handleComplete();
            }}
            disabled={isCompleting || isSaving}
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              border: isCompleted
                ? 'none'
                : isDeleted
                  ? '2px solid #d1d5db'
                  : '2px solid #d1d5db',
              background: isCompleted ? '#059669' : '#fff',
              cursor: isCompleting || isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              opacity: isCompleting || isSaving ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isCompleted && !isDeleted && !isCompleting && !isSaving) {
                e.currentTarget.style.borderColor = '#9ca3af';
                e.currentTarget.style.background = '#f9fafb';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCompleted && !isDeleted) {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.background = '#fff';
              }
            }}
          >
            {isCompleted && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {isDeleted && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            )}
          </button>
        </div>

        {/* Task Title & Description Column */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '14px',
              fontWeight: '500',
              color: isCompleted || isDeleted ? '#9ca3af' : '#111827',
              textDecoration: isCompleted ? 'line-through' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {task.title}
            </span>
            {task.is_recurring && !isCompleted && !isDeleted && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            )}
            {isSaving && (
              <span style={{
                width: '12px',
                height: '12px',
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #111827',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            )}
          </div>
          {task.description && (
            <p style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: '2px 0 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textDecoration: isCompleted ? 'line-through' : 'none',
            }}>
              {task.description}
            </p>
          )}
          {task.project && (
            <span style={{
              fontSize: '11px',
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '2px',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              {task.project}
            </span>
          )}
        </div>

        {/* Status Column - Always visible */}
        <div onClick={(e) => e.stopPropagation()}>
          {isCompleted ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '12px',
              fontWeight: '500',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Done
            </span>
          ) : isDeleted ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '6px',
              background: '#f3f4f6',
              color: '#6b7280',
              fontSize: '12px',
              fontWeight: '500',
            }}>
              Deleted
            </span>
          ) : (
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: '500',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: '#fff',
                cursor: 'pointer',
                outline: 'none',
                color: '#374151',
                width: '100%',
                maxWidth: '120px',
              }}
            >
              <option value="not_started">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_on">Waiting</option>
            </select>
          )}
        </div>

        {/* Due Date Column */}
        <div>
          {deadlineInfo && !isCompleted && !isDeleted ? (
            <span style={{
              fontSize: '12px',
              fontWeight: deadlineInfo.isOverdue || deadlineInfo.isToday ? '500' : '400',
              color: deadlineInfo.isOverdue ? '#dc2626' : deadlineInfo.isToday ? '#ea580c' : '#6b7280',
              padding: deadlineInfo.isOverdue || deadlineInfo.isToday ? '4px 8px' : '0',
              background: deadlineInfo.isOverdue ? '#fef2f2' : deadlineInfo.isToday ? '#fff7ed' : 'transparent',
              borderRadius: '4px',
              display: 'inline-block',
            }}>
              {deadlineInfo.text}
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: '#d1d5db' }}>—</span>
          )}
        </div>

        {/* Priority Column */}
        <div>
          {!isCompleted && !isDeleted ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 8px',
              borderRadius: '4px',
              background: priorityInfo.bg,
              color: priorityInfo.color,
              fontSize: '11px',
              fontWeight: '600',
            }}>
              {priorityInfo.label}
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: '#d1d5db' }}>—</span>
          )}
        </div>

        {/* Actions Column */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          {isDeleted ? (
            <button
              onClick={handleRestore}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '500',
                color: '#374151',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
            >
              Restore
            </button>
          ) : !isCompleted ? (
            <button
              onClick={handleDelete}
              style={{
                padding: '6px',
                background: isHovered ? '#f3f4f6' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isHovered ? '#f3f4f6' : 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }}
              title="Delete"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          ) : null}
        </div>
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
