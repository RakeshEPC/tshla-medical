/**
 * Encryption Service
 *
 * Provides AES-256 encryption/decryption for sensitive data stored client-side.
 * Part of HIPAA Phase 5: Client-Side Encryption for LocalStorage
 *
 * HIPAA Compliance: §164.312(a)(2)(iv) - Encryption and Decryption
 */

import CryptoJS from 'crypto-js';
import { logError, logWarn } from './logger.service';

/**
 * Get encryption key from environment variable
 * SECURITY: Fails fast if key is missing - NO DEFAULT FALLBACK
 * HIPAA Requirement: §164.312(a)(2)(iv) - Encryption must use strong keys
 */
const getEncryptionKey = (): string => {
  const key = import.meta.env.VITE_ENCRYPTION_KEY;

  // CRITICAL SECURITY: Never use a default key - fail immediately
  if (!key) {
    const errorMsg = 'FATAL SECURITY ERROR: VITE_ENCRYPTION_KEY is not configured. Cannot encrypt PHI.';
    logError('Encryption', errorMsg);

    // Show user-friendly error
    if (typeof window !== 'undefined') {
      alert('Application configuration error. Cannot protect sensitive data. Please contact support.');
    }

    throw new Error(errorMsg);
  }

  // Validate key strength (minimum 32 characters for AES-256)
  if (key.length < 32) {
    const errorMsg = `FATAL SECURITY ERROR: Encryption key too weak (${key.length} chars, minimum 32 required).`;
    logError('Encryption', errorMsg);
    throw new Error(errorMsg);
  }

  return key;
};

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Encryption Service
 *
 * Uses AES-256 encryption from CryptoJS library.
 */
export const encryptionService = {
  /**
   * Encrypt a string value
   *
   * @param data - Plain text string to encrypt
   * @returns Encrypted string (Base64 encoded)
   */
  encrypt(data: string): string {
    try {
      if (!data) return '';

      const encrypted = CryptoJS.AES.encrypt(data, ENCRYPTION_KEY);
      return encrypted.toString();
    } catch (error) {
      logError('Encryption', 'Failed to encrypt data', { error });
      throw new Error('Encryption failed');
    }
  },

  /**
   * Decrypt an encrypted string value
   *
   * @param encryptedData - Encrypted string (Base64 encoded)
   * @returns Decrypted plain text string
   * @throws Error if decryption fails (wrong key, corrupted data)
   */
  decrypt(encryptedData: string): string {
    try {
      if (!encryptedData) return '';

      const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
      const plainText = decrypted.toString(CryptoJS.enc.Utf8);

      // If decryption failed, plainText will be empty even if encryptedData wasn't
      if (!plainText && encryptedData) {
        throw new Error('Decryption produced empty result - likely wrong key or corrupted data');
      }

      return plainText;
    } catch (error) {
      logError('Encryption', 'Failed to decrypt data', { error });
      throw new Error('Decryption failed');
    }
  },

  /**
   * Encrypt a JSON object
   *
   * @param obj - Any JSON-serializable object
   * @returns Encrypted string
   */
  encryptJSON(obj: any): string {
    try {
      if (obj === null || obj === undefined) return '';

      const jsonString = JSON.stringify(obj);
      return this.encrypt(jsonString);
    } catch (error) {
      logError('Encryption', 'Failed to encrypt JSON', { error });
      throw new Error('JSON encryption failed');
    }
  },

  /**
   * Decrypt an encrypted JSON object
   *
   * @param encryptedData - Encrypted string
   * @returns Parsed JSON object
   * @throws Error if decryption or JSON parsing fails
   */
  decryptJSON(encryptedData: string): any {
    try {
      if (!encryptedData) return null;

      const jsonString = this.decrypt(encryptedData);

      if (!jsonString) return null;

      return JSON.parse(jsonString);
    } catch (error) {
      logError('Encryption', 'Failed to decrypt JSON', { error });
      throw new Error('JSON decryption failed');
    }
  },

  /**
   * Check if encryption is properly configured
   * Tests encryption/decryption with sample data
   *
   * @returns true if encryption is working, false otherwise
   */
  testEncryption(): boolean {
    try {
      const testData = 'HIPAA_ENCRYPTION_TEST';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);

      return decrypted === testData;
    } catch (error) {
      logError('Encryption', 'Encryption test failed', { error });
      return false;
    }
  }
};

// Test encryption on service initialization
if (!encryptionService.testEncryption()) {
  logWarn('Encryption', 'Encryption service test failed - encryption may not be working properly');
}
