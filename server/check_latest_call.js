const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  const { data, error } = await supabase
    .from('diabetes_education_calls')
    .select('*')
    .order('call_started_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const call = data[0];
    console.log('Most recent call:');
    console.log('  Started:', call.call_started_at);
    console.log('  Call SID:', call.twilio_call_sid);
    console.log('  Status:', call.call_status);
    console.log('  Duration:', call.duration_seconds);
    console.log('  Patient ID:', call.patient_id);
    console.log('  From:', call.caller_phone_number);
  }
}

main().catch(console.error);
