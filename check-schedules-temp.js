import { createClient } from '@supabase/supabase-js';

async function checkSchedules() {
  const supabase = createClient(
    'https://minvvjdflezibmgkplqb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
  );

  console.log('Checking all provider_schedules...\n');

  const { data, error } = await supabase
    .from('provider_schedules')
    .select('id, provider_name, patient_name, scheduled_date, start_time, status')
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Total records:', data.length);
    if (data.length > 0) {
      console.log('\nFirst 10 records:');
      console.table(data.slice(0, 10));
      console.log('\nDate format example:', data[0]?.scheduled_date);
      console.log('Today\'s date (query format):', new Date().toISOString().split('T')[0]);

      // Check if any match today
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = data.filter(d => d.scheduled_date === today);
      console.log(`\nRecords for today (${today}):`, todayRecords.length);
      if (todayRecords.length > 0) {
        console.table(todayRecords);
      }
    } else {
      console.log('\n❌ NO RECORDS FOUND in provider_schedules table!');
    }
  }
}

checkSchedules();
