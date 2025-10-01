import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import SessionMonitor from './SessionMonitor';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const [authCheckDelay, setAuthCheckDelay] = useState(true);

  logDebug('ProtectedRoute', 'Debug message', {
    userData: localStorage.getItem('user_data')
  });
  logDebug('ProtectedRoute', 'Debug message', {});

  // Add a small delay to allow auth state to properly propagate
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthCheckDelay(false);
    }, 100); // Small delay to allow AuthContext to update

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Store the current path to redirect back after login
    if (!isAuthenticated && !loading && !authCheckDelay) {
      sessionStorage.setItem('redirectPath', location.pathname);
    }
  }, [isAuthenticated, loading, location, authCheckDelay]);

  // Show loading while auth context is loading or during our delay period
  if (loading || authCheckDelay) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Check if we have a valid token that just hasn't been validated yet
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');

    if (token && userData) {
      // Token and user data exist, but auth context hasn't updated yet
      // Give it a moment more to prevent race condition redirects
      logDebug('ProtectedRoute', 'Debug message', {});
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Authenticating...</p>
          </div>
        </div>
      );
    }

    return <Navigate to="/login" replace />;
  }

  return (
    <SessionMonitor>
      {children}
    </SessionMonitor>
  );
}