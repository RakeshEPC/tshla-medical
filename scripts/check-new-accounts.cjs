const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkNewAccounts() {
  console.log('\nChecking for newly created accounts (natalya, john, jesie)...\n');
  
  const emails = ['natalya@tshla.ai', 'john@tshla.ai', 'jesie@tshla.ai'];
  
  for (const email of emails) {
    console.log('='.repeat(70));
    console.log('Checking: ' + email);
    console.log('='.repeat(70));
    
    // Check auth.users
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData.users.find(u => u.email === email);
    
    if (authUser) {
      console.log('✅ EXISTS in auth.users:');
      console.log('   User ID: ' + authUser.id);
      console.log('   Email: ' + authUser.email);
      console.log('   Created: ' + authUser.created_at);
      console.log('   Email Confirmed: ' + (authUser.email_confirmed_at ? 'Yes' : 'No'));
    } else {
      console.log('❌ NOT FOUND in auth.users');
    }
    
    // Check medical_staff
    const { data: staffData } = await supabase
      .from('medical_staff')
      .select('id, email, first_name, last_name, role, is_verified, is_active, auth_user_id, created_at')
      .eq('email', email);
    
    if (staffData && staffData.length > 0) {
      console.log('\n✅ EXISTS in medical_staff:');
      staffData.forEach(s => {
        console.log('   ID: ' + s.id);
        console.log('   Name: ' + s.first_name + ' ' + s.last_name);
        console.log('   Role: ' + s.role);
        console.log('   is_verified: ' + s.is_verified + (s.is_verified ? ' ✅ CAN LOGIN' : ' ❌ CANNOT LOGIN'));
        console.log('   is_active: ' + s.is_active);
        console.log('   auth_user_id: ' + s.auth_user_id);
        console.log('   created_at: ' + s.created_at);
      });
    } else {
      console.log('\n❌ NOT FOUND in medical_staff');
      if (authUser) {
        console.log('   ⚠️  WARNING: Orphaned auth account detected!');
      }
    }
    
    // Check if properly linked
    if (authUser && staffData && staffData.length > 0) {
      const staff = staffData[0];
      if (staff.auth_user_id === authUser.id) {
        console.log('\n✅ PROPERLY LINKED: Auth user and medical_staff record are connected');
        if (staff.is_verified) {
          console.log('✅ ACCOUNT STATUS: Ready to login!');
        } else {
          console.log('⚠️  ACCOUNT STATUS: Needs verification to login');
        }
      } else {
        console.log('\n❌ LINKING ERROR: auth_user_id mismatch!');
      }
    }
    
    console.log('\n');
  }
  
  console.log('='.repeat(70));
  console.log('Summary');
  console.log('='.repeat(70));
  
  const { data: allStaff } = await supabase
    .from('medical_staff')
    .select('email, first_name, last_name, is_verified, created_at')
    .or('email.eq.natalya@tshla.ai,email.eq.john@tshla.ai,email.eq.jesie@tshla.ai')
    .order('created_at', { ascending: false });
  
  if (allStaff && allStaff.length > 0) {
    console.log('\nFound ' + allStaff.length + ' account(s) in medical_staff:');
    allStaff.forEach(s => {
      console.log('  - ' + s.email + ' (' + s.first_name + ' ' + s.last_name + ') - verified: ' + s.is_verified);
    });
  }
}

checkNewAccounts().catch(console.error);
