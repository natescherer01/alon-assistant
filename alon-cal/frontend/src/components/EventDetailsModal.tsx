import { useEffect, useRef, useState } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import AttendeeInput from './AttendeeInput';
import RecurrenceSelector from './RecurrenceSelector';
import TeamsMeetingBadge from './TeamsMeetingBadge';
import ImportanceBadge from './ImportanceBadge';
import OutlookCategoriesBadges from './OutlookCategoriesBadges';
import { eventsApi } from '../api/events';
import { useCalendars } from '../hooks/useCalendars';
import {
  toLocalDate,
  toLocalTime,
  toISO8601,
  isEndAfterStart,
  getUserTimezone,
  getCommonTimezones,
  formatTimezone,
} from '../utils/dateTime';
import type { EventFormData, EventFormErrors, CreateEventRequest, AttendeeInput as AttendeeInputType, ReminderInput } from '../types/event';

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

interface EventDetails {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  timezone?: string;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  isRecurring?: boolean;
  recurrenceRule?: string;
  attendees?: any[];
  reminders?: ReminderInput[];
  htmlLink?: string;
  calendar: {
    provider: 'GOOGLE' | 'MICROSOFT' | 'ICS';
    name: string;
    color?: string;
    isReadOnly?: boolean;
  };
  providerMetadata?: {
    teamsEnabled?: boolean;
    teamsMeetingUrl?: string;
    importance?: 'low' | 'normal' | 'high';
    outlookCategories?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Modal for viewing and editing calendar event details
 * Supports edit mode, delete functionality, and displays all event metadata
 */
export default function EventDetailsModal({
  isOpen,
  onClose,
  eventId,
  onEventUpdated,
  onEventDeleted,
}: EventDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { calendars, fetchCalendars } = useCalendars();

  // State management
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for edit mode
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    location: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    isAllDay: false,
    timezone: getUserTimezone(),
    calendarConnectionId: '',
    recurrence: null,
    attendees: [],
    reminders: [],
  });
  const [formErrors, setFormErrors] = useState<EventFormErrors>({});

  // Load event details
  useEffect(() => {
    if (isOpen && eventId) {
      loadEventDetails();
      fetchCalendars();
    }
  }, [isOpen, eventId]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving && !isDeleting) {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isEditMode) {
          setIsEditMode(false);
        } else {
          handleClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isSaving, isDeleting, showDeleteConfirm, isEditMode]);

  const loadEventDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const eventData = await eventsApi.getEventById(eventId);
      setEvent(eventData);

      // Initialize form data for edit mode
      setFormData({
        title: eventData.title || '',
        description: eventData.description || '',
        location: eventData.location || '',
        startDate: toLocalDate(eventData.startTime),
        startTime: eventData.isAllDay ? '00:00' : toLocalTime(eventData.startTime),
        endDate: toLocalDate(eventData.endTime),
        endTime: eventData.isAllDay ? '23:59' : toLocalTime(eventData.endTime),
        isAllDay: eventData.isAllDay,
        timezone: eventData.timezone || getUserTimezone(),
        calendarConnectionId: '', // Will be set from calendar data
        recurrence: null, // Recurrence editing not supported yet
        attendees: eventData.attendees || [],
        reminders: eventData.reminders || [],
      });
    } catch (err: any) {
      console.error('Failed to load event:', err);
      if (err.response?.status === 404) {
        setError('Event not found or was deleted');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view this event');
      } else {
        setError('Failed to load event details. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isSaving && !isDeleting) {
      setEvent(null);
      setIsEditMode(false);
      setShowDeleteConfirm(false);
      setError(null);
      setFormErrors({});
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving && !isDeleting) {
      handleClose();
    }
  };

  const handleEditClick = () => {
    setIsEditMode(true);
    setError(null);
    setFormErrors({});
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setFormErrors({});
    // Reset form data to original event data
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        location: event.location || '',
        startDate: toLocalDate(event.startTime),
        startTime: event.isAllDay ? '00:00' : toLocalTime(event.startTime),
        endDate: toLocalDate(event.endTime),
        endTime: event.isAllDay ? '23:59' : toLocalTime(event.endTime),
        isAllDay: event.isAllDay,
        timezone: event.timezone || getUserTimezone(),
        calendarConnectionId: '',
        recurrence: null,
        attendees: event.attendees || [],
        reminders: event.reminders || [],
      });
    }
  };

  const handleInputChange = (field: keyof EventFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof EventFormErrors]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
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

    if (formData.description && formData.description.length > 2000) {
      newErrors.general = 'Description must be 2000 characters or less';
    }

    if (formData.location && formData.location.length > 500) {
      newErrors.general = 'Location must be 500 characters or less';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveEdit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updateData: Partial<CreateEventRequest> = {
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
        attendees: formData.attendees.length > 0 ? formData.attendees : undefined,
        reminders: formData.reminders.length > 0 ? formData.reminders : undefined,
      };

      await eventsApi.updateEvent(eventId, updateData);

      // Reload event details
      await loadEventDetails();
      setIsEditMode(false);

      // Notify parent
      if (onEventUpdated) {
        onEventUpdated();
      }
    } catch (err: any) {
      console.error('Failed to update event:', err);
      if (err.response?.status === 403) {
        setError('Cannot edit read-only calendar');
      } else if (err.response?.status === 404) {
        setError('Event not found or was deleted');
      } else {
        setError('Failed to update event. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await eventsApi.deleteEvent(eventId);

      // Close modal and notify parent
      handleClose();
      if (onEventDeleted) {
        onEventDeleted();
      }
    } catch (err: any) {
      console.error('Failed to delete event:', err);
      if (err.response?.status === 403) {
        setError('Cannot delete from read-only calendar');
      } else if (err.response?.status === 404) {
        setError('Event not found or was already deleted');
      } else {
        setError('Failed to delete event. Please try again.');
      }
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const formatDateTime = (dateTime: string, isAllDay: boolean, timezone?: string) => {
    const date = new Date(dateTime);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (isAllDay) {
      return dateStr;
    }

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${dateStr} at ${timeStr}${timezone ? ` (${timezone})` : ''}`;
  };

  const getStatusBadgeStyles = (status?: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'TENTATIVE':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRSVPBadgeStyles = (responseStatus?: string) => {
    switch (responseStatus) {
      case 'accepted':
        return 'bg-green-100 text-green-700';
      case 'declined':
        return 'bg-red-100 text-red-700';
      case 'tentative':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const isReadOnly = event?.calendar.provider === 'ICS' || event?.calendar.isReadOnly;

  if (!isOpen) return null;

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
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-200">
          <div className="flex-1">
            {isEditMode ? (
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                error={formErrors.title}
                placeholder="Event title"
                className="text-2xl font-semibold"
                disabled={isSaving}
              />
            ) : (
              <div className="space-y-2">
                <h2 id="modal-title" className="text-2xl font-semibold text-gray-900">
                  {isLoading ? 'Loading...' : event?.title}
                </h2>
                {event?.status && (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getStatusBadgeStyles(
                      event.status
                    )}`}
                  >
                    {event.status}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving || isDeleting}
            className="ml-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
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
        <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg" role="alert">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
              {error.includes('try again') && (
                <button
                  onClick={loadEventDetails}
                  className="mt-2 text-sm font-medium underline hover:no-underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-lg">
              <p className="font-medium">Are you sure you want to delete this event?</p>
              <p className="text-sm mt-1">This action cannot be undone.</p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  onClick={handleConfirmDelete}
                  isLoading={isDeleting}
                  disabled={isDeleting}
                >
                  Delete Event
                </Button>
                <Button variant="secondary" onClick={handleCancelDelete} disabled={isDeleting}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg
                className="animate-spin h-8 w-8 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : event && !isEditMode ? (
            <>
              {/* Time Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  When
                </h3>
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-gray-400 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <p className="text-gray-900">
                      {formatDateTime(event.startTime, event.isAllDay, event.timezone)}
                    </p>
                    <p className="text-gray-600 text-sm">
                      to {formatDateTime(event.endTime, event.isAllDay, event.timezone)}
                    </p>
                    {event.isAllDay && (
                      <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        All-day event
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              {event.location && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Location
                  </h3>
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-gray-400 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <p className="text-gray-900">{event.location}</p>
                  </div>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Description
                  </h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {/* Attendees */}
              {event.attendees && event.attendees.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Attendees ({event.attendees.length})
                  </h3>
                  <div className="space-y-2">
                    {event.attendees.map((attendee: any, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                          {attendee.displayName?.charAt(0) || attendee.email?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {attendee.displayName || attendee.email}
                            {attendee.isOrganizer && (
                              <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                Organizer
                              </span>
                            )}
                          </p>
                          {attendee.email && attendee.displayName && (
                            <p className="text-xs text-gray-500 truncate">{attendee.email}</p>
                          )}
                        </div>
                        {attendee.responseStatus && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${getRSVPBadgeStyles(
                              attendee.responseStatus
                            )}`}
                          >
                            {attendee.responseStatus}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calendar & Provider */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Calendar
                </h3>
                <div className="flex items-center gap-2">
                  {event.calendar.color && (
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: event.calendar.color }}
                    />
                  )}
                  <span className="text-gray-900">{event.calendar.name}</span>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {event.calendar.provider}
                  </span>
                  {isReadOnly && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      Read-only
                    </span>
                  )}
                </div>
                {event.htmlLink && (
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View in {event.calendar.provider === 'GOOGLE' ? 'Google Calendar' : 'Outlook'}
                  </a>
                )}
              </div>

              {/* Reminders */}
              {event.reminders && event.reminders.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Reminders
                  </h3>
                  <div className="space-y-1">
                    {event.reminders.map((reminder: ReminderInput, index: number) => (
                      <p key={index} className="text-sm text-gray-900">
                        {reminder.method} - {reminder.minutesBefore} minutes before
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Recurrence */}
              {event.isRecurring && event.recurrenceRule && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Recurrence
                  </h3>
                  <p className="text-sm text-gray-900">{event.recurrenceRule}</p>
                </div>
              )}

              {/* Microsoft-Specific Features */}
              {event.calendar.provider === 'MICROSOFT' && event.providerMetadata && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  {/* Teams Meeting */}
                  {event.providerMetadata.teamsEnabled && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Online Meeting
                      </h3>
                      <TeamsMeetingBadge
                        teamsMeetingUrl={event.providerMetadata.teamsMeetingUrl}
                        variant="button"
                      />
                    </div>
                  )}

                  {/* Importance */}
                  {event.providerMetadata.importance && event.providerMetadata.importance !== 'normal' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Importance:</span>
                      <ImportanceBadge importance={event.providerMetadata.importance} variant="badge" />
                    </div>
                  )}

                  {/* Categories */}
                  {event.providerMetadata.outlookCategories && event.providerMetadata.outlookCategories.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Categories
                      </h3>
                      <OutlookCategoriesBadges categories={event.providerMetadata.outlookCategories} />
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                <p>Created: {new Date(event.createdAt).toLocaleString()}</p>
                <p>Updated: {new Date(event.updatedAt).toLocaleString()}</p>
              </div>
            </>
          ) : event && isEditMode ? (
            /* Edit Mode */
            <form className="space-y-6">
              {/* General Error */}
              {formErrors.general && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg" role="alert">
                  <p className="text-sm">{formErrors.general}</p>
                </div>
              )}

              {/* Title */}
              <Input
                label="Title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                error={formErrors.title}
                placeholder="Event title"
                maxLength={500}
                required
                disabled={isSaving}
              />

              {/* Date and Time */}
              <div className="space-y-3">
                {/* All-day toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isAllDay}
                    onChange={(e) => handleInputChange('isAllDay', e.target.checked)}
                    disabled={isSaving}
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
                    error={formErrors.startDate}
                    required
                    disabled={isSaving}
                  />
                  {!formData.isAllDay && (
                    <Input
                      label="Start Time"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      error={formErrors.startTime}
                      required
                      disabled={isSaving}
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
                    error={formErrors.endDate}
                    required
                    disabled={isSaving}
                  />
                  {!formData.isAllDay && (
                    <Input
                      label="End Time"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => handleInputChange('endTime', e.target.value)}
                      error={formErrors.endTime}
                      required
                      disabled={isSaving}
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
                  disabled={isSaving}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {getCommonTimezones().map((tz) => (
                    <option key={tz} value={tz}>
                      {formatTimezone(tz)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={isSaving}
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
                disabled={isSaving}
              />

              {/* Attendees */}
              <AttendeeInput
                attendees={formData.attendees}
                onChange={(attendees) => handleInputChange('attendees', attendees)}
                error={formErrors.attendees}
              />
            </form>
          ) : null}
        </div>

        {/* Footer */}
        {!isLoading && event && (
          <div className="flex gap-3 justify-between p-6 border-t border-gray-200">
            {isEditMode ? (
              <>
                <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveEdit}
                  isLoading={isSaving}
                  disabled={isSaving}
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  {!isReadOnly && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={handleEditClick}
                        disabled={showDeleteConfirm}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={handleDeleteClick}
                        disabled={showDeleteConfirm}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                  {isReadOnly && (
                    <div className="text-sm text-amber-700 flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      <span>This calendar is read-only</span>
                    </div>
                  )}
                </div>
                <Button variant="secondary" onClick={handleClose}>
                  Close
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
