import { useState, useEffect } from 'react';

interface IntegrationPromptProps {
  onConnect: () => void;
}

/**
 * Dismissible prompt encouraging users to connect calendars
 * Shows at the top of pages for users with no connected calendars
 */
export default function IntegrationPrompt({ onConnect }: IntegrationPromptProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage for dismissed state on mount
  useEffect(() => {
    const dismissed = localStorage.getItem('integration-prompt-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('integration-prompt-dismissed', 'true');
  };

  if (isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 rounded-lg shadow-sm p-4 mb-6">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600"
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            Get started with calendar integration
          </h3>
          <p className="text-sm text-gray-700 mb-3">
            Connect your Google, Microsoft, or Apple calendars to see all your events in one place.
            Manage multiple calendars seamlessly and never miss an important event.
          </p>
          <button
            onClick={onConnect}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Connect Your First Calendar
          </button>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 rounded"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
