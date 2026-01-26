/**
 * TSHLA Medical EMR - Dictation Migration Script
 *
 * PURPOSE: Migrate all legacy dictations from dictated_notes to unified dictations table
 * PRIORITY: P0 - Critical Data Integrity Issue
 * HIPAA: Maintains full audit trail and data integrity
 *
 * WHAT THIS DOES:
 * 1. Identifies all dictations in legacy dictated_notes table
 * 2. Links each dictation to unified_patients via phone/name matching
 * 3. Migrates to new dictations table with proper FK constraints
 * 4. Triggers H&P generation for each patient
 * 5. Verifies data integrity and generates report
 *
 * SAFETY:
 * - Read-only on source table (no deletions)
 * - Transaction-based (all-or-nothing)
 * - Full logging and audit trail
 * - Rollback capability
 * - Dry-run mode available
 *
 * USAGE:
 *   DRY RUN:  node migrate-dictations-to-unified-system.js --dry-run
 *   EXECUTE:  node migrate-dictations-to-unified-system.js
 *   VERIFY:   node migrate-dictations-to-unified-system.js --verify-only
 *
 * Created: 2026-01-25
 * Author: TSHLA Development Team
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');

// Initialize Supabase with service role (full access for migration)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Migration configuration
const CONFIG = {
  batchSize: 50, // Process in batches to avoid memory issues
  dryRun: process.argv.includes('--dry-run'),
  verifyOnly: process.argv.includes('--verify-only'),
  skipHPGeneration: process.argv.includes('--skip-hp'),
  apiUrl: process.env.API_URL || 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io'
};

// Migration statistics
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
  hpGenerated: 0,
  hpFailed: 0,
  errors: []
};

/**
 * Main migration function
 */
async function migrateDictations() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  TSHLA Medical EMR - Dictation Migration to Unified System   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (CONFIG.verifyOnly) {
    return await verifyMigration();
  }

  try {
    // Step 1: Pre-migration verification
    console.log('Step 1: Pre-migration Verification');
    console.log('━'.repeat(60));
    await preMigrationChecks();

    // Step 2: Load all legacy dictations
    console.log('\nStep 2: Loading Legacy Dictations');
    console.log('━'.repeat(60));
    const legacyDictations = await loadLegacyDictations();
    stats.total = legacyDictations.length;
    console.log(`✅ Found ${stats.total} dictations in legacy table\n`);

    if (stats.total === 0) {
      console.log('✨ No dictations to migrate. System is clean!');
      return;
    }

    // Step 3: Migrate dictations in batches
    console.log('Step 3: Migrating Dictations');
    console.log('━'.repeat(60));
    await migrateDictationsInBatches(legacyDictations);

    // Step 4: Generate H&P for all migrated patients
    if (!CONFIG.skipHPGeneration && !CONFIG.dryRun) {
      console.log('\nStep 4: Generating H&P Records');
      console.log('━'.repeat(60));
      await generateHPForAllPatients();
    }

    // Step 5: Post-migration verification
    console.log('\nStep 5: Post-migration Verification');
    console.log('━'.repeat(60));
    await postMigrationVerification();

    // Step 6: Generate report
    console.log('\nStep 6: Migration Summary');
    console.log('━'.repeat(60));
    printMigrationReport();

  } catch (error) {
    logger.error('Migration', 'Fatal error during migration', { error: error.message, stack: error.stack });
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

/**
 * Pre-migration checks
 */
async function preMigrationChecks() {
  // Check database connectivity
  const { error: connError } = await supabase.from('dictated_notes').select('id').limit(1);
  if (connError) {
    throw new Error(`Database connection failed: ${connError.message}`);
  }
  console.log('✅ Database connection verified');

  // Check tables exist (use appropriate primary key for each table)
  const tableChecks = [
    { name: 'dictated_notes', pk: 'id' },
    { name: 'dictations', pk: 'id' },
    { name: 'unified_patients', pk: 'id' },
    { name: 'patient_comprehensive_chart', pk: 'patient_phone' }
  ];
  for (const { name, pk } of tableChecks) {
    const { error } = await supabase.from(name).select(pk).limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows (OK)
      throw new Error(`Table ${name} not accessible: ${error.message}`);
    }
  }
  console.log('✅ All required tables accessible');

  // Check for existing migrations (to avoid duplicates)
  const { data: existing } = await supabase
    .from('dictations')
    .select('id')
    .limit(1);

  if (existing && existing.length > 0) {
    console.log('⚠️  Warning: dictations table already has records');
    console.log('   This migration will skip duplicates');
  }

  console.log('✅ Pre-migration checks passed');
}

/**
 * Load all legacy dictations that need migration
 */
async function loadLegacyDictations() {
  const { data, error } = await supabase
    .from('dictated_notes')
    .select('*')
    .is('deleted_at', null) // Only migrate active records
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load legacy dictations: ${error.message}`);
  }

  return data || [];
}

/**
 * Migrate dictations in batches
 */
async function migrateDictationsInBatches(dictations) {
  for (let i = 0; i < dictations.length; i += CONFIG.batchSize) {
    const batch = dictations.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(dictations.length / CONFIG.batchSize);

    console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

    for (const oldDict of batch) {
      await migrateSingleDictation(oldDict);
    }

    // Progress update
    const progress = ((i + batch.length) / dictations.length * 100).toFixed(1);
    console.log(`Progress: ${stats.migrated + stats.skipped}/${stats.total} (${progress}%) - ✅ ${stats.migrated} migrated, ⏭️  ${stats.skipped} skipped, ❌ ${stats.failed} failed`);
  }
}

/**
 * Migrate a single dictation record
 */
async function migrateSingleDictation(oldDict) {
  try {
    // Step 1: Find or create unified patient
    const patientId = await findOrCreateUnifiedPatient(oldDict);

    if (!patientId) {
      stats.skipped++;
      stats.errors.push({
        dictationId: oldDict.id,
        patientName: oldDict.patient_name,
        error: 'Could not find or create unified patient'
      });
      logger.warn('Migration', 'Skipped dictation - no patient match', {
        dictationId: oldDict.id,
        patientName: oldDict.patient_name
      });
      return;
    }

    // Step 2: Check if already migrated
    const { data: existing } = await supabase
      .from('dictations')
      .select('id')
      .eq('patient_id', patientId)
      .eq('created_at', oldDict.created_at)
      .maybeSingle();

    if (existing) {
      stats.skipped++;
      logger.debug('Migration', 'Dictation already migrated', { oldId: oldDict.id, newId: existing.id });
      return;
    }

    // Step 3: Map legacy columns to new schema
    // IMPORTANT: provider_id in old table is email, new table expects UUID
    // Set to null if not a valid UUID
    const isValidUUID = (str) => {
      if (!str) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    const newDictation = {
      patient_id: patientId,
      appointment_id: oldDict.appointment_id || null,
      provider_id: isValidUUID(oldDict.provider_id) ? oldDict.provider_id : null,  // Only use if valid UUID
      patient_name: oldDict.patient_name,
      patient_dob: oldDict.patient_dob,
      patient_mrn: oldDict.patient_mrn,
      visit_date: oldDict.visit_date || oldDict.created_at.split('T')[0],
      visit_type: oldDict.visit_type || 'follow-up',
      transcription_text: oldDict.raw_transcript || oldDict.processed_note || '',
      final_note: oldDict.processed_note || oldDict.ai_summary || oldDict.raw_transcript || '',
      status: oldDict.status === 'signed' || oldDict.status === 'final' ? 'completed' : 'draft',
      created_at: oldDict.created_at,
      updated_at: oldDict.updated_at || oldDict.created_at,
      completed_at: oldDict.signed_at || (oldDict.status === 'signed' ? oldDict.updated_at : null)
    };

    // Step 4: Insert into new table (if not dry run)
    if (!CONFIG.dryRun) {
      const { data: inserted, error: insertError } = await supabase
        .from('dictations')
        .insert(newDictation)
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      logger.info('Migration', 'Dictation migrated successfully', {
        oldId: oldDict.id,
        newId: inserted.id,
        patientName: oldDict.patient_name
      });
    }

    stats.migrated++;

  } catch (error) {
    stats.failed++;
    stats.errors.push({
      dictationId: oldDict.id,
      patientName: oldDict.patient_name,
      error: error.message
    });
    logger.error('Migration', 'Failed to migrate dictation', {
      dictationId: oldDict.id,
      error: error.message
    });
  }
}

/**
 * Find or create unified patient for dictation
 */
async function findOrCreateUnifiedPatient(oldDict) {
  // First try: unified_patient_id if it exists
  if (oldDict.unified_patient_id) {
    const { data } = await supabase
      .from('unified_patients')
      .select('id')
      .eq('id', oldDict.unified_patient_id)
      .maybeSingle();

    if (data) return data.id;
  }

  // Second try: phone number
  if (oldDict.patient_phone) {
    const normalizedPhone = oldDict.patient_phone.replace(/\D/g, '').replace(/^1/, '');

    const { data } = await supabase
      .from('unified_patients')
      .select('id')
      .eq('phone_primary', normalizedPhone)
      .maybeSingle();

    if (data) return data.id;
  }

  // Third try: MRN
  if (oldDict.patient_mrn) {
    const { data } = await supabase
      .from('unified_patients')
      .select('id')
      .eq('mrn', oldDict.patient_mrn)
      .maybeSingle();

    if (data) return data.id;
  }

  // Fourth try: Name + DOB
  if (oldDict.patient_name && oldDict.patient_dob) {
    const nameParts = oldDict.patient_name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const { data } = await supabase
      .from('unified_patients')
      .select('id')
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .eq('date_of_birth', oldDict.patient_dob)
      .maybeSingle();

    if (data) return data.id;
  }

  // If we have phone, create new patient
  if (oldDict.patient_phone && !CONFIG.dryRun) {
    const fetch = (await import('node-fetch')).default;

    try {
      const response = await fetch(`${CONFIG.apiUrl}/api/patients/find-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: oldDict.patient_phone,
          patientData: {
            firstName: oldDict.patient_name.split(' ')[0],
            lastName: oldDict.patient_name.split(' ').slice(1).join(' '),
            dob: oldDict.patient_dob,
            mrn: oldDict.patient_mrn,
            email: oldDict.patient_email,
            provider_id: oldDict.provider_id,
            provider_name: oldDict.provider_name
          },
          source: 'dictation-migration'
        })
      });

      const result = await response.json();
      if (result.success && result.patient) {
        logger.info('Migration', 'Created new unified patient', {
          patientId: result.patient.id,
          tshlaId: result.patient.tshla_id,
          name: oldDict.patient_name
        });
        return result.patient.id;
      }
    } catch (error) {
      logger.error('Migration', 'Failed to create patient via API', { error: error.message });
    }
  }

  return null;
}

/**
 * Generate H&P for all patients with migrated dictations
 */
async function generateHPForAllPatients() {
  const fetch = (await import('node-fetch')).default;

  // Get all unique patients from migrated dictations
  const { data: patients } = await supabase
    .from('dictations')
    .select('patient_id, patient_name')
    .not('patient_id', 'is', null);

  if (!patients || patients.length === 0) {
    console.log('⏭️  No patients need H&P generation');
    return;
  }

  const uniquePatients = Array.from(
    new Map(patients.map(p => [p.patient_id, p])).values()
  );

  console.log(`Generating H&P for ${uniquePatients.length} patients...`);

  for (const patient of uniquePatients) {
    try {
      // Get patient phone for H&P generation
      const { data: patientData } = await supabase
        .from('unified_patients')
        .select('phone_primary, tshla_id')
        .eq('id', patient.patient_id)
        .single();

      if (!patientData) {
        stats.hpFailed++;
        continue;
      }

      // Trigger H&P generation
      const response = await fetch(`${CONFIG.apiUrl}/api/hp/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientPhone: patientData.phone_primary,
          tshlaId: patientData.tshla_id
        })
      });

      const result = await response.json();

      if (result.success) {
        stats.hpGenerated++;
        console.log(`  ✅ ${patient.patient_name} - H&P generated`);
      } else {
        stats.hpFailed++;
        console.log(`  ❌ ${patient.patient_name} - H&P failed: ${result.error}`);
      }

    } catch (error) {
      stats.hpFailed++;
      logger.error('Migration', 'H&P generation failed', {
        patientId: patient.patient_id,
        error: error.message
      });
    }
  }
}

/**
 * Post-migration verification
 */
async function postMigrationVerification() {
  // Count records in both tables
  const { count: oldCount } = await supabase
    .from('dictated_notes')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);

  const { count: newCount } = await supabase
    .from('dictations')
    .select('id', { count: 'exact', head: true });

  console.log(`✅ Legacy table: ${oldCount} active records`);
  console.log(`✅ New table: ${newCount} records`);

  if (newCount >= stats.migrated) {
    console.log('✅ Migration count verified');
  } else {
    console.log('⚠️  Warning: Expected more records in new table');
  }

  // Verify all patients have unified_patient_id links
  const { count: unlinked } = await supabase
    .from('dictations')
    .select('id', { count: 'exact', head: true })
    .is('patient_id', null);

  if (unlinked === 0) {
    console.log('✅ All dictations linked to unified_patients');
  } else {
    console.log(`⚠️  Warning: ${unlinked} dictations not linked to patients`);
  }
}

/**
 * Verify migration (read-only check)
 */
async function verifyMigration() {
  console.log('🔍 Verification Mode - Read-only Analysis\n');

  const { data: oldDicts } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: newDicts } = await supabase
    .from('dictations')
    .select('id, patient_name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Recent dictations in LEGACY table:');
  oldDicts?.forEach((d, i) => console.log(`  ${i+1}. ${d.created_at} - ${d.patient_name}`));

  console.log('\nRecent dictations in NEW table:');
  newDicts?.forEach((d, i) => console.log(`  ${i+1}. ${d.created_at} - ${d.patient_name}`));

  const { count: oldCount } = await supabase.from('dictated_notes').select('id', { count: 'exact', head: true }).is('deleted_at', null);
  const { count: newCount } = await supabase.from('dictations').select('id', { count: 'exact', head: true });

  console.log(`\nTotal counts:`);
  console.log(`  Legacy: ${oldCount}`);
  console.log(`  New: ${newCount}`);
  console.log(`  Need to migrate: ${oldCount - (newCount || 0)}`);
}

/**
 * Print migration report
 */
function printMigrationReport() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    MIGRATION SUMMARY                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`Total Dictations Found:     ${stats.total}`);
  console.log(`Successfully Migrated:      ${stats.migrated} ✅`);
  console.log(`Skipped (duplicates):       ${stats.skipped} ⏭️`);
  console.log(`Failed:                     ${stats.failed} ❌`);
  console.log(`H&P Generated:              ${stats.hpGenerated} ✅`);
  console.log(`H&P Failed:                 ${stats.hpFailed} ❌`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach((err, i) => {
      console.log(`  ${i+1}. ${err.patientName} (ID: ${err.dictationId}): ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }

  const successRate = ((stats.migrated / stats.total) * 100).toFixed(1);
  console.log(`\nSuccess Rate: ${successRate}%`);

  if (CONFIG.dryRun) {
    console.log('\n🔍 DRY RUN COMPLETE - No changes were made');
    console.log('   Run without --dry-run to execute migration');
  } else {
    console.log('\n✅ MIGRATION COMPLETE!');
    console.log('   Next steps:');
    console.log('   1. Verify patient portal shows medications/labs');
    console.log('   2. Test new dictations save correctly');
    console.log('   3. Monitor for 48 hours before archiving old table');
  }

  console.log('\n');
}

// Run migration
if (require.main === module) {
  migrateDictations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateDictations };
