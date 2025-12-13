import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../utils/authStore';
import { useIsMobile } from '../hooks/useIsMobile';

function Signup() {
  const navigate = useNavigate();
  const { signup, isLoading, error, clearError } = useAuthStore();
  const isMobile = useIsMobile(640);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

  const [validationError, setValidationError] = useState('');

  // Clear errors when component mounts or unmounts
  useEffect(() => {
    clearError();
    setValidationError('');
    return () => {
      clearError();
      setValidationError('');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount/unmount

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    // Only check if passwords match
    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    const result = await signup(formData.email, formData.password, formData.fullName);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  const handleChange = (e) => {
    // Clear errors when user starts typing
    if (error) {
      clearError();
    }
    if (validationError) {
      setValidationError('');
    }
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '16px' : '24px' }}>

      {/* Signup Card */}
      <div className="auth-card" style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: isMobile ? '100%' : '480px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderRadius: isMobile ? '16px' : '24px',
        padding: isMobile ? '24px' : '48px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '32px' : '40px' }}>
          <img
            src="/alon-logo.png"
            alt="Alon"
            style={{
              height: isMobile ? '48px' : '60px',
              marginBottom: '16px',
            }}
          />
          <p style={{ fontSize: isMobile ? '16px' : '18px', color: 'rgba(0, 0, 0, 0.6)' }}>
            Create your account
          </p>
        </div>

        {/* Error Message */}
        {(error || validationError) && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <p style={{ color: '#DC2626', fontSize: '14px', margin: 0 }}>
              {typeof error === 'string' ? error : (error ? JSON.stringify(error) : validationError)}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form-gap" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
          <div>
            <label htmlFor="fullName" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#000',
              marginBottom: '8px',
            }}>
              Full Name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="John Doe"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#000',
              marginBottom: '8px',
            }}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#000',
              marginBottom: '8px',
            }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#000',
              marginBottom: '8px',
            }}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              color: '#fff',
              background: '#0066FF',
              border: 'none',
              borderRadius: '16px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              transition: 'all 0.2s',
              marginTop: '8px',
            }}
          >
            {isLoading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '32px',
          fontSize: '14px',
          color: 'rgba(0, 0, 0, 0.6)',
        }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: '#0066FF',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
