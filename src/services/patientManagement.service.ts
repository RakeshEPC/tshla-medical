import { logError, logWarn, logInfo, logDebug } from './logger.service';
/**
 * Patient Management Service
 * Handles patient CRUD operations and visit history
 */

export interface ChronicCondition {
  name: string;
  icd10Code: string;
  summary: string;
  lastUpdated: string;
  trend: 'improving' | 'stable' | 'worsening' | 'new';
  keyMetrics: Record<string, any>;
  timeline: {
    date: string;
    event: string;
    value?: string;
  }[];
}

export interface PortalData {
  questionnaires: {
    type: 'PHQ-9' | 'GAD-7' | 'custom';
    score?: number;
    responses: any[];
    completedAt: string;
  }[];
  symptoms: string[];
  concerns: string[];
  medications: {
    name: string;
    adherence: 'always' | 'usually' | 'sometimes' | 'rarely';
    sideEffects?: string[];
  }[];
  vitalLogs?: {
    date: string;
    bloodGlucose?: string;
    bloodPressure?: string;
    weight?: string;
  }[];
  lastUpdated: string;
}

export interface Visit {
  id: string;
  date: string;
  type: 'new-patient' | 'follow-up' | 'urgent' | 'telehealth';
  chiefComplaint?: string;
  notes: {
    raw: string; // Original dictation
    processed: string; // AI processed note
    merged?: string; // Super note with history
    emrImport?: string; // Pasted EMR note
  };
  diagnoses?: string[];
  procedures?: string[];
  followUpDate?: string;
}

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  email?: string;
  phone?: string;
  dob: string;

  // Demographics
  gender?: 'male' | 'female' | 'other';
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };

  // Medical Information
  diagnoses: string[];
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    indication: string;
    startDate?: string;
    prescribedBy?: string;
  }[];
  allergies: {
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
  }[];

  // Visit History
  visits: Visit[];
  lastVisitSummary?: string;
  nextAppointment?: string;

  // Chronic Disease Management
  chronicConditions: Record<string, ChronicCondition>;

  // Patient Portal Data
  portalData?: PortalData;

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastAccessedBy?: string;
}

class PatientManagementService {
  private readonly STORAGE_KEY = 'patient_database';
  private patients: Map<string, Patient> = new Map();

  constructor() {
    this.loadPatients();
  }

  /**
   * Load patients from localStorage
   */
  private loadPatients(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.patients = new Map(Object.entries(data));
      } catch (e) {
        logError('patientManagement', 'Error message', {});
        this.patients = new Map();
      }
    }
  }

  /**
   * Save patients to localStorage
   */
  private savePatients(): void {
    const data = Object.fromEntries(this.patients);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Create a new patient
   */
  createPatient(patientData: Partial<Patient>): Patient {
    const patient: Patient = {
      id: patientData.id || `pt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      mrn: patientData.mrn || `MRN${Date.now()}`,
      name: patientData.name || '',
      email: patientData.email,
      phone: patientData.phone,
      dob: patientData.dob || '',
      diagnoses: patientData.diagnoses || [],
      medications: patientData.medications || [],
      allergies: patientData.allergies || [],
      visits: patientData.visits || [],
      chronicConditions: patientData.chronicConditions || {},
      portalData: patientData.portalData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.patients.set(patient.id, patient);
    this.savePatients();
    return patient;
  }

  /**
   * Get patient by ID
   */
  getPatient(patientId: string): Patient | null {
    return this.patients.get(patientId) || null;
  }

  /**
   * Get patient by MRN
   */
  getPatientByMRN(mrn: string): Patient | null {
    for (const patient of this.patients.values()) {
      if (patient.mrn === mrn) {
        return patient;
      }
    }
    return null;
  }

  /**
   * Update patient
   */
  updatePatient(patientId: string, updates: Partial<Patient>): Patient | null {
    const patient = this.patients.get(patientId);
    if (!patient) return null;

    const updated: Patient = {
      ...patient,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.patients.set(patientId, updated);
    this.savePatients();
    return updated;
  }

  /**
   * Add visit to patient
   */
  addVisit(patientId: string, visit: Omit<Visit, 'id'>): Visit | null {
    const patient = this.patients.get(patientId);
    if (!patient) return null;

    const newVisit: Visit = {
      ...visit,
      id: `visit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    patient.visits.push(newVisit);
    patient.lastVisitSummary = this.generateVisitSummary(newVisit);
    patient.updatedAt = new Date().toISOString();

    // Update chronic conditions if applicable
    this.updateChronicConditions(patient, newVisit);

    this.patients.set(patientId, patient);
    this.savePatients();
    return newVisit;
  }

  /**
   * Get last visit for patient
   */
  getLastVisit(patientId: string): Visit | null {
    const patient = this.patients.get(patientId);
    if (!patient || patient.visits.length === 0) return null;

    return patient.visits.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
  }

  /**
   * Update chronic conditions based on visit
   */
  private updateChronicConditions(patient: Patient, visit: Visit): void {
    // Extract conditions from diagnoses and notes
    if (visit.diagnoses) {
      visit.diagnoses.forEach(diagnosis => {
        const conditionKey = this.normalizeConditionName(diagnosis);

        if (!patient.chronicConditions[conditionKey]) {
          patient.chronicConditions[conditionKey] = {
            name: diagnosis,
            icd10Code: this.getICD10Code(diagnosis),
            summary: `First diagnosed on ${visit.date}`,
            lastUpdated: visit.date,
            trend: 'new',
            keyMetrics: {},
            timeline: [
              {
                date: visit.date,
                event: 'Initial diagnosis',
              },
            ],
          };
        } else {
          // Update existing condition
          const condition = patient.chronicConditions[conditionKey];
          condition.lastUpdated = visit.date;
          condition.timeline.push({
            date: visit.date,
            event: 'Follow-up visit',
          });

          // Analyze trend based on notes
          if (visit.notes.processed) {
            condition.trend = this.analyzeTrend(visit.notes.processed);
          }
        }
      });
    }
  }

  /**
   * Generate visit summary
   */
  private generateVisitSummary(visit: Visit): string {
    const summaryParts = [];

    if (visit.type) {
      summaryParts.push(`${visit.type.replace('-', ' ')} visit on ${visit.date}`);
    }

    if (visit.chiefComplaint) {
      summaryParts.push(`Chief complaint: ${visit.chiefComplaint}`);
    }

    if (visit.diagnoses && visit.diagnoses.length > 0) {
      summaryParts.push(`Diagnoses: ${visit.diagnoses.join(', ')}`);
    }

    if (visit.followUpDate) {
      summaryParts.push(`Follow-up scheduled: ${visit.followUpDate}`);
    }

    return summaryParts.join('. ');
  }

  /**
   * Normalize condition name for consistent tracking
   */
  private normalizeConditionName(diagnosis: string): string {
    return diagnosis
      .toLowerCase()
      .replace(/type\s+[12]/gi, 'diabetes')
      .replace(/mellitus/gi, '')
      .replace(/disorder/gi, '')
      .trim()
      .replace(/\s+/g, '_');
  }

  /**
   * Get ICD-10 code for diagnosis (simplified)
   */
  private getICD10Code(diagnosis: string): string {
    const icd10Map: Record<string, string> = {
      diabetes: 'E11.9',
      hypertension: 'I10',
      depression: 'F32.9',
      anxiety: 'F41.9',
      hypothyroidism: 'E03.9',
      asthma: 'J45.909',
    };

    const normalized = diagnosis.toLowerCase();
    for (const [key, code] of Object.entries(icd10Map)) {
      if (normalized.includes(key)) {
        return code;
      }
    }

    return 'R69'; // Unknown diagnosis
  }

  /**
   * Analyze trend from note text
   */
  private analyzeTrend(noteText: string): 'improving' | 'stable' | 'worsening' {
    const improvingKeywords = ['improved', 'better', 'resolved', 'decreased', 'controlled'];
    const worseningKeywords = ['worsened', 'worse', 'increased', 'uncontrolled', 'deteriorated'];

    const lowerNote = noteText.toLowerCase();

    const improvingCount = improvingKeywords.filter(k => lowerNote.includes(k)).length;
    const worseningCount = worseningKeywords.filter(k => lowerNote.includes(k)).length;

    if (improvingCount > worseningCount) return 'improving';
    if (worseningCount > improvingCount) return 'worsening';
    return 'stable';
  }

  /**
   * Search patients
   */
  searchPatients(query: string): Patient[] {
    const results: Patient[] = [];
    const lowerQuery = query.toLowerCase();

    for (const patient of this.patients.values()) {
      if (
        patient.name.toLowerCase().includes(lowerQuery) ||
        patient.mrn.toLowerCase().includes(lowerQuery) ||
        patient.email?.toLowerCase().includes(lowerQuery)
      ) {
        results.push(patient);
      }
    }

    return results;
  }

  /**
   * Get all patients
   */
  getAllPatients(): Patient[] {
    return Array.from(this.patients.values());
  }

  /**
   * Import portal data for patient
   */
  importPortalData(patientId: string, portalData: PortalData): boolean {
    const patient = this.patients.get(patientId);
    if (!patient) return false;

    patient.portalData = portalData;
    patient.updatedAt = new Date().toISOString();

    this.patients.set(patientId, patient);
    this.savePatients();
    return true;
  }

  /**
   * Merge notes with history
   */
  mergeNotesWithHistory(currentDictation: string, previousNote: string, patient: Patient): string {
    const chronicSummaries = Object.values(patient.chronicConditions)
      .map(
        condition => `
### ${condition.name} (Trend: ${condition.trend})
${condition.summary}
Recent Timeline:
${condition.timeline
  .slice(-3)
  .map(t => `- ${t.date}: ${t.event}`)
  .join('\n')}
      `
      )
      .join('\n');

    const portalSummary = patient.portalData
      ? `
### Patient-Reported Data (${patient.portalData.lastUpdated})
Symptoms: ${patient.portalData.symptoms.join(', ')}
Concerns: ${patient.portalData.concerns.join(', ')}
${patient.portalData.questionnaires.map(q => `${q.type} Score: ${q.score}`).join(', ')}
    `
      : '';

    return `
## COMPREHENSIVE CLINICAL NOTE

### CURRENT VISIT
${currentDictation}

### HISTORICAL CONTEXT
${previousNote}

### CHRONIC CONDITION TRACKING
${chronicSummaries}

${portalSummary}

### CONTINUITY OF CARE
Based on the above information, this visit represents a continuation of care with focus on:
- Monitoring chronic conditions
- Addressing new concerns while maintaining treatment continuity
- Adjusting treatment plans based on trends and patient-reported outcomes
    `.trim();
  }
}

// Export singleton instance
export const patientManagementService = new PatientManagementService();
