#!/usr/bin/env tsx
/**
 * Quick Account Creation CLI
 * Simple command-line tool for creating accounts quickly
 *
 * Usage:
 *   npx tsx scripts/quick-create.ts admin john.doe@tshla.ai "John Doe"
 *   npx tsx scripts/quick-create.ts doctor jane.smith@tshla.ai "Jane Smith"
 *   npx tsx scripts/quick-create.ts patient patient@example.com "Bob Johnson"
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function generatePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%&*';
  const allChars = uppercase + lowercase + numbers + symbols;

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function generateAvaId(): string {
  const num1 = Math.floor(100 + Math.random() * 900);
  const num2 = Math.floor(100 + Math.random() * 900);
  return `AVA ${num1}-${num2}`;
}

async function createAccount(type: string, email: string, fullName: string) {
  const [firstName, ...lastNameParts] = fullName.split(' ');
  const lastName = lastNameParts.join(' ') || '';
  const password = generatePassword();

  console.log(`\n🔨 Creating ${type} account...`);
  console.log(`   Email: ${email}`);
  console.log(`   Name: ${fullName}`);

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          account_type: type
        }
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.error('❌ Email already exists');
        return;
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error('No user data returned');
    }

    let avaId: string | undefined;

    // Create profile based on type
    if (type === 'admin' || type === 'doctor' || type === 'nurse' || type === 'staff') {
      const role = type === 'admin' ? 'admin' : type === 'doctor' ? 'doctor' : type === 'nurse' ? 'nurse' : 'staff';

      const { error: staffError } = await supabase
        .from('medical_staff')
        .insert({
          email,
          username: email.split('@')[0],
          first_name: firstName,
          last_name: lastName,
          role,
          specialty: type === 'doctor' ? 'General Practice' : undefined,
          practice: 'TSHLA Medical',
          auth_user_id: authData.user.id,
          is_active: true,
          is_verified: type === 'admin',
          created_by: 'quick-create-script'
        });

      if (staffError) throw staffError;

      console.log('\n✅ Account created successfully!');
      console.log('━'.repeat(50));
      console.log(`   Type: ${type.toUpperCase()}`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      console.log(`   Login URL: /login`);
      console.log('━'.repeat(50));

    } else if (type === 'patient') {
      avaId = generateAvaId();

      const { error: patientError } = await supabase
        .from('patients')
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          ava_id: avaId,
          auth_user_id: authData.user.id,
          is_active: true,
          pumpdrive_enabled: true,
          pumpdrive_signup_date: new Date().toISOString(),
          subscription_tier: 'free'
        });

      if (patientError) throw patientError;

      console.log('\n✅ Patient account created successfully!');
      console.log('━'.repeat(50));
      console.log(`   Name: ${fullName}`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      console.log(`   AVA ID: ${avaId}`);
      console.log(`   Login URL: /patient-login`);
      console.log(`   PumpDrive: Enabled`);
      console.log('━'.repeat(50));
    } else {
      throw new Error(`Unknown account type: ${type}`);
    }

    // Log the creation
    await supabase.from('access_logs').insert({
      user_id: authData.user.id,
      user_email: email,
      user_type: type,
      action: 'ACCOUNT_CREATED_CLI',
      success: true,
      created_at: new Date().toISOString()
    });

    console.log('\n💾 Credentials saved. Store them securely!\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('\n🔐 TSHLA Medical - Quick Account Creator\n');
  console.log('Usage:');
  console.log('  npx tsx scripts/quick-create.ts <type> <email> <"Full Name">');
  console.log('');
  console.log('Types:');
  console.log('  admin    - System administrator');
  console.log('  doctor   - Medical doctor');
  console.log('  nurse    - Nurse');
  console.log('  staff    - Medical staff');
  console.log('  patient  - Patient (gets AVA ID)');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/quick-create.ts admin admin@tshla.ai "Admin User"');
  console.log('  npx tsx scripts/quick-create.ts doctor dr.smith@tshla.ai "John Smith"');
  console.log('  npx tsx scripts/quick-create.ts patient patient@example.com "Jane Doe"');
  console.log('');
  process.exit(1);
}

const [type, email, fullName] = args;

createAccount(type.toLowerCase(), email, fullName);
