import { useState, KeyboardEvent, CSSProperties } from 'react';
import type { AttendeeInput } from '../../types/event';

interface AttendeeInputProps {
  attendees: AttendeeInput[];
  onChange: (attendees: AttendeeInput[]) => void;
  maxAttendees?: number;
  error?: string;
  disabled?: boolean;
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '500',
  color: '#374151',
  marginBottom: '8px',
};

const chipStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  background: '#E6F0FF',
  color: '#0066FF',
  borderRadius: '6px',
  fontSize: '14px',
};

const inputContainerStyle: CSSProperties = {
  minHeight: '48px',
  width: '100%',
  padding: '8px 12px',
  border: '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: '8px',
  background: '#fff',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

/**
 * Chip input component for managing event attendees
 * Supports email validation and chip-style display
 */
export default function AttendeeInputComponent({
  attendees,
  onChange,
  maxAttendees = 100,
  error,
  disabled = false,
}: AttendeeInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addAttendee = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    // Validation checks
    if (!trimmedEmail) {
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (attendees.some((a) => a.email === trimmedEmail)) {
      setLocalError('This attendee has already been added');
      return;
    }

    if (attendees.length >= maxAttendees) {
      setLocalError(`Maximum ${maxAttendees} attendees allowed`);
      return;
    }

    // Add attendee
    onChange([...attendees, { email: trimmedEmail }]);
    setInputValue('');
    setLocalError(null);
  };

  const removeAttendee = (email: string) => {
    onChange(attendees.filter((a) => a.email !== email));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAttendee(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && attendees.length > 0) {
      // Remove last attendee if input is empty and backspace is pressed
      removeAttendee(attendees[attendees.length - 1].email);
    }
  };

  const handleAddClick = () => {
    addAttendee(inputValue);
  };

  const displayError = error || localError;

  return (
    <div style={{ width: '100%' }}>
      <label htmlFor="attendee-input" style={labelStyle}>
        Attendees
      </label>

      {/* Chip Container */}
      <div
        style={{
          ...inputContainerStyle,
          borderColor: displayError ? '#EF4444' : isFocused ? '#0066FF' : 'rgba(0, 0, 0, 0.1)',
          boxShadow: isFocused ? '0 0 0 3px rgba(0, 102, 255, 0.1)' : 'none',
          background: disabled ? '#F9FAFB' : '#fff',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {/* Attendee Chips */}
          {attendees.map((attendee) => (
            <div key={attendee.email} style={chipStyle}>
              <span>{attendee.email}</span>
              <button
                type="button"
                onClick={() => removeAttendee(attendee.email)}
                disabled={disabled}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  color: '#0066FF',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={`Remove ${attendee.email}`}
              >
                <svg
                  style={{ width: '16px', height: '16px' }}
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
              </button>
            </div>
          ))}

          {/* Input Field */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
            <input
              id="attendee-input"
              type="email"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setLocalError(null);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={attendees.length === 0 ? 'Enter email address' : ''}
              disabled={disabled}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                padding: '4px 0',
                fontSize: '14px',
                background: 'transparent',
              }}
              aria-invalid={displayError ? 'true' : 'false'}
              aria-describedby={displayError ? 'attendee-error' : undefined}
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleAddClick}
                disabled={disabled}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  background: '#0066FF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                Add
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Helper Text */}
      {!displayError && (
        <p style={{ marginTop: '6px', fontSize: '13px', color: '#666' }}>
          Press Enter or click Add to add an attendee. {attendees.length}/{maxAttendees} attendees
        </p>
      )}

      {/* Error Message */}
      {displayError && (
        <p id="attendee-error" style={{ marginTop: '6px', fontSize: '13px', color: '#EF4444' }} role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
