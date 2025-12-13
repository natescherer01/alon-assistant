import { useEffect, useRef, useState } from 'react';
import { useCalendars } from '../../hooks/calendar/useCalendars';
import { useToast } from '../../hooks/calendar/useToast';
import ProviderIcon from './ProviderIcon';
import AddICSCalendar from './AddICSCalendar';

interface ConnectCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for selecting which calendar provider to connect
 * Styled to match Dashboard design system
 */
export default function ConnectCalendarModal({
  isOpen,
  onClose,
}: ConnectCalendarModalProps) {
  const { initiateOAuth } = useCalendars();
  const { error: showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showICSModal, setShowICSModal] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
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

  const handleConnectGoogle = async () => {
    setIsLoading(true);
    try {
      await initiateOAuth('GOOGLE');
      // OAuth redirect will happen, so we don't need to close the modal
    } catch (error) {
      setIsLoading(false);
      showError('Failed to connect Google Calendar');
    }
  };

  if (!isOpen) return null;

  const providerButtonStyle = (id: string) => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: hoveredButton === id ? '#F0F7FF' : '#fff',
    border: hoveredButton === id ? '2px solid #0066FF' : '2px solid #E5E7EB',
    borderRadius: '12px',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: isLoading ? 0.5 : 1,
  });

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
          maxWidth: '440px',
          width: '100%',
          padding: '24px',
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="modal-title" style={{ fontSize: '24px', fontWeight: '600', color: '#000', margin: 0 }}>
            Connect Calendar
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              color: '#9CA3AF',
              opacity: isLoading ? 0.5 : 1,
              borderRadius: '8px',
              transition: 'all 0.2s',
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
          Choose a calendar provider to connect. You'll be redirected to authorize access to your calendar.
        </p>

        {/* Provider Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Google Calendar */}
          <button
            onClick={handleConnectGoogle}
            disabled={isLoading}
            onMouseEnter={() => setHoveredButton('google')}
            onMouseLeave={() => setHoveredButton(null)}
            style={providerButtonStyle('google')}
          >
            <ProviderIcon provider="GOOGLE" size="lg" />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000', margin: '0 0 4px 0' }}>Google Calendar</h3>
              <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Connect your Google account</p>
            </div>
            <svg style={{ width: '20px', height: '20px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* ICS Subscription */}
          <button
            onClick={() => setShowICSModal(true)}
            disabled={isLoading}
            onMouseEnter={() => setHoveredButton('ics')}
            onMouseLeave={() => setHoveredButton(null)}
            style={providerButtonStyle('ics')}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                background: '#F3F4F6',
                borderRadius: '12px',
              }}
              role="img"
              aria-label="ICS Subscription"
            >
              <svg style={{ width: '28px', height: '28px', color: '#374151' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000', margin: '0 0 4px 0' }}>ICS Subscription URL</h3>
              <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Subscribe to a read-only calendar feed</p>
            </div>
            <svg style={{ width: '20px', height: '20px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#666' }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #E5E7EB',
              borderTop: '2px solid #0066FF',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ fontSize: '14px' }}>Redirecting to authorization...</span>
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
