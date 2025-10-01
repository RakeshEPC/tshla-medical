/**
 * Browser-Compatible Appointment Service
 * Uses IndexedDB for persistent browser storage
 */

import { getDb, generateId } from '../lib/db/browserClient';
import { auditLogService } from './auditLog.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface Appointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  patient_phone?: string;
  patient_email?: string;
  patient_dob?: string;
  appointment_date: string;
  appointment_time: string;
  appointment_slot: string;
  duration_minutes: number;
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  visit_type: 'new-patient' | 'follow-up' | 'urgent' | 'telehealth' | 'procedure';
  chief_complaint?: string;
  notes?: string;
  practice_id?: string;
  location?: string;
  room_number?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
  is_deleted?: number;
  deleted_at?: string;
  deleted_by?: string;
}

export interface AppointmentCreateData {
  patient_name: string;
  patient_mrn: string;
  patient_id?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_dob?: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes?: number;
  visit_type?: 'new-patient' | 'follow-up' | 'urgent' | 'telehealth' | 'procedure';
  chief_complaint?: string;
  notes?: string;
  location?: string;
  room_number?: string;
}

class AppointmentBrowserService {
  private convertTo24HourSlot(date: string, time: string): string {
    const [timePart, modifier] = time.split(' ');
    let [hours, minutes] = timePart.split(':');

    if (hours === '12') {
      hours = modifier === 'AM' ? '00' : '12';
    } else if (modifier === 'PM') {
      hours = String(parseInt(hours, 10) + 12);
    }

    return `${date} ${hours.padStart(2, '0')}:${minutes}`;
  }

  async getDoctorAppointments(doctorId: string, date?: string): Promise<Appointment[]> {
    const db = getDb();
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const appointments = await db.query('appointments', [doctorId, targetDate]);
      return appointments.sort((a, b) => a.appointment_slot.localeCompare(b.appointment_slot));
    } catch (error) {
      logError('appointmentBrowser', 'Error message', {});
      return [];
    }
  }

  async createAppointment(
    doctorId: string,
    appointmentData: AppointmentCreateData
  ): Promise<Appointment> {
    const db = getDb();
    const appointmentId = generateId();
    const appointmentSlot = this.convertTo24HourSlot(
      appointmentData.appointment_date,
      appointmentData.appointment_time
    );

    try {
      // Check for conflicts
      const existing = await db.query('appointments', [doctorId, appointmentData.appointment_date]);
      const conflicts = existing.filter(
        a => a.appointment_slot === appointmentSlot && !a.is_deleted
      );

      if (conflicts.length > 0) {
        throw new Error(`Time slot ${appointmentData.appointment_time} is already booked`);
      }

      const appointment: Appointment = {
        id: appointmentId,
        doctor_id: doctorId,
        patient_id: appointmentData.patient_id || `patient-${generateId()}`,
        patient_name: appointmentData.patient_name,
        patient_mrn: appointmentData.patient_mrn,
        patient_phone: appointmentData.patient_phone,
        patient_email: appointmentData.patient_email,
        patient_dob: appointmentData.patient_dob,
        appointment_date: appointmentData.appointment_date,
        appointment_time: appointmentData.appointment_time,
        appointment_slot: appointmentSlot,
        duration_minutes: appointmentData.duration_minutes || 30,
        status: 'scheduled',
        visit_type: appointmentData.visit_type || 'follow-up',
        chief_complaint: appointmentData.chief_complaint,
        notes: appointmentData.notes,
        location: appointmentData.location,
        room_number: appointmentData.room_number,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: doctorId,
      };

      await db.execute('add:appointments', appointment);

      // Log audit
      await auditLogService.log({
        action: 'CREATE_APPOINTMENT',
        userId: doctorId,
        resourceType: 'appointment',
        resourceId: appointmentId,
        details: {
          patient_name: appointmentData.patient_name,
          appointment_time: appointmentData.appointment_time,
          appointment_date: appointmentData.appointment_date,
        },
      });

      return appointment;
    } catch (error) {
      logError('appointmentBrowser', 'Error message', {});
      throw error;
    }
  }

  async updateAppointment(
    appointmentId: string,
    doctorId: string,
    updates: Partial<AppointmentCreateData>
  ): Promise<Appointment> {
    const db = getDb();

    try {
      const existing = await db.queryOne('appointments', appointmentId);

      if (!existing) {
        throw new Error('Appointment not found');
      }

      if (existing.doctor_id !== doctorId) {
        throw new Error('Unauthorized to update this appointment');
      }

      // Apply updates
      const updated: Appointment = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: doctorId,
      };

      // Update appointment slot if time changed
      if (updates.appointment_time && updates.appointment_date) {
        updated.appointment_slot = this.convertTo24HourSlot(
          updates.appointment_date,
          updates.appointment_time
        );
      }

      await db.execute('put:appointments', updated);

      // Log audit
      await auditLogService.log({
        action: 'UPDATE_APPOINTMENT',
        userId: doctorId,
        resourceType: 'appointment',
        resourceId: appointmentId,
        details: { updates },
      });

      return updated;
    } catch (error) {
      logError('appointmentBrowser', 'Error message', {});
      throw error;
    }
  }

  async updateStatus(
    appointmentId: string,
    doctorId: string,
    status: Appointment['status']
  ): Promise<void> {
    const db = getDb();

    try {
      const existing = await db.queryOne('appointments', appointmentId);
      if (!existing) throw new Error('Appointment not found');

      const updated = {
        ...existing,
        status,
        updated_at: new Date().toISOString(),
        updated_by: doctorId,
      };

      await db.execute('put:appointments', updated);

      await auditLogService.log({
        action: 'UPDATE_APPOINTMENT_STATUS',
        userId: doctorId,
        resourceType: 'appointment',
        resourceId: appointmentId,
        details: { status },
      });
    } catch (error) {
      logError('appointmentBrowser', 'Error message', {});
      throw error;
    }
  }

  async cancelAppointment(appointmentId: string, doctorId: string, reason?: string): Promise<void> {
    const db = getDb();

    try {
      const existing = await db.queryOne('appointments', appointmentId);
      if (!existing) throw new Error('Appointment not found');

      const updated = {
        ...existing,
        status: 'cancelled' as const,
        is_deleted: 1,
        deleted_at: new Date().toISOString(),
        deleted_by: doctorId,
        notes: existing.notes
          ? `${existing.notes} | Cancellation: ${reason || 'Cancelled by doctor'}`
          : reason || 'Cancelled by doctor',
      };

      await db.execute('put:appointments', updated);

      await auditLogService.log({
        action: 'CANCEL_APPOINTMENT',
        userId: doctorId,
        resourceType: 'appointment',
        resourceId: appointmentId,
        details: { reason },
      });
    } catch (error) {
      logError('appointmentBrowser', 'Error message', {});
      throw error;
    }
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
    const allSlots: string[] = [];
    for (let hour = 9; hour < 12; hour++) {
      allSlots.push(`${hour}:00 AM`);
      allSlots.push(`${hour}:30 AM`);
    }
    allSlots.push('12:00 PM', '12:30 PM');
    for (let hour = 1; hour <= 5; hour++) {
      allSlots.push(`${hour}:00 PM`);
      allSlots.push(`${hour}:30 PM`);
    }

    try {
      const appointments = await this.getDoctorAppointments(doctorId, date);
      const bookedTimes = appointments.map(a => a.appointment_time);
      return allSlots.filter(slot => !bookedTimes.includes(slot));
    } catch (error) {
      logError('appointmentBrowser', 'Error message', {});
      return allSlots;
    }
  }

  async quickAddAppointment(doctorId: string, date: string, time: string): Promise<Appointment> {
    return this.createAppointment(doctorId, {
      patient_name: `Patient @ ${time}`,
      patient_mrn: `TBD-${Date.now().toString().slice(-6)}`,
      appointment_date: date,
      appointment_time: time,
      notes: 'Placeholder - update patient details',
    });
  }

  async getDoctorStats(
    doctorId: string,
    date?: string
  ): Promise<{
    total: number;
    completed: number;
    scheduled: number;
    cancelled: number;
    noShow: number;
  }> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const appointments = await this.getDoctorAppointments(doctorId, targetDate);

      return {
        total: appointments.length,
        completed: appointments.filter(a => a.status === 'completed').length,
        scheduled: appointments.filter(a => a.status === 'scheduled').length,
        cancelled: appointments.filter(a => a.status === 'cancelled').length,
        noShow: appointments.filter(a => a.status === 'no-show').length,
      };
    } catch (error) {
      logError('appointmentBrowser', 'Error message', {});
      return { total: 0, completed: 0, scheduled: 0, cancelled: 0, noShow: 0 };
    }
  }

  async getPatientAppointments(patientId: string): Promise<Appointment[]> {
    const db = getDb();

    try {
      const allAppointments = await db.query('appointments');
      return allAppointments
        .filter(a => a.patient_id === patientId && !a.is_deleted)
        .sort((a, b) => a.appointment_slot.localeCompare(b.appointment_slot));
    } catch (error) {
      logError('appointmentBrowser', 'Error message', {});
      return [];
    }
  }

  async getPracticeAppointments(practiceId: string, date?: string): Promise<Appointment[]> {
    const db = getDb();
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const allAppointments = await db.query('appointments');
      return allAppointments
        .filter(a => a.appointment_date === targetDate && !a.is_deleted)
        .sort((a, b) => {
          // Sort by doctor, then by time
          if (a.doctor_id !== b.doctor_id) {
            return a.doctor_id.localeCompare(b.doctor_id);
          }
          return a.appointment_slot.localeCompare(b.appointment_slot);
        });
    } catch (error) {
      logError('appointmentBrowser', 'Error message', {});
      return [];
    }
  }
}

export const appointmentService = new AppointmentBrowserService();
