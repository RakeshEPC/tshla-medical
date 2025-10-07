/**
 * Supabase Authentication Service
 * Handles authentication using Supabase Auth + medical_staff/pump_users tables
 * Replaces the old MySQL-based authentication
 */

import { supabase } from '../lib/supabase';
import { logDebug, logError, logInfo } from './logger.service';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  specialty?: string;
  accessType: 'medical' | 'pumpdrive' | 'patient' | 'admin';
  authUserId: string; // Supabase auth.users ID
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

class SupabaseAuthService {
  /**
   * Login with email and password (Medical Staff)
   */
  async loginMedicalStaff(email: string, password: string): Promise<AuthResult> {
    try {
      logInfo('SupabaseAuth', 'Medical staff login attempt', { email });

      // Step 1: Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        logError('SupabaseAuth', 'Auth failed', { error: authError.message });
        return {
          success: false,
          error: authError.message,
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'No user data returned',
        };
      }

      // Step 2: Get medical_staff record
      const { data: staffData, error: staffError } = await supabase
        .from('medical_staff')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single();

      if (staffError || !staffData) {
        logError('SupabaseAuth', 'Medical staff record not found', {
          userId: authData.user.id,
          error: staffError
        });

        // Sign out since we couldn't find their staff record
        await supabase.auth.signOut();

        return {
          success: false,
          error: 'Medical staff profile not found',
        };
      }

      // Step 3: Update last login
      await supabase
        .from('medical_staff')
        .update({
          last_login: new Date().toISOString(),
          login_count: (staffData.login_count || 0) + 1,
        })
        .eq('id', staffData.id);

      // Step 4: Log access
      await this.logAccess(authData.user.id, staffData.email, 'medical_staff', 'LOGIN');

      const user: AuthUser = {
        id: staffData.id,
        email: staffData.email,
        name: `${staffData.first_name || ''} ${staffData.last_name || ''}`.trim() || staffData.username,
        role: staffData.role,
        specialty: staffData.specialty,
        accessType: 'medical',
        authUserId: authData.user.id,
      };

      logInfo('SupabaseAuth', 'Medical staff logged in successfully', {
        userId: user.id,
        role: user.role,
      });

      return {
        success: true,
        user,
        token: authData.session?.access_token,
      };
    } catch (error) {
      logError('SupabaseAuth', 'Login error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }

  /**
   * Login with email and password (PumpDrive Users)
   */
  async loginPumpUser(email: string, password: string): Promise<AuthResult> {
    try {
      logInfo('SupabaseAuth', 'PumpDrive user login attempt', { email });

      // Step 1: Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return {
          success: false,
          error: authError.message,
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'No user data returned',
        };
      }

      // Step 2: Get pump_users record
      const { data: pumpData, error: pumpError } = await supabase
        .from('pump_users')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single();

      if (pumpError || !pumpData) {
        // Sign out since we couldn't find their pump user record
        await supabase.auth.signOut();

        return {
          success: false,
          error: 'PumpDrive user profile not found',
        };
      }

      // Step 3: Update last login
      await supabase
        .from('pump_users')
        .update({
          last_login: new Date().toISOString(),
          login_count: (pumpData.login_count || 0) + 1,
        })
        .eq('id', pumpData.id);

      // Step 4: Log access
      await this.logAccess(authData.user.id, pumpData.email, 'pump_user', 'LOGIN');

      const user: AuthUser = {
        id: pumpData.id,
        email: pumpData.email,
        name: `${pumpData.first_name || ''} ${pumpData.last_name || ''}`.trim() || pumpData.username || pumpData.email,
        role: pumpData.is_admin ? 'admin' : 'user',
        accessType: 'pumpdrive',
        authUserId: authData.user.id,
      };

      logInfo('SupabaseAuth', 'PumpDrive user logged in successfully', {
        userId: user.id,
        isAdmin: pumpData.is_admin,
      });

      return {
        success: true,
        user,
        token: authData.session?.access_token,
      };
    } catch (error) {
      logError('SupabaseAuth', 'PumpDrive login error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }

  /**
   * Register new medical staff
   */
  async registerMedicalStaff(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    specialty?: string;
    practice?: string;
  }): Promise<AuthResult> {
    try {
      logInfo('SupabaseAuth', 'Registering medical staff', { email: data.email });

      // Step 1: Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        return {
          success: false,
          error: authError.message,
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'Failed to create user',
        };
      }

      // Step 2: Create medical_staff record
      const { data: staffData, error: staffError } = await supabase
        .from('medical_staff')
        .insert({
          email: data.email,
          username: data.email.split('@')[0],
          first_name: data.firstName,
          last_name: data.lastName,
          role: data.role,
          specialty: data.specialty,
          practice: data.practice,
          auth_user_id: authData.user.id,
          is_active: true,
          is_verified: false,
          created_by: 'self-registration',
        })
        .select()
        .single();

      if (staffError) {
        // If medical_staff creation fails, delete the auth user
        await supabase.auth.admin.deleteUser(authData.user.id);

        return {
          success: false,
          error: 'Failed to create medical staff profile',
        };
      }

      const user: AuthUser = {
        id: staffData.id,
        email: staffData.email,
        name: `${staffData.first_name} ${staffData.last_name}`,
        role: staffData.role,
        specialty: staffData.specialty,
        accessType: 'medical',
        authUserId: authData.user.id,
      };

      return {
        success: true,
        user,
        token: authData.session?.access_token,
      };
    } catch (error) {
      logError('SupabaseAuth', 'Registration error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  /**
   * Register new pump user
   */
  async registerPumpUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
  }): Promise<AuthResult> {
    try {
      logInfo('SupabaseAuth', 'Registering pump user', { email: data.email });

      // Step 1: Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        return {
          success: false,
          error: authError.message,
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'Failed to create user',
        };
      }

      // Step 2: Create pump_users record
      const { data: pumpData, error: pumpError } = await supabase
        .from('pump_users')
        .insert({
          email: data.email,
          username: data.email.split('@')[0],
          first_name: data.firstName,
          last_name: data.lastName,
          phone_number: data.phoneNumber,
          auth_user_id: authData.user.id,
          is_active: true,
          is_verified: false,
          current_payment_status: 'trial',
        })
        .select()
        .single();

      if (pumpError) {
        // If pump_users creation fails, delete the auth user
        await supabase.auth.admin.deleteUser(authData.user.id);

        return {
          success: false,
          error: 'Failed to create pump user profile',
        };
      }

      const user: AuthUser = {
        id: pumpData.id,
        email: pumpData.email,
        name: `${pumpData.first_name} ${pumpData.last_name}`,
        role: 'user',
        accessType: 'pumpdrive',
        authUserId: authData.user.id,
      };

      return {
        success: true,
        user,
        token: authData.session?.access_token,
      };
    } catch (error) {
      logError('SupabaseAuth', 'Pump user registration error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AuthResult> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return {
          success: false,
          error: 'Not authenticated',
        };
      }

      // Try medical_staff first
      const { data: staffData } = await supabase
        .from('medical_staff')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (staffData) {
        return {
          success: true,
          user: {
            id: staffData.id,
            email: staffData.email,
            name: `${staffData.first_name || ''} ${staffData.last_name || ''}`.trim(),
            role: staffData.role,
            specialty: staffData.specialty,
            accessType: 'medical',
            authUserId: user.id,
          },
        };
      }

      // Try pump_users
      const { data: pumpData } = await supabase
        .from('pump_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (pumpData) {
        return {
          success: true,
          user: {
            id: pumpData.id,
            email: pumpData.email,
            name: `${pumpData.first_name || ''} ${pumpData.last_name || ''}`.trim(),
            role: pumpData.is_admin ? 'admin' : 'user',
            accessType: 'pumpdrive',
            authUserId: user.id,
          },
        };
      }

      return {
        success: false,
        error: 'User profile not found',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user',
      };
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    logInfo('SupabaseAuth', 'User signed out');
  }

  /**
   * Log access for HIPAA compliance
   */
  private async logAccess(
    userId: string,
    userEmail: string,
    userType: string,
    action: string
  ): Promise<void> {
    try {
      await supabase.from('access_logs').insert({
        user_id: userId,
        user_email: userEmail,
        user_type: userType,
        action,
        success: true,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      logError('SupabaseAuth', 'Failed to log access', { error });
    }
  }
}

export const supabaseAuthService = new SupabaseAuthService();
