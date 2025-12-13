import { useState } from 'react';
import { tasksAPI } from '../api/client';
import useConfirm from '../hooks/useConfirm';
import { useIsMobile } from '../hooks/useIsMobile';

function AddTaskForm({ onTaskAdded }) {
  const isMobile = useIsMobile(768);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const taskData = {
        title: formData.title,
        description: formData.description,
        intensity: parseInt(formData.intensity),
        is_recurring: formData.is_recurring,
      };

      if (formData.project) {
        taskData.project = formData.project;
      }

      if (formData.deadline) {
        taskData.deadline = formData.deadline;
      }

      // Only include recurrence data if task is recurring
      if (formData.is_recurring) {
        taskData.recurrence_type = formData.recurrence_type;
        taskData.recurrence_interval = parseInt(formData.recurrence_interval);
        if (formData.recurrence_end_date) {
          taskData.recurrence_end_date = formData.recurrence_end_date;
        }
      }

      // Create task and get the response
      const newTask = await tasksAPI.createTask(taskData);

      // Reset form
      setFormData({
        title: '',
        description: '',
        project: '',
        deadline: '',
        intensity: 3,
        is_recurring: false,
        recurrence_type: 'daily',
        recurrence_interval: 1,
        recurrence_end_date: '',
      });

      setIsOpen(false);

      // Pass the new task to parent for optimistic update
      onTaskAdded(newTask, null, 'add');
    } catch (error) {
      await alert('Failed to create task', error.response?.data?.detail || error.message);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  if (!isOpen) {
    return (
      <>
        <ConfirmDialog />
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#666',
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#fafafa';
            e.target.style.borderColor = '#ddd';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#fff';
            e.target.style.borderColor = '#eee';
          }}
        >
          + Add task
        </button>
      </>
    );
  }

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
            Add Task
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: '#999',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f5f5f5';
              e.target.style.color = '#666';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = '#999';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              placeholder="What needs to be done?"
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
              rows={2}
              placeholder="Additional details..."
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
              placeholder="e.g., Work, Personal"
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: isMobile ? '0' : '24px' }}>
                <div className="recurrence-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '8px' }}>
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
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#fff',
                background: '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#333';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#000';
              }}
            >
              Add Task
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#666',
                background: 'transparent',
                border: '1px solid #eee',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#fafafa';
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
    </>
  );
}

export default AddTaskForm;
