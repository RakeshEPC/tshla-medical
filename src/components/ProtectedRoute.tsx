import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import SessionMonitor from './SessionMonitor';

// Session-level flag to track if user has been authenticated
// This persists across route changes and component remounts
const SESSION_AUTH_KEY = 'protected_route_authed';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const [authCheckDelay, setAuthCheckDelay] = useState(true);
  const [authTimeout, setAuthTimeout] = useState(false);
  const hasEverBeenAuthed = useRef(sessionStorage.getItem(SESSION_AUTH_KEY) === 'true');

  // Track when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
      hasEverBeenAuthed.current = true;
    }
  }, [isAuthenticated, user]);

  // Add a small delay to allow auth state to properly propagate
  // Only apply timeout logic on initial app load, not on navigation
  useEffect(() => {
    // If we've been authenticated before in this session, skip all timeout logic
    if (hasEverBeenAuthed.current) {
      setAuthCheckDelay(false);
      return;
    }

    const timer = setTimeout(() => {
      setAuthCheckDelay(false);
    }, 100);

    // If still not authenticated after 3 seconds, clear bad tokens and redirect
    // Only applies on initial load with stale tokens
    const timeoutTimer = setTimeout(() => {
      if (!hasEverBeenAuthed.current) {
        setAuthTimeout(true);
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(timeoutTimer);
    };
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
    // If we've been authenticated before in this session, this is likely a brief
    // state transition during navigation. Show loading and wait for auth to restore.
    if (hasEverBeenAuthed.current) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
      );
    }

    // Check if we have a valid token that just hasn't been validated yet
    let hasToken = false;
    let hasUserData = false;
    try {
      hasToken = !!localStorage.getItem('auth_token');
      hasUserData = !!localStorage.getItem('user_data');
    } catch {
      // Ignore localStorage errors
    }

    // If tokens exist but auth timed out, they're probably encrypted with wrong key
    // Clear them and redirect to login (only on initial app load)
    if (authTimeout && hasToken) {
      try {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('session_data');
        sessionStorage.removeItem(SESSION_AUTH_KEY);
      } catch {
        // Ignore errors
      }
      return <Navigate to="/login" replace />;
    }

    if (hasToken && hasUserData && !authTimeout) {
      // Token and user data exist, give auth context time to validate
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
