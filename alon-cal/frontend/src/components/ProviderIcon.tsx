interface ProviderIconProps {
  provider: 'GOOGLE' | 'MICROSOFT' | 'APPLE' | 'CALDAV' | 'ICS';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xl',
  md: 'w-8 h-8 text-2xl',
  lg: 'w-12 h-12 text-4xl',
};

/**
 * Display provider logo/icon with proper branding
 * Uses SVG icons for Microsoft and CalDAV with brand colors
 */
export default function ProviderIcon({
  provider,
  size = 'md',
  className = '',
}: ProviderIconProps) {
  const sizeClass = sizeClasses[size];

  const label =
    provider === 'GOOGLE' ? 'Google Calendar' :
    provider === 'MICROSOFT' ? 'Microsoft Outlook' :
    provider === 'CALDAV' ? 'Exchange / CalDAV' :
    provider === 'ICS' ? 'ICS Subscription' :
    'Apple Calendar';

  // Microsoft Outlook icon with proper branding
  if (provider === 'MICROSOFT') {
    return (
      <div
        className={`flex items-center justify-center ${sizeClass} ${className}`}
        role="img"
        aria-label={label}
        title={label}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <rect width="24" height="24" rx="2" fill="#0078D4"/>
          <path d="M6 8h12v8H6z" fill="#fff"/>
          <path d="M12 8l6 4-6 4-6-4z" fill="#0078D4" opacity="0.8"/>
          <path d="M12 8v8" stroke="#fff" strokeWidth="0.5"/>
          <path d="M6 12h12" stroke="#fff" strokeWidth="0.5"/>
        </svg>
      </div>
    );
  }

  // CalDAV/Exchange icon
  if (provider === 'CALDAV') {
    return (
      <div
        className={`flex items-center justify-center ${sizeClass} ${className} bg-gray-100 rounded-lg`}
        role="img"
        aria-label={label}
        title={label}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-2/3 h-2/3 text-gray-700">
          <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
        </svg>
      </div>
    );
  }

  // ICS Subscription icon
  if (provider === 'ICS') {
    return (
      <div
        className={`flex items-center justify-center ${sizeClass} ${className} bg-purple-100 rounded-lg`}
        role="img"
        aria-label={label}
        title={label}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-2/3 h-2/3 text-purple-700"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
    );
  }

  // Fallback to emojis for other providers
  const icon =
    provider === 'GOOGLE' ? '📅' : '🍎';

  return (
    <div
      className={`flex items-center justify-center ${sizeClass} ${className}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {icon}
    </div>
  );
}
