/**
 * Migrate medications from duplicate TSH 001-xxx patients to original patients
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateMedicationsToOriginalPatients() {
  console.log('🔄 Migrating medications from duplicate patients to originals...\n');

  // Get all TSH 001-xxx patients
  const { data: newPatients, error: newError } = await supabase
    .from('unified_patients')
    .select('tshla_id, first_name, last_name, phone_primary, full_name')
    .like('tshla_id', 'TSH 001-%')
    .order('tshla_id');

  if (newError) {
    console.error('❌ Error loading new patients:', newError.message);
    return;
  }

  console.log(`Found ${newPatients.length} new patients (TSH 001-xxx)\n`);
  console.log('=' .repeat(70) + '\n');

  let migratedCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const newPat of newPatients) {
    // Find original patient with same name
    const { data: existing } = await supabase
      .from('unified_patients')
      .select('tshla_id, phone_primary')
      .eq('first_name', newPat.first_name)
      .eq('last_name', newPat.last_name)
      .neq('tshla_id', newPat.tshla_id)
      .maybeSingle();

    if (!existing) {
      console.log(`⏭️  ${newPat.tshla_id} (${newPat.full_name}) - No original found`);
      skipCount++;
      continue;
    }

    console.log(`\n🔄 ${newPat.full_name}`);
    console.log(`   From: ${newPat.tshla_id} -> To: ${existing.tshla_id}`);

    try {
      // Get medications from new patient
      const { data: meds, error: medsError } = await supabase
        .from('patient_medications')
        .select('*')
        .eq('tshla_id', newPat.tshla_id);

      if (medsError) throw new Error(`Failed to fetch meds: ${medsError.message}`);

      if (!meds || meds.length === 0) {
        console.log(`   ⏭️  No medications to migrate`);
        skipCount++;
        continue;
      }

      console.log(`   📋 Found ${meds.length} medications`);

      // Check if original patient already has these medications
      const { data: existingMeds } = await supabase
        .from('patient_medications')
        .select('medication_name, dosage, frequency')
        .eq('tshla_id', existing.tshla_id);

      // Create lookup key for duplicates
      const existingKeys = new Set(
        (existingMeds || []).map(m =>
          `${m.medication_name?.toLowerCase()}-${m.dosage?.toLowerCase()}-${m.frequency?.toLowerCase()}`
        )
      );

      let insertedCount = 0;
      let skippedDupeCount = 0;

      for (const med of meds) {
        const lookupKey = `${med.medication_name?.toLowerCase()}-${med.dosage?.toLowerCase()}-${med.frequency?.toLowerCase()}`;

        if (existingKeys.has(lookupKey)) {
          skippedDupeCount++;
          continue;
        }

        // Insert medication with original patient's TSHLA ID
        const { error: insertError } = await supabase
          .from('patient_medications')
          .insert({
            tshla_id: existing.tshla_id,
            medication_name: med.medication_name,
            dosage: med.dosage,
            frequency: med.frequency,
            route: med.route,
            sig: med.sig,
            status: med.status,
            prescribed_by: med.prescribed_by,
            prescribed_at: med.prescribed_at,
            source: med.source,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`   ⚠️  Failed to insert: ${med.medication_name} - ${insertError.message}`);
        } else {
          insertedCount++;
        }
      }

      console.log(`   ✅ Migrated: ${insertedCount} medications`);
      if (skippedDupeCount > 0) {
        console.log(`   ⏭️  Skipped (duplicates): ${skippedDupeCount}`);
      }

      // Delete medications from duplicate patient
      const { error: deleteError } = await supabase
        .from('patient_medications')
        .delete()
        .eq('tshla_id', newPat.tshla_id);

      if (deleteError) {
        console.warn(`   ⚠️  Failed to delete old meds: ${deleteError.message}`);
      }

      // Update H&P chart to use original TSHLA ID
      const { error: hpUpdateError } = await supabase
        .from('patient_comprehensive_chart')
        .update({ tshla_id: existing.tshla_id })
        .eq('tshla_id', newPat.tshla_id);

      if (hpUpdateError) {
        console.warn(`   ⚠️  Failed to update H&P: ${hpUpdateError.message}`);
      }

      migratedCount++;

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 SUMMARY:\n');
  console.log(`Total new patients: ${newPatients.length}`);
  console.log(`✅ Migrated: ${migratedCount}`);
  console.log(`⏭️  Skipped (no original/no meds): ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  console.log('\n' + '=' .repeat(70));
  console.log('\n🎯 NEXT STEPS:\n');
  console.log('1. Delete duplicate TSH 001-xxx patient records (optional cleanup)');
  console.log('2. Verify medications now appear in original patient charts');
  console.log('3. Check Med Refills queue at https://www.tshla.ai/staff/medication-refills\n');

  return { migrated: migratedCount, skipped: skipCount, errors: errorCount };
}

migrateMedicationsToOriginalPatients()
  .then(stats => {
    process.exit(stats && stats.errors > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
