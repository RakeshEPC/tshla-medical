import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function checkAllProviders() {
  const { data, error } = await supabase
    .from('provider_schedules')
    .select('provider_name, start_time, patient_name')
    .eq('scheduled_date', '2025-10-28')
    .order('provider_name', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(30);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Total appointments found: ' + data.length + '\n');
  
  let currentProvider = '';
  data.forEach((apt) => {
    if (apt.provider_name !== currentProvider) {
      currentProvider = apt.provider_name;
      console.log('\n=== ' + currentProvider + ' ===');
    }
    console.log('  ' + apt.start_time + ' - ' + apt.patient_name);
  });
}

checkAllProviders();
