const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function analyzeFix() {
  console.log('\n🔍 ANALYZING RAKESH ACCOUNT FIX PLAN\n');
  console.log('='.repeat(100) + '\n');

  // Check existing medical_staff record
  const { data: staffData } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', 'rakesh@tshla.ai')
    .maybeSingle();

  if (!staffData) {
    console.log('❌ ERROR: No medical_staff record found for rakesh@tshla.ai');
    console.log('This should not happen. Aborting.');
    return;
  }

  console.log('✅ FOUND EXISTING MEDICAL_STAFF RECORD:');
  console.log('   ID:', staffData.id);
  console.log('   Email:', staffData.email);
  console.log('   Name:', staffData.first_name, staffData.last_name);
  console.log('   Role:', staffData.role);
  console.log('   Specialty:', staffData.specialty);
  console.log('   Current auth_user_id:', staffData.auth_user_id);
  console.log('   Active:', staffData.is_active);
  console.log('   Verified:', staffData.is_verified);
  console.log('   Created:', staffData.created_at);

  // Check if orphaned auth_user_id exists
  if (staffData.auth_user_id) {
    console.log('\n🔍 Checking if orphaned auth_user_id exists...');
    const { data: orphanedAuth, error } = await supabase.auth.admin.getUserById(staffData.auth_user_id);
    
    if (error || !orphanedAuth.user) {
      console.log('   ❌ Orphaned auth_user_id does NOT exist in auth.users');
      console.log('   → This confirms the auth account was deleted or never existed');
    } else {
      console.log('   ⚠️  WAIT - The auth account DOES exist!');
      console.log('   Email:', orphanedAuth.user.email);
      console.log('   This might not be orphaned after all...');
    }
  }

  // Check if any auth account exists for rakesh@tshla.ai
  console.log('\n🔍 Checking if any auth account exists for rakesh@tshla.ai...');
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const rakeshAuth = authUsers.users.find(u => u.email.toLowerCase() === 'rakesh@tshla.ai');

  if (rakeshAuth) {
    console.log('   ⚠️  FOUND EXISTING AUTH ACCOUNT!');
    console.log('   Email:', rakeshAuth.email);
    console.log('   ID:', rakeshAuth.id);
    console.log('   Created:', new Date(rakeshAuth.created_at).toLocaleString());
    console.log('   Email Confirmed:', rakeshAuth.email_confirmed_at ? 'Yes' : 'No');
    
    if (rakeshAuth.id === staffData.auth_user_id) {
      console.log('   ✅ Already linked correctly!');
      console.log('   → Rakesh should be able to login');
    } else {
      console.log('   ❌ NOT LINKED to medical_staff record');
      console.log('   → Need to update medical_staff.auth_user_id to:', rakeshAuth.id);
    }
  } else {
    console.log('   ❌ No auth account found');
    console.log('   → Need to create new auth account');
  }

  console.log('\n\n' + '='.repeat(100));
  console.log('📋 FIX PLAN');
  console.log('='.repeat(100) + '\n');

  if (rakeshAuth) {
    if (rakeshAuth.id === staffData.auth_user_id) {
      console.log('✅ NO FIX NEEDED - Account is already properly configured!');
      console.log('   Rakesh should be able to login with existing credentials.');
    } else {
      console.log('OPTION 1: Link Existing Auth Account (Recommended)');
      console.log('   1. Update medical_staff table:');
      console.log('      UPDATE medical_staff');
      console.log('      SET auth_user_id = \'' + rakeshAuth.id + '\'');
      console.log('      WHERE email = \'rakesh@tshla.ai\'');
      console.log('   2. Rakesh can login with existing password');
      console.log('   → This preserves the existing auth account\n');
      
      console.log('OPTION 2: Delete Existing Auth and Create New (Not Recommended)');
      console.log('   1. Delete existing auth account');
      console.log('   2. Create new auth account with new password');
      console.log('   3. Link to medical_staff record');
      console.log('   → This requires resetting password\n');
    }
  } else {
    console.log('REQUIRED ACTIONS:');
    console.log('   1. Create new Supabase auth account:');
    console.log('      - Email: rakesh@tshla.ai');
    console.log('      - Password: (you choose)');
    console.log('      - Email confirmation: Auto-confirm');
    console.log('   2. Update medical_staff record:');
    console.log('      - Set auth_user_id to new auth ID');
    console.log('   3. Test login');
    console.log('\n   Recommended password: Rakesh2025! (or another secure password)\n');
  }

  console.log('\n');
}

analyzeFix().catch(console.error);
