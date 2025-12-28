#!/usr/bin/env tsx
/**
 * Check the ACTUAL schema of pump_assessments table in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL');
  process.exit(1);
}

// Try service role key first, fall back to anon key
const apiKey = SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!apiKey) {
  console.error('❌ Missing SUPABASE keys');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, apiKey);

async function checkActualSchema() {
  console.log('\n🔍 Checking ACTUAL pump_assessments table schema in Supabase...\n');

  // Query PostgreSQL information_schema to get actual column names
  const { data, error } = await supabase
    .rpc('get_table_columns', { table_name: 'pump_assessments' })
    .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

  if (error || !data) {
    console.log('⚠️  Cannot use RPC, trying alternative method...\n');

    // Alternative: Try to insert with both column names and see which one works
    console.log('Testing which column exists (patient_id vs user_id):\n');

    // Test 1: patient_id
    const test1 = await supabase
      .from('pump_assessments')
      .insert({ patient_name: '__test__' })
      .select();

    if (test1.error) {
      console.log('Test INSERT result:');
      console.log(`  Error: ${test1.error.message}`);
      console.log(`  Code: ${test1.error.code}\n`);

      if (test1.error.message.includes('patient_id')) {
        console.log('🎯 Table HAS column "patient_id" (it complained about it being null/invalid)');
      } else if (test1.error.message.includes('user_id')) {
        console.log('🎯 Table HAS column "user_id" (it complained about it being null/invalid)');
      } else if (test1.error.code === '42501') {
        console.log('🎯 Row Level Security is BLOCKING the insert');
        console.log('   This means we need to be authenticated OR use service role key\n');

        // Let's check what INSERT columns the schema expects by looking at the error
        console.log('Checking OpenAPI schema...');

        try {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${apiKey}`);
          const schema = await response.json();

          if (schema.definitions && schema.definitions.pump_assessments) {
            console.log('\n✅ Found pump_assessments schema:');
            const props = schema.definitions.pump_assessments.properties;
            const requiredFields = schema.definitions.pump_assessments.required || [];

            console.log('\nColumns in table:');
            Object.keys(props).forEach(col => {
              const isRequired = requiredFields.includes(col);
              const type = props[col].type || 'unknown';
              const format = props[col].format || '';
              console.log(`  - ${col.padEnd(30)} : ${type} ${format} ${isRequired ? '(REQUIRED)' : ''}`);
            });

            // Check specifically for user_id vs patient_id
            if (props.patient_id) {
              console.log('\n🎯 CONFIRMATION: Table uses "patient_id"');
            } else if (props.user_id) {
              console.log('\n🎯 CONFIRMATION: Table uses "user_id"');
            } else {
              console.log('\n⚠️  Neither patient_id nor user_id found in schema!');
            }
          }
        } catch (err: any) {
          console.log('❌ Could not fetch schema:', err.message);
        }
      }
    }
  } else {
    console.log('✅ Columns in pump_assessments table:');
    data.forEach((col: any) => {
      console.log(`  - ${col.column_name.padEnd(30)} : ${col.data_type}`);
    });
  }
}

checkActualSchema().catch(console.error);
