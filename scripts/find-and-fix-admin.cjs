#!/usr/bin/env node
/**
 * Find and fix both admin@tshla.ai and rakesh@tshla.ai
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findAndFixStaffAccounts() {
  console.log('🔧 Finding and fixing staff accounts...\n');

  const staffEmails = ['admin@tshla.ai', 'rakesh@tshla.ai'];

  // Step 1: Get ALL users from auth
  console.log('1️⃣  Fetching all auth users...');
  let allUsers = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      console.error('Error fetching users:', error.message);
      break;
    }

    if (!data || !data.users || data.users.length === 0) {
      break;
    }

    allUsers = allUsers.concat(data.users);

    if (data.users.length < perPage) {
      break; // Last page
    }

    page++;
  }

  console.log(`   ✅ Found ${allUsers.length} total auth users\n`);

  // Step 2: Process each staff email
  for (const email of staffEmails) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📧 Processing: ${email}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Find auth user
    const authUser = allUsers.find(u => u.email === email);

    if (authUser) {
      console.log(`\n✅ Found auth user:`);
      console.log(`   ID: ${authUser.id}`);
      console.log(`   Email: ${authUser.email}`);
      console.log(`   Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`   Last sign in: ${authUser.last_sign_in_at || 'Never'}`);

      // Reset password
      console.log(`\n🔑 Resetting password...`);
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        authUser.id,
        {
          password: 'TshlaAdmin2025!',
          email_confirm: true
        }
      );

      if (passwordError) {
        console.error(`   ❌ Password reset failed:`, passwordError.message);
      } else {
        console.log(`   ✅ Password reset successful`);
      }

      // Check medical_staff
      console.log(`\n📋 Checking medical_staff record...`);
      const { data: staffData, error: staffError } = await supabase
        .from('medical_staff')
        .select('*')
        .eq('email', email)
        .single();

      if (staffError) {
        if (staffError.code === 'PGRST116') {
          console.log(`   ⚠️  No medical_staff record - creating one...`);
          const { error: insertError } = await supabase
            .from('medical_staff')
            .insert({
              email,
              username: email.split('@')[0],
              first_name: email === 'admin@tshla.ai' ? 'Admin' : 'Rakesh',
              last_name: email === 'admin@tshla.ai' ? 'User' : 'Patel',
              role: 'admin',
              specialty: email === 'admin@tshla.ai' ? 'Administration' : 'Internal Medicine',
              practice: 'TSHLA Medical',
              auth_user_id: authUser.id,
              is_active: true,
              is_verified: true,
              created_by: 'find-and-fix-admin-script'
            });

          if (insertError) {
            console.error(`   ❌ Failed to create medical_staff:`, insertError.message);
          } else {
            console.log(`   ✅ Created medical_staff record`);
          }
        } else {
          console.error(`   ❌ Error fetching medical_staff:`, staffError.message);
        }
      } else {
        console.log(`   ✅ Found medical_staff record:`);
        console.log(`   ID: ${staffData.id}`);
        console.log(`   Auth User ID: ${staffData.auth_user_id}`);

        if (staffData.auth_user_id !== authUser.id) {
          console.log(`\n   ⚠️  Auth User ID mismatch! Updating...`);
          const { error: updateError } = await supabase
            .from('medical_staff')
            .update({
              auth_user_id: authUser.id,
              is_verified: true,
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', staffData.id);

          if (updateError) {
            console.error(`   ❌ Update failed:`, updateError.message);
          } else {
            console.log(`   ✅ Updated auth_user_id from ${staffData.auth_user_id} to ${authUser.id}`);
          }
        } else {
          console.log(`   ✅ Auth User ID matches - no update needed`);
        }
      }

      // Test login
      console.log(`\n🧪 Testing login...`);
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password: 'TshlaAdmin2025!'
      });

      if (loginError) {
        console.error(`   ❌ Login failed:`, loginError.message);
      } else {
        console.log(`   ✅ Login successful! User ID: ${loginData.user.id}`);
        await supabase.auth.signOut();
      }

    } else {
      console.log(`\n❌ Auth user NOT found - creating new one...`);

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: 'TshlaAdmin2025!',
        email_confirm: true,
        user_metadata: {
          first_name: email === 'admin@tshla.ai' ? 'Admin' : 'Rakesh',
          last_name: email === 'admin@tshla.ai' ? 'User' : 'Patel',
          role: 'admin'
        }
      });

      if (authError) {
        console.error(`   ❌ Failed to create auth user:`, authError.message);
        continue;
      }

      console.log(`   ✅ Created auth user: ${authData.user.id}`);

      // Update or create medical_staff
      const { data: staffData } = await supabase
        .from('medical_staff')
        .select('*')
        .eq('email', email)
        .single();

      if (staffData) {
        console.log(`   ✅ Updating existing medical_staff record...`);
        await supabase
          .from('medical_staff')
          .update({
            auth_user_id: authData.user.id,
            is_verified: true,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', staffData.id);
      } else {
        console.log(`   ✅ Creating new medical_staff record...`);
        await supabase
          .from('medical_staff')
          .insert({
            email,
            username: email.split('@')[0],
            first_name: email === 'admin@tshla.ai' ? 'Admin' : 'Rakesh',
            last_name: email === 'admin@tshla.ai' ? 'User' : 'Patel',
            role: 'admin',
            specialty: email === 'admin@tshla.ai' ? 'Administration' : 'Internal Medicine',
            practice: 'TSHLA Medical',
            auth_user_id: authData.user.id,
            is_active: true,
            is_verified: true,
            created_by: 'find-and-fix-admin-script'
          });
      }
    }
  }

  console.log(`\n\n✅ All staff accounts processed!\n`);
  console.log(`📋 Login Credentials:`);
  console.log(`   admin@tshla.ai - Password: TshlaAdmin2025!`);
  console.log(`   rakesh@tshla.ai - Password: TshlaAdmin2025!`);
  console.log(`   URL: https://www.tshla.ai/login\n`);
}

findAndFixStaffAccounts().catch(console.error);
