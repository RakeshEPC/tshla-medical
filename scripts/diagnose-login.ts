#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const serviceSupabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnoseLogin() {
  console.log('🔍 TSHLA Medical Login Diagnostic Tool\n');
  console.log('=' .repeat(60));

  // Test accounts
  const testAccounts = [
    { email: 'admin@tshla.ai', password: 'TshlaAdmin2025!' },
    { email: 'admin@tshla.ai', password: 'TshlaSecure2025!' },
    { email: 'simran@tshla.ai', password: 'SimranSecure2025!' },
    { email: 'simran@tshla.ai', password: 'TshlaSecure2025!' },
  ];

  console.log('\n1️⃣  CHECKING AUTH USERS IN SUPABASE');
  console.log('=' .repeat(60));

  const { data: { users }, error: listError } = await serviceSupabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌ Error listing users:', listError.message);
  } else {
    console.log(`✅ Found ${users.length} users in auth.users table:\n`);
    users.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email}`);
      console.log(`      - ID: ${user.id}`);
      console.log(`      - Confirmed: ${user.email_confirmed_at ? '✅ Yes' : '❌ No'}`);
      console.log(`      - Last sign in: ${user.last_sign_in_at || 'Never'}`);
      console.log(`      - Created: ${user.created_at}`);
      console.log('');
    });
  }

  console.log('\n2️⃣  CHECKING MEDICAL_STAFF TABLE');
  console.log('=' .repeat(60));

  const { data: staffData, error: staffError } = await serviceSupabase
    .from('medical_staff')
    .select('*');

  if (staffError) {
    console.error('❌ Error querying medical_staff:', staffError.message);
  } else if (!staffData || staffData.length === 0) {
    console.log('⚠️  No records found in medical_staff table');
  } else {
    console.log(`✅ Found ${staffData.length} records in medical_staff table:\n`);
    staffData.forEach((staff, i) => {
      console.log(`   ${i + 1}. ${staff.email}`);
      console.log(`      - ID: ${staff.id}`);
      console.log(`      - Auth User ID: ${staff.auth_user_id || '❌ MISSING'}`);
      console.log(`      - Name: ${staff.first_name} ${staff.last_name}`);
      console.log(`      - Role: ${staff.role}`);
      console.log(`      - Active: ${staff.is_active ? '✅' : '❌'}`);
      console.log(`      - Verified: ${staff.is_verified ? '✅' : '❌'}`);
      console.log('');
    });
  }

  console.log('\n3️⃣  CHECKING PATIENTS TABLE');
  console.log('=' .repeat(60));

  const { data: patientsData, error: patientsError } = await serviceSupabase
    .from('patients')
    .select('*');

  if (patientsError) {
    console.error('❌ Error querying patients:', patientsError.message);
  } else if (!patientsData || patientsData.length === 0) {
    console.log('⚠️  No records found in patients table');
  } else {
    console.log(`✅ Found ${patientsData.length} records in patients table:\n`);
    patientsData.forEach((patient, i) => {
      console.log(`   ${i + 1}. ${patient.email}`);
      console.log(`      - ID: ${patient.id}`);
      console.log(`      - Auth User ID: ${patient.auth_user_id || '❌ MISSING'}`);
      console.log(`      - Name: ${patient.first_name} ${patient.last_name}`);
      console.log(`      - Active: ${patient.is_active ? '✅' : '❌'}`);
      console.log(`      - PumpDrive: ${patient.pumpdrive_enabled ? '✅' : '❌'}`);
      console.log('');
    });
  }

  console.log('\n4️⃣  TESTING LOGIN ATTEMPTS');
  console.log('=' .repeat(60));

  for (const account of testAccounts) {
    console.log(`\n🔐 Testing: ${account.email}`);
    console.log(`   Password: ${account.password}`);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });

    if (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
    } else {
      console.log(`   ✅ SUCCESS!`);
      console.log(`   - User ID: ${data.user?.id}`);
      console.log(`   - Session: ${data.session ? 'Active' : 'None'}`);

      // Sign out after successful test
      await supabase.auth.signOut();
    }
  }

  console.log('\n\n5️⃣  RECOMMENDATIONS');
  console.log('=' .repeat(60));

  // Check for orphaned auth users
  if (users && staffData) {
    const authUserIds = users.map(u => u.id);
    const staffAuthIds = staffData.map(s => s.auth_user_id).filter(Boolean);
    const orphanedAuthUsers = users.filter(u => !staffAuthIds.includes(u.id));

    if (orphanedAuthUsers.length > 0) {
      console.log('\n⚠️  ORPHANED AUTH USERS (no medical_staff record):');
      orphanedAuthUsers.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id})`);
        console.log(`     → Need to create medical_staff record for this user`);
      });
    }
  }

  // Check for orphaned staff records
  if (users && staffData) {
    const authUserIds = users.map(u => u.id);
    const orphanedStaff = staffData.filter(s => s.auth_user_id && !authUserIds.includes(s.auth_user_id));

    if (orphanedStaff.length > 0) {
      console.log('\n⚠️  ORPHANED MEDICAL_STAFF RECORDS (no auth user):');
      orphanedStaff.forEach(staff => {
        console.log(`   - ${staff.email} (Auth ID: ${staff.auth_user_id})`);
        console.log(`     → Need to create Supabase auth user for this staff member`);
      });
    }
  }

  console.log('\n\n✅ Diagnosis complete!');
  console.log('\nIf login still fails:');
  console.log('1. Reset password using Supabase Dashboard');
  console.log('2. Run: npx tsx scripts/reset-password.ts <email> <new-password>');
  console.log('3. Check browser console for detailed error messages');
}

diagnoseLogin().catch(console.error);
