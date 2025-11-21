import { useState } from 'react';
import { tasksAPI } from '../api/client';
import useConfirm from '../hooks/useConfirm';

function AddTaskForm({ onTaskAdded }) {
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
          padding: '16px',
          fontSize: '15px',
          fontWeight: '600',
          color: '#fff',
          background: '#0066FF',
          border: 'none',
          borderRadius: '16px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#0052CC';
          e.target.style.transform = 'translateY(-1px)';
          e.target.style.boxShadow = '0 4px 12px rgba(0, 102, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#0066FF';
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = 'none';
        }}
      >
        + Add New Task
      </button>
      </>
    );
  }

  return (
    <>
      <ConfirmDialog />
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
          Add New Task
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            color: '#9CA3AF',
            fontSize: '20px',
            cursor: 'pointer',
            borderRadius: '8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#F3F4F6';
            e.target.style.color = '#000';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = '#9CA3AF';
          }}
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            placeholder="e.g., Prepare quarterly report"
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
            placeholder="Additional details..."
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
            placeholder="e.g., Work, Personal, Home"
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
            Add Task
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
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
    </>
  );
}

export default AddTaskForm;
