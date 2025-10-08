#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function resetPassword() {
  console.log('🔐 TSHLA Medical - Reset Admin Password\n');

  const email = await question('Enter admin email: ');
  const newPassword = await question('Enter new password: ');

  rl.close();

  console.log('\n🔄 Resetting password...\n');

  // Get the user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email.trim());

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    return;
  }

  // Update password
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword.trim() }
  );

  if (error) {
    console.error('❌ Failed to reset password:', error.message);
    return;
  }

  console.log('✅ Password reset successfully!');
  console.log('\n📋 Login Credentials:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${newPassword}`);
  console.log(`   URL: https://mango-sky-0ba265c0f.1.azurestaticapps.net/login\n`);
}

resetPassword();
