/**
 * Patient ID Migration Script
 *
 * Migrates existing patients from old ID formats to new random ID formats:
 * - Old TSH ID: TSH-2025-0001 -> New: TSH 123-456 (6-digit random)
 * - Old Patient ID: PT-2025-0001 -> New: 12345678 (8-digit random)
 *
 * IMPORTANT: Run database migration (update-patient-ids-random.sql) FIRST!
 *
 * Usage:
 *   node scripts/migrate-patient-ids.js [--dry-run]
 *
 * Options:
 *   --dry-run  Preview changes without updating database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const patientIdGenerator = require('../server/services/patientIdGenerator.service');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Backup old IDs to audit table
 */
async function backupOldIds(patient, newPatientId, newTshId) {
  try {
    await supabase.from('patient_id_migration_history').insert({
      patient_uuid: patient.id,
      old_patient_id: patient.patient_id,
      new_patient_id: newPatientId,
      old_tsh_id: patient.tshla_id,
      new_tsh_id: newTshId,
      migrated_at: new Date().toISOString(),
      migrated_by: 'migration-script'
    });
  } catch (error) {
    console.warn(`⚠️  Could not backup old IDs for patient ${patient.id}:`, error.message);
    // Continue anyway - backup is non-critical
  }
}

/**
 * Migrate a single patient
 */
async function migratePatient(patient) {
  try {
    // Generate new random IDs
    const newPatientId = await patientIdGenerator.generateNextPatientId();
    const newTshId = await patientIdGenerator.generateNextTshId();

    console.log(`\n📋 Patient: ${patient.first_name} ${patient.last_name}`);
    console.log(`   UUID: ${patient.id}`);
    console.log(`   Old Patient ID: ${patient.patient_id || 'NULL'} -> New: ${newPatientId}`);
    console.log(`   Old TSH ID: ${patient.tshla_id || 'NULL'} -> New: ${newTshId}`);

    if (isDryRun) {
      console.log('   [DRY RUN] Would update to new IDs');
      return { success: true, dryRun: true };
    }

    // Backup old IDs (best effort, non-blocking)
    if (patient.patient_id || patient.tshla_id) {
      await backupOldIds(patient, newPatientId, newTshId);
    }

    // Update patient with new IDs
    const { error: updateError } = await supabase
      .from('unified_patients')
      .update({
        patient_id: newPatientId,
        tshla_id: newTshId,
        updated_at: new Date().toISOString()
      })
      .eq('id', patient.id);

    if (updateError) {
      console.error(`   ❌ Failed to update patient ${patient.id}:`, updateError.message);
      return { success: false, error: updateError.message };
    }

    console.log(`   ✅ Updated successfully`);
    return { success: true };

  } catch (error) {
    console.error(`   ❌ Error migrating patient ${patient.id}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main migration function
 */
async function migrateAllPatients() {
  console.log('🔄 Patient ID Migration Script');
  console.log('================================\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Get all active patients
    console.log('📊 Fetching all active patients...');
    const { data: patients, error: queryError } = await supabase
      .from('unified_patients')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (queryError) {
      throw new Error(`Failed to fetch patients: ${queryError.message}`);
    }

    if (!patients || patients.length === 0) {
      console.log('\n✅ No patients to migrate');
      return;
    }

    console.log(`\n📈 Found ${patients.length} patients to migrate\n`);

    // Migrate each patient
    const results = {
      total: patients.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      console.log(`\n[${i + 1}/${patients.length}]`);

      const result = await migratePatient(patient);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          patient_id: patient.id,
          name: `${patient.first_name} ${patient.last_name}`,
          error: result.error
        });
      }

      // Add a small delay to avoid overwhelming the database
      if (!isDryRun && i < patients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Print summary
    console.log('\n\n================================');
    console.log('📊 Migration Summary');
    console.log('================================');
    console.log(`Total patients: ${results.total}`);
    console.log(`✅ Successfully migrated: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(err => {
        console.log(`   - ${err.name} (${err.patient_id}): ${err.error}`);
      });
    }

    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration complete!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Create migration history table if it doesn't exist
async function createMigrationHistoryTable() {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS patient_id_migration_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_uuid UUID NOT NULL REFERENCES unified_patients(id),
          old_patient_id VARCHAR(20),
          new_patient_id VARCHAR(8),
          old_tsh_id VARCHAR(20),
          new_tsh_id VARCHAR(11),
          migrated_at TIMESTAMPTZ DEFAULT NOW(),
          migrated_by VARCHAR(50),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_migration_history_patient
        ON patient_id_migration_history(patient_uuid);
      `
    });

    if (error) {
      console.warn('⚠️  Could not create migration history table:', error.message);
      console.warn('   Migration will continue without backup history');
    }
  } catch (error) {
    // Ignore - this is a nice-to-have
  }
}

// Run migration
(async () => {
  await createMigrationHistoryTable();
  await migrateAllPatients();
})();
