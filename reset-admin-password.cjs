#!/usr/bin/env node

/**
 * Reset Admin Password
 * Resets the Supabase Auth password for a medical staff user
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function resetPassword() {
  console.log('\n🔐 TSHLA Medical - Password Reset Tool');
  console.log('═'.repeat(60));

  const email = await question('\nEnter email address: ');

  if (!email || !email.includes('@')) {
    console.error('❌ Invalid email address');
    rl.close();
    return;
  }

  console.log(`\n🔍 Looking up user: ${email}`);

  // Find the medical staff record
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (staffError || !staffData) {
    console.error('❌ Medical staff record not found');
    console.error('   Make sure this email exists in medical_staff table');
    rl.close();
    return;
  }

  console.log('✅ Staff record found:');
  console.log(`   Name: ${staffData.first_name} ${staffData.last_name}`);
  console.log(`   Role: ${staffData.role}`);
  console.log(`   Auth User ID: ${staffData.auth_user_id}`);

  if (!staffData.auth_user_id) {
    console.error('❌ No auth_user_id linked to this staff record');
    console.error('   This account needs to be properly set up first');
    rl.close();
    return;
  }

  // Get the auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
    staffData.auth_user_id
  );

  if (authError || !authUser) {
    console.error('❌ Supabase auth user not found');
    console.error(`   Looking for user ID: ${staffData.auth_user_id}`);
    rl.close();
    return;
  }

  console.log('✅ Supabase auth user found');
  console.log(`   Email: ${authUser.user.email}`);
  console.log(`   Last sign in: ${authUser.user.last_sign_in_at || 'Never'}`);

  console.log('\n' + '─'.repeat(60));
  const newPassword = await question('\nEnter NEW password (min 8 chars): ');

  if (newPassword.length < 8) {
    console.error('❌ Password must be at least 8 characters');
    rl.close();
    return;
  }

  const confirm = await question(`\n⚠️  Reset password for ${email}? (yes/no): `);

  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled');
    rl.close();
    return;
  }

  console.log('\n🔄 Resetting password...');

  // Update the password using admin API
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
    staffData.auth_user_id,
    { password: newPassword }
  );

  if (updateError) {
    console.error('❌ Failed to reset password:', updateError.message);
    rl.close();
    return;
  }

  console.log('\n✅ Password reset successful!');
  console.log('\n' + '═'.repeat(60));
  console.log('✅ PASSWORD RESET COMPLETE');
  console.log('═'.repeat(60));
  console.log(`\nYou can now login with:`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${newPassword}`);
  console.log('\n💡 Try logging in at: http://localhost:5173/login');
  console.log('');

  rl.close();
}

resetPassword().catch(error => {
  console.error('❌ Unexpected error:', error);
  rl.close();
  process.exit(1);
});
