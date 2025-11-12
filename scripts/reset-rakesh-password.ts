#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetPassword() {
  const email = 'rakesh@tshla.ai';
  const newPassword = 'TshlaSecure2025!';

  console.log('🔐 Resetting password for rakesh@tshla.ai...\n');

  // Get the user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    return;
  }

  console.log(`✅ Found user ID: ${user.id}`);

  // Update password
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (error) {
    console.error('❌ Failed to reset password:', error.message);
    return;
  }

  console.log('\n✅ PASSWORD RESET SUCCESSFUL!\n');
  console.log('📋 Login Credentials:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${newPassword}`);
  console.log(`   Localhost: http://localhost:5173/login`);
  console.log(`   Production: https://www.tshla.ai/login\n`);
}

resetPassword().catch(console.error);
