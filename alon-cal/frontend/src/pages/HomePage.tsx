import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();

  useEffect(() => {
    // Verify authentication status on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Only redirect after auth check is complete
    if (!isLoading) {
      if (isAuthenticated) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
