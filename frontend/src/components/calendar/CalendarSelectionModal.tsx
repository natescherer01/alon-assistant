import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProviderCalendar } from '../../api/calendar/calendar';
import calendarApi from '../../api/calendar/calendar';
import { useToast } from '../../hooks/calendar/useToast';

interface CalendarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: 'GOOGLE' | 'MICROSOFT';
  calendars: ProviderCalendar[];
  sessionId: string;
}

/**
 * Modal for selecting specific calendars to sync after OAuth authorization
 */
export default function CalendarSelectionModal({
  isOpen,
  onClose,
  provider,
  calendars,
  sessionId,
}: CalendarSelectionModalProps) {
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);

  // Pre-select primary calendar on mount
  useEffect(() => {
    if (calendars.length > 0) {
      const primaryCalendars = calendars
        .filter((cal) => cal.isPrimary)
        .map((cal) => cal.id);
      setSelectedCalendarIds(primaryCalendars.length > 0 ? primaryCalendars : [calendars[0].id]);
    }
  }, [calendars]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isSubmitting]);

  const handleToggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const handleSelectAll = () => {
    setSelectedCalendarIds(calendars.map((cal) => cal.id));
  };

  const handleDeselectAll = () => {
    setSelectedCalendarIds([]);
  };

  const handleSubmit = async () => {
    if (selectedCalendarIds.length === 0) {
      showError('Please select at least one calendar');
      return;
    }

    setIsSubmitting(true);
    try {
      if (provider === 'GOOGLE') {
        await calendarApi.selectGoogleCalendars(sessionId, selectedCalendarIds);
      } else if (provider === 'MICROSOFT') {
        await calendarApi.selectMicrosoftCalendars(sessionId, selectedCalendarIds);
      }

      success(`Successfully connected ${selectedCalendarIds.length} calendar(s)`);
      onClose();
      navigate('/calendar');
    } catch (error) {
      console.error('Calendar selection error:', error);
      const errorMessage = error instanceof Error ? error.message : '';

      if (errorMessage.includes('expired') || errorMessage.includes('not found') || errorMessage.includes('404')) {
        showError('Your session has expired. Please try connecting your calendar again.');
      } else if (errorMessage.includes('Network') || (error instanceof TypeError && errorMessage.includes('fetch'))) {
        showError('Network error. Please check your connection and try again.');
      } else {
        showError('Failed to connect calendars. Please try again.');
      }

      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      onClose();
      navigate('/calendar');
    }
  };

  if (!isOpen) return null;

  const providerName = provider === 'GOOGLE' ? 'Google' : 'Microsoft';
  const providerColor = provider === 'GOOGLE' ? '#4285F4' : '#00A4EF';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="selection-modal-title"
    >
      <div
        ref={modalRef}
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px',
          borderBottom: '1px solid #E5E7EB',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Provider Icon */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: providerColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {provider === 'GOOGLE' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
                </svg>
              )}
            </div>
            <div>
              <h2 id="selection-modal-title" style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#111827',
                margin: 0,
              }}>
                Select {providerName} Calendars
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                margin: '4px 0 0 0',
              }}>
                Choose which calendars you want to sync
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.background = '#F3F4F6')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
            aria-label="Close"
          >
            <svg width="24" height="24" fill="none" stroke="#6B7280" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Calendar List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* Select All / Deselect All */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '14px', color: '#6B7280' }}>
              {selectedCalendarIds.length} of {calendars.length} selected
            </span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSelectAll}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  color: '#3B82F6',
                  fontWeight: '500',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                Select All
              </button>
              <span style={{ color: '#D1D5DB' }}>|</span>
              <button
                onClick={handleDeselectAll}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  color: '#3B82F6',
                  fontWeight: '500',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Calendars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {calendars.map((calendar) => {
              const isSelected = selectedCalendarIds.includes(calendar.id);
              return (
                <label
                  key={calendar.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    border: `2px solid ${isSelected ? '#3B82F6' : '#E5E7EB'}`,
                    borderRadius: '12px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    background: isSelected ? '#EFF6FF' : '#fff',
                    transition: 'all 0.2s',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleCalendar(calendar.id)}
                    disabled={isSubmitting}
                    style={{
                      width: '20px',
                      height: '20px',
                      accentColor: '#3B82F6',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontWeight: '500',
                        color: '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {calendar.name}
                      </span>
                      {calendar.isPrimary && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                          color: 'white',
                        }}>
                          Primary
                        </span>
                      )}
                      {calendar.calendarType === 'shared' && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: '#DBEAFE',
                          color: '#1D4ED8',
                        }}>
                          Shared
                        </span>
                      )}
                    </div>
                    {calendar.description && (
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        marginTop: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {calendar.description}
                      </p>
                    )}
                    {calendar.ownerEmail && (
                      <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                        Owner: {calendar.ownerEmail}
                      </p>
                    )}
                  </div>
                  {calendar.color && (
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: calendar.color,
                        border: '2px solid rgba(0,0,0,0.1)',
                        flexShrink: 0,
                      }}
                      aria-label="Calendar color"
                    />
                  )}
                </label>
              );
            })}
          </div>

          {calendars.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280' }}>
              <p>No calendars found in your account.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          padding: '20px 24px',
          borderTop: '1px solid #E5E7EB',
          background: '#F9FAFB',
        }}>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#374151',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.background = '#F3F4F6')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#fff')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedCalendarIds.length === 0 || isSubmitting}
            style={{
              padding: '10px 24px',
              background: selectedCalendarIds.length === 0 || isSubmitting
                ? '#9CA3AF'
                : 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: selectedCalendarIds.length === 0 || isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isSubmitting && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
            )}
            Connect {selectedCalendarIds.length > 0 && `(${selectedCalendarIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
