import { useEffect, useRef, useState } from 'react';
import { useCalendars } from '../hooks/useCalendars';
import { useToast } from '../hooks/useToast';
import ProviderIcon from './ProviderIcon';
import AddICSCalendar from './AddICSCalendar';

interface ConnectCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for selecting which calendar provider to connect
 * Initiates OAuth flow when user selects a provider
 */
export default function ConnectCalendarModal({
  isOpen,
  onClose,
}: ConnectCalendarModalProps) {
  const { initiateOAuth } = useCalendars();
  const { error: showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showICSModal, setShowICSModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isLoading, onClose]);

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleConnectProvider = async (provider: 'GOOGLE' | 'MICROSOFT') => {
    setIsLoading(true);
    try {
      await initiateOAuth(provider);
      // OAuth redirect will happen, so we don't need to close the modal
    } catch (error) {
      setIsLoading(false);
      const providerName =
        provider === 'GOOGLE' ? 'Google Calendar' :
        'Microsoft Outlook';
      showError(`Failed to connect ${providerName}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 id="modal-title" className="text-2xl font-semibold text-gray-900">
            Connect Calendar
          </h2>
          <button
            onClick={onClose}
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

        {/* Description */}
        <p className="text-gray-600 mb-6">
          Choose a calendar provider to connect. You'll be redirected to authorize access to
          your calendar.
        </p>

        {/* Provider Options */}
        <div className="space-y-3">
          {/* Google Calendar */}
          <button
            onClick={() => handleConnectProvider('GOOGLE')}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ProviderIcon provider="GOOGLE" size="lg" />
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900">Google Calendar</h3>
              <p className="text-sm text-gray-600">Connect your Google account</p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          {/* Microsoft Outlook */}
          <button
            onClick={() => handleConnectProvider('MICROSOFT')}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ProviderIcon provider="MICROSOFT" size="lg" />
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900">Microsoft Outlook</h3>
              <p className="text-sm text-gray-600">Connect your Microsoft account</p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          {/* ICS Subscription */}
          <button
            onClick={() => setShowICSModal(true)}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div
              className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg"
              role="img"
              aria-label="ICS Subscription"
            >
              <svg
                className="w-7 h-7 text-gray-700"
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
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900">ICS Subscription URL</h3>
              <p className="text-sm text-gray-600">Subscribe to a read-only calendar feed</p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-gray-600">
            <svg
              className="animate-spin h-5 w-5"
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
            <span>Redirecting to authorization...</span>
          </div>
        )}
      </div>

      {/* ICS Calendar Modal */}
      <AddICSCalendar
        isOpen={showICSModal}
        onClose={() => setShowICSModal(false)}
        onSuccess={() => {
          setShowICSModal(false);
          onClose();
        }}
      />
    </div>
  );
}
