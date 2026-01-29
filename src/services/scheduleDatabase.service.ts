import { logError, logWarn, logInfo, logDebug } from './logger.service';
/**
 * Schedule Database Service
 * Simple service for saving/loading schedules and notes from database
 * Created: September 16, 2025
 */

interface Patient {
  id: string;
  name: string;
  mrn: string;
  appointmentTime: string;
  status: 'pending' | 'in-progress' | 'completed';
  phone?: string;
  isPlaceholder?: boolean;
}

interface DictatedNote {
  id?: number;
  providerId?: string;
  providerName?: string;
  patientName: string;
  patientMrn?: string;
  patientPhone?: string;
  patientEmail?: string;
  rawTranscript: string;
  aiProcessedNote: string;
  recordingMode: 'dictation' | 'conversation';
  isQuickNote?: boolean;
  visitDate?: string;
  createdAt?: string;
}

class ScheduleDatabaseService {
  private readonly API_BASE_URL = import.meta.env.MODE === 'production'
    ? 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io'
    : 'http://localhost:3003';

  /**
   * Get schedule for a provider on a specific date
   */
  async getScheduleForDate(providerId: string, date: string): Promise<Patient[]> {
    try {
      const url = `${this.API_BASE_URL}/api/simple/schedule/${providerId}/${date}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch schedule: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load schedule');
      }

      return data.appointments || [];
    } catch (error) {
      logError('scheduleDatabase', 'Error message', {});
      // Return empty array as fallback
      return [];
    }
  }

  /**
   * Save appointment to database
   */
  async saveAppointment(
    providerId: string,
    providerName: string,
    patient: Patient,
    appointmentDate: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_id: providerId,
          provider_name: providerName,
          patient_name: patient.name,
          patient_mrn: patient.mrn,
          patient_phone: patient.phone,
          start_time: patient.appointmentTime,
          scheduled_date: appointmentDate,
          status: patient.status,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save appointment: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      logError('scheduleDatabase', 'Error message', {});
      return false;
    }
  }

  /**
   * Update existing appointment
   */
  async updateAppointment(appointmentId: string, patient: Patient): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientName: patient.name,
          patientMrn: patient.mrn,
          patientPhone: patient.phone,
          appointmentTime: patient.appointmentTime,
          status: patient.status,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update appointment: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      logError('scheduleDatabase', 'Error message', {});
      return false;
    }
  }

  /**
   * Delete appointment
   */
  async deleteAppointment(appointmentId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/appointments/${appointmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete appointment: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      logError('scheduleDatabase', 'Error message', {});
      return false;
    }
  }

  /**
   * Save dictated note to database
   */
  async saveNote(
    providerId: string,
    providerName: string,
    note: DictatedNote
  ): Promise<number | null> {
    try {
      // Get appointment_id from sessionStorage to link note to appointment
      const appointmentId = sessionStorage.getItem('current_appointment_id');

      const response = await fetch(`${this.API_BASE_URL}/api/dictated-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_id: providerId,
          provider_name: providerName,
          patient_name: note.patientName,
          patient_mrn: note.patientMrn,
          patient_phone: note.patientPhone,
          patient_email: note.patientEmail,
          appointment_id: appointmentId || null, // Link note to appointment
          raw_transcript: note.rawTranscript,
          processed_note: note.aiProcessedNote,
          recording_mode: note.recordingMode,
          is_quick_note: note.isQuickNote,
          visit_date: note.visitDate || new Date().toISOString().split('T')[0],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save note: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        logInfo('scheduleDatabase', '✅ Note saved and linked to appointment', {
          noteId: data.noteId,
          appointmentId: appointmentId || 'none'
        });
        return data.noteId;
      } else {
        throw new Error(data.error || 'Failed to save note');
      }
    } catch (error) {
      logError('scheduleDatabase', 'Error saving note', {});
      return null;
    }
  }

  /**
   * Get notes for provider
   */
  async getNotes(providerId: string, date?: string): Promise<DictatedNote[]> {
    try {
      let url = `${this.API_BASE_URL}/api/providers/${providerId}/notes`;
      if (date) {
        url += `?date=${date}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load notes');
      }

      // Map snake_case API response to camelCase interface
      const notes = (data.notes || []).map((note: any) => ({
        id: note.id,
        patientName: note.patient_name || '',
        patientMrn: note.patient_mrn,
        patientPhone: note.patient_phone,
        patientEmail: note.patient_email,
        rawTranscript: note.raw_transcript || '',
        aiProcessedNote: note.processed_note || '', // DB column is 'processed_note'
        recordingMode: note.recording_mode || 'dictation',
        isQuickNote: note.is_quick_note,
        visitDate: note.visit_date,
        createdAt: note.created_at
      }));

      return notes;
    } catch (error) {
      logError('scheduleDatabase', 'Error message', {});
      return [];
    }
  }

  /**
   * Add patient from QuickNote to today's schedule
   */
  async addQuickNotePatientToSchedule(
    providerId: string,
    providerName: string,
    patientName: string,
    patientMrn?: string
  ): Promise<boolean> {
    try {
      const now = new Date();
      const appointmentDate = now.toISOString().split('T')[0];
      const appointmentTime = now.toLocaleTimeString('en-US', {
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
      });

      return await this.saveAppointment(
        providerId,
        providerName,
        {
          id: `quicknote-${Date.now()}`,
          name: patientName,
          mrn: patientMrn || `QN-${Date.now()}`,
          appointmentTime,
          status: 'completed', // Mark as completed since note was already taken
          isPlaceholder: false,
        },
        appointmentDate
      );
    } catch (error) {
      logError('scheduleDatabase', 'Error message', {});
      return false;
    }
  }

  /**
   * Get all notes for a specific patient (cross-provider access)
   */
  async getNotesForPatient(mrn?: string, phone?: string, patientName?: string): Promise<DictatedNote[]> {
    try {
      // Use MRN first, then phone, then name
      const identifier = mrn || phone || patientName;
      if (!identifier) {
        return [];
      }

      const url = `${this.API_BASE_URL}/api/notes/patient/${encodeURIComponent(identifier)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch patient notes: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load patient notes');
      }

      // Map snake_case API response to camelCase interface
      const notes = (data.notes || []).map((note: any) => ({
        id: note.id,
        providerId: note.provider_id,
        providerName: note.provider_name,
        patientName: note.patient_name || '',
        patientMrn: note.patient_mrn,
        patientPhone: note.patient_phone,
        patientEmail: note.patient_email,
        rawTranscript: note.raw_transcript || '',
        aiProcessedNote: note.processed_note || '',
        recordingMode: note.recording_mode || 'dictation',
        isQuickNote: note.is_quick_note,
        visitDate: note.visit_date,
        createdAt: note.created_at
      }));

      return notes;
    } catch (error) {
      logError('scheduleDatabase', 'Failed to fetch patient notes', {});
      return [];
    }
  }

  /**
   * Get notes linked to a specific appointment (cross-provider access)
   */
  async getNotesForAppointment(appointmentId: number): Promise<DictatedNote[]> {
    try {
      const url = `${this.API_BASE_URL}/api/notes/appointment/${appointmentId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch appointment notes: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load appointment notes');
      }

      // Map snake_case API response to camelCase interface
      const notes = (data.notes || []).map((note: any) => ({
        id: note.id,
        providerId: note.provider_id,
        providerName: note.provider_name,
        patientName: note.patient_name || '',
        patientMrn: note.patient_mrn,
        patientPhone: note.patient_phone,
        patientEmail: note.patient_email,
        rawTranscript: note.raw_transcript || '',
        aiProcessedNote: note.processed_note || '',
        recordingMode: note.recording_mode || 'dictation',
        isQuickNote: note.is_quick_note,
        visitDate: note.visit_date,
        createdAt: note.created_at
      }));

      return notes;
    } catch (error) {
      logError('scheduleDatabase', 'Failed to fetch appointment notes', {});
      return [];
    }
  }
}

// Export singleton instance
export const scheduleDatabaseService = new ScheduleDatabaseService();
