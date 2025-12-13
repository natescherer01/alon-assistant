import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import AttendeeInput from './AttendeeInput';
import RecurrenceSelector from './RecurrenceSelector';
import { useCreateEvent } from '../../hooks/calendar/useCreateEvent';
import { useCalendars } from '../../hooks/calendar/useCalendars';
import { useCalendarUsers, useFindFreeTimes } from '../../hooks/calendar/useCalendarUsers';
import { useAuth } from '../../hooks/calendar/useAuth';
import type { FreeSlot } from '../../api/calendar/users';
import { useIsMobile } from '../../hooks/useIsMobile';
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
  const { user } = useAuth();
  const { data: teamUsers = [] } = useCalendarUsers();
  const findFreeTimes = useFindFreeTimes();
  const isMobile = useIsMobile(640);

  const [showDetails, setShowDetails] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [showTeamAvailability, setShowTeamAvailability] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [freeTimeSlots, setFreeTimeSlots] = useState<FreeSlot[] | null>(null);

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

  // Filter team users (exclude current user, only those with calendars)
  const filteredTeamUsers = useMemo(() => {
    if (!user?.id) return [];
    return teamUsers
      .filter(u => String(u.id) !== String(user.id))
      .filter(u => u.hasCalendar);
  }, [teamUsers, user?.id]);

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUserIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
    // Clear free time slots when selection changes
    setFreeTimeSlots(null);
  }, []);

  const handleFindFreeTime = useCallback(() => {
    if (!user?.id) return;

    // Use the selected date from form or default to today
    const startDate = new Date(formData.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const allUserIds = [String(user.id), ...selectedUserIds];

    findFreeTimes.mutate(
      {
        userIds: allUserIds,
        startDate,
        endDate,
        minSlotMinutes: 30,
        excludedHoursStart: 0,
        excludedHoursEnd: 6,
      },
      {
        onSuccess: (data) => {
          setFreeTimeSlots(data.freeSlots);
        },
        onError: () => {
          setFreeTimeSlots(null);
        },
      }
    );
  }, [user?.id, selectedUserIds, findFreeTimes, formData.startDate]);

  const handleSelectFreeSlot = useCallback((slot: FreeSlot) => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);

    // Format date as YYYY-MM-DD
    const formatDate = (d: Date) => {
      return d.toISOString().split('T')[0];
    };

    // Format time as HH:MM
    const formatTime = (d: Date) => {
      return d.toTimeString().slice(0, 5);
    };

    setFormData(prev => ({
      ...prev,
      startDate: formatDate(start),
      startTime: formatTime(start),
      endDate: formatDate(end),
      endTime: formatTime(end),
    }));

    // Clear errors for time fields
    setErrors(prev => ({
      ...prev,
      startDate: undefined,
      startTime: undefined,
      endDate: undefined,
      endTime: undefined,
    }));
  }, []);

  const clearTeamSelection = useCallback(() => {
    setSelectedUserIds([]);
    setFreeTimeSlots(null);
  }, []);

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
    setShowTeamAvailability(false);
    setSelectedUserIds([]);
    setFreeTimeSlots(null);
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
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: isMobile ? '0' : '16px',
        overflowY: 'auto',
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="modal-container"
        style={{
          background: '#fff',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: isMobile ? '100%' : '600px',
          maxHeight: isMobile ? '90vh' : 'none',
          margin: isMobile ? '0' : '32px 0',
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isMobile ? '16px' : '24px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        }}>
          <h2 id="modal-title" style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: '#000', margin: 0 }}>
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
        <form onSubmit={handleSubmit} className="modal-content" style={{ padding: isMobile ? '16px' : '24px', maxHeight: isMobile ? 'calc(90vh - 140px)' : 'calc(100vh - 300px)', overflowY: 'auto' }}>
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

          {/* Team Availability Section */}
          <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)', paddingTop: '16px', marginBottom: '16px' }}>
            <button type="button" onClick={() => setShowTeamAvailability(!showTeamAvailability)} disabled={isLoading} style={sectionHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000', margin: 0 }}>Team Availability</h3>
                {selectedUserIds.length > 0 && (
                  <span style={{
                    background: '#22C55E',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: '600',
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}>
                    {selectedUserIds.length} selected
                  </span>
                )}
              </div>
              <svg
                style={{ width: '20px', height: '20px', color: '#666', transition: 'transform 0.2s', transform: showTeamAvailability ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showTeamAvailability && (
              <div style={{ marginTop: '16px' }}>
                {filteredTeamUsers.length === 0 ? (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.02)',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                  }}>
                    <svg style={{ width: '32px', height: '32px', color: '#9CA3AF', margin: '0 auto 8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: '0 0 4px 0' }}>
                      No team members available
                    </p>
                    <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>
                      Team members with connected calendars will appear here
                    </p>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px 0' }}>
                      Select team members to find mutual free time
                    </p>

                    {/* Team Members List */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      marginBottom: '12px',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '8px',
                      padding: '8px',
                    }}>
                      {filteredTeamUsers.map(teamUser => (
                        <label
                          key={teamUser.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px',
                            borderRadius: '6px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            background: selectedUserIds.includes(String(teamUser.id)) ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                            transition: 'background 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(String(teamUser.id))}
                            onChange={() => toggleUserSelection(String(teamUser.id))}
                            disabled={isLoading}
                            style={{ accentColor: '#22C55E', cursor: isLoading ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                          />
                          <span style={{
                            fontSize: '14px',
                            color: '#333',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {teamUser.fullName || teamUser.email.split('@')[0]}
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <button
                        type="button"
                        onClick={handleFindFreeTime}
                        disabled={findFreeTimes.isPending || isLoading}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#fff',
                          background: findFreeTimes.isPending ? '#9CA3AF' : '#22C55E',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: findFreeTimes.isPending || isLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {findFreeTimes.isPending ? (
                          <>
                            <svg style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Finding...
                          </>
                        ) : (
                          <>
                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Find Free Time
                          </>
                        )}
                      </button>
                      {selectedUserIds.length > 0 && (
                        <button
                          type="button"
                          onClick={clearTeamSelection}
                          disabled={isLoading}
                          style={{
                            padding: '10px 16px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#666',
                            background: 'transparent',
                            border: '1px solid rgba(0, 0, 0, 0.15)',
                            borderRadius: '8px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Free Time Slots Results */}
                    {freeTimeSlots && freeTimeSlots.length > 0 && (
                    <div style={{
                      background: 'rgba(34, 197, 94, 0.05)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      borderRadius: '8px',
                      padding: '12px',
                    }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#16A34A', margin: '0 0 8px 0' }}>
                        {freeTimeSlots.length} available time slot{freeTimeSlots.length !== 1 ? 's' : ''} found
                      </p>
                      <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px 0' }}>
                        Click a slot to set your event time
                      </p>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}>
                        {freeTimeSlots.slice(0, 20).map((slot, index) => {
                          const start = new Date(slot.startTime);
                          const end = new Date(slot.endTime);
                          const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                          const startTimeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                          const endTimeStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleSelectFreeSlot(slot)}
                              disabled={isLoading}
                              style={{
                                padding: '10px 12px',
                                background: '#fff',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                borderRadius: '6px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                (e.target as HTMLButtonElement).style.background = 'rgba(34, 197, 94, 0.1)';
                                (e.target as HTMLButtonElement).style.borderColor = '#22C55E';
                              }}
                              onMouseLeave={(e) => {
                                (e.target as HTMLButtonElement).style.background = '#fff';
                                (e.target as HTMLButtonElement).style.borderColor = 'rgba(34, 197, 94, 0.3)';
                              }}
                            >
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#16A34A' }}>
                                {dateStr}
                              </div>
                              <div style={{ fontSize: '13px', color: '#333', marginTop: '2px' }}>
                                {startTimeStr} - {endTimeStr}
                                <span style={{ color: '#666', marginLeft: '8px' }}>
                                  ({slot.durationMinutes} min)
                                </span>
                              </div>
                            </button>
                          );
                        })}
                        {freeTimeSlots.length > 20 && (
                          <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', margin: '8px 0 0 0' }}>
                            +{freeTimeSlots.length - 20} more slots available
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                    {/* No Free Time Found */}
                    {freeTimeSlots && freeTimeSlots.length === 0 && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        padding: '12px',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontSize: '14px', color: '#DC2626', margin: 0 }}>
                          No mutual free time found in the next 7 days
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
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
