const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  const { data, error } = await supabase
    .from('provider_schedules')
    .select('id, patient_name, scheduled_date, start_time')
    .order('scheduled_date')
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\nFirst 5 appointments by date:');
  data.forEach(apt => {
    console.log(apt.scheduled_date, apt.start_time, apt.patient_name);
  });
  
  // Now get one full record
  const { data: sample, error: err2 } = await supabase
    .from('provider_schedules')
    .select('*')
    .order('scheduled_date')
    .limit(1);
    
  if (sample && sample.length > 0) {
    const patient = sample[0];
    console.log('\n' + '='.repeat(80));
    console.log('COMPLETE SAMPLE RECORD: ' + patient.patient_name);
    console.log('='.repeat(80) + '\n');
    
    const keys = Object.keys(patient).sort();
    for (const key of keys) {
      const value = patient[key];
      const display = value === null ? 'NULL' : value === '' ? '(empty)' : value;
      console.log(key.padEnd(35) + ' = ' + display);
    }
    console.log('\n' + '='.repeat(80));
  }
}

main();
