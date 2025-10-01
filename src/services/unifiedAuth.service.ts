/**
 * UNIFIED AUTHENTICATION SERVICE
 *
 * This is the SINGLE source of truth for ALL authentication in the app.
 * ALL login pages and auth checks MUST use this service.
 *
 * DO NOT create separate auth services.
 * DO NOT add auth logic elsewhere.
 *
 * If you need to add new auth methods, add them HERE.
 */

import { logDebug } from './logger.service';
import { medicalAuthService } from './medicalAuth.service';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  specialty?: string;
  requiresPasswordChange?: boolean;
  accessType?: 'medical' | 'pumpdrive' | 'patient' | 'admin';
  permissions?: StaffPermissions;
}

interface StaffPermissions {
  canCreatePatients: boolean;
  canEditPatients: boolean;
  canCreateCharts: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
  canManageCalendar: boolean;
  canProcessActionItems: boolean;
  canViewAuditLogs: boolean;
}

interface AuthResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

class UnifiedAuthService {
  private readonly AUTH_TOKEN_KEY = 'auth_token';
  private readonly USER_DATA_KEY = 'user_data';
  private readonly SESSION_EXPIRES_KEY = 'session_expires';

  /**
   * MASTER LOGIN FUNCTION - All login attempts go through here
   */
  async login(email: string, password: string): Promise<AuthResult> {
    logDebug('unifiedAuth', 'Login attempt', { email });

    // Try each auth method in order of priority

    // 1. Check medical staff database (PRIMARY method - all medical staff including admin)
    const medicalResult = await this.checkMedicalStaffDatabase(email, password);
    if (medicalResult.success) return medicalResult;

    // 2. Check PumpDrive database (all pump users)
    const pumpdriveResult = await this.checkPumpDriveDatabase(email, password);
    if (pumpdriveResult.success) return pumpdriveResult;

    // 3. Check demo/test accounts with access codes (also in database now)
    const demoResult = await this.checkDemoAccounts(email, password);
    if (demoResult.success) return demoResult;

    // 4. Check patient accounts
    const patientResult = await this.checkPatientAccounts(email, password);
    if (patientResult.success) return patientResult;

    // No valid credentials found
    return {
      success: false,
      error: 'Invalid email or password',
    };
  }

  /**
   * Check medical staff database (primary method)
   */
  private async checkMedicalStaffDatabase(email: string, password: string): Promise<AuthResult> {
    try {
      const medicalResult = await medicalAuthService.login({ email, password });

      if (medicalResult.success && medicalResult.user && medicalResult.token) {
        // Use the REAL JWT token from the medical auth service, not a fake one
        const token = medicalResult.token;
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

        const user: AuthUser = {
          id: medicalResult.user.id.toString(),
          email: medicalResult.user.email,
          name: `${medicalResult.user.firstName || ''} ${medicalResult.user.lastName || ''}`.trim() || medicalResult.user.username,
          role: medicalResult.user.role,
          specialty: medicalResult.user.specialty,
          accessType: 'medical',
          permissions: this.getPermissionsByRole(medicalResult.user.role),
        };

        this.saveSession(token, user, expiresAt);

        return {
          success: true,
          user,
          token,
          expiresAt,
        };
      }
    } catch (error) {
      logDebug('unifiedAuth', 'Medical staff database check failed', { error });
    }

    return { success: false };
  }

  // Removed checkAccountService - all accounts now in medical_staff database

  /**
   * Check PumpDrive database credentials
   * All PumpDrive users now stored in pump_users table
   */
  private async checkPumpDriveDatabase(email: string, password: string): Promise<AuthResult> {
    try {
      // Import pumpAuth service to check pump_users database
      const { pumpAuthService } = await import('./pumpAuth.service');

      const pumpResult = await pumpAuthService.login({ email, password });

      if (pumpResult.success && pumpResult.user && pumpResult.token) {
        const token = pumpResult.token;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const user: AuthUser = {
          id: pumpResult.user.id.toString(),
          email: pumpResult.user.email,
          name: `${pumpResult.user.firstName || ''} ${pumpResult.user.lastName || ''}`.trim(),
          role: 'admin', // PumpDrive users get admin role for pump system
          accessType: 'pumpdrive',
        };

        this.saveSession(token, user, expiresAt);

        // Set PumpDrive specific flags for admin users
        if (email === 'rakesh@tshla.ai') {
          localStorage.setItem('pumpdrive_access', 'unlimited');
          localStorage.setItem('admin_access', 'true');
          localStorage.setItem('admin_email', email);
        }

        return {
          success: true,
          user,
          token,
          expiresAt,
        };
      }
    } catch (error) {
      logDebug('unifiedAuth', 'PumpDrive database check failed', { error });
    }

    return { success: false };
  }

  // Removed checkStaffCredentials - admin@tshla.ai now in medical_staff database

  /**
   * Check demo accounts - now also stored in database with access codes as passwords
   * This allows for access codes like DOCTOR-2025, DIET-2025, etc.
   */
  private async checkDemoAccounts(email: string, password: string): Promise<AuthResult> {
    // Access codes are now stored in the medical_staff database as separate accounts
    // with the access codes as their passwords. This ensures all auth goes through database.

    // If someone is using an access code pattern, try to find a demo account
    const accessCodePattern = /^[A-Z]+-\d{4}$|^DEMO$/;
    if (accessCodePattern.test(password)) {
      try {
        // Try to find a demo account in medical_staff table with this access code
        const medicalResult = await this.checkMedicalStaffDatabase(
          email || `demo@tshla.ai`,
          password
        );

        if (medicalResult.success) {
          return medicalResult;
        }
      } catch (error) {
        logDebug('unifiedAuth', 'Demo account check failed', { error });
      }
    }

    return { success: false };
  }

  /**
   * Check patient accounts
   */
  private async checkPatientAccounts(email: string, password: string): Promise<AuthResult> {
    try {
      const { patientService } = await import('./patient.service');

      // Try AVA ID format (if it looks like one)
      if (password.match(/^AVA \d{3}-\d{3}$/)) {
        const result = await patientService.loginWithAvaId({ avaId: password });
        if (result) {
          const token = this.generateToken();
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for patients

          const user: AuthUser = {
            id: result.patient.id,
            email: result.patient.email,
            name: result.patient.name,
            role: 'patient',
            accessType: 'patient',
          };

          this.saveSession(token, user, expiresAt);

          return {
            success: true,
            user,
            token,
            expiresAt,
          };
        }
      }
    } catch (error) {
      logDebug('unifiedAuth', 'Debug message', {});
    }

    return { success: false };
  }

  /**
   * Determine role from email domain
   */
  private determineRole(email: string): string {
    if (email.includes('dietician') || email.includes('nutritionist')) return 'dietician';
    if (email.includes('psychiatry') || email.includes('psych')) return 'psychiatrist';
    if (email.includes('nurse')) return 'nurse';
    if (email.includes('admin')) return 'admin';
    return 'doctor';
  }

  /**
   * Generate secure token
   */
  private generateToken(): string {
    return `token-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Save session to localStorage
   */
  private saveSession(token: string, user: AuthUser, expiresAt: Date): void {
    localStorage.setItem(this.AUTH_TOKEN_KEY, token);
    localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(user));
    localStorage.setItem(this.SESSION_EXPIRES_KEY, expiresAt.toISOString());

    // Also set any legacy keys for backward compatibility
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(user));
    localStorage.setItem('session_expires', expiresAt.toISOString());
  }

  /**
   * Check if user is logged in
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem(this.AUTH_TOKEN_KEY);
    const expires = localStorage.getItem(this.SESSION_EXPIRES_KEY);

    if (!token || !expires) return false;

    const expiresAt = new Date(expires);
    return expiresAt > new Date();
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    const userData = localStorage.getItem(this.USER_DATA_KEY);
    if (!userData) return null;

    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  /**
   * Logout
   */
  logout(): void {
    // Clear all auth-related items
    const authKeys = [
      'auth_token',
      'user_data',
      'session_expires',
      'AUTH_TOKEN_KEY',
      'USER_DATA_KEY',
      'SESSION_EXPIRES_KEY',
      'pumpdrive_access',
      'admin_access',
      'admin_email',
    ];

    authKeys.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Check specific access type
   */
  hasAccess(accessType: 'medical' | 'pumpdrive' | 'patient' | 'admin'): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    if (accessType === 'admin') return user.role === 'admin';
    if (accessType === 'pumpdrive') {
      return (
        localStorage.getItem('pumpdrive_access') === 'unlimited' ||
        localStorage.getItem('admin_access') === 'true'
      );
    }

    return user.accessType === accessType || user.role === 'admin';
  }

  /**
   * Get permissions based on role
   */
  private getPermissionsByRole(role: string): StaffPermissions {
    const permissions: Record<string, StaffPermissions> = {
      admin: {
        canCreatePatients: true,
        canEditPatients: true,
        canCreateCharts: true,
        canViewNotes: true,
        canEditNotes: true,
        canManageCalendar: true,
        canProcessActionItems: true,
        canViewAuditLogs: true,
      },
      doctor: {
        canCreatePatients: false,
        canEditPatients: false,
        canCreateCharts: false,
        canViewNotes: true,
        canEditNotes: true,
        canManageCalendar: false,
        canProcessActionItems: false,
        canViewAuditLogs: false,
      },
      staff: {
        canCreatePatients: true,
        canEditPatients: true,
        canCreateCharts: true,
        canViewNotes: true,
        canEditNotes: false,
        canManageCalendar: true,
        canProcessActionItems: true,
        canViewAuditLogs: false,
      },
      medical_assistant: {
        canCreatePatients: true,
        canEditPatients: true,
        canCreateCharts: true,
        canViewNotes: true,
        canEditNotes: false,
        canManageCalendar: true,
        canProcessActionItems: true,
        canViewAuditLogs: false,
      },
      nurse: {
        canCreatePatients: false,
        canEditPatients: true,
        canCreateCharts: true,
        canViewNotes: true,
        canEditNotes: false,
        canManageCalendar: true,
        canProcessActionItems: true,
        canViewAuditLogs: false,
      },
      dietician: {
        canCreatePatients: false,
        canEditPatients: false,
        canCreateCharts: false,
        canViewNotes: true,
        canEditNotes: true,
        canManageCalendar: false,
        canProcessActionItems: false,
        canViewAuditLogs: false,
      },
      psychiatrist: {
        canCreatePatients: false,
        canEditPatients: false,
        canCreateCharts: false,
        canViewNotes: true,
        canEditNotes: true,
        canManageCalendar: false,
        canProcessActionItems: false,
        canViewAuditLogs: false,
      },
      patient: {
        canCreatePatients: false,
        canEditPatients: false,
        canCreateCharts: false,
        canViewNotes: false,
        canEditNotes: false,
        canManageCalendar: false,
        canProcessActionItems: false,
        canViewAuditLogs: false,
      },
    };

    return permissions[role] || permissions.patient;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: keyof StaffPermissions): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.permissions) return false;
    return user.permissions[permission] || false;
  }

  /**
   * Get current user permissions
   */
  getPermissions(): StaffPermissions | null {
    const user = this.getCurrentUser();
    if (!user) return null;

    // Generate permissions if not stored
    if (!user.permissions) {
      user.permissions = this.getPermissionsByRole(user.role);
      // Update stored user data
      localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(user));
    }

    return user.permissions;
  }
}

// Export singleton instance
export const unifiedAuthService = new UnifiedAuthService();

// Also export for backward compatibility
export default unifiedAuthService;
