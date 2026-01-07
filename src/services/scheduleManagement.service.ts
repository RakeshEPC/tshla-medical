/**
 * Schedule Management Service
 *
 * Handles CRUD operations for appointments:
 * - Create new appointments
 * - Update existing appointments
 * - Delete appointments
 * - Cancel appointments
 * - Check for conflicts
 */

import { supabase } from '../lib/supabase';
import { logError, logInfo, logDebug, logWarn } from './logger.service';
import { patientSearchService } from './patientSearch.service';
import { supabaseAuthService } from './supabaseAuth.service';

export interface AppointmentFormData {
  // Provider
  provider_id: string;
  provider_name: string;
  provider_specialty?: string;

  // Patient (either existing or new)
  unified_patient_id?: string; // If selecting existing patient
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  patient_dob?: string;
  patient_mrn?: string;
  patient_gender?: string;
  patient_age?: number;

  // New patient data (if creating)
  patient_first_name?: string;
  patient_last_name?: string;

  // Appointment Details
  scheduled_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM format (24h or 12h with AM/PM)
  end_time?: string;
  duration_minutes: number;
  appointment_type?: string;

  // Clinical
  chief_diagnosis?: string;
  visit_reason?: string;
  chief_complaint?: string;
  urgency_level?: 'routine' | 'urgent' | 'emergency';

  // Flags
  is_telehealth: boolean;
  status?: string;

  // Metadata
  provider_notes?: string;
  color_code?: string;
}

export interface AppointmentConflict {
  id: number;
  patient_name: string;
  start_time: string;
  duration_minutes: number;
  status: string;
}

export interface AppointmentDetails {
  id: number;
  provider_id: string;
  provider_name: string;
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  patient_dob?: string;
  patient_mrn?: string;
  scheduled_date: string;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  appointment_type?: string;
  status: string;
  chief_diagnosis?: string;
  visit_reason?: string;
  is_telehealth: boolean;
  unified_patient_id?: string;
  created_at: string;
  updated_at: string;
}

class ScheduleManagementService {
  /**
   * Create a new appointment
   */
  async createAppointment(formData: AppointmentFormData): Promise<{ success: boolean; appointment?: AppointmentDetails; error?: string }> {
    try {
      logInfo('ScheduleManagementService', 'Creating appointment', { formData });

      const currentUser = supabaseAuthService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }

      // 1. Handle patient - find existing or create new
      let patientId = formData.unified_patient_id;

      if (!patientId) {
        // Check if patient exists by phone
        const normalizedPhone = formData.patient_phone.replace(/\D/g, '');
        const existingPatient = await patientSearchService.findByPhone(normalizedPhone);

        if (existingPatient) {
          patientId = existingPatient.id;
          logInfo('ScheduleManagementService', 'Found existing patient', { patientId });
        } else if (formData.patient_first_name && formData.patient_last_name) {
          // Create new patient
          const newPatient = await patientSearchService.createPatient({
            first_name: formData.patient_first_name,
            last_name: formData.patient_last_name,
            phone_primary: normalizedPhone,
            email: formData.patient_email,
            date_of_birth: formData.patient_dob,
            gender: formData.patient_gender,
            mrn: formData.patient_mrn,
            created_from: 'schedule',
            created_by: currentUser.email
          });

          if (newPatient) {
            patientId = newPatient.id;
            logInfo('ScheduleManagementService', 'Created new patient', { patientId });
          } else {
            return { success: false, error: 'Failed to create patient record' };
          }
        }
      }

      // 2. Check for conflicts
      const conflicts = await this.checkTimeSlotConflict(
        formData.provider_id,
        formData.scheduled_date,
        formData.start_time
      );

      if (conflicts.length > 0) {
        logWarn('ScheduleManagementService', 'Time slot conflict detected', { conflicts });
        // Return warning but allow creation (soft conflict)
        // UI should ask user to confirm
      }

      // 3. Normalize time format (convert to 24h if needed)
      const normalizedStartTime = this.normalizeTimeFormat(formData.start_time);
      const normalizedEndTime = formData.end_time ? this.normalizeTimeFormat(formData.end_time) : this.calculateEndTime(normalizedStartTime, formData.duration_minutes);

      // 4. Insert appointment
      const { data, error } = await supabase
        .from('provider_schedules')
        .insert({
          // Provider
          provider_id: formData.provider_id,
          provider_name: formData.provider_name,
          provider_specialty: formData.provider_specialty,

          // Patient
          unified_patient_id: patientId,
          patient_name: formData.patient_name,
          patient_phone: formData.patient_phone,
          patient_email: formData.patient_email,
          patient_dob: formData.patient_dob,
          patient_mrn: formData.patient_mrn,
          patient_gender: formData.patient_gender,
          patient_age: formData.patient_age,

          // Appointment
          scheduled_date: formData.scheduled_date,
          start_time: normalizedStartTime,
          end_time: normalizedEndTime,
          duration_minutes: formData.duration_minutes,
          appointment_type: formData.appointment_type || 'office-visit',
          status: formData.status || 'scheduled',

          // Clinical
          chief_diagnosis: formData.chief_diagnosis,
          visit_reason: formData.visit_reason,
          chief_complaint: formData.chief_complaint,
          urgency_level: formData.urgency_level || 'routine',

          // Flags
          is_telehealth: formData.is_telehealth,

          // Metadata
          provider_notes: formData.provider_notes,
          color_code: formData.color_code || 'blue',
          entry_source: 'manual',
          created_by_user_id: currentUser.id,
          last_modified_by_user_id: currentUser.id,
          last_modified_by_email: currentUser.email
        })
        .select()
        .single();

      if (error) {
        logError('ScheduleManagementService', 'Failed to create appointment', { error });
        return { success: false, error: error.message };
      }

      logInfo('ScheduleManagementService', 'Appointment created successfully', { id: data.id });

      return {
        success: true,
        appointment: data as AppointmentDetails
      };
    } catch (error) {
      logError('ScheduleManagementService', 'Create appointment exception', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update an existing appointment
   */
  async updateAppointment(
    appointmentId: number,
    updates: Partial<AppointmentFormData>
  ): Promise<{ success: boolean; appointment?: AppointmentDetails; error?: string }> {
    try {
      logInfo('ScheduleManagementService', 'Updating appointment', { appointmentId, updates });

      const currentUser = supabaseAuthService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }

      // Build update object
      const updateData: any = {
        last_modified_by_user_id: currentUser.id,
        last_modified_by_email: currentUser.email,
        updated_at: new Date().toISOString()
      };

      // Only update fields that were provided
      if (updates.provider_id) updateData.provider_id = updates.provider_id;
      if (updates.provider_name) updateData.provider_name = updates.provider_name;
      if (updates.patient_name) updateData.patient_name = updates.patient_name;
      if (updates.patient_phone) updateData.patient_phone = updates.patient_phone;
      if (updates.patient_email !== undefined) updateData.patient_email = updates.patient_email;
      if (updates.patient_dob) updateData.patient_dob = updates.patient_dob;
      if (updates.patient_mrn) updateData.patient_mrn = updates.patient_mrn;
      if (updates.scheduled_date) updateData.scheduled_date = updates.scheduled_date;
      if (updates.start_time) updateData.start_time = this.normalizeTimeFormat(updates.start_time);
      if (updates.end_time) updateData.end_time = this.normalizeTimeFormat(updates.end_time);
      if (updates.duration_minutes) updateData.duration_minutes = updates.duration_minutes;
      if (updates.appointment_type) updateData.appointment_type = updates.appointment_type;
      if (updates.status) updateData.status = updates.status;
      if (updates.chief_diagnosis !== undefined) updateData.chief_diagnosis = updates.chief_diagnosis;
      if (updates.visit_reason !== undefined) updateData.visit_reason = updates.visit_reason;
      if (updates.is_telehealth !== undefined) updateData.is_telehealth = updates.is_telehealth;
      if (updates.urgency_level) updateData.urgency_level = updates.urgency_level;

      // Check for conflicts if time/date changed
      if (updates.scheduled_date || updates.start_time) {
        const conflicts = await this.checkTimeSlotConflict(
          updates.provider_id || '',
          updates.scheduled_date || '',
          updates.start_time || '',
          appointmentId // Exclude current appointment
        );

        if (conflicts.length > 0) {
          logWarn('ScheduleManagementService', 'Time slot conflict on update', { conflicts });
        }
      }

      const { data, error } = await supabase
        .from('provider_schedules')
        .update(updateData)
        .eq('id', appointmentId)
        .select()
        .single();

      if (error) {
        logError('ScheduleManagementService', 'Failed to update appointment', { error, appointmentId });
        return { success: false, error: error.message };
      }

      logInfo('ScheduleManagementService', 'Appointment updated successfully', { id: data.id });

      return {
        success: true,
        appointment: data as AppointmentDetails
      };
    } catch (error) {
      logError('ScheduleManagementService', 'Update appointment exception', { error, appointmentId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete an appointment (hard delete)
   * Only admins should have access to this
   */
  async deleteAppointment(appointmentId: number): Promise<{ success: boolean; error?: string }> {
    try {
      logWarn('ScheduleManagementService', 'Deleting appointment (hard delete)', { appointmentId });

      const { error } = await supabase
        .from('provider_schedules')
        .delete()
        .eq('id', appointmentId);

      if (error) {
        logError('ScheduleManagementService', 'Failed to delete appointment', { error, appointmentId });
        return { success: false, error: error.message };
      }

      logInfo('ScheduleManagementService', 'Appointment deleted successfully', { appointmentId });

      return { success: true };
    } catch (error) {
      logError('ScheduleManagementService', 'Delete appointment exception', { error, appointmentId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cancel an appointment (soft delete - keeps record)
   */
  async cancelAppointment(
    appointmentId: number,
    reason: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logInfo('ScheduleManagementService', 'Cancelling appointment', { appointmentId, reason });

      const currentUser = supabaseAuthService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('provider_schedules')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancellation_notes: notes,
          cancellation_date: new Date().toISOString().split('T')[0],
          last_modified_by_user_id: currentUser.id,
          last_modified_by_email: currentUser.email
        })
        .eq('id', appointmentId);

      if (error) {
        logError('ScheduleManagementService', 'Failed to cancel appointment', { error, appointmentId });
        return { success: false, error: error.message };
      }

      logInfo('ScheduleManagementService', 'Appointment cancelled successfully', { appointmentId, reason });

      return { success: true };
    } catch (error) {
      logError('ScheduleManagementService', 'Cancel appointment exception', { error, appointmentId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if time slot has conflicts
   */
  async checkTimeSlotConflict(
    providerId: string,
    date: string,
    startTime: string,
    excludeId?: number
  ): Promise<AppointmentConflict[]> {
    try {
      const normalizedTime = this.normalizeTimeFormat(startTime);

      let query = supabase
        .from('provider_schedules')
        .select('id, patient_name, start_time, duration_minutes, status')
        .eq('provider_id', providerId)
        .eq('scheduled_date', date)
        .eq('start_time', normalizedTime)
        .not('status', 'in', '(cancelled,no-show)');

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        logError('ScheduleManagementService', 'Conflict check error', { error });
        return [];
      }

      return (data as AppointmentConflict[]) || [];
    } catch (error) {
      logError('ScheduleManagementService', 'Conflict check exception', { error });
      return [];
    }
  }

  /**
   * Get appointment by ID
   */
  async getAppointment(appointmentId: number): Promise<AppointmentDetails | null> {
    try {
      const { data, error } = await supabase
        .from('provider_schedules')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (error) {
        logError('ScheduleManagementService', 'Get appointment error', { error, appointmentId });
        return null;
      }

      return data as AppointmentDetails;
    } catch (error) {
      logError('ScheduleManagementService', 'Get appointment exception', { error, appointmentId });
      return null;
    }
  }

  /**
   * Normalize time format to 24-hour HH:MM
   * Accepts: "9:00 AM", "09:00", "9:00", etc.
   * Returns: "09:00"
   */
  private normalizeTimeFormat(time: string): string {
    const cleaned = time.trim().toUpperCase();

    // Check if already in 24h format (HH:MM)
    if (/^\d{1,2}:\d{2}$/.test(cleaned)) {
      const [hours, minutes] = cleaned.split(':');
      return `${hours.padStart(2, '0')}:${minutes}`;
    }

    // Parse 12h format with AM/PM
    const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2];
      const meridiem = match[3];

      if (meridiem === 'PM' && hours !== 12) {
        hours += 12;
      } else if (meridiem === 'AM' && hours === 12) {
        hours = 0;
      }

      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    // Return as-is if can't parse
    return time;
  }

  /**
   * Calculate end time based on start time and duration
   */
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;

    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }
}

export const scheduleManagementService = new ScheduleManagementService();
