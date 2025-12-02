interface OutlookCategoriesBadgesProps {
  categories?: string[];
  maxDisplay?: number;
  className?: string;
}

/**
 * Display Outlook category badges for events
 * Shows colored category labels with optional overflow
 *
 * @param categories - Array of category names
 * @param maxDisplay - Maximum number of categories to display (default: 3)
 * @param className - Additional CSS classes
 */
export default function OutlookCategoriesBadges({
  categories,
  maxDisplay = 3,
  className = '',
}: OutlookCategoriesBadgesProps) {
  if (!categories || categories.length === 0) return null;

  const displayCategories = categories.slice(0, maxDisplay);
  const hiddenCount = categories.length - maxDisplay;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {displayCategories.map((category, index) => (
        <span
          key={index}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
          title={category}
        >
          {category}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
          title={`${hiddenCount} more ${hiddenCount === 1 ? 'category' : 'categories'}`}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
