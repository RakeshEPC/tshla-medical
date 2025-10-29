import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function checkAllTables() {
  const tables = [
    'appointments',
    'schedule',
    'schedules', 
    'patient_schedules',
    'provider_schedules',
    'medical_appointments',
    'daily_schedule',
    'uploaded_schedules'
  ];
  
  console.log('Checking all possible schedule tables...\n');
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .limit(3);
    
    if (!error) {
      console.log(`✓ Table '${table}': ${count} records`);
      if (count > 0 && data && data.length > 0) {
        console.log('  Sample columns:', Object.keys(data[0]).join(', '));
        console.log('  First record:', JSON.stringify(data[0], null, 2));
      }
    } else if (error.code !== 'PGRST116') {
      console.log(`✗ Table '${table}': Error - ${error.message}`);
    }
  }
}

checkAllTables();
