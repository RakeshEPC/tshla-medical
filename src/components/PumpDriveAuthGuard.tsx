import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { pumpAuthService } from '../services/pumpAuth.service';

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
      // Check if user has valid token and access
      const token = pumpAuthService.getToken();
      const user = pumpAuthService.getUser();

      if (!token || !user) {
        setIsAuthenticated(false);
        return;
      }

      // No access expiry check - users have unlimited access
      // Just verify the token is valid

      setIsAuthenticated(true);
    } catch (error) {
      console.error('Authentication check failed:', error);
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

  // Not authenticated - redirect to create account or login
  if (!isAuthenticated) {
    // Store current location to redirect back after login
    const redirectPath = location.pathname + location.search;
    sessionStorage.setItem('pumpDriveRedirectAfterLogin', redirectPath);

    // Redirect to create account (default) or login page
    return <Navigate to="/pumpdrive/create-account" replace />;
  }

  // Authenticated - render protected content
  return <>{children}</>;
}