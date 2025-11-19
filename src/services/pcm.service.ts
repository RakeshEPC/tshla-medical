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
   * Patient Goals
   */
  async getPatientGoals(patientId: string): Promise<any[]> {
    // In production, this would pull from the enrollment data + current vitals
    const patient = await this.getPCMPatient(patientId);
    const latestVitals = await this.getLatestVitals(patientId);

    if (!patient) {
      // Return demo goals (icons will be added in the component)
      return [
        {
          id: 'goal-a1c',
          category: 'a1c',
          name: 'Hemoglobin A1C',
          current: 8.2,
          target: 7.0,
          unit: '%',
          status: 'needs-attention',
          progress: 60,
          trend: 'improving',
          lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          color: 'bg-red-100'
        },
        {
          id: 'goal-bp',
          category: 'bp',
          name: 'Blood Pressure',
          current: '135/82',
          target: '130/80',
          unit: 'mmHg',
          status: 'on-track',
          progress: 85,
          trend: 'stable',
          lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          color: 'bg-orange-100'
        },
        {
          id: 'goal-weight',
          category: 'weight',
          name: 'Weight Management',
          current: 175,
          target: 165,
          unit: 'lbs',
          status: 'on-track',
          progress: 70,
          trend: 'improving',
          lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          color: 'bg-green-100'
        },
        {
          id: 'goal-medication',
          category: 'medication',
          name: 'Medication Adherence',
          current: 85,
          target: 95,
          unit: '%',
          status: 'on-track',
          progress: 90,
          trend: 'improving',
          lastUpdated: new Date().toISOString(),
          color: 'bg-blue-100'
        }
      ];
    }

    // Build goals from patient data
    const goals = [];

    // A1C Goal
    if (patient.currentA1C && patient.targetA1C) {
      const progress = Math.min(100, Math.max(0, 100 - ((patient.currentA1C - patient.targetA1C) / patient.targetA1C) * 100));
      goals.push({
        id: 'goal-a1c',
        category: 'a1c',
        name: 'Hemoglobin A1C',
        current: patient.currentA1C,
        target: patient.targetA1C,
        unit: '%',
        status: patient.currentA1C <= patient.targetA1C ? 'achieved' : patient.currentA1C <= patient.targetA1C + 1 ? 'on-track' : 'needs-attention',
        progress,
        trend: 'improving',
        lastUpdated: new Date().toISOString(),
        color: 'bg-red-100'
      });
    }

    return goals;
  }

  /**
   * Patient Profile Management
   */
  async getPatientProfile(patientId: string): Promise<any | null> {
    const key = `${this.STORAGE_PREFIX}profile_${patientId}`;
    return this.getFromStorage<any>(key);
  }

  async updatePatientProfile(patientId: string, profile: any): Promise<void> {
    const key = `${this.STORAGE_PREFIX}profile_${patientId}`;
    this.saveToStorage(key, profile);
  }

  /**
   * Messaging System
   */
  async getMessageThreads(patientId: string): Promise<any[]> {
    const key = `${this.STORAGE_PREFIX}threads_${patientId}`;
    const threads = this.getFromStorage<any[]>(key);

    if (!threads || threads.length === 0) {
      // Return demo threads
      return [
        {
          id: 'thread-001',
          subject: 'Question about my medication',
          category: 'question',
          lastMessage: 'Thank you! That makes sense now.',
          lastMessageTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          unreadCount: 0,
          status: 'resolved'
        },
        {
          id: 'thread-002',
          subject: 'Blood sugar readings are high',
          category: 'concern',
          lastMessage: 'I will try the adjustments you suggested and report back.',
          lastMessageTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          unreadCount: 1,
          status: 'active'
        }
      ];
    }

    return threads;
  }

  async getMessages(threadId: string): Promise<any[]> {
    const key = `${this.STORAGE_PREFIX}messages_${threadId}`;
    const messages = this.getFromStorage<any[]>(key);

    if (!messages || messages.length === 0) {
      // Return demo messages
      if (threadId === 'thread-001') {
        return [
          {
            id: 'msg-001',
            threadId,
            from: 'patient',
            senderName: 'Jane Smith',
            content: 'I noticed my medication bottle says to take with food, but my doctor said to take it in the morning. Should I take it with breakfast?',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: 'msg-002',
            threadId,
            from: 'staff',
            senderName: 'Nurse Williams',
            content: 'Great question! Yes, you should take it with breakfast. Taking it with food helps reduce stomach upset and improves absorption. Make sure to eat something substantial, not just a light snack.',
            timestamp: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: 'msg-003',
            threadId,
            from: 'patient',
            senderName: 'Jane Smith',
            content: 'Thank you! That makes sense now.',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            read: true
          }
        ];
      }
      return [];
    }

    return messages;
  }

  async sendMessage(threadId: string, message: { from: string; content: string }): Promise<void> {
    const key = `${this.STORAGE_PREFIX}messages_${threadId}`;
    const messages = this.getFromStorage<any[]>(key) || [];

    const newMessage = {
      id: this.generateId(),
      threadId,
      from: message.from,
      senderName: message.from === 'patient' ? 'Jane Smith' : 'Care Team',
      content: message.content,
      timestamp: new Date().toISOString(),
      read: message.from === 'patient'
    };

    messages.push(newMessage);
    this.saveToStorage(key, messages);

    // Update thread
    await this.updateThreadLastMessage(threadId, message.content);
  }

  async createMessageThread(patientId: string, data: { subject: string; category: string; initialMessage: string }): Promise<string> {
    const threadId = this.generateId();

    // Create thread
    const threadsKey = `${this.STORAGE_PREFIX}threads_${patientId}`;
    const threads = this.getFromStorage<any[]>(threadsKey) || [];

    const newThread = {
      id: threadId,
      subject: data.subject,
      category: data.category,
      lastMessage: data.initialMessage,
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      status: 'active'
    };

    threads.unshift(newThread);
    this.saveToStorage(threadsKey, threads);

    // Create initial message
    await this.sendMessage(threadId, { from: 'patient', content: data.initialMessage });

    return threadId;
  }

  async markThreadAsRead(threadId: string): Promise<void> {
    // Find patient ID from thread - in production this would be a proper query
    const allKeys = Object.keys(localStorage).filter(k => k.includes('threads_'));

    for (const key of allKeys) {
      const threads = this.getFromStorage<any[]>(key) || [];
      const thread = threads.find(t => t.id === threadId);

      if (thread) {
        thread.unreadCount = 0;
        this.saveToStorage(key, threads);
        break;
      }
    }
  }

  async resolveThread(threadId: string): Promise<void> {
    const allKeys = Object.keys(localStorage).filter(k => k.includes('threads_'));

    for (const key of allKeys) {
      const threads = this.getFromStorage<any[]>(key) || [];
      const thread = threads.find(t => t.id === threadId);

      if (thread) {
        thread.status = 'resolved';
        this.saveToStorage(key, threads);
        break;
      }
    }
  }

  private async updateThreadLastMessage(threadId: string, message: string): Promise<void> {
    const allKeys = Object.keys(localStorage).filter(k => k.includes('threads_'));

    for (const key of allKeys) {
      const threads = this.getFromStorage<any[]>(key) || [];
      const thread = threads.find(t => t.id === threadId);

      if (thread) {
        thread.lastMessage = message;
        thread.lastMessageTime = new Date().toISOString();
        this.saveToStorage(key, threads);
        break;
      }
    }
  }

  /**
   * Lab Management System
   */
  async orderLabs(patientId: string, labData: {
    tests: string[];
    dueDate: string;
    priority?: 'routine' | 'urgent' | 'stat';
    panelType?: string;
    notes?: string;
    orderedBy: string;
  }): Promise<any> {
    const order = {
      id: this.generateId(),
      patientId,
      orderedBy: labData.orderedBy,
      orderDate: new Date().toISOString(),
      dueDate: labData.dueDate,
      status: 'pending',
      labsRequested: labData.tests,
      priority: labData.priority || 'routine',
      panelType: labData.panelType,
      notes: labData.notes
    };

    const key = `${this.STORAGE_PREFIX}lab_orders`;
    const orders = this.getFromStorage<any[]>(key) || [];
    orders.unshift(order);
    this.saveToStorage(key, orders);

    return order;
  }

  async getLabOrders(patientId?: string, status?: string): Promise<any[]> {
    const key = `${this.STORAGE_PREFIX}lab_orders`;
    let orders = this.getFromStorage<any[]>(key) || this.getDemoLabOrders();

    if (patientId) {
      orders = orders.filter(o => o.patientId === patientId);
    }

    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    return orders;
  }

  async addLabResults(orderId: string, results: Array<{
    testName: string;
    resultValue: string;
    resultNumeric?: number;
    unit?: string;
    referenceRange?: string;
    abnormalFlag?: boolean;
  }>): Promise<void> {
    const resultsKey = `${this.STORAGE_PREFIX}lab_results`;
    const existingResults = this.getFromStorage<any[]>(resultsKey) || [];

    results.forEach(result => {
      existingResults.push({
        id: this.generateId(),
        labOrderId: orderId,
        ...result,
        resultDate: new Date().toISOString(),
        status: 'final'
      });
    });

    this.saveToStorage(resultsKey, existingResults);

    // Update order status
    const ordersKey = `${this.STORAGE_PREFIX}lab_orders`;
    const orders = this.getFromStorage<any[]>(ordersKey) || [];
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = 'completed';
      this.saveToStorage(ordersKey, orders);
    }
  }

  async getLabResults(patientId: string, testName?: string, limit: number = 10): Promise<any[]> {
    const key = `${this.STORAGE_PREFIX}lab_results`;
    let results = this.getFromStorage<any[]>(key) || this.getDemoLabResults(patientId);

    // Filter by patient through orders
    const orders = await this.getLabOrders(patientId);
    const orderIds = orders.map(o => o.id);
    results = results.filter(r => orderIds.includes(r.labOrderId));

    if (testName) {
      results = results.filter(r => r.testName === testName);
    }

    return results.slice(0, limit);
  }

  async getLabTrends(patientId: string, testName: string, duration: number = 12): Promise<any[]> {
    const results = await this.getLabResults(patientId, testName, 100);

    // Filter to last X months
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - duration);

    return results
      .filter(r => new Date(r.resultDate) >= cutoffDate)
      .sort((a, b) => new Date(a.resultDate).getTime() - new Date(b.resultDate).getTime());
  }

  async getLabSchedule(patientId: string): Promise<any[]> {
    const key = `${this.STORAGE_PREFIX}lab_schedules_${patientId}`;
    return this.getFromStorage<any[]>(key) || this.getDemoLabSchedule(patientId);
  }

  async updateLabSchedule(patientId: string, schedules: Array<{
    testName: string;
    panelType?: string;
    frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual';
    nextDueDate: string;
  }>): Promise<void> {
    const key = `${this.STORAGE_PREFIX}lab_schedules_${patientId}`;
    const scheduleData = schedules.map(s => ({
      id: this.generateId(),
      patientId,
      ...s,
      enabled: true
    }));
    this.saveToStorage(key, scheduleData);
  }

  /**
   * Demo Lab Data
   */
  private getDemoLabOrders(): any[] {
    return [
      {
        id: 'order-001',
        patientId: 'demo-patient-001',
        orderedBy: 'provider-001',
        orderDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        labsRequested: ['Hemoglobin A1C', 'Comprehensive Metabolic Panel', 'Lipid Panel'],
        priority: 'routine',
        panelType: 'diabetes_quarterly'
      },
      {
        id: 'order-002',
        patientId: 'demo-patient-001',
        orderedBy: 'provider-001',
        orderDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() - 83 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'completed',
        labsRequested: ['Hemoglobin A1C', 'Lipid Panel'],
        priority: 'routine',
        panelType: 'diabetes_quarterly'
      }
    ];
  }

  private getDemoLabResults(patientId: string): any[] {
    return [
      {
        id: 'result-001',
        labOrderId: 'order-002',
        testName: 'Hemoglobin A1C',
        resultValue: '8.2',
        resultNumeric: 8.2,
        unit: '%',
        referenceRange: '<7.0',
        abnormalFlag: true,
        resultDate: new Date(Date.now() - 83 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'final'
      },
      {
        id: 'result-002',
        labOrderId: 'order-002',
        testName: 'LDL Cholesterol',
        resultValue: '145',
        resultNumeric: 145,
        unit: 'mg/dL',
        referenceRange: '<100',
        abnormalFlag: true,
        resultDate: new Date(Date.now() - 83 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'final'
      },
      {
        id: 'result-003',
        labOrderId: 'order-002',
        testName: 'HDL Cholesterol',
        resultValue: '42',
        resultNumeric: 42,
        unit: 'mg/dL',
        referenceRange: '>40',
        abnormalFlag: false,
        resultDate: new Date(Date.now() - 83 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'final'
      }
    ];
  }

  private getDemoLabSchedule(patientId: string): any[] {
    return [
      {
        id: 'schedule-001',
        patientId,
        testName: 'Hemoglobin A1C',
        panelType: 'diabetes_quarterly',
        frequency: 'quarterly',
        lastCompletedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        enabled: true
      },
      {
        id: 'schedule-002',
        patientId,
        testName: 'Lipid Panel',
        panelType: 'diabetes_quarterly',
        frequency: 'quarterly',
        lastCompletedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        enabled: true
      },
      {
        id: 'schedule-003',
        patientId,
        testName: 'TSH',
        panelType: 'diabetes_annual',
        frequency: 'annual',
        lastCompletedDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        enabled: true
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
