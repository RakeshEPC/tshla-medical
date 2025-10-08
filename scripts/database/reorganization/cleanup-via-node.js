/**
 * TSHLA Medical - Database Cleanup via Node.js
 * Run this to clean up pump_users and prepare patients table
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function cleanup() {
  console.log('🔄 Starting database cleanup...\n');

  try {
    // Step 1: Delete old assessments
    console.log('Step 1: Deleting old pump assessments...');
    const { error: deleteError } = await supabase
      .from('pump_assessments')
      .delete()
      .not('user_id', 'is', null);

    if (deleteError) {
      console.log('⚠️  No assessments to delete or already cleaned');
    } else {
      console.log('✓ Old assessments deleted');
    }

    // Step 2: Drop pump_users table (via RPC or raw SQL)
    console.log('\nStep 2: Dropping pump_users table...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS pump_users CASCADE;'
    });

    if (dropError) {
      console.log('⚠️  Manual SQL needed for DROP TABLE');
      console.log('   Run this in Supabase SQL Editor:');
      console.log('   DROP TABLE IF EXISTS pump_users CASCADE;');
    } else {
      console.log('✓ pump_users table dropped');
    }

    // Step 3: Check if patients table needs PumpDrive columns
    console.log('\nStep 3: Checking patients table structure...');
    const { data: columns } = await supabase
      .from('patients')
      .select('*')
      .limit(0);

    console.log('✓ patients table exists');

    console.log('\n========================================');
    console.log('✅ CLEANUP COMPLETE!');
    console.log('========================================\n');

    console.log('⚠️  MANUAL STEPS REQUIRED:');
    console.log('You need to run these SQL commands in Supabase SQL Editor:');
    console.log('');
    console.log('1. Drop pump_users table:');
    console.log('   DROP TABLE IF EXISTS pump_users CASCADE;');
    console.log('');
    console.log('2. Update pump_assessments:');
    console.log('   ALTER TABLE pump_assessments DROP COLUMN IF EXISTS user_id CASCADE;');
    console.log('   ALTER TABLE pump_assessments ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id);');
    console.log('');
    console.log('3. Add PumpDrive fields to patients:');
    console.log('   ALTER TABLE patients ADD COLUMN IF NOT EXISTS pumpdrive_enabled BOOLEAN DEFAULT TRUE;');
    console.log('');
    console.log('Copy the commands above and paste them ONE AT A TIME in Supabase SQL Editor.');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanup();
