/**
 * Centralized calendar color system
 * Provides consistent color handling for providers and individual calendars
 */

// Provider type matching the API
export type Provider = 'GOOGLE' | 'MICROSOFT' | 'ICS' | 'APPLE' | 'CALDAV';

// Provider brand colors (hex values)
export const PROVIDER_HEX_COLORS: Record<Provider, string> = {
  GOOGLE: '#4285F4',
  MICROSOFT: '#F78234',
  ICS: '#9333EA',
  APPLE: '#6B7280',
  CALDAV: '#6B7280',
};

// Provider display names
export const PROVIDER_NAMES: Record<Provider, string> = {
  GOOGLE: 'Google',
  MICROSOFT: 'Microsoft',
  ICS: 'ICS',
  APPLE: 'Apple',
  CALDAV: 'CalDAV',
};

// Provider Tailwind classes for badges (background + text)
export const PROVIDER_BADGE_CLASSES: Record<Provider, string> = {
  GOOGLE: 'bg-blue-100 text-blue-800',
  MICROSOFT: 'bg-orange-100 text-orange-800',
  ICS: 'bg-purple-100 text-purple-800',
  APPLE: 'bg-gray-100 text-gray-800',
  CALDAV: 'bg-gray-100 text-gray-800',
};

// Provider Tailwind classes for left border accent
export const PROVIDER_BORDER_CLASSES: Record<Provider, string> = {
  GOOGLE: 'border-l-blue-500',
  MICROSOFT: 'border-l-orange-500',
  ICS: 'border-l-purple-500',
  APPLE: 'border-l-gray-500',
  CALDAV: 'border-l-gray-500',
};

// Provider Tailwind classes for background dots/indicators
export const PROVIDER_DOT_CLASSES: Record<Provider, string> = {
  GOOGLE: 'bg-blue-500',
  MICROSOFT: 'bg-orange-500',
  ICS: 'bg-purple-500',
  APPLE: 'bg-gray-500',
  CALDAV: 'bg-gray-500',
};

// Provider Tailwind classes for lighter background (used in collapsed sidebar)
export const PROVIDER_BG_LIGHT_CLASSES: Record<Provider, string> = {
  GOOGLE: 'bg-blue-500',
  MICROSOFT: 'bg-orange-500',
  ICS: 'bg-purple-500',
  APPLE: 'bg-gray-500',
  CALDAV: 'bg-gray-500',
};

/**
 * Validates a hex color string
 * Returns a safe default if invalid
 */
export function validateHexColor(color: string | undefined | null, fallbackProvider?: Provider): string {
  // Default fallback color
  const defaultColor = fallbackProvider ? PROVIDER_HEX_COLORS[fallbackProvider] : '#3B82F6';

  if (!color) return defaultColor;

  // Check for valid 6-digit hex
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color;
  }

  // Check for valid 3-digit hex and convert to 6-digit
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return defaultColor;
}

/**
 * Gets the effective color for a calendar
 * Uses calendar color if available, falls back to provider color
 */
export function getCalendarColor(calendarColor: string | undefined | null, provider: Provider): string {
  return validateHexColor(calendarColor, provider);
}

/**
 * Adjusts hex color brightness
 * @param hex - Hex color string
 * @param percent - Positive to lighten, negative to darken
 */
export function adjustColorBrightness(hex: string, percent: number): string {
  const cleanHex = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return hex;
  }

  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return hex;

  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));

  return '#' + ((R << 16) | (G << 8) | B).toString(16).padStart(6, '0');
}

/**
 * Gets contrasting text color (black or white) for a background
 */
export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return '#000000';
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? '#000000' : '#FFFFFF';
}

/**
 * Gets provider badge classes
 */
export function getProviderBadgeClasses(provider: Provider): string {
  return PROVIDER_BADGE_CLASSES[provider] || PROVIDER_BADGE_CLASSES.APPLE;
}

/**
 * Gets provider border classes
 */
export function getProviderBorderClasses(provider: Provider): string {
  return PROVIDER_BORDER_CLASSES[provider] || PROVIDER_BORDER_CLASSES.APPLE;
}

/**
 * Gets provider dot classes
 */
export function getProviderDotClasses(provider: Provider): string {
  return PROVIDER_DOT_CLASSES[provider] || PROVIDER_DOT_CLASSES.APPLE;
}

/**
 * Gets provider display name
 */
export function getProviderName(provider: Provider): string {
  return PROVIDER_NAMES[provider] || provider;
}

/**
 * Creates inline style for event/calendar color with proper contrast
 */
export function createColorStyle(
  calendarColor: string | undefined | null,
  provider: Provider
): React.CSSProperties {
  const color = getCalendarColor(calendarColor, provider);
  return {
    backgroundColor: color,
    borderColor: adjustColorBrightness(color, -20),
    color: getContrastColor(color),
  };
}

/**
 * Creates inline style for a small color indicator dot
 */
export function createColorDotStyle(
  calendarColor: string | undefined | null,
  provider: Provider
): React.CSSProperties {
  const color = getCalendarColor(calendarColor, provider);
  return {
    backgroundColor: color,
  };
}
