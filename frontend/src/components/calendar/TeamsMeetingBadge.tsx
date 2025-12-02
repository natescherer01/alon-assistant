interface TeamsMeetingBadgeProps {
  teamsMeetingUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'button';
  className?: string;
}

/**
 * Microsoft Teams meeting badge component
 * Displays Teams icon or clickable button to join meeting
 *
 * @param teamsMeetingUrl - URL to the Teams meeting
 * @param size - Icon/button size (sm, md, lg)
 * @param variant - Display as icon only or full button
 * @param className - Additional CSS classes
 */
export default function TeamsMeetingBadge({
  teamsMeetingUrl,
  size = 'md',
  variant = 'icon',
  className = '',
}: TeamsMeetingBadgeProps) {
  if (!teamsMeetingUrl) return null;

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const buttonSizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };

  const iconSize = sizeClasses[size];
  const buttonSize = buttonSizeClasses[size];

  // Teams icon SVG
  const TeamsIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={iconSize}>
      <path d="M19.75 10.5h-2.5V8c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h2v2.5c0 .42.34.75.75.75h10.75c.42 0 .75-.34.75-.75v-10c0-.42-.34-.75-.75-.75zM15.25 20v-8.5h4v8.5h-4zm-1.5-9.5V8h-8v8.5h6.5v-4.5c0-.83.67-1.5 1.5-1.5h0z"/>
    </svg>
  );

  if (variant === 'icon') {
    return (
      <span
        className={`inline-flex items-center ${className}`}
        title="Teams Meeting"
        aria-label="Teams Meeting"
      >
        <TeamsIcon />
      </span>
    );
  }

  // Full button variant
  return (
    <a
      href={teamsMeetingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium ${buttonSize} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <TeamsIcon />
      Join Teams Meeting
    </a>
  );
}
