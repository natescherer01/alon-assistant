import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProviderCalendar } from '../api/calendar';
import calendarApi from '../api/calendar';
import { useToast } from '../hooks/useToast';
import { Button } from './Button';
import ProviderIcon from './ProviderIcon';

interface CalendarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: 'GOOGLE' | 'MICROSOFT';
  calendars: ProviderCalendar[];
  sessionId: string;
}

/**
 * Modal for selecting specific calendars to sync after OAuth authorization
 * Uses secure session-based flow to submit calendar selections
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
      // Call the appropriate provider-specific method with sessionId
      if (provider === 'GOOGLE') {
        await calendarApi.selectGoogleCalendars(sessionId, selectedCalendarIds);
      } else if (provider === 'MICROSOFT') {
        await calendarApi.selectMicrosoftCalendars(sessionId, selectedCalendarIds);
      }

      success(`Successfully connected ${selectedCalendarIds.length} calendar(s)`);
      onClose();
      navigate('/dashboard');
    } catch (error) {
      console.error('Calendar selection error:', error);

      // Handle specific error cases
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
      navigate('/dashboard');
    }
  };

  if (!isOpen) return null;

  const providerName =
    provider === 'GOOGLE' ? 'Google' : provider === 'MICROSOFT' ? 'Microsoft' : 'Apple';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="selection-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <ProviderIcon provider={provider} size="md" />
            <div>
              <h2 id="selection-modal-title" className="text-xl font-semibold text-gray-900">
                Select {providerName} Calendars
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose which calendars you want to sync
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
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

        {/* Calendar List */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Select All / Deselect All */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-600">
              {selectedCalendarIds.length} of {calendars.length} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                disabled={isSubmitting}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                Select All
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={handleDeselectAll}
                disabled={isSubmitting}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Calendars */}
          <div className="space-y-2">
            {calendars.map((calendar) => (
              <label
                key={calendar.id}
                className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedCalendarIds.includes(calendar.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedCalendarIds.includes(calendar.id)}
                  onChange={() => handleToggleCalendar(calendar.id)}
                  disabled={isSubmitting}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-offset-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900 truncate">{calendar.name}</h3>
                    {calendar.isPrimary && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                        Primary
                      </span>
                    )}
                    {calendar.calendarType === 'shared' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                        Shared
                      </span>
                    )}
                    {calendar.calendarType === 'delegated' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
                        Delegated
                      </span>
                    )}
                  </div>
                  {calendar.description && (
                    <p className="text-sm text-gray-600 truncate mt-1">{calendar.description}</p>
                  )}
                  {calendar.ownerEmail && (
                    <p className="text-xs text-gray-500 mt-1">
                      Owner: {calendar.ownerEmail}
                    </p>
                  )}
                  {calendar.accessRole && !calendar.ownerEmail && (
                    <p className="text-xs text-gray-500 mt-1">
                      Access: {calendar.accessRole}
                    </p>
                  )}
                </div>
                {calendar.color && (
                  <div
                    className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: calendar.color }}
                    aria-label="Calendar color"
                  />
                )}
              </label>
            ))}
          </div>

          {calendars.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No calendars found in your account.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <Button variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={selectedCalendarIds.length === 0 || isSubmitting}
            isLoading={isSubmitting}
          >
            Connect {selectedCalendarIds.length > 0 && `(${selectedCalendarIds.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
