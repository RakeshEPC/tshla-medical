#!/usr/bin/env node
/**
 * List All PumpDrive Users
 * Shows all pump users in Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
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

async function listPumpUsers() {
  console.log('🔍 Listing All PumpDrive Users\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get all pump users
    const { data: pumpUsers, error } = await supabase
      .from('pump_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching pump users:', error.message);
      return;
    }

    if (!pumpUsers || pumpUsers.length === 0) {
      console.log('⚠️  No pump users found in database\n');
      console.log('💡 Create your first pump user with:');
      console.log('   node create-pump-user.cjs\n');
      return;
    }

    console.log(`✅ Found ${pumpUsers.length} pump user(s):\n`);

    pumpUsers.forEach((user, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`User #${index + 1}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📧 Email:        ${user.email}`);
      console.log(`👤 Name:         ${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Not set');
      console.log(`🆔 Username:     ${user.username || 'Not set'}`);
      console.log(`📱 Phone:        ${user.phone_number || 'Not set'}`);
      console.log(`🔗 Auth ID:      ${user.auth_user_id || 'Not linked'}`);
      console.log(`✅ Active:       ${user.is_active ? 'Yes' : 'No'}`);
      console.log(`✅ Verified:     ${user.is_verified ? 'Yes' : 'No'}`);
      console.log(`👑 Admin:        ${user.is_admin ? 'Yes' : 'No'}`);
      console.log(`💳 Payment:      ${user.current_payment_status || 'Unknown'}`);
      console.log(`📊 Assessments:  ${user.assessments_completed || 0}`);
      console.log(`📅 Created:      ${new Date(user.created_at).toLocaleString()}`);
      console.log(`🔑 Last Login:   ${user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}`);
      console.log(`🔢 Login Count:  ${user.login_count || 0}`);
      console.log('');
    });

    // Summary
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('📊 SUMMARY');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total Users:     ${pumpUsers.length}`);
    console.log(`Active:          ${pumpUsers.filter(u => u.is_active).length}`);
    console.log(`Verified:        ${pumpUsers.filter(u => u.is_verified).length}`);
    console.log(`Admins:          ${pumpUsers.filter(u => u.is_admin).length}`);
    console.log(`With Auth Link:  ${pumpUsers.filter(u => u.auth_user_id).length}`);
    console.log('');

    // List all emails
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 EMAIL LIST (for reference)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    pumpUsers.forEach(user => {
      console.log(`  • ${user.email}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

listPumpUsers().catch(console.error);
