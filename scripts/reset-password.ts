#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const serviceSupabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('❌ Usage: npx tsx scripts/reset-password.ts <email> <new-password>');
    console.error('   Example: npx tsx scripts/reset-password.ts admin@tshla.ai MyNewPass123!');
    process.exit(1);
  }

  console.log(`🔐 Resetting password for: ${email}\n`);

  try {
    // Find the user first
    const { data: { users }, error: listError } = await serviceSupabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      process.exit(1);
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.log('\n📋 Available users:');
      users.forEach(u => console.log(`   - ${u.email}`));
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    console.log(`   Resetting password...\n`);

    // Reset the password
    const { data, error } = await serviceSupabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (error) {
      console.error('❌ Error resetting password:', error.message);
      process.exit(1);
    }

    console.log('✅ Password reset successful!\n');
    console.log('📋 Login credentials:');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('\n🔗 Login URL: http://localhost:5173 (or your deployed URL)');
    console.log('\n⚠️  IMPORTANT: Store this password securely and do not share it.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

resetPassword();
