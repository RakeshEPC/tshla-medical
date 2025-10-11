import React, { createContext, useContext, useState, useEffect } from 'react';
import { unifiedAuthService } from '../services/unifiedAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  specialty?: string;
  practiceId?: string;
  accessType?: 'medical' | 'pumpdrive' | 'patient' | 'admin';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated using unified auth service
    const checkAuth = async () => {
      console.log('🔍 [AuthContext] Starting auth check...');
      try {
        const isAuth = await unifiedAuthService.isAuthenticated();
        console.log('🔍 [AuthContext] isAuthenticated() result:', isAuth);

        if (isAuth) {
          console.log('🔍 [AuthContext] User is authenticated, fetching profile...');
          const result = await unifiedAuthService.getCurrentUser();
          console.log('🔍 [AuthContext] getCurrentUser() result:', {
            success: result.success,
            hasUser: !!result.user,
            error: result.error,
            user: result.user ? {
              id: result.user.id,
              email: result.user.email,
              role: result.user.role,
              accessType: result.user.accessType
            } : null
          });

          if (result.success && result.user) {
            console.log('✅ [AuthContext] User profile loaded successfully');
            setUser({
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              role: result.user.role,
              specialty: result.user.specialty,
              practiceId: result.user.id,
              accessType: result.user.accessType,
            });
          } else {
            console.error('❌ [AuthContext] Failed to get user profile:', result.error);
          }
        } else {
          console.log('❌ [AuthContext] No active session found');
        }
      } catch (error) {
        console.error('❌ [AuthContext] Exception during auth check:', error);
        logError('AuthContext', 'Failed to check authentication', { error });
      } finally {
        console.log('🔍 [AuthContext] Auth check complete, loading=false');
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await unifiedAuthService.login(email, password);

      if (result.success && result.user) {
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          specialty: result.user.specialty,
          practiceId: result.user.id,
          accessType: result.user.accessType,
        });
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  };

  const logout = () => {
    unifiedAuthService.logout();
    setUser(null);
    // Don't force redirect here - let the calling component handle it
  };

  const contextValue = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
