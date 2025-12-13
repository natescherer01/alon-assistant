import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../utils/authStore';
import { authAPI } from '../api/client';
import { useIsMobile } from '../hooks/useIsMobile';

// Common timezones list
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
];

function Profile() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const isMobile = useIsMobile(768);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    timezone: user?.timezone || 'UTC',
  });
  const [saveMessage, setSaveMessage] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    // Update form data when user changes
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        timezone: user.timezone || 'UTC',
      });
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEdit = () => {
    setIsEditing(true);
    setSaveMessage(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({
      full_name: user.full_name || '',
      timezone: user.timezone || 'UTC',
    });
    setSaveMessage(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const updatedUser = await authAPI.updateProfile(formData);
      setUser(updatedUser);
      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to update profile',
      });
    } finally {
      setIsSaving(false);
    }
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
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Minimal Navbar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #eee',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: isMobile ? '12px 16px' : '12px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/alon-logo.png"
              alt="Alon"
              style={{
                height: isMobile ? '32px' : '40px',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/dashboard')}
            />
          </div>

          {/* Mobile: Menu Button */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                padding: '8px',
                background: 'transparent',
                border: '1px solid #eee',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5">
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>
          )}

          {/* Desktop: Navigation */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Chat
              </button>

              <button
                onClick={() => navigate('/tasks')}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Tasks
              </button>

              <button
                onClick={() => navigate('/calendar')}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Calendar
              </button>

              <button
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#000',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'default',
                }}
              >
                Profile
              </button>

              <div style={{ width: '1px', height: '20px', background: '#eee', margin: '0 8px' }} />

              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#666',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobile && mobileMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            padding: '8px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}>
            <button
              onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Chat
            </button>
            <button
              onClick={() => { navigate('/tasks'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Tasks
            </button>
            <button
              onClick={() => { navigate('/calendar'); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Calendar
            </button>
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#000',
                background: '#f5f5f5',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Profile
            </button>
            <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
            <button
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#999',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Logout
            </button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="profile-container" style={{ position: 'relative', zIndex: 1, flex: 1, maxWidth: '640px', width: '100%', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: isMobile ? '20px' : '32px' }}>
          <h1 style={{
            fontSize: isMobile ? '24px' : '28px',
            fontWeight: '600',
            color: '#000',
            marginBottom: '4px',
          }}>
            Profile
          </h1>
          <p style={{ fontSize: '14px', color: '#999' }}>
            View and edit your account information
          </p>
        </div>

        {/* Profile Card */}
        <div className="profile-card" style={{
          background: '#fff',
          borderRadius: '12px',
          padding: isMobile ? '20px' : '24px',
          marginBottom: '24px',
          border: '1px solid #eee',
        }}>
          {/* Avatar Section */}
          <div className="profile-avatar-section" style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            gap: isMobile ? '12px' : '16px',
            marginBottom: isMobile ? '20px' : '24px',
            paddingBottom: isMobile ? '20px' : '24px',
            borderBottom: '1px solid #eee',
            textAlign: isMobile ? 'center' : 'left',
          }}>
            <div style={{
              width: isMobile ? '56px' : '64px',
              height: isMobile ? '56px' : '64px',
              borderRadius: '50%',
              background: '#000',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: '500',
              flexShrink: 0,
            }}>
              {getInitials(user?.full_name || user?.email)}
            </div>
            <div>
              <h2 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                color: '#000',
                marginBottom: '2px',
              }}>
                {user.full_name || 'User'}
              </h2>
              <p style={{ fontSize: '14px', color: '#999', wordBreak: 'break-all' }}>
                {user.email}
              </p>
            </div>
          </div>

          {/* Account Details */}
          <div className="profile-header-actions" style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? '12px' : '0',
            marginBottom: '20px',
          }}>
            <h3 style={{
              fontSize: '15px',
              fontWeight: '600',
              color: '#000',
              margin: 0,
            }}>
              Account Information
            </h3>

            {/* Edit/Save/Cancel Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#666',
                      background: 'transparent',
                      border: '1px solid #eee',
                      borderRadius: '6px',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      opacity: isSaving ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSaving) e.target.style.background = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#fff',
                      background: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      opacity: isSaving ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSaving) e.target.style.background = '#333';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#000';
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#fff',
                    background: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#333';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#000';
                  }}
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div style={{
              padding: '10px 14px',
              marginBottom: '20px',
              borderRadius: '6px',
              fontSize: '13px',
              background: saveMessage.type === 'success' ? '#f5f5f5' : '#fafafa',
              color: saveMessage.type === 'success' ? '#333' : '#666',
              border: '1px solid #eee',
            }}>
              {saveMessage.text}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#999',
                marginBottom: '6px',
              }}>
                Full Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  style={{
                    width: '100%',
                    fontSize: '14px',
                    color: '#000',
                    padding: '10px 12px',
                    background: '#fff',
                    border: '1px solid #000',
                    borderRadius: '6px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <p style={{
                  fontSize: '14px',
                  color: '#000',
                  padding: '10px 12px',
                  background: '#fafafa',
                  borderRadius: '6px',
                  border: '1px solid #eee',
                }}>
                  {user.full_name || 'Not set'}
                </p>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#999',
                marginBottom: '6px',
              }}>
                Email Address
              </label>
              <p style={{
                fontSize: '14px',
                color: '#000',
                padding: '10px 12px',
                background: '#fafafa',
                borderRadius: '6px',
                border: '1px solid #eee',
              }}>
                {user.email}
              </p>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#999',
                marginBottom: '6px',
              }}>
                Timezone
              </label>
              {isEditing ? (
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    fontSize: '14px',
                    color: '#000',
                    padding: '10px 12px',
                    background: '#fff',
                    border: '1px solid #000',
                    borderRadius: '6px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{
                  fontSize: '14px',
                  color: '#000',
                  padding: '10px 12px',
                  background: '#fafafa',
                  borderRadius: '6px',
                  border: '1px solid #eee',
                }}>
                  {user.timezone || 'UTC'}
                </p>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#999',
                marginBottom: '6px',
              }}>
                User ID
              </label>
              <p style={{
                fontSize: '13px',
                color: '#666',
                padding: '10px 12px',
                background: '#fafafa',
                borderRadius: '6px',
                fontFamily: 'monospace',
                border: '1px solid #eee',
              }}>
                {user.id}
              </p>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#999',
                marginBottom: '6px',
              }}>
                Member Since
              </label>
              <p style={{
                fontSize: '14px',
                color: '#000',
                padding: '10px 12px',
                background: '#fafafa',
                borderRadius: '6px',
                border: '1px solid #eee',
              }}>
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  timeZone: user.timezone || 'UTC',
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
          background: '#fff',
          borderRadius: '12px',
          padding: isMobile ? '20px' : '24px',
          border: '1px solid #eee',
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '600',
            color: '#000',
            marginBottom: '8px',
          }}>
            Danger Zone
          </h3>
          <p style={{
            fontSize: '13px',
            color: '#999',
            marginBottom: '16px',
            lineHeight: '1.5',
          }}>
            Deleting your account is permanent and cannot be undone. All your data including tasks and chat history will be permanently deleted.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#999',
              background: 'transparent',
              border: '1px solid #eee',
              borderRadius: '6px',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
              transition: 'all 0.2s',
              width: isMobile ? '100%' : 'auto',
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.target.style.background = '#f5f5f5';
                e.target.style.color = '#666';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = '#999';
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
