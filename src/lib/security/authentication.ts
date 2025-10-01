import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { createSession, terminateSession } from './sessionManager';
import { auditLogger, AuditAction, ResourceType } from './auditLog';
import { generateSecureToken } from './encryption';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'physician' | 'nurse' | 'admin' | 'staff';
  permissions: string[];
  mfaSecret?: string;
  mfaEnabled: boolean;
  lastLogin?: string;
  failedAttempts: number;
  lockedUntil?: string;
  passwordChangedAt: string;
  requirePasswordChange: boolean;
}

/**
 * Enhanced authentication with HIPAA compliance
 */
export class SecureAuthentication {
  private static MAX_FAILED_ATTEMPTS = 5;
  private static LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  private static PASSWORD_EXPIRY_DAYS = 90;
  private static SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Register a new user with secure password
   */
  static async register(
    email: string,
    password: string,
    role: User['role']
  ): Promise<{ user: Partial<User>; qrCode?: string }> {
    // Validate password strength
    if (!this.isPasswordStrong(password)) {
      throw new Error(
        'Password must be at least 12 characters with uppercase, lowercase, number, and special character'
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate MFA secret
    const mfaSecret = speakeasy.generateSecret({
      name: `TSHLA (${email})`,
      length: 32,
    });

    // Create user
    const user: Partial<User> = {
      id: generateSecureToken(),
      email,
      passwordHash,
      role,
      permissions: this.getDefaultPermissions(role),
      mfaSecret: mfaSecret.base32,
      mfaEnabled: false,
      failedAttempts: 0,
      passwordChangedAt: new Date().toISOString(),
      requirePasswordChange: false,
    };

    // Generate QR code for MFA setup
    const qrCode = await QRCode.toDataURL(mfaSecret.otpauth_url!);

    // Save user to database (implement based on your database)
    // await saveUser(user);

    // Log registration
    await auditLogger.log({
      userId: user.id!,
      action: AuditAction.LOGIN,
      resourceType: ResourceType.PATIENT,
      resourceId: 'registration',
      success: true,
    });

    return {
      user: { ...user, passwordHash: undefined },
      qrCode,
    };
  }

  /**
   * Login with email and password
   */
  static async login(
    email: string,
    password: string,
    ipAddress?: string
  ): Promise<{ sessionId: string; requiresMFA: boolean }> {
    // Get user from database
    const user = await this.getUserByEmail(email);

    if (!user) {
      await this.logFailedLogin(email, 'User not found', ipAddress);
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      await this.logFailedLogin(email, 'Account locked', ipAddress);
      throw new Error('Account is locked. Please try again later.');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      await this.handleFailedLogin(user, ipAddress);
      throw new Error('Invalid credentials');
    }

    // Check password expiry
    const passwordAge = Date.now() - new Date(user.passwordChangedAt).getTime();
    const maxPasswordAge = this.PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (passwordAge > maxPasswordAge) {
      user.requirePasswordChange = true;
    }

    // Reset failed attempts
    user.failedAttempts = 0;
    user.lastLogin = new Date().toISOString();

    // Save updated user
    // await updateUser(user);

    // Create session (without MFA verification yet)
    const sessionId = await createSession(user.id, user.role, user.permissions, ipAddress);

    return {
      sessionId,
      requiresMFA: user.mfaEnabled,
    };
  }

  /**
   * Verify MFA token
   */
  static async verifyMFA(userId: string, token: string): Promise<boolean> {
    const user = await this.getUserById(userId);

    if (!user || !user.mfaSecret) {
      throw new Error('MFA not configured');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps for clock skew
    });

    if (verified) {
      // Update session to mark MFA as verified
      // await updateSessionMFA(userId, true);

      await auditLogger.log({
        userId,
        action: AuditAction.LOGIN,
        resourceType: ResourceType.PATIENT,
        resourceId: 'mfa_success',
        success: true,
      });
    } else {
      await auditLogger.log({
        userId,
        action: AuditAction.LOGIN_FAILED,
        resourceType: ResourceType.PATIENT,
        resourceId: 'mfa_failed',
        success: false,
      });
    }

    return verified;
  }

  /**
   * Change password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (!this.isPasswordStrong(newPassword)) {
      throw new Error(
        'Password must be at least 12 characters with uppercase, lowercase, number, and special character'
      );
    }

    // Check password history (don't reuse last 5 passwords)
    // const passwordHistory = await getPasswordHistory(userId);
    // for (const oldHash of passwordHistory) {
    //   if (await bcrypt.compare(newPassword, oldHash)) {
    //     throw new Error('Cannot reuse recent passwords');
    //   }
    // }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date().toISOString();
    user.requirePasswordChange = false;

    // Save updated user
    // await updateUser(user);
    // await addToPasswordHistory(userId, user.passwordHash);

    await auditLogger.log({
      userId,
      action: AuditAction.UPDATE_NOTE,
      resourceType: ResourceType.PATIENT,
      resourceId: 'password_change',
      success: true,
    });
  }

  /**
   * Logout
   */
  static async logout(userId: string): Promise<void> {
    await terminateSession(userId);
  }

  /**
   * Check password strength
   */
  private static isPasswordStrong(password: string): boolean {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return (
      password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar
    );
  }

  /**
   * Get default permissions based on role
   */
  private static getDefaultPermissions(role: User['role']): string[] {
    const permissions: Record<User['role'], string[]> = {
      physician: [
        'read:patient_data',
        'write:patient_data',
        'create:prescriptions',
        'submit:prior_auth',
      ],
      nurse: ['read:patient_data', 'write:patient_data', 'view:prescriptions'],
      admin: ['read:all', 'write:all', 'manage:users', 'view:audit_logs'],
      staff: ['read:patient_data', 'schedule:appointments'],
    };

    return permissions[role] || [];
  }

  /**
   * Handle failed login attempt
   */
  private static async handleFailedLogin(user: User, ipAddress?: string): Promise<void> {
    user.failedAttempts++;

    if (user.failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION).toISOString();
    }

    // await updateUser(user);

    await this.logFailedLogin(user.email, 'Invalid password', ipAddress);
  }

  /**
   * Log failed login attempt
   */
  private static async logFailedLogin(
    email: string,
    reason: string,
    ipAddress?: string
  ): Promise<void> {
    await auditLogger.log({
      userId: email,
      action: AuditAction.LOGIN_FAILED,
      resourceType: ResourceType.PATIENT,
      resourceId: 'login',
      ipAddress,
      success: false,
      errorMessage: reason,
    });
  }

  // Mock database functions (replace with your actual database)
  private static async getUserByEmail(email: string): Promise<User | null> {
    // Implement database query
    return null;
  }

  private static async getUserById(id: string): Promise<User | null> {
    // Implement database query
    return null;
  }
}
