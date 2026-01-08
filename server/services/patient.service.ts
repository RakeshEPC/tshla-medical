/**
 * Patient Service
 * Handles patient record creation, matching, and management for pre-visit system
 * Created: January 2025
 * HIPAA COMPLIANT: Uses safe logger with PHI sanitization
 */

import { createClient } from '@supabase/supabase-js';
import logger = require('../logger');

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  );
}

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =====================================================
// INTERFACES
// =====================================================

export interface SchedulePatientData {
  patient_name: string;
  patient_phone?: string;
  patient_dob?: string; // ISO date string
  patient_email?: string;
  provider_id: string;
  appointment_date: string; // ISO date string
}

export interface PatientCreateData {
  first_name: string;
  last_name: string;
  phone_primary?: string;
  email?: string;
  date_of_birth?: string;
  provider_id: string;
  next_appointment_date: string;
}

export interface Patient {
  id: string; // UUID
  patient_id: string; // P-2025-0001
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  phone_primary: string;
  email?: string;
  provider_id: string;
  next_appointment_date?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Clean phone number to digits only
 */
export function cleanPhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, ''); // Remove all non-digits
}

/**
 * Parse first name from full name
 */
export function parseFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || '';
}

/**
 * Parse last name from full name
 */
export function parseLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(1).join(' ') || parts[0]; // If no last name, use first name
}

/**
 * Calculate name similarity using Levenshtein distance
 * Returns value between 0 (no match) and 1 (exact match)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = name1.toLowerCase().trim();
  const s2 = name2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  // Levenshtein distance algorithm
  const matrix: number[][] = [];
  const len1 = s1.length;
  const len2 = s2.length;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1.0 : 1.0 - distance / maxLen;
}

// =====================================================
// CORE PATIENT FUNCTIONS
// =====================================================

/**
 * Update patient's last appointment date
 */
export async function updateLastAppointment(
  patientId: string,
  appointmentDate: string
): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .update({
      next_appointment_date: appointmentDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', patientId);

  if (error) {
    logger.error('PatientService', 'Error updating patient appointment', { error: error.message });
    throw error;
  }
}

/**
 * Create new patient record with auto-generated patient ID
 */
export async function createNewPatient(
  data: PatientCreateData
): Promise<string> {
  try {
    // Get next patient ID using database function
    const { data: nextIdData, error: idError } = await supabase.rpc(
      'get_next_patient_id'
    );

    if (idError) {
      logger.error('PatientService', 'Error generating patient ID', { error: idError.message });
      throw idError;
    }

    const patientId = nextIdData as string;

    // Insert new patient
    const { data: newPatient, error: insertError } = await supabase
      .from('patients')
      .insert({
        patient_id: patientId,
        first_name: data.first_name,
        last_name: data.last_name,
        phone_primary: data.phone_primary || null,
        email: data.email || null,
        date_of_birth: data.date_of_birth || null,
        provider_id: data.provider_id,
        next_appointment_date: data.next_appointment_date,
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError) {
      logger.error('PatientService', 'Error inserting patient', { error: insertError.message });
      throw insertError;
    }

    logger.info('PatientService', 'Created new patient', { patientId });

    return newPatient.id;
  } catch (error: any) {
    logger.error('PatientService', 'Failed to create patient', { error: error.message });
    throw error;
  }
}

/**
 * Find existing patient or create new one
 * Uses matching algorithm: Phone → Name+DOB → Fuzzy name → Create new
 */
export async function findOrCreatePatient(
  scheduleEntry: SchedulePatientData
): Promise<string> {
  try {
    // STEP 1: Try exact match by phone (most reliable)
    if (scheduleEntry.patient_phone) {
      const cleanedPhone = cleanPhone(scheduleEntry.patient_phone);

      if (cleanedPhone.length >= 10) {
        const { data: phoneMatch, error: phoneError } = await supabase
          .from('patients')
          .select('id, full_name, patient_id')
          .eq('phone_primary', cleanedPhone)
          .single();

        if (!phoneError && phoneMatch) {
          logger.info('PatientService', 'Found patient by phone', { patientId: phoneMatch.patient_id });
          await updateLastAppointment(
            phoneMatch.id,
            scheduleEntry.appointment_date
          );
          return phoneMatch.id;
        }
      }
    }

    // STEP 2: Try match by name + DOB (strong match)
    if (scheduleEntry.patient_dob) {
      const { data: nameDobMatch, error: nameDobError } = await supabase
        .from('patients')
        .select('id, full_name, patient_id')
        .ilike('full_name', scheduleEntry.patient_name)
        .eq('date_of_birth', scheduleEntry.patient_dob)
        .single();

      if (!nameDobError && nameDobMatch) {
        logger.info('PatientService', 'Found patient by name and DOB', { patientId: nameDobMatch.patient_id });

        // Update phone if it was missing
        if (scheduleEntry.patient_phone) {
          await supabase
            .from('patients')
            .update({ phone_primary: cleanPhone(scheduleEntry.patient_phone) })
            .eq('id', nameDobMatch.id);
        }

        await updateLastAppointment(
          nameDobMatch.id,
          scheduleEntry.appointment_date
        );
        return nameDobMatch.id;
      }
    }

    // STEP 3: Try fuzzy name match for same provider (medium confidence)
    const firstName = parseFirstName(scheduleEntry.patient_name);
    const { data: fuzzyMatches, error: fuzzyError } = await supabase
      .from('patients')
      .select('id, full_name, patient_id, phone_primary')
      .eq('provider_id', scheduleEntry.provider_id)
      .ilike('first_name', `${firstName}%`);

    if (!fuzzyError && fuzzyMatches && fuzzyMatches.length === 1) {
      // Only if we find exactly one match
      const similarity = calculateNameSimilarity(
        scheduleEntry.patient_name,
        fuzzyMatches[0].full_name
      );

      if (similarity > 0.85) {
        logger.info('PatientService', 'Found patient by fuzzy name match', {
          patientId: fuzzyMatches[0].patient_id,
          similarity: Math.round(similarity * 100)
        });
        await updateLastAppointment(
          fuzzyMatches[0].id,
          scheduleEntry.appointment_date
        );
        return fuzzyMatches[0].id;
      }
    }

    // STEP 4: No match found - create new patient
    logger.info('PatientService', 'No match found, creating new patient');
    const newPatientId = await createNewPatient({
      first_name: parseFirstName(scheduleEntry.patient_name),
      last_name: parseLastName(scheduleEntry.patient_name),
      phone_primary: scheduleEntry.patient_phone
        ? cleanPhone(scheduleEntry.patient_phone)
        : undefined,
      email: scheduleEntry.patient_email,
      date_of_birth: scheduleEntry.patient_dob,
      provider_id: scheduleEntry.provider_id,
      next_appointment_date: scheduleEntry.appointment_date,
    });

    return newPatientId;
  } catch (error: any) {
    logger.error('PatientService', 'Error in findOrCreatePatient', { error: error.message });
    throw error;
  }
}

/**
 * Get patient by ID
 */
export async function getPatientById(patientId: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single();

  if (error) {
    logger.error('PatientService', 'Error fetching patient by ID', { error: error.message });
    return null;
  }

  return data as Patient;
}

/**
 * Get patient by patient_id (P-2025-0001 format)
 */
export async function getPatientByPatientId(
  patientId: string
): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('patient_id', patientId)
    .single();

  if (error) {
    logger.error('PatientService', 'Error fetching patient by patient_id', { error: error.message });
    return null;
  }

  return data as Patient;
}

/**
 * Search patients by name
 */
export async function searchPatientsByName(
  name: string,
  providerId?: string
): Promise<Patient[]> {
  let query = supabase
    .from('patients')
    .select('*')
    .ilike('full_name', `%${name}%`)
    .limit(10);

  if (providerId) {
    query = query.eq('provider_id', providerId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('PatientService', 'Error searching patients', { error: error.message });
    return [];
  }

  return (data as Patient[]) || [];
}

/**
 * Update patient opt-out preferences
 */
export async function updatePatientOptOutPreferences(
  patientId: string,
  preferences: {
    opt_out_automated_calls?: boolean;
    opt_out_text_messages?: boolean;
    opt_out_email?: boolean;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('patients')
    .update(preferences)
    .eq('id', patientId);

  if (error) {
    logger.error('PatientService', 'Error updating opt-out preferences', { error: error.message });
    return false;
  }

  return true;
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  findOrCreatePatient,
  createNewPatient,
  updateLastAppointment,
  getPatientById,
  getPatientByPatientId,
  searchPatientsByName,
  updatePatientOptOutPreferences,
  cleanPhone,
  parseFirstName,
  parseLastName,
  calculateNameSimilarity,
};
