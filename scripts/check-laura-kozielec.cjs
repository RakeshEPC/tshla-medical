require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLaura() {
  console.log('🔍 Searching for Laura Kozielec in database...\n');

  const { data, error } = await supabase
    .from('provider_schedules')
    .select('*')
    .ilike('patient_name', '%kozielec%')
    .order('scheduled_date', { ascending: false })
    .order('start_time');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ No appointments found for Laura Kozielec');
    return;
  }

  console.log(`✅ Found ${data.length} appointment(s) for Laura Kozielec:\n`);
  
  data.forEach((apt, i) => {
    console.log(`[${i + 1}] ${apt.patient_name}`);
    console.log(`    Date: ${apt.scheduled_date} at ${apt.start_time}`);
    console.log(`    Status: ${apt.status}`);
    console.log(`    Cancellation Date: ${apt.cancellation_date || 'NULL'}`);
    console.log(`    Provider: ${apt.provider_name || apt.provider_id}`);
    console.log(`    Appointment ID: ${apt.id}`);
    console.log(`    MRN: ${apt.external_patient_id || apt.athena_appointment_id || 'N/A'}`);
    console.log('');
  });
}

checkLaura().catch(console.error).finally(() => process.exit(0));
