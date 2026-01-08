/**
 * Multi-Factor Authentication (MFA) Service
 * Phase 4: HIPAA Compliance
 *
 * Implements TOTP-based 2FA using Google Authenticator compatible codes
 *
 * Features:
 * - Generate QR codes for authenticator app setup
 * - Verify 6-digit TOTP codes
 * - Generate and validate backup codes
 * - Track MFA usage for audit
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role to bypass RLS for backend operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class MFAService {
  /**
   * Generate a new TOTP secret and QR code for MFA setup
   * @param {number} userId - Patient/user ID
   * @param {string} userEmail - User's email for QR code label
   * @returns {Promise<{secret: string, qrCodeUrl: string, backupCodes: string[]}>}
   */
  static async generateMFASetup(userId, userEmail) {
    try {
      logger.info('MFA', 'Generating MFA setup', { userId });

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `TSHLA Medical (${userEmail})`,
        issuer: 'TSHLA Medical',
        length: 32
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      // Generate 10 backup codes
      const backupCodes = this.generateBackupCodes(10);

      logger.info('MFA', 'MFA setup generated successfully', {
        userId,
        backupCodesCount: backupCodes.length
      });

      return {
        secret: secret.base32, // Store this in database
        qrCodeUrl,            // Show this to user as QR code
        backupCodes           // Show these to user (one-time only)
      };
    } catch (error) {
      logger.error('MFA', 'Failed to generate MFA setup', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Generate cryptographically secure backup codes
   * @param {number} count - Number of backup codes to generate
   * @returns {string[]} Array of backup codes
   */
  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      // Format as XXXX-XXXX for readability
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }

  /**
   * Hash a backup code for secure storage
   * @param {string} code - Backup code to hash
   * @returns {string} Hashed code
   */
  static hashBackupCode(code) {
    return crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
  }

  /**
   * Enable MFA for a user
   * @param {number} userId - Patient/user ID
   * @param {string} secret - TOTP secret (base32)
   * @param {string} token - 6-digit code to verify setup
   * @param {string[]} backupCodes - Backup codes to store
   * @returns {Promise<boolean>} Success status
   */
  static async enableMFA(userId, secret, token, backupCodes) {
    try {
      logger.info('MFA', 'Enabling MFA for user', { userId });

      // Verify the token is valid before enabling
      const isValid = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2 // Allow 2 time steps before/after (60 seconds)
      });

      if (!isValid) {
        logger.warn('MFA', 'Invalid MFA token during setup', { userId });
        return { success: false, error: 'Invalid verification code' };
      }

      // Hash all backup codes for storage
      const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

      // Update database
      const { error } = await supabase
        .from('patients')
        .update({
          mfa_enabled: true,
          mfa_secret: secret,
          mfa_backup_codes: hashedBackupCodes,
          mfa_enabled_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.error('MFA', 'Database error enabling MFA', { error: error.message, userId });
        throw error;
      }

      logger.info('MFA', 'MFA enabled successfully', { userId });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'MFA_ENABLED',
        resource: 'user_account',
        resource_type: 'security',
        timestamp: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      logger.error('MFA', 'Failed to enable MFA', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Verify a TOTP code during login
   * @param {number} userId - Patient/user ID
   * @param {string} token - 6-digit code from authenticator app
   * @returns {Promise<boolean>} Whether token is valid
   */
  static async verifyTOTP(userId, token) {
    try {
      logger.info('MFA', 'Verifying TOTP code', { userId });

      // Get user's MFA secret
      const { data: user, error } = await supabase
        .from('patients')
        .select('mfa_enabled, mfa_secret')
        .eq('id', userId)
        .single();

      if (error || !user) {
        logger.error('MFA', 'User not found', { userId });
        return false;
      }

      if (!user.mfa_enabled || !user.mfa_secret) {
        logger.warn('MFA', 'MFA not enabled for user', { userId });
        return false;
      }

      // Verify token
      const isValid = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token,
        window: 2 // 60 second window
      });

      if (isValid) {
        // Update last used timestamp
        await supabase
          .from('patients')
          .update({ mfa_last_used_at: new Date().toISOString() })
          .eq('id', userId);

        logger.info('MFA', 'TOTP verification successful', { userId });

        // Audit log
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'MFA_VERIFIED',
          resource: 'user_account',
          resource_type: 'security',
          mfa_used: true,
          mfa_method: 'totp',
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn('MFA', 'Invalid TOTP code', { userId });

        // Audit failed attempt
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'MFA_FAILED',
          resource: 'user_account',
          resource_type: 'security',
          mfa_used: false,
          mfa_method: 'totp',
          timestamp: new Date().toISOString()
        });
      }

      return isValid;
    } catch (error) {
      logger.error('MFA', 'Error verifying TOTP', { error: error.message, userId });
      return false;
    }
  }

  /**
   * Verify a backup code during login
   * @param {number} userId - Patient/user ID
   * @param {string} code - Backup code (format: XXXX-XXXX)
   * @returns {Promise<boolean>} Whether code is valid
   */
  static async verifyBackupCode(userId, code) {
    try {
      logger.info('MFA', 'Verifying backup code', { userId });

      // Get user's backup codes
      const { data: user, error } = await supabase
        .from('patients')
        .select('mfa_enabled, mfa_backup_codes')
        .eq('id', userId)
        .single();

      if (error || !user) {
        logger.error('MFA', 'User not found', { userId });
        return false;
      }

      if (!user.mfa_enabled || !user.mfa_backup_codes) {
        logger.warn('MFA', 'MFA not enabled for user', { userId });
        return false;
      }

      // Hash the provided code
      const hashedCode = this.hashBackupCode(code);

      // Check if code exists in backup codes
      const codeIndex = user.mfa_backup_codes.indexOf(hashedCode);

      if (codeIndex === -1) {
        logger.warn('MFA', 'Invalid backup code', { userId });

        // Audit failed attempt
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'MFA_BACKUP_FAILED',
          resource: 'user_account',
          resource_type: 'security',
          mfa_used: false,
          mfa_method: 'backup_code',
          timestamp: new Date().toISOString()
        });

        return false;
      }

      // Remove the used backup code (one-time use only)
      const remainingCodes = user.mfa_backup_codes.filter((_, index) => index !== codeIndex);

      await supabase
        .from('patients')
        .update({
          mfa_backup_codes: remainingCodes,
          mfa_last_used_at: new Date().toISOString()
        })
        .eq('id', userId);

      logger.info('MFA', 'Backup code verified successfully', {
        userId,
        codesRemaining: remainingCodes.length
      });

      // Audit successful verification
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'MFA_BACKUP_USED',
        resource: 'user_account',
        resource_type: 'security',
        mfa_used: true,
        mfa_method: 'backup_code',
        timestamp: new Date().toISOString()
      });

      // Warn user if running low on backup codes
      if (remainingCodes.length <= 3) {
        logger.warn('MFA', 'User running low on backup codes', {
          userId,
          codesRemaining: remainingCodes.length
        });
      }

      return true;
    } catch (error) {
      logger.error('MFA', 'Error verifying backup code', { error: error.message, userId });
      return false;
    }
  }

  /**
   * Disable MFA for a user
   * @param {number} userId - Patient/user ID
   * @param {string} password - User's password for verification
   * @returns {Promise<boolean>} Success status
   */
  static async disableMFA(userId, password) {
    try {
      logger.info('MFA', 'Disabling MFA for user', { userId });

      // TODO: Verify password before disabling MFA
      // This should call the auth service to verify the user's password

      // Update database
      const { error } = await supabase
        .from('patients')
        .update({
          mfa_enabled: false,
          mfa_secret: null,
          mfa_backup_codes: null
        })
        .eq('id', userId);

      if (error) {
        logger.error('MFA', 'Database error disabling MFA', { error: error.message, userId });
        throw error;
      }

      logger.info('MFA', 'MFA disabled successfully', { userId });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'MFA_DISABLED',
        resource: 'user_account',
        resource_type: 'security',
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      logger.error('MFA', 'Failed to disable MFA', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if user has MFA enabled
   * @param {number} userId - Patient/user ID
   * @returns {Promise<boolean>} Whether MFA is enabled
   */
  static async isMFAEnabled(userId) {
    try {
      const { data: user, error } = await supabase
        .from('patients')
        .select('mfa_enabled')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return false;
      }

      return user.mfa_enabled === true;
    } catch (error) {
      logger.error('MFA', 'Error checking MFA status', { error: error.message, userId });
      return false;
    }
  }

  /**
   * Get MFA status for a user (including backup codes count)
   * @param {number} userId - Patient/user ID
   * @returns {Promise<{enabled: boolean, backupCodesRemaining: number}>}
   */
  static async getMFAStatus(userId) {
    try {
      const { data: user, error } = await supabase
        .from('patients')
        .select('mfa_enabled, mfa_backup_codes, mfa_enabled_at, mfa_last_used_at')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return {
          enabled: false,
          backupCodesRemaining: 0
        };
      }

      return {
        enabled: user.mfa_enabled === true,
        backupCodesRemaining: user.mfa_backup_codes ? user.mfa_backup_codes.length : 0,
        enabledAt: user.mfa_enabled_at,
        lastUsedAt: user.mfa_last_used_at
      };
    } catch (error) {
      logger.error('MFA', 'Error getting MFA status', { error: error.message, userId });
      return {
        enabled: false,
        backupCodesRemaining: 0
      };
    }
  }
}

module.exports = MFAService;
