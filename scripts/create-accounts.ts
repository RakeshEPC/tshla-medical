#!/usr/bin/env tsx
/**
 * Regular Account Creation Script
 *
 * Creates medical staff and patient accounts for TSHLA Medical platform
 * Run with: npx tsx scripts/create-accounts.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Supabase configuration - load from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface StaffAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'doctor' | 'nurse' | 'staff';
  specialty?: string;
  practice?: string;
}

interface PatientAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  enablePumpDrive?: boolean;
}

// Generate AVA ID for patients
function generateAvaId(): string {
  const num1 = Math.floor(100 + Math.random() * 900);
  const num2 = Math.floor(100 + Math.random() * 900);
  return `AVA ${num1}-${num2}`;
}

async function createMedicalStaff(account: StaffAccount): Promise<boolean> {
  try {
    console.log(`\n👨‍⚕️ Creating medical staff account for ${account.email}...`);

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
      if (authError.message.includes('already registered')) {
        console.log(`⚠️  User ${account.email} already exists`);
        return false;
      }
      console.error(`❌ Auth error:`, authError.message);
      return false;
    }

    if (!authData.user) {
      console.error(`❌ No user data returned`);
      return false;
    }

    // Step 2: Create medical_staff record
    const { data: staffData, error: staffError } = await supabase
      .from('medical_staff')
      .insert({
        email: account.email,
        username: account.email.split('@')[0],
        first_name: account.firstName,
        last_name: account.lastName,
        role: account.role,
        specialty: account.specialty || 'General',
        practice: account.practice || 'TSHLA Medical',
        auth_user_id: authData.user.id,
        is_active: true,
        is_verified: false, // Require verification for regular staff
        created_by: 'account-creation-script'
      })
      .select()
      .single();

    if (staffError) {
      console.error(`❌ Failed to create medical_staff record:`, staffError.message);
      return false;
    }

    // Step 3: Log access
    await supabase.from('access_logs').insert({
      user_id: authData.user.id,
      user_email: account.email,
      user_type: 'medical_staff',
      action: 'ACCOUNT_CREATED',
      success: true,
      created_at: new Date().toISOString()
    });

    console.log(`✅ Medical staff account created successfully`);
    console.log(`   ID: ${staffData.id}`);
    console.log(`   Email: ${account.email}`);
    console.log(`   Password: ${account.password}`);
    console.log(`   Role: ${account.role}`);

    return true;
  } catch (error) {
    console.error(`❌ Unexpected error:`, error);
    return false;
  }
}

async function createPatient(account: PatientAccount): Promise<boolean> {
  try {
    const avaId = generateAvaId();
    console.log(`\n🧑 Creating patient account for ${account.email}...`);
    console.log(`   AVA ID: ${avaId}`);

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: account.email,
      password: account.password,
      options: {
        data: {
          first_name: account.firstName,
          last_name: account.lastName,
          ava_id: avaId
        }
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`⚠️  User ${account.email} already exists`);
        return false;
      }
      console.error(`❌ Auth error:`, authError.message);
      return false;
    }

    if (!authData.user) {
      console.error(`❌ No user data returned`);
      return false;
    }

    // Step 2: Create patients record
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .insert({
        email: account.email,
        first_name: account.firstName,
        last_name: account.lastName,
        phone: account.phoneNumber,
        date_of_birth: account.dateOfBirth,
        ava_id: avaId,
        auth_user_id: authData.user.id,
        is_active: true,
        pumpdrive_enabled: account.enablePumpDrive !== false, // Default true
        pumpdrive_signup_date: account.enablePumpDrive !== false ? new Date().toISOString() : null,
        subscription_tier: 'free'
      })
      .select()
      .single();

    if (patientError) {
      console.error(`❌ Failed to create patient record:`, patientError.message);
      return false;
    }

    // Step 3: Log access
    await supabase.from('access_logs').insert({
      user_id: authData.user.id,
      user_email: account.email,
      user_type: 'patient',
      action: 'ACCOUNT_CREATED',
      success: true,
      created_at: new Date().toISOString()
    });

    console.log(`✅ Patient account created successfully`);
    console.log(`   ID: ${patientData.id}`);
    console.log(`   Email: ${account.email}`);
    console.log(`   Password: ${account.password}`);
    console.log(`   AVA ID: ${avaId}`);
    console.log(`   PumpDrive Enabled: ${account.enablePumpDrive !== false ? 'Yes' : 'No'}`);

    return true;
  } catch (error) {
    console.error(`❌ Unexpected error:`, error);
    return false;
  }
}

async function main() {
  console.log('👥 TSHLA Medical - Account Creation');
  console.log('═'.repeat(50));

  // Example medical staff accounts
  const staffAccounts: StaffAccount[] = [
    {
      email: 'dr.smith@tshla.ai',
      password: 'Doctor2025!',
      firstName: 'John',
      lastName: 'Smith',
      role: 'doctor',
      specialty: 'Internal Medicine',
      practice: 'TSHLA Medical'
    },
    {
      email: 'dr.johnson@tshla.ai',
      password: 'Doctor2025!',
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: 'doctor',
      specialty: 'Endocrinology',
      practice: 'TSHLA Medical'
    },
    {
      email: 'nurse.williams@tshla.ai',
      password: 'Nurse2025!',
      firstName: 'Emily',
      lastName: 'Williams',
      role: 'nurse',
      practice: 'TSHLA Medical'
    }
  ];

  // Example patient accounts
  const patientAccounts: PatientAccount[] = [
    {
      email: 'patient1@example.com',
      password: 'Patient2025!',
      firstName: 'Michael',
      lastName: 'Brown',
      phoneNumber: '555-0101',
      dateOfBirth: '1985-05-15',
      enablePumpDrive: true
    },
    {
      email: 'patient2@example.com',
      password: 'Patient2025!',
      firstName: 'Jennifer',
      lastName: 'Davis',
      phoneNumber: '555-0102',
      dateOfBirth: '1990-08-22',
      enablePumpDrive: true
    },
    {
      email: 'patient3@example.com',
      password: 'Patient2025!',
      firstName: 'Robert',
      lastName: 'Wilson',
      phoneNumber: '555-0103',
      dateOfBirth: '1978-12-03',
      enablePumpDrive: false
    }
  ];

  let successCount = 0;
  let totalCount = 0;

  // Create medical staff accounts
  console.log('\n👨‍⚕️ Creating Medical Staff Accounts...\n');
  for (const staff of staffAccounts) {
    totalCount++;
    const success = await createMedicalStaff(staff);
    if (success) successCount++;
  }

  // Create patient accounts
  console.log('\n🧑 Creating Patient Accounts...\n');
  for (const patient of patientAccounts) {
    totalCount++;
    const success = await createPatient(patient);
    if (success) successCount++;
  }

  console.log('\n═'.repeat(50));
  console.log(`✅ Account Creation Complete: ${successCount}/${totalCount} accounts created`);
  console.log('═'.repeat(50));

  console.log('\n📋 Medical Staff Login:');
  console.log('   URL: /login');
  console.log('   Accounts created with email/password authentication');

  console.log('\n📋 Patient Login:');
  console.log('   URL: /patient-login');
  console.log('   Patients can login with AVA ID or email (no password required for AVA)');

  console.log('\n⚠️  IMPORTANT: Store these credentials securely!\n');
}

// Run the script
main().catch(console.error);
