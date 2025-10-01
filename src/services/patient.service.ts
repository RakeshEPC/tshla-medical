import type {
  Patient,
  PatientRegistration,
  PatientLogin,
  PatientSession,
  PumpRecommendation,
  PersonalizedReport
} from '../types/patient.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

class PatientService {
  private readonly STORAGE_PREFIX = 'tshla_patient_';
  private readonly SESSION_KEY = 'tshla_patient_session';
  
  /**
   * Generate unique 8-digit internal ID
   */
  private generateInternalId(): string {
    // Generate 8-digit number starting with non-zero
    const min = 10000000;
    const max = 99999999;
    let id: string;
    
    do {
      id = Math.floor(Math.random() * (max - min + 1) + min).toString();
    } while (this.internalIdExists(id));
    
    return id;
  }
  
  /**
   * Generate AVA patient ID in format AVA ###-###
   */
  private generateAvaId(): string {
    let avaId: string;
    
    do {
      const firstPart = Math.floor(Math.random() * 900 + 100); // 100-999
      const secondPart = Math.floor(Math.random() * 900 + 100); // 100-999
      avaId = `AVA ${firstPart}-${secondPart}`;
    } while (this.avaIdExists(avaId));
    
    return avaId;
  }
  
  /**
   * Check if internal ID already exists
   */
  private internalIdExists(id: string): boolean {
    const allPatients = this.getAllPatients();
    return allPatients.some(p => p.internalId === id);
  }
  
  /**
   * Check if AVA ID already exists
   */
  private avaIdExists(avaId: string): boolean {
    const allPatients = this.getAllPatients();
    return allPatients.some(p => p.patientAvaId === avaId);
  }
  
  /**
   * Register new patient
   */
  async registerPatient(registration: PatientRegistration): Promise<Patient> {
    // Generate unique IDs
    const internalId = this.generateInternalId();
    const patientAvaId = this.generateAvaId();
    
    // Create patient object
    const patient: Patient = {
      internalId,
      patientAvaId,
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email.toLowerCase(),
      phone: registration.phone,
      dateOfBirth: registration.dateOfBirth,
      createdAt: new Date().toISOString(),
      isActive: true,
      hasCompletedOnboarding: false,
      programs: {
        pumpdrive: {
          enrolled: registration.program === 'pumpdrive' || registration.program === 'both'
        },
        weightloss: {
          enrolled: registration.program === 'weightloss' || registration.program === 'both'
        }
      },
      preferences: {
        communicationMethod: 'email',
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
    
    // Save to storage (in production, this would be a database call)
    this.savePatient(patient);
    
    // Send welcome email with AVA ID
    await this.sendWelcomeEmail(patient);
    
    return patient;
  }
  
  /**
   * Patient login with AVA ID
   */
  async loginWithAvaId(login: PatientLogin): Promise<{ patient: Patient; session: PatientSession }> {
    let patient: Patient | null = null;
    
    // Try login with AVA ID
    if (login.avaId) {
      const formattedAvaId = this.formatAvaId(login.avaId);
      patient = this.getPatientByAvaId(formattedAvaId);
    }
    
    // Fallback to email if provided
    if (!patient && login.email) {
      patient = this.getPatientByEmail(login.email.toLowerCase());
    }
    
    if (!patient) {
      throw new Error('Invalid login credentials');
    }
    
    // Update last login
    patient.lastLogin = new Date().toISOString();
    this.savePatient(patient);
    
    // Create session
    const session = this.createSession(patient);
    
    return { patient, session };
  }
  
  /**
   * Format AVA ID to ensure consistent format
   */
  private formatAvaId(input: string): string {
    // Remove all non-alphanumeric characters
    const cleaned = input.replace(/[^A-Z0-9]/gi, '');
    
    // Check if it starts with AVA
    if (!cleaned.toUpperCase().startsWith('AVA')) {
      throw new Error('Invalid AVA ID format');
    }
    
    // Extract numbers after AVA
    const numbers = cleaned.substring(3);
    if (numbers.length !== 6) {
      throw new Error('Invalid AVA ID format');
    }
    
    // Format as AVA ###-###
    return `AVA ${numbers.substring(0, 3)}-${numbers.substring(3, 6)}`;
  }
  
  /**
   * Create patient session
   */
  private createSession(patient: Patient): PatientSession {
    const session: PatientSession = {
      sessionId: this.generateSessionId(),
      patientAvaId: patient.patientAvaId,
      internalId: patient.internalId,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      isActive: true,
      deviceInfo: {
        userAgent: navigator.userAgent
      }
    };
    
    // Save to session storage
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    
    return session;
  }
  
  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * Get current session
   */
  getCurrentSession(): PatientSession | null {
    const stored = sessionStorage.getItem(this.SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        logError('patient', 'Error message', {});
      }
    }
    return null;
  }
  
  /**
   * Get current logged-in patient
   */
  getCurrentPatient(): Patient | null {
    const session = this.getCurrentSession();
    if (session) {
      return this.getPatientByInternalId(session.internalId);
    }
    return null;
  }
  
  /**
   * Logout current patient
   */
  logout(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
  }
  
  /**
   * Save patient to storage
   */
  private savePatient(patient: Patient): void {
    // Save by internal ID
    localStorage.setItem(
      `${this.STORAGE_PREFIX}id_${patient.internalId}`,
      JSON.stringify(patient)
    );
    
    // Also save lookup by AVA ID
    localStorage.setItem(
      `${this.STORAGE_PREFIX}ava_${patient.patientAvaId.replace(/\s/g, '_')}`,
      patient.internalId
    );
    
    // Save lookup by email
    localStorage.setItem(
      `${this.STORAGE_PREFIX}email_${patient.email}`,
      patient.internalId
    );
    
    // Update patient index
    this.updatePatientIndex(patient.internalId);
  }
  
  /**
   * Update patient index
   */
  private updatePatientIndex(internalId: string): void {
    const indexKey = `${this.STORAGE_PREFIX}index`;
    const stored = localStorage.getItem(indexKey);
    let index: string[] = [];
    
    if (stored) {
      try {
        index = JSON.parse(stored);
      } catch (e) {
        logError('patient', 'Error message', {});
      }
    }
    
    if (!index.includes(internalId)) {
      index.push(internalId);
      localStorage.setItem(indexKey, JSON.stringify(index));
    }
  }
  
  /**
   * Get patient by internal ID
   */
  getPatientByInternalId(internalId: string): Patient | null {
    const stored = localStorage.getItem(`${this.STORAGE_PREFIX}id_${internalId}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        logError('patient', 'Error message', {});
      }
    }
    return null;
  }
  
  /**
   * Get patient by AVA ID
   */
  getPatientByAvaId(avaId: string): Patient | null {
    const lookupKey = `${this.STORAGE_PREFIX}ava_${avaId.replace(/\s/g, '_')}`;
    const internalId = localStorage.getItem(lookupKey);
    
    if (internalId) {
      return this.getPatientByInternalId(internalId);
    }
    return null;
  }
  
  /**
   * Get patient by email
   */
  getPatientByEmail(email: string): Patient | null {
    const lookupKey = `${this.STORAGE_PREFIX}email_${email.toLowerCase()}`;
    const internalId = localStorage.getItem(lookupKey);
    
    if (internalId) {
      return this.getPatientByInternalId(internalId);
    }
    return null;
  }
  
  /**
   * Get all patients (for admin use)
   */
  getAllPatients(): Patient[] {
    const indexKey = `${this.STORAGE_PREFIX}index`;
    const stored = localStorage.getItem(indexKey);
    
    if (!stored) return [];
    
    try {
      const index: string[] = JSON.parse(stored);
      return index
        .map(id => this.getPatientByInternalId(id))
        .filter(p => p !== null) as Patient[];
    } catch (e) {
      logError('patient', 'Error message', {});
      return [];
    }
  }
  
  /**
   * Update patient program data
   */
  updatePatientProgram(
    internalId: string,
    program: 'pumpdrive' | 'weightloss',
    data: any
  ): Patient | null {
    const patient = this.getPatientByInternalId(internalId);
    if (!patient) return null;
    
    if (!patient.programs[program]) {
      patient.programs[program] = { enrolled: true } as any;
    }
    
    patient.programs[program] = {
      ...patient.programs[program],
      ...data
    };
    
    this.savePatient(patient);
    return patient;
  }
  
  /**
   * Save pump recommendations for patient
   */
  savePumpRecommendations(
    internalId: string,
    recommendations: PumpRecommendation[]
  ): void {
    const patient = this.getPatientByInternalId(internalId);
    if (!patient) return;
    
    if (!patient.programs.pumpdrive) {
      patient.programs.pumpdrive = { enrolled: true };
    }
    
    patient.programs.pumpdrive.finalRecommendations = recommendations;
    patient.programs.pumpdrive.lastActivity = new Date().toISOString();
    
    this.savePatient(patient);
  }
  
  /**
   * Save personalized report for patient
   */
  savePersonalizedReport(
    internalId: string,
    report: PersonalizedReport
  ): void {
    const patient = this.getPatientByInternalId(internalId);
    if (!patient) return;
    
    if (!patient.programs.pumpdrive) {
      patient.programs.pumpdrive = { enrolled: true };
    }
    
    patient.programs.pumpdrive.personalReport = report;
    patient.programs.pumpdrive.lastActivity = new Date().toISOString();
    
    this.savePatient(patient);
  }
  
  /**
   * Send welcome email with AVA ID
   */
  private async sendWelcomeEmail(patient: Patient): Promise<void> {
    // In production, this would call an email service
    logDebug('patient', 'Debug message', {});
  }
}

export const patientService = new PatientService();