#!/usr/bin/env node
/**
 * Check Admin Credentials in Supabase
 * This script helps you verify which admin accounts exist and are active
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Read from .env file
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('\nPlease ensure these are set:');
  console.log('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAdminAccounts() {
  console.log('🔍 Checking Admin Accounts in Supabase...\n');
  console.log('📍 Supabase URL:', supabaseUrl);
  console.log('');

  try {
    // 1. Check Auth Users (admin@tshla.ai)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣  CHECKING AUTH USERS TABLE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError.message);
    } else {
      console.log(`✅ Found ${authUsers.users.length} user(s) in Supabase Auth:\n`);

      authUsers.users.forEach((user, index) => {
        console.log(`User #${index + 1}:`);
        console.log(`  📧 Email: ${user.email}`);
        console.log(`  🆔 ID: ${user.id}`);
        console.log(`  ✅ Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
        console.log(`  📅 Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log(`  🔑 Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);
        console.log('');
      });

      // Check for admin@tshla.ai specifically
      const adminUser = authUsers.users.find(u => u.email === 'admin@tshla.ai');
      if (adminUser) {
        console.log('✅ admin@tshla.ai EXISTS in Supabase Auth\n');
      } else {
        console.log('⚠️  admin@tshla.ai NOT FOUND in Supabase Auth\n');
      }
    }

    // 2. Check medical_staff table
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣  CHECKING MEDICAL_STAFF TABLE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { data: medicalStaff, error: staffError } = await supabase
      .from('medical_staff')
      .select('*')
      .eq('email', 'admin@tshla.ai');

    if (staffError) {
      console.error('❌ Error fetching medical_staff:', staffError.message);
    } else if (medicalStaff && medicalStaff.length > 0) {
      console.log('✅ admin@tshla.ai found in medical_staff table:\n');
      medicalStaff.forEach(staff => {
        console.log(`  📧 Email: ${staff.email}`);
        console.log(`  👤 Name: ${staff.first_name} ${staff.last_name}`);
        console.log(`  🎭 Role: ${staff.role}`);
        console.log(`  ✅ Active: ${staff.is_active ? 'Yes' : 'No'}`);
        console.log(`  ✅ Verified: ${staff.is_verified ? 'Yes' : 'No'}`);
        console.log(`  🔗 Auth User ID: ${staff.auth_user_id || 'Not linked'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  admin@tshla.ai NOT FOUND in medical_staff table\n');
    }

    // 3. Check pump_users table
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣  CHECKING PUMP_USERS TABLE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { data: pumpUsers, error: pumpError } = await supabase
      .from('pump_users')
      .select('*')
      .eq('email', 'admin@tshla.ai');

    if (pumpError) {
      console.error('❌ Error fetching pump_users:', pumpError.message);
    } else if (pumpUsers && pumpUsers.length > 0) {
      console.log('✅ admin@tshla.ai found in pump_users table:\n');
      pumpUsers.forEach(user => {
        console.log(`  📧 Email: ${user.email}`);
        console.log(`  👤 Name: ${user.first_name} ${user.last_name}`);
        console.log(`  🔗 Auth User ID: ${user.auth_user_id || 'Not linked'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  admin@tshla.ai NOT FOUND in pump_users table\n');
    }

    // 4. Summary and Credentials
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 SUMMARY & CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Based on archived documentation, possible credentials:\n');
    console.log('Option 1 (Most Recent):');
    console.log('  📧 Email:    admin@tshla.ai');
    console.log('  🔑 Password: TshlaAdmin2025!');
    console.log('');
    console.log('Option 2 (Alternate):');
    console.log('  📧 Email:    admin@tshla.ai');
    console.log('  🔑 Password: TshlaSecure2025#');
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 TEST LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Try to sign in with credentials
    const testCredentials = [
      { email: 'admin@tshla.ai', password: 'TshlaAdmin2025!' },
      { email: 'admin@tshla.ai', password: 'TshlaSecure2025#' }
    ];

    for (const cred of testCredentials) {
      console.log(`Testing: ${cred.email} with password ending in "${cred.password.slice(-5)}"...`);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cred.email,
        password: cred.password
      });

      if (error) {
        console.log(`  ❌ Failed: ${error.message}`);
      } else {
        console.log(`  ✅ SUCCESS! This password works!`);
        console.log(`  🔑 Access Token: ${data.session.access_token.substring(0, 30)}...`);
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ WORKING CREDENTIALS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Email:    ${cred.email}`);
        console.log(`Password: ${cred.password}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return;
      }
      console.log('');
    }

    console.log('⚠️  Neither password worked. You may need to reset the password.');
    console.log('');
    console.log('💡 To reset password:');
    console.log('   1. Go to: https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Go to Authentication → Users');
    console.log('   4. Find admin@tshla.ai');
    console.log('   5. Click "..." → Reset Password');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the check
checkAdminAccounts().catch(console.error);
