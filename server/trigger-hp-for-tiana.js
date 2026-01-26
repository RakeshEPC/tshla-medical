const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function triggerHPForTiana() {
  // Find TIANA's patient record
  const { data: patient } = await supabase
    .from('unified_patients')
    .select('*')
    .ilike('first_name', '%TIANA%')
    .ilike('last_name', '%BERRYMAN%')
    .single();

  if (!patient) {
    console.log('❌ TIANA BERRYMAN not found');
    return;
  }

  console.log('✅ Found TIANA BERRYMAN:');
  console.log('   ID:', patient.id);
  console.log('   TSH ID:', patient.tshla_id);
  console.log('   Phone:', patient.phone_primary);

  // Find her migrated dictation
  const { data: dictation } = await supabase
    .from('dictations')
    .select('*')
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!dictation) {
    console.log('❌ No dictation found for TIANA');
    return;
  }

  console.log('\n✅ Found dictation:');
  console.log('   ID:', dictation.id);
  console.log('   Text length:', dictation.transcription_text?.length || 0, 'chars');
  console.log('   Created:', dictation.created_at);

  // Trigger H&P generation
  console.log('\n🤖 Triggering H&P generation...');

  const response = await fetch('https://www.tshla.ai/api/hp/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientPhone: patient.phone_primary,
      dictationId: dictation.id,
      tshlaId: patient.tshla_id
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ H&P generation succeeded!');
    console.log('   Version:', result.hp?.version);
    console.log('   Has medications:', !!result.hp?.medications);
    console.log('   Has diagnoses:', !!result.hp?.diagnoses);
  } else {
    console.log('❌ H&P generation failed:', result.error);
  }
}

triggerHPForTiana().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
