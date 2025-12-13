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

  // Expanded form
  if (isExpanded) {
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
          <form onSubmit={handleExpandedSubmit} onKeyDown={handleKeyDown}>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task name"
              required
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
              placeholder="Description (optional)"
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
                  <option value={3}>P2 - Normal</option>
                  <option value={4}>P1 - High</option>
                  <option value={5}>P0 - Critical</option>
                </select>
              </div>
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
                onClick={resetForm}
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#fff',
                  background: isSubmitting || !title.trim() ? '#999' : '#000',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmitting || !title.trim() ? 'not-allowed' : 'pointer',
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
      <form onSubmit={handleQuickAdd} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          padding: '0 12px',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a task..."
            style={{
              flex: 1,
              padding: '12px 0',
              fontSize: '14px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
            }}
          />
          {title.trim() && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                color: '#666',
                background: '#f5f5f5',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="More options"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
              More
            </button>
          )}
        </div>
        {title.trim() && (
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#fff',
              background: isSubmitting ? '#666' : '#000',
              border: 'none',
              borderRadius: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {isSubmitting ? 'Adding...' : 'Add'}
          </button>
        )}
      </form>
    </>
  );
}

export default AddTaskForm;
