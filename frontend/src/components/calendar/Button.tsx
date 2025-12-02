import { ButtonHTMLAttributes, ReactNode, useState } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
  fullWidth?: boolean;
}

/**
 * Reusable button component with Dashboard styling
 */
export function Button({
  children,
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getBackgroundColor = () => {
    if (disabled || isLoading) {
      if (variant === 'primary') return '#93C5FD';
      if (variant === 'danger') return '#FCA5A5';
      return '#E5E7EB';
    }
    if (isHovered) {
      if (variant === 'primary') return '#0052CC';
      if (variant === 'danger') return '#B91C1C';
      return '#E5E7EB';
    }
    if (variant === 'primary') return '#0066FF';
    if (variant === 'danger') return '#DC2626';
    return '#fff';
  };

  const getTextColor = () => {
    if (variant === 'secondary') return '#374151';
    return '#fff';
  };

  const getBorder = () => {
    if (variant === 'secondary') return '1px solid rgba(0, 0, 0, 0.1)';
    return 'none';
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    color: getTextColor(),
    background: getBackgroundColor(),
    border: getBorder(),
    borderRadius: '8px',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: fullWidth ? '100%' : 'auto',
  };

  return (
    <button
      style={buttonStyle}
      disabled={disabled || isLoading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {isLoading ? (
        <>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTop: '2px solid #fff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span>Loading...</span>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </>
      ) : (
        children
      )}
    </button>
  );
}
