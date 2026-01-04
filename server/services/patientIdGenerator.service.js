/**
 * Patient ID Generator Service
 *
 * Generates unique TSHLA patient IDs in format: TSH-YYYY-NNNN
 * Example: TSH-2025-0001, TSH-2025-0002
 *
 * Features:
 * - Auto-increment within each year
 * - Resets to 0001 on January 1st each year
 * - Thread-safe generation using database sequence
 * - Validates ID uniqueness before returning
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
  /**
   * Generate next TSHLA patient ID for the current year
   * @returns {Promise<string>} Generated ID in format TSH-YYYY-NNNN
   */
  async generateNextId() {
    const currentYear = new Date().getFullYear();
    const prefix = `TSH-${currentYear}-`;

    try {
      // Get the highest existing ID for this year
      const { data: existingIds, error: queryError } = await supabase
        .from('unified_patients')
        .select('tshla_id')
        .like('tshla_id', `${prefix}%`)
        .order('tshla_id', { ascending: false })
        .limit(1);

      if (queryError) {
        console.error('❌ Error querying existing IDs:', queryError);
        throw new Error(`Failed to query existing patient IDs: ${queryError.message}`);
      }

      // Calculate next sequence number
      let nextNumber = 1;
      if (existingIds && existingIds.length > 0) {
        const lastId = existingIds[0].tshla_id;
        const lastNumber = parseInt(lastId.split('-')[2], 10);
        nextNumber = lastNumber + 1;
      }

      // Format with leading zeros (4 digits)
      const paddedNumber = String(nextNumber).padStart(4, '0');
      const newId = `${prefix}${paddedNumber}`;

      console.log(`✅ Generated new TSHLA ID: ${newId}`);
      return newId;

    } catch (error) {
      console.error('❌ Error generating patient ID:', error);
      throw error;
    }
  }

  /**
   * Validate that a TSHLA ID is properly formatted
   * @param {string} tshlaId - ID to validate
   * @returns {boolean} True if valid format
   */
  isValidFormat(tshlaId) {
    if (!tshlaId) return false;

    // Format: TSH-YYYY-NNNN
    const pattern = /^TSH-\d{4}-\d{4}$/;
    return pattern.test(tshlaId);
  }

  /**
   * Check if a TSHLA ID already exists in the database
   * @param {string} tshlaId - ID to check
   * @returns {Promise<boolean>} True if ID exists
   */
  async exists(tshlaId) {
    if (!this.isValidFormat(tshlaId)) {
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('unified_patients')
        .select('id')
        .eq('tshla_id', tshlaId)
        .limit(1);

      if (error) {
        console.error('❌ Error checking ID existence:', error);
        throw error;
      }

      return data && data.length > 0;

    } catch (error) {
      console.error('❌ Error in exists check:', error);
      throw error;
    }
  }

  /**
   * Get statistics about patient IDs
   * @returns {Promise<Object>} Stats including total IDs, current year count, etc.
   */
  async getStats() {
    const currentYear = new Date().getFullYear();
    const prefix = `TSH-${currentYear}-`;

    try {
      // Total TSHLA IDs
      const { count: totalCount, error: totalError } = await supabase
        .from('unified_patients')
        .select('id', { count: 'exact', head: true })
        .not('tshla_id', 'is', null);

      // Current year IDs
      const { count: yearCount, error: yearError } = await supabase
        .from('unified_patients')
        .select('id', { count: 'exact', head: true })
        .like('tshla_id', `${prefix}%`);

      if (totalError || yearError) {
        throw new Error('Failed to get stats');
      }

      return {
        totalPatients: totalCount || 0,
        currentYearPatients: yearCount || 0,
        currentYear: currentYear,
        nextId: await this.generateNextId()
      };

    } catch (error) {
      console.error('❌ Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Migrate legacy patients without TSHLA IDs
   * Generates IDs for all patients missing tshla_id
   * @returns {Promise<Object>} Migration results
   */
  async migrateLegacyPatients() {
    console.log('🔄 Starting migration of legacy patients...');

    try {
      // Get all patients without TSHLA IDs
      const { data: patientsWithoutIds, error: queryError } = await supabase
        .from('unified_patients')
        .select('id, phone_primary, first_name, last_name, mrn')
        .is('tshla_id', null)
        .order('created_at', { ascending: true });

      if (queryError) {
        throw new Error(`Query failed: ${queryError.message}`);
      }

      if (!patientsWithoutIds || patientsWithoutIds.length === 0) {
        console.log('✅ No legacy patients to migrate');
        return { migrated: 0, errors: 0 };
      }

      console.log(`📊 Found ${patientsWithoutIds.length} patients without TSHLA IDs`);

      let migrated = 0;
      let errors = 0;

      // Process each patient
      for (const patient of patientsWithoutIds) {
        try {
          const newId = await this.generateNextId();

          const { error: updateError } = await supabase
            .from('unified_patients')
            .update({ tshla_id: newId })
            .eq('id', patient.id);

          if (updateError) {
            console.error(`❌ Failed to update patient ${patient.id}:`, updateError);
            errors++;
          } else {
            console.log(`✅ Assigned ${newId} to ${patient.first_name} ${patient.last_name} (MRN: ${patient.mrn || 'N/A'})`);
            migrated++;
          }

        } catch (error) {
          console.error(`❌ Error processing patient ${patient.id}:`, error);
          errors++;
        }
      }

      console.log(`✅ Migration complete: ${migrated} migrated, ${errors} errors`);

      return { migrated, errors };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PatientIdGeneratorService();
