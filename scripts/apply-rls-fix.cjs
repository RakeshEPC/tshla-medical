const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function applyRLSFix() {
  console.log('\nApplying RLS fix...\n');

  console.log('Creating anon read policy...');
  const result = await supabase.rpc('exec_sql', {
    sql: 'CREATE POLICY IF NOT EXISTS "Allow public read access to unified_patients" ON unified_patients FOR SELECT TO anon USING (true)'
  });

  console.log('Result:', result);

  console.log('\nTesting with anon key...');

  const anonClient = createClient(
    'https://minvvjdflezibmgkplqb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
  );

  const test = await anonClient
    .from('provider_schedules')
    .select('patient_name, unified_patients!unified_patient_id (mrn)')
    .gte('scheduled_date', '2026-01-12')
    .limit(3);

  if (test.error) {
    console.error('Test failed:', test.error);
  } else {
    console.log('Test succeeded!');
    test.data.forEach(apt => {
      const mrn = apt.unified_patients ? apt.unified_patients.mrn : 'NULL';
      console.log('  ' + apt.patient_name + ' - MRN: ' + mrn);
    });
  }
}

applyRLSFix().catch(console.error);
