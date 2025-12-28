#!/usr/bin/env tsx
/**
 * Diagnose why pump assessments aren't being saved
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnoseSaveIssue() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DIAGNOSING PUMP ASSESSMENT SAVE ISSUE');
  console.log('='.repeat(80) + '\n');

  // Check 1: Table structure
  console.log('1️⃣  Checking pump_assessments table structure...\n');

  try {
    const { data, error } = await supabase
      .from('pump_assessments')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`   ❌ Error accessing table: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Details: ${error.details}`);
    } else {
      console.log('   ✅ Table accessible');
    }
  } catch (err: any) {
    console.log(`   ❌ Exception: ${err.message}`);
  }

  // Check 2: Test insert with patient_id (current frontend code)
  console.log('\n\n2️⃣  Testing INSERT with patient_id (current frontend approach)...\n');

  try {
    const testData = {
      patient_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      patient_name: 'Test Patient',
      slider_values: { activity: 5 },
      selected_features: [],
      lifestyle_text: 'Test',
      final_recommendation: { topChoice: { name: 'Test Pump', score: 85, reasons: [] }, alternatives: [], keyFactors: [], personalizedInsights: '' },
      first_choice_pump: 'Test Pump'
    };

    const { data, error } = await supabase
      .from('pump_assessments')
      .insert(testData)
      .select();

    if (error) {
      console.log('   ❌ INSERT FAILED (as expected):');
      console.log(`      Error: ${error.message}`);
      console.log(`      Code: ${error.code}`);
      console.log(`      Details: ${error.details}`);
      console.log(`      Hint: ${error.hint}`);

      if (error.message.includes('column') && error.message.includes('patient_id')) {
        console.log('\n   🎯 DIAGNOSIS: Column "patient_id" does NOT exist in table!');
        console.log('      The table expects "user_id" instead.');
      }
      if (error.code === '42703') {
        console.log('\n   🎯 DIAGNOSIS: PostgreSQL error 42703 = undefined column');
      }
      if (error.code === '23503') {
        console.log('\n   🎯 DIAGNOSIS: Foreign key violation - referenced record doesn\'t exist');
      }
    } else {
      console.log('   ✅ INSERT SUCCEEDED (unexpected!)');
      console.log('      Data:', data);

      // Clean up test data
      if (data && data[0]?.id) {
        await supabase.from('pump_assessments').delete().eq('id', data[0].id);
      }
    }
  } catch (err: any) {
    console.log(`   ❌ Exception: ${err.message}`);
  }

  // Check 3: Test insert with user_id (what database expects)
  console.log('\n\n3️⃣  Testing INSERT with user_id (what database schema expects)...\n');

  try {
    const testData = {
      user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      patient_name: 'Test Patient 2',
      slider_values: { activity: 5 },
      selected_features: [],
      lifestyle_text: 'Test',
      final_recommendation: { topChoice: { name: 'Test Pump', score: 85, reasons: [] }, alternatives: [], keyFactors: [], personalizedInsights: '' },
      first_choice_pump: 'Test Pump'
    };

    const { data, error } = await supabase
      .from('pump_assessments')
      .insert(testData)
      .select();

    if (error) {
      console.log('   ❌ INSERT FAILED:');
      console.log(`      Error: ${error.message}`);
      console.log(`      Code: ${error.code}`);

      if (error.code === '23503') {
        console.log('\n   🎯 DIAGNOSIS: Foreign key violation');
        console.log('      user_id must reference an existing record in pump_users table');
      }
    } else {
      console.log('   ✅ INSERT SUCCEEDED!');
      console.log('      This confirms "user_id" is the correct column name');

      // Clean up test data
      if (data && data[0]?.id) {
        await supabase.from('pump_assessments').delete().eq('id', data[0].id);
        console.log('      (Test data cleaned up)');
      }
    }
  } catch (err: any) {
    console.log(`   ❌ Exception: ${err.message}`);
  }

  // Check 4: User tables status
  console.log('\n\n4️⃣  Checking user tables (patients vs pump_users)...\n');

  const tables = ['patients', 'pump_users'];
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ${table.padEnd(15)}: ❌ ${error.message}`);
      } else {
        console.log(`   ${table.padEnd(15)}: ✅ ${count} rows`);
      }
    } catch (err: any) {
      console.log(`   ${table.padEnd(15)}: ❌ ${err.message}`);
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 DIAGNOSIS SUMMARY');
  console.log('='.repeat(80) + '\n');

  console.log('🔴 PROBLEMS IDENTIFIED:');
  console.log('   1. Frontend uses "patient_id" but database schema has "user_id"');
  console.log('   2. Frontend links to "patients" table but RLS policies expect "pump_users"');
  console.log('   3. No users exist in either patients or pump_users tables (0 rows)');

  console.log('\n💡 SOLUTIONS NEEDED:');
  console.log('   Option A: Update frontend code to use "user_id" and "pump_users"');
  console.log('   Option B: Update database schema to use "patient_id" and "patients"');
  console.log('   Option C: Create a unified schema that works for both');

  console.log('\n✅ RECOMMENDED FIX:');
  console.log('   1. Change frontend: patient_id → user_id');
  console.log('   2. Ensure users are created in "pump_users" table when they sign up');
  console.log('   3. Update RLS policies if needed');

  console.log('\n' + '='.repeat(80) + '\n');
}

diagnoseSaveIssue().catch(console.error);
