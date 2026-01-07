require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyCancellations() {
  console.log('🔍 Verifying cancelled appointments in database...\n');

  // Check total cancelled appointments
  const { data: cancelled, error } = await supabase
    .from('provider_schedules')
    .select('id, scheduled_date, start_time, patient_name, cancellation_date, status')
    .eq('status', 'cancelled')
    .not('cancellation_date', 'is', null)
    .order('cancellation_date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Found ${cancelled.length} recently cancelled appointments (showing last 10):\n`);

  cancelled.forEach((apt, i) => {
    console.log(`[${i + 1}] ${apt.patient_name}`);
    console.log(`    Scheduled: ${apt.scheduled_date} at ${apt.start_time}`);
    console.log(`    Cancelled on: ${apt.cancellation_date}`);
    console.log(`    Status: ${apt.status}`);
    console.log('');
  });

  // Get total count of cancelled appointments
  const { count, error: countError } = await supabase
    .from('provider_schedules')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'cancelled');

  if (!countError) {
    console.log(`📊 Total cancelled appointments in database: ${count}`);
  }
}

verifyCancellations().catch(console.error).finally(() => process.exit(0));
