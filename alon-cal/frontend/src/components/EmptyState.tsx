interface EmptyStateProps {
  onConnect: () => void;
}

/**
 * Empty state displayed when no calendars are connected
 */
export default function EmptyState({ onConnect }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-center space-y-4 max-w-md">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-5xl" role="img" aria-label="Calendar">
              📅
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-gray-900">
          No calendars connected yet
        </h3>

        {/* Description */}
        <p className="text-gray-600">
          Connect your Google Calendar, Microsoft Outlook, or Apple Calendar to start managing all your
          events in one unified view.
        </p>

        {/* Call to Action */}
        <button
          onClick={onConnect}
          className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Connect Your First Calendar
        </button>
      </div>
    </div>
  );
}
