const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function testJoin() {
  console.log('\n=== Testing JOIN with unified_patient_id ===\n');
  
  const { data, error } = await supabase
    .from('provider_schedules')
    .select(`
      id,
      patient_name,
      scheduled_date,
      start_time,
      unified_patient_id,
      unified_patients!unified_patient_id (
        patient_id,
        tshla_id,
        mrn
      )
    `)
    .gte('scheduled_date', '2025-01-02')
    .lte('scheduled_date', '2025-01-02')
    .order('start_time')
    .limit(5);
  
  if (error) {
    console.error('ERROR:', error);
    return;
  }
  
  console.log('Results:\n');
  data.forEach(apt => {
    console.log('Patient:', apt.patient_name);
    console.log('  unified_patient_id:', apt.unified_patient_id || 'NULL');
    console.log('  unified_patients JOIN:', apt.unified_patients ? 'SUCCESS' : 'FAILED');
    if (apt.unified_patients) {
      console.log('    MRN:', apt.unified_patients.mrn || 'NULL');
      console.log('    patient_id:', apt.unified_patients.patient_id || 'NULL');
      console.log('    tshla_id:', apt.unified_patients.tshla_id || 'NULL');
    }
    console.log('');
  });
}

testJoin();
