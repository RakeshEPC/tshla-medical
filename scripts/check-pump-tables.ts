#!/usr/bin/env tsx
/**
 * Check what pump-related tables exist and their row counts
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

async function checkTables() {
  console.log('🔍 Checking Supabase tables...\n');

  const tablesToCheck = [
    'pump_assessments',
    'pump_users',
    'patients',
    'medical_staff',
    'unified_patients',
    'pump_comparison_data',
    'dtsqs_responses'
  ];

  for (const table of tablesToCheck) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table.padEnd(25)}: ${error.message}`);
      } else {
        console.log(`✅ ${table.padEnd(25)}: ${count || 0} rows`);
      }
    } catch (err: any) {
      console.log(`❌ ${table.padEnd(25)}: ${err.message}`);
    }
  }

  // Try to get actual data from pump_assessments if it exists
  console.log('\n\n📊 Attempting to retrieve pump_assessments data...\n');

  try {
    const { data, error } = await supabase
      .from('pump_assessments')
      .select('id, patient_name, patient_id, first_choice_pump, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.log(`Error: ${error.message}`);
      console.log(`Code: ${error.code}`);
      console.log(`Details: ${error.details}`);
      console.log(`Hint: ${error.hint}`);
    } else if (!data || data.length === 0) {
      console.log('Table exists but contains 0 rows');
    } else {
      console.log(`Found ${data.length} assessment(s):`);
      data.forEach((a: any, idx: number) => {
        console.log(`  ${idx + 1}. ${a.patient_name || 'N/A'} - ${a.first_choice_pump || 'No pump choice'} - ${new Date(a.created_at).toLocaleDateString()}`);
      });
    }
  } catch (err: any) {
    console.log(`Error checking pump_assessments: ${err.message}`);
  }

  // Check patients table
  console.log('\n\n📊 Checking patients table...\n');

  try {
    const { data, error, count } = await supabase
      .from('patients')
      .select('id, first_name, last_name, email, pumpdrive_enabled', { count: 'exact' })
      .limit(10);

    if (error) {
      console.log(`Error: ${error.message}`);
    } else {
      console.log(`Total patients: ${count}`);
      if (data && data.length > 0) {
        console.log(`\nFirst ${data.length} patients:`);
        data.forEach((p: any, idx: number) => {
          const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'N/A';
          console.log(`  ${idx + 1}. ${name} (PumpDrive: ${p.pumpdrive_enabled ? 'Yes' : 'No'})`);
        });
      }
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
}

checkTables().then(() => {
  console.log('\n✅ Check complete\n');
}).catch(console.error);
