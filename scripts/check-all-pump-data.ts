#!/usr/bin/env tsx
/**
 * Check all pump-related data in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAllPumpData() {
  console.log('🔍 Checking all pump-related tables...\n');

  // Check pump_assessments table
  console.log('1️⃣  Checking pump_assessments table...');
  try {
    const { data: assessments, error, count } = await supabase
      .from('pump_assessments')
      .select('*', { count: 'exact', head: false });

    if (error) {
      console.error('  ❌ Error:', error.message);
    } else {
      console.log(`  ✅ Found ${count} assessment(s)`);
      if (assessments && assessments.length > 0) {
        console.log('  Sample patient names:');
        assessments.slice(0, 10).forEach((a: any) => {
          console.log(`    - ${a.patient_name || 'N/A'} (${new Date(a.created_at).toLocaleDateString()})`);
        });
      }
    }
  } catch (err) {
    console.error('  ❌ Unexpected error:', err);
  }

  console.log();

  // Check patients table
  console.log('2️⃣  Checking patients table...');
  try {
    const { data: patients, error, count } = await supabase
      .from('patients')
      .select('id, first_name, last_name, email, pumpdrive_enabled, pumpdrive_last_assessment', { count: 'exact' });

    if (error) {
      console.error('  ❌ Error:', error.message);
    } else {
      console.log(`  ✅ Found ${count} patient(s)`);
      if (patients && patients.length > 0) {
        console.log('  Sample patients:');
        patients.slice(0, 10).forEach((p: any) => {
          const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          console.log(`    - ${fullName || p.email || 'N/A'} (PumpDrive: ${p.pumpdrive_enabled ? 'Yes' : 'No'})`);
        });
      }
    }
  } catch (err) {
    console.error('  ❌ Unexpected error:', err);
  }

  console.log();

  // Search for specific names in patients table
  console.log('3️⃣  Searching for specific patients by name...');
  const searchNames = [
    { first: 'Michael', last: 'Dummer' },
    { first: 'Michale', last: 'Dummer' },
    { first: 'Jagdeep', last: 'Verma' },
    { first: 'William', last: 'Watson' },
    { first: 'Gail', last: 'Kennedy' },
    { first: 'Suresh', last: 'Nayak' },
  ];

  for (const name of searchNames) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .ilike('first_name', `%${name.first}%`)
        .ilike('last_name', `%${name.last}%`);

      if (error) {
        console.log(`  ❌ ${name.first} ${name.last}: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`  ✅ ${name.first} ${name.last}: Found ${data.length} match(es)`);
        data.forEach((p: any) => {
          console.log(`     ID: ${p.id}, Email: ${p.email || 'N/A'}`);
        });
      } else {
        console.log(`  ⚠️  ${name.first} ${name.last}: Not found`);
      }
    } catch (err) {
      console.log(`  ❌ ${name.first} ${name.last}: Error`);
    }
  }

  console.log();

  // Check for any pump-related data in scheduled_pumps or similar tables
  console.log('4️⃣  Checking for scheduled_pumps table...');
  try {
    const { data, error } = await supabase
      .from('scheduled_pumps')
      .select('*', { count: 'exact', head: false });

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('  ⚠️  Table does not exist');
      } else {
        console.error('  ❌ Error:', error.message);
      }
    } else {
      console.log(`  ✅ Found ${data?.length || 0} record(s)`);
    }
  } catch (err) {
    console.error('  ⚠️  Table likely does not exist');
  }

  console.log();

  // Try to search in all patients for names containing keywords
  console.log('5️⃣  Searching all patients for keyword matches...');
  try {
    const keywords = ['dummer', 'verma', 'watson', 'kennedy', 'nayak'];

    for (const keyword of keywords) {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, email')
        .or(`first_name.ilike.%${keyword}%,last_name.ilike.%${keyword}%,email.ilike.%${keyword}%`);

      if (!error && data && data.length > 0) {
        console.log(`  ✅ Keyword "${keyword}": Found ${data.length} match(es)`);
        data.forEach((p: any) => {
          console.log(`     - ${p.first_name} ${p.last_name} (${p.email || 'no email'})`);
        });
      }
    }
  } catch (err) {
    console.error('  ❌ Search error:', err);
  }
}

checkAllPumpData().then(() => {
  console.log('\n✅ Check complete\n');
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
