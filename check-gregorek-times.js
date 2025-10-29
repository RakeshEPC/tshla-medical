import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function checkAppointmentTimes() {
  console.log('Checking appointment times for GC_EPC_Gregorek_S...\n');
  
  const { data, error } = await supabase
    .from('provider_schedules')
    .select('patient_name, start_time, scheduled_date, provider_name')
    .eq('provider_name', 'GC_EPC_Gregorek_S')
    .eq('scheduled_date', '2025-10-28')
    .order('start_time', { ascending: true });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Found ' + data.length + ' appointments:\n');
  data.forEach((apt, index) => {
    console.log((index + 1) + '. ' + apt.start_time + ' - ' + apt.patient_name);
  });
}

checkAppointmentTimes();
