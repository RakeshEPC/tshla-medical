/**
 * Appointment API Client
 * Handles all HTTP requests for appointment operations
 */

import {
  appointmentService,
  type Appointment,
  type AppointmentCreateData,
} from '../services/appointmentBrowser.service';
import { unifiedAuthService } from '../services/unifiedAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

const API_BASE = import.meta.env.VITE_API_URL || '';

export class AppointmentAPI {
  /**
   * Get current doctor's appointments for a date
   */
  static async getMyAppointments(date?: string): Promise<Appointment[]> {
    try {
      const user = unifiedAuthService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // For now, use local service directly
      // In production, this would call the backend API
      return await appointmentService.getDoctorAppointments(user.id, date);
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get all appointments for the practice (multi-doctor view)
   */
  static async getPracticeAppointments(date?: string): Promise<Appointment[]> {
    try {
      const user = unifiedAuthService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // Get practice ID from user
      const practiceId = user.specialty || 'default'; // Use specialty as practice for now

      return await appointmentService.getPracticeAppointments(practiceId, date);
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  }

  /**
   * Create a new appointment
   */
  static async createAppointment(data: AppointmentCreateData): Promise<Appointment> {
    try {
      const user = unifiedAuthService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      return await appointmentService.createAppointment(user.id, data);
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  }

  /**
   * Update an appointment
   */
  static async updateAppointment(
    appointmentId: string,
    updates: Partial<AppointmentCreateData>
  ): Promise<Appointment> {
    try {
      const user = unifiedAuthService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      return await appointmentService.updateAppointment(appointmentId, user.id, updates);
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  }

  /**
   * Update appointment status
   */
  static async updateAppointmentStatus(
    appointmentId: string,
    status: Appointment['status']
  ): Promise<void> {
    try {
      const user = unifiedAuthService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      await appointmentService.updateStatus(appointmentId, user.id, status);
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  }

  /**
   * Cancel an appointment
   */
  static async cancelAppointment(appointmentId: string, reason?: string): Promise<void> {
    try {
      const user = unifiedAuthService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      await appointmentService.cancelAppointment(appointmentId, user.id, reason);
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get available time slots
   */
  static async getAvailableSlots(date: string): Promise<string[]> {
    try {
      const user = unifiedAuthService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      return await appointmentService.getAvailableSlots(user.id, date);
    } catch (error) {
      logError('App', 'Error message', {});
      // Return all slots as fallback
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
      return allSlots;
    }
  }

  /**
   * Quick add a placeholder appointment
   */
  static async quickAddAppointment(date: string, time: string): Promise<Appointment> {
    try {
      const user = unifiedAuthService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      return await appointmentService.quickAddAppointment(user.id, date, time);
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get appointment statistics
   */
  static async getAppointmentStats(date?: string): Promise<{
    total: number;
    completed: number;
    scheduled: number;
    cancelled: number;
    noShow: number;
  }> {
    try {
      const user = unifiedAuthService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      return await appointmentService.getDoctorStats(user.id, date);
    } catch (error) {
      logError('App', 'Error message', {});
      return { total: 0, completed: 0, scheduled: 0, cancelled: 0, noShow: 0 };
    }
  }

  /**
   * Search for patient appointments
   */
  static async getPatientAppointments(patientId: string): Promise<Appointment[]> {
    try {
      return await appointmentService.getPatientAppointments(patientId);
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  }
}

// Export for use in components
export default AppointmentAPI;
