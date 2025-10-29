#!/usr/bin/env node

/**
 * Find User Accounts
 * Search for accounts across all tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findUser(email) {
  console.log(`\n🔍 Searching for: ${email}`);
  console.log('═'.repeat(60));

  // Search medical_staff
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', email.toLowerCase());

  console.log('\n📋 Medical Staff Table:');
  if (staffError) {
    console.log(`   ❌ Error: ${staffError.message}`);
  } else if (!staffData || staffData.length === 0) {
    console.log('   ❌ No records found');
  } else {
    console.log(`   ✅ Found ${staffData.length} record(s):`);
    staffData.forEach((staff, index) => {
      console.log(`\n   Record ${index + 1}:`);
      console.log(`      ID: ${staff.id}`);
      console.log(`      Email: ${staff.email}`);
      console.log(`      Username: ${staff.username}`);
      console.log(`      Name: ${staff.first_name || ''} ${staff.last_name || ''}`);
      console.log(`      Role: ${staff.role}`);
      console.log(`      is_active: ${staff.is_active}`);
      console.log(`      is_verified: ${staff.is_verified}`);
      console.log(`      auth_user_id: ${staff.auth_user_id || 'NOT SET'}`);
      console.log(`      Created: ${staff.created_at}`);
    });
  }

  // Search patients
  const { data: patientData, error: patientError } = await supabase
    .from('patients')
    .select('*')
    .eq('email', email.toLowerCase());

  console.log('\n📋 Patients Table:');
  if (patientError) {
    console.log(`   ❌ Error: ${patientError.message}`);
  } else if (!patientData || patientData.length === 0) {
    console.log('   ❌ No records found');
  } else {
    console.log(`   ✅ Found ${patientData.length} record(s):`);
    patientData.forEach((patient, index) => {
      console.log(`\n   Record ${index + 1}:`);
      console.log(`      ID: ${patient.id}`);
      console.log(`      Email: ${patient.email}`);
      console.log(`      Name: ${patient.first_name || ''} ${patient.last_name || ''}`);
      console.log(`      MRN: ${patient.mrn}`);
      console.log(`      is_active: ${patient.is_active}`);
      console.log(`      auth_user_id: ${patient.auth_user_id || 'NOT SET'}`);
    });
  }

  // Search auth.users
  console.log('\n📋 Supabase Auth Users:');
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.log(`   ❌ Error: ${authError.message}`);
  } else {
    const matchingUsers = users.filter(u => u.email?.toLowerCase() === email.toLowerCase());
    if (matchingUsers.length === 0) {
      console.log('   ❌ No auth users found with this email');
    } else {
      console.log(`   ✅ Found ${matchingUsers.length} auth user(s):`);
      matchingUsers.forEach((user, index) => {
        console.log(`\n   Auth User ${index + 1}:`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
        console.log(`      Created: ${user.created_at}`);
        console.log(`      Last Sign In: ${user.last_sign_in_at || 'Never'}`);
      });
    }
  }

  console.log('\n' + '═'.repeat(60));
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node find-user.cjs <email>');
  process.exit(1);
}

findUser(email).then(() => process.exit(0));
