#!/usr/bin/env node

/**
 * Reset Admin Password - Simple Version
 * Usage: node reset-password-simple.cjs email@example.com newPassword123
 */

const { createClient } = require('@supabase/supabase-js');
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

async function resetPassword(email, newPassword) {
  console.log('\n🔐 TSHLA Medical - Password Reset');
  console.log('═'.repeat(60));

  if (!email || !newPassword) {
    console.error('Usage: node reset-password-simple.cjs <email> <newPassword>');
    console.error('Example: node reset-password-simple.cjs admin@tshla.ai MyNewPass123');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('❌ Password must be at least 8 characters');
    process.exit(1);
  }

  console.log(`\n🔍 Looking up: ${email}`);

  // Find the medical staff record
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (staffError || !staffData) {
    console.error('❌ Medical staff record not found');
    process.exit(1);
  }

  console.log('✅ Staff record found:');
  console.log(`   Name: ${staffData.first_name} ${staffData.last_name}`);
  console.log(`   Role: ${staffData.role}`);
  console.log(`   Auth User ID: ${staffData.auth_user_id || 'NOT SET'}`);

  if (!staffData.auth_user_id) {
    console.error('\n❌ No auth_user_id - account not properly linked');
    process.exit(1);
  }

  console.log('\n🔄 Resetting password...');

  // Update the password using admin API
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
    staffData.auth_user_id,
    { password: newPassword }
  );

  if (updateError) {
    console.error('❌ Failed to reset password:', updateError.message);
    process.exit(1);
  }

  console.log('\n✅ PASSWORD RESET SUCCESSFUL!');
  console.log('═'.repeat(60));
  console.log(`\n📧 Email:    ${email}`);
  console.log(`🔑 Password: ${newPassword}`);
  console.log('\n💡 You can now login at: http://localhost:5173/login');
  console.log('');
}

const email = process.argv[2];
const password = process.argv[3];

resetPassword(email, password).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
