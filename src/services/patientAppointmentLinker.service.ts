/**
 * Patient Appointment Linker Service
 *
 * Links appointments in provider_schedules to patients in unified_patients
 * using the new unified_patient_id foreign key.
 *
 * Matching strategies:
 * 1. Phone number (primary - most reliable)
 * 2. Name + DOB (secondary)
 * 3. MRN (if available from Athena)
 */

import { supabase } from '../lib/supabase';
import { logError, logInfo, logDebug } from './logger.service';

export interface PatientAppointment {
  id: string;
  provider_id: string;
  provider_name?: string;
  provider_email?: string;
  unified_patient_id: string | null;
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  appointment_date: string;
  start_time: string;
  end_time?: string;
  appointment_type: string;
  status: string;
  chief_complaint?: string;
  notes?: string;
  created_at?: string;
}

export interface LinkingResult {
  linked: number;
  failed: number;
  skipped: number;
  errors: string[];
}

class PatientAppointmentLinkerService {
  /**
   * Get all appointments for a patient by unified_patient_id
   */
  async getPatientAppointments(
    patientId: string,
    options?: {
      upcomingOnly?: boolean;
      limit?: number;
    }
  ): Promise<PatientAppointment[]> {
    try {
      const { upcomingOnly = true, limit = 10 } = options || {};

      let query = supabase
        .from('provider_schedules')
        .select(`
          id,
          provider_id,
          provider_name,
          provider_email,
          unified_patient_id,
          patient_name,
          patient_phone,
          patient_email,
          appointment_date,
          start_time,
          end_time,
          appointment_type,
          status,
          chief_complaint,
          notes,
          created_at
        `)
        .eq('unified_patient_id', patientId)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      // Filter to upcoming appointments if requested
      if (upcomingOnly) {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('appointment_date', today);
      }

      const { data, error } = await query;

      if (error) {
        logError('PatientAppointmentLinker', 'Error fetching patient appointments', { error, patientId });
        throw error;
      }

      logDebug('PatientAppointmentLinker', `Found ${data?.length || 0} appointments for patient ${patientId}`);
      return (data as PatientAppointment[]) || [];

    } catch (error) {
      logError('PatientAppointmentLinker', 'Failed to get patient appointments', { error, patientId });
      return [];
    }
  }

  /**
   * Get past appointments for a patient (for history view)
   */
  async getPatientAppointmentHistory(
    patientId: string,
    limit: number = 20
  ): Promise<PatientAppointment[]> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('provider_schedules')
        .select(`
          id,
          provider_id,
          provider_name,
          provider_email,
          unified_patient_id,
          patient_name,
          patient_phone,
          patient_email,
          appointment_date,
          start_time,
          end_time,
          appointment_type,
          status,
          chief_complaint,
          notes,
          created_at
        `)
        .eq('unified_patient_id', patientId)
        .lt('appointment_date', today)
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) {
        logError('PatientAppointmentLinker', 'Error fetching appointment history', { error, patientId });
        throw error;
      }

      return (data as PatientAppointment[]) || [];

    } catch (error) {
      logError('PatientAppointmentLinker', 'Failed to get appointment history', { error, patientId });
      return [];
    }
  }

  /**
   * Link a single appointment to a patient by matching phone number
   */
  async linkAppointmentToPatient(scheduleId: string): Promise<string | null> {
    try {
      // Get the schedule record
      const { data: schedule, error: scheduleError } = await supabase
        .from('provider_schedules')
        .select('id, patient_phone, patient_name, unified_patient_id')
        .eq('id', scheduleId)
        .single();

      if (scheduleError || !schedule) {
        logError('PatientAppointmentLinker', 'Schedule not found', { scheduleId });
        return null;
      }

      // Already linked
      if (schedule.unified_patient_id) {
        return schedule.unified_patient_id;
      }

      // No phone to match
      if (!schedule.patient_phone) {
        logDebug('PatientAppointmentLinker', 'No phone number for matching', { scheduleId });
        return null;
      }

      // Normalize phone
      const normalizedPhone = schedule.patient_phone.replace(/\D/g, '');

      // Find matching patient
      const { data: patient, error: patientError } = await supabase
        .from('unified_patients')
        .select('id')
        .eq('phone_primary', normalizedPhone)
        .eq('is_active', true)
        .single();

      if (patientError || !patient) {
        logDebug('PatientAppointmentLinker', 'No matching patient found', { phone: normalizedPhone });
        return null;
      }

      // Link the appointment
      const { error: updateError } = await supabase
        .from('provider_schedules')
        .update({ unified_patient_id: patient.id })
        .eq('id', scheduleId);

      if (updateError) {
        logError('PatientAppointmentLinker', 'Failed to link appointment', { updateError, scheduleId });
        return null;
      }

      logInfo('PatientAppointmentLinker', 'Linked appointment to patient', {
        scheduleId,
        patientId: patient.id
      });

      return patient.id;

    } catch (error) {
      logError('PatientAppointmentLinker', 'Error linking appointment', { error, scheduleId });
      return null;
    }
  }

  /**
   * Bulk link all unlinked appointments
   * Can be called from admin panel or as a background job
   */
  async linkAllUnlinkedAppointments(): Promise<LinkingResult> {
    const result: LinkingResult = {
      linked: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      // Get all unlinked appointments with phone numbers
      const { data: unlinked, error } = await supabase
        .from('provider_schedules')
        .select('id, patient_phone, patient_name')
        .is('unified_patient_id', null)
        .not('patient_phone', 'is', null)
        .limit(1000);

      if (error) {
        result.errors.push(`Failed to fetch unlinked appointments: ${error.message}`);
        return result;
      }

      logInfo('PatientAppointmentLinker', `Found ${unlinked?.length || 0} unlinked appointments`);

      for (const schedule of (unlinked || [])) {
        const linkedPatientId = await this.linkAppointmentToPatient(schedule.id);

        if (linkedPatientId) {
          result.linked++;
        } else if (!schedule.patient_phone) {
          result.skipped++;
        } else {
          result.failed++;
        }
      }

      logInfo('PatientAppointmentLinker', 'Bulk linking complete', result);
      return result;

    } catch (error) {
      logError('PatientAppointmentLinker', 'Bulk linking failed', { error });
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Get linking statistics
   */
  async getLinkingStats(): Promise<{
    totalSchedules: number;
    linkedSchedules: number;
    unlinkedSchedules: number;
    linkingPercentage: number;
  }> {
    try {
      const { count: total } = await supabase
        .from('provider_schedules')
        .select('*', { count: 'exact', head: true });

      const { count: linked } = await supabase
        .from('provider_schedules')
        .select('*', { count: 'exact', head: true })
        .not('unified_patient_id', 'is', null);

      const totalSchedules = total || 0;
      const linkedSchedules = linked || 0;
      const unlinkedSchedules = totalSchedules - linkedSchedules;
      const linkingPercentage = totalSchedules > 0
        ? Math.round((linkedSchedules / totalSchedules) * 100)
        : 0;

      return {
        totalSchedules,
        linkedSchedules,
        unlinkedSchedules,
        linkingPercentage
      };

    } catch (error) {
      logError('PatientAppointmentLinker', 'Failed to get linking stats', { error });
      return {
        totalSchedules: 0,
        linkedSchedules: 0,
        unlinkedSchedules: 0,
        linkingPercentage: 0
      };
    }
  }

  /**
   * Format appointment for display
   */
  formatAppointmentDisplay(appointment: PatientAppointment): {
    dateDisplay: string;
    timeDisplay: string;
    typeDisplay: string;
    statusDisplay: string;
    statusColor: string;
  } {
    // Format date
    const dateObj = new Date(appointment.appointment_date + 'T12:00:00');
    const dateDisplay = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Format time
    const timeDisplay = appointment.start_time
      ? this.formatTime(appointment.start_time)
      : 'TBD';

    // Format type
    const typeMap: Record<string, string> = {
      'routine': 'Routine Visit',
      'followup': 'Follow-up',
      'consultation': 'Consultation',
      'procedure': 'Procedure',
      'emergency': 'Urgent',
      'blocked': 'Blocked'
    };
    const typeDisplay = typeMap[appointment.appointment_type] || appointment.appointment_type;

    // Format status with color
    const statusMap: Record<string, { display: string; color: string }> = {
      'scheduled': { display: 'Scheduled', color: 'blue' },
      'confirmed': { display: 'Confirmed', color: 'green' },
      'checked_in': { display: 'Checked In', color: 'purple' },
      'in_progress': { display: 'In Progress', color: 'yellow' },
      'completed': { display: 'Completed', color: 'gray' },
      'cancelled': { display: 'Cancelled', color: 'red' },
      'no_show': { display: 'No Show', color: 'red' }
    };
    const statusInfo = statusMap[appointment.status] || { display: appointment.status, color: 'gray' };

    return {
      dateDisplay,
      timeDisplay,
      typeDisplay,
      statusDisplay: statusInfo.display,
      statusColor: statusInfo.color
    };
  }

  private formatTime(time: string): string {
    // Handle various time formats
    if (time.includes('AM') || time.includes('PM')) {
      return time;
    }

    // Convert 24-hour to 12-hour
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
}

export const patientAppointmentLinkerService = new PatientAppointmentLinkerService();
