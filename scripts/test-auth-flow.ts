#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testAuthFlow() {
  console.log('🔐 Testing complete auth flow for patelcyfair@yahoo.com...\n');

  // Step 1: Login
  console.log('1️⃣ Attempting login...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'patelcyfair@yahoo.com',
    password: 'TshlaAdmin2025!' // Use the password you created
  });

  if (loginError) {
    console.error('❌ Login failed:', loginError.message);
    return;
  }

  console.log('✅ Login successful!');
  console.log('   User ID:', loginData.user?.id);
  console.log('   Email:', loginData.user?.email);
  console.log('   Session:', loginData.session ? 'Present' : 'Missing');

  // Step 2: Get medical_staff record
  console.log('\n2️⃣ Fetching medical_staff profile...');
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('auth_user_id', loginData.user!.id)
    .single();

  if (staffError) {
    console.error('❌ Failed to get profile:', staffError.message);
    return;
  }

  console.log('✅ Profile found!');
  console.log('   Role:', staffData.role);
  console.log('   Name:', `${staffData.first_name} ${staffData.last_name}`);
  console.log('   Is Active:', staffData.is_active);
  console.log('   Is Verified:', staffData.is_verified);

  // Step 3: Check what would be returned from getCurrentUser
  console.log('\n3️⃣ Simulating getCurrentUser()...');
  const user = {
    id: staffData.id,
    email: staffData.email,
    name: `${staffData.first_name} ${staffData.last_name}`,
    role: staffData.role,
    specialty: staffData.specialty,
    accessType: 'medical' as const,
    authUserId: loginData.user!.id
  };

  console.log('✅ User object that would be stored in context:');
  console.log(JSON.stringify(user, null, 2));

  // Step 4: Test AdminRoute logic
  console.log('\n4️⃣ Testing AdminRoute logic...');
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  console.log('   Is Admin?', isAdmin ? '✅ YES' : '❌ NO');
  console.log('   Should access /admin routes?', isAdmin ? '✅ YES' : '❌ NO');

  await supabase.auth.signOut();
  console.log('\n✅ Test complete!');
}

testAuthFlow();
