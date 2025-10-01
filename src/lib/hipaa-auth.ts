/**
 * HIPAA-Compliant Authentication System
 * Implements strong authentication and access control
 * Required by HIPAA Security Rule 45 CFR §164.312(a)(2)(i)
 */

import { auditLogger, AuditEventType } from './audit-logger';
import { sessionManager } from './secure-session';
import { phiEncryption } from './encryption';
import crypto from 'crypto';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'doctor' | 'nurse' | 'staff' | 'patient';
  permissions: string[];
  passwordHash: string;
  salt: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLogin?: Date;
  failedAttempts: number;
  lockedUntil?: Date;
  passwordChangedAt: Date;
  mustChangePassword: boolean;
  deactivated: boolean;
}

export interface AuthResult {
  success: boolean;
  sessionId?: string;
  user?: Partial<User>;
  error?: string;
  requiresMFA?: boolean;
  requiresPasswordChange?: boolean;
}

class HIPAAAuthentication {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly PASSWORD_MIN_LENGTH = 12;
  private readonly PASSWORD_EXPIRY_DAYS = 90;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  // In production, these would be in a secure database
  private users: Map<string, User> = new Map();

  constructor() {
    this.initializeDefaultUsers();
  }

  /**
   * Initialize with secure default users (for development only)
   */
  private initializeDefaultUsers(): void {
    // In production, users would be in database
    // These are example users with proper security

    const defaultPassword = 'ChangeMe@123!'; // Must be changed on first login

    this.createUser({
      username: 'admin',
      email: 'admin@clinic.com',
      role: 'admin',
      password: defaultPassword,
      mustChangePassword: true,
    });

    this.createUser({
      username: 'dr.smith',
      email: 'smith@clinic.com',
      role: 'doctor',
      password: defaultPassword,
      mustChangePassword: true,
    });

    logWarn('App', 'Warning message', {});
    logWarn('App', 'Warning message', {});
  }

  /**
   * Create a new user with secure password hashing
   */
  public createUser(userData: {
    username: string;
    email: string;
    role: User['role'];
    password: string;
    mustChangePassword?: boolean;
  }): string {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const salt = crypto.randomBytes(32).toString('hex');
    const passwordHash = this.hashPassword(userData.password, salt);

    const user: User = {
      id: userId,
      username: userData.username.toLowerCase(),
      email: userData.email.toLowerCase(),
      role: userData.role,
      permissions: this.getRolePermissions(userData.role),
      passwordHash,
      salt,
      mfaEnabled: false,
      failedAttempts: 0,
      passwordChangedAt: new Date(),
      mustChangePassword: userData.mustChangePassword || false,
      deactivated: false,
    };

    this.users.set(user.username, user);

    auditLogger.logEvent(AuditEventType.SYSTEM_ACCESS, 'system', 'User account created', {
      userRole: user.role,
      success: true,
      additionalInfo: { username: user.username },
    });

    return userId;
  }

  /**
   * Authenticate user with strong security
   */
  public async authenticate(
    username: string,
    password: string,
    mfaCode?: string
  ): Promise<AuthResult> {
    const user = this.users.get(username.toLowerCase());

    if (!user) {
      // Don't reveal if user exists
      await this.simulatePasswordCheck();

      auditLogger.logAuth('LOGIN', username, false, 'Invalid credentials');
      return { success: false, error: 'Invalid credentials' };
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      auditLogger.logAuth('LOGIN', username, false, 'Account locked');
      return {
        success: false,
        error: `Account locked. Try again after ${user.lockedUntil.toLocaleTimeString()}`,
      };
    }

    // Check if account is deactivated
    if (user.deactivated) {
      auditLogger.logAuth('LOGIN', username, false, 'Account deactivated');
      return { success: false, error: 'Account deactivated' };
    }

    // Verify password
    const passwordValid = this.verifyPassword(password, user.salt, user.passwordHash);

    if (!passwordValid) {
      user.failedAttempts++;

      if (user.failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION);
        auditLogger.logEvent(
          AuditEventType.SECURITY_ALERT,
          username,
          'Account locked due to failed attempts',
          { userRole: user.role, success: false }
        );
      }

      auditLogger.logAuth('LOGIN', username, false, 'Invalid password');
      return { success: false, error: 'Invalid credentials' };
    }

    // Check if MFA is required
    if (user.mfaEnabled && !mfaCode) {
      return {
        success: false,
        requiresMFA: true,
        error: 'MFA code required',
      };
    }

    if (user.mfaEnabled && mfaCode) {
      const mfaValid = this.verifyMFA(user.mfaSecret!, mfaCode);
      if (!mfaValid) {
        auditLogger.logAuth('LOGIN', username, false, 'Invalid MFA code');
        return { success: false, error: 'Invalid MFA code' };
      }
    }

    // Check if password needs to be changed
    if (user.mustChangePassword) {
      return {
        success: false,
        requiresPasswordChange: true,
        error: 'Password must be changed',
      };
    }

    // Check password expiry
    const passwordAge = Date.now() - user.passwordChangedAt.getTime();
    const passwordExpired = passwordAge > this.PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (passwordExpired) {
      user.mustChangePassword = true;
      return {
        success: false,
        requiresPasswordChange: true,
        error: 'Password has expired',
      };
    }

    // Authentication successful
    user.failedAttempts = 0;
    user.lastLogin = new Date();

    // Create secure session
    const sessionId = sessionManager.createSession(user.id, user.role);

    auditLogger.logAuth('LOGIN', username, true);

    return {
      success: true,
      sessionId,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    };
  }

  /**
   * Change user password
   */
  public changePassword(
    username: string,
    oldPassword: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    const user = this.users.get(username.toLowerCase());

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify old password
    if (!this.verifyPassword(oldPassword, user.salt, user.passwordHash)) {
      auditLogger.logEvent(
        AuditEventType.SECURITY_ALERT,
        username,
        'Failed password change attempt',
        { userRole: user.role, success: false }
      );
      return { success: false, error: 'Current password is incorrect' };
    }

    // Validate new password
    const validation = this.validatePassword(newPassword);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check password history (prevent reuse)
    // In production, maintain password history

    // Update password
    const newSalt = crypto.randomBytes(32).toString('hex');
    user.salt = newSalt;
    user.passwordHash = this.hashPassword(newPassword, newSalt);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;

    auditLogger.logEvent(AuditEventType.CONFIGURATION_CHANGE, username, 'Password changed', {
      userRole: user.role,
      success: true,
    });

    return { success: true };
  }

  /**
   * Enable MFA for user
   */
  public enableMFA(username: string): { secret: string; qrCode: string } {
    const user = this.users.get(username.toLowerCase());
    if (!user) {
      throw new Error('User not found');
    }

    // Generate MFA secret
    const secret = phiEncryption.generateSecureToken(16);
    user.mfaSecret = secret;
    user.mfaEnabled = true;

    // Generate QR code URL (using Google Authenticator format)
    const issuer = 'ClinicSystem';
    const qrCode = `otpauth://totp/${issuer}:${user.email}?secret=${secret}&issuer=${issuer}`;

    auditLogger.logEvent(AuditEventType.CONFIGURATION_CHANGE, username, 'MFA enabled', {
      userRole: user.role,
      success: true,
    });

    return { secret, qrCode };
  }

  /**
   * Verify MFA code
   */
  private verifyMFA(secret: string, code: string): boolean {
    // In production, use proper TOTP library
    // This is a simplified version
    const timeStep = Math.floor(Date.now() / 30000);
    const expectedCode = crypto
      .createHmac('sha1', secret)
      .update(timeStep.toString())
      .digest('hex')
      .substr(0, 6);

    return code === expectedCode;
  }

  /**
   * Hash password with salt
   */
  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  /**
   * Verify password against hash
   */
  private verifyPassword(password: string, salt: string, hash: string): boolean {
    const testHash = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(testHash));
  }

  /**
   * Validate password strength
   */
  public validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < this.PASSWORD_MIN_LENGTH) {
      return {
        valid: false,
        error: `Password must be at least ${this.PASSWORD_MIN_LENGTH} characters`,
      };
    }

    // Check complexity requirements
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return {
        valid: false,
        error: 'Password must contain uppercase, lowercase, numbers, and special characters',
      };
    }

    // Check for common patterns
    const commonPatterns = [
      'password',
      'clinic',
      'medical',
      'health',
      '12345',
      'qwerty',
      'admin',
      'doctor',
      'nurse',
    ];

    const lowerPassword = password.toLowerCase();
    for (const pattern of commonPatterns) {
      if (lowerPassword.includes(pattern)) {
        return {
          valid: false,
          error: 'Password contains common words or patterns',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get role-based permissions
   */
  private getRolePermissions(role: User['role']): string[] {
    const permissions: Record<User['role'], string[]> = {
      admin: ['*'], // All permissions
      doctor: [
        'patient.read',
        'patient.write',
        'patient.create',
        'prescription.write',
        'notes.write',
        'orders.write',
      ],
      nurse: ['patient.read', 'patient.write', 'vitals.write', 'notes.read', 'orders.read'],
      staff: ['patient.read', 'appointments.manage', 'demographics.write'],
      patient: ['own.records.read', 'appointments.view', 'messages.send'],
    };

    return permissions[role] || [];
  }

  /**
   * Check if user has permission
   */
  public hasPermission(userId: string, permission: string): boolean {
    const user = Array.from(this.users.values()).find(u => u.id === userId);

    if (!user) return false;
    if (user.deactivated) return false;
    if (user.permissions.includes('*')) return true; // Admin

    return user.permissions.includes(permission);
  }

  /**
   * Simulate password check timing (prevent timing attacks)
   */
  private async simulatePasswordCheck(): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, 100 + Math.random() * 100);
    });
  }

  /**
   * Logout user
   */
  public logout(sessionId: string): void {
    sessionManager.terminateSession(sessionId, 'USER_LOGOUT');
  }

  /**
   * Get user by session
   */
  public getUserBySession(sessionId: string): Partial<User> | null {
    const session = sessionManager.getSession(sessionId);
    if (!session) return null;

    const user = Array.from(this.users.values()).find(u => u.id === session.userId);
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };
  }
}

// Singleton instance
export const hipaaAuth = new HIPAAAuthentication();

export default hipaaAuth;
