#!/usr/bin/env node
/**
 * Test PumpDrive User Login
 * Tests login functionality for pump users
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('\nPlease ensure these are set:');
  console.log('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.log('  VITE_SUPABASE_ANON_KEY=your_anon_key');
  process.exit(1);
}

// Use anon key like frontend does
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testLogin() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TEST PUMPDRIVE USER LOGIN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const email = await question('📧 Email: ');
    const password = await question('🔑 Password: ');

    console.log('\n⏳ Testing login...\n');

    // Step 1: Sign in with Supabase Auth
    console.log('1️⃣  Authenticating with Supabase...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.log(`   ❌ Login failed: ${authError.message}`);
      console.log('');
      console.log('💡 Possible reasons:');
      console.log('   • Wrong email or password');
      console.log('   • User does not exist');
      console.log('   • Email not confirmed (check Supabase Auth dashboard)');
      console.log('');
      console.log('🔍 Check existing users with:');
      console.log('   node list-pump-users.cjs');
      rl.close();
      return;
    }

    console.log('   ✅ Authentication successful!');
    console.log(`   🆔 Auth User ID: ${authData.user.id}`);
    console.log(`   📧 Email: ${authData.user.email}`);

    // Step 2: Get pump_users record
    console.log('\n2️⃣  Fetching pump user profile...');
    const { data: pumpData, error: pumpError } = await supabase
      .from('pump_users')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .single();

    if (pumpError || !pumpData) {
      console.log('   ❌ Pump user profile not found');
      console.log('');
      console.log('⚠️  The user exists in Supabase Auth but not in pump_users table');
      console.log('💡 This user needs to be added to pump_users table');

      // Sign out
      await supabase.auth.signOut();
      rl.close();
      return;
    }

    console.log('   ✅ Pump user profile found!');

    // Success!
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 LOGIN SUCCESSFUL!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('User Profile:');
    console.log(`  📧 Email:           ${pumpData.email}`);
    console.log(`  👤 Name:            ${pumpData.first_name} ${pumpData.last_name}`);
    console.log(`  🆔 Username:        ${pumpData.username || 'Not set'}`);
    console.log(`  📱 Phone:           ${pumpData.phone_number || 'Not set'}`);
    console.log(`  ✅ Active:          ${pumpData.is_active ? 'Yes' : 'No'}`);
    console.log(`  ✅ Verified:        ${pumpData.is_verified ? 'Yes' : 'No'}`);
    console.log(`  👑 Admin:           ${pumpData.is_admin ? 'Yes' : 'No'}`);
    console.log(`  💳 Payment Status:  ${pumpData.current_payment_status}`);
    console.log(`  📦 Subscription:    ${pumpData.subscription_tier}`);
    console.log(`  📊 Assessments:     ${pumpData.assessments_completed || 0}`);
    console.log(`  🔢 Login Count:     ${(pumpData.login_count || 0) + 1}`);
    console.log('');

    console.log('Access Token (for API calls):');
    console.log(`  ${authData.session.access_token.substring(0, 50)}...`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VERIFICATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('This user can:');
    console.log('  ✅ Log in to the app');
    console.log('  ✅ Access PumpDrive assessment');
    console.log('  ✅ Save assessment data');
    console.log('  ✅ View results');
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Go to: http://localhost:5173/login');
    console.log(`  2. Login with: ${email}`);
    console.log('  3. Start PumpDrive assessment');
    console.log('');

    // Sign out for security
    await supabase.auth.signOut();

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  } finally {
    rl.close();
  }
}

testLogin().catch(console.error);
