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
 * Styled to match Dashboard design system
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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isConnecting) {
      handleClose();
    }
  };

  const normalizeUrl = (urlString: string): string => {
    if (urlString.startsWith('webcal://')) {
      return urlString.replace('webcal://', 'https://');
    }
    return urlString;
  };

  const isValidUrl = (urlString: string): boolean => {
    try {
      const normalizedUrl = normalizeUrl(urlString);
      const parsedUrl = new URL(normalizedUrl);
      const requireHttps = import.meta.env.PROD;
      if (requireHttps && parsedUrl.protocol !== 'https:') {
        return false;
      }
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setValidation({ isValidating: false, isValid: false });

    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    if (!value.trim() || !isValidUrl(value)) {
      return;
    }

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
      const normalizedUrl = normalizeUrl(urlToValidate);
      const result = await validateIcsUrl(normalizedUrl);

      if (result.valid) {
        setValidation({
          isValidating: false,
          isValid: true,
          calendarName: result.calendarName,
          eventCount: result.eventCount,
        });
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
      const normalizedUrl = normalizeUrl(url.trim());
      await connectIcsCalendar(normalizedUrl, displayName.trim() || undefined);
      success('ICS calendar connected successfully');
      handleClose();
      onSuccess();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect calendar';

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

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: isConnecting ? '#F9FAFB' : '#fff',
    cursor: isConnecting ? 'not-allowed' : 'text',
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
        zIndex: 100,
        padding: '16px',
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ics-modal-title"
    >
      <div
        ref={modalRef}
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '560px',
          width: '100%',
          padding: '24px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="ics-modal-title" style={{ fontSize: '24px', fontWeight: '600', color: '#000', margin: 0 }}>
            Add ICS Calendar
          </h2>
          <button
            onClick={handleClose}
            disabled={isConnecting}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px',
              cursor: isConnecting ? 'not-allowed' : 'pointer',
              color: '#9CA3AF',
              opacity: isConnecting ? 0.5 : 1,
              borderRadius: '8px',
            }}
            aria-label="Close"
          >
            <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 24px 0', lineHeight: '1.5' }}>
          Subscribe to read-only calendars from Outlook, Google Calendar, or other providers using an ICS subscription URL.
        </p>

        {/* Form */}
        <form onSubmit={handleConnect}>
          {/* URL Input */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="ics-url" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>
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
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = '#0066FF';
                e.target.style.boxShadow = '0 0 0 3px rgba(0, 102, 255, 0.1)';
              }}
              onBlurCapture={(e) => {
                e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                e.target.style.boxShadow = 'none';
              }}
              required
            />

            {/* Validation States */}
            {validation.isValidating && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#666' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #E5E7EB',
                  borderTop: '2px solid #0066FF',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <span>Validating calendar...</span>
              </div>
            )}

            {validation.error && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#DC2626' }}>
                <span>⚠️</span>
                <span>{validation.error}</span>
              </div>
            )}

            {validation.isValid && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', color: '#065F46' }}>
                  <span style={{ fontSize: '16px' }}>✓</span>
                  <div>
                    <p style={{ fontWeight: '500', margin: 0 }}>Valid calendar found!</p>
                    {validation.calendarName && (
                      <p style={{ margin: '4px 0 0 0' }}>Calendar: {validation.calendarName}</p>
                    )}
                    {validation.eventCount !== undefined && (
                      <p style={{ margin: '4px 0 0 0' }}>{validation.eventCount} events available</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Display Name Input */}
          {validation.isValid && (
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="display-name" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>
                Display Name (Optional)
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isConnecting}
                placeholder={validation.calendarName || 'My Calendar'}
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0066FF';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0, 102, 255, 0.1)';
                }}
                onBlurCapture={(e) => {
                  e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <p style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                Customize how this calendar appears in your list
              </p>
            </div>
          )}

          {/* Help Section */}
          <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)', paddingTop: '16px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#0066FF',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <svg
                style={{ width: '16px', height: '16px', transition: 'transform 0.2s', transform: showHelp ? 'rotate(90deg)' : 'rotate(0deg)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              How to find your calendar URL
            </button>

            {showHelp && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Google Calendar */}
                <div style={{ background: '#EFF6FF', padding: '12px', borderRadius: '8px' }}>
                  <h4 style={{ fontWeight: '600', color: '#000', margin: '0 0 8px 0', fontSize: '14px' }}>Google Calendar</h4>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                    <li>Open Google Calendar settings</li>
                    <li>Select the calendar to share</li>
                    <li>Scroll to "Integrate calendar"</li>
                    <li>Copy the "Secret address in iCal format"</li>
                  </ol>
                </div>

                {/* Outlook */}
                <div style={{ background: '#FFF7ED', padding: '12px', borderRadius: '8px' }}>
                  <h4 style={{ fontWeight: '600', color: '#000', margin: '0 0 8px 0', fontSize: '14px' }}>Microsoft Outlook</h4>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                    <li>Open Outlook on the web</li>
                    <li>Go to Settings → View all Outlook settings</li>
                    <li>Select Calendar → Shared calendars</li>
                    <li>Under "Publish a calendar", select your calendar</li>
                    <li>Choose "ICS" format and copy the URL</li>
                  </ol>
                </div>

                {/* Apple iCloud */}
                <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px' }}>
                  <h4 style={{ fontWeight: '600', color: '#000', margin: '0 0 8px 0', fontSize: '14px' }}>Apple iCloud Calendar</h4>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                    <li>Go to calendar.icloud.com</li>
                    <li>Click the share icon next to the calendar</li>
                    <li>Enable "Public Calendar"</li>
                    <li>Copy the URL provided</li>
                  </ol>
                </div>

                <div style={{ background: '#FFFBEB', padding: '12px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                  <p style={{ fontSize: '12px', color: '#92400E', margin: 0 }}>
                    <strong>Note:</strong> ICS calendars are read-only. Events sync automatically in the background.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isConnecting}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                background: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                opacity: isConnecting ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!validation.isValid || isConnecting}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#fff',
                background: (!validation.isValid || isConnecting) ? '#93C5FD' : '#0066FF',
                border: 'none',
                borderRadius: '8px',
                cursor: (!validation.isValid || isConnecting) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isConnecting ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <span>Connecting...</span>
                </>
              ) : (
                'Connect Calendar'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Spin Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
