/**
 * Supabase Authentication Service
 * Handles authentication using Supabase Auth + medical_staff/pump_users tables
 * Replaces the old MySQL-based authentication
 */

import { supabase } from '../lib/supabase';
import { logDebug, logError, logInfo } from './logger.service';

/**
 * Timeout wrapper to prevent infinite hangs
 * Rejects if promise doesn't resolve within timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operation} timed out after ${timeoutMs/1000} seconds. Please check your internet connection and try again.`)),
        timeoutMs
      )
    )
  ]);
}

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
   * Generic login method (tries staff first, then patient)
   * Used by old code that calls unifiedAuthService.login()
   */
  async login(email: string, password: string): Promise<AuthResult> {
    // Try medical staff first
    const staffResult = await this.loginMedicalStaff(email, password);
    if (staffResult.success) {
      return staffResult;
    }

    // Try patient if staff login failed
    const patientResult = await this.loginPatient(email, password);
    if (patientResult.success) {
      return patientResult;
    }

    // Both failed
    return {
      success: false,
      error: 'Invalid email or password',
    };
  }

  /**
   * Login with email and password (Medical Staff)
   */
  async loginMedicalStaff(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('🚀 [SupabaseAuth] Starting medical staff login...', { email });
      logInfo('SupabaseAuth', 'Medical staff login attempt', { email });

      // Step 1: Authenticate with Supabase Auth (with 15s timeout)
      console.log('⏳ [SupabaseAuth] Calling Supabase signInWithPassword...');
      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        15000,
        'Supabase authentication'
      );
      console.log('✅ [SupabaseAuth] Supabase auth call completed');

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

      // Step 2: Get medical_staff record (with 10s timeout)
      console.log('⏳ [SupabaseAuth] Querying medical_staff table...');
      const { data: staffData, error: staffError } = await withTimeout(
        supabase
          .from('medical_staff')
          .select('*')
          .eq('auth_user_id', authData.user.id)
          .single(),
        10000,
        'Medical staff profile lookup'
      );
      console.log('✅ [SupabaseAuth] medical_staff query completed');

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

      // Clear all PumpDrive sessionStorage to prevent stale data
      this.clearPumpDriveSessionStorage();

      return {
        success: true,
        user,
        token: authData.session?.access_token,
      };
    } catch (error) {
      console.error('❌ [SupabaseAuth] Medical staff login error:', error);
      logError('SupabaseAuth', 'Login error', { error });

      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      const isTimeout = errorMessage.includes('timed out');

      return {
        success: false,
        error: isTimeout
          ? errorMessage
          : 'Login failed. Please check your credentials and try again.',
      };
    }
  }

  /**
   * Login with email and password (Patient - includes PumpDrive users)
   */
  async loginPatient(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('🚀 [SupabaseAuth] Starting patient login...', { email });
      logInfo('SupabaseAuth', 'Patient login attempt', { email });

      // Step 1: Authenticate with Supabase Auth (with 15s timeout)
      console.log('⏳ [SupabaseAuth] Calling Supabase signInWithPassword...');
      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        15000,
        'Supabase authentication'
      );
      console.log('✅ [SupabaseAuth] Supabase auth call completed');

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

      // Step 2: Get patients record (unified - includes PumpDrive) (with 10s timeout)
      console.log('⏳ [SupabaseAuth] Querying patients table...');
      const { data: patientData, error: patientError } = await withTimeout(
        supabase
          .from('patients')
          .select('*')
          .eq('auth_user_id', authData.user.id)
          .single(),
        10000,
        'Patient profile lookup'
      );
      console.log('✅ [SupabaseAuth] patients query completed');

      if (patientError || !patientData) {
        // Sign out since we couldn't find their patient record
        await supabase.auth.signOut();

        return {
          success: false,
          error: 'Patient profile not found',
        };
      }

      // Step 3: Update last login
      await supabase
        .from('patients')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', patientData.id);

      // Step 4: Log access
      await this.logAccess(authData.user.id, patientData.email, 'patient', 'LOGIN');

      const user: AuthUser = {
        id: patientData.id,
        email: patientData.email,
        name: `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() || patientData.email,
        role: 'patient',
        accessType: patientData.pumpdrive_enabled ? 'pumpdrive' : 'patient',
        authUserId: authData.user.id,
      };

      logInfo('SupabaseAuth', 'Patient logged in successfully', {
        userId: user.id,
        pumpdriveEnabled: patientData.pumpdrive_enabled,
      });

      // Clear all PumpDrive sessionStorage to prevent stale data from previous sessions
      this.clearPumpDriveSessionStorage();

      return {
        success: true,
        user,
        token: authData.session?.access_token,
      };
    } catch (error) {
      console.error('❌ [SupabaseAuth] Patient login error:', error);
      logError('SupabaseAuth', 'Patient login error', { error });

      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      const isTimeout = errorMessage.includes('timed out');

      return {
        success: false,
        error: isTimeout
          ? errorMessage
          : 'Login failed. Please check your credentials and try again.',
      };
    }
  }

  // Alias for backward compatibility
  async loginPumpUser(email: string, password: string): Promise<AuthResult> {
    return this.loginPatient(email, password);
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
        logError('SupabaseAuth', 'Failed to create medical_staff record', {
          error: staffError,
          message: staffError.message,
          code: staffError.code,
          details: staffError.details,
          hint: staffError.hint,
          authUserId: authData.user.id,
        });

        // Note: We cannot delete the orphaned auth user from client-side
        // (requires service role key). Admin must clean up manually via Supabase Dashboard.

        return {
          success: false,
          error: staffError.code === '23505'
            ? 'An account with this email already exists. Please use a different email or contact support.'
            : staffError.code === '42501'
            ? 'Permission denied: Row Level Security policy is blocking account creation. Please contact your system administrator to fix Supabase RLS policies.'
            : `Failed to create medical staff profile: ${staffError.message}. If this persists, contact support.`,
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
   * Register new patient (unified - includes PumpDrive)
   */
  async registerPatient(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    enablePumpDrive?: boolean;
  }): Promise<AuthResult> {
    try {
      logInfo('SupabaseAuth', 'Registering patient', { email: data.email });

      // Step 1: Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-redirect`,
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
          }
        }
      });

      if (authError) {
        logError('SupabaseAuth', 'Auth signup failed', { error: authError.message, code: authError.status });

        // Provide user-friendly error messages
        let errorMessage = authError.message;
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          errorMessage = 'This email is already registered. Please try logging in instead.';
        } else if (authError.message.includes('invalid')) {
          errorMessage = 'Invalid email format. Please check your email address.';
        } else if (authError.message.includes('weak password')) {
          errorMessage = 'Password is too weak. Please use at least 8 characters with a mix of letters and numbers.';
        }

        return {
          success: false,
          error: errorMessage,
        };
      }

      if (!authData.user) {
        logError('SupabaseAuth', 'No user data returned from signup');
        return {
          success: false,
          error: 'Failed to create user account. Please try again.',
        };
      }

      // Check if email confirmation is required
      const needsEmailConfirmation = authData.user && !authData.session;

      logInfo('SupabaseAuth', 'Auth user created', {
        userId: authData.user.id,
        hasSession: !!authData.session,
        needsConfirmation: needsEmailConfirmation
      });

      // Step 2: Generate unique MRN and AVA ID
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const mrn = `MRN-${timestamp}-${randomNum}`;

      const avaNum1 = Math.floor(Math.random() * 900 + 100);
      const avaNum2 = Math.floor(Math.random() * 900 + 100);
      const avaId = `AVA ${avaNum1}-${avaNum2}`;

      // Step 3: Create patients record (unified)
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert({
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phoneNumber,
          date_of_birth: data.dateOfBirth,
          auth_user_id: authData.user.id,
          mrn: mrn,
          ava_id: avaId,
          is_active: true,
          pumpdrive_enabled: data.enablePumpDrive !== false, // Default true
          pumpdrive_signup_date: new Date().toISOString(),
          subscription_tier: 'free',
        })
        .select()
        .single();

      if (patientError) {
        logError('SupabaseAuth', 'Failed to create patient profile', {
          error: patientError,
          message: patientError.message,
          code: patientError.code,
          details: patientError.details,
          hint: patientError.hint,
          authUserId: authData.user.id,
        });

        // Note: We cannot delete the orphaned auth user from client-side
        // (requires service role key). Admin must clean up manually via Supabase Dashboard.

        return {
          success: false,
          error: patientError.code === '23505'
            ? 'An account with this email already exists. Please use a different email or contact support.'
            : patientError.code === '42501'
            ? 'Permission denied: Row Level Security policy is blocking account creation. Please contact your system administrator to fix Supabase RLS policies.'
            : `Failed to create patient profile: ${patientError.message}. If this persists, contact support.`,
        };
      }

      const user: AuthUser = {
        id: patientData.id,
        email: patientData.email,
        name: `${patientData.first_name} ${patientData.last_name}`,
        role: 'patient',
        accessType: patientData.pumpdrive_enabled ? 'pumpdrive' : 'patient',
        authUserId: authData.user.id,
      };

      console.log('✅ [SupabaseAuth] Patient registered successfully', {
        userId: user.id,
        mrn: mrn,
        avaId: avaId,
        needsEmailConfirmation: needsEmailConfirmation,
        hasSession: !!authData.session,
        hasToken: !!authData.session?.access_token,
      });

      logInfo('SupabaseAuth', 'Patient registered successfully', {
        userId: user.id,
        mrn: mrn,
        avaId: avaId,
        needsEmailConfirmation: needsEmailConfirmation,
      });

      // If email confirmation is required, return special message
      if (needsEmailConfirmation) {
        console.log('📧 [SupabaseAuth] Email confirmation required - no session created yet');
        return {
          success: true,
          user,
          error: 'CONFIRMATION_REQUIRED', // Special flag for UI
          token: undefined,
        };
      }

      console.log('✅ [SupabaseAuth] Registration complete with active session', {
        hasToken: !!authData.session?.access_token,
        sessionExpiresAt: authData.session?.expires_at,
      });

      // Clear all PumpDrive sessionStorage to ensure fresh start for new patient
      this.clearPumpDriveSessionStorage();

      return {
        success: true,
        user,
        token: authData.session?.access_token,
      };
    } catch (error) {
      logError('SupabaseAuth', 'Patient registration error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  // Alias for backward compatibility
  async registerPumpUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
  }): Promise<AuthResult> {
    return this.registerPatient({
      ...data,
      enablePumpDrive: true,
    });
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AuthResult> {
    try {
      console.log('🔍 [SupabaseAuth] getCurrentUser() - Checking Supabase session...');
      const { data: { user }, error } = await withTimeout(
        supabase.auth.getUser(),
        10000,
        'Get current user session'
      );

      if (error || !user) {
        console.error('❌ [SupabaseAuth] No Supabase auth user found:', error?.message);
        return {
          success: false,
          error: 'Not authenticated',
        };
      }

      console.log('✅ [SupabaseAuth] Found Supabase auth user:', {
        id: user.id,
        email: user.email
      });

      // Try medical_staff first
      console.log('🔍 [SupabaseAuth] Querying medical_staff table...');
      const { data: staffData, error: staffError } = await withTimeout(
        supabase
          .from('medical_staff')
          .select('*')
          .eq('auth_user_id', user.id)
          .single(),
        10000,
        'Medical staff profile query'
      );

      if (staffError) {
        console.warn('⚠️ [SupabaseAuth] medical_staff query error:', {
          code: staffError.code,
          message: staffError.message,
          details: staffError.details,
          hint: staffError.hint
        });
      }

      if (staffData) {
        console.log('✅ [SupabaseAuth] Found medical_staff record:', {
          id: staffData.id,
          email: staffData.email,
          role: staffData.role,
          isActive: staffData.is_active,
          isVerified: staffData.is_verified
        });
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

      console.log('⚠️ [SupabaseAuth] No medical_staff record found, trying patients...');

      // Try patients (unified - includes PumpDrive)
      const { data: patientData, error: patientError } = await withTimeout(
        supabase
          .from('patients')
          .select('*')
          .eq('auth_user_id', user.id)
          .single(),
        10000,
        'Patient profile query'
      );

      if (patientError) {
        console.warn('⚠️ [SupabaseAuth] patients query error:', {
          code: patientError.code,
          message: patientError.message
        });
      }

      if (patientData) {
        console.log('✅ [SupabaseAuth] Found patient record');
        return {
          success: true,
          user: {
            id: patientData.id,
            email: patientData.email,
            name: `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim(),
            role: 'patient',
            accessType: patientData.pumpdrive_enabled ? 'pumpdrive' : 'patient',
            authUserId: user.id,
          },
        };
      }

      console.error('❌ [SupabaseAuth] User profile not found in any table');
      console.error('   Supabase auth user ID:', user.id);
      console.error('   Email:', user.email);
      console.error('   This usually means:');
      console.error('   1. Row-Level Security (RLS) policy is blocking the query');
      console.error('   2. medical_staff record with auth_user_id=' + user.id + ' does not exist');
      console.error('   3. Database connection issue');

      return {
        success: false,
        error: 'User profile not found',
      };
    } catch (error) {
      console.error('❌ [SupabaseAuth] Exception in getCurrentUser:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to get user';
      const isTimeout = errorMessage.includes('timed out');

      return {
        success: false,
        error: isTimeout
          ? errorMessage
          : 'Failed to get user profile. Please try again.',
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
   * Logout (alias for signOut for backward compatibility)
   */
  async logout(): Promise<void> {
    await this.signOut();
  }

  /**
   * Generic register method (defaults to patient)
   * Used by old code that calls unifiedAuthService.register()
   */
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
  }): Promise<AuthResult> {
    return this.registerPatient({
      ...data,
      enablePumpDrive: true,
    });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return !!user;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current session
   */
  async getSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all PumpDrive-related sessionStorage to prevent stale data
   * Called on login/registration to ensure fresh session
   */
  private clearPumpDriveSessionStorage(): void {
    const keysToRemove = [
      'pumpDrivePatientName',
      'pumpDriveSliders',
      'selectedPumpFeatures',
      'pumpDriveFreeText',
      'pumpDriveClarifyingResponses',
      'pumpDriveClarifyingQuestions',
      'pumpdrive_recommendation',
      'pumpDriveRecommendation',
      'pumpDriveConversation',
      'pumpdrive_responses',
      'pumpDriveCompletedCategories',
      'pumpdrive_category_order',
      'pumpdrive_completed_categories',
      'pumpdrive_priority_order',
      'pumpdrive_assessment_id',
      'pumpdrive_unsaved_recommendation'
    ];

    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
    });

    logDebug('SupabaseAuth', 'Cleared PumpDrive sessionStorage for fresh session', {
      clearedKeys: keysToRemove.length
    });
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
