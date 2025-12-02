import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/Toast';
import { useToast } from './hooks/useToast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  const { toasts, removeToast } = useToast();

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            {/* OAuth Callback Routes */}
            <Route
              path="/oauth/google/callback"
              element={
                <ProtectedRoute>
                  <OAuthCallbackPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/oauth/microsoft/callback"
              element={
                <ProtectedRoute>
                  <OAuthCallbackPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/oauth/apple/callback"
              element={
                <ProtectedRoute>
                  <OAuthCallbackPage />
                </ProtectedRoute>
              }
            />
            {/* 404 - Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Toast Notifications */}
          <ToastContainer toasts={toasts} onRemove={removeToast} />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
