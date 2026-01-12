const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  const { data, error } = await supabase
    .from('provider_schedules')
    .select('*')
    .gte('scheduled_date', '2026-01-11')
    .lte('scheduled_date', '2026-01-11')
    .order('start_time')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No data found');
    return;
  }
  
  const patient = data[0];
  
  console.log('\n' + '='.repeat(80));
  console.log('SAMPLE PATIENT RECORD: ' + patient.patient_name + ' (' + patient.scheduled_date + ' at ' + patient.start_time + ')');
  console.log('='.repeat(80) + '\n');
  
  const keys = Object.keys(patient).sort();
  for (const key of keys) {
    const value = patient[key];
    const display = value === null ? 'NULL' : value === '' ? '(empty)' : value;
    console.log(key.padEnd(35) + ' = ' + display);
  }
  
  console.log('\n' + '='.repeat(80));
}

main();
