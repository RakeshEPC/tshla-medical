/**
 * Diabetes Education Service
 * Frontend service for managing diabetes education patients and calls
 * Created: 2025-12-03
 */

import { supabase } from '../lib/supabase';

// =====================================================
// TYPES
// =====================================================

export interface DiabetesEducationPatient {
  id: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  preferred_language: string;
  medical_document_url?: string;
  medical_data?: MedicalData;
  clinical_notes?: string;
  focus_areas?: string[];
  created_at: string;
  updated_at: string;
  created_by_staff_id?: string;
  is_active: boolean;
}

export interface MedicalData {
  medications?: Array<{
    name: string;
    dose: string;
    frequency: string;
  }>;
  labs?: {
    a1c?: LabValue;
    glucose_fasting?: LabValue;
    creatinine?: LabValue;
    [key: string]: LabValue | undefined;
  };
  diagnoses?: string[];
  allergies?: string[];
  notes?: string;
}

export interface LabValue {
  value: number;
  date: string;
  unit: string;
}

export interface DiabetesEducationCall {
  id: string;
  patient_id: string;
  twilio_call_sid: string;
  elevenlabs_conversation_id?: string;
  language: string;
  call_started_at: string;
  call_ended_at?: string;
  duration_seconds?: number;
  transcript?: string;
  summary?: string;
  topics_discussed?: string[];
  caller_phone_number?: string;
  call_status: string;
  disconnect_reason?: string;
}

export interface CreatePatientData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone_number: string;
  preferred_language: string;
  medical_document?: File;
}

export interface CallStats {
  total_calls: number;
  calls_today: number;
  active_patients: number;
  avg_duration_minutes: number;
}

// =====================================================
// API BASE URL
// =====================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get auth token for API requests
 */
async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
}

/**
 * Format phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  // Format: +1 (555) 123-4567
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.substring(1, 4);
    const prefix = cleaned.substring(4, 7);
    const line = cleaned.substring(7);
    return `+1 (${areaCode}) ${prefix}-${line}`;
  }

  return phone;
}

/**
 * Get language display name
 */
export function getLanguageDisplay(code: string): string {
  const languages: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
  };
  return languages[code] || code.toUpperCase();
}

// =====================================================
// API FUNCTIONS - PATIENTS
// =====================================================

/**
 * Get all diabetes education patients
 */
export async function getDiabetesEducationPatients(): Promise<DiabetesEducationPatient[]> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/diabetes-education/patients`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch patients');
    }

    const data = await response.json();
    return data.patients || [];

  } catch (error) {
    console.error('[DiabetesEdu] Error fetching patients:', error);
    throw error;
  }
}

/**
 * Get single diabetes education patient by ID
 */
export async function getDiabetesEducationPatient(id: string): Promise<DiabetesEducationPatient> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/diabetes-education/patients/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch patient');
    }

    const data = await response.json();
    return data.patient;

  } catch (error) {
    console.error('[DiabetesEdu] Error fetching patient:', error);
    throw error;
  }
}

/**
 * Create new diabetes education patient
 */
export async function createDiabetesEducationPatient(
  patientData: CreatePatientData
): Promise<DiabetesEducationPatient> {
  try {
    const token = await getAuthToken();

    const formData = new FormData();
    formData.append('first_name', patientData.first_name);
    formData.append('last_name', patientData.last_name);
    formData.append('date_of_birth', patientData.date_of_birth);
    formData.append('phone_number', patientData.phone_number);
    formData.append('preferred_language', patientData.preferred_language);

    if (patientData.medical_document) {
      formData.append('medical_document', patientData.medical_document);
    }

    const response = await fetch(`${API_BASE_URL}/api/diabetes-education/patients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create patient');
    }

    const data = await response.json();
    return data.patient;

  } catch (error) {
    console.error('[DiabetesEdu] Error creating patient:', error);
    throw error;
  }
}

/**
 * Update diabetes education patient
 */
export async function updateDiabetesEducationPatient(
  id: string,
  updates: Partial<DiabetesEducationPatient>
): Promise<DiabetesEducationPatient> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/diabetes-education/patients/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update patient');
    }

    const data = await response.json();
    return data.patient;

  } catch (error) {
    console.error('[DiabetesEdu] Error updating patient:', error);
    throw error;
  }
}

/**
 * Deactivate diabetes education patient
 */
export async function deactivateDiabetesEducationPatient(id: string): Promise<void> {
  try {
    await updateDiabetesEducationPatient(id, { is_active: false });
  } catch (error) {
    console.error('[DiabetesEdu] Error deactivating patient:', error);
    throw error;
  }
}

// =====================================================
// API FUNCTIONS - CALLS
// =====================================================

/**
 * Get call history for a patient
 */
export async function getPatientCallHistory(patientId: string): Promise<DiabetesEducationCall[]> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/diabetes-education/patients/${patientId}/calls`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch call history');
    }

    const data = await response.json();
    return data.calls || [];

  } catch (error) {
    console.error('[DiabetesEdu] Error fetching call history:', error);
    throw error;
  }
}

/**
 * Get call statistics
 */
export async function getCallStats(): Promise<CallStats> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/diabetes-education/calls/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch call stats');
    }

    const data = await response.json();
    return data.stats;

  } catch (error) {
    console.error('[DiabetesEdu] Error fetching call stats:', error);
    throw error;
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Format duration seconds to readable string
 */
export function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format call date/time
 */
export function formatCallDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  // Allow formats: (555) 123-4567, 555-123-4567, 5551234567, +1 555 123 4567
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
}

/**
 * Get status badge color
 */
export function getCallStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'completed': 'green',
    'in-progress': 'blue',
    'failed': 'red',
    'no-answer': 'yellow',
    'busy': 'orange',
  };
  return colors[status] || 'gray';
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  // Patients
  getDiabetesEducationPatients,
  getDiabetesEducationPatient,
  createDiabetesEducationPatient,
  updateDiabetesEducationPatient,
  deactivateDiabetesEducationPatient,

  // Calls
  getPatientCallHistory,
  getCallStats,

  // Utilities
  formatPhoneDisplay,
  getLanguageDisplay,
  formatDuration,
  formatCallDateTime,
  validatePhoneNumber,
  getCallStatusColor,
};
