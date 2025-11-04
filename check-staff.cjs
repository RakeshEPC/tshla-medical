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

async function listStaff() {
  const { data, error } = await supabase
    .from('medical_staff')
    .select('email, first_name, last_name, role')
    .order('email');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('\n📋 Medical Staff Accounts:\n');
  data.forEach(staff => {
    console.log(`  ${staff.email.padEnd(30)} - ${staff.first_name} ${staff.last_name} (${staff.role})`);
  });
  console.log('');
}

listStaff()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
