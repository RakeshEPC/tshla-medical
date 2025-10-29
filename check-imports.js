import { createClient } from '@supabase/supabase-js';

async function checkImports() {
  const supabase = createClient(
    'https://minvvjdflezibmgkplqb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
  );

  console.log('Checking schedule_imports table...\n');

  const { data: imports, error: importError } = await supabase
    .from('schedule_imports')
    .select('*')
    .order('created_at', { ascending: false });

  if (importError) {
    console.error('Error fetching imports:', importError);
  } else {
    console.log('Total import records:', imports.length);
    if (imports.length > 0) {
      console.log('\nRecent imports:');
      console.table(imports.map(i => ({
        id: i.id,
        filename: i.filename,
        status: i.status,
        appointments_count: i.appointments_count,
        created_at: i.created_at
      })));
    } else {
      console.log('\n❌ NO IMPORT RECORDS FOUND!');
    }
  }

  console.log('\n\nChecking provider_schedules table...\n');

  const { data: schedules, error: schedError } = await supabase
    .from('provider_schedules')
    .select('*')
    .order('created_at', { ascending: false });

  if (schedError) {
    console.error('Error fetching schedules:', schedError);
  } else {
    console.log('Total schedule records:', schedules.length);
    if (schedules.length > 0) {
      console.log('\nRecent schedules:');
      console.table(schedules.slice(0, 10).map(s => ({
        id: s.id,
        patient_name: s.patient_name,
        scheduled_date: s.scheduled_date,
        start_time: s.start_time,
        provider_name: s.provider_name
      })));
    } else {
      console.log('\n❌ NO SCHEDULE RECORDS FOUND!');
    }
  }
}

checkImports();
