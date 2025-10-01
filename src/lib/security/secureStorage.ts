/**
 * Secure storage replacement for localStorage
 * NEVER store PHI in localStorage - use server-side sessions instead
 */

import { getSession } from './sessionManager';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface SecureStorageOptions {
  expirationMinutes?: number;
  requireAuth?: boolean;
}

/**
 * Client-side storage for non-PHI data only
 */
export class SecureClientStorage {
  private prefix = 'tshla_secure_';

  /**
   * Store non-sensitive data only
   * For PHI, use SecureServerStorage instead
   */
  setItem(key: string, value: any, options?: SecureStorageOptions): void {
    if (this.isPHI(value)) {
      logError('App', 'Error message', {});
      throw new Error('Cannot store PHI in client storage');
    }

    const item = {
      value,
      timestamp: Date.now(),
      expiration: options?.expirationMinutes
        ? Date.now() + options.expirationMinutes * 60 * 1000
        : null,
    };

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.prefix + key, JSON.stringify(item));
    }
  }

  /**
   * Get non-sensitive data
   */
  getItem(key: string): any {
    if (typeof window === 'undefined') return null;

    const itemStr = sessionStorage.getItem(this.prefix + key);
    if (!itemStr) return null;

    try {
      const item = JSON.parse(itemStr);

      // Check expiration
      if (item.expiration && Date.now() > item.expiration) {
        this.removeItem(key);
        return null;
      }

      return item.value;
    } catch {
      return null;
    }
  }

  /**
   * Remove item
   */
  removeItem(key: string): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.prefix + key);
    }
  }

  /**
   * Clear all non-PHI storage
   */
  clear(): void {
    if (typeof window !== 'undefined') {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }

  /**
   * Check if data contains PHI
   */
  private isPHI(data: any): boolean {
    const phiKeywords = [
      'patient',
      'diagnosis',
      'medication',
      'transcript',
      'dob',
      'ssn',
      'mrn',
      'insurance',
      'treatment',
      'symptom',
      'allergy',
      'medical',
      'clinical',
      'lab',
      'result',
      'prescription',
      'icd10',
      'cpt',
    ];

    const dataStr = JSON.stringify(data).toLowerCase();
    return phiKeywords.some(keyword => dataStr.includes(keyword));
  }
}

/**
 * Server-side storage for PHI
 * All PHI must be stored server-side with encryption
 */
export class SecureServerStorage {
  /**
   * Store PHI on server (not in browser)
   */
  static async storePatientData(key: string, data: any, patientId: string): Promise<void> {
    const session = await getSession();
    if (!session) {
      throw new Error('Authentication required to store patient data');
    }

    const response = await fetch('/api/secure-storage/store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        data,
        patientId,
        userId: session.userId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to store patient data securely');
    }
  }

  /**
   * Retrieve PHI from server
   */
  static async getPatientData(key: string, patientId: string): Promise<any> {
    const session = await getSession();
    if (!session) {
      throw new Error('Authentication required to access patient data');
    }

    const response = await fetch('/api/secure-storage/retrieve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        patientId,
        userId: session.userId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to retrieve patient data');
    }

    return response.json();
  }

  /**
   * Delete PHI from server
   */
  static async deletePatientData(key: string, patientId: string): Promise<void> {
    const session = await getSession();
    if (!session) {
      throw new Error('Authentication required to delete patient data');
    }

    const response = await fetch('/api/secure-storage/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        patientId,
        userId: session.userId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to delete patient data');
    }
  }
}

/**
 * Migration utility to move data from localStorage to secure storage
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  const dangerousKeys = [
    'tshla_driver_transcript',
    'tshla_driver_soap',
    'tshla_driver_summary',
    'tshla_driver_meta',
    'guided_pump_state',
    'tshla_patient_preview',
  ];

  for (const key of dangerousKeys) {
    const data = localStorage.getItem(key);
    if (data) {
      logWarn('App', 'Warning message', {});

      // Move to secure storage
      try {
        // Parse and determine patient ID
        const parsed = JSON.parse(data);
        const patientId = parsed.email || parsed.patientId || 'unknown';

        // Store securely on server
        await SecureServerStorage.storePatientData(key.replace('tshla_', ''), parsed, patientId);

        // Remove from localStorage
        localStorage.removeItem(key);
        logDebug('App', 'Debug message', {});
      } catch (error) {
        logError('App', 'Error message', {});
      }
    }
  }
}

// Export singleton instances
export const clientStorage = new SecureClientStorage();

// Auto-clear session storage on tab close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clientStorage.clear();
  });
}
