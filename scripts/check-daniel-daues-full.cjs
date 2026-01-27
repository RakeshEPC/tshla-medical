/**
 * Check Daniel Daues Complete Data
 * Verify H&P, dictations, diagnoses
 */

const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 CHECKING DANIEL DAUES DATA\n');
  console.log('=' .repeat(70) + '\n');

  // Find Daniel Daues patient record
  const { data: patient } = await s
    .from('unified_patients')
    .select('*')
    .eq('tshla_id', 'TSH 785-121')
    .maybeSingle();

  if (!patient) {
    console.log('❌ Patient not found with TSH 785-121');
    return;
  }

  console.log('✅ Patient found:');
  console.log('   Name:', patient.first_name, patient.last_name);
  console.log('   Phone:', patient.phone_primary);
  console.log('   TSHLA ID:', patient.tshla_id);
  console.log();

  // Check H&P chart
  const { data: hp } = await s
    .from('patient_comprehensive_chart')
    .select('*')
    .eq('tshla_id', 'TSH 785-121')
    .maybeSingle();

  if (hp) {
    console.log('📋 H&P Chart:');
    console.log('   Diagnoses:', hp.diagnoses?.length || 0);
    if (hp.diagnoses && hp.diagnoses.length > 0) {
      hp.diagnoses.forEach((d, i) => console.log('     ' + (i+1) + '.', d));
    } else {
      console.log('     ⚠️  NO DIAGNOSES FOUND!');
    }
    console.log('   Medications:', hp.medications?.length || 0);
    console.log('   Labs:', hp.labs?.length || 0);
    console.log();
  } else {
    console.log('❌ No H&P chart found\n');
  }

  // Check dictations
  const { data: dicts } = await s
    .from('dictated_notes')
    .select('id, patient_name, created_at, processed_note, raw_transcript')
    .eq('patient_phone', patient.phone_primary)
    .order('created_at', { ascending: false });

  console.log('📝 Dictations:', dicts?.length || 0);
  if (dicts && dicts.length > 0) {
    dicts.slice(0, 3).forEach((d, i) => {
      console.log('   ' + (i+1) + '.', d.created_at.substring(0, 10));
      const text = d.processed_note || d.raw_transcript || '';
      console.log('      ', text.substring(0, 80).replace(/\n/g, ' ') + '...');
    });
    if (dicts.length > 3) {
      console.log('      ... and', dicts.length - 3, 'more');
    }
  }
  console.log();

  console.log('=' .repeat(70));

  // Summary
  console.log('\n💡 ISSUES FOUND:\n');

  if (!hp || !hp.diagnoses || hp.diagnoses.length === 0) {
    console.log('❌ 1. NO DIAGNOSES in H&P chart (should have diabetes)');
  }

  if (!dicts || dicts.length === 0) {
    console.log('❌ 2. NO DICTATIONS found for this patient');
  }

  console.log('\n📝 ACTION NEEDED:');
  console.log('   Need to extract diagnoses from dictation text and add to H&P\n');
})();
