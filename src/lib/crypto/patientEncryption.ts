import crypto from 'crypto';
import { env } from '../config/environment';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

// Master key - In production, use AWS KMS or similar key management service
const MASTER_KEY =
  env.ENCRYPTION_MASTER_KEY ||
  crypto.createHash('sha256').update('CHANGE-THIS-IN-PRODUCTION-USE-ENV-VAR').digest();

// Derive a key from the master key using a salt
function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(MASTER_KEY, salt, 100000, KEY_LENGTH, 'sha256');
}

// Fields that should be encrypted
const ENCRYPTED_FIELDS = [
  // Personal Information
  'name',
  'firstName',
  'lastName',
  'dateOfBirth',
  'ssn',
  'phone',
  'email',
  'address',
  'emergencyContact',

  // Medical Information
  'diagnosis',
  'medications',
  'allergies',
  'conditions',
  'labs',
  'vitals',
  'notes',
  'soapNote',
  'dictation',
  'transcript',
  'chiefComplaint',
  'historyOfPresentIllness',
  'pastMedicalHistory',
  'familyHistory',
  'socialHistory',
  'reviewOfSystems',
  'physicalExam',
  'assessment',
  'plan',
  'prescriptions',

  // Mental Health
  'phq9Responses',
  'gad7Responses',
  'screeningScores',
  'mentalHealthNotes',

  // Insurance
  'insuranceId',
  'insuranceProvider',
  'groupNumber',
  'subscriberId',
];

export class PatientDataEncryption {
  /**
   * Encrypt a string value
   */
  static encryptValue(plaintext: string | undefined | null): string | null {
    if (!plaintext) return null;

    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);

      // Derive key from salt
      const key = deriveKey(salt);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      // Encrypt data
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

      // Get auth tag
      const tag = cipher.getAuthTag();

      // Combine salt, iv, tag, and encrypted data
      const combined = Buffer.concat([salt, iv, tag, encrypted]);

      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      logError('App', 'Error message', {});
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt a string value
   */
  static decryptValue(encryptedData: string | undefined | null): string | null {
    if (!encryptedData) return null;

    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = combined.slice(0, SALT_LENGTH);
      const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

      // Derive key from salt
      const key = deriveKey(salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      // Decrypt data
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      logError('App', 'Error message', {});
      return null;
    }
  }

  /**
   * Encrypt an object's sensitive fields
   */
  static encryptObject<T extends Record<string, any>>(obj: T, fieldsToEncrypt?: string[]): T {
    if (!obj || typeof obj !== 'object') return obj;

    const fields = fieldsToEncrypt || ENCRYPTED_FIELDS;
    const encrypted = { ...obj };

    for (const field of fields) {
      if (field in encrypted) {
        const value = encrypted[field];

        if (typeof value === 'string') {
          encrypted[field] = this.encryptValue(value);
        } else if (Array.isArray(value)) {
          // Handle arrays of objects (like medications, conditions)
          encrypted[field] = value.map(item =>
            typeof item === 'object'
              ? this.encryptObject(item, fields)
              : typeof item === 'string'
                ? this.encryptValue(item)
                : item
          );
        } else if (value && typeof value === 'object') {
          // Recursively encrypt nested objects
          encrypted[field] = this.encryptObject(value, fields);
        }
      }
    }

    // Add encryption metadata
    encrypted._encrypted = true;
    encrypted._encryptedAt = new Date().toISOString();

    return encrypted;
  }

  /**
   * Decrypt an object's sensitive fields
   */
  static decryptObject<T extends Record<string, any>>(obj: T, fieldsToDecrypt?: string[]): T {
    if (!obj || typeof obj !== 'object') return obj;

    const fields = fieldsToDecrypt || ENCRYPTED_FIELDS;
    const decrypted = { ...obj };

    for (const field of fields) {
      if (field in decrypted) {
        const value = decrypted[field];

        if (typeof value === 'string') {
          const decryptedValue = this.decryptValue(value);
          if (decryptedValue !== null) {
            decrypted[field] = decryptedValue;
          }
        } else if (Array.isArray(value)) {
          // Handle arrays
          decrypted[field] = value.map(item =>
            typeof item === 'object'
              ? this.decryptObject(item, fields)
              : typeof item === 'string'
                ? this.decryptValue(item)
                : item
          );
        } else if (value && typeof value === 'object') {
          // Recursively decrypt nested objects
          decrypted[field] = this.decryptObject(value, fields);
        }
      }
    }

    // Remove encryption metadata
    delete decrypted._encrypted;
    delete decrypted._encryptedAt;

    return decrypted;
  }

  /**
   * Partially decrypt only specific fields needed for display
   */
  static partialDecrypt<T extends Record<string, any>>(obj: T, allowedFields: string[]): T {
    if (!obj || typeof obj !== 'object') return obj;

    const result = { ...obj };

    // Only decrypt allowed fields
    for (const field of allowedFields) {
      if (field in result && ENCRYPTED_FIELDS.includes(field)) {
        const value = result[field];
        if (typeof value === 'string') {
          const decryptedValue = this.decryptValue(value);
          if (decryptedValue !== null) {
            result[field] = decryptedValue;
          }
        }
      }
    }

    return result;
  }

  /**
   * Create a safe log entry (no sensitive data)
   */
  static safeLog(message: string, data?: any): void {
    // Remove any potentially sensitive fields before logging
    const safeData = data ? this.sanitizeForLogging(data) : undefined;
    logDebug('App', 'Debug output', { data: data: "placeholder" });
  }

  /**
   * Sanitize data for logging (remove sensitive fields)
   */
  static sanitizeForLogging(data: any): any {
    if (!data) return data;

    if (typeof data === 'string') {
      // Check if it looks like encrypted data or sensitive info
      if (data.length > 50 && /^[A-Za-z0-9+/]+=*$/.test(data)) {
        return '[ENCRYPTED]';
      }
      // Check for SSN pattern
      if (/^\d{3}-?\d{2}-?\d{4}$/.test(data)) {
        return '[SSN]';
      }
      // Check for phone pattern
      if (/^\d{3}-?\d{3}-?\d{4}$/.test(data)) {
        return '[PHONE]';
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForLogging(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (ENCRYPTED_FIELDS.includes(key)) {
          sanitized[key] = '[REDACTED]';
        } else if (
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token')
        ) {
          sanitized[key] = '[HIDDEN]';
        } else {
          sanitized[key] = this.sanitizeForLogging(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Check if an object is encrypted
   */
  static isEncrypted(obj: any): boolean {
    return obj && typeof obj === 'object' && obj._encrypted === true;
  }
}

// Export for use in other files
export default PatientDataEncryption;
