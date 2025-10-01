/**
 * Secure Patient Data Service with Encryption
 * All patient data is encrypted before storage and decrypted on retrieval
 */

import { testPatients, TestPatient } from '@/lib/testPatients';
import PatientDataEncryption from '@/lib/crypto/patientEncryption';

export interface SecureVisit {
  id: string;
  patientId: string;
  date: string;
  dictation: string; // encrypted
  soapNote?: any; // encrypted
  timestamp: string;
  _encrypted?: boolean;
}

export class SecurePatientService {
  private visits: SecureVisit[] = [];
  private encryptedPatients: Map<string, any> = new Map();

  constructor() {
    // Initialize encrypted patient data
    this.initializeEncryptedPatients();

    // Load encrypted visits from secure storage (not localStorage)
    if (typeof window !== 'undefined') {
      // In production, this should load from secure backend
      this.loadEncryptedVisits();
    }
  }

  /**
   * Initialize patients with encryption
   */
  private initializeEncryptedPatients() {
    for (const patient of testPatients) {
      const encrypted = PatientDataEncryption.encryptObject(patient);
      this.encryptedPatients.set(patient.id, encrypted);
      PatientDataEncryption.safeLog(`Patient ${patient.id} data encrypted`);
    }
  }

  /**
   * Get all patients (returns minimal safe data)
   */
  public getAllPatients(requestContext?: { needsFullData?: boolean }): any[] {
    const patients = Array.from(this.encryptedPatients.values());

    if (requestContext?.needsFullData) {
      // Only decrypt if explicitly needed
      PatientDataEncryption.safeLog('Full patient data requested - decrypting');
      return patients.map(p => PatientDataEncryption.decryptObject(p));
    }

    // Return only safe fields for listing
    return patients.map(p => ({
      id: p.id,
      avaId: p.avaId,
      // Only decrypt name for display
      firstName: PatientDataEncryption.decryptValue(p.firstName),
      lastName: PatientDataEncryption.decryptValue(p.lastName),
      // Keep other fields encrypted
      _encrypted: true,
    }));
  }

  /**
   * Get patient by ID with selective decryption
   */
  public getPatientById(id: string, fieldsNeeded?: string[]): any {
    const encryptedPatient = this.encryptedPatients.get(id);
    if (!encryptedPatient) {
      PatientDataEncryption.safeLog(`Patient ${id} not found`);
      return undefined;
    }

    if (!fieldsNeeded || fieldsNeeded.length === 0) {
      // Return minimal data
      return {
        id: encryptedPatient.id,
        avaId: encryptedPatient.avaId,
        firstName: PatientDataEncryption.decryptValue(encryptedPatient.firstName),
        lastName: PatientDataEncryption.decryptValue(encryptedPatient.lastName),
        _encrypted: true,
      };
    }

    // Partially decrypt only requested fields
    PatientDataEncryption.safeLog(`Decrypting specific fields for patient ${id}`, { fieldsNeeded });
    return PatientDataEncryption.partialDecrypt(encryptedPatient, fieldsNeeded);
  }

  /**
   * Save patient data (encrypts before saving)
   */
  public savePatientData(patientId: string, data: any): boolean {
    try {
      // Encrypt the data
      const encrypted = PatientDataEncryption.encryptObject(data);

      // Store encrypted data
      this.encryptedPatients.set(patientId, encrypted);

      // In production, save to secure backend
      this.persistEncryptedData();

      PatientDataEncryption.safeLog(`Patient ${patientId} data saved (encrypted)`);
      return true;
    } catch (error) {
      PatientDataEncryption.safeLog('Error saving patient data', error);
      return false;
    }
  }

  /**
   * Get patient by AVA ID
   */
  public getPatientByAvaId(avaId: string, fieldsNeeded?: string[]): any {
    for (const [id, patient] of this.encryptedPatients.entries()) {
      if (patient.avaId === avaId) {
        return this.getPatientById(id, fieldsNeeded);
      }
    }
    return undefined;
  }

  /**
   * Save a visit (encrypts sensitive data)
   */
  public saveVisit(visit: Omit<SecureVisit, 'id' | 'timestamp' | '_encrypted'>): SecureVisit {
    const newVisit: SecureVisit = {
      id: `visit-${Date.now()}`,
      patientId: visit.patientId,
      date: visit.date,
      dictation: PatientDataEncryption.encryptValue(visit.dictation) || '',
      soapNote: visit.soapNote ? PatientDataEncryption.encryptObject(visit.soapNote) : undefined,
      timestamp: new Date().toISOString(),
      _encrypted: true,
    };

    this.visits.push(newVisit);
    this.persistEncryptedVisits();

    PatientDataEncryption.safeLog(`Visit saved for patient ${visit.patientId}`);
    return newVisit;
  }

  /**
   * Get visits for a patient (decrypts on demand)
   */
  public getPatientVisits(patientId: string, decrypt: boolean = false): SecureVisit[] {
    const visits = this.visits.filter(v => v.patientId === patientId);

    if (!decrypt) {
      // Return encrypted visits
      return visits.map(v => ({
        ...v,
        dictation: '[ENCRYPTED]',
        soapNote: v.soapNote ? '[ENCRYPTED]' : undefined,
      }));
    }

    // Decrypt for authorized viewing
    PatientDataEncryption.safeLog(`Decrypting visits for patient ${patientId}`);
    return visits.map(v => ({
      ...v,
      dictation: PatientDataEncryption.decryptValue(v.dictation) || '',
      soapNote: v.soapNote ? PatientDataEncryption.decryptObject(v.soapNote) : undefined,
    }));
  }

  /**
   * Update screening scores (encrypted)
   */
  public updateScreeningScores(patientId: string, scores: any): boolean {
    const patient = this.encryptedPatients.get(patientId);
    if (!patient) return false;

    // Encrypt the scores
    const encryptedScores = PatientDataEncryption.encryptObject(scores);

    // Update patient data
    patient.screeningScores = encryptedScores;
    this.encryptedPatients.set(patientId, patient);

    this.persistEncryptedData();
    PatientDataEncryption.safeLog(`Screening scores updated for patient ${patientId}`);

    return true;
  }

  /**
   * Get patients with mental health conditions (requires decryption)
   */
  public getPatientsWithMentalHealth(): any[] {
    const results = [];

    for (const [id, encryptedPatient] of this.encryptedPatients.entries()) {
      // Decrypt only conditions field to check
      const conditions = encryptedPatient.conditions;
      if (Array.isArray(conditions)) {
        // Check encrypted conditions (in production, use encrypted search)
        const decryptedConditions = conditions.map((c: any) =>
          typeof c === 'string' ? PatientDataEncryption.decryptValue(c) : c
        );

        const hasMentalHealth = decryptedConditions.some((c: any) => {
          if (typeof c === 'string') {
            return c.includes('depression') || c.includes('anxiety') || c.includes('bipolar');
          }
          return (
            c?.name?.toLowerCase().includes('depression') ||
            c?.name?.toLowerCase().includes('anxiety') ||
            c?.name?.toLowerCase().includes('bipolar') ||
            c?.icd10?.startsWith('F')
          );
        });

        if (hasMentalHealth) {
          results.push({
            id,
            avaId: encryptedPatient.avaId,
            firstName: PatientDataEncryption.decryptValue(encryptedPatient.firstName),
            lastName: PatientDataEncryption.decryptValue(encryptedPatient.lastName),
            _hasProtectedData: true,
          });
        }
      }
    }

    PatientDataEncryption.safeLog(`Found ${results.length} patients with mental health conditions`);
    return results;
  }

  /**
   * Generate visit template (requires decryption for specific patient)
   */
  public generateVisitTemplate(patientId: string, visitDate: string): string {
    // This requires full decryption for the specific patient
    const encryptedPatient = this.encryptedPatients.get(patientId);
    if (!encryptedPatient) return 'Patient not found';

    PatientDataEncryption.safeLog(`Generating visit template for patient ${patientId}`);

    // Decrypt only necessary fields for template
    const patient = PatientDataEncryption.partialDecrypt(encryptedPatient, [
      'firstName',
      'lastName',
      'dob',
      'conditions',
      'medications',
      'labs',
      'screeningScores',
      'visitHistory',
    ]);

    let text = `=== PATIENT INFORMATION ===\n`;
    text += `Name: ${patient.firstName} ${patient.lastName}\n`;
    text += `ID: ${patient.id} | AVA: ${patient.avaId}\n`;
    text += `Date of Birth: ${patient.dob || '[PROTECTED]'}\n`;
    text += `Visit Date: ${visitDate}\n\n`;

    // Rest of template generation...
    text += `=== TODAY'S VISIT ===\n\n`;
    text += `CHIEF COMPLAINT:\n[Start dictating here...]\n\n`;

    return text;
  }

  /**
   * Persist encrypted data (in production, use secure backend)
   */
  private persistEncryptedData() {
    if (typeof window !== 'undefined') {
      // WARNING: In production, never store encrypted PHI in localStorage
      // This should call a secure backend API
      PatientDataEncryption.safeLog('Data persistence requested - should use secure backend');
    }
  }

  /**
   * Persist encrypted visits
   */
  private persistEncryptedVisits() {
    if (typeof window !== 'undefined') {
      // WARNING: In production, never store in localStorage
      PatientDataEncryption.safeLog('Visit persistence requested - should use secure backend');
    }
  }

  /**
   * Load encrypted visits (from secure storage)
   */
  private loadEncryptedVisits() {
    // In production, load from secure backend
    PatientDataEncryption.safeLog('Loading encrypted visits from secure storage');
  }
}

// Singleton instance
export const securePatientService = new SecurePatientService();
