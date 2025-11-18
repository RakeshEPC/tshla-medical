/**
 * PCM (Principal Care Management) Service
 * Handles all PCM-related data operations
 * Created: 2025-01-18
 */

import type { PCMPatient } from '../components/pcm/PatientRiskCard';

export interface VitalReading {
  id: string;
  patientId: string;
  readingDate: string;
  bloodSugar?: number;
  weight?: number;
  systolic?: number;
  diastolic?: number;
  notes?: string;
  recordedBy: 'patient' | 'staff';
}

export interface PatientTask {
  id: string;
  patientId: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  completedDate?: string;
  category: 'vitals' | 'medication' | 'exercise' | 'nutrition' | 'screening' | 'other';
}

export interface TimeEntry {
  id: string;
  patientId: string;
  patientName: string;
  staffId: string;
  staffName: string;
  activityType: 'phone_call' | 'care_coordination' | 'med_review' | 'lab_review' | 'documentation' | 'other';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes: string;
  month: string; // YYYY-MM format
}

class PCMService {
  private readonly STORAGE_PREFIX = 'pcm_';

  /**
   * Patient Vital Tracking
   */
  async logVitals(patientId: string, vitals: Omit<VitalReading, 'id' | 'patientId' | 'readingDate' | 'recordedBy'>): Promise<VitalReading> {
    // In production, this would be a Supabase call
    const reading: VitalReading = {
      id: this.generateId(),
      patientId,
      readingDate: new Date().toISOString(),
      recordedBy: 'patient',
      ...vitals
    };

    // Store in localStorage for demo
    const key = `${this.STORAGE_PREFIX}vitals_${patientId}`;
    const existing = this.getFromStorage<VitalReading[]>(key) || [];
    existing.unshift(reading);
    this.saveToStorage(key, existing.slice(0, 100)); // Keep last 100 readings

    return reading;
  }

  async getPatientVitals(patientId: string, limit: number = 30): Promise<VitalReading[]> {
    const key = `${this.STORAGE_PREFIX}vitals_${patientId}`;
    const vitals = this.getFromStorage<VitalReading[]>(key) || [];
    return vitals.slice(0, limit);
  }

  async getLatestVitals(patientId: string): Promise<Partial<VitalReading>> {
    const vitals = await this.getPatientVitals(patientId, 1);
    return vitals[0] || {};
  }

  /**
   * Patient Tasks (Action Items)
   */
  async getPatientTasks(patientId: string): Promise<PatientTask[]> {
    const key = `${this.STORAGE_PREFIX}tasks_${patientId}`;
    return this.getFromStorage<PatientTask[]>(key) || this.getDefaultTasks(patientId);
  }

  async toggleTaskComplete(taskId: string, patientId: string): Promise<void> {
    const key = `${this.STORAGE_PREFIX}tasks_${patientId}`;
    const tasks = this.getFromStorage<PatientTask[]>(key) || [];

    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      task.completedDate = task.completed ? new Date().toISOString() : undefined;
      this.saveToStorage(key, tasks);
    }
  }

  private getDefaultTasks(patientId: string): PatientTask[] {
    return [
      {
        id: this.generateId(),
        patientId,
        title: 'Check blood sugar before breakfast',
        description: 'Target: 80-130 mg/dL fasting',
        frequency: 'daily',
        completed: false,
        category: 'vitals'
      },
      {
        id: this.generateId(),
        patientId,
        title: 'Take all prescribed medications',
        description: 'See medication list for details',
        frequency: 'daily',
        completed: false,
        category: 'medication'
      },
      {
        id: this.generateId(),
        patientId,
        title: 'Exercise for 30 minutes',
        description: 'Walking, swimming, or any physical activity',
        frequency: 'daily',
        completed: false,
        category: 'exercise'
      },
      {
        id: this.generateId(),
        patientId,
        title: 'Log meals and carb intake',
        description: 'Helps identify patterns and make better food choices',
        frequency: 'daily',
        completed: false,
        category: 'nutrition'
      },
      {
        id: this.generateId(),
        patientId,
        title: 'Check feet for any issues',
        description: 'Look for cuts, blisters, redness, or swelling',
        frequency: 'daily',
        completed: false,
        category: 'vitals'
      }
    ];
  }

  /**
   * PCM Time Tracking
   */
  async logTime(entry: Omit<TimeEntry, 'id' | 'month'>): Promise<TimeEntry> {
    const month = new Date(entry.startTime).toISOString().substring(0, 7); // YYYY-MM
    const timeEntry: TimeEntry = {
      ...entry,
      id: this.generateId(),
      month
    };

    const key = `${this.STORAGE_PREFIX}time_${entry.patientId}_${month}`;
    const existing = this.getFromStorage<TimeEntry[]>(key) || [];
    existing.push(timeEntry);
    this.saveToStorage(key, existing);

    return timeEntry;
  }

  async getMonthlyTime(patientId: string, month?: string): Promise<TimeEntry[]> {
    const targetMonth = month || new Date().toISOString().substring(0, 7);
    const key = `${this.STORAGE_PREFIX}time_${patientId}_${targetMonth}`;
    return this.getFromStorage<TimeEntry[]>(key) || [];
  }

  async getTotalMinutesThisMonth(patientId: string): Promise<number> {
    const entries = await this.getMonthlyTime(patientId);
    return entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  }

  /**
   * PCM Patient Management
   */
  async getPCMPatients(): Promise<PCMPatient[]> {
    // In production, this would query Supabase for patients with PCM enrollment
    const key = `${this.STORAGE_PREFIX}patients`;
    const patients = this.getFromStorage<PCMPatient[]>(key);

    if (!patients || patients.length === 0) {
      // Return demo data
      return this.getDemoPatients();
    }

    return patients;
  }

  async getPCMPatient(patientId: string): Promise<PCMPatient | null> {
    const patients = await this.getPCMPatients();
    return patients.find(p => p.id === patientId) || null;
  }

  async updatePatientRiskLevel(patientId: string, riskLevel: PCMPatient['riskLevel']): Promise<void> {
    const key = `${this.STORAGE_PREFIX}patients`;
    const patients = this.getFromStorage<PCMPatient[]>(key) || [];

    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      patient.riskLevel = riskLevel;
      this.saveToStorage(key, patients);
    }
  }

  async logPatientContact(patientId: string, notes: string): Promise<void> {
    const key = `${this.STORAGE_PREFIX}patients`;
    const patients = this.getFromStorage<PCMPatient[]>(key) || [];

    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      patient.lastContact = new Date().toISOString();
      patient.lastCallNotes = notes;
      // Set next contact to 30 days from now
      const nextContact = new Date();
      nextContact.setDate(nextContact.getDate() + 30);
      patient.nextContactDue = nextContact.toISOString();

      this.saveToStorage(key, patients);
    }
  }

  /**
   * Patient Stats for Dashboard
   */
  async getPatientStats(patientId: string) {
    const vitals = await this.getPatientVitals(patientId, 30);
    const tasks = await this.getPatientTasks(patientId);
    const timeEntries = await this.getMonthlyTime(patientId);

    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const totalMinutes = timeEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const meetsTimeRequirement = totalMinutes >= 30;

    return {
      vitalsRecorded: vitals.length,
      taskCompletionRate: Math.round(taskCompletionRate),
      monthlyMinutesLogged: totalMinutes,
      meetsTimeRequirement,
      latestVitals: vitals[0] || null
    };
  }

  /**
   * Demo Data
   */
  private getDemoPatients(): PCMPatient[] {
    return [
      {
        id: 'pcm-001',
        name: 'John Williams',
        age: 68,
        lastContact: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
        nextContactDue: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
        riskLevel: 'high',
        currentA1C: 9.2,
        targetA1C: 7.0,
        currentBP: '152/94',
        targetBP: '130/80',
        currentWeight: 215,
        targetWeight: 190,
        medicationAdherence: 65,
        missedAppointments: 2,
        phone: '(555) 123-4567',
        email: 'john.williams@email.com',
        monthlyMinutesLogged: 18,
        lastCallNotes: 'Patient struggling with medication adherence. Discussed importance of taking meds daily. Will follow up next week.'
      },
      {
        id: 'pcm-002',
        name: 'Maria Garcia',
        age: 55,
        lastContact: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        nextContactDue: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: 'medium',
        currentA1C: 7.8,
        targetA1C: 7.0,
        currentBP: '134/82',
        targetBP: '130/80',
        currentWeight: 168,
        targetWeight: 155,
        medicationAdherence: 85,
        missedAppointments: 0,
        phone: '(555) 234-5678',
        email: 'maria.garcia@email.com',
        monthlyMinutesLogged: 32,
        lastCallNotes: 'Patient making good progress. A1C trending down. Continue current care plan.'
      },
      {
        id: 'pcm-003',
        name: 'Robert Chen',
        age: 72,
        lastContact: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        nextContactDue: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: 'low',
        currentA1C: 6.8,
        targetA1C: 7.0,
        currentBP: '125/78',
        targetBP: '130/80',
        currentWeight: 172,
        targetWeight: 170,
        medicationAdherence: 95,
        missedAppointments: 0,
        phone: '(555) 345-6789',
        email: 'robert.chen@email.com',
        monthlyMinutesLogged: 35,
        lastCallNotes: 'Excellent control. Patient very compliant with care plan. Continue monitoring.'
      },
      {
        id: 'pcm-004',
        name: 'Sarah Johnson',
        age: 61,
        lastContact: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(), // Overdue
        nextContactDue: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days overdue
        riskLevel: 'high',
        currentA1C: 10.1,
        targetA1C: 7.0,
        currentBP: '158/98',
        targetBP: '130/80',
        currentWeight: 198,
        targetWeight: 165,
        medicationAdherence: 55,
        missedAppointments: 3,
        phone: '(555) 456-7890',
        email: 'sarah.johnson@email.com',
        monthlyMinutesLogged: 12,
        lastCallNotes: 'Unable to reach patient. Left voicemail. Need urgent follow-up.'
      },
      {
        id: 'pcm-005',
        name: 'David Martinez',
        age: 59,
        lastContact: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        nextContactDue: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: 'medium',
        currentA1C: 7.4,
        targetA1C: 7.0,
        currentBP: '138/85',
        targetBP: '130/80',
        currentWeight: 185,
        targetWeight: 175,
        medicationAdherence: 78,
        missedAppointments: 1,
        phone: '(555) 567-8901',
        email: 'david.martinez@email.com',
        monthlyMinutesLogged: 28,
        lastCallNotes: 'Patient improving. Discussed diet modifications. Scheduled dietitian consult.'
      }
    ];
  }

  /**
   * Utility Functions
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private getFromStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from storage:', error);
      return null;
    }
  }

  private saveToStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  clearAllData(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
}

export const pcmService = new PCMService();
