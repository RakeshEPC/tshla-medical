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
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

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
      console.error('Error finding patient by phone:', error);
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
      console.error('Error finding patient by MRN:', error);
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

      // Generate patient ID using database function
      const { data: patientIdData, error: idError } = await supabase
        .rpc('get_next_unified_patient_id');

      if (idError) {
        console.error('Error generating patient ID:', idError);
        throw new Error('Failed to generate patient ID');
      }

      const generatedPatientId = patientIdData;

      // Prepare patient record
      const newPatient = {
        // Phone (master identifier)
        phone_primary: normalized,
        phone_display: this.formatPhoneDisplay(normalized),

        // Auto-generated patient ID
        patient_id: generatedPatientId,

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
        console.error('Error creating patient:', error);
        throw error;
      }

      // Get the auto-generated patient_id
      const { data: updatedPatient, error: updateError } = await supabase
        .from('unified_patients')
        .update({ patient_id: await this.getNextPatientId() })
        .eq('id', patient.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating patient ID:', updateError);
      }

      console.log('✅ Created new patient:', {
        id: patient.id,
        name: `${firstName || ''} ${lastName || ''}`.trim(),
        phone: normalized,
        source: source,
        pin: pin // LOG PIN FOR NOW (remove in production, send via SMS instead)
      });

      // TODO: Send SMS with portal credentials
      // await this.sendWelcomeSMS(normalized, pin, patient.patient_id);

      return updatedPatient || patient;
    } catch (error) {
      console.error('Error creating patient:', error);
      throw error;
    }
  }

  /**
   * Get next patient ID from database function
   */
  async getNextPatientId() {
    const { data, error } = await supabase.rpc('get_next_unified_patient_id');
    if (error) throw error;
    return data;
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
        console.log('ℹ️  No new data to merge for patient:', patientId);
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

      console.log('✅ Merged data for patient:', {
        id: patientId,
        source: source,
        fieldsUpdated: fieldsUpdated
      });

      return updatedPatient;
    } catch (error) {
      console.error('Error merging patient data:', error);
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
      console.error('Error logging merge history:', error);
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
        console.log('📋 Found existing patient:', patient.id);
        return await this.mergePatientData(patient.id, patientData, source);
      }

      // Patient doesn't exist - create new
      console.log('🆕 Creating new patient from', source);
      return await this.createPatient(phone, patientData, source);
    } catch (error) {
      console.error('Error in findOrCreatePatient:', error);
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

      console.log(`✅ Linked ${tableName} record ${recordId} to patient ${patientId}`);
    } catch (error) {
      console.error(`Error linking ${tableName} to patient:`, error);
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

      // Check if it's a phone number or patient ID
      if (identifier.includes('-')) {
        // It's a patient ID (PT-2025-0001)
        const { data } = await supabase
          .from('unified_patients')
          .select('*')
          .eq('patient_id', identifier)
          .single();
        patient = data;
      } else {
        // It's a phone number
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

      return {
        patient,
        dictations: dictations || [],
        previsitResponses: previsitResponses || [],
        appointments: appointments || [],
        pumpAssessments: pumpAssessments || [],

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
      console.error('Error getting patient chart:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PatientMatchingService();
