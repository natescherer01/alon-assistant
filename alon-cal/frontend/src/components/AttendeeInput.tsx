import { useState, KeyboardEvent } from 'react';
import type { AttendeeInput } from '../types/event';

interface AttendeeInputProps {
  attendees: AttendeeInput[];
  onChange: (attendees: AttendeeInput[]) => void;
  maxAttendees?: number;
  error?: string;
}

/**
 * Chip input component for managing event attendees
 * Supports email validation and chip-style display
 */
export default function AttendeeInput({
  attendees,
  onChange,
  maxAttendees = 100,
  error,
}: AttendeeInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

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
    <div className="w-full">
      <label htmlFor="attendee-input" className="block text-sm font-medium text-gray-700 mb-1">
        Attendees
      </label>

      {/* Chip Container */}
      <div
        className={`min-h-[42px] w-full px-3 py-2 border rounded-lg transition-colors duration-200 ${
          displayError
            ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500'
            : 'border-gray-300 focus-within:border-blue-500 focus-within:ring-blue-500'
        } focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-1`}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {/* Attendee Chips */}
          {attendees.map((attendee) => (
            <div
              key={attendee.email}
              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
            >
              <span>{attendee.email}</span>
              <button
                type="button"
                onClick={() => removeAttendee(attendee.email)}
                className="text-blue-600 hover:text-blue-800 focus:outline-none"
                aria-label={`Remove ${attendee.email}`}
              >
                <svg
                  className="w-4 h-4"
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
          <div className="flex-1 flex items-center gap-2 min-w-[200px]">
            <input
              id="attendee-input"
              type="email"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setLocalError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={attendees.length === 0 ? 'Enter email address' : ''}
              className="flex-1 border-none outline-none focus:ring-0 p-0 text-sm"
              aria-invalid={displayError ? 'true' : 'false'}
              aria-describedby={displayError ? 'attendee-error' : undefined}
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleAddClick}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Helper Text */}
      {!displayError && (
        <p className="mt-1 text-sm text-gray-500">
          Press Enter or click Add to add an attendee. {attendees.length}/{maxAttendees} attendees
        </p>
      )}

      {/* Error Message */}
      {displayError && (
        <p id="attendee-error" className="mt-1 text-sm text-red-600" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
