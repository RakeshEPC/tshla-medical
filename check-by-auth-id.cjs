#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const authUserId = 'fd12fd3a-7ebb-454a-9a2c-0f14788d81fb';

  console.log(`\nChecking medical_staff for auth_user_id: ${authUserId}`);

  const { data, error } = await supabase
    .from('medical_staff')
    .select('*')
    .eq('auth_user_id', authUserId);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Results:', JSON.stringify(data, null, 2));
}

check().then(() => process.exit(0));
