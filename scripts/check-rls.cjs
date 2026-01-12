const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkRLS() {
  console.log('\n=== Checking RLS on unified_patients ===\n');
  
  // Try to query unified_patients directly
  const { data, error } = await supabase
    .from('unified_patients')
    .select('id, full_name, mrn')
    .limit(5);
  
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log(`Found ${data.length} patients (with service role key)`);
    data.forEach(p => console.log(`  ${p.full_name} - MRN: ${p.mrn}`));
  }
}

checkRLS();
