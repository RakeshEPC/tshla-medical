import { logError, logWarn, logInfo, logDebug } from './logger.service';
import { supabase } from '../lib/supabase';
import type { ParsedAthenaAppointment, ScheduleImportResult } from '../types/schedule.types';

/**
 * Schedule Service
 * Frontend service for provider schedule management
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://www.tshla.ai/api/schedules';

export interface ProviderSchedule {
  id: string;
  provider_id: string;
  provider_name: string;
  patient_name?: string;
  patient_phone?: string;
  patient_email?: string;
  appointment_type:
    | 'new-patient'
    | 'follow-up'
    | 'consultation'
    | 'emergency'
    | 'block-time'
    | 'break';
  appointment_title: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  chief_complaint?: string;
  urgency_level: 'routine' | 'urgent' | 'emergency';
  is_telehealth: boolean;
  provider_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentRequest {
  provider_id: string;
  provider_name: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  appointment_type: string;
  appointment_title: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  chief_complaint?: string;
  urgency_level?: string;
  is_telehealth?: boolean;
  provider_notes?: string;
}

class ScheduleService {
  private authToken: string | null = null;

  constructor() {
    this.authToken = localStorage.getItem('auth_token');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Get provider schedule for a specific date or date range
   */
  async getProviderSchedule(
    providerId: string,
    date?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ProviderSchedule[]> {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const queryString = params.toString();
      const url = `${API_BASE}/api/providers/${providerId}/schedule${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch schedule: ${response.statusText}`);
      }

      const data = await response.json();
      return data.appointments || [];
    } catch (error) {
      logError('scheduleService', 'Error message', {});
      throw error;
    }
  }

  /**
   * Create a new appointment
   */
  async createAppointment(appointment: CreateAppointmentRequest): Promise<string> {
    try {
      const response = await fetch(`${API_BASE}/api/appointments`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(appointment),
      });

      if (!response.ok) {
        throw new Error(`Failed to create appointment: ${response.statusText}`);
      }

      const data = await response.json();
      return data.appointmentId;
    } catch (error) {
      logError('scheduleService', 'Error message', {});
      throw error;
    }
  }

  /**
   * Update an existing appointment
   */
  async updateAppointment(
    appointmentId: string,
    updates: Partial<ProviderSchedule>
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update appointment: ${response.statusText}`);
      }
    } catch (error) {
      logError('scheduleService', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get today's schedule for all providers
   */
  async getTodaysSchedule(): Promise<ProviderSchedule[]> {
    try {
      const response = await fetch(`${API_BASE}/api/schedule/today`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch today's schedule: ${response.statusText}`);
      }

      const data = await response.json();
      return data.schedule || [];
    } catch (error) {
      logError('scheduleService', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get provider's today schedule
   */
  async getProviderTodaySchedule(providerId: string): Promise<ProviderSchedule[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getProviderSchedule(providerId, today);
  }

  /**
   * Get provider's weekly schedule
   */
  async getProviderWeeklySchedule(
    providerId: string,
    startOfWeek?: Date
  ): Promise<ProviderSchedule[]> {
    const start = startOfWeek || this.getStartOfWeek(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    return this.getProviderSchedule(providerId, undefined, startDate, endDate);
  }

  /**
   * Mark appointment as completed
   */
  async completeAppointment(appointmentId: string): Promise<void> {
    return this.updateAppointment(appointmentId, {
      status: 'completed',
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(appointmentId: string, reason?: string): Promise<void> {
    const updates: Partial<ProviderSchedule> = {
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    };

    if (reason) {
      updates.provider_notes = reason;
    }

    return this.updateAppointment(appointmentId, updates);
  }

  /**
   * Quick appointment creation for dictation
   */
  async createQuickAppointment(
    providerId: string,
    providerName: string,
    patientName: string,
    patientPhone: string,
    chiefComplaint?: string
  ): Promise<string> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const endTime = new Date(now.getTime() + 30 * 60000).toTimeString().slice(0, 5); // 30 minutes later

    const appointment: CreateAppointmentRequest = {
      provider_id: providerId,
      provider_name: providerName,
      patient_name: patientName,
      patient_phone: patientPhone,
      appointment_type: 'follow-up',
      appointment_title: `Quick Note - ${patientName}`,
      scheduled_date: todayStr,
      start_time: timeStr,
      end_time: endTime,
      chief_complaint: chiefComplaint,
      urgency_level: 'routine',
      is_telehealth: false,
    };

    return this.createAppointment(appointment);
  }

  /**
   * Utility: Get start of week (Monday)
   */
  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  /**
   * Format time for display
   */
  formatTime(timeString: string): string {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Get appointment duration in minutes
   */
  getAppointmentDuration(startTime: string, endTime: string): number {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  /**
   * Import Athena schedule appointments to Supabase
   */
  async importAthenaSchedule(
    appointments: ParsedAthenaAppointment[],
    scheduleDate: string,
    importedBy: string
  ): Promise<ScheduleImportResult> {
    const batchId = crypto.randomUUID();
    const errors: any[] = [];
    const successfulImports: any[] = [];
    let duplicateCount = 0;

    try {
      logInfo('scheduleService', `Starting import of ${appointments.length} appointments`, { batchId });

      // Create import log entry
      const { error: logError } = await supabase
        .from('schedule_imports')
        .insert({
          batch_id: batchId,
          schedule_date: scheduleDate,
          total_rows: appointments.length,
          imported_by_email: importedBy,
          status: 'processing',
          started_at: new Date().toISOString(),
        });

      if (logError) {
        console.error('Failed to create import log:', logError);
      }

      // Import each appointment
      for (const apt of appointments) {
        try {
          // Check for duplicates
          const { data: existing } = await supabase
            .from('provider_schedules')
            .select('id')
            .eq('provider_id', apt.providerId || 'unknown')
            .eq('scheduled_date', apt.date)
            .eq('start_time', apt.time)
            .eq('patient_name', `${apt.patientFirstName} ${apt.patientLastName}`)
            .single();

          if (existing) {
            duplicateCount++;
            continue;
          }

          // Insert appointment
          const { data, error } = await supabase
            .from('provider_schedules')
            .insert({
              provider_id: apt.providerId || 'unknown',
              provider_name: apt.providerName,
              patient_name: `${apt.patientFirstName} ${apt.patientLastName}`,
              patient_age: apt.patientAge,
              patient_gender: apt.patientGender,
              patient_dob: apt.patientDOB,
              patient_phone: apt.patientPhone,
              patient_email: apt.patientEmail,
              patient_mrn: apt.patientMRN,
              chief_diagnosis: apt.diagnosis,
              visit_reason: apt.visitReason,
              appointment_type: this.mapVisitType(apt.visitType),
              scheduled_date: apt.date,
              start_time: apt.time,
              duration_minutes: apt.duration,
              status: 'scheduled',
              is_telehealth: false,
              athena_appointment_id: null,
              imported_by: importedBy,
              imported_at: new Date().toISOString(),
              import_batch_id: batchId,
            })
            .select()
            .single();

          if (error) {
            errors.push({ appointment: apt, error: error.message });
          } else {
            successfulImports.push(data);
          }
        } catch (err) {
          errors.push({ appointment: apt, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      // Update import log
      await supabase
        .from('schedule_imports')
        .update({
          successful_imports: successfulImports.length,
          duplicate_skips: duplicateCount,
          failed_imports: errors.length,
          error_details: errors.length > 0 ? errors : null,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('batch_id', batchId);

      logInfo('scheduleService', 'Import completed', {
        successful: successfulImports.length,
        duplicates: duplicateCount,
        failed: errors.length,
      });

      return {
        success: true,
        batchId,
        summary: {
          totalRows: appointments.length,
          successful: successfulImports.length,
          duplicates: duplicateCount,
          failed: errors.length,
        },
        appointments: successfulImports,
        errors,
        warnings: [],
      };
    } catch (error) {
      logError('scheduleService', 'Import failed', { error });
      throw error;
    }
  }

  /**
   * Map visit type from Athena to our appointment types
   */
  private mapVisitType(visitType?: string): string {
    if (!visitType) return 'office-visit';

    const normalized = visitType.toLowerCase();
    if (normalized.includes('new')) return 'new-patient';
    if (normalized.includes('follow')) return 'follow-up';
    if (normalized.includes('consult')) return 'consultation';
    if (normalized.includes('well') || normalized.includes('physical')) return 'wellness';
    if (normalized.includes('emergency') || normalized.includes('urgent')) return 'emergency';

    return 'office-visit';
  }
}

export const scheduleService = new ScheduleService();
