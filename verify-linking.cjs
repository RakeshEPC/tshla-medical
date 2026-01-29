#!/usr/bin/env node
/**
 * Verify Patient Linking
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('\n✅ Verifying Patient Linking...\n');

  // Get appointments with their patient data (same query as component)
  const { data, error } = await supabase
    .from('provider_schedules')
    .select(`
      *,
      unified_patients!provider_schedules_unified_patient_id_fkey (
        id,
        patient_id,
        mrn,
        phone_primary,
        first_name,
        last_name
      )
    `)
    .eq('scheduled_date', '2026-01-29')
    .neq('status', 'cancelled')
    .order('start_time')
    .limit(5);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`📊 Verifying first 5 appointments:\n`);

  data.forEach(apt => {
    const patient = apt.unified_patients;

    console.log(`⏰ ${apt.start_time} - ${apt.patient_name}`);
    console.log(`   Schedule MRN: ${apt.patient_mrn || 'N/A'}`);
    console.log(`   Patient Linked: ${apt.unified_patient_id ? '✅ YES' : '❌ NO'}`);

    if (patient) {
      console.log(`   TSH_ID: ${patient.patient_id}`);
      console.log(`   Patient MRN: ${patient.mrn || 'N/A'}`);
      console.log(`   Patient Name: ${patient.first_name} ${patient.last_name}`);
    }

    console.log('');
  });

  // Count statistics
  const { data: allApts } = await supabase
    .from('provider_schedules')
    .select('unified_patient_id')
    .eq('scheduled_date', '2026-01-29');

  const linked = allApts.filter(a => a.unified_patient_id).length;
  const total = allApts.length;

  console.log('📊 Summary:');
  console.log(`   Total appointments: ${total}`);
  console.log(`   Linked to patients: ${linked}`);
  console.log(`   Not linked: ${total - linked}`);
  console.log(`   Link rate: ${Math.round((linked / total) * 100)}%\n`);

  console.log('✅ Verification complete!\n');
}

verify();
