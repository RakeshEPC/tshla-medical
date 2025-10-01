/**
 * Appointment Service
 * Handles all appointment scheduling operations with database persistence
 * Multi-doctor support with conflict prevention
 */

import { getDb, generateId } from '../lib/db/client';
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
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // "9:00 AM"
  appointment_slot: string; // "2024-01-15 09:00" for sorting
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

  // Virtual fields (from joins)
  doctor_name?: string;
  doctor_specialty?: string;
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

class AppointmentService {
  /**
   * Convert time to 24-hour format for consistent sorting
   */
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

  /**
   * Get all appointments for a specific doctor on a date
   */
  async getDoctorAppointments(doctorId: string, date?: string): Promise<Appointment[]> {
    const db = getDb();
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const appointments = await db.query(
        `SELECT 
          a.*,
          d.first_name || ' ' || d.last_name as doctor_name,
          d.specialty as doctor_specialty
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.doctor_id = $1 
          AND a.appointment_date = $2
          AND a.is_deleted = 0
        ORDER BY a.appointment_slot`,
        [doctorId, targetDate]
      );

      return appointments as Appointment[];
    } catch (error) {
      logError('appointment', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get all appointments for a practice (multi-doctor view)
   */
  async getPracticeAppointments(practiceId: string, date?: string): Promise<Appointment[]> {
    const db = getDb();
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const appointments = await db.query(
        `SELECT 
          a.*,
          d.first_name || ' ' || d.last_name as doctor_name,
          d.specialty as doctor_specialty
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.practice_id = $1 
          AND a.appointment_date = $2
          AND a.is_deleted = 0
        ORDER BY a.doctor_id, a.appointment_slot`,
        [practiceId, targetDate]
      );

      return appointments as Appointment[];
    } catch (error) {
      logError('appointment', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get upcoming appointments for a patient
   */
  async getPatientAppointments(patientId: string): Promise<Appointment[]> {
    const db = getDb();

    try {
      const appointments = await db.query(
        `SELECT 
          a.*,
          d.first_name || ' ' || d.last_name as doctor_name,
          d.specialty as doctor_specialty
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.patient_id = $1 
          AND a.appointment_date >= DATE('now')
          AND a.is_deleted = 0
        ORDER BY a.appointment_slot
        LIMIT 10`,
        [patientId]
      );

      return appointments as Appointment[];
    } catch (error) {
      logError('appointment', 'Error message', {});
      throw error;
    }
  }

  /**
   * Create a new appointment with conflict checking
   */
  async createAppointment(
    doctorId: string,
    appointmentData: AppointmentCreateData,
    createdBy?: string
  ): Promise<Appointment> {
    const db = getDb();
    const appointmentId = generateId();
    const appointmentSlot = this.convertTo24HourSlot(
      appointmentData.appointment_date,
      appointmentData.appointment_time
    );

    try {
      // Check for conflicts
      const conflicts = await db.query(
        `SELECT id FROM appointments 
        WHERE doctor_id = $1 
          AND appointment_slot = $2 
          AND is_deleted = 0`,
        [doctorId, appointmentSlot]
      );

      if (conflicts.length > 0) {
        throw new Error(`Time slot ${appointmentData.appointment_time} is already booked`);
      }

      // Get doctor's practice_id
      const doctor = await db.queryOne('SELECT practice_name FROM doctors WHERE id = $1', [
        doctorId,
      ]);

      // Create appointment
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
        practice_id: doctor?.practice_name,
        location: appointmentData.location,
        room_number: appointmentData.room_number,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: doctorId,
      };

      await db.execute(
        `INSERT INTO appointments (
          id, doctor_id, patient_id, patient_name, patient_mrn,
          patient_phone, patient_email, patient_dob,
          appointment_date, appointment_time, appointment_slot,
          duration_minutes, status, visit_type, chief_complaint,
          notes, practice_id, location, room_number,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          appointment.id,
          appointment.doctor_id,
          appointment.patient_id,
          appointment.patient_name,
          appointment.patient_mrn,
          appointment.patient_phone,
          appointment.patient_email,
          appointment.patient_dob,
          appointment.appointment_date,
          appointment.appointment_time,
          appointment.appointment_slot,
          appointment.duration_minutes,
          appointment.status,
          appointment.visit_type,
          appointment.chief_complaint,
          appointment.notes,
          appointment.practice_id,
          appointment.location,
          appointment.room_number,
          appointment.created_by,
        ]
      );

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
      logError('appointment', 'Error message', {});
      throw error;
    }
  }

  /**
   * Update an existing appointment
   */
  async updateAppointment(
    appointmentId: string,
    doctorId: string,
    updates: Partial<AppointmentCreateData>
  ): Promise<Appointment> {
    const db = getDb();

    try {
      // Get existing appointment
      const existing = await db.queryOne(
        'SELECT * FROM appointments WHERE id = $1 AND is_deleted = 0',
        [appointmentId]
      );

      if (!existing) {
        throw new Error('Appointment not found');
      }

      // Check authorization
      if (existing.doctor_id !== doctorId) {
        throw new Error('Unauthorized to update this appointment');
      }

      // Build update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCount = 1;

      if (updates.patient_name !== undefined) {
        updateFields.push(`patient_name = $${paramCount++}`);
        updateValues.push(updates.patient_name);
      }

      if (updates.patient_mrn !== undefined) {
        updateFields.push(`patient_mrn = $${paramCount++}`);
        updateValues.push(updates.patient_mrn);
      }

      if (updates.patient_phone !== undefined) {
        updateFields.push(`patient_phone = $${paramCount++}`);
        updateValues.push(updates.patient_phone);
      }

      if (updates.patient_email !== undefined) {
        updateFields.push(`patient_email = $${paramCount++}`);
        updateValues.push(updates.patient_email);
      }

      if (updates.patient_dob !== undefined) {
        updateFields.push(`patient_dob = $${paramCount++}`);
        updateValues.push(updates.patient_dob);
      }

      if (updates.appointment_time !== undefined && updates.appointment_date) {
        const newSlot = this.convertTo24HourSlot(
          updates.appointment_date,
          updates.appointment_time
        );

        // Check for conflicts if time is changing
        if (newSlot !== existing.appointment_slot) {
          const conflicts = await db.query(
            `SELECT id FROM appointments 
            WHERE doctor_id = $1 
              AND appointment_slot = $2 
              AND id != $3
              AND is_deleted = 0`,
            [doctorId, newSlot, appointmentId]
          );

          if (conflicts.length > 0) {
            throw new Error(`Time slot ${updates.appointment_time} is already booked`);
          }
        }

        updateFields.push(`appointment_time = $${paramCount++}`);
        updateValues.push(updates.appointment_time);
        updateFields.push(`appointment_slot = $${paramCount++}`);
        updateValues.push(newSlot);
      }

      if (updates.appointment_date !== undefined) {
        updateFields.push(`appointment_date = $${paramCount++}`);
        updateValues.push(updates.appointment_date);
      }

      if (updates.chief_complaint !== undefined) {
        updateFields.push(`chief_complaint = $${paramCount++}`);
        updateValues.push(updates.chief_complaint);
      }

      if (updates.visit_type !== undefined) {
        updateFields.push(`visit_type = $${paramCount++}`);
        updateValues.push(updates.visit_type);
      }

      if (updates.notes !== undefined) {
        updateFields.push(`notes = $${paramCount++}`);
        updateValues.push(updates.notes);
      }

      // Add metadata
      updateFields.push(`updated_by = $${paramCount++}`);
      updateValues.push(doctorId);
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add appointment ID for WHERE clause
      updateValues.push(appointmentId);

      // Execute update
      await db.execute(
        `UPDATE appointments 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}`,
        updateValues
      );

      // Fetch updated appointment
      const updated = await db.queryOne('SELECT * FROM appointments WHERE id = $1', [
        appointmentId,
      ]);

      // Log audit
      await auditLogService.log({
        action: 'UPDATE_APPOINTMENT',
        userId: doctorId,
        resourceType: 'appointment',
        resourceId: appointmentId,
        details: { updates },
      });

      return updated as Appointment;
    } catch (error) {
      logError('appointment', 'Error message', {});
      throw error;
    }
  }

  /**
   * Update appointment status
   */
  async updateStatus(
    appointmentId: string,
    doctorId: string,
    status: Appointment['status']
  ): Promise<void> {
    const db = getDb();

    try {
      await db.execute(
        `UPDATE appointments 
        SET status = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND doctor_id = $4`,
        [status, doctorId, appointmentId, doctorId]
      );

      await auditLogService.log({
        action: 'UPDATE_APPOINTMENT_STATUS',
        userId: doctorId,
        resourceType: 'appointment',
        resourceId: appointmentId,
        details: { status },
      });
    } catch (error) {
      logError('appointment', 'Error message', {});
      throw error;
    }
  }

  /**
   * Cancel an appointment (soft delete)
   */
  async cancelAppointment(appointmentId: string, doctorId: string, reason?: string): Promise<void> {
    const db = getDb();

    try {
      await db.execute(
        `UPDATE appointments 
        SET status = 'cancelled', 
            is_deleted = 1, 
            deleted_at = CURRENT_TIMESTAMP,
            deleted_by = $1,
            notes = COALESCE(notes || ' | Cancellation: ' || $2, $2)
        WHERE id = $3 AND doctor_id = $4`,
        [doctorId, reason || 'Cancelled by doctor', appointmentId, doctorId]
      );

      await auditLogService.log({
        action: 'CANCEL_APPOINTMENT',
        userId: doctorId,
        resourceType: 'appointment',
        resourceId: appointmentId,
        details: { reason },
      });
    } catch (error) {
      logError('appointment', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get available time slots for a doctor on a date
   */
  async getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
    const db = getDb();

    // Generate all possible slots (9 AM to 5 PM, 30-minute intervals)
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
      // Get booked slots
      const booked = await db.query(
        `SELECT appointment_time FROM appointments 
        WHERE doctor_id = $1 
          AND appointment_date = $2 
          AND is_deleted = 0`,
        [doctorId, date]
      );

      const bookedTimes = booked.map((a: any) => a.appointment_time);

      // Return available slots
      return allSlots.filter(slot => !bookedTimes.includes(slot));
    } catch (error) {
      logError('appointment', 'Error message', {});
      return allSlots; // Return all slots if error
    }
  }

  /**
   * Quick add placeholder appointment
   */
  async quickAddAppointment(doctorId: string, date: string, time: string): Promise<Appointment> {
    return this.createAppointment(doctorId, {
      patient_name: `Patient @ ${time}`,
      patient_mrn: `TBD-${Date.now().toString().slice(-6)}`,
      appointment_date: date,
      appointment_time: time,
      notes: 'Placeholder - update patient details',
    });
  }

  /**
   * Get appointment statistics for dashboard
   */
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
    const db = getDb();
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const stats = await db.queryOne(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as no_show
        FROM appointments
        WHERE doctor_id = $1 
          AND appointment_date = $2
          AND is_deleted = 0`,
        [doctorId, targetDate]
      );

      return {
        total: stats.total || 0,
        completed: stats.completed || 0,
        scheduled: stats.scheduled || 0,
        cancelled: stats.cancelled || 0,
        noShow: stats.no_show || 0,
      };
    } catch (error) {
      logError('appointment', 'Error message', {});
      return { total: 0, completed: 0, scheduled: 0, cancelled: 0, noShow: 0 };
    }
  }
}

export const appointmentService = new AppointmentService();
