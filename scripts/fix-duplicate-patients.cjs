/**
 * Fix Duplicate Patients and Medications
 * Merges TSH 001-xxx duplicates back to original patients
 * Re-syncs medications with correct patient_id
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDuplicatePatients() {
  console.log('🔧 FIXING DUPLICATE PATIENTS AND MEDICATIONS\n');
  console.log('=' .repeat(80) + '\n');

  // Step 1: Find all duplicates
  console.log('📋 STEP 1: Finding duplicate patients...\n');

  const { data: newPatients, error: newError } = await supabase
    .from('unified_patients')
    .select('id, tshla_id, first_name, last_name, phone_primary')
    .like('tshla_id', 'TSH 001-%')
    .order('tshla_id');

  if (newError) {
    console.error('❌ Error loading new patients:', newError.message);
    return;
  }

  console.log(`Found ${newPatients.length} TSH 001-xxx patients\n`);

  // Build duplicate mapping
  const duplicateMap = [];

  for (const newPat of newPatients) {
    const { data: original } = await supabase
      .from('unified_patients')
      .select('id, tshla_id, phone_primary')
      .eq('first_name', newPat.first_name)
      .eq('last_name', newPat.last_name)
      .neq('tshla_id', newPat.tshla_id)
      .maybeSingle();

    if (original) {
      duplicateMap.push({
        duplicate: {
          id: newPat.id,
          tshla_id: newPat.tshla_id,
          name: `${newPat.first_name} ${newPat.last_name}`
        },
        original: {
          id: original.id,
          tshla_id: original.tshla_id
        }
      });
      console.log(`✓ ${newPat.tshla_id} → ${original.tshla_id} (${newPat.first_name} ${newPat.last_name})`);
    }
  }

  console.log(`\n📊 Found ${duplicateMap.length} duplicate pairs\n`);
  console.log('=' .repeat(80) + '\n');

  // Step 2: Update H&P charts
  console.log('📋 STEP 2: Updating H&P charts to use original TSHLA IDs...\n');

  let hpUpdatedCount = 0;

  for (const pair of duplicateMap) {
    const { error: hpError } = await supabase
      .from('patient_comprehensive_chart')
      .update({ tshla_id: pair.original.tshla_id })
      .eq('tshla_id', pair.duplicate.tshla_id);

    if (hpError) {
      console.error(`⚠️  ${pair.duplicate.name}: H&P update failed - ${hpError.message}`);
    } else {
      hpUpdatedCount++;
    }
  }

  console.log(`✅ Updated ${hpUpdatedCount} H&P charts\n`);
  console.log('=' .repeat(80) + '\n');

  // Step 3: Re-sync medications with patient_id
  console.log('📋 STEP 3: Re-syncing medications with patient_id...\n');

  let totalMedsInserted = 0;
  let totalMedsSkipped = 0;

  for (const pair of duplicateMap) {
    console.log(`\n🔄 ${pair.duplicate.name}`);
    console.log(`   Original: ${pair.original.tshla_id} (patient_id: ${pair.original.id})`);

    // Get medications from H&P
    const { data: hp } = await supabase
      .from('patient_comprehensive_chart')
      .select('medications')
      .eq('tshla_id', pair.original.tshla_id)
      .maybeSingle();

    if (!hp || !hp.medications || hp.medications.length === 0) {
      console.log(`   ⏭️  No medications in H&P`);
      continue;
    }

    console.log(`   📋 Found ${hp.medications.length} medications in H&P`);

    // Check existing medications in patient_medications
    const { data: existingMeds } = await supabase
      .from('patient_medications')
      .select('medication_name, dosage, frequency')
      .eq('tshla_id', pair.original.tshla_id);

    const existingKeys = new Set(
      (existingMeds || []).map(m =>
        `${m.medication_name?.toLowerCase()}-${m.dosage?.toLowerCase()}-${m.frequency?.toLowerCase()}`
      )
    );

    let insertedCount = 0;
    let skippedCount = 0;

    for (const med of hp.medications) {
      const lookupKey = `${med.name?.toLowerCase()}-${med.dose?.toLowerCase()}-${med.frequency?.toLowerCase()}`;

      if (existingKeys.has(lookupKey)) {
        skippedCount++;
        continue;
      }

      // Insert with BOTH tshla_id and patient_id
      const { error: insertError } = await supabase
        .from('patient_medications')
        .insert({
          patient_id: pair.original.id, // UUID from unified_patients.id
          tshla_id: pair.original.tshla_id,
          medication_name: med.name,
          dosage: med.dose || '',
          frequency: med.frequency || '',
          route: med.route || 'oral',
          status: 'active',
          source: 'hp_import',
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`   ⚠️  ${med.name}: ${insertError.message}`);
      } else {
        insertedCount++;
      }
    }

    console.log(`   ✅ Inserted: ${insertedCount}, Skipped: ${skippedCount}`);
    totalMedsInserted += insertedCount;
    totalMedsSkipped += skippedCount;
  }

  console.log(`\n✅ Total medications inserted: ${totalMedsInserted}`);
  console.log(`⏭️  Total medications skipped (duplicates): ${totalMedsSkipped}\n`);
  console.log('=' .repeat(80) + '\n');

  // Step 4: Delete old medications from duplicate TSHLA IDs
  console.log('📋 STEP 4: Cleaning up old medication entries...\n');

  for (const pair of duplicateMap) {
    const { error: deleteError } = await supabase
      .from('patient_medications')
      .delete()
      .eq('tshla_id', pair.duplicate.tshla_id);

    if (deleteError) {
      console.error(`⚠️  ${pair.duplicate.tshla_id}: Failed to delete old meds - ${deleteError.message}`);
    }
  }

  console.log('✅ Cleaned up old medication entries\n');
  console.log('=' .repeat(80) + '\n');

  // Step 5: Delete duplicate patients
  console.log('📋 STEP 5: Deleting duplicate patient records...\n');

  for (const pair of duplicateMap) {
    const { error: deleteError } = await supabase
      .from('unified_patients')
      .delete()
      .eq('id', pair.duplicate.id);

    if (deleteError) {
      console.error(`⚠️  ${pair.duplicate.tshla_id}: Failed to delete - ${deleteError.message}`);
    } else {
      console.log(`✅ Deleted ${pair.duplicate.tshla_id} (${pair.duplicate.name})`);
    }
  }

  console.log('\n' + '=' .repeat(80));
  console.log('\n📊 SUMMARY:\n');
  console.log(`Duplicate pairs found: ${duplicateMap.length}`);
  console.log(`H&P charts updated: ${hpUpdatedCount}`);
  console.log(`Medications inserted: ${totalMedsInserted}`);
  console.log(`Medications skipped: ${totalMedsSkipped}`);

  console.log('\n' + '=' .repeat(80));
  console.log('\n🎯 NEXT STEPS:\n');
  console.log('1. Verify DANIEL DAUES (TSH 785-121) has medications');
  console.log('2. Check patient portal view for any patient');
  console.log('3. Test Med Refills queue at https://www.tshla.ai/staff/medication-refills\n');

  return {
    duplicates: duplicateMap.length,
    hpUpdated: hpUpdatedCount,
    medsInserted: totalMedsInserted
  };
}

// Run
fixDuplicatePatients()
  .then(stats => {
    console.log('\n✅ Fix completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
