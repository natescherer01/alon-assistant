import { useEffect, useState } from 'react';

interface ErrorMessageProps {
  message: string;
  severity?: 'error' | 'warning' | 'info';
  onClose?: () => void;
  autoDismiss?: boolean;
  autoDismissTime?: number;
}

/**
 * Error message component with auto-dismiss and severity levels
 * @param message - Error message text
 * @param severity - Message severity level
 * @param onClose - Callback when message is closed
 * @param autoDismiss - Auto-dismiss after timeout
 * @param autoDismissTime - Time in ms before auto-dismiss (default 5000)
 */
export function ErrorMessage({
  message,
  severity = 'error',
  onClose,
  autoDismiss = false,
  autoDismissTime = 5000,
}: ErrorMessageProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, autoDismissTime);

      return () => clearTimeout(timer);
    }
  }, [autoDismiss, autoDismissTime, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  const styles = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: '❌',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: '⚠️',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'ℹ️',
    },
  };

  const style = styles[severity];

  return (
    <div
      className={`${style.bg} ${style.border} border rounded-lg p-4 flex items-start justify-between`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start space-x-3">
        <span className="text-lg" aria-hidden="true">{style.icon}</span>
        <p className={`${style.text} text-sm font-medium`}>{message}</p>
      </div>

      {onClose && (
        <button
          onClick={handleClose}
          className={`${style.text} hover:opacity-70 transition-opacity ml-4 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${severity === 'error' ? 'red' : severity === 'warning' ? 'yellow' : 'blue'}-500 rounded`}
          aria-label="Close message"
        >
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
