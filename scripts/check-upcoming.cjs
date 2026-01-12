const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkUpcoming() {
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  
  const todayStr = today.toISOString().split('T')[0];
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  
  console.log('\n=== Checking appointments for next 7 days ===');
  console.log('Today:', todayStr);
  console.log('Next week:', nextWeekStr);
  console.log('');
  
  const { data, error } = await supabase
    .from('provider_schedules')
    .select(`
      id,
      patient_name,
      scheduled_date,
      start_time,
      unified_patients!unified_patient_id (
        patient_id,
        tshla_id,
        mrn
      )
    `)
    .gte('scheduled_date', todayStr)
    .lte('scheduled_date', nextWeekStr)
    .order('scheduled_date')
    .order('start_time')
    .limit(10);
  
  if (error) {
    console.error('ERROR:', error);
    return;
  }
  
  console.log(`Found ${data.length} appointments\n`);
  
  data.forEach(apt => {
    const mrn = apt.unified_patients?.mrn || 'N/A';
    console.log(`${apt.scheduled_date} ${apt.start_time} - ${apt.patient_name} - MRN: ${mrn}`);
  });
}

checkUpcoming();
