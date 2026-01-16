const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function main() {
  console.log('\n🔍 Finding Shannon Auth Account by ID\n');
  
  // We know Shannon's staff record says auth_user_id = 119a44be-3f2a-4554-8415-12277b6f4946
  const shannonAuthId = '119a44be-3f2a-4554-8415-12277b6f4946';
  
  // Get that specific user
  const { data: userData, error } = await supabase.auth.admin.getUserById(shannonAuthId);
  
  if (error) {
    console.log('❌ Error:', error.message);
    console.log('\nThis means the auth account with ID', shannonAuthId, 'does NOT exist!');
    console.log('The medical_staff record is pointing to a deleted/non-existent auth account.');
  } else if (userData.user) {
    console.log('✅ Found Shannon Auth Account!\n');
    console.log('Email:', userData.user.email);
    console.log('ID:', userData.user.id);
    console.log('Created:', new Date(userData.user.created_at).toLocaleString());
    console.log('Email Confirmed:', userData.user.email_confirmed_at ? 'Yes' : 'No');
    console.log('Last Sign In:', userData.user.last_sign_in_at ? new Date(userData.user.last_sign_in_at).toLocaleString() : 'Never');
  }
  
  console.log('\n');
}

main().catch(console.error);
