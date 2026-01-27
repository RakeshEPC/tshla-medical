/**
 * Complete status check for MIKLYN PROVENZANO
 * Checks: patient record, dictations, H&P chart, audio
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFullStatus() {
  console.log('🔍 COMPLETE STATUS CHECK FOR MIKLYN PROVENZANO\n');
  console.log('='.repeat(60));
  console.log('');

  // 1. Patient record
  console.log('1️⃣  PATIENT RECORD');
  console.log('-'.repeat(60));

  const { data: patient, error: patientError } = await supabase
    .from('unified_patients')
    .select('*')
    .or('tshla_id.eq.TSH692273,tshla_id.eq.TSH 692-273')
    .maybeSingle();

  if (patientError) {
    console.error('❌ Error:', patientError.message);
  } else if (!patient) {
    console.error('❌ Patient not found');
  } else {
    console.log('✅ Patient found:');
    console.log(`   Name: ${patient.first_name} ${patient.last_name}`);
    console.log(`   TSH ID: ${patient.tshla_id}`);
    console.log(`   Phone Primary: ${patient.phone_primary}`);
    console.log(`   Phone Display: ${patient.phone_display}`);
    console.log(`   Active: ${patient.is_active}`);
  }
  console.log('');

  if (!patient) return;

  // 2. Dictations
  console.log('2️⃣  DICTATIONS');
  console.log('-'.repeat(60));

  const phoneVariations = [
    patient.phone_primary,
    patient.phone_display,
    patient.phone_primary?.replace(/\D/g, ''),
  ].filter(Boolean);

  let dictations = [];
  for (const phone of phoneVariations) {
    const { data, error } = await supabase
      .from('dictated_notes')
      .select('*')
      .eq('patient_phone', phone);

    if (data && data.length > 0) {
      dictations = data;
      console.log(`✅ Found ${data.length} dictation(s) with phone: ${phone}`);
      break;
    }
  }

  if (dictations.length === 0) {
    console.log('❌ No dictations found');
  } else {
    dictations.forEach((d, i) => {
      console.log(`\n   Dictation ${i + 1}:`);
      console.log(`   - ID: ${d.id}`);
      console.log(`   - Provider: ${d.provider_name}`);
      console.log(`   - Patient Phone: ${d.patient_phone}`);
      console.log(`   - Visit Date: ${d.visit_date}`);
      console.log(`   - Has processed_note: ${d.processed_note ? 'Yes' : 'No'}`);
      console.log(`   - Has raw_transcript: ${d.raw_transcript ? 'Yes' : 'No'}`);
      console.log(`   - Audio URL: ${d.audio_url || 'None'}`);
      console.log(`   - Audio Deleted: ${d.audio_deleted}`);
      console.log(`   - Created: ${d.created_at}`);
    });
  }
  console.log('');

  // 3. H&P Comprehensive Chart
  console.log('3️⃣  H&P COMPREHENSIVE CHART');
  console.log('-'.repeat(60));

  const { data: hpChart, error: hpError } = await supabase
    .from('patient_comprehensive_chart')
    .select('*')
    .eq('patient_phone', patient.phone_primary)
    .maybeSingle();

  if (hpError) {
    console.error('❌ Error:', hpError.message);
  } else if (!hpChart) {
    // Try with display phone
    const { data: hpChart2, error: hpError2 } = await supabase
      .from('patient_comprehensive_chart')
      .select('*')
      .eq('patient_phone', patient.phone_display)
      .maybeSingle();

    if (hpError2) {
      console.error('❌ Error:', hpError2.message);
    } else if (!hpChart2) {
      console.log('❌ No H&P chart found');
      console.log(`   Searched for phones: ${patient.phone_primary}, ${patient.phone_display}`);
    } else {
      console.log('✅ H&P chart found (using display phone):');
      printHPSummary(hpChart2);
    }
  } else {
    console.log('✅ H&P chart found:');
    printHPSummary(hpChart);
  }
  console.log('');

  // 4. Patient Portal Sessions
  console.log('4️⃣  RECENT PATIENT PORTAL SESSIONS');
  console.log('-'.repeat(60));

  const { data: sessions, error: sessionError } = await supabase
    .from('patient_portal_sessions')
    .select('*')
    .eq('patient_phone', patient.phone_primary)
    .order('session_start', { ascending: false })
    .limit(5);

  if (sessionError) {
    console.error('❌ Error:', sessionError.message);
  } else if (!sessions || sessions.length === 0) {
    console.log('ℹ️  No portal sessions found');
  } else {
    console.log(`✅ Found ${sessions.length} session(s):`);
    sessions.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.session_start} - ${s.device_type}`);
    });
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('✅ Status check complete');
}

function printHPSummary(chart) {
  console.log(`   - Patient Phone: ${chart.patient_phone}`);
  console.log(`   - Version: ${chart.version}`);
  console.log(`   - Last Updated: ${chart.last_updated}`);
  console.log(`   - Chief Complaint: ${chart.chief_complaint || 'None'}`);
  console.log(`   - Diagnoses: ${chart.diagnoses?.length || 0}`);
  console.log(`   - Medications: ${chart.medications?.length || 0}`);
  console.log(`   - Allergies: ${chart.allergies?.length || 0}`);
  console.log(`   - Labs: ${chart.labs?.length || 0}`);
  console.log(`   - Vitals: ${chart.vitals ? 'Yes' : 'No'}`);

  if (chart.diagnoses && chart.diagnoses.length > 0) {
    console.log('\n   Diagnoses:');
    chart.diagnoses.slice(0, 5).forEach((d, i) => {
      console.log(`     ${i + 1}. ${d.name || d}`);
    });
    if (chart.diagnoses.length > 5) {
      console.log(`     ... and ${chart.diagnoses.length - 5} more`);
    }
  }
}

checkFullStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
