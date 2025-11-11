import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabaseAuthService } from '../services/supabaseAuth.service';

interface PumpDriveAuthGuardProps {
  children: React.ReactNode;
}

export default function PumpDriveAuthGuard({ children }: PumpDriveAuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      console.log('🔐 PumpDriveAuthGuard: Checking authentication...');
      console.log('📍 Current path:', location.pathname);

      // Use Supabase auth service instead of old pump auth
      const isAuth = await supabaseAuthService.isAuthenticated();

      if (!isAuth) {
        console.log('❌ Auth check FAILED - Not authenticated with Supabase');
        setIsAuthenticated(false);
        return;
      }

      // Get user profile to verify PumpDrive access
      const result = await supabaseAuthService.getCurrentUser();

      if (!result.success || !result.user) {
        console.log('❌ Auth check FAILED - Could not get user profile');
        setIsAuthenticated(false);
        return;
      }

      console.log('✅ Auth check PASSED - User authenticated:', {
        email: result.user.email,
        accessType: result.user.accessType,
        pumpdriveEnabled: result.user.accessType === 'pumpdrive'
      });

      setIsAuthenticated(true);
    } catch (error) {
      console.error('❌ Authentication check failed:', error);
      setIsAuthenticated(false);
    }
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">Checking access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to patient login
  if (!isAuthenticated) {
    // Store current location to redirect back after login
    const redirectPath = location.pathname + location.search;
    sessionStorage.setItem('pumpDriveRedirectAfterLogin', redirectPath);

    console.log('🔄 Redirecting to patient-login...');
    // Redirect to patient login (not create-account which redirects to patient-register)
    return <Navigate to="/patient-login" replace />;
  }

  // Authenticated - render protected content
  return <>{children}</>;
}
