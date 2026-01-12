const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function findJohn() {
  console.log('\nSearching for john@tshla.ai...\n');
  
  // Check auth.users
  const { data: authData } = await supabase.auth.admin.listUsers();
  const johnAuth = authData.users.find(u => u.email === 'john@tshla.ai');
  
  if (johnAuth) {
    console.log('✅ FOUND in auth.users:');
    console.log('   User ID: ' + johnAuth.id);
    console.log('   Email: ' + johnAuth.email);
    console.log('   Created: ' + johnAuth.created_at);
    console.log('   Metadata:', JSON.stringify(johnAuth.user_metadata, null, 2));
  } else {
    console.log('❌ NOT FOUND in auth.users');
    console.log('\nSearching for any john-related emails...\n');
    
    const johnVariants = authData.users.filter(u => 
      (u.email || '').toLowerCase().includes('john')
    );
    
    if (johnVariants.length > 0) {
      console.log('Found these john-related accounts:');
      johnVariants.forEach(u => {
        console.log('  - ' + u.email + ' (created: ' + u.created_at + ')');
      });
    }
  }
  
  // Check medical_staff
  const { data: staffData } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', 'john@tshla.ai');
  
  if (staffData && staffData.length > 0) {
    console.log('\n✅ FOUND in medical_staff:');
    staffData.forEach(s => {
      console.log('   ID: ' + s.id);
      console.log('   Name: ' + s.first_name + ' ' + s.last_name);
      console.log('   is_verified: ' + s.is_verified);
    });
  } else {
    console.log('\n❌ NOT FOUND in medical_staff');
  }
}

findJohn().catch(console.error);
