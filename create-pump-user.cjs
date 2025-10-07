#!/usr/bin/env node
/**
 * Create New PumpDrive User
 * Interactive script to create a new pump user in Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('\nPlease ensure these are set:');
  console.log('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createPumpUser() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🆕 CREATE NEW PUMPDRIVE USER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Collect user information
    const email = await question('📧 Email address: ');
    if (!email || !email.includes('@')) {
      console.log('❌ Invalid email address');
      rl.close();
      return;
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('pump_users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      console.log(`❌ Email ${email} already exists!`);
      console.log('💡 Try a different email or use: node list-pump-users.cjs');
      rl.close();
      return;
    }

    const password = await question('🔑 Password (min 6 characters): ');
    if (!password || password.length < 6) {
      console.log('❌ Password must be at least 6 characters');
      rl.close();
      return;
    }

    const firstName = await question('👤 First Name: ');
    const lastName = await question('👤 Last Name: ');
    const phoneNumber = await question('📱 Phone Number (optional, press Enter to skip): ');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 CONFIRM USER DETAILS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:      ${email}`);
    console.log(`Name:       ${firstName} ${lastName}`);
    console.log(`Phone:      ${phoneNumber || 'Not provided'}`);
    console.log('Password:   ******** (hidden for security)');
    console.log('');

    const confirm = await question('✅ Create this user? (y/n): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled by user');
      rl.close();
      return;
    }

    console.log('\n⏳ Creating user...\n');

    // Step 1: Create user in Supabase Auth
    console.log('1️⃣  Creating authentication account...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error('❌ Auth creation failed:', authError.message);
      rl.close();
      return;
    }

    console.log('   ✅ Authentication account created');
    console.log(`   🆔 Auth User ID: ${authData.user.id}`);

    // Step 2: Create pump_users record
    console.log('\n2️⃣  Creating pump user profile...');
    const { data: pumpData, error: pumpError } = await supabase
      .from('pump_users')
      .insert({
        email: email,
        username: email.split('@')[0],
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber || null,
        auth_user_id: authData.user.id,
        is_active: true,
        is_verified: true, // Pre-verify for testing
        current_payment_status: 'trial',
        subscription_tier: 'basic',
      })
      .select()
      .single();

    if (pumpError) {
      console.error('❌ Pump user creation failed:', pumpError.message);

      // Cleanup: Delete the auth user if pump_users creation failed
      console.log('🔄 Cleaning up auth user...');
      await supabase.auth.admin.deleteUser(authData.user.id);

      rl.close();
      return;
    }

    console.log('   ✅ Pump user profile created');
    console.log(`   🆔 Pump User ID: ${pumpData.id}`);

    // Success!
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 USER CREATED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Login Credentials:');
    console.log(`  📧 Email:    ${email}`);
    console.log(`  🔑 Password: ${password}`);
    console.log('');
    console.log('User Details:');
    console.log(`  👤 Name:     ${firstName} ${lastName}`);
    console.log(`  🆔 ID:       ${pumpData.id}`);
    console.log(`  ✅ Active:   ${pumpData.is_active}`);
    console.log(`  💳 Status:   ${pumpData.current_payment_status}`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 NEXT STEPS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Test login:');
    console.log('   node test-pump-login.cjs');
    console.log('');
    console.log('2. Or login via app:');
    console.log('   • Go to: http://localhost:5173/login');
    console.log(`   • Email: ${email}`);
    console.log(`   • Password: ${password}`);
    console.log('');
    console.log('3. Access PumpDrive:');
    console.log('   http://localhost:5173/pumpdrive');
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  } finally {
    rl.close();
  }
}

createPumpUser().catch(console.error);
