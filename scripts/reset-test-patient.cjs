#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://minvvjdflezibmgkplqb.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function resetPassword() {
  const userId = '5e108a83-824c-43aa-bd7c-a5609f8e522c'; // eagles@tshla.ai
  const newPassword = 'TestPatient2025!';

  console.log('Resetting password for eagles@tshla.ai...');

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
    email_confirm: true
  });

  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    console.log('✅ Password reset successfully!');
    console.log('');
    console.log('═══════════════════════════════════');
    console.log('Login Credentials:');
    console.log('═══════════════════════════════════');
    console.log('Email:    eagles@tshla.ai');
    console.log('Password: TestPatient2025!');
    console.log('═══════════════════════════════════');
  }
}

resetPassword();
