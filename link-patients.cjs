#!/usr/bin/env node
/**
 * Link Schedule Appointments to Unified Patients
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function linkPatients() {
  console.log('\n🔗 Linking Appointments to Patients...\n');

  // Check if unified_patients table exists
  const { data: patients, error: patError } = await supabase
    .from('unified_patients')
    .select('patient_id, tshla_id, first_name, last_name, athena_patient_id, athena_chart_id')
    .limit(5);

  if (patError) {
    console.error('❌ unified_patients table error:', patError.message);
    console.log('\n💡 The unified_patients table may not exist or has different schema.');
    console.log('   TSH_ID will not be available until patients are linked.\n');
    return;
  }

  console.log(`✅ Found unified_patients table with ${patients.length} sample records\n`);

  // Get appointments without patient links
  const { data: schedules } = await supabase
    .from('provider_schedules')
    .select('id, patient_name, patient_mrn, unified_patient_id')
    .eq('scheduled_date', '2026-01-29')
    .is('unified_patient_id', null);

  console.log(`📅 Found ${schedules?.length || 0} appointments without patient links\n`);

  if (!schedules || schedules.length === 0) {
    console.log('✅ All appointments are already linked!');
    return;
  }

  // Try to match by MRN (athena_patient_id)
  let linked = 0;
  for (const appt of schedules) {
    if (!appt.patient_mrn) continue;

    const { data: matchedPatients } = await supabase
      .from('unified_patients')
      .select('patient_id')
      .eq('athena_patient_id', appt.patient_mrn)
      .limit(1);

    if (matchedPatients && matchedPatients.length > 0) {
      const { error: updateError } = await supabase
        .from('provider_schedules')
        .update({ unified_patient_id: matchedPatients[0].patient_id })
        .eq('id', appt.id);

      if (!updateError) {
        linked++;
        console.log(`✅ Linked ${appt.patient_name} (MRN: ${appt.patient_mrn})`);
      }
    }
  }

  console.log(`\n✅ Successfully linked ${linked} out of ${schedules.length} appointments\n`);
}

linkPatients();
