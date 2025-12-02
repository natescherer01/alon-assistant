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
 * Comprehensive modal for creating calendar events
 * Supports recurring events, attendees, and reminders
 */
export default function CreateEventModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateEventModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { createEvent, isLoading, error: apiError, clearError } = useCreateEvent();
  const { calendars, fetchCalendars } = useCalendars();

  // Section expansion state
  const [showDetails, setShowDetails] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);

  // Form state
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

  // Fetch calendars on mount
  useEffect(() => {
    if (isOpen) {
      fetchCalendars();
    }
  }, [isOpen, fetchCalendars]);

  // Set default calendar when calendars load
  useEffect(() => {
    if (calendars.length > 0 && !formData.calendarConnectionId) {
      const primaryCalendar = calendars.find((cal) => cal.isPrimary) || calendars[0];
      setFormData((prev) => ({ ...prev, calendarConnectionId: primaryCalendar.id }));
    }
  }, [calendars, formData.calendarConnectionId]);

  // Handle ESC key to close
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
    // Clear error for this field
    if (errors[field as keyof EventFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAllDayToggle = () => {
    const newIsAllDay = !formData.isAllDay;
    setFormData((prev) => ({ ...prev, isAllDay: newIsAllDay }));
  };

  const validateForm = (): boolean => {
    const newErrors: EventFormErrors = {};

    // Required fields
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

    // Validate end is after start
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

    // Validate description length
    if (formData.description && formData.description.length > 2000) {
      newErrors.general = 'Description must be 2000 characters or less';
    }

    // Validate location length
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

      // Track sync failures
      if (response.syncStatus === 'FAILED') {
        setSyncErrorId(response.id);
      } else {
        // Success - close modal and notify parent
        handleClose();
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      // Error is handled by the hook
      console.error('Failed to create event:', err);
    }
  };

  if (!isOpen) return null;

  const hasNoCalendars = calendars.length === 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 id="modal-title" className="text-2xl font-semibold text-gray-900">
            Create Event
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          {/* API Error Banner */}
          {(apiError || errors.general) && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg" role="alert">
              <p className="font-medium">Error</p>
              <p className="text-sm">{apiError || errors.general}</p>
            </div>
          )}

          {/* Sync Error Banner */}
          {syncErrorId && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg" role="alert">
              <p className="font-medium">Event created but sync failed</p>
              <p className="text-sm">The event was saved locally but could not be synced to your calendar provider.</p>
            </div>
          )}

          {/* No Calendars Warning */}
          {hasNoCalendars && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg" role="alert">
              <p className="font-medium">No calendars connected</p>
              <p className="text-sm">Please connect a calendar before creating an event.</p>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

            {/* Title */}
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

            {/* Date and Time */}
            <div className="space-y-3">
              {/* All-day toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isAllDay}
                  onChange={handleAllDayToggle}
                  disabled={isLoading}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">All-day event</span>
              </label>

              {/* Start Date/Time */}
              <div className="grid grid-cols-2 gap-3">
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

              {/* End Date/Time */}
              <div className="grid grid-cols-2 gap-3">
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
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {getCommonTimezones().map((tz) => (
                  <option key={tz} value={tz}>
                    {formatTimezone(tz)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Additional Details (Collapsible) */}
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-left"
              disabled={isLoading}
            >
              <h3 className="text-lg font-semibold text-gray-900">Additional Details</h3>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDetails && (
              <div className="mt-4 space-y-4">
                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {formData.description.length}/2000 characters
                  </p>
                </div>

                {/* Location */}
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

          {/* Section 3: Recurrence (Collapsible) */}
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setShowRecurrence(!showRecurrence)}
              className="flex items-center justify-between w-full text-left"
              disabled={isLoading}
            >
              <h3 className="text-lg font-semibold text-gray-900">Recurrence</h3>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showRecurrence ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showRecurrence && (
              <div className="mt-4">
                <RecurrenceSelector
                  value={formData.recurrence}
                  onChange={(value) => handleInputChange('recurrence', value)}
                  startDate={formData.startDate}
                />
              </div>
            )}
          </div>

          {/* Section 4: Attendees */}
          <div className="border-t border-gray-200 pt-4">
            <AttendeeInput
              attendees={formData.attendees}
              onChange={(attendees) => handleInputChange('attendees', attendees)}
              error={errors.attendees}
            />
          </div>

          {/* Section 5: Calendar Selection */}
          <div className="border-t border-gray-200 pt-4">
            <label htmlFor="calendar" className="block text-sm font-medium text-gray-700 mb-1">
              Calendar
            </label>
            <select
              id="calendar"
              value={formData.calendarConnectionId}
              onChange={(e) => handleInputChange('calendarConnectionId', e.target.value)}
              disabled={isLoading || hasNoCalendars}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.calendarConnectionId}
              </p>
            )}
          </div>

          {/* Section 6: Reminders Info */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reminders</h3>
            <p className="text-sm text-gray-600">
              A 30-minute reminder will be added automatically.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 justify-end p-6 border-t border-gray-200">
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
