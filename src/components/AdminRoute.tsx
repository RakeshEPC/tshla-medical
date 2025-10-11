import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const [authCheckDelay, setAuthCheckDelay] = useState(true);
  const [debugCountdown, setDebugCountdown] = useState<number | null>(null);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Add a small delay to allow auth state to properly propagate
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthCheckDelay(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Store the current path to redirect back after login
    if (!isAuthenticated && !loading && !authCheckDelay) {
      sessionStorage.setItem('redirectPath', location.pathname);
    }
  }, [isAuthenticated, loading, location, authCheckDelay]);

  // Countdown timer for debug redirect
  useEffect(() => {
    if (debugCountdown !== null && debugCountdown > 0) {
      const timer = setTimeout(() => {
        setDebugCountdown(debugCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (debugCountdown === 0) {
      setShouldRedirect(true);
    }
  }, [debugCountdown]);

  // Show loading while auth context is loading or during our delay period
  if (loading || authCheckDelay) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // DEBUG: Log auth state
  const authDebugInfo = {
    isAuthenticated,
    loading,
    authCheckDelay,
    user: user ? {
      id: user.id,
      email: user.email,
      role: user.role,
      accessType: user.accessType
    } : null
  };

  console.log('🔐 [AdminRoute] Auth Check:', authDebugInfo);

  // Check if user is authenticated
  if (!isAuthenticated) {
    console.error('❌ [AdminRoute] NOT AUTHENTICATED - Will redirect to login in 10 seconds');
    console.log('   User object:', user);
    console.log('   isAuthenticated:', isAuthenticated);
    console.log('   🚨 CHECK CONSOLE LOGS ABOVE - You have 10 seconds to copy them!');

    // Save debug info to sessionStorage
    sessionStorage.setItem('adminRoute_debug', JSON.stringify({
      timestamp: new Date().toISOString(),
      reason: 'NOT_AUTHENTICATED',
      authDebugInfo,
      message: 'User is not authenticated'
    }));

    // Start countdown if not already started
    if (debugCountdown === null) {
      setDebugCountdown(10);
    }

    // Show error screen with countdown
    if (shouldRedirect) {
      return <Navigate to="/login" replace />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="max-w-2xl w-full bg-white shadow-2xl rounded-lg p-8 text-center border-4 border-red-500">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-red-900 mb-4">🔍 DEBUG MODE: Authentication Failed</h1>
          <p className="text-xl text-red-700 mb-6">NOT AUTHENTICATED</p>
          <div className="bg-red-100 border-2 border-red-300 rounded-lg p-6 mb-6">
            <p className="text-lg font-semibold text-red-900 mb-4">
              Redirecting to login in: <span className="text-4xl font-bold">{debugCountdown}</span> seconds
            </p>
            <p className="text-sm text-red-700 mb-4">
              ⚠️ PLEASE OPEN BROWSER CONSOLE (F12) AND COPY ALL LOGS STARTING WITH [AuthContext] and [SupabaseAuth]
            </p>
            <div className="bg-white rounded p-4 text-left">
              <p className="text-xs font-mono text-gray-800 mb-2"><strong>Debug Info:</strong></p>
              <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                {JSON.stringify(authDebugInfo, null, 2)}
              </pre>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
          >
            Skip Wait - Go to Login Now
          </button>
        </div>
      </div>
    );
  }

  // Check if user has admin role (admin or super_admin)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const roleDebugInfo = {
    userRole: user?.role,
    isAdmin,
    requiredRoles: ['admin', 'super_admin']
  };

  console.log('👤 [AdminRoute] Role Check:', roleDebugInfo);

  if (!isAdmin) {
    console.error('❌ [AdminRoute] INSUFFICIENT PERMISSIONS - Will redirect in 10 seconds');
    console.log('   🚨 CHECK CONSOLE LOGS ABOVE - You have 10 seconds to copy them!');

    // Save debug info to sessionStorage
    sessionStorage.setItem('adminRoute_debug', JSON.stringify({
      timestamp: new Date().toISOString(),
      reason: 'INSUFFICIENT_PERMISSIONS',
      authDebugInfo,
      roleDebugInfo,
      message: `User role is "${user?.role}" but requires "admin" or "super_admin"`
    }));

    // Start countdown if not already started
    if (debugCountdown === null) {
      setDebugCountdown(10);
    }

    // After countdown, show access denied
    if (shouldRedirect) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You do not have permission to access the admin dashboard. This area is restricted to administrators only.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Current role: {user?.role || 'none'} | Email: {user?.email || 'unknown'}
            </p>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    // Show countdown screen
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="max-w-2xl w-full bg-white shadow-2xl rounded-lg p-8 text-center border-4 border-orange-500">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-orange-900 mb-4">🔍 DEBUG MODE: Insufficient Permissions</h1>
          <p className="text-xl text-orange-700 mb-6">ACCESS DENIED</p>
          <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-6 mb-6">
            <p className="text-lg font-semibold text-orange-900 mb-4">
              Showing access denied in: <span className="text-4xl font-bold">{debugCountdown}</span> seconds
            </p>
            <p className="text-sm text-orange-700 mb-4">
              ⚠️ PLEASE OPEN BROWSER CONSOLE (F12) AND COPY ALL LOGS
            </p>
            <div className="bg-white rounded p-4 text-left mb-4">
              <p className="text-xs font-mono text-gray-800 mb-2"><strong>Auth Debug Info:</strong></p>
              <pre className="text-xs text-gray-700 overflow-auto max-h-32">
                {JSON.stringify(authDebugInfo, null, 2)}
              </pre>
            </div>
            <div className="bg-white rounded p-4 text-left">
              <p className="text-xs font-mono text-gray-800 mb-2"><strong>Role Debug Info:</strong></p>
              <pre className="text-xs text-gray-700 overflow-auto max-h-32">
                {JSON.stringify(roleDebugInfo, null, 2)}
              </pre>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold"
          >
            Skip Wait - Go to Dashboard Now
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
