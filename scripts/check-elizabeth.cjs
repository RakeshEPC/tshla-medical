const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkElizabeth() {
  console.log('\n🔍 Checking elizabeth@tshla.ai account...\n');

  // Check medical_staff table
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', 'elizabeth@tshla.ai');

  console.log('--- Medical Staff Record ---');
  if (staffError) {
    console.error('❌ Error querying medical_staff:', staffError.message);
  } else if (staffData && staffData.length > 0) {
    const staff = staffData[0];
    console.log('✅ Found in medical_staff:');
    console.log('   Email:', staff.email);
    console.log('   Name:', staff.first_name, staff.last_name);
    console.log('   Role:', staff.role);
    console.log('   Verified:', staff.is_verified);
    console.log('   Auth User ID:', staff.auth_user_id);
    console.log('   Created:', staff.created_at);
  } else {
    console.log('❌ NOT found in medical_staff table');
  }

  // Check auth.users table
  console.log('\n--- Auth Users ---');
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error querying auth.users:', authError.message);
  } else {
    const elizabethAuth = authData.users.filter(u =>
      u.email && u.email.toLowerCase() === 'elizabeth@tshla.ai'
    );

    if (elizabethAuth.length > 0) {
      elizabethAuth.forEach(user => {
        console.log('✅ Found in auth.users:');
        console.log('   Email:', user.email);
        console.log('   ID:', user.id);
        console.log('   Created:', user.created_at);
        console.log('   Email Confirmed:', user.email_confirmed_at ? 'Yes ✅' : 'No ❌');
        console.log('   Last Sign In:', user.last_sign_in_at || 'Never');
        console.log('   Banned:', user.banned ? 'Yes ❌' : 'No ✅');
      });
    } else {
      console.log('❌ NOT found in auth.users');
    }
  }

  // Check for case-insensitive matches
  console.log('\n--- Checking for case variations ---');
  const { data: caseData } = await supabase
    .from('medical_staff')
    .select('email')
    .ilike('email', '%elizabeth%');

  if (caseData && caseData.length > 0) {
    console.log('Found these Elizabeth-related emails:');
    caseData.forEach(row => console.log('  -', row.email));
  } else {
    console.log('No Elizabeth-related emails found');
  }

  console.log('\n');
}

checkElizabeth().catch(console.error);
