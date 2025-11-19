/**
 * PCM AI Call Service
 * Orchestrates weekly AI-powered patient check-in calls
 * Uses ElevenLabs for voice, Deepgram for transcription, OpenAI for analysis
 * Created: 2025-01-18
 */

import { elevenLabsService } from './elevenLabs.service';
import { twilioCallService } from './twilioCall.service';

export interface CallSchedule {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string; // Phone number for outbound calls
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  callTime: string;
  timezone: string;
  enabled: boolean;
  lastCallDate?: string;
  nextCallDate?: string;
  consecutiveMisses: number;
  patientConsentGiven: boolean;
}

export interface CallLog {
  id: string;
  patientId: string;
  patientPhone?: string;
  scheduleId: string;
  callDate: string;
  status: 'completed' | 'missed' | 'failed' | 'in_progress' | 'ringing' | 'no_answer';
  durationSeconds?: number;
  transcript?: string;
  audioUrl?: string;
  callSid?: string; // Twilio call identifier
  answered?: boolean;
  answeredAt?: string;
  errorMessage?: string;
}

export interface CallSummary {
  id: string;
  callLogId: string;
  patientId: string;
  patientName: string;
  summaryText: string;
  extractedMetrics: {
    medicationAdherence: 'yes' | 'no' | 'partial' | 'unknown';
    bloodSugarControl: 'good' | 'fair' | 'poor' | 'unknown';
    newSymptoms: string[];
    emotionalState: 'positive' | 'neutral' | 'concerned' | 'distressed';
    confidenceLevel: number; // 1-10
  };
  flags: string[];
  urgencyLevel: 'routine' | 'moderate' | 'urgent' | 'emergency';
  reviewed: boolean;
  reviewedBy?: string;
  reviewedDate?: string;
  sentiment: string;
  confidenceScore: number;
  actionItems: string[];
  callDate: string;
}

export interface ProviderResponse {
  id: string;
  summaryId: string;
  patientId: string;
  patientPhone?: string;
  providerId: string;
  providerName: string;
  responseType: 'encouraging' | 'instructional' | 'urgent_callback' | 'emergency';
  responseText: string;
  audioUrl?: string;
  deliveryMethod?: 'phone_call' | 'sms' | 'app_notification';
  deliveryStatus?: 'pending' | 'ringing' | 'delivered' | 'failed' | 'no_answer';
  callSid?: string; // Twilio call identifier
  callAnswered?: boolean;
  callAnsweredAt?: string;
  callDuration?: number;
  sentDate: string;
  patientViewed: boolean;
  patientViewedDate?: string;
}

const CALL_SCRIPT_TEMPLATES = {
  diabetes_weekly: {
    greeting: "Hi {name}, this is your weekly diabetes check-in from TSHLA Medical. This will only take a minute. How have you been feeling this week?",
    questions: [
      "Have you been taking your diabetes medications as prescribed?",
      "What have your blood sugar readings been like?",
      "Any new symptoms or concerns you'd like to share?",
      "How confident do you feel about managing your diabetes right now, on a scale of 1 to 10?"
    ],
    closing: "Thank you for sharing. Your care team will review this and may reach out if needed. Have a great day!"
  }
};

const RESPONSE_TEMPLATES = {
  encouraging: [
    "Great job this week! Your dedication to managing your diabetes is paying off. Keep up the excellent work!",
    "You're doing wonderfully! Your progress is exactly what we want to see. Continue with your current plan.",
    "Fantastic work! Your commitment to your health is inspiring. Stay the course!"
  ],
  instructional: [
    "I noticed you're having some trouble with {issue}. Let's adjust your plan. {instruction}",
    "Your numbers show we need to make a small change. {instruction}. Please call if you have questions.",
    "Based on your check-in, I recommend {instruction}. This should help improve your control."
  ],
  urgent_callback: [
    "I reviewed your check-in and would like to discuss {concern} with you. Please call the office today at your earliest convenience.",
    "Your recent update has me concerned about {concern}. Let's talk today. Please call the office.",
    "I need to speak with you about {concern}. This is important. Please call us today."
  ],
  emergency: [
    "Based on your symptoms, you should seek medical attention immediately. If this is an emergency, call 911."
  ]
};

class PCMAICallService {
  private readonly STORAGE_PREFIX = 'pcm_call_';

  /**
   * Schedule Management
   */
  async getCallSchedules(patientId?: string): Promise<CallSchedule[]> {
    const key = `${this.STORAGE_PREFIX}schedules`;
    let schedules = this.getFromStorage<CallSchedule[]>(key) || this.getDemoSchedules();

    if (patientId) {
      schedules = schedules.filter(s => s.patientId === patientId);
    }

    return schedules;
  }

  async createCallSchedule(schedule: Omit<CallSchedule, 'id' | 'consecutiveMisses'>): Promise<CallSchedule> {
    const newSchedule: CallSchedule = {
      ...schedule,
      id: this.generateId(),
      consecutiveMisses: 0
    };

    const key = `${this.STORAGE_PREFIX}schedules`;
    const schedules = this.getFromStorage<CallSchedule[]>(key) || [];
    schedules.push(newSchedule);
    this.saveToStorage(key, schedules);

    return newSchedule;
  }

  async updateCallSchedule(scheduleId: string, updates: Partial<CallSchedule>): Promise<void> {
    const key = `${this.STORAGE_PREFIX}schedules`;
    const schedules = this.getFromStorage<CallSchedule[]>(key) || [];
    const index = schedules.findIndex(s => s.id === scheduleId);

    if (index !== -1) {
      schedules[index] = { ...schedules[index], ...updates };
      this.saveToStorage(key, schedules);
    }
  }

  /**
   * Call Execution
   */
  async initiateCall(scheduleId: string): Promise<CallLog> {
    const schedules = await this.getCallSchedules();
    const schedule = schedules.find(s => s.id === scheduleId);

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Validate phone number
    if (!schedule.patientPhone || !twilioCallService.isValidPhoneNumber(schedule.patientPhone)) {
      throw new Error('Invalid patient phone number');
    }

    const callLog: CallLog = {
      id: this.generateId(),
      patientId: schedule.patientId,
      patientPhone: schedule.patientPhone,
      scheduleId,
      callDate: new Date().toISOString(),
      status: 'in_progress'
    };

    const key = `${this.STORAGE_PREFIX}logs`;
    const logs = this.getFromStorage<CallLog[]>(key) || [];
    logs.push(callLog);
    this.saveToStorage(key, logs);

    // Make actual phone call via Twilio + ElevenLabs
    try {
      const formattedPhone = twilioCallService.formatPhoneNumber(schedule.patientPhone);
      const callResult = await twilioCallService.initiateCheckInCall(
        formattedPhone,
        schedule.patientName,
        'diabetes_weekly'
      );

      // Update call log with Twilio details
      callLog.callSid = callResult.callSid;
      callLog.status = callResult.status === 'failed' ? 'failed' : 'in_progress';
      if (callResult.errorMessage) {
        callLog.errorMessage = callResult.errorMessage;
      }
      this.saveToStorage(key, logs);

      // For demo, simulate completion after delay
      // In production, this would be triggered by Twilio webhook
      setTimeout(() => this.simulateCallCompletion(callLog.id), 2000);
    } catch (error) {
      callLog.status = 'failed';
      callLog.errorMessage = error instanceof Error ? error.message : 'Call failed';
      this.saveToStorage(key, logs);
    }

    return callLog;
  }

  private async simulateCallCompletion(callLogId: string): Promise<void> {
    const key = `${this.STORAGE_PREFIX}logs`;
    const logs = this.getFromStorage<CallLog[]>(key) || [];
    const log = logs.find(l => l.id === callLogId);

    if (log) {
      log.status = 'completed';
      log.durationSeconds = 87;
      log.transcript = "I've been feeling pretty good this week. Yes, I've been taking all my medications on time. My blood sugar has been around 120 to 140, which is better than last week. No new symptoms really, just the usual fatigue. I'd say I'm about a 7 out of 10 on confidence managing my diabetes.";
      this.saveToStorage(key, logs);

      // Generate AI summary
      await this.generateCallSummary(callLogId);
    }
  }

  /**
   * Call Summary Generation
   */
  async generateCallSummary(callLogId: string): Promise<CallSummary> {
    const logs = await this.getCallLogs();
    const log = logs.find(l => l.id === callLogId);

    if (!log || !log.transcript) {
      throw new Error('Call log or transcript not found');
    }

    // In production, use OpenAI/Claude to analyze transcript
    // For demo, create structured summary
    const summary: CallSummary = {
      id: this.generateId(),
      callLogId,
      patientId: log.patientId,
      patientName: 'Jane Smith', // From patient lookup
      summaryText: "Patient reports good adherence to medications and improved blood sugar control (120-140 mg/dL). Experiencing usual fatigue but no new concerning symptoms. Confidence level at 7/10. Overall positive check-in.",
      extractedMetrics: {
        medicationAdherence: 'yes',
        bloodSugarControl: 'good',
        newSymptoms: ['fatigue (chronic)'],
        emotionalState: 'positive',
        confidenceLevel: 7
      },
      flags: [],
      urgencyLevel: 'routine',
      reviewed: false,
      sentiment: 'positive',
      confidenceScore: 0.85,
      actionItems: ['Continue current medication plan', 'Monitor fatigue levels'],
      callDate: log.callDate
    };

    const key = `${this.STORAGE_PREFIX}summaries`;
    const summaries = this.getFromStorage<CallSummary[]>(key) || [];
    summaries.push(summary);
    this.saveToStorage(key, summaries);

    return summary;
  }

  /**
   * Call Logs
   */
  async getCallLogs(patientId?: string, limit: number = 50): Promise<CallLog[]> {
    const key = `${this.STORAGE_PREFIX}logs`;
    let logs = this.getFromStorage<CallLog[]>(key) || [];

    if (patientId) {
      logs = logs.filter(l => l.patientId === patientId);
    }

    return logs.slice(0, limit);
  }

  /**
   * Call Summaries
   */
  async getCallSummaries(filters?: {
    patientId?: string;
    reviewed?: boolean;
    urgencyLevel?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<CallSummary[]> {
    const key = `${this.STORAGE_PREFIX}summaries`;
    let summaries = this.getFromStorage<CallSummary[]>(key) || this.getDemoSummaries();

    if (filters) {
      if (filters.patientId) {
        summaries = summaries.filter(s => s.patientId === filters.patientId);
      }
      if (filters.reviewed !== undefined) {
        summaries = summaries.filter(s => s.reviewed === filters.reviewed);
      }
      if (filters.urgencyLevel) {
        summaries = summaries.filter(s => s.urgencyLevel === filters.urgencyLevel);
      }
      if (filters.dateFrom) {
        summaries = summaries.filter(s => s.callDate >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        summaries = summaries.filter(s => s.callDate <= filters.dateTo!);
      }
    }

    return summaries.sort((a, b) => new Date(b.callDate).getTime() - new Date(a.callDate).getTime());
  }

  async markSummaryReviewed(summaryId: string, reviewedBy: string): Promise<void> {
    const key = `${this.STORAGE_PREFIX}summaries`;
    const summaries = this.getFromStorage<CallSummary[]>(key) || [];
    const summary = summaries.find(s => s.id === summaryId);

    if (summary) {
      summary.reviewed = true;
      summary.reviewedBy = reviewedBy;
      summary.reviewedDate = new Date().toISOString();
      this.saveToStorage(key, summaries);
    }
  }

  /**
   * Provider Responses
   */
  async recordProviderResponse(response: Omit<ProviderResponse, 'id' | 'sentDate' | 'patientViewed'>): Promise<ProviderResponse> {
    const newResponse: ProviderResponse = {
      ...response,
      id: this.generateId(),
      sentDate: new Date().toISOString(),
      patientViewed: false,
      deliveryMethod: response.deliveryMethod || 'phone_call',
      deliveryStatus: 'pending'
    };

    // Generate audio if text provided
    if (response.responseText && !response.audioUrl) {
      try {
        const audio = await elevenLabsService.generateSpeech(response.responseText);
        newResponse.audioUrl = audio.audioUrl;
      } catch (error) {
        console.error('Failed to generate audio:', error);
      }
    }

    const key = `${this.STORAGE_PREFIX}responses`;
    const responses = this.getFromStorage<ProviderResponse[]>(key) || [];
    responses.push(newResponse);
    this.saveToStorage(key, responses);

    // Make actual phone call if delivery method is phone_call
    if (newResponse.deliveryMethod === 'phone_call' && newResponse.patientPhone && newResponse.audioUrl) {
      try {
        const formattedPhone = twilioCallService.formatPhoneNumber(newResponse.patientPhone);
        const callResult = await twilioCallService.makeOutboundCall({
          to: formattedPhone,
          audioUrl: newResponse.audioUrl,
          statusCallback: `${window.location.origin}/api/twilio/status`,
          record: false
        });

        // Update response with call details
        newResponse.callSid = callResult.callSid;
        newResponse.deliveryStatus = callResult.status === 'failed' ? 'failed' :
                                     callResult.status === 'no-answer' ? 'no_answer' :
                                     callResult.status === 'completed' ? 'delivered' : 'ringing';
        if (callResult.status === 'completed') {
          newResponse.callAnswered = true;
          newResponse.callAnsweredAt = callResult.startedAt;
          newResponse.callDuration = callResult.duration;
        }

        this.saveToStorage(key, responses);
      } catch (error) {
        console.error('Failed to make phone call:', error);
        newResponse.deliveryStatus = 'failed';
        this.saveToStorage(key, responses);
      }
    }

    // Mark summary as having response
    const summariesKey = `${this.STORAGE_PREFIX}summaries`;
    const summaries = this.getFromStorage<CallSummary[]>(summariesKey) || [];
    const summary = summaries.find(s => s.id === response.summaryId);
    if (summary) {
      summary.reviewed = true;
      summary.reviewedBy = response.providerId;
      summary.reviewedDate = new Date().toISOString();
      this.saveToStorage(summariesKey, summaries);
    }

    return newResponse;
  }

  async getProviderResponses(patientId?: string): Promise<ProviderResponse[]> {
    const key = `${this.STORAGE_PREFIX}responses`;
    let responses = this.getFromStorage<ProviderResponse[]>(key) || [];

    if (patientId) {
      responses = responses.filter(r => r.patientId === patientId);
    }

    return responses;
  }

  async markResponseViewed(responseId: string): Promise<void> {
    const key = `${this.STORAGE_PREFIX}responses`;
    const responses = this.getFromStorage<ProviderResponse[]>(key) || [];
    const response = responses.find(r => r.id === responseId);

    if (response && !response.patientViewed) {
      response.patientViewed = true;
      response.patientViewedDate = new Date().toISOString();
      this.saveToStorage(key, responses);
    }
  }

  /**
   * Template Helpers
   */
  getResponseTemplate(type: keyof typeof RESPONSE_TEMPLATES, variables?: Record<string, string>): string {
    const templates = RESPONSE_TEMPLATES[type];
    let template = templates[Math.floor(Math.random() * templates.length)];

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        template = template.replace(`{${key}}`, value);
      });
    }

    return template;
  }

  /**
   * Demo Data
   */
  private getDemoSchedules(): CallSchedule[] {
    return [
      {
        id: 'schedule-001',
        patientId: 'demo-patient-001',
        patientName: 'Jane Smith',
        patientPhone: '(555) 123-4567',
        dayOfWeek: 1, // Monday
        callTime: '10:00:00',
        timezone: 'America/Chicago',
        enabled: true,
        lastCallDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        nextCallDate: new Date(Date.now() + 0 * 24 * 60 * 60 * 1000).toISOString(), // Today
        consecutiveMisses: 0,
        patientConsentGiven: true
      }
    ];
  }

  private getDemoSummaries(): CallSummary[] {
    return [
      {
        id: 'summary-001',
        callLogId: 'log-001',
        patientId: 'demo-patient-001',
        patientName: 'Jane Smith',
        summaryText: "Patient reports good medication adherence and improved blood sugar control (120-140 mg/dL). Experiencing usual fatigue but no new concerning symptoms. Confidence level at 7/10.",
        extractedMetrics: {
          medicationAdherence: 'yes',
          bloodSugarControl: 'good',
          newSymptoms: ['fatigue (chronic)'],
          emotionalState: 'positive',
          confidenceLevel: 7
        },
        flags: [],
        urgencyLevel: 'routine',
        reviewed: false,
        sentiment: 'positive',
        confidenceScore: 0.85,
        actionItems: ['Continue current medication plan', 'Monitor fatigue levels'],
        callDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'summary-002',
        callLogId: 'log-002',
        patientId: 'demo-patient-001',
        patientName: 'Jane Smith',
        summaryText: "Patient reports missing some medication doses this week. Blood sugar readings elevated (180-220 mg/dL). Reports feeling stressed about work. Confidence level down to 5/10.",
        extractedMetrics: {
          medicationAdherence: 'partial',
          bloodSugarControl: 'fair',
          newSymptoms: ['stress', 'headaches'],
          emotionalState: 'concerned',
          confidenceLevel: 5
        },
        flags: ['medication_issue', 'needs_followup'],
        urgencyLevel: 'moderate',
        reviewed: false,
        sentiment: 'concerned',
        confidenceScore: 0.92,
        actionItems: ['Address medication adherence barriers', 'Consider stress management resources', 'Follow-up call within 48 hours'],
        callDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
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
}

export const pcmAICallService = new PCMAICallService();
