const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  console.log('Checking most recent diabetes education call...\n');
  
  const { data, error } = await supabase
    .from('diabetes_education_calls')
    .select('*')
    .order('call_started_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    data.forEach((call, idx) => {
      console.log(`Call #${idx + 1}:`);
      console.log('  Call SID:', call.twilio_call_sid);
      console.log('  Started:', call.call_started_at);
      console.log('  Duration:', call.duration_seconds, 'seconds');
      console.log('  Session ID:', call.elevenlabs_conversation_id || 'N/A');
      console.log('  Transcript preview:', call.transcript ? call.transcript.substring(0, 200) + '...' : 'No transcript');
      console.log('');
    });
  } else {
    console.log('No calls found');
  }
}

main().catch(console.error);
