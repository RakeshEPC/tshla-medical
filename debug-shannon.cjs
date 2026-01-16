const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  console.log('\n🔍 Debugging Shannon Account\n');
  
  // Get ALL auth users
  const { data: authData } = await supabase.auth.admin.listUsers();
  console.log('Total auth users:', authData.users.length);
  
  // Find Shannon in different ways
  console.log('\n--- Looking for Shannon in auth.users ---');
  
  const exact = authData.users.find(u => u.email === 'shannon@tshla.ai');
  console.log('Exact match (shannon@tshla.ai):', exact ? 'FOUND' : 'NOT FOUND');
  
  const exactCaps = authData.users.find(u => u.email === 'Shannon@tshla.ai');
  console.log('Exact match (Shannon@tshla.ai):', exactCaps ? 'FOUND' : 'NOT FOUND');
  
  const lower = authData.users.find(u => u.email.toLowerCase() === 'shannon@tshla.ai');
  console.log('Case-insensitive match:', lower ? 'FOUND ✅' : 'NOT FOUND');
  
  if (lower) {
    console.log('\nShannon Auth Account Details:');
    console.log('  Email (as stored):', lower.email);
    console.log('  ID:', lower.id);
    console.log('  Created:', new Date(lower.created_at).toLocaleString());
  }
  
  // Check medical_staff
  const { data: staff } = await supabase.from('medical_staff').select('*');
  const shannonStaff = staff.find(s => s.email.toLowerCase() === 'shannon@tshla.ai');
  
  console.log('\n--- Shannon in medical_staff ---');
  if (shannonStaff) {
    console.log('Found ✅');
    console.log('  Email (as stored):', shannonStaff.email);
    console.log('  auth_user_id:', shannonStaff.auth_user_id);
    console.log('  Role:', shannonStaff.role);
    
    if (lower) {
      console.log('\n--- Checking Link ---');
      console.log('Auth ID:  ', lower.id);
      console.log('Staff ID: ', shannonStaff.auth_user_id);
      console.log('Match:    ', lower.id === shannonStaff.auth_user_id ? '✅ LINKED' : '❌ NOT LINKED');
    }
  }
  
  console.log('\n');
}

main().catch(console.error);
