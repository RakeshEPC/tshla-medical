// Secure patient service with automatic PHI encryption
// All patient data is encrypted before storage and decrypted on retrieval

import { getDb, generateId } from '@/lib/db/client';
import { PatientEncryption } from '@/lib/crypto/patientEncryption';
import { AuditLogger, AuditAction } from '@/lib/audit/auditLogger';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

export interface Patient {
  id: string;
  avaId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  phone?: string;
  address?: string;
  ssn?: string; // Last 4 digits only
  insuranceId?: string;
  medicalRecordNumber?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Visit {
  id: string;
  patientId: string;
  visitDate: Date;
  chiefComplaint?: string;
  dictation?: string;
  soapNote?: any;
  diagnoses?: string[];
  medications?: string[];
  createdBy: string;
  createdAt?: Date;
}

export class SecurePatientService {
  private static instance: SecurePatientService;
  private auditLogger: AuditLogger;

  private constructor() {
    this.auditLogger = AuditLogger.getInstance();
  }

  static getInstance(): SecurePatientService {
    if (!SecurePatientService.instance) {
      SecurePatientService.instance = new SecurePatientService();
    }
    return SecurePatientService.instance;
  }

  // Create a new patient with encrypted PHI
  async createPatient(
    patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>,
    doctorId: string,
    ip: string
  ): Promise<string> {
    const db = getDb();
    const patientId = patient.avaId || generateId();

    try {
      // Encrypt all PHI fields
      const encryptedData = {
        firstName: PatientEncryption.encryptValue(patient.firstName),
        lastName: PatientEncryption.encryptValue(patient.lastName),
        dateOfBirth: PatientEncryption.encryptValue(patient.dateOfBirth),
        email: patient.email ? PatientEncryption.encryptValue(patient.email) : null,
        phone: patient.phone ? PatientEncryption.encryptValue(patient.phone) : null,
        address: patient.address ? PatientEncryption.encryptValue(patient.address) : null,
        ssn: patient.ssn ? PatientEncryption.encryptValue(patient.ssn) : null,
        insuranceId: patient.insuranceId
          ? PatientEncryption.encryptValue(patient.insuranceId)
          : null,
        medicalRecordNumber: patient.medicalRecordNumber
          ? PatientEncryption.encryptValue(patient.medicalRecordNumber)
          : null,
      };

      // Store encrypted data in database
      await db.execute(
        `INSERT INTO patients (id, ava_id, encrypted_data, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [patientId, patient.avaId, JSON.stringify(encryptedData), doctorId]
      );

      // Log PHI encryption
      await this.auditLogger.logPHIEncryption(doctorId, patientId, ip);

      // Log patient creation
      await this.auditLogger.logPatientAccess(
        doctorId,
        patientId,
        AuditAction.CREATE_PATIENT,
        ip,
        true,
        { action: 'Created new patient record' }
      );

      logDebug('securePatientService', 'Debug message', {});
      return patientId;
    } catch (error) {
      logError('securePatientService', 'Error message', {});

      await this.auditLogger.logPatientAccess(
        doctorId,
        patientId,
        AuditAction.CREATE_PATIENT,
        ip,
        false,
        { error: 'Failed to create patient' }
      );

      throw new Error('Failed to create patient record');
    }
  }

  // Get patient with decrypted PHI (audit logged)
  async getPatient(patientId: string, doctorId: string, ip: string): Promise<Patient | null> {
    const db = getDb();

    try {
      // Get encrypted patient data
      const result = await db.queryOne(
        `SELECT id, ava_id, encrypted_data, created_at, updated_at
         FROM patients
         WHERE id = $1 OR ava_id = $1`,
        [patientId]
      );

      if (!result) {
        await this.auditLogger.logPatientAccess(
          doctorId,
          patientId,
          AuditAction.VIEW_PATIENT,
          ip,
          false,
          { reason: 'Patient not found' }
        );
        return null;
      }

      // Parse and decrypt PHI
      const encryptedData =
        typeof result.encrypted_data === 'string'
          ? JSON.parse(result.encrypted_data)
          : result.encrypted_data;

      const patient: Patient = {
        id: result.id,
        avaId: result.ava_id,
        firstName: PatientEncryption.decryptValue(encryptedData.firstName),
        lastName: PatientEncryption.decryptValue(encryptedData.lastName),
        dateOfBirth: PatientEncryption.decryptValue(encryptedData.dateOfBirth),
        email: encryptedData.email
          ? PatientEncryption.decryptValue(encryptedData.email)
          : undefined,
        phone: encryptedData.phone
          ? PatientEncryption.decryptValue(encryptedData.phone)
          : undefined,
        address: encryptedData.address
          ? PatientEncryption.decryptValue(encryptedData.address)
          : undefined,
        ssn: encryptedData.ssn ? PatientEncryption.decryptValue(encryptedData.ssn) : undefined,
        insuranceId: encryptedData.insuranceId
          ? PatientEncryption.decryptValue(encryptedData.insuranceId)
          : undefined,
        medicalRecordNumber: encryptedData.medicalRecordNumber
          ? PatientEncryption.decryptValue(encryptedData.medicalRecordNumber)
          : undefined,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
      };

      // Log PHI decryption and access
      await this.auditLogger.logPHIDecryption(doctorId, patientId, ip);
      await this.auditLogger.logPatientAccess(
        doctorId,
        patientId,
        AuditAction.VIEW_PATIENT,
        ip,
        true,
        { action: 'Viewed patient record' }
      );

      return patient;
    } catch (error) {
      logError('securePatientService', 'Error message', {});

      await this.auditLogger.logPatientAccess(
        doctorId,
        patientId,
        AuditAction.VIEW_PATIENT,
        ip,
        false,
        { error: 'Failed to retrieve patient' }
      );

      return null;
    }
  }

  // Update patient with encrypted PHI
  async updatePatient(
    patientId: string,
    updates: Partial<Patient>,
    doctorId: string,
    ip: string
  ): Promise<boolean> {
    const db = getDb();

    try {
      // Get existing patient data
      const existing = await db.queryOne(
        `SELECT encrypted_data FROM patients WHERE id = $1 OR ava_id = $1`,
        [patientId]
      );

      if (!existing) {
        return false;
      }

      const existingData =
        typeof existing.encrypted_data === 'string'
          ? JSON.parse(existing.encrypted_data)
          : existing.encrypted_data;

      // Encrypt updated fields
      const encryptedUpdates: any = { ...existingData };

      if (updates.firstName)
        encryptedUpdates.firstName = PatientEncryption.encryptValue(updates.firstName);
      if (updates.lastName)
        encryptedUpdates.lastName = PatientEncryption.encryptValue(updates.lastName);
      if (updates.dateOfBirth)
        encryptedUpdates.dateOfBirth = PatientEncryption.encryptValue(updates.dateOfBirth);
      if (updates.email) encryptedUpdates.email = PatientEncryption.encryptValue(updates.email);
      if (updates.phone) encryptedUpdates.phone = PatientEncryption.encryptValue(updates.phone);
      if (updates.address)
        encryptedUpdates.address = PatientEncryption.encryptValue(updates.address);
      if (updates.ssn) encryptedUpdates.ssn = PatientEncryption.encryptValue(updates.ssn);
      if (updates.insuranceId)
        encryptedUpdates.insuranceId = PatientEncryption.encryptValue(updates.insuranceId);
      if (updates.medicalRecordNumber)
        encryptedUpdates.medicalRecordNumber = PatientEncryption.encryptValue(
          updates.medicalRecordNumber
        );

      // Update database
      await db.execute(
        `UPDATE patients 
         SET encrypted_data = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 OR ava_id = $3`,
        [JSON.stringify(encryptedUpdates), doctorId, patientId]
      );

      // Log update
      await this.auditLogger.logPatientAccess(
        doctorId,
        patientId,
        AuditAction.UPDATE_PATIENT,
        ip,
        true,
        { fieldsUpdated: Object.keys(updates) }
      );

      return true;
    } catch (error) {
      logError('securePatientService', 'Error message', {});

      await this.auditLogger.logPatientAccess(
        doctorId,
        patientId,
        AuditAction.UPDATE_PATIENT,
        ip,
        false,
        { error: 'Failed to update patient' }
      );

      return false;
    }
  }

  // Create a visit with encrypted data
  async createVisit(
    visit: Omit<Visit, 'id' | 'createdAt'>,
    doctorId: string,
    ip: string
  ): Promise<string> {
    const db = getDb();
    const visitId = generateId();

    try {
      // Encrypt sensitive visit data
      const encryptedDictation = visit.dictation
        ? PatientEncryption.encryptValue(visit.dictation)
        : null;

      const encryptedSoapNote = visit.soapNote
        ? PatientEncryption.encryptValue(JSON.stringify(visit.soapNote))
        : null;

      // Store encrypted visit
      await db.execute(
        `INSERT INTO visits (
          id, patient_id, visit_date, encrypted_dictation, 
          encrypted_soap_note, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [visitId, visit.patientId, visit.visitDate, encryptedDictation, encryptedSoapNote, doctorId]
      );

      // Log visit creation
      await this.auditLogger.logPatientAccess(
        doctorId,
        visit.patientId,
        AuditAction.CREATE_VISIT,
        ip,
        true,
        { visitId, visitDate: visit.visitDate }
      );

      return visitId;
    } catch (error) {
      logError('securePatientService', 'Error message', {});

      await this.auditLogger.logPatientAccess(
        doctorId,
        visit.patientId,
        AuditAction.CREATE_VISIT,
        ip,
        false,
        { error: 'Failed to create visit' }
      );

      throw new Error('Failed to create visit');
    }
  }

  // Get visits for a patient (with decryption)
  async getPatientVisits(patientId: string, doctorId: string, ip: string): Promise<Visit[]> {
    const db = getDb();

    try {
      const visits = await db.query(
        `SELECT id, patient_id, visit_date, encrypted_dictation, 
                encrypted_soap_note, created_by, created_at
         FROM visits
         WHERE patient_id = $1
         ORDER BY visit_date DESC`,
        [patientId]
      );

      // Decrypt visit data
      const decryptedVisits = visits.map((v: any) => ({
        id: v.id,
        patientId: v.patient_id,
        visitDate: new Date(v.visit_date),
        dictation: v.encrypted_dictation
          ? PatientEncryption.decryptValue(v.encrypted_dictation)
          : undefined,
        soapNote: v.encrypted_soap_note
          ? JSON.parse(PatientEncryption.decryptValue(v.encrypted_soap_note))
          : undefined,
        createdBy: v.created_by,
        createdAt: new Date(v.created_at),
      }));

      // Log access
      await this.auditLogger.logPatientAccess(
        doctorId,
        patientId,
        AuditAction.VIEW_VISIT,
        ip,
        true,
        { visitCount: decryptedVisits.length }
      );

      return decryptedVisits;
    } catch (error) {
      logError('securePatientService', 'Error message', {});

      await this.auditLogger.logPatientAccess(
        doctorId,
        patientId,
        AuditAction.VIEW_VISIT,
        ip,
        false,
        { error: 'Failed to retrieve visits' }
      );

      return [];
    }
  }

  // Search patients (without decrypting PHI in search)
  async searchPatients(
    searchTerm: string,
    doctorId: string,
    ip: string
  ): Promise<Array<{ id: string; avaId?: string }>> {
    const db = getDb();

    try {
      // Search by ID only (not by PHI fields for security)
      const results = await db.query(
        `SELECT id, ava_id FROM patients
         WHERE id LIKE $1 OR ava_id LIKE $1
         LIMIT 10`,
        [`%${searchTerm}%`]
      );

      // Log search
      await this.auditLogger.logAudit(doctorId, 'SEARCH', AuditAction.VIEW_PATIENT, ip, true, {
        searchTerm,
        resultCount: results.length,
      });

      return results.map((r: any) => ({
        id: r.id,
        avaId: r.ava_id,
      }));
    } catch (error) {
      logError('securePatientService', 'Error message', {});
      return [];
    }
  }
}
