import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function checkAppointmentsTable() {
  console.log('Checking appointments table...\n');
  
  const { data, error, count } = await supabase
    .from('appointments')
    .select('*', { count: 'exact' })
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Total records:', count);
    if (count > 0 && data && data.length > 0) {
      console.log('\nFirst 10 records:');
      console.table(data);
      console.log('\nColumns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('\n❌ NO RECORDS FOUND in appointments table!');
    }
  }
}

checkAppointmentsTable();
