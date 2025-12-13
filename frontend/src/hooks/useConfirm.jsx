import { useState, useCallback } from 'react';

/**
 * Hook to easily use branded confirm/alert modals
 * Replaces browser confirm() and alert() with Alon-branded modals
 *
 * Usage:
 *   const { ConfirmDialog, confirm, alert } = useConfirm();
 *
 *   // In component render:
 *   return <><ConfirmDialog />...</>
 *
 *   // In handlers:
 *   const confirmed = await confirm('Delete task?', 'This action cannot be undone.');
 *   if (confirmed) { ... }
 *
 *   await alert('Error!', 'Failed to save task.');
 */
function useConfirm() {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    resolve: null,
  });

  const confirm = useCallback(
    (title, message, confirmText = 'Confirm', cancelText = 'Cancel') => {
      return new Promise((resolve) => {
        setModalState({
          isOpen: true,
          title,
          message,
          type: 'confirm',
          confirmText,
          cancelText,
          resolve,
        });
      });
    },
    []
  );

  const alert = useCallback((title, message) => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title,
        message,
        type: 'alert',
        confirmText: 'OK',
        cancelText: '',
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    setModalState((prev) => {
      if (prev.resolve) {
        prev.resolve(false); // Cancelled
      }
      return { ...prev, isOpen: false };
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setModalState((prev) => {
      if (prev.resolve) {
        prev.resolve(true); // Confirmed
      }
      return { ...prev, isOpen: false };
    });
  }, []);

  // Modal component
  const ConfirmDialog = useCallback(() => {
    if (!modalState.isOpen) return null;

    const isAlert = modalState.type === 'alert';

    return (
      <>
        {/* Backdrop */}
        <div
          onClick={handleClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9998,
            animation: 'fadeIn 0.15s ease-out',
          }}
        />

        {/* Modal */}
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            width: '90%',
            maxWidth: '380px',
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
              border: '1px solid #eee',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: isAlert ? '#fafafa' : '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isAlert ? '#666' : '#000'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isAlert ? (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </>
                )}
              </svg>
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: '17px',
                fontWeight: '600',
                color: '#000',
                margin: '0 0 8px 0',
                textAlign: 'center',
                letterSpacing: '-0.2px',
              }}
            >
              {modalState.title}
            </h3>

            {/* Message */}
            <p
              style={{
                fontSize: '14px',
                color: '#666',
                lineHeight: '1.5',
                margin: '0 0 24px 0',
                textAlign: 'center',
              }}
            >
              {modalState.message}
            </p>

            {/* Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexDirection: isAlert ? 'column' : 'row',
              }}
            >
              {modalState.type === 'confirm' && (
                <button
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#666',
                    background: '#f5f5f5',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#eee';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#f5f5f5';
                  }}
                >
                  {modalState.cancelText}
                </button>
              )}

              <button
                onClick={handleConfirm}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#fff',
                  background: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#333';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#000';
                }}
              >
                {isAlert ? 'OK' : modalState.confirmText}
              </button>
            </div>
          </div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translate(-50%, -48%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }
        `}</style>
      </>
    );
  }, [modalState, handleClose, handleConfirm]);

  return {
    ConfirmDialog,
    confirm,
    alert,
  };
}

export default useConfirm;
