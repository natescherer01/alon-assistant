import { useState } from 'react';

interface CreateEventButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Button to trigger the Create Event modal
 * Displays "+ Create Event" with icon
 */
export default function CreateEventButton({ onClick, disabled }: CreateEventButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        background: disabled ? '#9CA3AF' : isHovered ? '#0052CC' : '#0066FF',
        color: '#fff',
        border: 'none',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
        boxShadow: isHovered && !disabled ? '0 4px 12px rgba(0, 102, 255, 0.3)' : 'none',
      }}
      aria-label="Create new event"
    >
      <svg
        style={{ width: '20px', height: '20px' }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
      <span>Create Event</span>
    </button>
  );
}
