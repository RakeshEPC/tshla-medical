#!/usr/bin/env tsx
/**
 * Admin Account Setup Script
 *
 * Creates admin accounts for TSHLA Medical platform
 * Run with: npx tsx scripts/setup-admin-accounts.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Supabase configuration - Use SERVICE ROLE for admin operations (bypasses RLS)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration in .env file');
  console.error('   Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🔑 Using Supabase Service Role for admin account creation (bypasses RLS)');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface AdminAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'super_admin';
  specialty?: string;
}

// Predefined admin accounts
const DEFAULT_ADMINS: AdminAccount[] = [
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

async function createAdminAccount(account: AdminAccount): Promise<boolean> {
  try {
    console.log(`\n📝 Creating admin account for ${account.email}...`);

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: account.email,
      password: account.password,
      options: {
        data: {
          first_name: account.firstName,
          last_name: account.lastName,
          role: account.role
        }
      }
    });

    if (authError) {
      // Check if user already exists
      if (authError.message.includes('already registered')) {
        console.log(`⚠️  User ${account.email} already exists in auth`);

        // Try to sign in to get the user ID
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: account.email,
          password: account.password
        });

        if (signInError) {
          console.error(`❌ Could not sign in as ${account.email}:`, signInError.message);
          return false;
        }

        if (!signInData.user) {
          console.error(`❌ No user data returned for ${account.email}`);
          return false;
        }

        // Check if medical_staff record exists
        const { data: existingStaff } = await supabase
          .from('medical_staff')
          .select('*')
          .eq('auth_user_id', signInData.user.id)
          .single();

        if (existingStaff) {
          console.log(`✅ Admin account already exists for ${account.email}`);
          return true;
        }

        // Create medical_staff record for existing auth user
        const { error: staffError } = await supabase
          .from('medical_staff')
          .insert({
            email: account.email,
            username: account.email.split('@')[0],
            first_name: account.firstName,
            last_name: account.lastName,
            role: account.role,
            specialty: account.specialty,
            practice: 'TSHLA Medical',
            auth_user_id: signInData.user.id,
            is_active: true,
            is_verified: true,
            created_by: 'setup-script'
          });

        if (staffError) {
          console.error(`❌ Failed to create medical_staff record:`, staffError.message);
          return false;
        }

        console.log(`✅ Created medical_staff record for ${account.email}`);
        await supabase.auth.signOut();
        return true;
      }

      console.error(`❌ Auth error:`, authError.message);
      return false;
    }

    if (!authData.user) {
      console.error(`❌ No user data returned for ${account.email}`);
      return false;
    }

    console.log(`✅ Created auth user: ${authData.user.id}`);

    // Step 2: Create medical_staff record
    const { data: staffData, error: staffError } = await supabase
      .from('medical_staff')
      .insert({
        email: account.email,
        username: account.email.split('@')[0],
        first_name: account.firstName,
        last_name: account.lastName,
        role: account.role,
        specialty: account.specialty,
        practice: 'TSHLA Medical',
        auth_user_id: authData.user.id,
        is_active: true,
        is_verified: true,
        created_by: 'setup-script'
      })
      .select()
      .single();

    if (staffError) {
      console.error(`❌ Failed to create medical_staff record:`, staffError.message);
      return false;
    }

    console.log(`✅ Created medical_staff record: ${staffData.id}`);

    // Step 3: Log access
    await supabase.from('access_logs').insert({
      user_id: authData.user.id,
      user_email: account.email,
      user_type: 'medical_staff',
      action: 'ACCOUNT_CREATED',
      success: true,
      created_at: new Date().toISOString()
    });

    console.log(`✅ Admin account created successfully for ${account.email}`);
    console.log(`   Role: ${account.role}`);
    console.log(`   Password: ${account.password}`);

    return true;
  } catch (error) {
    console.error(`❌ Unexpected error creating ${account.email}:`, error);
    return false;
  }
}

async function createCustomAdmin(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  console.log('\n📋 Create Custom Admin Account');
  console.log('═'.repeat(50));

  const email = await question('Email: ');
  const password = await question('Password: ');
  const firstName = await question('First Name: ');
  const lastName = await question('Last Name: ');
  const roleInput = await question('Role (admin/super_admin) [admin]: ');
  const specialty = await question('Specialty (optional): ');

  rl.close();

  const role = (roleInput.toLowerCase() === 'super_admin' ? 'super_admin' : 'admin') as 'admin' | 'super_admin';

  const customAdmin: AdminAccount = {
    email: email.trim(),
    password: password.trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    role,
    specialty: specialty.trim() || undefined
  };

  await createAdminAccount(customAdmin);
}

async function main() {
  console.log('🔐 TSHLA Medical - Admin Account Setup');
  console.log('═'.repeat(50));
  console.log('This script will create admin accounts in Supabase');
  console.log('');

  // Show menu
  console.log('Options:');
  console.log('1. Create default admin accounts');
  console.log('2. Create custom admin account');
  console.log('3. Create both');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const choice = await new Promise<string>((resolve) => {
    rl.question('Enter your choice (1-3): ', resolve);
  });

  rl.close();

  let successCount = 0;
  let totalCount = 0;

  if (choice === '1' || choice === '3') {
    console.log('\n📦 Creating default admin accounts...\n');

    for (const admin of DEFAULT_ADMINS) {
      totalCount++;
      const success = await createAdminAccount(admin);
      if (success) successCount++;
    }
  }

  if (choice === '2' || choice === '3') {
    totalCount++;
    await createCustomAdmin();
    successCount++; // Assume success for custom (error handling is done inside)
  }

  console.log('\n═'.repeat(50));
  console.log(`✅ Setup Complete: ${successCount}/${totalCount} accounts created`);
  console.log('═'.repeat(50));

  if (choice === '1' || choice === '3') {
    console.log('\n📋 Default Admin Credentials:');
    DEFAULT_ADMINS.forEach(admin => {
      console.log(`\n   Email: ${admin.email}`);
      console.log(`   Password: ${admin.password}`);
      console.log(`   Role: ${admin.role}`);
    });
  }

  console.log('\n⚠️  IMPORTANT: Store these credentials securely and change passwords after first login!\n');
}

// Run the script
main().catch(console.error);
