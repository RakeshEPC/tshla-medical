#!/usr/bin/env node
/**
 * Fix admin@tshla.ai authentication issue
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAdminAuth() {
  console.log('🔧 Fixing admin@tshla.ai authentication...\n');

  const email = 'admin@tshla.ai';
  const password = 'TshlaAdmin2025!';

  // Step 1: Check if auth user exists
  console.log('1️⃣  Checking for existing auth user...');
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const existingAuthUser = users.find(u => u.email === email);

  let authUserId;

  if (existingAuthUser) {
    console.log(`   ✅ Found existing auth user: ${existingAuthUser.id}`);
    authUserId = existingAuthUser.id;
  } else {
    // Step 2: Create new auth user
    console.log('   ⚠️  No auth user found, creating new one...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      }
    });

    if (authError) {
      console.error('   ❌ Failed to create auth user:', authError.message);
      return;
    }

    if (!authData.user) {
      console.error('   ❌ No user data returned');
      return;
    }

    console.log(`   ✅ Created new auth user: ${authData.user.id}`);
    authUserId = authData.user.id;
  }

  // Step 3: Check if medical_staff record exists
  console.log('\n2️⃣  Checking medical_staff record...');
  const { data: existingStaff, error: fetchError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', email)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('   ❌ Error fetching medical_staff:', fetchError.message);
    return;
  }

  if (existingStaff) {
    console.log(`   ✅ Found existing medical_staff record: ${existingStaff.id}`);
    console.log(`   Current auth_user_id: ${existingStaff.auth_user_id}`);

    if (existingStaff.auth_user_id !== authUserId) {
      // Step 4: Update medical_staff record with new auth_user_id
      console.log('\n3️⃣  Updating medical_staff auth_user_id...');
      const { error: updateError } = await supabase
        .from('medical_staff')
        .update({
          auth_user_id: authUserId,
          is_verified: true,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStaff.id);

      if (updateError) {
        console.error('   ❌ Failed to update medical_staff:', updateError.message);
        return;
      }

      console.log(`   ✅ Updated auth_user_id to: ${authUserId}`);
    } else {
      console.log('   ✅ auth_user_id already matches, no update needed');
    }
  } else {
    // Step 5: Create new medical_staff record
    console.log('   ⚠️  No medical_staff record found, creating new one...');
    const { error: insertError } = await supabase
      .from('medical_staff')
      .insert({
        email,
        username: 'admin',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        specialty: 'Administration',
        practice: 'TSHLA Medical',
        auth_user_id: authUserId,
        is_active: true,
        is_verified: true,
        created_by: 'fix-admin-auth-script'
      });

    if (insertError) {
      console.error('   ❌ Failed to create medical_staff:', insertError.message);
      return;
    }

    console.log('   ✅ Created new medical_staff record');
  }

  // Step 6: Test login
  console.log('\n4️⃣  Testing login...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (loginError) {
    console.error('   ❌ Login test failed:', loginError.message);
    return;
  }

  if (loginData.user) {
    console.log(`   ✅ Login successful! User ID: ${loginData.user.id}`);
    await supabase.auth.signOut();
  }

  console.log('\n✅ Fix completed successfully!\n');
  console.log('📋 Admin Credentials:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   URL: https://www.tshla.ai/login\n`);
}

fixAdminAuth().catch(console.error);
