#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  console.log('🔍 Diagnosing patelcyfair@yahoo.com account...\n');

  // Get auth user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const authUser = users.find(u => u.email === 'patelcyfair@yahoo.com');

  if (!authUser) {
    console.error('❌ Auth user not found!');
    return;
  }

  console.log('✅ Auth User Found:');
  console.log('   ID:', authUser.id);
  console.log('   Email:', authUser.email);
  console.log('   Email Confirmed:', authUser.email_confirmed_at ? 'Yes' : 'No');
  console.log('   Created:', new Date(authUser.created_at).toLocaleString());
  console.log('   Last Sign In:', authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString() : 'Never');
  console.log('   Metadata:', JSON.stringify(authUser.user_metadata, null, 2));

  // Get medical_staff record
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .single();

  if (staffError) {
    console.error('\n❌ Medical staff record not found!');
    console.error('   Error:', staffError.message);
    console.error('\n🔧 This is the problem! The auth user exists but no medical_staff record.');
    console.error('   Need to create medical_staff record for this auth user.\n');

    // Create the record
    console.log('🔨 Creating medical_staff record...');
    const { data: newStaff, error: createError } = await supabase
      .from('medical_staff')
      .insert({
        email: authUser.email,
        username: authUser.email!.split('@')[0],
        first_name: 'Rakesh',
        last_name: 'Patel',
        role: 'admin',
        specialty: 'Administration',
        practice: 'TSHLA Medical',
        auth_user_id: authUser.id,
        is_active: true,
        is_verified: true,
        created_by: 'diagnose-script'
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Failed to create record:', createError.message);
      return;
    }

    console.log('✅ Medical staff record created!');
    console.log('   Role:', newStaff.role);
    return;
  }

  console.log('\n✅ Medical Staff Record Found:');
  console.log('   ID:', staffData.id);
  console.log('   Email:', staffData.email);
  console.log('   Role:', staffData.role);
  console.log('   Name:', `${staffData.first_name} ${staffData.last_name}`);
  console.log('   Specialty:', staffData.specialty);
  console.log('   Auth User ID:', staffData.auth_user_id);
  console.log('   Is Active:', staffData.is_active);
  console.log('   Is Verified:', staffData.is_verified);

  // Simulate login flow
  console.log('\n🔐 Simulating Login Flow:');
  console.log('   1. Auth successful ✅');
  console.log('   2. Medical staff record found ✅');
  console.log('   3. User object would be:');

  const userObject = {
    id: staffData.id,
    email: staffData.email,
    name: `${staffData.first_name} ${staffData.last_name}`,
    role: staffData.role,
    specialty: staffData.specialty,
    accessType: 'medical',
    authUserId: authUser.id
  };

  console.log(JSON.stringify(userObject, null, 2));

  console.log('\n🚪 AdminRoute Check:');
  const isAdmin = userObject.role === 'admin' || userObject.role === 'super_admin';
  console.log('   Role:', userObject.role);
  console.log('   Is Admin?', isAdmin ? '✅ YES - Should have access' : '❌ NO - Access denied');

  if (isAdmin) {
    console.log('\n✅ Account should work! Try logging in again.');
  }
}

diagnose();
