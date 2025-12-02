import { InputHTMLAttributes, forwardRef, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Reusable input component with Dashboard styling
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, disabled, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const [isFocused, setIsFocused] = useState(false);

    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: '12px 16px',
      fontSize: '15px',
      border: error
        ? '1px solid #EF4444'
        : isFocused
          ? '1px solid #0066FF'
          : '1px solid rgba(0, 0, 0, 0.1)',
      borderRadius: '8px',
      outline: 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      background: disabled ? '#F9FAFB' : '#fff',
      cursor: disabled ? 'not-allowed' : 'text',
      boxShadow: isFocused ? '0 0 0 3px rgba(0, 102, 255, 0.1)' : 'none',
    };

    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#000',
              marginBottom: '8px',
            }}
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          style={inputStyle}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />

        {error && (
          <p
            id={`${inputId}-error`}
            style={{ marginTop: '4px', fontSize: '13px', color: '#EF4444' }}
            role="alert"
          >
            {error}
          </p>
        )}

        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            style={{ marginTop: '4px', fontSize: '13px', color: '#666' }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
