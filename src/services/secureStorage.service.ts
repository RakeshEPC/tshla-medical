/**
 * Secure Storage Service
 *
 * Wraps browser localStorage with AES-256 encryption for all sensitive data.
 * Transparent drop-in replacement for localStorage API.
 *
 * Part of HIPAA Phase 5: Client-Side Encryption for LocalStorage
 * HIPAA Compliance: §164.312(a)(2)(iv) - Encryption and Decryption
 *
 * Usage:
 *   // Instead of: localStorage.setItem('token', token)
 *   secureStorage.setItem('token', token)
 *
 *   // Instead of: localStorage.getItem('token')
 *   secureStorage.getItem('token')
 */

import { encryptionService } from './encryption.service';
import { logError, logWarn, logInfo } from './logger.service';

/**
 * Secure Storage Service
 *
 * Provides encrypted localStorage with automatic encryption/decryption.
 * All data is encrypted with AES-256 before being stored in localStorage.
 */
export const secureStorage = {
  /**
   * Store an encrypted string value
   *
   * @param key - Storage key
   * @param value - Plain text value to encrypt and store
   */
  setItem(key: string, value: string): void {
    try {
      if (!key) {
        logWarn('SecureStorage', 'Attempted to set item with empty key');
        return;
      }

      if (!value) {
        // If value is empty, just remove the item
        this.removeItem(key);
        return;
      }

      const encrypted = encryptionService.encrypt(value);
      localStorage.setItem(key, encrypted);

      logInfo('SecureStorage', `Encrypted and stored: ${key}`);
    } catch (error) {
      logError('SecureStorage', `Failed to store encrypted item: ${key}`, { error });
      // Don't throw - just log the error and fail silently
      // This prevents app crashes from storage failures
    }
  },

  /**
   * Retrieve and decrypt a string value
   *
   * @param key - Storage key
   * @returns Decrypted plain text value, or null if not found or decryption fails
   */
  getItem(key: string): string | null {
    try {
      if (!key) {
        logWarn('SecureStorage', 'Attempted to get item with empty key');
        return null;
      }

      const encrypted = localStorage.getItem(key);

      if (!encrypted) {
        return null;
      }

      const decrypted = encryptionService.decrypt(encrypted);
      logInfo('SecureStorage', `Retrieved and decrypted: ${key}`);

      return decrypted;
    } catch (error) {
      logError('SecureStorage', `Failed to retrieve encrypted item: ${key}`, { error });

      // If decryption fails, the data is corrupted or the key changed
      // Remove the corrupted data
      logWarn('SecureStorage', `Removing corrupted data for key: ${key}`);
      localStorage.removeItem(key);

      return null;
    }
  },

  /**
   * Store an encrypted JSON object
   *
   * @param key - Storage key
   * @param obj - Any JSON-serializable object
   */
  setJSON(key: string, obj: any): void {
    try {
      if (!key) {
        logWarn('SecureStorage', 'Attempted to set JSON with empty key');
        return;
      }

      if (obj === null || obj === undefined) {
        this.removeItem(key);
        return;
      }

      const encrypted = encryptionService.encryptJSON(obj);
      localStorage.setItem(key, encrypted);

      logInfo('SecureStorage', `Encrypted and stored JSON: ${key}`);
    } catch (error) {
      logError('SecureStorage', `Failed to store encrypted JSON: ${key}`, { error });
    }
  },

  /**
   * Retrieve and decrypt a JSON object
   *
   * @param key - Storage key
   * @returns Parsed JSON object, or null if not found or decryption fails
   */
  getJSON(key: string): any {
    try {
      if (!key) {
        logWarn('SecureStorage', 'Attempted to get JSON with empty key');
        return null;
      }

      const encrypted = localStorage.getItem(key);

      if (!encrypted) {
        return null;
      }

      const decrypted = encryptionService.decryptJSON(encrypted);
      logInfo('SecureStorage', `Retrieved and decrypted JSON: ${key}`);

      return decrypted;
    } catch (error) {
      logError('SecureStorage', `Failed to retrieve encrypted JSON: ${key}`, { error });

      // Remove corrupted data
      logWarn('SecureStorage', `Removing corrupted JSON data for key: ${key}`);
      localStorage.removeItem(key);

      return null;
    }
  },

  /**
   * Remove an item from storage
   *
   * @param key - Storage key
   */
  removeItem(key: string): void {
    try {
      if (!key) {
        logWarn('SecureStorage', 'Attempted to remove item with empty key');
        return;
      }

      localStorage.removeItem(key);
      logInfo('SecureStorage', `Removed item: ${key}`);
    } catch (error) {
      logError('SecureStorage', `Failed to remove item: ${key}`, { error });
    }
  },

  /**
   * Clear all items from storage
   *
   * WARNING: This will clear ALL localStorage items, including non-encrypted ones.
   * Use with caution.
   */
  clear(): void {
    try {
      localStorage.clear();
      logInfo('SecureStorage', 'Cleared all storage');
    } catch (error) {
      logError('SecureStorage', 'Failed to clear storage', { error });
    }
  },

  /**
   * Check if a key exists in storage
   *
   * @param key - Storage key
   * @returns true if key exists, false otherwise
   */
  hasItem(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      logError('SecureStorage', `Failed to check item existence: ${key}`, { error });
      return false;
    }
  },

  /**
   * Get the number of items in storage
   *
   * @returns Number of items in localStorage
   */
  get length(): number {
    try {
      return localStorage.length;
    } catch (error) {
      logError('SecureStorage', 'Failed to get storage length', { error });
      return 0;
    }
  },

  /**
   * Get the key at a specific index
   *
   * @param index - Index of the key
   * @returns Key at the index, or null if index is out of bounds
   */
  key(index: number): string | null {
    try {
      return localStorage.key(index);
    } catch (error) {
      logError('SecureStorage', `Failed to get key at index: ${index}`, { error });
      return null;
    }
  },

  /**
   * Migrate existing plain-text localStorage data to encrypted format
   *
   * Call this once during app initialization to migrate existing user data.
   * This is safe to call multiple times - it only migrates unencrypted data.
   *
   * @param keys - Array of localStorage keys to migrate
   */
  migrateToEncrypted(keys: string[]): void {
    logInfo('SecureStorage', `Starting migration of ${keys.length} keys to encrypted storage`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const key of keys) {
      try {
        const existingValue = localStorage.getItem(key);

        if (!existingValue) {
          skippedCount++;
          continue;
        }

        // Check if it's already encrypted by trying to decrypt it
        try {
          encryptionService.decrypt(existingValue);
          // If decryption succeeds, it's already encrypted
          logInfo('SecureStorage', `Key "${key}" is already encrypted, skipping`);
          skippedCount++;
          continue;
        } catch {
          // Decryption failed, so it's plain text - migrate it
          const encrypted = encryptionService.encrypt(existingValue);
          localStorage.setItem(key, encrypted);
          migratedCount++;
          logInfo('SecureStorage', `Migrated key "${key}" to encrypted storage`);
        }
      } catch (error) {
        errorCount++;
        logError('SecureStorage', `Failed to migrate key "${key}"`, { error });
      }
    }

    logInfo('SecureStorage', `Migration complete: ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`);
  }
};

/**
 * Helper function to get all keys that should be encrypted
 * These are the sensitive keys that contain PHI or authentication data
 */
export const getSensitiveKeys = (): string[] => {
  return [
    'auth_token',
    'user_data',
    'supabase_auth_token',
    'refresh_token',
    'session_data',
    'patient_cache',
    'pump_report_cache'
  ];
};
