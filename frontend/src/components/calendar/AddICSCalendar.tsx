import { useEffect, useRef, useState } from 'react';
import { useCalendars } from '../../hooks/calendar/useCalendars';
import { useToast } from '../../hooks/calendar/useToast';

interface AddICSCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ValidationState {
  isValidating: boolean;
  isValid: boolean;
  calendarName?: string;
  eventCount?: number;
  error?: string;
}

/**
 * Modal for adding ICS calendar subscriptions
 * Validates ICS URLs and allows users to connect read-only calendar feeds
 */
export default function AddICSCalendar({
  isOpen,
  onClose,
  onSuccess,
}: AddICSCalendarProps) {
  const [url, setUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({
    isValidating: false,
    isValid: false,
  });

  const { validateIcsUrl, connectIcsCalendar } = useCalendars();
  const { success, error: showError } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout>();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isConnecting) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [isOpen, isConnecting]);

  const handleClose = () => {
    if (!isConnecting) {
      setUrl('');
      setDisplayName('');
      setValidation({ isValidating: false, isValid: false });
      setShowHelp(false);
      onClose();
    }
  };

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isConnecting) {
      handleClose();
    }
  };

  // Convert webcal:// URLs to https://
  const normalizeUrl = (urlString: string): string => {
    if (urlString.startsWith('webcal://')) {
      return urlString.replace('webcal://', 'https://');
    }
    return urlString;
  };

  // Validate URL format
  const isValidUrl = (urlString: string): boolean => {
    try {
      // Normalize webcal:// to https:// before validation
      const normalizedUrl = normalizeUrl(urlString);
      const parsedUrl = new URL(normalizedUrl);
      // Require HTTPS in production
      const requireHttps = import.meta.env.PROD;
      if (requireHttps && parsedUrl.protocol !== 'https:') {
        return false;
      }
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Debounced validation
  const handleUrlChange = (value: string) => {
    setUrl(value);
    setValidation({ isValidating: false, isValid: false });

    // Clear any pending validation
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    // Don't validate empty or invalid URLs
    if (!value.trim() || !isValidUrl(value)) {
      return;
    }

    // Debounce validation by 800ms
    validationTimeoutRef.current = setTimeout(() => {
      handleValidateUrl(value);
    }, 800);
  };

  const handleValidateUrl = async (urlToValidate: string) => {
    if (!isValidUrl(urlToValidate)) {
      setValidation({
        isValidating: false,
        isValid: false,
        error: import.meta.env.PROD
          ? 'Please enter a valid HTTPS URL'
          : 'Please enter a valid URL',
      });
      return;
    }

    setValidation({ isValidating: true, isValid: false });

    try {
      // Normalize webcal:// to https:// before sending to API
      const normalizedUrl = normalizeUrl(urlToValidate);
      const result = await validateIcsUrl(normalizedUrl);

      if (result.valid) {
        setValidation({
          isValidating: false,
          isValid: true,
          calendarName: result.calendarName,
          eventCount: result.eventCount,
        });
        // Auto-populate display name if not set
        if (!displayName && result.calendarName) {
          setDisplayName(result.calendarName);
        }
      } else {
        setValidation({
          isValidating: false,
          isValid: false,
          error: result.error || 'Invalid calendar URL',
        });
      }
    } catch (error) {
      setValidation({
        isValidating: false,
        isValid: false,
        error: 'Failed to validate URL. Please try again.',
      });
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validation.isValid || !url.trim()) {
      return;
    }

    setIsConnecting(true);

    try {
      // Normalize webcal:// to https:// before sending to API
      const normalizedUrl = normalizeUrl(url.trim());
      await connectIcsCalendar(normalizedUrl, displayName.trim() || undefined);
      success('ICS calendar connected successfully');
      handleClose();
      onSuccess();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect calendar';

      // Provide specific error messages
      if (errorMessage.includes('timeout')) {
        showError('Request timed out. Please try again.');
      } else if (errorMessage.includes('unreachable') || errorMessage.includes('network')) {
        showError('Unable to reach calendar. Please check the URL.');
      } else if (errorMessage.includes('invalid')) {
        showError('The URL does not contain a valid calendar.');
      } else {
        showError(errorMessage);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ics-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 id="ics-modal-title" className="text-2xl font-semibold text-gray-900">
            Add ICS Calendar Subscription
          </h2>
          <button
            onClick={handleClose}
            disabled={isConnecting}
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
          Subscribe to read-only calendars from Outlook, Google Calendar, or other providers using
          an ICS subscription URL.
        </p>

        {/* Form */}
        <form onSubmit={handleConnect} className="space-y-4">
          {/* URL Input */}
          <div>
            <label htmlFor="ics-url" className="block text-sm font-medium text-gray-700 mb-2">
              Calendar URL (ICS)
            </label>
            <input
              ref={urlInputRef}
              id="ics-url"
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onBlur={() => {
                if (url.trim() && !validation.isValid && !validation.isValidating) {
                  handleValidateUrl(url);
                }
              }}
              disabled={isConnecting}
              placeholder="https://calendar.example.com/calendar.ics"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              aria-describedby="url-help url-error url-success"
              required
            />

            {/* URL Validation States */}
            {validation.isValidating && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600" id="url-help">
                <svg
                  className="animate-spin h-4 w-4"
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
                <span>Validating calendar...</span>
              </div>
            )}

            {validation.error && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600" id="url-error" role="alert">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{validation.error}</span>
              </div>
            )}

            {validation.isValid && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg" id="url-success">
                <div className="flex items-start gap-2 text-sm text-green-800">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium">Valid calendar found!</p>
                    {validation.calendarName && (
                      <p className="mt-1">Calendar: {validation.calendarName}</p>
                    )}
                    {validation.eventCount !== undefined && (
                      <p className="mt-1">{validation.eventCount} events available</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Display Name Input (Optional) */}
          {validation.isValid && (
            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-2">
                Display Name (Optional)
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isConnecting}
                placeholder={validation.calendarName || 'My Calendar'}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                aria-describedby="display-name-help"
              />
              <p className="mt-1 text-sm text-gray-500" id="display-name-help">
                Customize how this calendar appears in your list
              </p>
            </div>
          )}

          {/* Help Section */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              aria-expanded={showHelp}
              aria-controls="help-content"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showHelp ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              How to find your calendar URL
            </button>

            {showHelp && (
              <div id="help-content" className="mt-4 space-y-4 text-sm">
                {/* Google Calendar */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Google Calendar</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700">
                    <li>Open Google Calendar settings</li>
                    <li>Select the calendar to share</li>
                    <li>Scroll to "Integrate calendar"</li>
                    <li>Copy the "Secret address in iCal format"</li>
                  </ol>
                </div>

                {/* Outlook */}
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Microsoft Outlook</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700">
                    <li>Open Outlook on the web</li>
                    <li>Go to Settings → View all Outlook settings</li>
                    <li>Select Calendar → Shared calendars</li>
                    <li>Under "Publish a calendar", select your calendar</li>
                    <li>Choose "ICS" format and copy the URL</li>
                  </ol>
                </div>

                {/* Apple iCloud */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Apple iCloud Calendar</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700">
                    <li>Go to calendar.icloud.com</li>
                    <li>Click the share icon next to the calendar</li>
                    <li>Enable "Public Calendar"</li>
                    <li>Copy the URL provided</li>
                  </ol>
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> ICS calendars are read-only. Events sync automatically in the
                    background. You cannot modify events from subscribed calendars.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isConnecting}
              className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!validation.isValid || isConnecting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
            >
              {isConnecting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
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
                  <span>Connecting...</span>
                </>
              ) : (
                'Connect Calendar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
