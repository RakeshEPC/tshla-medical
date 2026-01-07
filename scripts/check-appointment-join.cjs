require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJoin() {
  console.log('🔍 Checking appointment-patient join...\n');

  // Get first appointment for 2025-01-07
  const { data, error } = await supabase
    .from('provider_schedules')
    .select('id, patient_name, unified_patient_id')
    .eq('scheduled_date', '2025-01-07')
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 First 5 appointments:\n');
  for (const apt of data) {
    console.log(`Patient: ${apt.patient_name}`);
    console.log(`  unified_patient_id: ${apt.unified_patient_id || 'NULL'}`);

    if (apt.unified_patient_id) {
      // Try to find the patient
      const { data: patient, error: pError } = await supabase
        .from('unified_patients')
        .select('id, first_name, last_name, mrn, patient_id, tshla_id')
        .eq('id', apt.unified_patient_id)
        .single();

      if (pError) {
        console.log(`  ❌ Patient lookup error:`, pError.message);
      } else {
        console.log(`  ✅ Found patient:`, patient);
      }
    }
    console.log('');
  }
}

checkJoin().catch(console.error).finally(() => process.exit(0));
