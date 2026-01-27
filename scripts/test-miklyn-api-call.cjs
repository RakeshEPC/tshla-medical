/**
 * Test the exact API call that the frontend makes for MIKLYN
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAPICall() {
  console.log('🧪 Testing MIKLYN dictations API call\n');

  // Get the session
  const { data: session } = await supabase
    .from('patient_portal_sessions')
    .select('id, tshla_id, patient_phone')
    .eq('tshla_id', 'TSH692273')
    .order('session_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    console.log('❌ No session found for TSH692273');
    return;
  }

  console.log('✅ Session found:');
  console.log(`   Session ID: ${session.id}`);
  console.log(`   TSH ID: ${session.tshla_id}`);
  console.log(`   Phone: ${session.patient_phone}`);
  console.log('');

  // Simulate what the API does
  const tshlaId = 'TSH692273'; // What frontend sends
  const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
  console.log(`📤 Request: GET /api/patient-portal/dictations/${tshlaId}`);
  console.log(`   Normalized: ${normalizedTshId}`);
  console.log('');

  // Step 1: Session validation
  console.log('1️⃣  SESSION VALIDATION');
  console.log('-'.repeat(60));
  const sessionTshIdNormalized = session.tshla_id.replace(/[\s-]/g, '').toUpperCase();
  console.log(`   Session TSH ID: ${session.tshla_id}`);
  console.log(`   Session normalized: ${sessionTshIdNormalized}`);
  console.log(`   Request normalized: ${normalizedTshId}`);
  console.log(`   Match: ${sessionTshIdNormalized === normalizedTshId ? '✅' : '❌'}`);
  console.log('');

  if (sessionTshIdNormalized !== normalizedTshId) {
    console.log('❌ Session validation would FAIL');
    return;
  }

  // Step 2: Get patient
  console.log('2️⃣  PATIENT LOOKUP');
  console.log('-'.repeat(60));
  const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
  console.log(`   Looking for: ${normalizedTshId} OR ${formatted}`);

  const { data: patient } = await supabase
    .from('unified_patients')
    .select('phone_primary, phone_display')
    .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`)
    .maybeSingle();

  if (!patient) {
    console.log('❌ Patient not found');
    return;
  }

  console.log('✅ Patient found:');
  console.log(`   Phone Primary: ${patient.phone_primary}`);
  console.log(`   Phone Display: ${patient.phone_display}`);
  console.log('');

  // Step 3: Build phone variations
  console.log('3️⃣  PHONE VARIATIONS');
  console.log('-'.repeat(60));
  const digitsOnly = patient.phone_primary?.replace(/\D/g, '');
  const phoneVariations = [
    patient.phone_primary,
    patient.phone_display,
    digitsOnly,
    digitsOnly ? `(${digitsOnly.substring(0,3)}) ${digitsOnly.substring(3,6)}-${digitsOnly.substring(6)}` : null,
    digitsOnly ? `+1${digitsOnly}` : null
  ].filter(Boolean);

  console.log('   Searching for:');
  phoneVariations.forEach((p, i) => {
    console.log(`     ${i + 1}. "${p}"`);
  });
  console.log('');

  // Step 4: Query dictations
  console.log('4️⃣  DICTATION QUERY');
  console.log('-'.repeat(60));

  const phoneConditions = phoneVariations.map(phone => `patient_phone.eq.${phone}`).join(',');

  const { data: dictations, error } = await supabase
    .from('dictated_notes')
    .select('id, provider_name, patient_phone, patient_name, audio_url')
    .or(phoneConditions)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('❌ Query error:', error.message);
    return;
  }

  console.log(`   Query: patient_phone.eq.(${phoneVariations.join(' OR ')})`);
  console.log(`   Results: ${dictations?.length || 0} dictation(s)`);
  console.log('');

  if (dictations && dictations.length > 0) {
    console.log('✅ DICTATIONS FOUND:');
    dictations.forEach((d, i) => {
      console.log(`   ${i + 1}. ID: ${d.id}`);
      console.log(`      Provider: ${d.provider_name}`);
      console.log(`      Patient: ${d.patient_name}`);
      console.log(`      Phone: ${d.patient_phone}`);
      console.log(`      Has Audio: ${d.audio_url ? 'Yes' : 'No'}`);
      console.log('');
    });
  } else {
    console.log('❌ NO DICTATIONS FOUND');
    console.log('');
    console.log('🔍 Let\'s check what phone format is in dictated_notes:');
    const { data: allDictations } = await supabase
      .from('dictated_notes')
      .select('patient_phone')
      .ilike('patient_name', '%MIKLYN%');

    if (allDictations && allDictations.length > 0) {
      console.log(`   Found dictation with phone: "${allDictations[0].patient_phone}"`);
      console.log(`   Our variations include: ${phoneVariations.includes(allDictations[0].patient_phone) ? 'YES' : 'NO'}`);
    }
  }

  console.log('='.repeat(60));
}

testAPICall()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
