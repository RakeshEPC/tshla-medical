/**
 * HIPAA-Compliant Encryption Utilities
 * Implements AES-256-GCM encryption for PHI at rest
 * Required by HIPAA Security Rule 45 CFR §164.312(a)(2)(iv)
 */

import crypto from 'crypto';
import { env } from '../config/environment';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

class PHIEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly saltLength = 64; // 512 bits
  private readonly iterations = 100000; // PBKDF2 iterations

  /**
   * Derive encryption key from password using PBKDF2
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha256');
  }

  /**
   * Encrypt PHI data
   * @param data - The PHI data to encrypt
   * @param password - The encryption password (should be stored securely)
   * @returns Encrypted data with salt, iv, auth tag
   */
  public encryptPHI(data: string, password: string): string {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);

      // Derive key from password
      const key = this.deriveKey(password, salt);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      // Encrypt data
      const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine salt, iv, authTag, and encrypted data
      const combined = Buffer.concat([salt, iv, authTag, encrypted]);

      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      logError('App', 'Error message', {});
      throw new Error('Failed to encrypt PHI data');
    }
  }

  /**
   * Decrypt PHI data
   * @param encryptedData - The encrypted data string
   * @param password - The decryption password
   * @returns Decrypted PHI data
   */
  public decryptPHI(encryptedData: string, password: string): string {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = combined.slice(0, this.saltLength);
      const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
      const authTag = combined.slice(
        this.saltLength + this.ivLength,
        this.saltLength + this.ivLength + this.tagLength
      );
      const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength);

      // Derive key from password
      const key = this.deriveKey(password, salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt data
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      logError('App', 'Error message', {});
      throw new Error('Failed to decrypt PHI data - invalid password or corrupted data');
    }
  }

  /**
   * Hash sensitive data for comparison (e.g., SSN lookup)
   * Uses SHA-256 with salt
   */
  public hashSensitiveData(data: string, salt?: string): string {
    const useSalt = salt || crypto.randomBytes(32).toString('hex');
    const hash = crypto
      .createHash('sha256')
      .update(data + useSalt)
      .digest('hex');

    return `${useSalt}:${hash}`;
  }

  /**
   * Verify hashed data
   */
  public verifyHash(data: string, hashedValue: string): boolean {
    const [salt, originalHash] = hashedValue.split(':');
    const newHash = crypto
      .createHash('sha256')
      .update(data + salt)
      .digest('hex');

    // Use timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(newHash));
  }

  /**
   * Generate secure random token
   */
  public generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt object containing PHI
   */
  public encryptPHIObject(obj: any, password: string): string {
    const jsonString = JSON.stringify(obj);
    return this.encryptPHI(jsonString, password);
  }

  /**
   * Decrypt object containing PHI
   */
  public decryptPHIObject(encryptedData: string, password: string): any {
    const jsonString = this.decryptPHI(encryptedData, password);
    return JSON.parse(jsonString);
  }

  /**
   * Sanitize PHI for logging (redact sensitive fields)
   */
  public sanitizeForLogging(data: any): any {
    const sensitive = [
      'ssn',
      'socialSecurityNumber',
      'dob',
      'dateOfBirth',
      'birthDate',
      'mrn',
      'medicalRecordNumber',
      'insurance',
      'insuranceId',
      'address',
      'phone',
      'email',
      'diagnosis',
      'medications',
      'conditions',
      'labs',
      'notes',
    ];

    const sanitized = { ...data };

    for (const key in sanitized) {
      if (sensitive.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeForLogging(sanitized[key]);
      }
    }

    return sanitized;
  }
}

// Browser-compatible encryption (using Web Crypto API)
class BrowserPHIEncryption {
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;
  private readonly ivLength = 12; // 96 bits for GCM

  /**
   * Generate encryption key from password
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt PHI in browser
   */
  public async encryptPHI(data: string, password: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(64));
      const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

      const key = await this.deriveKey(password, salt);

      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm, iv },
        key,
        encoder.encode(data)
      );

      // Combine salt, iv, and encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      logError('App', 'Error message', {});
      throw new Error('Failed to encrypt PHI data');
    }
  }

  /**
   * Decrypt PHI in browser
   */
  public async decryptPHI(encryptedData: string, password: string): Promise<string> {
    try {
      // Decode from base64
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

      // Extract components
      const salt = combined.slice(0, 64);
      const iv = combined.slice(64, 64 + this.ivLength);
      const encrypted = combined.slice(64 + this.ivLength);

      const key = await this.deriveKey(password, salt);

      const decrypted = await crypto.subtle.decrypt({ name: this.algorithm, iv }, key, encrypted);

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      logError('App', 'Error message', {});
      throw new Error('Failed to decrypt PHI data');
    }
  }

  /**
   * Generate secure token in browser
   */
  public generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

// Export appropriate implementation based on environment
const isNode = typeof window === 'undefined';
export const phiEncryption = isNode ? new PHIEncryption() : new BrowserPHIEncryption();

// Encryption key management (in production, use KMS)
class EncryptionKeyManager {
  private masterKey: string | null = null;

  /**
   * Initialize with master key (from environment or KMS)
   */
  public initialize(): void {
    // In production, retrieve from AWS KMS, Azure Key Vault, or similar
    this.masterKey = env.MASTER_ENCRYPTION_KEY || null;

    if (!this.masterKey) {
      logError('App', 'Error message', {});
      logError('App', 'Error message', {});
    }
  }

  /**
   * Get encryption key for specific purpose
   */
  public getKey(purpose: 'PHI' | 'SESSION' | 'AUDIT'): string {
    if (!this.masterKey) {
      throw new Error('Encryption not configured - cannot process PHI');
    }

    // In production, derive purpose-specific keys from master
    return `${this.masterKey}_${purpose}`;
  }

  /**
   * Rotate encryption keys (should be done periodically)
   */
  public async rotateKeys(): Promise<void> {
    // In production:
    // 1. Generate new key
    // 2. Re-encrypt all data with new key
    // 3. Update key in KMS
    // 4. Keep old key for decryption only
    logDebug('App', 'Debug message', {});
  }
}

export const keyManager = new EncryptionKeyManager();

// Initialize on load
if (typeof window === 'undefined') {
  keyManager.initialize();
}
