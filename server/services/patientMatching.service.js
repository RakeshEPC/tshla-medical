/**
 * Patient Matching Service
 * Phone-first unified patient management
 *
 * Purpose:
 * - Find existing patients by phone number
 * - Create new patients from various sources (dictation, previsit, schedule, PDF)
 * - Intelligently merge data from multiple sources
 * - Prevent duplicate patient records
 *
 * Created: 2025-01-16
 * HIPAA COMPLIANT: Uses safe logger with PHI sanitization
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const patientIdGenerator = require('./patientIdGenerator.service');
const nightscoutService = require('./nightscout.service');
const logger = require('../logger');
const { toNormalized, toE164, allFormats } = require('../utils/phoneNormalize');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for backend operations
);

class PatientMatchingService {
  /**
   * Normalize phone number to standard format (digits only)
   *
   * @param {string} phone - Phone number in any format
   * @returns {string} - Normalized phone (e.g., "5551234567")
   */
  normalizePhone(phone) {
    if (!phone) return null;

    // Remove all non-numeric characters
    const normalized = phone.replace(/[^0-9]/g, '');

    // Remove leading '1' if it's an 11-digit US number
    if (normalized.length === 11 && normalized.startsWith('1')) {
      return normalized.substring(1);
    }

    return normalized;
  }

  /**
   * Format phone for display
   *
   * @param {string} phone - Normalized phone number
   * @returns {string} - Formatted phone (e.g., "(555) 123-4567")
   */
  formatPhoneDisplay(phone) {
    if (!phone) return null;

    const normalized = this.normalizePhone(phone);

    if (normalized.length === 10) {
      return `(${normalized.substring(0, 3)}) ${normalized.substring(3, 6)}-${normalized.substring(6, 10)}`;
    }

    return phone; // Return as-is if can't format
  }

  /**
   * Extract name parts from full name string
   *
   * @param {string} fullName - Full name (e.g., "John Smith")
   * @returns {Object} - {firstName, lastName}
   */
  parseFullName(fullName) {
    if (!fullName) return { firstName: null, lastName: null };

    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: null };
    }

    if (parts.length === 2) {
      return { firstName: parts[0], lastName: parts[1] };
    }

    // For 3+ parts, take first as firstName, rest as lastName
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  }

  /**
   * Find patient by phone number
   *
   * @param {string} phone - Phone number (any format)
   * @returns {Promise<Object|null>} - Patient record or null
   */
  async findPatientByPhone(phone) {
    const normalized = this.normalizePhone(phone);

    if (!normalized) {
      throw new Error('Invalid phone number');
    }

    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select('*')
        .eq('phone_primary', normalized)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('PatientMatching', 'Error finding patient by phone', { error: error.message });
      throw error;
    }
  }

  /**
   * Find patient by MRN
   *
   * @param {string} mrn - Medical record number
   * @returns {Promise<Object|null>} - Patient record or null
   */
  async findPatientByMRN(mrn) {
    if (!mrn) return null;

    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select('*')
        .eq('mrn', mrn)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('PatientMatching', 'Error finding patient by MRN', { error: error.message });
      throw error;
    }
  }

  /**
   * Find patient by Patient ID (8-digit)
   *
   * @param {string} patientId - Patient ID (e.g., "12345678")
   * @returns {Promise<Object|null>} - Patient record or null
   */
  async findPatientByPatientId(patientId) {
    if (!patientId) return null;

    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select('*')
        .eq('patient_id', patientId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('PatientMatching', 'Error finding patient by Patient ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Find patient by TSH ID (6-digit)
   *
   * @param {string} tshId - TSH ID (e.g., "TSH 123-456")
   * @returns {Promise<Object|null>} - Patient record or null
   */
  async findPatientByTshId(tshId) {
    if (!tshId) return null;

    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select('*')
        .eq('tshla_id', tshId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('PatientMatching', 'Error finding patient by TSH ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Find patient by email
   *
   * @param {string} email - Email address
   * @returns {Promise<Object|null>} - Patient record or null
   */
  async findPatientByEmail(email) {
    if (!email) return null;

    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('PatientMatching', 'Error finding patient by email', { error: error.message });
      throw error;
    }
  }

  /**
   * Search patients by name (first and/or last name)
   *
   * @param {string} firstName - First name (optional)
   * @param {string} lastName - Last name (optional)
   * @returns {Promise<Array>} - Array of matching patients
   */
  async searchPatientsByName(firstName, lastName) {
    if (!firstName && !lastName) {
      return [];
    }

    try {
      let query = supabase
        .from('unified_patients')
        .select('*')
        .eq('is_active', true);

      if (firstName && lastName) {
        // Both first and last name provided
        query = query
          .ilike('first_name', `%${firstName}%`)
          .ilike('last_name', `%${lastName}%`);
      } else if (firstName) {
        // Only first name
        query = query.ilike('first_name', `%${firstName}%`);
      } else {
        // Only last name
        query = query.ilike('last_name', `%${lastName}%`);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('PatientMatching', 'Error searching patients by name', { error: error.message });
      throw error;
    }
  }

  /**
   * Search patients by date of birth
   *
   * @param {string} dob - Date of birth (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array of matching patients
   */
  async searchPatientsByDOB(dob) {
    if (!dob) return [];

    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select('*')
        .eq('date_of_birth', dob)
        .eq('is_active', true)
        .limit(50);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('PatientMatching', 'Error searching patients by DOB', { error: error.message });
      throw error;
    }
  }

  /**
   * Advanced patient search across all demographics
   * Supports: Patient ID, TSH ID, Phone, MRN, First Name, Last Name, Email, DOB
   *
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Array>} - Array of matching patients
   */
  async searchPatients(searchParams) {
    const {
      patientId,
      tshId,
      phone,
      mrn,
      firstName,
      lastName,
      email,
      dob,
      query // Generic text search
    } = searchParams;

    try {
      // If specific ID is provided, search by ID first
      if (patientId) {
        const patient = await this.findPatientByPatientId(patientId);
        return patient ? [patient] : [];
      }

      if (tshId) {
        const patient = await this.findPatientByTshId(tshId);
        return patient ? [patient] : [];
      }

      if (mrn) {
        const patient = await this.findPatientByMRN(mrn);
        return patient ? [patient] : [];
      }

      if (phone) {
        const patient = await this.findPatientByPhone(phone);
        return patient ? [patient] : [];
      }

      if (email) {
        const patient = await this.findPatientByEmail(email);
        return patient ? [patient] : [];
      }

      // If first/last name provided
      if (firstName || lastName) {
        return await this.searchPatientsByName(firstName, lastName);
      }

      // If DOB provided
      if (dob) {
        return await this.searchPatientsByDOB(dob);
      }

      // Generic text search - try to match across multiple fields
      if (query) {
        const searchTerm = query.trim();

        // Build OR query for multiple fields
        const { data, error } = await supabase
          .from('unified_patients')
          .select('*')
          .or(`patient_id.eq.${searchTerm},tshla_id.ilike.%${searchTerm}%,phone_primary.ilike.%${searchTerm}%,mrn.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
          .eq('is_active', true)
          .limit(50);

        if (error) {
          throw error;
        }

        return data || [];
      }

      return [];
    } catch (error) {
      logger.error('PatientMatching', 'Error searching patients', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate random 6-digit PIN
   *
   * @returns {string} - 6-digit PIN
   */
  generatePIN() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Hash PIN for secure storage
   *
   * @param {string} pin - Plain text PIN
   * @returns {Promise<string>} - Hashed PIN
   */
  async hashPIN(pin) {
    return bcrypt.hash(pin, 10);
  }

  /**
   * Verify PIN against hashed value
   *
   * @param {string} pin - Plain text PIN
   * @param {string} hashedPIN - Hashed PIN from database
   * @returns {Promise<boolean>} - True if PIN matches
   */
  async verifyPIN(pin, hashedPIN) {
    return bcrypt.compare(pin, hashedPIN);
  }

  /**
   * Create new patient record
   *
   * @param {string} phone - Phone number (required)
   * @param {Object} patientData - Patient data from source
   * @param {string} source - Data source ('previsit' | 'dictation' | 'schedule' | 'pdf' | 'manual')
   * @returns {Promise<Object>} - Created patient record
   */
  async createPatient(phone, patientData, source) {
    const normalized = this.normalizePhone(phone);

    if (!normalized) {
      throw new Error('Valid phone number is required to create patient');
    }

    try {
      // Parse name if fullName provided but not firstName/lastName
      let firstName = patientData.firstName || patientData.first_name;
      let lastName = patientData.lastName || patientData.last_name;

      if (!firstName && !lastName && patientData.name) {
        const parsed = this.parseFullName(patientData.name);
        firstName = parsed.firstName;
        lastName = parsed.lastName;
      }

      // Generate patient portal PIN
      const pin = this.generatePIN();
      const hashedPIN = await this.hashPIN(pin);

      // Generate random 8-digit Patient ID (PERMANENT)
      const generatedPatientId = await patientIdGenerator.generateNextPatientId();

      // Generate random 6-digit TSH ID (for portal access)
      const generatedTshId = await patientIdGenerator.generateNextTshId();

      // Prepare patient record
      const newPatient = {
        // Phone (master identifier)
        phone_primary: normalized,
        phone_display: this.formatPhoneDisplay(normalized),

        // Auto-generated patient IDs
        patient_id: generatedPatientId, // 8-digit random (PERMANENT)
        tshla_id: generatedTshId, // TSH XXX-XXX (6-digit random, for portal)

        // Demographics
        first_name: firstName || null,
        last_name: lastName || null,
        date_of_birth: patientData.dob || patientData.date_of_birth || null,
        gender: patientData.gender || null,
        email: patientData.email || null,
        phone_secondary: patientData.phone_secondary || null,

        // Address
        address_line1: patientData.address || patientData.address_line1 || null,
        city: patientData.city || null,
        state: patientData.state || null,
        zip_code: patientData.zip || patientData.zip_code || null,

        // Insurance
        insurance_provider: patientData.insurance_provider || null,
        insurance_member_id: patientData.insurance_id || patientData.insurance_member_id || null,

        // Clinical data
        active_conditions: patientData.conditions || patientData.diagnoses || [],
        current_medications: patientData.medications || [],
        allergies: patientData.allergies || [],

        // MRN if available
        mrn: patientData.mrn || null,

        // Provider
        primary_provider_id: patientData.provider_id || null,
        primary_provider_name: patientData.provider_name || null,

        // Source tracking
        created_from: source,
        data_sources: [source],
        created_by: patientData.created_by || source,

        // Portal access
        has_portal_access: true, // Enable by default
        portal_pin: hashedPIN,

        // Status
        is_active: true,
        patient_status: 'active'
      };

      // Insert patient
      const { data: patient, error } = await supabase
        .from('unified_patients')
        .insert(newPatient)
        .select()
        .single();

      if (error) {
        logger.error('PatientMatching', 'Error creating patient', { error: error.message });
        throw error;
      }

      logger.info('PatientMatching', 'Created new patient', {
        patientId: generatedPatientId,
        tshId: generatedTshId,
        source: source
      });

      // TODO: Send SMS with portal credentials
      // await this.sendWelcomeSMS(normalized, pin, patient.patient_id, patient.tshla_id);

      return patient;
    } catch (error) {
      logger.error('PatientMatching', 'Error creating patient', { error: error.message });
      throw error;
    }
  }

  /**
   * Merge new data into existing patient record
   *
   * @param {string} patientId - Patient UUID
   * @param {Object} newData - New data to merge
   * @param {string} source - Data source
   * @returns {Promise<Object>} - Updated patient record
   */
  async mergePatientData(patientId, newData, source) {
    try {
      // Get existing patient
      const { data: existingPatient, error: fetchError } = await supabase
        .from('unified_patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (fetchError) throw fetchError;

      // Prepare update object (only update fields that are not null and not already set)
      const updates = {};
      const fieldsUpdated = [];

      // Helper to update field if new value is better
      const updateField = (field, newValue, currentValue) => {
        if (newValue && (!currentValue || currentValue === '')) {
          updates[field] = newValue;
          fieldsUpdated.push(field);
          return true;
        }
        return false;
      };

      // Demographics
      updateField('first_name', newData.firstName || newData.first_name, existingPatient.first_name);
      updateField('last_name', newData.lastName || newData.last_name, existingPatient.last_name);
      updateField('date_of_birth', newData.dob || newData.date_of_birth, existingPatient.date_of_birth);
      updateField('gender', newData.gender, existingPatient.gender);
      updateField('email', newData.email, existingPatient.email);

      // Address
      updateField('address_line1', newData.address || newData.address_line1, existingPatient.address_line1);
      updateField('city', newData.city, existingPatient.city);
      updateField('state', newData.state, existingPatient.state);
      updateField('zip_code', newData.zip || newData.zip_code, existingPatient.zip_code);

      // Insurance
      updateField('insurance_provider', newData.insurance_provider, existingPatient.insurance_provider);
      updateField('insurance_member_id', newData.insurance_id || newData.insurance_member_id, existingPatient.insurance_member_id);

      // MRN
      updateField('mrn', newData.mrn, existingPatient.mrn);

      // Provider
      updateField('primary_provider_id', newData.provider_id, existingPatient.primary_provider_id);
      updateField('primary_provider_name', newData.provider_name, existingPatient.primary_provider_name);

      // Clinical data (append, don't overwrite)
      if (newData.conditions && newData.conditions.length > 0) {
        const existingConditions = existingPatient.active_conditions || [];
        const mergedConditions = [...new Set([...existingConditions, ...newData.conditions])];
        if (mergedConditions.length > existingConditions.length) {
          updates.active_conditions = mergedConditions;
          fieldsUpdated.push('active_conditions');
        }
      }

      if (newData.medications && newData.medications.length > 0) {
        const existingMeds = existingPatient.current_medications || [];
        const mergedMeds = [...existingMeds, ...newData.medications];
        updates.current_medications = mergedMeds;
        fieldsUpdated.push('current_medications');
      }

      if (newData.allergies && newData.allergies.length > 0) {
        const existingAllergies = existingPatient.allergies || [];
        const mergedAllergies = [...new Set([...existingAllergies, ...newData.allergies])];
        if (mergedAllergies.length > existingAllergies.length) {
          updates.allergies = mergedAllergies;
          fieldsUpdated.push('allergies');
        }
      }

      // Add source to data_sources array
      const dataSources = existingPatient.data_sources || [];
      if (!dataSources.includes(source)) {
        updates.data_sources = [...dataSources, source];
      }

      // Update last merge timestamp
      updates.last_data_merge_at = new Date().toISOString();

      // Only update if there are changes
      if (Object.keys(updates).length === 0) {
        logger.info('PatientMatching', 'No new data to merge for patient', { patientId });
        return existingPatient;
      }

      // Perform update
      const { data: updatedPatient, error: updateError } = await supabase
        .from('unified_patients')
        .update(updates)
        .eq('id', patientId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Log merge to history
      await this.logMergeHistory(patientId, source, fieldsUpdated, newData);

      logger.info('PatientMatching', 'Merged data for patient', {
        patientId,
        source,
        fieldsCount: fieldsUpdated.length
      });

      return updatedPatient;
    } catch (error) {
      logger.error('PatientMatching', 'Error merging patient data', { error: error.message });
      throw error;
    }
  }

  /**
   * Log merge history for audit trail
   */
  async logMergeHistory(patientId, source, fieldsUpdated, dataMerged) {
    try {
      await supabase.from('patient_merge_history').insert({
        patient_id: patientId,
        merge_source: source,
        fields_updated: fieldsUpdated,
        data_merged: dataMerged,
        merge_strategy: 'smart_merge',
        merged_by: source
      });
    } catch (error) {
      logger.error('PatientMatching', 'Error logging merge history', { error: error.message });
      // Don't throw - this is non-critical
    }
  }

  /**
   * Find or create patient (main entry point)
   *
   * @param {string} phone - Phone number (required)
   * @param {Object} patientData - Patient data
   * @param {string} source - Data source
   * @returns {Promise<Object>} - Patient record (existing or new)
   */
  async findOrCreatePatient(phone, patientData, source) {
    try {
      // Try to find existing patient
      let patient = await this.findPatientByPhone(phone);

      // If not found by phone, try MRN (if provided)
      if (!patient && patientData.mrn) {
        patient = await this.findPatientByMRN(patientData.mrn);
      }

      if (patient) {
        // Patient exists - merge new data
        logger.info('PatientMatching', 'Found existing patient', { patientId: patient.id });
        return await this.mergePatientData(patient.id, patientData, source);
      }

      // Patient doesn't exist - create new
      logger.info('PatientMatching', 'Creating new patient', { source });
      return await this.createPatient(phone, patientData, source);
    } catch (error) {
      logger.error('PatientMatching', 'Error in findOrCreatePatient', { error: error.message });
      throw error;
    }
  }

  /**
   * Link existing record to unified patient
   *
   * @param {string} tableName - Table to update (e.g., 'dictated_notes')
   * @param {string} recordId - Record ID to link
   * @param {string} patientId - Unified patient ID
   */
  async linkRecordToPatient(tableName, recordId, patientId) {
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ unified_patient_id: patientId })
        .eq('id', recordId);

      if (error) throw error;

      logger.info('PatientMatching', 'Linked record to patient', { tableName, recordId, patientId });
    } catch (error) {
      logger.error('PatientMatching', 'Error linking record to patient', { tableName, error: error.message });
      throw error;
    }
  }

  /**
   * Get patient chart (all data from all sources)
   *
   * @param {string} phone - Phone number or patient ID
   * @returns {Promise<Object>} - Complete patient chart
   */
  async getPatientChart(identifier) {
    try {
      // Try to find patient
      let patient;

      // Try patient_id first (any format: PT-2025-0001, 61024475, etc.)
      const { data: byId } = await supabase
        .from('unified_patients')
        .select('*')
        .eq('patient_id', identifier)
        .single();
      patient = byId;

      // Fall back to phone number lookup
      if (!patient) {
        patient = await this.findPatientByPhone(identifier);
      }

      if (!patient) {
        throw new Error('Patient not found');
      }

      // Get all related data
      const [
        { data: dictations },
        { data: previsitResponses },
        { data: appointments },
        { data: pumpAssessments }
      ] = await Promise.all([
        supabase
          .from('dictated_notes')
          .select('*')
          .eq('unified_patient_id', patient.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('previsit_responses')
          .select('*')
          .eq('unified_patient_id', patient.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('provider_schedules')
          .select('*')
          .eq('unified_patient_id', patient.id)
          .order('scheduled_date', { ascending: false }),

        supabase
          .from('pump_assessments')
          .select('*')
          .eq('unified_patient_id', patient.id)
          .order('created_at', { ascending: false })
      ]);

      // Get CGM summary
      let cgm = null;
      try {
        cgm = await this.getCGMSummary(patient.id, patient.phone_primary);
      } catch (cgmErr) {
        logger.error('PatientMatching', 'CGM summary fetch failed', { error: cgmErr.message });
      }

      return {
        patient,
        dictations: dictations || [],
        previsitResponses: previsitResponses || [],
        appointments: appointments || [],
        pumpAssessments: pumpAssessments || [],
        cgm,

        // Summary stats
        stats: {
          totalVisits: dictations?.length || 0,
          totalPrevisitCalls: previsitResponses?.length || 0,
          totalAppointments: appointments?.length || 0,
          lastVisit: dictations?.[0]?.created_at || null,
          nextAppointment: appointments?.find(a => new Date(a.scheduled_date) > new Date())?.scheduled_date || null
        }
      };
    } catch (error) {
      logger.error('PatientMatching', 'Error getting patient chart', { error: error.message });
      throw error;
    }
  }

  /**
   * Get CGM summary for a patient (current glucose, 14-day stats, config status)
   */
  async getCGMSummary(patientId, phoneNormalized) {
    // Find config using all phone formats
    const formats = allFormats(phoneNormalized);
    if (formats.length === 0) return null;

    const orFilter = formats.map(f => `patient_phone.eq.${f}`).join(',');
    const { data: config } = await supabase
      .from('patient_nightscout_config')
      .select('id, patient_phone, data_source, sync_enabled, connection_status, last_sync_at, last_successful_sync_at')
      .or(orFilter)
      .limit(1)
      .single();

    if (!config) return null;

    // Get most recent reading
    const { data: latestReadings } = await supabase
      .from('cgm_readings')
      .select('glucose_value, glucose_units, trend_direction, trend_arrow, reading_timestamp')
      .or(orFilter)
      .order('reading_timestamp', { ascending: false })
      .limit(1);

    const latest = latestReadings?.[0] || null;
    let currentGlucose = null;
    if (latest) {
      const minutesAgo = Math.round((Date.now() - new Date(latest.reading_timestamp).getTime()) / 60000);
      currentGlucose = {
        glucoseValue: latest.glucose_value,
        glucoseUnits: latest.glucose_units,
        trendDirection: latest.trend_direction,
        trendArrow: latest.trend_arrow,
        readingTimestamp: latest.reading_timestamp,
        minutesAgo,
      };
    }

    // Get 14-day readings for stats
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: readings14d } = await supabase
      .from('cgm_readings')
      .select('glucose_value')
      .or(orFilter)
      .gte('reading_timestamp', fourteenDaysAgo)
      .order('reading_timestamp', { ascending: false });

    let stats14day = null;
    if (readings14d && readings14d.length > 0) {
      stats14day = nightscoutService.calculateStatistics(
        readings14d.map(r => ({ glucoseValue: r.glucose_value }))
      );
    }

    // Visit comparison: compare current 14-day stats with pre-visit stats
    let comparison = null;
    try {
      if (stats14day && patientId) {
        // Find most recent visit for this patient
        const { data: recentVisit } = await supabase
          .from('dictated_notes')
          .select('visit_date')
          .eq('unified_patient_id', patientId)
          .order('visit_date', { ascending: false })
          .limit(1)
          .single();

        if (recentVisit?.visit_date) {
          const visitDate = new Date(recentVisit.visit_date);
          const preVisitEnd = visitDate.toISOString();
          const preVisitStart = new Date(visitDate.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

          const { data: preVisitReadings } = await supabase
            .from('cgm_readings')
            .select('glucose_value')
            .or(orFilter)
            .gte('reading_timestamp', preVisitStart)
            .lt('reading_timestamp', preVisitEnd);

          if (preVisitReadings && preVisitReadings.length >= 50) {
            const preStats = nightscoutService.calculateStatistics(
              preVisitReadings.map(r => ({ glucoseValue: r.glucose_value }))
            );

            const daysSinceVisit = Math.round((Date.now() - visitDate.getTime()) / (24 * 60 * 60 * 1000));
            comparison = {
              lastVisitDate: recentVisit.visit_date,
              periodLabel: `Since last visit (${daysSinceVisit} days)`,
              changes: [
                {
                  metric: 'avgGlucose',
                  label: 'Avg Glucose',
                  before: preStats.avgGlucose,
                  after: stats14day.avgGlucose,
                  delta: stats14day.avgGlucose - preStats.avgGlucose,
                  improved: stats14day.avgGlucose < preStats.avgGlucose,
                  unit: 'mg/dl',
                },
                {
                  metric: 'timeInRangePercent',
                  label: 'Time in Range',
                  before: preStats.timeInRangePercent,
                  after: stats14day.timeInRangePercent,
                  delta: stats14day.timeInRangePercent - preStats.timeInRangePercent,
                  improved: stats14day.timeInRangePercent > preStats.timeInRangePercent,
                  unit: '%',
                },
                {
                  metric: 'estimatedA1c',
                  label: 'Est. A1C',
                  before: preStats.estimatedA1c,
                  after: stats14day.estimatedA1c,
                  delta: Math.round((stats14day.estimatedA1c - preStats.estimatedA1c) * 10) / 10,
                  improved: stats14day.estimatedA1c < preStats.estimatedA1c,
                  unit: '%',
                },
              ],
            };
          }
        }
      }
    } catch (compErr) {
      // Non-critical, skip comparison silently
    }

    return {
      configured: true,
      dataSource: config.data_source,
      connectionStatus: config.connection_status,
      syncEnabled: config.sync_enabled,
      lastSync: config.last_successful_sync_at || config.last_sync_at,
      currentGlucose,
      stats14day,
      comparison,
    };
  }
}

// Export singleton instance
module.exports = new PatientMatchingService();
