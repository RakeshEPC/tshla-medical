const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkRole() {
  console.log('\nChecking Natalya, John, and Jesie roles...\n');
  
  const emails = ['Natalya@tshla.ai', 'John@tshla.ai', 'Jesie@tshla.ai'];
  
  for (const email of emails) {
    const { data } = await supabase
      .from('medical_staff')
      .select('id, email, first_name, last_name, role')
      .eq('email', email)
      .single();
    
    if (data) {
      console.log(email);
      console.log('  Name: ' + data.first_name + ' ' + data.last_name);
      console.log('  Current Role: ' + data.role);
      console.log('');
    }
  }
}

checkRole().catch(console.error);
