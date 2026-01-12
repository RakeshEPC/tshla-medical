const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function checkDirect() {
  console.log('\n=== Checking if patient_mrn exists in provider_schedules ===\n');
  
  const { data, error } = await supabase
    .from('provider_schedules')
    .select('patient_name, patient_mrn, patient_phone, unified_patient_id')
    .gte('scheduled_date', '2026-01-12')
    .lte('scheduled_date', '2026-01-12')
    .limit(10);
  
  if (error) {
    console.error('ERROR:', error);
    return;
  }
  
  console.log(`Found ${data.length} appointments:\n`);
  data.forEach(apt => {
    console.log(apt.patient_name);
    console.log('  patient_mrn column:', apt.patient_mrn || 'NULL');
    console.log('  unified_patient_id:', apt.unified_patient_id ? 'LINKED' : 'NOT LINKED');
    console.log('');
  });
}

checkDirect();
