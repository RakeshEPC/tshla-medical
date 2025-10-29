#!/usr/bin/env node

/**
 * Check Staff Account Status
 * Quickly checks a staff member's account flags
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStaffAccount(email) {
  try {
    console.log(`\n🔍 Checking staff account: ${email}`);
    console.log('='.repeat(60));

    // Query medical_staff table
    const { data: staffData, error: staffError } = await supabase
      .from('medical_staff')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (staffError) {
      console.error('❌ Error querying staff:', staffError.message);
      return;
    }

    if (!staffData) {
      console.error('❌ No staff record found for:', email);
      return;
    }

    console.log('\n✅ Staff Record Found:');
    console.log('   ID:', staffData.id);
    console.log('   Email:', staffData.email);
    console.log('   Username:', staffData.username);
    console.log('   Name:', `${staffData.first_name || ''} ${staffData.last_name || ''}`.trim());
    console.log('   Role:', staffData.role);
    console.log('   Specialty:', staffData.specialty || 'N/A');
    console.log('\n🔐 Account Status:');
    console.log('   is_active:', staffData.is_active);
    console.log('   is_verified:', staffData.is_verified);
    console.log('   auth_user_id:', staffData.auth_user_id);
    console.log('\n📊 Login Info:');
    console.log('   Last Login:', staffData.last_login || 'Never');
    console.log('   Login Count:', staffData.login_count || 0);
    console.log('   Created:', staffData.created_at);

    // Check if auth user exists
    if (staffData.auth_user_id) {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
        staffData.auth_user_id
      );

      if (authError) {
        console.log('\n⚠️  Auth User Status: ERROR -', authError.message);
      } else if (authUser) {
        console.log('\n✅ Supabase Auth User:');
        console.log('   ID:', authUser.user.id);
        console.log('   Email:', authUser.user.email);
        console.log('   Email Confirmed:', authUser.user.email_confirmed_at ? 'Yes' : 'No');
        console.log('   Last Sign In:', authUser.user.last_sign_in_at || 'Never');
      }
    } else {
      console.log('\n⚠️  No auth_user_id linked');
    }

    // Recommendation
    console.log('\n💡 Recommendations:');
    if (!staffData.is_active) {
      console.log('   ⚠️  Account is INACTIVE - Activate with:');
      console.log(`   UPDATE medical_staff SET is_active = true WHERE email = '${email}';`);
    }
    if (!staffData.is_verified) {
      console.log('   ⚠️  Account is NOT VERIFIED - Verify with:');
      console.log(`   UPDATE medical_staff SET is_verified = true WHERE email = '${email}';`);
    }
    if (staffData.is_active && staffData.is_verified) {
      console.log('   ✅ Account is active and verified - should be able to login');
    }

    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get email from command line or prompt
const email = process.argv[2];

if (!email) {
  console.error('Usage: node check-staff-account.js <email>');
  console.error('Example: node check-staff-account.js admin@tshla.ai');
  process.exit(1);
}

checkStaffAccount(email).then(() => process.exit(0));
