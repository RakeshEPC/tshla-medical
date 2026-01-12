const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkAccounts() {
  console.log('\nChecking for natalya, john, and jesie accounts...\n');
  
  const { data, error } = await supabase
    .from('medical_staff')
    .select('id, email, first_name, last_name, role, is_verified, is_active, created_at')
    .or('email.ilike.%natalya%,email.ilike.%john%,email.ilike.%jesie%,email.like.%@tshla.ai')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data.length === 0) {
    console.log('No matching staff accounts found.');
    return;
  }
  
  console.log('Found ' + data.length + ' staff account(s):\n');
  
  data.forEach(staff => {
    console.log('Email: ' + staff.email);
    console.log('  Name: ' + staff.first_name + ' ' + staff.last_name);
    console.log('  Role: ' + staff.role);
    console.log('  is_verified: ' + staff.is_verified + (staff.is_verified ? ' ✅' : ' ❌ CANNOT LOGIN'));
    console.log('  is_active: ' + staff.is_active);
    console.log('  Created: ' + staff.created_at);
    console.log('');
  });
}

checkAccounts().catch(console.error);
