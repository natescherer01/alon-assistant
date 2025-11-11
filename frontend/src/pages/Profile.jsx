import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../utils/authStore';
import { authAPI } from '../api/client';

function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data including tasks and chat history.'
    );

    if (!confirmed) return;

    // Double confirmation for destructive action
    const doubleConfirmed = window.confirm(
      'This is your last chance. Are you absolutely sure you want to permanently delete your account?'
    );

    if (!doubleConfirmed) return;

    setIsDeleting(true);
    try {
      await authAPI.deleteAccount();
      logout();
      navigate('/login');
    } catch (error) {
      alert('Failed to delete account: ' + (error.response?.data?.detail || error.message));
      setIsDeleting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Gradient Background */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        backgroundImage: `
          radial-gradient(circle 1200px at 15% 20%,
            rgba(64, 64, 176, 0.6) 0%,
            rgba(64, 64, 176, 0.3) 30%,
            rgba(64, 64, 176, 0.1) 50%,
            transparent 70%
          ),
          radial-gradient(circle 900px at 5% 70%,
            rgba(64, 64, 176, 0.45) 0%,
            rgba(64, 64, 176, 0.2) 40%,
            transparent 65%
          ),
          radial-gradient(circle 1100px at 90% 60%,
            rgba(0, 212, 221, 0.5) 0%,
            rgba(0, 212, 221, 0.25) 35%,
            rgba(0, 212, 221, 0.1) 50%,
            transparent 70%
          ),
          radial-gradient(circle 800px at 85% 10%,
            rgba(0, 212, 221, 0.35) 0%,
            rgba(0, 212, 221, 0.15) 40%,
            transparent 60%
          )
        `,
        filter: 'blur(180px)',
        pointerEvents: 'none',
      }} />

      {/* Glassmorphism Navbar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <img
            src="/alon-logo.png"
            alt="Alon"
            style={{
              height: '36px',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/dashboard')}
          />

          {/* User Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#fff',
                background: '#0066FF',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#0052CC';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#0066FF';
              }}
            >
              ← Back to Dashboard
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#666',
                background: 'transparent',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ position: 'relative', zIndex: 1, flex: 1, maxWidth: '800px', width: '100%', margin: '0 auto', padding: '48px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#000',
            marginBottom: '8px',
          }}>
            Profile
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(0, 0, 0, 0.6)' }}>
            View your account information
          </p>
        </div>

        {/* Profile Card */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
          {/* Avatar Section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            marginBottom: '32px',
            paddingBottom: '32px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#0066FF',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: '600',
            }}>
              {getInitials(user?.full_name || user?.email)}
            </div>
            <div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#000',
                marginBottom: '4px',
              }}>
                {user.full_name || 'User'}
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.6)' }}>
                {user.email}
              </p>
            </div>
          </div>

          {/* Account Details */}
          <h3 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#000',
            marginBottom: '24px',
          }}>
            Account Information
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgba(0, 0, 0, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}>
                Full Name
              </label>
              <p style={{
                fontSize: '16px',
                color: '#000',
                padding: '12px 16px',
                background: '#F9FAFB',
                borderRadius: '8px',
              }}>
                {user.full_name || 'Not set'}
              </p>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgba(0, 0, 0, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}>
                Email Address
              </label>
              <p style={{
                fontSize: '16px',
                color: '#000',
                padding: '12px 16px',
                background: '#F9FAFB',
                borderRadius: '8px',
              }}>
                {user.email}
              </p>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgba(0, 0, 0, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}>
                User ID
              </label>
              <p style={{
                fontSize: '14px',
                color: '#000',
                padding: '12px 16px',
                background: '#F9FAFB',
                borderRadius: '8px',
                fontFamily: 'monospace',
              }}>
                {user.id}
              </p>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: 'rgba(0, 0, 0, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}>
                Member Since
              </label>
              <p style={{
                fontSize: '16px',
                color: '#000',
                padding: '12px 16px',
                background: '#F9FAFB',
                borderRadius: '8px',
              }}>
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div style={{
          background: '#FEE2E2',
          borderRadius: '16px',
          padding: '32px',
          border: '1px solid #FCA5A5',
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#DC2626',
            marginBottom: '12px',
          }}>
            Danger Zone
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#991B1B',
            marginBottom: '24px',
            lineHeight: '1.6',
          }}>
            Deleting your account is permanent and cannot be undone. All your data including tasks and chat history will be permanently deleted.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#fff',
              background: '#DC2626',
              border: 'none',
              borderRadius: '8px',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) e.target.style.background = '#B91C1C';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#DC2626';
            }}
          >
            {isDeleting ? 'Deleting Account...' : 'Delete Account'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default Profile;
