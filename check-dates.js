import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function checkDates() {
  const { data, error } = await supabase
    .from('provider_schedules')
    .select('scheduled_date, provider_name, patient_name')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Total records found: ' + data.length);
  console.log('\nSample records:');
  data.forEach((apt, i) => {
    console.log((i+1) + '. Date: ' + apt.scheduled_date + ' | Provider: ' + apt.provider_name + ' | Patient: ' + apt.patient_name);
  });
}

checkDates();
