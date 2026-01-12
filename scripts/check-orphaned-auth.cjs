const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkOrphaned() {
  console.log('\nChecking natalya@tshla.ai and jesie@tshla.ai accounts...\n');
  
  const emails = ['natalya@tshla.ai', 'jesie@tshla.ai'];
  
  for (const email of emails) {
    console.log('='.repeat(60));
    console.log('Email: ' + email);
    console.log('='.repeat(60));
    
    // Check auth.users
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData.users.find(u => u.email === email);
    
    if (authUser) {
      console.log('\n✅ EXISTS in auth.users:');
      console.log('   User ID: ' + authUser.id);
      console.log('   Email: ' + authUser.email);
      console.log('   Created: ' + authUser.created_at);
      console.log('   Email Confirmed: ' + (authUser.email_confirmed_at ? 'Yes' : 'No'));
      console.log('   Metadata:', JSON.stringify(authUser.user_metadata, null, 2));
    } else {
      console.log('\n❌ NOT FOUND in auth.users');
    }
    
    // Check medical_staff
    const { data: staffData } = await supabase
      .from('medical_staff')
      .select('*')
      .eq('email', email);
    
    if (staffData && staffData.length > 0) {
      console.log('\n✅ EXISTS in medical_staff:');
      staffData.forEach(s => {
        console.log('   ID: ' + s.id);
        console.log('   Name: ' + s.first_name + ' ' + s.last_name);
        console.log('   is_verified: ' + s.is_verified);
      });
    } else {
      console.log('\n❌ NOT FOUND in medical_staff table');
      console.log('   This is why they cannot login!');
    }
    
    console.log('\n');
  }
}

checkOrphaned().catch(console.error);
