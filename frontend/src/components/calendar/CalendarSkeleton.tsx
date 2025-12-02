/**
 * Skeleton loading state for calendar cards
 * Shows while fetching calendars from API
 */
export default function CalendarSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 animate-pulse">
      <div className="flex items-start gap-4">
        {/* Icon skeleton */}
        <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />

        <div className="flex-1 space-y-3">
          {/* Title skeleton */}
          <div className="h-5 bg-gray-200 rounded w-3/4" />

          {/* Provider badge skeleton */}
          <div className="h-4 bg-gray-200 rounded w-1/4" />

          {/* Last synced skeleton */}
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>

        {/* Actions skeleton */}
        <div className="w-8 h-8 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

/**
 * Grid of skeleton cards
 */
export function CalendarSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <CalendarSkeleton key={index} />
      ))}
    </div>
  );
}
