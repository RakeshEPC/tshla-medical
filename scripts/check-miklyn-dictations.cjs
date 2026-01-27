/**
 * Check dictations for MIKLYN PROVENZANO (TSH692273)
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDictations() {
  console.log('🔍 Checking dictations for MIKLYN PROVENZANO (TSH692273)\n');

  // 1. Get patient info
  const { data: patient, error: patientError } = await supabase
    .from('unified_patients')
    .select('id, tshla_id, phone_primary, phone_display, first_name, last_name')
    .or('tshla_id.eq.TSH692273,tshla_id.eq.TSH 692-273')
    .maybeSingle();

  if (patientError) {
    console.error('❌ Error finding patient:', patientError.message);
    return;
  }

  if (!patient) {
    console.error('❌ Patient TSH692273 not found');
    return;
  }

  console.log('✅ Patient found:');
  console.log(`   Name: ${patient.first_name} ${patient.last_name}`);
  console.log(`   TSH ID: ${patient.tshla_id}`);
  console.log(`   Phone: ${patient.phone_primary}`);
  console.log(`   Phone Display: ${patient.phone_display}`);
  console.log('');

  // 2. Check dictated_notes table
  const phoneVariations = [
    patient.phone_primary,
    patient.phone_display,
    patient.phone_primary?.replace(/\D/g, ''),
    `+1${patient.phone_primary?.replace(/\D/g, '')}`
  ].filter(Boolean);

  console.log('📱 Searching with phone variations:', phoneVariations);
  console.log('');

  for (const phone of phoneVariations) {
    const { data: dictations, error: dictError } = await supabase
      .from('dictated_notes')
      .select('id, provider_name, patient_name, patient_phone, visit_date, audio_url, audio_deleted, created_at')
      .eq('patient_phone', phone);

    if (dictError) {
      console.error(`❌ Error searching with phone ${phone}:`, dictError.message);
      continue;
    }

    if (dictations && dictations.length > 0) {
      console.log(`✅ Found ${dictations.length} dictation(s) with phone ${phone}:`);
      dictations.forEach((d, i) => {
        console.log(`   ${i + 1}. ID: ${d.id}`);
        console.log(`      Provider: ${d.provider_name}`);
        console.log(`      Patient: ${d.patient_name}`);
        console.log(`      Visit Date: ${d.visit_date}`);
        console.log(`      Audio URL: ${d.audio_url ? '✅ Yes' : '❌ No'}`);
        console.log(`      Audio Deleted: ${d.audio_deleted ? 'Yes' : 'No'}`);
        console.log(`      Created: ${d.created_at}`);
        console.log('');
      });
    } else {
      console.log(`   No dictations found with phone ${phone}`);
    }
  }

  // 3. Check ALL dictations (in case phone format issue)
  console.log('🔎 Searching ALL dictations for patient name match...');
  const { data: allDictations, error: allError } = await supabase
    .from('dictated_notes')
    .select('id, provider_name, patient_name, patient_phone, visit_date, audio_url, created_at')
    .ilike('patient_name', '%MIKLYN%');

  if (allError) {
    console.error('❌ Error:', allError.message);
  } else if (allDictations && allDictations.length > 0) {
    console.log(`✅ Found ${allDictations.length} dictation(s) matching MIKLYN:`);
    allDictations.forEach((d, i) => {
      console.log(`   ${i + 1}. ID: ${d.id}`);
      console.log(`      Patient: ${d.patient_name}`);
      console.log(`      Phone: ${d.patient_phone}`);
      console.log(`      Provider: ${d.provider_name}`);
      console.log(`      Visit Date: ${d.visit_date}`);
      console.log(`      Audio URL: ${d.audio_url ? '✅ Yes' : '❌ No'}`);
      console.log(`      Created: ${d.created_at}`);
      console.log('');
    });
  } else {
    console.log('   No dictations found for MIKLYN');
  }
}

checkDictations()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
