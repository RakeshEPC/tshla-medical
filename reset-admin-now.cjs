#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetAdminPassword() {
  const email = 'admin@tshla.ai';
  const newPassword = 'Admin2025!';

  console.log(`\n🔐 Resetting password for: ${email}`);

  // Find the medical staff record
  const { data: staffData, error: staffError } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (staffError || !staffData) {
    console.error('❌ Staff record not found');
    process.exit(1);
  }

  console.log(`✅ Found: ${staffData.first_name} ${staffData.last_name}`);

  // Update the password in Supabase Auth
  const { data, error } = await supabase.auth.admin.updateUserById(
    staffData.auth_user_id,
    { password: newPassword }
  );

  if (error) {
    console.error('❌ Password update failed:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Password successfully reset!');
  console.log('\n📋 Login Credentials:');
  console.log('   Email: admin@tshla.ai');
  console.log('   Password: Admin2025!');
  console.log('\n🌐 Login at: https://tshla-unified-api.azurecontainerapps.io');
}

resetAdminPassword()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
