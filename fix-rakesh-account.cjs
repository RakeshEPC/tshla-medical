#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRakeshAccount() {
  console.log('\n🔧 Fixing Rakesh Account');
  console.log('═'.repeat(60));

  const staffId = '30c21923-cf6a-4cef-991b-808d13a26c5a';

  // Step 1: Update to lowercase email and verify account
  console.log('\n1️⃣ Updating email to lowercase and verifying account...');
  const { data: updateData, error: updateError } = await supabase
    .from('medical_staff')
    .update({
      email: 'rakesh@tshla.ai',
      is_verified: true,
      role: 'admin'  // Also upgrading to admin
    })
    .eq('id', staffId)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Update failed:', updateError.message);
    process.exit(1);
  }

  console.log('✅ Account updated!');
  console.log(`   Email: ${updateData.email} (lowercase)`);
  console.log(`   is_verified: ${updateData.is_verified}`);
  console.log(`   role: ${updateData.role}`);

  // Step 2: Reset password
  console.log('\n2️⃣ Resetting password...');
  const newPassword = 'RakeshPass2025!';
  const authUserId = 'fd12fd3a-7ebb-454a-9a2c-0f14788d81fb';

  const { error: pwError } = await supabase.auth.admin.updateUserById(
    authUserId,
    { password: newPassword }
  );

  if (pwError) {
    console.error('❌ Password reset failed:', pwError.message);
    process.exit(1);
  }

  console.log('✅ Password reset!');

  console.log('\n' + '═'.repeat(60));
  console.log('✅ ACCOUNT FIXED!');
  console.log('═'.repeat(60));
  console.log('\n🔑 Login Credentials:');
  console.log(`   Email:    rakesh@tshla.ai`);
  console.log(`   Password: ${newPassword}`);
  console.log(`   Role:     admin`);
  console.log('\n💡 You can now login at: http://localhost:5173/login');
  console.log('');
}

fixRakeshAccount().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
