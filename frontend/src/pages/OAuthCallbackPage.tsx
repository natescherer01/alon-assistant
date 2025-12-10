import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import calendarApi from '../api/calendar/calendar';
import type { ProviderCalendar } from '../api/calendar/calendar';
import CalendarSelectionModal from '../components/calendar/CalendarSelectionModal';

/**
 * OAuth callback page for handling Google and Microsoft OAuth redirects
 * Uses secure session-based flow where sensitive data is stored server-side
 */
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'selection' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<ProviderCalendar[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [provider, setProvider] = useState<'GOOGLE' | 'MICROSOFT'>('GOOGLE');

  useEffect(() => {
    const processCallback = async () => {
      const session = searchParams.get('session');
      const providerParam = searchParams.get('provider');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setErrorMessage(errorDescription || 'Authorization was denied');
        return;
      }

      if (!session) {
        setStatus('error');
        setErrorMessage('Invalid OAuth callback - missing session');
        return;
      }

      if (!providerParam) {
        setStatus('error');
        setErrorMessage('Invalid OAuth callback - missing provider');
        return;
      }

      try {
        const sessionData = await calendarApi.getOAuthSession(session);
        setCalendars(sessionData.calendars);
        setSessionId(session);
        setProvider(providerParam.toUpperCase() as 'GOOGLE' | 'MICROSOFT');
        setStatus('selection');
      } catch (error) {
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : '';

        if (errorMessage.includes('expired') || errorMessage.includes('not found') || errorMessage.includes('404')) {
          setErrorMessage('Your session has expired. Please try connecting your calendar again.');
        } else if (error instanceof TypeError && errorMessage.includes('fetch')) {
          setErrorMessage('Network error. Please check your connection and try again.');
        } else {
          setErrorMessage('Failed to retrieve OAuth session. Please try again.');
        }
        console.error('OAuth session fetch error:', error);
      }
    };

    processCallback();
  }, [searchParams]);

  const handleRetry = () => {
    navigate('/calendar');
  };

  const handleCloseModal = () => {
    setStatus('success');
    setTimeout(() => {
      navigate('/calendar');
    }, 500);
  };

  // Spinner keyframes
  const spinnerStyle = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  return (
    <>
      <style>{spinnerStyle}</style>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}>
        <div style={{
          maxWidth: '420px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '40px',
          textAlign: 'center',
        }}>
          {/* Processing State */}
          {status === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                border: '4px solid #E5E7EB',
                borderTopColor: '#3B82F6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827',
                margin: 0,
              }}>
                Connecting your calendar...
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#6B7280',
                margin: 0,
              }}>
                Please wait while we set up your connection.
              </p>
            </div>
          )}

          {/* Calendar Selection State - shows behind modal */}
          {status === 'selection' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="32" height="32" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827',
                margin: 0,
              }}>
                Authorization successful!
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#6B7280',
                margin: 0,
              }}>
                Please select which calendars you'd like to sync.
              </p>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="32" height="32" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827',
                margin: 0,
              }}>
                Successfully connected!
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#6B7280',
                margin: 0,
              }}>
                Your calendar has been connected. Redirecting...
              </p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="32" height="32" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827',
                margin: 0,
              }}>
                Connection failed
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#6B7280',
                margin: 0,
              }}>
                {errorMessage}
              </p>
              <button
                onClick={handleRetry}
                style={{
                  marginTop: '8px',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Return to Calendar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Selection Modal */}
      <CalendarSelectionModal
        isOpen={status === 'selection'}
        onClose={handleCloseModal}
        provider={provider}
        calendars={calendars}
        sessionId={sessionId}
      />
    </>
  );
}
