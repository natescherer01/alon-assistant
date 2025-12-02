import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { ErrorMessage } from '../components/ErrorMessage';
import { validateEmail } from '../utils/validation';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, isAuthenticated, checkAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [authChecked, setAuthChecked] = useState(false);

  // Verify authentication status on mount
  useEffect(() => {
    const verifyAuth = async () => {
      await checkAuth();
      setAuthChecked(true);
    };
    verifyAuth();
  }, [checkAuth]);

  // Redirect if already authenticated (only after initial auth check)
  useEffect(() => {
    if (authChecked && isAuthenticated && !isLoading) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [authChecked, isAuthenticated, isLoading, navigate, location]);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    try {
      await login(email, password);
      // Navigation happens via useEffect when isAuthenticated becomes true
    } catch (err) {
      // Error is handled by the store
      console.error('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-gray-900">
          Calendar Integration
        </h1>
        <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link
            to="/signup"
            className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors"
          >
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-6">
              <ErrorMessage message={error} onClose={clearError} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <Input
              label="Email address"
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationErrors.email) {
                  setValidationErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              error={validationErrors.email}
              placeholder="you@example.com"
              autoFocus
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (validationErrors.password) {
                    setValidationErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                error={validationErrors.password}
                placeholder="Enter your password"
              />

              <div className="mt-2 flex items-center">
                <input
                  id="show-password"
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
                <label
                  htmlFor="show-password"
                  className="ml-2 block text-sm text-gray-700 cursor-pointer"
                >
                  Show password
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-700 cursor-pointer"
                >
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a
                  href="#"
                  className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors"
                  onClick={(e) => e.preventDefault()}
                >
                  Forgot password?
                </a>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              disabled={isLoading}
            >
              Sign in
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  New to our platform?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link to="/signup">
                <Button type="button" variant="secondary" fullWidth>
                  Create an account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
