import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const [authCheckDelay, setAuthCheckDelay] = useState(true);

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
  console.log('🔐 [AdminRoute] Auth Check:', {
    isAuthenticated,
    loading,
    authCheckDelay,
    user: user ? {
      id: user.id,
      email: user.email,
      role: user.role,
      accessType: user.accessType
    } : null
  });

  // Check if user is authenticated
  if (!isAuthenticated) {
    console.error('❌ [AdminRoute] NOT AUTHENTICATED - Redirecting to login');
    console.log('   User object:', user);
    console.log('   isAuthenticated:', isAuthenticated);
    return <Navigate to="/login" replace />;
  }

  // Check if user has admin role (admin or super_admin)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  console.log('👤 [AdminRoute] Role Check:', {
    userRole: user?.role,
    isAdmin,
    requiredRoles: ['admin', 'super_admin']
  });

  if (!isAdmin) {
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

  return <>{children}</>;
}
