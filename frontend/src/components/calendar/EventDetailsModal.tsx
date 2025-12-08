import { useEffect, useRef, useState } from 'react';
import AttendeeInput from './AttendeeInput';
import { eventsApi } from '../../api/calendar/events';
import { useCalendars } from '../../hooks/calendar/useCalendars';
import {
  toLocalDate,
  toLocalTime,
  toISO8601,
  isEndAfterStart,
  getUserTimezone,
  getCommonTimezones,
  formatTimezone,
} from '../../utils/calendar/dateTime';
import {
  getCalendarColor,
  getProviderName,
  type Provider,
} from '../../utils/calendar/calendarColors';
import type { EventFormData, EventFormErrors, CreateEventRequest, ReminderInput } from '../../types/event';

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
  const { fetchCalendars } = useCalendars();

  // State management
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hover states
  const [closeHovered, setCloseHovered] = useState(false);
  const [editHovered, setEditHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);
  const [saveHovered, setSaveHovered] = useState(false);
  const [cancelHovered, setCancelHovered] = useState(false);
  const [confirmDeleteHovered, setConfirmDeleteHovered] = useState(false);
  const [cancelDeleteHovered, setCancelDeleteHovered] = useState(false);
  const [linkHovered, setLinkHovered] = useState(false);
  const [teamsHovered, setTeamsHovered] = useState(false);

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
        calendarConnectionId: '',
        recurrence: null,
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
      await loadEventDetails();
      setIsEditMode(false);

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

  const getStatusBadgeStyle = (status?: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.3px',
      textTransform: 'uppercase',
    };

    switch (status) {
      case 'CONFIRMED':
        return { ...baseStyle, background: 'rgba(34, 197, 94, 0.1)', color: '#16A34A' };
      case 'TENTATIVE':
        return { ...baseStyle, background: 'rgba(234, 179, 8, 0.1)', color: '#CA8A04' };
      case 'CANCELLED':
        return { ...baseStyle, background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626' };
      default:
        return { ...baseStyle, background: 'rgba(107, 114, 128, 0.1)', color: '#6B7280' };
    }
  };

  const getRSVPBadgeStyle = (responseStatus?: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '500',
    };

    switch (responseStatus) {
      case 'accepted':
        return { ...baseStyle, background: 'rgba(34, 197, 94, 0.1)', color: '#16A34A' };
      case 'declined':
        return { ...baseStyle, background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626' };
      case 'tentative':
        return { ...baseStyle, background: 'rgba(234, 179, 8, 0.1)', color: '#CA8A04' };
      default:
        return { ...baseStyle, background: 'rgba(107, 114, 128, 0.1)', color: '#6B7280' };
    }
  };

  const getProviderBadgeStyle = (provider: string): React.CSSProperties => {
    const styles: Record<string, React.CSSProperties> = {
      GOOGLE: { background: 'rgba(66, 133, 244, 0.1)', color: '#4285F4' },
      MICROSOFT: { background: 'rgba(0, 120, 212, 0.1)', color: '#0078D4' },
      ICS: { background: 'rgba(107, 114, 128, 0.1)', color: '#6B7280' },
    };
    return styles[provider] || styles.ICS;
  };

  const isReadOnly = event?.calendar.provider === 'ICS' || event?.calendar.isReadOnly;
  const calendarColor = event ? getCalendarColor(event.calendar.color, event.calendar.provider as Provider) : '#6B7280';

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
        }}>
          {/* Calendar Color Indicator */}
          <div style={{
            width: '4px',
            height: '100%',
            minHeight: '48px',
            borderRadius: '2px',
            background: calendarColor,
            flexShrink: 0,
          }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditMode ? (
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Event title"
                disabled={isSaving}
                style={{
                  width: '100%',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#000',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = '#0066FF'}
                onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
              />
            ) : (
              <>
                <h2
                  id="modal-title"
                  style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#000',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {isLoading ? 'Loading...' : event?.title}
                </h2>
                {event?.status && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={getStatusBadgeStyle(event.status)}>
                      {event.status}
                    </span>
                  </div>
                )}
              </>
            )}
            {formErrors.title && (
              <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>
                {formErrors.title}
              </p>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            disabled={isSaving || isDeleting}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: closeHovered ? '#F3F4F6' : 'transparent',
              cursor: isSaving || isDeleting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: isSaving || isDeleting ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
            aria-label="Close"
          >
            <svg style={{ width: '20px', height: '20px', color: '#6B7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
        }}>
          {/* Error Banner */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
            }}>
              <p style={{ fontSize: '14px', fontWeight: '500', color: '#DC2626', margin: 0 }}>
                {error}
              </p>
              {error.includes('try again') && (
                <button
                  onClick={loadEventDetails}
                  style={{
                    marginTop: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#DC2626',
                    background: 'none',
                    border: 'none',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div style={{
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.2)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
            }}>
              <p style={{ fontSize: '14px', fontWeight: '500', color: '#92400E', margin: 0 }}>
                Are you sure you want to delete this event?
              </p>
              <p style={{ fontSize: '13px', color: '#92400E', marginTop: '4px', opacity: 0.8 }}>
                This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  onMouseEnter={() => setConfirmDeleteHovered(true)}
                  onMouseLeave={() => setConfirmDeleteHovered(false)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#fff',
                    background: confirmDeleteHovered && !isDeleting ? '#DC2626' : '#EF4444',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    opacity: isDeleting ? 0.7 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Event'}
                </button>
                <button
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                  onMouseEnter={() => setCancelDeleteHovered(true)}
                  onMouseLeave={() => setCancelDeleteHovered(false)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#666',
                    background: cancelDeleteHovered && !isDeleting ? '#E5E7EB' : '#F3F4F6',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 0',
            }}>
              <svg
                style={{ width: '32px', height: '32px', color: '#0066FF', animation: 'spin 1s linear infinite' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          ) : event && !isEditMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* When Section */}
              <div style={{
                background: '#FAFBFC',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(0, 0, 0, 0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(0, 102, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg style={{ width: '18px', height: '18px', color: '#0066FF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#000', margin: 0 }}>
                      {formatDateTime(event.startTime, event.isAllDay, event.timezone)}
                    </p>
                    <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                      to {formatDateTime(event.endTime, event.isAllDay, event.timezone)}
                    </p>
                    {event.isAllDay && (
                      <span style={{
                        display: 'inline-flex',
                        marginTop: '8px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500',
                        background: 'rgba(0, 102, 255, 0.1)',
                        color: '#0066FF',
                      }}>
                        All-day event
                      </span>
                    )}
                    {event.isRecurring && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '8px',
                        marginLeft: event.isAllDay ? '8px' : 0,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500',
                        background: 'rgba(147, 51, 234, 0.1)',
                        color: '#9333EA',
                      }}>
                        <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Recurring
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              {event.location && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg style={{ width: '18px', height: '18px', color: '#EF4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                      Location
                    </p>
                    <p style={{ fontSize: '14px', color: '#000', margin: 0 }}>
                      {event.location}
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(107, 114, 128, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg style={{ width: '18px', height: '18px', color: '#6B7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                      Description
                    </p>
                    <p style={{ fontSize: '14px', color: '#000', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {event.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Teams Meeting */}
              {event.calendar.provider === 'MICROSOFT' && event.providerMetadata?.teamsEnabled && event.providerMetadata?.teamsMeetingUrl && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(80, 95, 205, 0.08) 0%, rgba(80, 95, 205, 0.04) 100%)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(80, 95, 205, 0.15)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: '#505FCD',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg style={{ width: '20px', height: '20px', color: '#fff' }} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.5 3A2.5 2.5 0 0122 5.5v13a2.5 2.5 0 01-2.5 2.5h-15A2.5 2.5 0 012 18.5v-13A2.5 2.5 0 014.5 3h15zm-9.75 12.75v-7.5h-3v7.5h3zm-1.5-8.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm9.75 8.5v-4.5c0-1.5-.75-2.25-1.875-2.25S14.5 9.75 14.5 11.25v4.5h3v-4.5c0-.375.188-.75.563-.75.374 0 .562.375.562.75v4.5h3z" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#505FCD', margin: 0 }}>
                        Teams Meeting
                      </p>
                      <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                        Click to join the online meeting
                      </p>
                    </div>
                    <a
                      href={event.providerMetadata.teamsMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => setTeamsHovered(true)}
                      onMouseLeave={() => setTeamsHovered(false)}
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#fff',
                        background: teamsHovered ? '#4048B5' : '#505FCD',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      Join
                    </a>
                  </div>
                </div>
              )}

              {/* Attendees */}
              {event.attendees && event.attendees.length > 0 && (
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                    Attendees ({event.attendees.length})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {event.attendees.map((attendee: any, index: number) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        background: '#FAFBFC',
                        borderRadius: '10px',
                        border: '1px solid rgba(0, 0, 0, 0.06)',
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: '600',
                          flexShrink: 0,
                        }}>
                          {attendee.displayName?.charAt(0)?.toUpperCase() || attendee.email?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#000',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {attendee.displayName || attendee.email}
                            </p>
                            {attendee.isOrganizer && (
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '600',
                                background: 'rgba(147, 51, 234, 0.1)',
                                color: '#9333EA',
                              }}>
                                Organizer
                              </span>
                            )}
                          </div>
                          {attendee.email && attendee.displayName && (
                            <p style={{ fontSize: '12px', color: '#666', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {attendee.email}
                            </p>
                          )}
                        </div>
                        {attendee.responseStatus && (
                          <span style={getRSVPBadgeStyle(attendee.responseStatus)}>
                            {attendee.responseStatus}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calendar Info */}
              <div style={{
                background: '#FAFBFC',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(0, 0, 0, 0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: `${calendarColor}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: calendarColor,
                    }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#000', margin: 0 }}>
                      {event.calendar.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 8px',
                        borderRadius: '5px',
                        fontSize: '11px',
                        fontWeight: '600',
                        ...getProviderBadgeStyle(event.calendar.provider),
                      }}>
                        {getProviderName(event.calendar.provider as Provider)}
                      </span>
                      {isReadOnly && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          fontSize: '11px',
                          fontWeight: '500',
                          background: 'rgba(234, 179, 8, 0.1)',
                          color: '#CA8A04',
                        }}>
                          <svg style={{ width: '10px', height: '10px' }} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          Read-only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {event.htmlLink && (
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => setLinkHovered(true)}
                    onMouseLeave={() => setLinkHovered(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: linkHovered ? '#0052CC' : '#0066FF',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                  >
                    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View in {event.calendar.provider === 'GOOGLE' ? 'Google Calendar' : event.calendar.provider === 'MICROSOFT' ? 'Outlook' : 'calendar app'}
                  </a>
                )}
              </div>

              {/* Importance (Microsoft) */}
              {event.calendar.provider === 'MICROSOFT' && event.providerMetadata?.importance && event.providerMetadata.importance !== 'normal' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#666' }}>Importance:</span>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    background: event.providerMetadata.importance === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                    color: event.providerMetadata.importance === 'high' ? '#DC2626' : '#6B7280',
                    textTransform: 'capitalize',
                  }}>
                    {event.providerMetadata.importance}
                  </span>
                </div>
              )}

              {/* Categories (Microsoft) */}
              {event.calendar.provider === 'MICROSOFT' && event.providerMetadata?.outlookCategories && event.providerMetadata.outlookCategories.length > 0 && (
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Categories
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {event.providerMetadata.outlookCategories.map((category, index) => (
                      <span key={index} style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: 'rgba(107, 114, 128, 0.1)',
                        color: '#374151',
                      }}>
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div style={{
                paddingTop: '16px',
                borderTop: '1px solid #E5E7EB',
              }}>
                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
                  Created: {new Date(event.createdAt).toLocaleString()}
                </p>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                  Updated: {new Date(event.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          ) : event && isEditMode ? (
            /* Edit Mode Form */
            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {formErrors.general && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                }}>
                  <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>
                    {formErrors.general}
                  </p>
                </div>
              )}

              {/* All-day Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isAllDay}
                  onChange={(e) => handleInputChange('isAllDay', e.target.checked)}
                  disabled={isSaving}
                  style={{ width: '18px', height: '18px', accentColor: '#0066FF' }}
                />
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>All-day event</span>
              </label>

              {/* Date/Time Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: formData.isAllDay ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                    disabled={isSaving}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: formErrors.startDate ? '1px solid #EF4444' : '1px solid #E5E7EB',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                  {formErrors.startDate && (
                    <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>{formErrors.startDate}</p>
                  )}
                </div>
                {!formData.isAllDay && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                      Start Time *
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      disabled={isSaving}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: formErrors.startTime ? '1px solid #EF4444' : '1px solid #E5E7EB',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                    />
                    {formErrors.startTime && (
                      <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>{formErrors.startTime}</p>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: formData.isAllDay ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                    disabled={isSaving}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: formErrors.endDate ? '1px solid #EF4444' : '1px solid #E5E7EB',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                  {formErrors.endDate && (
                    <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>{formErrors.endDate}</p>
                  )}
                </div>
                {!formData.isAllDay && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                      End Time *
                    </label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => handleInputChange('endTime', e.target.value)}
                      disabled={isSaving}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: formErrors.endTime ? '1px solid #EF4444' : '1px solid #E5E7EB',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                    />
                    {formErrors.endTime && (
                      <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>{formErrors.endTime}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Timezone */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => handleInputChange('timezone', e.target.value)}
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    outline: 'none',
                    background: '#fff',
                  }}
                >
                  {getCommonTimezones().map((tz) => (
                    <option key={tz} value={tz}>{formatTimezone(tz)}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={isSaving}
                  placeholder="Add a description..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                  {formData.description.length}/2000 characters
                </p>
              </div>

              {/* Location */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  disabled={isSaving}
                  placeholder="Add a location..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    outline: 'none',
                  }}
                />
              </div>

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
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}>
            {isEditMode ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  onMouseEnter={() => setCancelHovered(true)}
                  onMouseLeave={() => setCancelHovered(false)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#666',
                    background: cancelHovered && !isSaving ? '#E5E7EB' : '#F3F4F6',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  onMouseEnter={() => setSaveHovered(true)}
                  onMouseLeave={() => setSaveHovered(false)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#fff',
                    background: saveHovered && !isSaving ? '#0052CC' : '#0066FF',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {isSaving && (
                    <svg style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!isReadOnly && (
                    <>
                      <button
                        onClick={handleEditClick}
                        disabled={showDeleteConfirm}
                        onMouseEnter={() => setEditHovered(true)}
                        onMouseLeave={() => setEditHovered(false)}
                        style={{
                          padding: '10px 20px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151',
                          background: editHovered && !showDeleteConfirm ? '#E5E7EB' : '#F3F4F6',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: showDeleteConfirm ? 'not-allowed' : 'pointer',
                          opacity: showDeleteConfirm ? 0.5 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDeleteClick}
                        disabled={showDeleteConfirm}
                        onMouseEnter={() => setDeleteHovered(true)}
                        onMouseLeave={() => setDeleteHovered(false)}
                        style={{
                          padding: '10px 20px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#DC2626',
                          background: deleteHovered && !showDeleteConfirm ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                          border: '1px solid rgba(220, 38, 38, 0.3)',
                          borderRadius: '10px',
                          cursor: showDeleteConfirm ? 'not-allowed' : 'pointer',
                          opacity: showDeleteConfirm ? 0.5 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {isReadOnly && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 16px',
                      background: 'rgba(234, 179, 8, 0.08)',
                      borderRadius: '10px',
                    }}>
                      <svg style={{ width: '14px', height: '14px', color: '#CA8A04' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#92400E' }}>
                        This calendar is read-only
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  onMouseEnter={() => setCancelHovered(true)}
                  onMouseLeave={() => setCancelHovered(false)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#666',
                    background: cancelHovered ? '#E5E7EB' : '#F3F4F6',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
