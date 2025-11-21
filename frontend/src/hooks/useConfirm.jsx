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

    return (
      <>
        {/* Backdrop */}
        <div
          onClick={handleClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 9998,
            animation: 'fadeIn 0.2s ease-out',
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
            maxWidth: '440px',
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background:
                  modalState.type === 'alert'
                    ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                    : 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '28px',
                boxShadow:
                  modalState.type === 'alert'
                    ? '0 8px 20px rgba(239, 68, 68, 0.3)'
                    : '0 8px 20px rgba(0, 102, 255, 0.3)',
              }}
            >
              {modalState.type === 'alert' ? '⚠️' : '❓'}
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#000',
                margin: '0 0 12px 0',
                textAlign: 'center',
                letterSpacing: '-0.3px',
              }}
            >
              {modalState.title}
            </h3>

            {/* Message */}
            <p
              style={{
                fontSize: '15px',
                color: 'rgba(0, 0, 0, 0.7)',
                lineHeight: '1.6',
                margin: '0 0 28px 0',
                textAlign: 'center',
              }}
            >
              {modalState.message}
            </p>

            {/* Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexDirection: modalState.type === 'alert' ? 'column' : 'row',
              }}
            >
              {modalState.type === 'confirm' && (
                <button
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#6B7280',
                    background: 'transparent',
                    border: '1px solid rgba(0, 0, 0, 0.15)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#F3F4F6';
                    e.target.style.borderColor = 'rgba(0, 0, 0, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                  }}
                >
                  {modalState.cancelText}
                </button>
              )}

              <button
                onClick={handleConfirm}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#fff',
                  background:
                    modalState.type === 'alert'
                      ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                      : 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow:
                    modalState.type === 'alert'
                      ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                      : '0 4px 12px rgba(0, 102, 255, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow =
                    modalState.type === 'alert'
                      ? '0 6px 16px rgba(239, 68, 68, 0.4)'
                      : '0 6px 16px rgba(0, 102, 255, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow =
                    modalState.type === 'alert'
                      ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                      : '0 4px 12px rgba(0, 102, 255, 0.3)';
                }}
              >
                {modalState.type === 'alert' ? 'OK' : modalState.confirmText}
              </button>
            </div>
          </div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translate(-50%, -45%);
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
