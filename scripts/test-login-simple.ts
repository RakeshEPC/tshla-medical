#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testLogin() {
  const email = process.argv[2] || 'admin@tshla.ai';
  const password = process.argv[3] || 'TshlaAdmin2025!';

  console.log(`🔐 Testing login with ${email}...\n`);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('❌ Login FAILED:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Status: ${error.status}`);
    return;
  }

  console.log('✅ Login SUCCESSFUL!\n');
  console.log('📋 User Details:');
  console.log(`   ID:    ${data.user?.id}`);
  console.log(`   Email: ${data.user?.email}`);
  console.log(`   Confirmed: ${data.user?.email_confirmed_at ? 'Yes' : 'No'}`);
  console.log('\n📋 Session:');
  console.log(`   Token: ${data.session?.access_token ? 'Present' : 'Missing'}`);
  console.log(`   Expires: ${data.session?.expires_at ? new Date(data.session.expires_at * 1000).toLocaleString() : 'Unknown'}`);

  // Sign out
  await supabase.auth.signOut();
  console.log('\n✅ Test complete (signed out)');
}

testLogin();
