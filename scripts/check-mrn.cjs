require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMRN() {
  console.log('🔍 Checking MRN data in database...\n');
  
  // Get today's appointments with MRN
  const today = '2025-01-06';
  
  const { data, error } = await supabase
    .from('provider_schedules')
    .select(`
      id,
      scheduled_date,
      patient_name,
      unified_patients!provider_schedules_unified_patient_id_fkey (
        patient_id,
        tshla_id,
        mrn,
        first_name,
        last_name
      )
    `)
    .eq('scheduled_date', today)
    .limit(5);
    
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Found ${data.length} appointments for ${today}\n`);
  
  data.forEach((apt, i) => {
    console.log(`[${i + 1}] ${apt.patient_name}`);
    console.log(`    Patient Object:`, apt.unified_patients);
    console.log(`    MRN:`, apt.unified_patients?.mrn || 'NULL');
    console.log(`    Internal ID:`, apt.unified_patients?.patient_id || 'NULL');
    console.log(`    TSH ID:`, apt.unified_patients?.tshla_id || 'NULL');
    console.log('');
  });
}

checkMRN().catch(console.error).finally(() => process.exit(0));
