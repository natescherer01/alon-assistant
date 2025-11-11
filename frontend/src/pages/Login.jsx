import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../utils/authStore';

function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(formData.email, formData.password);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Gradient Background */}
      <div style={{
        position: 'absolute',
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
      }} />

      {/* Login Card */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '480px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderRadius: '24px',
        padding: '48px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img
            src="/alon-logo.png"
            alt="Alon"
            style={{
              height: '60px',
              marginBottom: '16px',
            }}
          />
          <p style={{ fontSize: '18px', color: 'rgba(0, 0, 0, 0.6)' }}>
            Sign in to your account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <p style={{ color: '#DC2626', fontSize: '14px' }}>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '32px',
          fontSize: '14px',
          color: 'rgba(0, 0, 0, 0.6)',
        }}>
          Don't have an account?{' '}
          <Link
            to="/signup"
            style={{
              color: '#0066FF',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
