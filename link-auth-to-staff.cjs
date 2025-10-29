#!/usr/bin/env node

/**
 * Link Auth User to Medical Staff
 * Creates a medical_staff record linked to an existing Supabase auth user
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

async function linkAuthToStaff(email, role = 'doctor') {
  console.log('\n🔗 Link Auth User to Medical Staff');
  console.log('═'.repeat(60));

  if (!email) {
    console.error('Usage: node link-auth-to-staff.cjs <email> [role]');
    console.error('Example: node link-auth-to-staff.cjs rakesh@tshla.ai admin');
    process.exit(1);
  }

  console.log(`\n🔍 Looking for auth user: ${email}`);

  // Find the auth user
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error listing users:', authError.message);
    process.exit(1);
  }

  const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!authUser) {
    console.error('❌ No auth user found with this email');
    process.exit(1);
  }

  console.log('✅ Auth user found:');
  console.log(`   ID: ${authUser.id}`);
  console.log(`   Email: ${authUser.email}`);

  // Check if already linked
  const { data: existingStaff } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('auth_user_id', authUser.id);

  if (existingStaff && existingStaff.length > 0) {
    console.log('\n⚠️  This auth user is already linked to medical_staff:');
    console.log(`   Staff ID: ${existingStaff[0].id}`);
    console.log(`   Role: ${existingStaff[0].role}`);
    process.exit(0);
  }

  // Extract name from email
  const emailPrefix = email.split('@')[0];
  const firstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

  console.log(`\n🔄 Creating medical_staff record...`);
  console.log(`   Role: ${role}`);

  // Create medical_staff record
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .insert({
      email: email.toLowerCase(),
      username: emailPrefix.toLowerCase(),
      first_name: firstName,
      last_name: 'User',
      role: role,
      auth_user_id: authUser.id,
      is_active: true,
      is_verified: true,
      created_by: 'link-script'
    })
    .select()
    .single();

  if (staffError) {
    console.error('❌ Failed to create staff record:', staffError.message);
    console.error('   Details:', staffError.details);
    process.exit(1);
  }

  console.log('\n✅ MEDICAL STAFF RECORD CREATED!');
  console.log('═'.repeat(60));
  console.log(`\n📋 Staff Details:`);
  console.log(`   ID: ${staffData.id}`);
  console.log(`   Email: ${staffData.email}`);
  console.log(`   Username: ${staffData.username}`);
  console.log(`   Name: ${staffData.first_name} ${staffData.last_name}`);
  console.log(`   Role: ${staffData.role}`);
  console.log(`   is_active: ${staffData.is_active}`);
  console.log(`   is_verified: ${staffData.is_verified}`);
  console.log(`   auth_user_id: ${staffData.auth_user_id}`);
  console.log('\n💡 Now reset the password with:');
  console.log(`   node reset-password-simple.cjs ${email} YourNewPassword123`);
  console.log('');
}

const email = process.argv[2];
const role = process.argv[3] || 'doctor';

linkAuthToStaff(email, role).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
