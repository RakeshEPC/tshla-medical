import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import type { AuthUser } from '../services/supabaseAuth.service';
import { logError, logInfo } from '../services/logger.service';
import { AuthErrorHandler } from '../utils/authErrorHandler';

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
    // Check if user is already authenticated
    const checkAuth = async () => {
      logInfo('AuthContext', 'Starting auth check');
      try {
        const isAuth = await supabaseAuthService.isAuthenticated();

        if (isAuth) {
          const result = await supabaseAuthService.getCurrentUser();

          if (result.success && result.user) {
            logInfo('AuthContext', 'User authenticated successfully');
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
            logError('AuthContext', `Failed to get user profile: ${result.error}`);
          }
        }
      } catch (error) {
        logError('AuthContext', 'Auth check failed', { error });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 [AuthContext] Starting login...', { email });
      const result = await supabaseAuthService.login(email, password);
      console.log('🔐 [AuthContext] Login result:', { success: result.success, error: result.error });

      if (result.success && result.user) {
        console.log('✅ [AuthContext] Login successful, setting user');
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
        console.error('❌ [AuthContext] Login failed with error:', result.error);
        // Don't wrap the error twice - just throw it directly
        throw new Error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('❌ [AuthContext] Login exception:', error);
      logError('AuthContext', 'Login failed', { error });

      // Only use AuthErrorHandler if it's not already a formatted error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAlreadyFormatted = errorMessage.includes('An unexpected error occurred') ||
                                  errorMessage.includes('Invalid') ||
                                  errorMessage.includes('Network') ||
                                  errorMessage.includes('timed out') ||
                                  errorMessage.includes('inactive') ||
                                  errorMessage.includes('verification') ||
                                  errorMessage.includes('verified');

      if (isAlreadyFormatted) {
        console.log('🔄 [AuthContext] Error already formatted, throwing as-is');
        throw error;
      } else {
        console.log('🔄 [AuthContext] Formatting error with AuthErrorHandler');
        const userFriendlyError = AuthErrorHandler.getUserMessage(error, 'Login');
        throw new Error(userFriendlyError);
      }
    }
  };

  const logout = () => {
    supabaseAuthService.logout();
    setUser(null);
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
