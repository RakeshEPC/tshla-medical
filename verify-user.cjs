#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyUser() {
  const email = 'Shannon@tshla.ai';
  
  console.log(`\n🔍 Checking user: ${email}\n`);

  // Get staff record
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', email)
    .single();

  if (staffError || !staffData) {
    console.error('❌ Staff record not found');
    return;
  }

  console.log('✅ Staff Record:');
  console.log(`   Name: ${staffData.first_name} ${staffData.last_name}`);
  console.log(`   Role: ${staffData.role}`);
  console.log(`   Auth User ID: ${staffData.auth_user_id}`);

  // Get auth user
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(
    staffData.auth_user_id
  );

  if (authError) {
    console.error('\n❌ Auth user error:', authError.message);
    return;
  }

  console.log('\n✅ Auth User:');
  console.log(`   Email: ${authData.user.email}`);
  console.log(`   Email Confirmed: ${authData.user.email_confirmed_at ? 'Yes' : 'No'}`);
  console.log(`   Last Sign In: ${authData.user.last_sign_in_at || 'Never'}`);
  console.log(`   Created: ${authData.user.created_at}`);
}

verifyUser()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
