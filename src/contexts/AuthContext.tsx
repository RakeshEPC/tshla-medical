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
      try {
        const isAuth = await unifiedAuthService.isAuthenticated();
        if (isAuth) {
          const result = await unifiedAuthService.getCurrentUser();
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
          }
        }
      } catch (error) {
        logError('AuthContext', 'Failed to check authentication', { error });
      } finally {
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
