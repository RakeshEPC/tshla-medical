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

async function verifyEmail() {
  const email = 'Shannon@tshla.ai';
  
  console.log(`\n🔍 Verifying email for: ${email}\n`);

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

  console.log(`✅ Found: ${staffData.first_name} ${staffData.last_name}`);

  // Update auth user to confirm email
  const { data, error } = await supabase.auth.admin.updateUserById(
    staffData.auth_user_id,
    { 
      email_confirm: true,
      password: 'Shannon2025!'
    }
  );

  if (error) {
    console.error('❌ Verification failed:', error.message);
    return;
  }

  console.log('\n✅ Email verified and password reset!');
  console.log('\n📋 Login Credentials:');
  console.log('   Email: Shannon@tshla.ai');
  console.log('   Password: Shannon2025!');
  console.log('\n🌐 Login at: https://www.tshla.ai');
}

verifyEmail()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
