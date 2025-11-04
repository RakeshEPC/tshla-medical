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

async function fixShannon() {
  const email = 'Shannon@tshla.ai';
  
  console.log(`\n🔧 Fixing verification for: ${email}\n`);

  // Update medical_staff is_verified
  const { data, error } = await supabase
    .from('medical_staff')
    .update({ is_verified: true })
    .eq('email', email)
    .select();

  if (error) {
    console.error('❌ Update failed:', error.message);
    return;
  }

  console.log('✅ Shannon\'s account is now verified!');
  console.log('\n📋 Login Credentials:');
  console.log('   Email: Shannon@tshla.ai');
  console.log('   Password: Shannon2025!');
  console.log('\n🌐 Login at: https://www.tshla.ai');
}

fixShannon()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
