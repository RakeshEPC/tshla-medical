require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Comprehensive search for Sarah Wehe / TSH955162...\n');

  const tshId = 'TSH955162';
  const tshIdFormatted = 'TSH 955-162';

  // 1. Search unified_patients by TSH ID
  console.log('1️⃣ Searching unified_patients...');
  const { data: patients } = await supabase
    .from('unified_patients')
    .select('*')
    .or(`tshla_id.eq.${tshId},tshla_id.eq.${tshIdFormatted}`);

  if (patients && patients.length > 0) {
    console.log(`   ✅ Found ${patients.length} patient(s)`);
    const patient = patients[0];
    console.log('   Patient ID:', patient.id);
    console.log('   Name:', patient.first_name, patient.last_name);
    console.log('   Phone Primary:', patient.phone_primary);
    console.log('   Phone Display:', patient.phone_display);

    const phoneVariations = [
      patient.phone_primary,
      patient.phone_display,
      patient.phone_primary?.replace(/\D/g, ''),
    ].filter(Boolean);

    console.log('   Phone variations:', phoneVariations);

    // 2. Search dictations by patient_id
    console.log('\n2️⃣ Searching dictations by patient_id...');
    const { data: dictByPatient } = await supabase
      .from('dictations')
      .select('*')
      .eq('patient_id', patient.id)
      .is('deleted_at', null);

    console.log(`   Found ${dictByPatient?.length || 0} dictation(s)`);
    if (dictByPatient && dictByPatient.length > 0) {
      dictByPatient.forEach(d => {
        console.log(`     - ID: ${d.id}, Visit: ${d.visit_date}, Has audio: ${!!d.audio_url}`);
      });
    }

    // 3. Search dictated_notes by phone variations
    console.log('\n3️⃣ Searching dictated_notes by phone...');
    const { data: dictNotes } = await supabase
      .from('dictated_notes')
      .select('*')
      .in('patient_phone', phoneVariations);

    console.log(`   Found ${dictNotes?.length || 0} dictated note(s)`);
    if (dictNotes && dictNotes.length > 0) {
      dictNotes.forEach(n => {
        console.log(`     - ID: ${n.id}, Visit: ${n.visit_date}, Has audio: ${!!n.audio_url}`);
      });
    }

    // 4. Search patient_audio_summaries by phone
    console.log('\n4️⃣ Searching patient_audio_summaries by phone...');
    const { data: audioSums } = await supabase
      .from('patient_audio_summaries')
      .select('*')
      .in('patient_phone', phoneVariations);

    console.log(`   Found ${audioSums?.length || 0} audio summary(ies)`);
    if (audioSums && audioSums.length > 0) {
      audioSums.forEach(s => {
        console.log(`     - ID: ${s.id}, Has audio: ${!!s.audio_blob_url}, Voice: ${s.voice_id}`);
      });
    }
  } else {
    console.log('   ❌ No patient found with that TSH ID');

    // Try searching by name in dictations
    console.log('\n5️⃣ Searching dictations by patient_name pattern...');
    const { data: dictByName } = await supabase
      .from('dictations')
      .select('*')
      .or('patient_name.ilike.%SARAH%WEHE%,patient_name.ilike.%WEHE%SARAH%')
      .is('deleted_at', null);

    console.log(`   Found ${dictByName?.length || 0} dictation(s) by name`);
    if (dictByName && dictByName.length > 0) {
      dictByName.forEach(d => {
        console.log(`     - Patient: ${d.patient_name}`);
        console.log(`       ID: ${d.id}`);
        console.log(`       Patient ID: ${d.patient_id}`);
        console.log(`       Visit: ${d.visit_date}`);
        console.log(`       Has audio: ${!!d.audio_url}`);
      });
    }
  }
})();
