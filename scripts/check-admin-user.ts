/**
 * Check Admin User Account
 * Verifies if a user has proper admin setup
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAdminUser() {
  // Get email from command line or prompt
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Usage: npx tsx scripts/check-admin-user.ts <email>');
    console.error('   Example: npx tsx scripts/check-admin-user.ts admin@tshla.ai');
    process.exit(1);
  }

  console.log(`\n🔍 Checking admin status for: ${email}\n`);

  // Step 1: Check auth.users
  console.log('Step 1: Checking auth.users table...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error fetching auth users:', authError);
    return;
  }

  const authUser = authUsers.users.find(u => u.email === email);

  if (!authUser) {
    console.error(`❌ User not found in auth.users table`);
    console.log('   To create this user, use the Account Manager at /admin/account-manager');
    return;
  }

  console.log(`✅ Found in auth.users`);
  console.log(`   User ID: ${authUser.id}`);
  console.log(`   Email: ${authUser.email}`);
  console.log(`   Email confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);

  // Step 2: Check medical_staff
  console.log('\nStep 2: Checking medical_staff table...');
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .single();

  if (staffError || !staffData) {
    console.error(`❌ medical_staff record NOT FOUND`);
    console.log('   This is why you get redirected to login!');
    console.log('\n💡 Fix: Creating medical_staff record...');

    const { data: newStaff, error: createError } = await supabase
      .from('medical_staff')
      .insert({
        email: authUser.email,
        username: authUser.email!.split('@')[0],
        first_name: authUser.user_metadata?.first_name || 'Admin',
        last_name: authUser.user_metadata?.last_name || 'User',
        role: 'admin',
        specialty: 'Administration',
        practice: 'TSHLA Medical',
        auth_user_id: authUser.id,
        is_active: true,
        is_verified: true,
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Failed to create medical_staff record:', createError);
      return;
    }

    console.log('✅ medical_staff record created!');
    console.log('   Try logging in again');
    return;
  }

  console.log(`✅ Found in medical_staff`);
  console.log(`   Staff ID: ${staffData.id}`);
  console.log(`   Role: ${staffData.role}`);
  console.log(`   Active: ${staffData.is_active}`);
  console.log(`   Verified: ${staffData.is_verified}`);

  // Step 3: Check role
  console.log('\nStep 3: Checking admin permissions...');

  if (staffData.role === 'admin' || staffData.role === 'super_admin') {
    console.log(`✅ User has admin role: ${staffData.role}`);
    console.log('\n✅ ALL CHECKS PASSED!');
    console.log('   Your account should work correctly');
    console.log('   If still having issues, try:');
    console.log('   1. Clear browser cache (Ctrl+Shift+R)');
    console.log('   2. Log out and log back in');
    console.log('   3. Check browser console for errors');
  } else {
    console.log(`❌ User role is "${staffData.role}" but needs to be "admin" or "super_admin"`);
    console.log('\n💡 Fix: Updating role to admin...');

    const { error: updateError } = await supabase
      .from('medical_staff')
      .update({ role: 'admin', is_verified: true })
      .eq('id', staffData.id);

    if (updateError) {
      console.error('❌ Failed to update role:', updateError);
      return;
    }

    console.log('✅ Role updated to "admin"!');
    console.log('   Try logging in again');
  }
}

checkAdminUser().catch(console.error);
