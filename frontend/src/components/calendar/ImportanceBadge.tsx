interface ImportanceBadgeProps {
  importance?: 'low' | 'normal' | 'high';
  variant?: 'icon' | 'badge';
  className?: string;
}

/**
 * Event importance indicator for Microsoft Outlook events
 * Shows high/low priority markers
 *
 * @param importance - Event importance level (low, normal, high)
 * @param variant - Display as icon or badge with text
 * @param className - Additional CSS classes
 */
export default function ImportanceBadge({
  importance,
  variant = 'icon',
  className = '',
}: ImportanceBadgeProps) {
  // Don't show anything for normal importance
  if (!importance || importance === 'normal') return null;

  if (variant === 'icon') {
    if (importance === 'high') {
      return (
        <span
          className={`text-red-500 font-bold ${className}`}
          title="High importance"
          aria-label="High importance"
        >
          !
        </span>
      );
    }

    if (importance === 'low') {
      return (
        <span
          className={`text-gray-400 font-bold ${className}`}
          title="Low importance"
          aria-label="Low importance"
        >
          ↓
        </span>
      );
    }
  }

  // Badge variant
  if (importance === 'high') {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-50 text-red-500 ${className}`}
        aria-label="High importance"
      >
        High
      </span>
    );
  }

  if (importance === 'low') {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 ${className}`}
        aria-label="Low importance"
      >
        Low
      </span>
    );
  }

  return null;
}
