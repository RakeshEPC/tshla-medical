const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function deepDive() {
  console.log('\n🔬 DEEP DIVE: Rakesh Auth Account Mystery\n');
  console.log('='.repeat(100) + '\n');

  // Get the orphaned ID from medical_staff
  const orphanedId = 'fd12fd3a-7ebb-454a-9a2c-0f14788d81fb';

  console.log('Medical_staff record says auth_user_id:', orphanedId);
  console.log('\nAttempting to fetch this auth user directly...\n');

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(orphanedId);

  if (userError) {
    console.log('❌ Error fetching user:', userError.message);
    console.log('   Code:', userError.code || 'N/A');
    console.log('   Status:', userError.status || 'N/A');
  } else if (userData.user) {
    console.log('✅ FOUND THE AUTH ACCOUNT!');
    console.log('\nFull Details:');
    console.log('   ID:', userData.user.id);
    console.log('   Email:', userData.user.email);
    console.log('   Created:', new Date(userData.user.created_at).toLocaleString());
    console.log('   Email Confirmed:', userData.user.email_confirmed_at ? 
      new Date(userData.user.email_confirmed_at).toLocaleString() : 'No');
    console.log('   Last Sign In:', userData.user.last_sign_in_at ? 
      new Date(userData.user.last_sign_in_at).toLocaleString() : 'Never');
    console.log('   Banned:', userData.user.banned ? 'Yes ❌' : 'No ✅');
    console.log('   Phone:', userData.user.phone || 'None');
    console.log('   Confirmed At:', userData.user.confirmed_at ? 
      new Date(userData.user.confirmed_at).toLocaleString() : 'Not confirmed');

    console.log('\n🧐 WHY WASN\'T IT FOUND IN LIST?');
    
    // Get all users and check
    const { data: allUsers } = await supabase.auth.admin.listUsers();
    const foundInList = allUsers.users.find(u => u.id === orphanedId);
    
    if (foundInList) {
      console.log('   ✅ Actually IS in the user list');
      console.log('   → Previous search must have had a bug');
    } else {
      console.log('   ❌ NOT in the user list');
      console.log('   → User might be in a special state (soft-deleted, etc.)');
      console.log('   → Total users in list:', allUsers.users.length);
    }

    // Try to find by email in the list
    const byEmail = allUsers.users.filter(u => 
      u.email && u.email.toLowerCase().includes('rakesh')
    );
    console.log('\n   Users with "rakesh" in email:', byEmail.length);
    byEmail.forEach(u => {
      console.log('      -', u.email, '(ID:', u.id.substring(0, 20) + '...)');
    });

    console.log('\n📋 CONCLUSION:');
    if (userData.user.banned) {
      console.log('   ⚠️  Account is BANNED');
      console.log('   → Need to unban the account');
    } else if (!userData.user.email_confirmed_at) {
      console.log('   ⚠️  Email not confirmed');
      console.log('   → May need to confirm email');
    } else if (foundInList) {
      console.log('   ✅ Account exists and is valid');
      console.log('   → Account is already properly set up!');
      console.log('   → Rakesh SHOULD be able to login');
      console.log('   → Maybe the password needs to be reset?');
    } else {
      console.log('   ⚠️  Account exists but not in user list');
      console.log('   → May be in a soft-deleted or special state');
      console.log('   → Recommend creating a new auth account');
    }
  } else {
    console.log('❌ User does NOT exist');
    console.log('   The auth_user_id in medical_staff is orphaned (points to nothing)');
  }

  console.log('\n');
}

deepDive().catch(console.error);
