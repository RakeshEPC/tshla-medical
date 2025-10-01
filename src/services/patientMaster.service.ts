/**
 * Patient Master Service
 * Manages patient records with triple ID system:
 * - EMR#: External EMR number (manually entered)
 * - TSH#: TSHMR-XXXXX (sequential, starting at 00001)
 * - AVA#: XXX-XXX (random unique identifier)
 */

import { getDb, generateId } from '../lib/db/browserClient';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface PatientMaster {
  patient_id: string; // UUID
  emr_number?: string; // From external EMR system
  ava_number: string; // AVA XXX-XXX format
  tsh_number: string; // TSHMR-XXXXX format
  name: string;
  dob: string; // Date of birth
  email?: string;
  phone?: string;
  address?: string;
  insurance_info?: string;
  emergency_contact?: string;
  medical_history?: string;
  allergies?: string;
  medications?: string;
  created_by_ma_id: string; // MA who created the record
  created_at: Date;
  updated_at: Date;
  is_deleted?: boolean; // Soft delete flag
  deleted_at?: Date;
  patient_summary?: string; // 2-3 sentence summary
}

export interface PatientSearchResult {
  patient: PatientMaster;
  matchType: 'emr' | 'ava' | 'tsh' | 'name' | 'email';
}

class PatientMasterService {
  private db = getDb();
  private lastTshNumber: number = 0;

  constructor() {
    this.initializeLastTshNumber();
  }

  /**
   * Initialize the last TSH number from existing records
   */
  private async initializeLastTshNumber() {
    try {
      const patients = await this.db.query('patients_master');
      if (patients && patients.length > 0) {
        // Extract numbers from TSH format (TSHMR-XXXXX)
        const tshNumbers = patients
          .map((p: any) => p.tsh_number)
          .filter((tsh: string) => tsh && tsh.startsWith('TSHMR-'))
          .map((tsh: string) => parseInt(tsh.replace('TSHMR-', ''), 10))
          .filter((num: number) => !isNaN(num));

        if (tshNumbers.length > 0) {
          this.lastTshNumber = Math.max(...tshNumbers);
        }
      }
    } catch (error) {
      logError('patientMaster', 'Error message', {});
    }
  }

  /**
   * Generate a unique AVA number (XXX-XXX format)
   */
  private async generateAvaNumber(): Promise<string> {
    const generateRandom = () => {
      const part1 = Math.floor(Math.random() * 900) + 100; // 100-999
      const part2 = Math.floor(Math.random() * 900) + 100; // 100-999
      return `${part1}-${part2}`;
    };

    let avaNumber = generateRandom();
    let attempts = 0;

    // Keep generating until we find a unique one
    while ((await this.checkAvaExists(avaNumber)) && attempts < 100) {
      avaNumber = generateRandom();
      attempts++;
    }

    if (attempts >= 100) {
      throw new Error('Unable to generate unique AVA number');
    }

    return avaNumber;
  }

  /**
   * Generate the next TSH number (TSHMR-XXXXX format)
   */
  private generateTshNumber(): string {
    this.lastTshNumber++;
    const paddedNumber = this.lastTshNumber.toString().padStart(5, '0');
    return `TSHMR-${paddedNumber}`;
  }

  /**
   * Check if AVA number already exists
   */
  private async checkAvaExists(avaNumber: string): Promise<boolean> {
    try {
      const patients = await this.db.query('patients_master');
      return patients.some((p: any) => p.ava_number === avaNumber && !p.is_deleted);
    } catch {
      return false;
    }
  }

  /**
   * Check for duplicate patient by name and DOB
   */
  async checkDuplicate(name: string, dob: string): Promise<PatientMaster | null> {
    try {
      const patients = await this.db.query('patients_master');
      const duplicate = patients.find(
        (p: any) => p.name.toLowerCase() === name.toLowerCase() && p.dob === dob && !p.is_deleted
      );
      return duplicate || null;
    } catch (error) {
      logError('patientMaster', 'Error message', {});
      return null;
    }
  }

  /**
   * Create a new patient with triple ID system
   */
  async createPatient(
    patientData: Omit<
      PatientMaster,
      'patient_id' | 'ava_number' | 'tsh_number' | 'created_at' | 'updated_at'
    >,
    maId: string
  ): Promise<PatientMaster> {
    // Check for duplicates
    const duplicate = await this.checkDuplicate(patientData.name, patientData.dob);
    if (duplicate) {
      throw new Error(`Patient already exists: ${duplicate.name} (DOB: ${duplicate.dob})`);
    }

    // Generate unique IDs
    const avaNumber = await this.generateAvaNumber();
    const tshNumber = this.generateTshNumber();

    const newPatient: PatientMaster = {
      ...patientData,
      patient_id: generateId(),
      ava_number: avaNumber,
      tsh_number: tshNumber,
      created_by_ma_id: maId,
      created_at: new Date(),
      updated_at: new Date(),
      is_deleted: false,
    };

    await this.db.execute('add:patients_master', newPatient);

    // Log the action
    await this.logAction(maId, newPatient.patient_id, 'patient_created', {
      ava_number: avaNumber,
      tsh_number: tshNumber,
    });

    return newPatient;
  }

  /**
   * Search for patients by any of the three IDs or other fields
   */
  async searchPatients(query: string): Promise<PatientSearchResult[]> {
    const results: PatientSearchResult[] = [];
    const patients = await this.db.query('patients_master');
    const queryLower = query.toLowerCase();

    for (const patient of patients) {
      if (patient.is_deleted) continue;

      // Check EMR number
      if (patient.emr_number && patient.emr_number.toLowerCase().includes(queryLower)) {
        results.push({ patient, matchType: 'emr' });
        continue;
      }

      // Check AVA number
      if (patient.ava_number && patient.ava_number.toLowerCase().includes(queryLower)) {
        results.push({ patient, matchType: 'ava' });
        continue;
      }

      // Check TSH number
      if (patient.tsh_number && patient.tsh_number.toLowerCase().includes(queryLower)) {
        results.push({ patient, matchType: 'tsh' });
        continue;
      }

      // Check name
      if (patient.name && patient.name.toLowerCase().includes(queryLower)) {
        results.push({ patient, matchType: 'name' });
        continue;
      }

      // Check email
      if (patient.email && patient.email.toLowerCase().includes(queryLower)) {
        results.push({ patient, matchType: 'email' });
        continue;
      }
    }

    return results;
  }

  /**
   * Get patient by any of the three IDs
   */
  async getPatientById(
    id: string,
    idType: 'emr' | 'ava' | 'tsh' | 'uuid'
  ): Promise<PatientMaster | null> {
    const patients = await this.db.query('patients_master');

    let patient: any;
    switch (idType) {
      case 'emr':
        patient = patients.find((p: any) => p.emr_number === id && !p.is_deleted);
        break;
      case 'ava':
        patient = patients.find((p: any) => p.ava_number === id && !p.is_deleted);
        break;
      case 'tsh':
        patient = patients.find((p: any) => p.tsh_number === id && !p.is_deleted);
        break;
      case 'uuid':
        patient = patients.find((p: any) => p.patient_id === id && !p.is_deleted);
        break;
    }

    return patient || null;
  }

  /**
   * Update patient information
   */
  async updatePatient(
    patientId: string,
    updates: Partial<PatientMaster>,
    maId: string
  ): Promise<PatientMaster> {
    const patient = await this.getPatientById(patientId, 'uuid');
    if (!patient) {
      throw new Error('Patient not found');
    }

    const updatedPatient = {
      ...patient,
      ...updates,
      patient_id: patient.patient_id, // Preserve ID
      ava_number: patient.ava_number, // Preserve AVA
      tsh_number: patient.tsh_number, // Preserve TSH
      created_at: patient.created_at, // Preserve creation date
      created_by_ma_id: patient.created_by_ma_id, // Preserve creator
      updated_at: new Date(),
    };

    await this.db.execute('put:patients_master', updatedPatient);

    // Log the action
    await this.logAction(maId, patientId, 'patient_updated', updates);

    return updatedPatient;
  }

  /**
   * Soft delete a patient (HIPAA compliance - 30 day retention)
   */
  async softDeletePatient(patientId: string, maId: string): Promise<void> {
    const patient = await this.getPatientById(patientId, 'uuid');
    if (!patient) {
      throw new Error('Patient not found');
    }

    const deletedPatient = {
      ...patient,
      is_deleted: true,
      deleted_at: new Date(),
      updated_at: new Date(),
    };

    await this.db.execute('put:patients_master', deletedPatient);

    // Log the action
    await this.logAction(maId, patientId, 'patient_deleted', {
      deleted_at: new Date(),
    });
  }

  /**
   * Get all patients created by a specific MA
   */
  async getPatientsByMA(maId: string): Promise<PatientMaster[]> {
    const patients = await this.db.query('patients_master');
    return patients.filter((p: any) => p.created_by_ma_id === maId && !p.is_deleted);
  }

  /**
   * Get all active patients
   */
  async getAllActivePatients(): Promise<PatientMaster[]> {
    const patients = await this.db.query('patients_master');
    return patients.filter((p: any) => !p.is_deleted);
  }

  /**
   * Update patient summary (2-3 sentence medical summary)
   */
  async updatePatientSummary(patientId: string, summary: string, maId: string): Promise<void> {
    const patient = await this.getPatientById(patientId, 'uuid');
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Store in patient record
    await this.updatePatient(patientId, { patient_summary: summary }, maId);

    // Also store in summaries table for history
    const summaryRecord = {
      summary_id: generateId(),
      patient_id: patientId,
      summary: summary,
      created_by: maId,
      created_at: new Date(),
    };

    await this.db.execute('add:patient_summaries', summaryRecord);
  }

  /**
   * Log MA actions for audit trail (HIPAA compliance)
   */
  private async logAction(
    maId: string,
    patientId: string,
    actionType: string,
    details?: any
  ): Promise<void> {
    const logEntry = {
      log_id: generateId(),
      ma_id: maId,
      patient_id: patientId,
      action_type: actionType,
      details: JSON.stringify(details || {}),
      timestamp: new Date(),
      ip_address: 'browser', // In real app, get actual IP
      user_agent: navigator.userAgent,
    };

    await this.db.execute('add:ma_actions_log', logEntry);
  }

  /**
   * Get audit trail for a patient
   */
  async getPatientAuditTrail(patientId: string): Promise<any[]> {
    const logs = await this.db.query('ma_actions_log');
    return logs
      .filter((log: any) => log.patient_id === patientId)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Clean up soft-deleted patients older than 30 days (HIPAA compliance)
   */
  async cleanupDeletedPatients(): Promise<number> {
    const patients = await this.db.query('patients_master');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let deletedCount = 0;

    for (const patient of patients) {
      if (patient.is_deleted && patient.deleted_at) {
        const deletedDate = new Date(patient.deleted_at);
        if (deletedDate < thirtyDaysAgo) {
          // Permanently delete
          await this.db.execute('delete:patients_master', patient.patient_id);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }
}

// Export singleton instance
export const patientMasterService = new PatientMasterService();
