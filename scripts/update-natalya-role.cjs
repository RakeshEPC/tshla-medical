const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function updateRole() {
  console.log('\nUpdating Natalya role from doctor to admin...\n');
  
  const { error } = await supabase
    .from('medical_staff')
    .update({ role: 'admin' })
    .eq('email', 'Natalya@tshla.ai');
  
  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    console.log('✅ Updated Natalya@tshla.ai role to admin');
    console.log('\nNatalya needs to log out and log back in for the change to take effect.');
  }
}

updateRole().catch(console.error);
