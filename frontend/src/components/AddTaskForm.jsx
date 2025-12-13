import { useState, useRef, useEffect } from 'react';
import { tasksAPI } from '../api/client';
import useConfirm from '../hooks/useConfirm';
import { useIsMobile } from '../hooks/useIsMobile';

function AddTaskForm({ onTaskAdded }) {
  const isMobile = useIsMobile(768);
  const inputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    project: '',
    deadline: '',
    intensity: 3,
    is_recurring: false,
    recurrence_type: 'daily',
    recurrence_interval: 1,
    recurrence_end_date: '',
  });

  const { ConfirmDialog, alert } = useConfirm();

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const resetForm = () => {
    setTitle('');
    setFormData({
      description: '',
      project: '',
      deadline: '',
      intensity: 3,
      is_recurring: false,
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_end_date: '',
    });
    setIsExpanded(false);
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const taskData = {
        title: title.trim(),
        intensity: 3,
        is_recurring: false,
      };

      const newTask = await tasksAPI.createTask(taskData);
      setTitle('');
      onTaskAdded(newTask, null, 'add');
    } catch (error) {
      await alert('Error', error.response?.data?.detail || error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExpandedSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const taskData = {
        title: title.trim(),
        description: formData.description,
        intensity: parseInt(formData.intensity),
        is_recurring: formData.is_recurring,
      };

      if (formData.project) taskData.project = formData.project;
      if (formData.deadline) taskData.deadline = formData.deadline;

      if (formData.is_recurring) {
        taskData.recurrence_type = formData.recurrence_type;
        taskData.recurrence_interval = parseInt(formData.recurrence_interval);
        if (formData.recurrence_end_date) taskData.recurrence_end_date = formData.recurrence_end_date;
      }

      const newTask = await tasksAPI.createTask(taskData);
      resetForm();
      onTaskAdded(newTask, null, 'add');
    } catch (error) {
      await alert('Error', error.response?.data?.detail || error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (isExpanded) {
        resetForm();
      } else {
        setTitle('');
        inputRef.current?.blur();
      }
    }
  };

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

  // Expanded form
  if (isExpanded) {
    return (
      <>
        <ConfirmDialog />
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
        }}>
          <form onSubmit={handleExpandedSubmit} onKeyDown={handleKeyDown}>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              style={{
                width: '100%',
                padding: '8px 0',
                fontSize: '17px',
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
              placeholder="Add notes or details..."
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
                  <option value={3}>P2 - Normal</option>
                  <option value={4}>P1 - High</option>
                  <option value={5}>P0 - Critical</option>
                </select>
              </div>
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
                  borderRadius: '2px',
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
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#6b7280',
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#fff',
                  background: isSubmitting || !title.trim() ? '#9ca3af' : '#111',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: isSubmitting || !title.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {isSubmitting ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </form>
        </div>
      </>
    );
  }

  // Quick add input
  return (
    <>
      <ConfirmDialog />
      <form onSubmit={handleQuickAdd}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#fff',
          border: `1px solid ${isFocused || title.trim() ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
          borderRadius: '14px',
          padding: '6px 8px 6px 18px',
          transition: 'all 0.2s ease',
          boxShadow: isFocused || title.trim()
            ? '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)'
            : '0 2px 12px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '6px',
            border: '1.5px dashed rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Add a new task..."
            style={{
              flex: 1,
              padding: '12px 0',
              fontSize: '15px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: '#111',
              fontWeight: '450',
            }}
          />

          {title.trim() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: '450',
                  color: '#6b7280',
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
                title="More options"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
                <span style={{ display: isMobile ? 'none' : 'inline' }}>More</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '8px 18px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#fff',
                  background: isSubmitting ? '#9ca3af' : '#111',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSubmitting ? (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <span style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid #fff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    Adding
                  </span>
                ) : 'Add'}
              </button>
            </div>
          )}
        </div>
      </form>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

export default AddTaskForm;
