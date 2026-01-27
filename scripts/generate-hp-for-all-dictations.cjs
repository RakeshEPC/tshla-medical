/**
 * Batch H&P Generation for All Dictations
 * Processes all dictations from dictated_notes table and generates H&P charts
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Import H&P generator service
const hpGeneratorPath = path.join(__dirname, '../server/services/comprehensiveHPGenerator.service.js');
const hpGenerator = require(hpGeneratorPath);

async function generateHPForAllDictations() {
  console.log('🚀 Starting batch H&P generation for all dictations...\n');

  // 1. Load all dictations from dictated_notes table
  const { data: dictations, error: dictationsError } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, patient_phone, provider_name, created_at, raw_transcript, processed_note, status')
    .order('created_at', { ascending: true }); // Process oldest first

  if (dictationsError) {
    console.error('❌ Error loading dictations:', dictationsError.message);
    return;
  }

  console.log(`📝 Found ${dictations?.length || 0} total dictations\n`);

  if (!dictations || dictations.length === 0) {
    console.log('⚠️  No dictations found to process!\n');
    return;
  }

  // 2. Group by patient phone to process all dictations per patient
  const patientGroups = {};
  dictations.forEach(dict => {
    const key = dict.patient_phone || 'no-phone';
    if (!patientGroups[key]) {
      patientGroups[key] = {
        phone: dict.patient_phone,
        name: dict.patient_name,
        dictations: []
      };
    }
    patientGroups[key].dictations.push(dict);
  });

  const uniquePatients = Object.values(patientGroups).filter(p => p.phone && p.phone !== 'no-phone');
  console.log(`👥 Found ${uniquePatients.length} unique patients with valid phone numbers\n`);
  console.log('=' .repeat(70) + '\n');

  // 3. Process each patient
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (const patient of uniquePatients) {
    console.log(`\n🔄 Processing patient: ${patient.name} (${patient.phone})`);
    console.log(`   Dictations: ${patient.dictations.length}`);

    try {
      // Get patient's TSHLA ID from unified_patients or generate one
      let tshlaId = await getOrCreateTshlaId(patient.phone, patient.name);

      // Process all dictations for this patient sequentially
      for (const dictation of patient.dictations) {
        console.log(`   📄 Processing dictation from ${dictation.created_at?.substring(0, 10)}...`);

        // Copy dictation to unified 'dictations' table if not already there
        // The H&P generator expects dictations in the 'dictations' table
        const unifiedDictationId = await copyToUnifiedDictations(dictation, patient.phone, tshlaId);

        // Generate H&P using the service
        const hp = await hpGenerator.generateOrUpdateHP(patient.phone, {
          newDictationId: unifiedDictationId
        });

        console.log(`   ✅ H&P updated (version ${hp.version})`);
        console.log(`      Medications: ${hp.medications?.length || 0}`);
        console.log(`      Diagnoses: ${hp.diagnoses?.length || 0}`);
        console.log(`      Labs: ${Object.keys(hp.labs || {}).length} types`);
      }

      successCount++;
      console.log(`   ✅ Successfully processed all dictations for ${patient.name}`);

    } catch (error) {
      failCount++;
      const errorMsg = `${patient.name} (${patient.phone}): ${error.message}`;
      errors.push(errorMsg);
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  // 4. Summary
  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 BATCH PROCESSING SUMMARY:\n');
  console.log(`Total patients processed: ${uniquePatients.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);

  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS:\n');
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
  }

  console.log('\n' + '=' .repeat(70));
  console.log('\n🎯 NEXT STEPS:\n');
  console.log('1. Run: scripts/check-89-patients.cjs to verify H&P creation');
  console.log('2. Run: scripts/sync-hp-meds-to-portal.cjs to sync medications to patient portal\n');

  return {
    total: uniquePatients.length,
    success: successCount,
    failed: failCount,
    errors
  };
}

/**
 * Get or create TSHLA ID for patient
 */
async function getOrCreateTshlaId(phone, name) {
  // Try to find existing patient
  const { data: existingPatient } = await supabase
    .from('unified_patients')
    .select('tshla_id')
    .eq('phone', phone)
    .single();

  if (existingPatient && existingPatient.tshla_id) {
    return existingPatient.tshla_id;
  }

  // Generate new TSHLA ID
  const { data: lastPatient } = await supabase
    .from('unified_patients')
    .select('tshla_id')
    .order('tshla_id', { ascending: false })
    .limit(1)
    .single();

  let nextNumber = 1;
  if (lastPatient && lastPatient.tshla_id) {
    const match = lastPatient.tshla_id.match(/TSH (\d+)-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[2]) + 1;
    }
  }

  const newTshlaId = `TSH 001-${String(nextNumber).padStart(3, '0')}`;

  // Create patient record
  const { error: insertError } = await supabase
    .from('unified_patients')
    .upsert({
      phone: phone,
      tshla_id: newTshlaId,
      name: name,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'phone'
    });

  if (insertError) {
    console.warn(`   ⚠️  Could not create patient record: ${insertError.message}`);
  }

  return newTshlaId;
}

/**
 * Copy dictated_notes entry to unified dictations table
 * H&P generator expects dictations in the 'dictations' table
 */
async function copyToUnifiedDictations(dictation, phone, tshlaId) {
  // Check if already exists
  const { data: existing } = await supabase
    .from('dictations')
    .select('id')
    .eq('patient_phone', phone)
    .eq('transcription_text', dictation.raw_transcript || dictation.processed_note)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  // Insert into dictations table
  const { data: newDictation, error: insertError } = await supabase
    .from('dictations')
    .insert({
      patient_phone: phone,
      tshla_id: tshlaId,
      provider_name: dictation.provider_name,
      transcription_text: dictation.raw_transcript || '',
      final_note: dictation.processed_note || '',
      dictation_type: 'visit_note',
      status: 'completed',
      created_at: dictation.created_at
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to copy dictation to unified table: ${insertError.message}`);
  }

  return newDictation.id;
}

// Run the batch process
generateHPForAllDictations()
  .then(stats => {
    if (stats) {
      console.log('\n✅ Batch H&P generation completed!');
      process.exit(stats.failed > 0 ? 1 : 0);
    }
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
