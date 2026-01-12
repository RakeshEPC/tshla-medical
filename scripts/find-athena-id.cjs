const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  console.log('\n=== CHECKING UNIFIED_PATIENTS TABLE ===\n');
  
  const { data: unified, error: err1 } = await supabase
    .from('unified_patients')
    .select('*')
    .eq('id', '972a475d-e50b-498c-afe8-3c0d43eacd9d')
    .single();
  
  if (unified) {
    console.log('Found JUSTIN MCDONALD in unified_patients:');
    const keys = Object.keys(unified).sort();
    for (const key of keys) {
      const value = unified[key];
      if (value !== null && value !== undefined && value !== '') {
        console.log('  ' + key.padEnd(30) + ' = ' + value);
      }
    }
  } else {
    console.log('Not found in unified_patients');
  }
  
  console.log('\n=== ANY PATIENTS WITH MRN ===\n');
  
  const { data: withMrn, error: err4 } = await supabase
    .from('unified_patients')
    .select('full_name, patient_id, mrn, tshla_id')
    .not('mrn', 'is', null)
    .limit(10);
  
  if (withMrn && withMrn.length > 0) {
    console.log('Found ' + withMrn.length + ' patients with MRN:');
    withMrn.forEach(p => {
      console.log('  ' + (p.full_name || 'Unknown').padEnd(25) + ' MRN: ' + p.mrn);
    });
  } else {
    console.log('NO patients have MRN in unified_patients');
  }
}

main();
