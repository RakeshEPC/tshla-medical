#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function forceResetPassword() {
  const email = 'admin@tshla.ai';
  const newPassword = 'TshlaSecure2025!';

  console.log('🔐 Force resetting password for admin@tshla.ai...\n');

  // Get the user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    return;
  }

  console.log(`✅ Found user:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
  console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`);

  // Update password with email_confirm: true to ensure it's active
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      password: newPassword,
      email_confirm: true  // Ensure email is confirmed
    }
  );

  if (error) {
    console.error('\n❌ Failed to reset password:', error.message);
    console.error('   Error details:', error);
    return;
  }

  console.log('\n✅ PASSWORD RESET SUCCESSFUL!\n');

  // Test the new password immediately
  console.log('🔍 Testing new password...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: email,
    password: newPassword
  });

  if (loginError) {
    console.error('❌ Login test failed:', loginError.message);
    console.log('\n⚠️  Password was updated but login failed.');
    console.log('   This might be a temporary issue. Wait 10 seconds and try again.');
  } else {
    console.log('✅ Login test SUCCESSFUL!');
    console.log(`   Token received: ${loginData.session?.access_token ? 'Yes' : 'No'}`);

    // Sign out
    await supabase.auth.signOut();
  }

  console.log('\n📋 Final Credentials:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${newPassword}`);
  console.log(`   URL: https://www.tshla.ai/login\n`);
}

forceResetPassword().catch(console.error);
