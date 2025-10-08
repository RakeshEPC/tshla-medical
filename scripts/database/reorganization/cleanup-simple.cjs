/**
 * Simple cleanup script - runs SQL commands directly
 */

const { createClient } = require('@supabase/supabase-js');

// Your Supabase credentials
const supabaseUrl = 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkwNDE1OTAsImV4cCI6MjA1NDYxNzU5MH0.UVrmcvVl9Vv_j-s-f3D_P2LOHnTCRv7qd9mPWW0nZ5w';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runCleanup() {
  console.log('🔄 Starting cleanup...\n');

  // Step 1: Drop pump_users (this will CASCADE to drop constraints)
  console.log('Step 1: Attempting to drop pump_users table via SQL...');
  console.log('This requires running SQL manually in Supabase dashboard.\n');

  // Step 2: Check current state
  console.log('Step 2: Checking current database state...\n');

  // Check if pump_users exists
  try {
    const { count: pumpCount, error: pumpError } = await supabase
      .from('pump_users')
      .select('*', { count: 'exact', head: true });

    if (pumpError) {
      console.log('✓ pump_users table does NOT exist (already dropped or never created)');
    } else {
      console.log(`⚠️  pump_users table EXISTS with ${pumpCount} rows`);
      console.log('    You need to drop it manually.');
    }
  } catch (e) {
    console.log('✓ pump_users table does NOT exist');
  }

  // Check patients table
  try {
    const { count: patientCount, error: patientError } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true });

    if (patientError) {
      console.log('❌ patients table does NOT exist - need to create it');
    } else {
      console.log(`✓ patients table exists with ${patientCount} rows`);
    }
  } catch (e) {
    console.log('❌ patients table does NOT exist');
  }

  // Check pump_assessments
  try {
    const { count: assessCount, error: assessError } = await supabase
      .from('pump_assessments')
      .select('*', { count: 'exact', head: true });

    if (assessError) {
      console.log('❌ pump_assessments table does NOT exist - need to create it');
    } else {
      console.log(`✓ pump_assessments table exists with ${assessCount} rows`);
    }
  } catch (e) {
    console.log('❌ pump_assessments table does NOT exist');
  }

  console.log('\n========================================');
  console.log('MANUAL SQL COMMANDS NEEDED:');
  console.log('========================================\n');
  console.log('Since Supabase SQL Editor has errors, try these alternatives:\n');
  console.log('OPTION 1: Use Supabase Studio (different UI):');
  console.log('  1. Go to: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb');
  console.log('  2. Click "Table Editor" (not SQL Editor)');
  console.log('  3. Find pump_users table');
  console.log('  4. Click the three dots menu → Delete table\n');
  console.log('OPTION 2: Contact Supabase support about SQL Editor snippet errors\n');
  console.log('OPTION 3: I can update the code to skip pump_users entirely\n');
}

runCleanup().catch(console.error);
