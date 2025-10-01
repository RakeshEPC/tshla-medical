import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';
/**
 * Secure Patient API Client
 * Handles encrypted patient data communication with backend
 */

export class SecurePatientAPI {
  private static baseUrl = '/api/secure';

  /**
   * Get list of patients (minimal data only)
   */
  static async listPatients(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/patients?list=true`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }

      const data = await response.json();
      return data.patients || [];
    } catch (error) {
      logError('App', 'Error message', {});
      return [];
    }
  }

  /**
   * Get specific patient with only required fields decrypted
   */
  static async getPatient(
    patientId: string,
    fieldsNeeded: string[] = ['firstName', 'lastName']
  ): Promise<any> {
    try {
      const fields = fieldsNeeded.join(',');
      const response = await fetch(`${this.baseUrl}/patients?id=${patientId}&fields=${fields}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch patient');
      }

      const data = await response.json();
      return data.patient;
    } catch (error) {
      logError('App', 'Error message', {});
      return null;
    }
  }

  /**
   * Get patient for viewing (specific fields only)
   */
  static async getPatientForViewing(patientId: string): Promise<any> {
    // Only decrypt fields needed for current view
    const viewFields = ['firstName', 'lastName', 'dob', 'conditions', 'medications'];

    return this.getPatient(patientId, viewFields);
  }

  /**
   * Get patient for mental health screening
   */
  static async getPatientForMentalHealth(patientId: string): Promise<any> {
    // Only decrypt fields needed for mental health
    const mentalHealthFields = ['firstName', 'lastName', 'screeningScores'];

    return this.getPatient(patientId, mentalHealthFields);
  }

  /**
   * Update patient screening scores (automatically encrypted)
   */
  static async updateScreeningScores(patientId: string, scores: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          action: 'updateScreeningScores',
          data: scores,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update scores');
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      logError('App', 'Error message', {});
      return false;
    }
  }

  /**
   * Get patient visits (encrypted by default)
   */
  static async getPatientVisits(patientId: string, decrypt: boolean = false): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/visits?patientId=${patientId}&decrypt=${decrypt}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch visits');
      }

      const data = await response.json();
      return data.visits || [];
    } catch (error) {
      logError('App', 'Error message', {});
      return [];
    }
  }

  /**
   * Save a visit (automatically encrypted)
   */
  static async saveVisit(visitData: {
    patientId: string;
    dictation: string;
    soapNote?: any;
    date?: string;
  }): Promise<{ success: boolean; visitId?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/visits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(visitData),
      });

      if (!response.ok) {
        throw new Error('Failed to save visit');
      }

      const result = await response.json();
      return {
        success: result.success,
        visitId: result.visitId,
      };
    } catch (error) {
      logError('App', 'Error message', {});
      return { success: false };
    }
  }

  /**
   * Search patients with mental health conditions
   */
  static async getPatientsWithMentalHealth(): Promise<any[]> {
    try {
      // This would call a specialized endpoint that handles encrypted search
      const response = await fetch(`${this.baseUrl}/patients/mental-health`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to search patients');
      }

      const data = await response.json();
      return data.patients || [];
    } catch (error) {
      logError('App', 'Error message', {});
      return [];
    }
  }
}

export default SecurePatientAPI;
