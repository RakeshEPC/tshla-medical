#!/usr/bin/env tsx
/**
 * Cleanup and Create Admin Accounts
 * Removes old admin attempts and creates fresh admin accounts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanup() {
  console.log('🧹 Cleaning up old admin account attempts...\n');

  const emails = ['admin@tshla.ai', 'rakesh.patel@tshla.ai'];

  for (const email of emails) {
    // 1. Get auth user
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email);

    if (authUser) {
      console.log(`   Found auth user: ${email} (${authUser.id})`);

      // 2. Delete from medical_staff first
      const { error: staffError } = await supabase
        .from('medical_staff')
        .delete()
        .eq('email', email);

      if (staffError && !staffError.message.includes('0 rows')) {
        console.log(`   Deleted medical_staff record for ${email}`);
      }

      // 3. Delete auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(authUser.id);
      if (authError) {
        console.error(`   ❌ Failed to delete auth user: ${authError.message}`);
      } else {
        console.log(`   ✅ Deleted auth user for ${email}`);
      }
    }
  }

  console.log('\n✅ Cleanup complete!\n');
}

async function createAdmins() {
  console.log('🔨 Creating fresh admin accounts...\n');

  const admins = [
    {
      email: 'admin@tshla.ai',
      password: 'TshlaAdmin2025!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      specialty: 'Administration'
    },
    {
      email: 'rakesh.patel@tshla.ai',
      password: 'TshlaAdmin2025!',
      firstName: 'Rakesh',
      lastName: 'Patel',
      role: 'super_admin',
      specialty: 'Internal Medicine'
    }
  ];

  for (const admin of admins) {
    console.log(`📝 Creating: ${admin.email}`);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: admin.email,
      password: admin.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: admin.firstName,
        last_name: admin.lastName,
        role: admin.role
      }
    });

    if (authError) {
      console.error(`   ❌ Auth error: ${authError.message}`);
      continue;
    }

    console.log(`   ✅ Auth user created: ${authData.user.id}`);

    // Create medical_staff record
    const { error: staffError } = await supabase
      .from('medical_staff')
      .insert({
        email: admin.email,
        username: admin.email.split('@')[0],
        first_name: admin.firstName,
        last_name: admin.lastName,
        role: admin.role,
        specialty: admin.specialty,
        practice: 'TSHLA Medical',
        auth_user_id: authData.user.id,
        is_active: true,
        is_verified: true,
        created_by: 'admin-setup-script'
      });

    if (staffError) {
      console.error(`   ❌ Medical staff error: ${staffError.message}`);
    } else {
      console.log(`   ✅ Medical staff record created`);
    }

    // Log the creation
    await supabase.from('access_logs').insert({
      user_id: authData.user.id,
      user_email: admin.email,
      user_type: 'medical_staff',
      action: 'ADMIN_ACCOUNT_CREATED',
      success: true,
      created_at: new Date().toISOString()
    });

    console.log('');
  }
}

async function main() {
  console.log('🔐 TSHLA Medical - Admin Account Setup');
  console.log('═'.repeat(50));
  console.log('');

  await cleanup();
  await createAdmins();

  console.log('═'.repeat(50));
  console.log('✅ Setup Complete!');
  console.log('═'.repeat(50));
  console.log('\n📋 Admin Credentials:\n');
  console.log('   Email: admin@tshla.ai');
  console.log('   Password: TshlaAdmin2025!');
  console.log('   Role: admin\n');
  console.log('   Email: rakesh.patel@tshla.ai');
  console.log('   Password: TshlaAdmin2025!');
  console.log('   Role: super_admin\n');
  console.log('🌐 Production Login URL:');
  console.log('   https://mango-sky-0ba265c0f.1.azurestaticapps.net/login\n');
  console.log('⚠️  Change these passwords after first login!\n');
}

main().catch(console.error);
