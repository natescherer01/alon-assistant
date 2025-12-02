import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import calendarApi from '../api/calendar';
import type { ProviderCalendar } from '../api/calendar';
import CalendarSelectionModal from '../components/CalendarSelectionModal';

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
      // Get session ID and provider from URL (new secure flow)
      const session = searchParams.get('session');
      const providerParam = searchParams.get('provider');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth errors
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
        // Fetch session data from backend (secure server-side storage)
        const sessionData = await calendarApi.getOAuthSession(session);

        // Set state for calendar selection modal
        setCalendars(sessionData.calendars);
        setSessionId(session);
        setProvider(providerParam.toUpperCase() as 'GOOGLE' | 'MICROSOFT');
        setStatus('selection');
      } catch (error) {
        setStatus('error');

        // Handle specific error cases
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
    navigate('/dashboard');
  };

  const handleCloseModal = () => {
    setStatus('success');
    setTimeout(() => {
      navigate('/dashboard');
    }, 500);
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Processing State */}
          {status === 'processing' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <svg
                className="animate-spin h-12 w-12 text-blue-600"
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
            <h2 className="text-xl font-semibold text-gray-900">
              Connecting your calendar...
            </h2>
            <p className="text-gray-600">Please wait while we set up your connection.</p>
          </div>
        )}

        {/* Calendar Selection State */}
        {status === 'selection' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-blue-600"
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
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Authorization successful!</h2>
            <p className="text-gray-600">
              Please select which calendars you'd like to sync.
            </p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Successfully connected!</h2>
            <p className="text-gray-600">
              Your calendar has been connected. Redirecting to dashboard...
            </p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Connection failed</h2>
            <p className="text-gray-600">{errorMessage}</p>
            <button
              onClick={handleRetry}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Return to Dashboard
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
