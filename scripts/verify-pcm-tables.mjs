#!/usr/bin/env node

/**
 * Verify PCM Tables in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔍 Checking PCM tables in Supabase...\n');

const expectedTables = [
  'pcm_enrollments',
  'pcm_contacts',
  'pcm_vitals',
  'pcm_tasks',
  'pcm_time_entries',
  'pcm_lab_orders',
  'pcm_goals'
];

async function checkTables() {
  let allTablesExist = true;

  for (const tableName of expectedTables) {
    try {
      // Try to query the table (will fail if doesn't exist)
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ ${tableName} - NOT FOUND`);
          allTablesExist = false;
        } else {
          console.log(`⚠️  ${tableName} - Error: ${error.message}`);
        }
      } else {
        console.log(`✅ ${tableName} - EXISTS (${count || 0} rows)`);
      }
    } catch (err) {
      console.log(`❌ ${tableName} - ERROR: ${err.message}`);
      allTablesExist = false;
    }
  }

  console.log('');

  if (allTablesExist) {
    console.log('🎉 All PCM tables successfully created!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Add route to App.tsx: /staff-dashboard');
    console.log('2. Commit and push the route change');
    console.log('3. Test the dashboard');
    return true;
  } else {
    console.log('⚠️  Some tables are missing!');
    console.log('');
    console.log('Please run the SQL migration in Supabase:');
    console.log('https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new');
    return false;
  }
}

checkTables().then(success => {
  process.exit(success ? 0 : 1);
});
