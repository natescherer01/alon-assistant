import { useEffect, useRef, useState } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import AttendeeInput from './AttendeeInput';
import RecurrenceSelector from './RecurrenceSelector';
import { useCreateEvent } from '../../hooks/calendar/useCreateEvent';
import { useCalendars } from '../../hooks/calendar/useCalendars';
import {
  getCurrentDate,
  getCurrentTime,
  getOneHourLater,
  isEndAfterStart,
  toISO8601,
  getUserTimezone,
  getCommonTimezones,
  formatTimezone,
} from '../../utils/calendar/dateTime';
import type { EventFormData, EventFormErrors, CreateEventRequest } from '../../types/event';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal for creating calendar events - Dashboard styling
 */
export default function CreateEventModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateEventModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { createEvent, isLoading, error: apiError, clearError } = useCreateEvent();
  const { calendars, fetchCalendars } = useCalendars();

  const [showDetails, setShowDetails] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    location: '',
    startDate: getCurrentDate(),
    startTime: getCurrentTime(),
    endDate: getCurrentDate(),
    endTime: getOneHourLater(getCurrentTime()),
    isAllDay: false,
    timezone: getUserTimezone(),
    calendarConnectionId: '',
    recurrence: null,
    attendees: [],
    reminders: [],
  });

  const [errors, setErrors] = useState<EventFormErrors>({});
  const [syncErrorId, setSyncErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCalendars();
    }
  }, [isOpen, fetchCalendars]);

  useEffect(() => {
    if (calendars.length > 0 && !formData.calendarConnectionId) {
      const primaryCalendar = calendars.find((cal) => cal.isPrimary) || calendars[0];
      setFormData((prev) => ({ ...prev, calendarConnectionId: primaryCalendar.id }));
    }
  }, [calendars, formData.calendarConnectionId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isLoading]);

  const handleClose = () => {
    if (!isLoading) {
      resetForm();
      clearError();
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      handleClose();
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      startDate: getCurrentDate(),
      startTime: getCurrentTime(),
      endDate: getCurrentDate(),
      endTime: getOneHourLater(getCurrentTime()),
      isAllDay: false,
      timezone: getUserTimezone(),
      calendarConnectionId: calendars.find((cal) => cal.isPrimary)?.id || calendars[0]?.id || '',
      recurrence: null,
      attendees: [],
      reminders: [],
    });
    setErrors({});
    setShowDetails(false);
    setShowRecurrence(false);
    setSyncErrorId(null);
  };

  const handleInputChange = (field: keyof EventFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof EventFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAllDayToggle = () => {
    setFormData((prev) => ({ ...prev, isAllDay: !prev.isAllDay }));
  };

  const validateForm = (): boolean => {
    const newErrors: EventFormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 500) {
      newErrors.title = 'Title must be 500 characters or less';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.isAllDay && !formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (!formData.isAllDay && !formData.endTime) {
      newErrors.endTime = 'End time is required';
    }

    if (
      formData.startDate &&
      formData.endDate &&
      !formData.isAllDay &&
      formData.startTime &&
      formData.endTime
    ) {
      if (!isEndAfterStart(formData.startDate, formData.startTime, formData.endDate, formData.endTime)) {
        newErrors.endTime = 'End time must be after start time';
      }
    }

    if (!formData.calendarConnectionId) {
      newErrors.calendarConnectionId = 'Please select a calendar';
    }

    if (formData.description && formData.description.length > 2000) {
      newErrors.general = 'Description must be 2000 characters or less';
    }

    if (formData.location && formData.location.length > 500) {
      newErrors.general = 'Location must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const requestData: CreateEventRequest = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        location: formData.location.trim() || undefined,
        startTime: formData.isAllDay
          ? toISO8601(formData.startDate, '00:00', formData.timezone)
          : toISO8601(formData.startDate, formData.startTime, formData.timezone),
        endTime: formData.isAllDay
          ? toISO8601(formData.endDate, '23:59', formData.timezone)
          : toISO8601(formData.endDate, formData.endTime, formData.timezone),
        isAllDay: formData.isAllDay,
        timezone: formData.timezone,
        calendarConnectionId: formData.calendarConnectionId,
        recurrence: formData.recurrence || undefined,
        attendees: formData.attendees.length > 0 ? formData.attendees : undefined,
        reminders: formData.reminders.length > 0 ? formData.reminders : undefined,
      };

      const response = await createEvent(requestData);

      if (response.syncStatus === 'FAILED') {
        setSyncErrorId(response.id);
      } else {
        handleClose();
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };

  if (!isOpen) return null;

  const hasNoCalendars = calendars.length === 0;

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    outline: 'none',
    background: isLoading || hasNoCalendars ? '#F9FAFB' : '#fff',
    cursor: isLoading || hasNoCalendars ? 'not-allowed' : 'pointer',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: isLoading ? 'not-allowed' : 'pointer',
    textAlign: 'left',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '600px',
          margin: '32px 0',
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        }}>
          <h2 id="modal-title" style={{ fontSize: '24px', fontWeight: '600', color: '#000', margin: 0 }}>
            Create Event
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              color: '#9CA3AF',
              opacity: isLoading ? 0.5 : 1,
              borderRadius: '8px',
            }}
            aria-label="Close"
          >
            <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          {/* Error Banners */}
          {(apiError || errors.general) && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
            }}>
              <p style={{ fontWeight: '500', color: '#991B1B', margin: 0 }}>Error</p>
              <p style={{ fontSize: '14px', color: '#B91C1C', margin: '4px 0 0 0' }}>{apiError || errors.general}</p>
            </div>
          )}

          {syncErrorId && (
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
            }}>
              <p style={{ fontWeight: '500', color: '#92400E', margin: 0 }}>Event created but sync failed</p>
              <p style={{ fontSize: '14px', color: '#A16207', margin: '4px 0 0 0' }}>The event was saved locally but could not be synced.</p>
            </div>
          )}

          {hasNoCalendars && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
            }}>
              <p style={{ fontWeight: '500', color: '#991B1B', margin: 0 }}>No calendars connected</p>
              <p style={{ fontSize: '14px', color: '#B91C1C', margin: '4px 0 0 0' }}>Please connect a calendar before creating an event.</p>
            </div>
          )}

          {/* Basic Information */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000', margin: '0 0 16px 0' }}>Basic Information</h3>

            <div style={{ marginBottom: '16px' }}>
              <Input
                label="Title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                error={errors.title}
                placeholder="Event title"
                maxLength={500}
                required
                disabled={isLoading}
              />
            </div>

            {/* All-day toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px' }}>
              <input
                type="checkbox"
                checked={formData.isAllDay}
                onChange={handleAllDayToggle}
                disabled={isLoading}
                style={{ width: '16px', height: '16px', accentColor: '#0066FF' }}
              />
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>All-day event</span>
            </label>

            {/* Date/Time Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: formData.isAllDay ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <Input
                label="Start Date"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                error={errors.startDate}
                required
                disabled={isLoading}
              />
              {!formData.isAllDay && (
                <Input
                  label="Start Time"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                  error={errors.startTime}
                  required
                  disabled={isLoading}
                />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: formData.isAllDay ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <Input
                label="End Date"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                error={errors.endDate}
                required
                disabled={isLoading}
              />
              {!formData.isAllDay && (
                <Input
                  label="End Time"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value)}
                  error={errors.endTime}
                  required
                  disabled={isLoading}
                />
              )}
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>
                Timezone
              </label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                disabled={isLoading}
                style={selectStyle}
              >
                {getCommonTimezones().map((tz) => (
                  <option key={tz} value={tz}>
                    {formatTimezone(tz)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Additional Details Section */}
          <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)', paddingTop: '16px', marginBottom: '16px' }}>
            <button type="button" onClick={() => setShowDetails(!showDetails)} disabled={isLoading} style={sectionHeaderStyle}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000', margin: 0 }}>Additional Details</h3>
              <svg
                style={{ width: '20px', height: '20px', color: '#666', transition: 'transform 0.2s', transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDetails && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="description" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    disabled={isLoading}
                    placeholder="Add a description..."
                    maxLength={2000}
                    rows={4}
                    style={{
                      ...selectStyle,
                      resize: 'vertical',
                      minHeight: '100px',
                    }}
                  />
                  <p style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                    {formData.description.length}/2000 characters
                  </p>
                </div>

                <Input
                  label="Location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Add a location..."
                  maxLength={500}
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          {/* Recurrence Section */}
          <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)', paddingTop: '16px', marginBottom: '16px' }}>
            <button type="button" onClick={() => setShowRecurrence(!showRecurrence)} disabled={isLoading} style={sectionHeaderStyle}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000', margin: 0 }}>Recurrence</h3>
              <svg
                style={{ width: '20px', height: '20px', color: '#666', transition: 'transform 0.2s', transform: showRecurrence ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showRecurrence && (
              <div style={{ marginTop: '16px' }}>
                <RecurrenceSelector
                  value={formData.recurrence}
                  onChange={(value) => handleInputChange('recurrence', value)}
                  startDate={formData.startDate}
                />
              </div>
            )}
          </div>

          {/* Attendees Section */}
          <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)', paddingTop: '16px', marginBottom: '16px' }}>
            <AttendeeInput
              attendees={formData.attendees}
              onChange={(attendees) => handleInputChange('attendees', attendees)}
              error={errors.attendees}
            />
          </div>

          {/* Calendar Selection */}
          <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)', paddingTop: '16px', marginBottom: '16px' }}>
            <label htmlFor="calendar" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>
              Calendar
            </label>
            <select
              id="calendar"
              value={formData.calendarConnectionId}
              onChange={(e) => handleInputChange('calendarConnectionId', e.target.value)}
              disabled={isLoading || hasNoCalendars}
              style={selectStyle}
              required
            >
              <option value="">Select a calendar</option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.calendarName} ({calendar.provider})
                  {calendar.isPrimary && ' - Primary'}
                </option>
              ))}
            </select>
            {errors.calendarConnectionId && (
              <p style={{ marginTop: '4px', fontSize: '13px', color: '#EF4444' }}>{errors.calendarConnectionId}</p>
            )}
          </div>

          {/* Reminders Info */}
          <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000', margin: '0 0 8px 0' }}>Reminders</h3>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              A 30-minute reminder will be added automatically.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          padding: '24px',
          borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        }}>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={hasNoCalendars || isLoading}
          >
            Create Event
          </Button>
        </div>
      </div>
    </div>
  );
}
