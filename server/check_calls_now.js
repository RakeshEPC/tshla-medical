const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  // Get current time
  const now = new Date();
  console.log('Current time:', now.toISOString());
  console.log('Checking diabetes_education_calls table...\n');
  
  // Get all calls from TODAY
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  
  const { data: todayCalls, error } = await supabase
    .from('diabetes_education_calls')
    .select('*')
    .gte('call_started_at', todayStart)
    .order('call_started_at', { ascending: false });

  console.log(`Calls since ${todayStart}:`, todayCalls ? todayCalls.length : 0);
  
  if (todayCalls && todayCalls.length > 0) {
    todayCalls.forEach((call, idx) => {
      console.log(`\nCall #${idx + 1}:`);
      console.log('  Started:', call.call_started_at);
      console.log('  Call SID:', call.twilio_call_sid);
      console.log('  Status:', call.call_status);
    });
  }
  
  // Also get the absolute most recent call regardless of date
  const { data: latest, error: err2 } = await supabase
    .from('diabetes_education_calls')
    .select('*')
    .order('call_started_at', { ascending: false })
    .limit(1);
    
  if (latest && latest.length > 0) {
    console.log('\n\nMost recent call in database:');
    console.log('  Started:', latest[0].call_started_at);
    console.log('  Call SID:', latest[0].twilio_call_sid);
  }
}

main().catch(console.error);
