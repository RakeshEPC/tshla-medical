import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function checkImportLogs() {
  console.log('Checking schedule_imports table...\n');
  
  const { data, error, count } = await supabase
    .from('schedule_imports')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error or table does not exist:', error.message);
  } else {
    console.log('Total import logs:', count);
    if (count > 0 && data && data.length > 0) {
      console.log('\nRecent import logs:');
      console.table(data);
    } else {
      console.log('\n❌ NO IMPORT LOGS FOUND!');
    }
  }
}

checkImportLogs();
