/**
 * Patient ID Generator Service
 *
 * Generates unique random patient identifiers:
 * - TSH ID: TSH XXX-XXX (6-digit random, format: TSH 123-456)
 * - Patient ID: NNNNNNNN (8-digit random, format: 12345678)
 *
 * Features:
 * - Random generation for privacy (no sequential numbers)
 * - Collision detection and retry logic
 * - TSH ID can be reset by staff (for patient portal access)
 * - Patient ID is PERMANENT - never changes (primary identifier)
 * - Thread-safe generation with database uniqueness constraints
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class PatientIdGeneratorService {
  constructor() {
    this.MAX_RETRIES = 10; // Maximum attempts to generate unique ID
  }

  /**
   * Generate random 6-digit number for TSH ID
   * @returns {string} 6-digit string (e.g., "123456")
   */
  generateRandom6Digits() {
    // Generate number between 100000 and 999999
    return String(Math.floor(Math.random() * 900000) + 100000);
  }

  /**
   * Generate random 8-digit number for Patient ID
   * @returns {string} 8-digit string (e.g., "12345678")
   */
  generateRandom8Digits() {
    // Generate number between 10000000 and 99999999
    return String(Math.floor(Math.random() * 90000000) + 10000000);
  }

  /**
   * Format 6-digit number as TSH ID
   * @param {string} digits - 6-digit string
   * @returns {string} Formatted TSH ID (e.g., "TSH 123-456")
   */
  formatTshId(digits) {
    if (digits.length !== 6) {
      throw new Error('TSH ID must be 6 digits');
    }
    // Format: TSH XXX-XXX
    return `TSH ${digits.substring(0, 3)}-${digits.substring(3, 6)}`;
  }

  /**
   * Generate next TSH ID with collision detection
   * @returns {Promise<string>} Generated ID in format "TSH XXX-XXX"
   */
  async generateNextTshId() {
    let attempts = 0;

    while (attempts < this.MAX_RETRIES) {
      try {
        const randomDigits = this.generateRandom6Digits();
        const tshId = this.formatTshId(randomDigits);

        // Check if this ID already exists
        const { data: existing, error: queryError } = await supabase
          .from('unified_patients')
          .select('id')
          .eq('tshla_id', tshId)
          .limit(1);

        if (queryError) {
          console.error('❌ Error checking TSH ID uniqueness:', queryError);
          throw new Error(`Failed to check TSH ID uniqueness: ${queryError.message}`);
        }

        // If no collision, return this ID
        if (!existing || existing.length === 0) {
          console.log(`✅ Generated new TSH ID: ${tshId}`);
          return tshId;
        }

        // Collision detected, retry
        attempts++;
        console.log(`⚠️  TSH ID collision detected (${tshId}), retrying... (attempt ${attempts}/${this.MAX_RETRIES})`);

      } catch (error) {
        console.error('❌ Error generating TSH ID:', error);
        throw error;
      }
    }

    // If we've exhausted all retries, throw error
    throw new Error(`Failed to generate unique TSH ID after ${this.MAX_RETRIES} attempts`);
  }

  /**
   * Generate next Patient ID with collision detection
   * @returns {Promise<string>} Generated ID in format "12345678" (8 digits)
   */
  async generateNextPatientId() {
    let attempts = 0;

    while (attempts < this.MAX_RETRIES) {
      try {
        const patientId = this.generateRandom8Digits();

        // Check if this ID already exists
        const { data: existing, error: queryError } = await supabase
          .from('unified_patients')
          .select('id')
          .eq('patient_id', patientId)
          .limit(1);

        if (queryError) {
          console.error('❌ Error checking Patient ID uniqueness:', queryError);
          throw new Error(`Failed to check Patient ID uniqueness: ${queryError.message}`);
        }

        // If no collision, return this ID
        if (!existing || existing.length === 0) {
          console.log(`✅ Generated new Patient ID: ${patientId}`);
          return patientId;
        }

        // Collision detected, retry
        attempts++;
        console.log(`⚠️  Patient ID collision detected (${patientId}), retrying... (attempt ${attempts}/${this.MAX_RETRIES})`);

      } catch (error) {
        console.error('❌ Error generating Patient ID:', error);
        throw error;
      }
    }

    // If we've exhausted all retries, throw error
    throw new Error(`Failed to generate unique Patient ID after ${this.MAX_RETRIES} attempts`);
  }

  /**
   * Validate that a TSH ID is properly formatted
   * @param {string} tshId - ID to validate
   * @returns {boolean} True if valid format
   */
  isValidTshFormat(tshId) {
    if (!tshId) return false;

    // Format: TSH XXX-XXX (e.g., "TSH 123-456")
    const pattern = /^TSH [0-9]{3}-[0-9]{3}$/;
    return pattern.test(tshId);
  }

  /**
   * Validate that a Patient ID is properly formatted
   * @param {string} patientId - ID to validate
   * @returns {boolean} True if valid format
   */
  isValidPatientIdFormat(patientId) {
    if (!patientId) return false;

    // Format: 8 digits (e.g., "12345678")
    const pattern = /^[0-9]{8}$/;
    return pattern.test(patientId);
  }

  /**
   * Check if a TSH ID already exists in the database
   * @param {string} tshId - ID to check
   * @returns {Promise<boolean>} True if ID exists
   */
  async tshIdExists(tshId) {
    if (!this.isValidTshFormat(tshId)) {
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select('id')
        .eq('tshla_id', tshId)
        .limit(1);

      if (error) {
        console.error('❌ Error checking TSH ID existence:', error);
        throw error;
      }

      return data && data.length > 0;

    } catch (error) {
      console.error('❌ Error in tshIdExists check:', error);
      throw error;
    }
  }

  /**
   * Check if a Patient ID already exists in the database
   * @param {string} patientId - ID to check
   * @returns {Promise<boolean>} True if ID exists
   */
  async patientIdExists(patientId) {
    if (!this.isValidPatientIdFormat(patientId)) {
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select('id')
        .eq('patient_id', patientId)
        .limit(1);

      if (error) {
        console.error('❌ Error checking Patient ID existence:', error);
        throw error;
      }

      return data && data.length > 0;

    } catch (error) {
      console.error('❌ Error in patientIdExists check:', error);
      throw error;
    }
  }

  /**
   * Reset TSH ID for a patient (staff function)
   * Generates a new random TSH ID and updates the patient record
   * @param {string} patientUuid - Patient's UUID
   * @returns {Promise<string>} New TSH ID
   */
  async resetTshId(patientUuid) {
    console.log(`🔄 Resetting TSH ID for patient ${patientUuid}...`);

    try {
      // Generate new TSH ID
      const newTshId = await this.generateNextTshId();

      // Update patient record
      const { error: updateError } = await supabase
        .from('unified_patients')
        .update({ tshla_id: newTshId })
        .eq('id', patientUuid);

      if (updateError) {
        console.error('❌ Failed to update TSH ID:', updateError);
        throw new Error(`Failed to update TSH ID: ${updateError.message}`);
      }

      console.log(`✅ TSH ID reset to ${newTshId} for patient ${patientUuid}`);
      return newTshId;

    } catch (error) {
      console.error('❌ Error resetting TSH ID:', error);
      throw error;
    }
  }

  /**
   * Get statistics about patient IDs
   * @returns {Promise<Object>} Stats including total patients, ID formats, etc.
   */
  async getStats() {
    try {
      // Total patients
      const { count: totalCount, error: totalError } = await supabase
        .from('unified_patients')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      // Patients with TSH IDs
      const { count: withTshCount, error: tshError } = await supabase
        .from('unified_patients')
        .select('id', { count: 'exact', head: true })
        .not('tshla_id', 'is', null)
        .eq('is_active', true);

      // Patients with Patient IDs
      const { count: withPatientIdCount, error: patientIdError } = await supabase
        .from('unified_patients')
        .select('id', { count: 'exact', head: true })
        .not('patient_id', 'is', null)
        .eq('is_active', true);

      if (totalError || tshError || patientIdError) {
        throw new Error('Failed to get stats');
      }

      return {
        totalPatients: totalCount || 0,
        patientsWithTshId: withTshCount || 0,
        patientsWithPatientId: withPatientIdCount || 0,
        idFormat: {
          tshId: 'TSH XXX-XXX (6-digit random)',
          patientId: 'NNNNNNNN (8-digit random)'
        }
      };

    } catch (error) {
      console.error('❌ Error getting stats:', error);
      throw error;
    }
  }

  // ============================================
  // LEGACY COMPATIBILITY METHODS
  // Maintain backward compatibility with old code
  // ============================================

  /**
   * @deprecated Use generateNextTshId() instead
   * Legacy method for backward compatibility
   */
  async generateNextId() {
    console.warn('⚠️  generateNextId() is deprecated. Use generateNextTshId() instead.');
    return this.generateNextTshId();
  }

  /**
   * @deprecated Use isValidTshFormat() instead
   * Legacy method for backward compatibility
   */
  isValidFormat(tshlaId) {
    console.warn('⚠️  isValidFormat() is deprecated. Use isValidTshFormat() instead.');
    return this.isValidTshFormat(tshlaId);
  }

  /**
   * @deprecated Use tshIdExists() instead
   * Legacy method for backward compatibility
   */
  async exists(tshlaId) {
    console.warn('⚠️  exists() is deprecated. Use tshIdExists() instead.');
    return this.tshIdExists(tshlaId);
  }
}

// Export singleton instance
module.exports = new PatientIdGeneratorService();
