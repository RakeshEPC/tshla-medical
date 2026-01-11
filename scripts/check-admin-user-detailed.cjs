#!/usr/bin/env node
/**
 * Check admin@tshla.ai user in detail
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdminUser() {
  console.log('🔍 Checking admin@tshla.ai in detail...\n');

  const email = 'admin@tshla.ai';

  // Get user by email using admin API
  console.log('1️⃣  Searching for user by email...');
  const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);

  if (userError) {
    console.error('   ❌ Error:', userError.message);
  } else if (userData && userData.user) {
    const user = userData.user;
    console.log('   ✅ Found user!');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`);
    console.log(`   Created: ${user.created_at}`);
    console.log(`   Banned: ${user.banned_until ? 'Yes (' + user.banned_until + ')' : 'No'}`);
    console.log(`   Confirmed: ${user.confirmed_at ? 'Yes' : 'No'}`);
    console.log(`   Metadata:`, JSON.stringify(user.user_metadata, null, 2));
  } else {
    console.log('   ⚠️  User not found');
  }

  // Check medical_staff table
  console.log('\n2️⃣  Checking medical_staff table...');
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', email)
    .single();

  if (staffError) {
    console.error('   ❌ Error:', staffError.message);
  } else if (staffData) {
    console.log('   ✅ Found medical_staff record!');
    console.log(`   ID: ${staffData.id}`);
    console.log(`   Auth User ID: ${staffData.auth_user_id}`);
    console.log(`   Name: ${staffData.first_name} ${staffData.last_name}`);
    console.log(`   Role: ${staffData.role}`);
    console.log(`   Active: ${staffData.is_active ? 'Yes' : 'No'}`);
    console.log(`   Verified: ${staffData.is_verified ? 'Yes' : 'No'}`);
  } else {
    console.log('   ⚠️  No medical_staff record found');
  }

  // If user exists, try to reset password
  if (userData && userData.user) {
    console.log('\n3️⃣  Resetting password...');
    const { data: resetData, error: resetError } = await supabase.auth.admin.updateUserById(
      userData.user.id,
      { password: 'TshlaAdmin2025!' }
    );

    if (resetError) {
      console.error('   ❌ Password reset failed:', resetError.message);
    } else {
      console.log('   ✅ Password reset successful!');
    }

    // Update medical_staff if needed
    if (staffData && staffData.auth_user_id !== userData.user.id) {
      console.log('\n4️⃣  Updating medical_staff auth_user_id...');
      const { error: updateError } = await supabase
        .from('medical_staff')
        .update({
          auth_user_id: userData.user.id,
          is_verified: true,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', staffData.id);

      if (updateError) {
        console.error('   ❌ Update failed:', updateError.message);
      } else {
        console.log('   ✅ Updated auth_user_id successfully!');
      }
    }
  }

  console.log('\n✅ Check complete!\n');
}

checkAdminUser().catch(console.error);
