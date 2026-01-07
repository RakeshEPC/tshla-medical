/**
 * Patient Search Service
 *
 * Provides patient lookup functionality by:
 * - Phone number (primary identifier)
 * - Name (first, last, or full)
 * - MRN (Medical Record Number)
 * - Patient ID
 *
 * Returns enriched patient data for appointment creation/editing
 */

import { supabase } from '../lib/supabase';
import { logError, logInfo, logDebug } from './logger.service';

export interface PatientSearchResult {
  id: string;
  patient_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone_primary: string;
  phone_display?: string;
  email?: string;
  date_of_birth?: string;
  age?: number;
  gender?: string;
  mrn?: string;
  tshla_id?: string;

  // Additional metadata
  last_visit_date?: string;
  total_visits?: number;
  primary_provider_name?: string;
  is_active: boolean;
}

export interface PatientCreateData {
  first_name: string;
  last_name: string;
  phone_primary: string;
  phone_display?: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  mrn?: string;

  // Metadata
  created_from: 'manual' | 'schedule' | 'previsit';
  created_by?: string;
}

class PatientSearchService {
  /**
   * Search patients by query string
   * Searches across: name, phone, MRN, patient_id
   */
  async searchPatients(query: string, limit: number = 10): Promise<PatientSearchResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      logDebug('PatientSearchService', `Searching for: "${query}"`);

      const searchTerm = query.trim().toLowerCase();

      // Normalize phone for search (remove all non-digits)
      const phoneNumbers = searchTerm.match(/\d+/g);
      const normalizedPhone = phoneNumbers ? phoneNumbers.join('') : '';

      // Build search query
      let dbQuery = supabase
        .from('unified_patients')
        .select(`
          id,
          patient_id,
          first_name,
          last_name,
          full_name,
          phone_primary,
          phone_display,
          email,
          date_of_birth,
          age,
          gender,
          mrn,
          tshla_id,
          last_visit_date,
          total_visits,
          primary_provider_name,
          is_active
        `)
        .eq('is_active', true)
        .limit(limit);

      // Search by phone (if query contains numbers)
      if (normalizedPhone.length >= 3) {
        dbQuery = dbQuery.or(`phone_primary.ilike.%${normalizedPhone}%,phone_display.ilike.%${searchTerm}%`);
      }
      // Search by name
      else if (searchTerm.length >= 2) {
        dbQuery = dbQuery.or(`
          first_name.ilike.%${searchTerm}%,
          last_name.ilike.%${searchTerm}%,
          full_name.ilike.%${searchTerm}%,
          patient_id.ilike.%${searchTerm}%,
          mrn.ilike.%${searchTerm}%
        `);
      }

      const { data, error } = await dbQuery;

      if (error) {
        logError('PatientSearchService', 'Search error', { error, query });
        throw error;
      }

      logInfo('PatientSearchService', `Found ${data?.length || 0} patients matching "${query}"`);

      return data as PatientSearchResult[] || [];
    } catch (error) {
      logError('PatientSearchService', 'Search failed', { error, query });
      return [];
    }
  }

  /**
   * Search patient by exact phone number
   */
  async findByPhone(phone: string): Promise<PatientSearchResult | null> {
    try {
      // Normalize phone (remove formatting)
      const normalizedPhone = phone.replace(/\D/g, '');

      if (normalizedPhone.length < 10) {
        return null;
      }

      const { data, error } = await supabase
        .from('unified_patients')
        .select(`
          id,
          patient_id,
          first_name,
          last_name,
          full_name,
          phone_primary,
          phone_display,
          email,
          date_of_birth,
          age,
          gender,
          mrn,
          tshla_id,
          last_visit_date,
          total_visits,
          primary_provider_name,
          is_active
        `)
        .eq('phone_primary', normalizedPhone)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        logError('PatientSearchService', 'Find by phone error', { error, phone });
        throw error;
      }

      return data as PatientSearchResult || null;
    } catch (error) {
      logError('PatientSearchService', 'Find by phone failed', { error, phone });
      return null;
    }
  }

  /**
   * Search patient by MRN
   */
  async findByMRN(mrn: string): Promise<PatientSearchResult | null> {
    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select(`
          id,
          patient_id,
          first_name,
          last_name,
          full_name,
          phone_primary,
          phone_display,
          email,
          date_of_birth,
          age,
          gender,
          mrn,
          tshla_id,
          last_visit_date,
          total_visits,
          primary_provider_name,
          is_active
        `)
        .eq('mrn', mrn)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        logError('PatientSearchService', 'Find by MRN error', { error, mrn });
        throw error;
      }

      return data as PatientSearchResult || null;
    } catch (error) {
      logError('PatientSearchService', 'Find by MRN failed', { error, mrn });
      return null;
    }
  }

  /**
   * Get patient by ID
   */
  async getPatientById(id: string): Promise<PatientSearchResult | null> {
    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select(`
          id,
          patient_id,
          first_name,
          last_name,
          full_name,
          phone_primary,
          phone_display,
          email,
          date_of_birth,
          age,
          gender,
          mrn,
          tshla_id,
          last_visit_date,
          total_visits,
          primary_provider_name,
          is_active
        `)
        .eq('id', id)
        .single();

      if (error) {
        logError('PatientSearchService', 'Get by ID error', { error, id });
        throw error;
      }

      return data as PatientSearchResult;
    } catch (error) {
      logError('PatientSearchService', 'Get by ID failed', { error, id });
      return null;
    }
  }

  /**
   * Create a new patient
   */
  async createPatient(patientData: PatientCreateData): Promise<PatientSearchResult | null> {
    try {
      // Normalize phone
      const normalizedPhone = patientData.phone_primary.replace(/\D/g, '');

      // Check if patient already exists
      const existing = await this.findByPhone(normalizedPhone);
      if (existing) {
        logInfo('PatientSearchService', 'Patient already exists', { phone: normalizedPhone });
        return existing;
      }

      // Calculate age if DOB provided
      let age: number | undefined;
      if (patientData.date_of_birth) {
        const dob = new Date(patientData.date_of_birth);
        const today = new Date();
        age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
      }

      // Format display phone
      const phoneDisplay = this.formatPhoneDisplay(normalizedPhone);

      // Generate full name
      const fullName = `${patientData.first_name} ${patientData.last_name}`.trim();

      const { data, error } = await supabase
        .from('unified_patients')
        .insert({
          first_name: patientData.first_name,
          last_name: patientData.last_name,
          full_name: fullName,
          phone_primary: normalizedPhone,
          phone_display: phoneDisplay,
          email: patientData.email,
          date_of_birth: patientData.date_of_birth,
          age,
          gender: patientData.gender,
          mrn: patientData.mrn,
          created_from: patientData.created_from || 'manual',
          created_by: patientData.created_by,
          is_active: true,
          data_sources: [patientData.created_from || 'manual']
        })
        .select()
        .single();

      if (error) {
        logError('PatientSearchService', 'Create patient error', { error, patientData });
        throw error;
      }

      logInfo('PatientSearchService', 'Patient created successfully', { id: data.id, phone: normalizedPhone });

      return data as PatientSearchResult;
    } catch (error) {
      logError('PatientSearchService', 'Create patient failed', { error, patientData });
      return null;
    }
  }

  /**
   * Format phone number for display
   * Example: 5551234567 -> (555) 123-4567
   */
  formatPhoneDisplay(phone: string): string {
    const normalized = phone.replace(/\D/g, '');

    if (normalized.length === 10) {
      return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
    } else if (normalized.length === 11 && normalized[0] === '1') {
      // US number with country code
      return `+1 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7)}`;
    }

    return phone; // Return as-is if can't format
  }

  /**
   * Normalize phone number (remove all formatting)
   * Example: (555) 123-4567 -> 5551234567
   */
  normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Validate phone number
   */
  isValidPhone(phone: string): boolean {
    const normalized = this.normalizePhone(phone);
    return normalized.length === 10 || (normalized.length === 11 && normalized[0] === '1');
  }

  /**
   * Get recent patients (for quick access)
   */
  async getRecentPatients(limit: number = 20): Promise<PatientSearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select(`
          id,
          patient_id,
          first_name,
          last_name,
          full_name,
          phone_primary,
          phone_display,
          email,
          date_of_birth,
          age,
          gender,
          mrn,
          tshla_id,
          last_visit_date,
          total_visits,
          primary_provider_name,
          is_active
        `)
        .eq('is_active', true)
        .order('last_visit_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logError('PatientSearchService', 'Get recent patients error', { error });
        throw error;
      }

      return data as PatientSearchResult[] || [];
    } catch (error) {
      logError('PatientSearchService', 'Get recent patients failed', { error });
      return [];
    }
  }
}

export const patientSearchService = new PatientSearchService();
