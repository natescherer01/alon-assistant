import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { ErrorMessage } from '../components/ErrorMessage';
import { PasswordStrength } from '../components/PasswordStrength';
import { validateEmail, validatePassword, validatePasswordMatch, validateName } from '../utils/validation';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, isLoading, error, clearError, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [validationErrors, setValidationErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};

    // Validate first name (optional but if provided must be valid)
    if (formData.firstName && !validateName(formData.firstName)) {
      errors.firstName = 'First name must be between 1 and 50 characters';
    }

    // Validate last name (optional but if provided must be valid)
    if (formData.lastName && !validateName(formData.lastName)) {
      errors.lastName = 'Last name must be between 1 and 50 characters';
    }

    // Validate email
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Validate password
    if (!formData.password) {
      errors.password = 'Password is required';
    } else {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.valid) {
        errors.password = passwordValidation.errors[0]; // Show first error
      }
    }

    // Validate password confirmation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (!validatePasswordMatch(formData.password, formData.confirmPassword)) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Validate terms acceptance
    if (!acceptTerms) {
      errors.terms = 'You must accept the terms and conditions';
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
      await signup(
        formData.email,
        formData.password,
        formData.firstName || undefined,
        formData.lastName || undefined
      );
      // Navigation happens via useEffect when isAuthenticated becomes true
    } catch (err) {
      // Error is handled by the store
      console.error('Signup error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-gray-900">
          Calendar Integration
        </h1>
        <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors"
          >
            Sign in
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Input
                label="First name"
                type="text"
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                value={formData.firstName}
                onChange={handleInputChange('firstName')}
                error={validationErrors.firstName}
                placeholder="John"
                autoFocus
              />

              <Input
                label="Last name"
                type="text"
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                value={formData.lastName}
                onChange={handleInputChange('lastName')}
                error={validationErrors.lastName}
                placeholder="Doe"
              />
            </div>

            <Input
              label="Email address"
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleInputChange('email')}
              error={validationErrors.email}
              placeholder="you@example.com"
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleInputChange('password')}
                error={validationErrors.password}
                placeholder="Create a strong password"
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

              {formData.password && (
                <div className="mt-3">
                  <PasswordStrength password={formData.password} />
                </div>
              )}
            </div>

            <div>
              <Input
                label="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                error={validationErrors.confirmPassword}
                placeholder="Re-enter your password"
              />

              <div className="mt-2 flex items-center">
                <input
                  id="show-confirm-password"
                  type="checkbox"
                  checked={showConfirmPassword}
                  onChange={(e) => setShowConfirmPassword(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
                <label
                  htmlFor="show-confirm-password"
                  className="ml-2 block text-sm text-gray-700 cursor-pointer"
                >
                  Show password
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-start">
                <input
                  id="accept-terms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => {
                    setAcceptTerms(e.target.checked);
                    if (validationErrors.terms) {
                      setValidationErrors((prev) => ({ ...prev, terms: undefined }));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer mt-1"
                />
                <label
                  htmlFor="accept-terms"
                  className="ml-2 block text-sm text-gray-700 cursor-pointer"
                >
                  I accept the{' '}
                  <a
                    href="#"
                    className="text-blue-600 hover:text-blue-500 underline"
                    onClick={(e) => e.preventDefault()}
                  >
                    Terms and Conditions
                  </a>{' '}
                  and{' '}
                  <a
                    href="#"
                    className="text-blue-600 hover:text-blue-500 underline"
                    onClick={(e) => e.preventDefault()}
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>
              {validationErrors.terms && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.terms}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              disabled={isLoading}
            >
              Create account
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Already have an account?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link to="/login">
                <Button type="button" variant="secondary" fullWidth>
                  Sign in instead
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
