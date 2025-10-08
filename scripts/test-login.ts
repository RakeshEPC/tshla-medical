#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testLogin() {
  console.log('🔐 Testing login with admin@tshla.ai...\n');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@tshla.ai',
    password: 'TshlaAdmin2025!'
  });

  if (error) {
    console.error('❌ Login error:', error.message);
    console.error('   Code:', error.status);
    console.error('   Name:', error.name);

    // Check user status
    console.log('\n🔍 Checking user status...');
    const serviceSupabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { users } } = await serviceSupabase.auth.admin.listUsers();
    const user = users.find(u => u.email === 'admin@tshla.ai');

    if (user) {
      console.log('   User found in database');
      console.log('   Email confirmed:', user.email_confirmed_at ? 'Yes' : 'No');
      console.log('   Banned:', user.banned_until || 'No');
      console.log('   Last sign in:', user.last_sign_in_at || 'Never');
    }
  } else {
    console.log('✅ Login successful!');
    console.log('   User ID:', data.user?.id);
    console.log('   Email:', data.user?.email);
    console.log('   Email confirmed:', data.user?.email_confirmed_at ? 'Yes' : 'No');
    console.log('   Session token:', data.session?.access_token ? 'Present' : 'Missing');
  }

  // Also test rakesh.patel@tshla.ai
  console.log('\n🔐 Testing login with rakesh.patel@tshla.ai...\n');

  const { data: data2, error: error2 } = await supabase.auth.signInWithPassword({
    email: 'rakesh.patel@tshla.ai',
    password: 'TshlaAdmin2025!'
  });

  if (error2) {
    console.error('❌ Login error:', error2.message);
  } else {
    console.log('✅ Login successful!');
    console.log('   User ID:', data2.user?.id);
  }
}

testLogin();
