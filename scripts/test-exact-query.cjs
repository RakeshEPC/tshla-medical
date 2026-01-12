const { createClient } = require('@supabase/supabase-js');

// Use ANON key like the frontend does
const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function testExactQuery() {
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  
  console.log('\n=== Testing EXACT query from StaffPreVisitWorkflow.tsx ===');
  console.log('Using ANON key (like frontend)');
  console.log('Date range:', today.toISOString().split('T')[0], 'to', nextWeek.toISOString().split('T')[0]);
  console.log('');
  
  // EXACT query from the code
  const { data, error } = await supabase
    .from('provider_schedules')
    .select(`
      id,
      patient_name,
      patient_phone,
      scheduled_date,
      start_time,
      provider_name,
      pre_visit_complete,
      unified_patients!unified_patient_id (
        patient_id,
        tshla_id,
        mrn,
        phone_display
      )
    `)
    .gte('scheduled_date', today.toISOString().split('T')[0])
    .lte('scheduled_date', nextWeek.toISOString().split('T')[0])
    .order('scheduled_date', { ascending: true })
    .order('start_time', { ascending: true });
  
  if (error) {
    console.error('❌ ERROR:', error);
    console.error('This might be an RLS (Row Level Security) issue!');
    return;
  }
  
  console.log(`✅ Query succeeded! Found ${data.length} appointments\n`);
  
  // Show first 5
  data.slice(0, 5).forEach(apt => {
    console.log('Patient:', apt.patient_name);
    console.log('  scheduled_date:', apt.scheduled_date);
    console.log('  unified_patients object:', apt.unified_patients ? 'EXISTS' : 'NULL');
    if (apt.unified_patients) {
      console.log('  MRN from JOIN:', apt.unified_patients.mrn || 'NULL IN UNIFIED_PATIENTS');
    }
    console.log('');
  });
}

testExactQuery();
