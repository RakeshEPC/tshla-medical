const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function testShannonLogin() {
  console.log('\n🔐 Testing Shannon Login\n');
  console.log('Email: Shannon@tshla.ai');
  console.log('Password: Shannon2025!');
  console.log('='.repeat(80) + '\n');

  try {
    // Try to sign in
    console.log('Step 1: Attempting authentication...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'Shannon@tshla.ai',
      password: 'Shannon2025!'
    });

    if (authError) {
      console.log('❌ Authentication FAILED');
      console.log('Error:', authError.message);
      console.log('\nThis means either:');
      console.log('  • No auth account exists for Shannon@tshla.ai');
      console.log('  • Or the password is incorrect');
      return;
    }

    console.log('✅ Authentication SUCCESSFUL!');
    console.log('Auth User ID:', authData.user.id);
    console.log('Email:', authData.user.email);
    console.log('Email Confirmed:', authData.user.email_confirmed_at ? 'Yes' : 'No');

    // Now check for medical_staff record
    console.log('\nStep 2: Looking for medical_staff record...');
    const { data: staffData, error: staffError } = await supabase
      .from('medical_staff')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (staffError || !staffData) {
      console.log('❌ NO MEDICAL_STAFF RECORD FOUND');
      console.log('\nThis is the problem! Shannon can authenticate but:');
      console.log('  • Auth account exists ✅');
      console.log('  • Medical_staff record missing ❌');
      console.log('  • Result: Gets kicked out after entering password');
      
      // Sign out
      await supabase.auth.signOut();
      
      console.log('\n📋 TO FIX: Create medical_staff record with:');
      console.log('  auth_user_id:', authData.user.id);
      console.log('  email: Shannon@tshla.ai');
      console.log('  first_name: Shannon');
      console.log('  last_name: Gregorek');
      console.log('  role: doctor');
      console.log('  specialty: Endocrinology');
    } else {
      console.log('✅ MEDICAL_STAFF RECORD FOUND!');
      console.log('\nShannon can login successfully! 🎉');
      console.log('Name:', staffData.first_name, staffData.last_name);
      console.log('Role:', staffData.role);
      console.log('Active:', staffData.is_active ? 'Yes' : 'No');
      console.log('Verified:', staffData.is_verified ? 'Yes' : 'No');
      
      // Sign out
      await supabase.auth.signOut();
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }

  console.log('\n');
}

testShannonLogin().catch(console.error);
