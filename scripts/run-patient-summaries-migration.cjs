#!/usr/bin/env node
/**
 * Run Patient Audio Summaries Database Migration
 * Creates patient_audio_summaries and patient_summary_access_log tables
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('🔄 Running Patient Audio Summaries migration...');
  console.log('📍 Database:', SUPABASE_URL);

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add-patient-audio-summaries.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📝 SQL length:', sql.length, 'characters');

    // Execute the migration
    // Note: Supabase client doesn't support raw SQL execution directly
    // We need to use the Supabase SQL Editor or pg client

    console.log('\n⚠️  MANUAL MIGRATION REQUIRED');
    console.log('═════════════════════════════════════════════════════════════');
    console.log('Supabase JavaScript client does not support raw SQL execution.');
    console.log('Please follow these steps:');
    console.log('\n1. Open Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/minvvjdflezibmgkplqb');
    console.log('\n2. Navigate to: SQL Editor');
    console.log('\n3. Copy the migration file contents:');
    console.log('   File:', migrationPath);
    console.log('\n4. Paste into SQL Editor and click "Run"');
    console.log('\n5. Verify tables created:');
    console.log('   SELECT table_name FROM information_schema.tables');
    console.log('   WHERE table_schema = \'public\'');
    console.log('   AND table_name LIKE \'%audio%\';');
    console.log('═════════════════════════════════════════════════════════════\n');

    // Alternatively, check if tables exist
    console.log('🔍 Checking if tables already exist...');

    const { data: tables, error } = await supabase
      .from('patient_audio_summaries')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('❌ Tables do NOT exist - migration needed');
      } else {
        console.log('⚠️  Error checking tables:', error.message);
      }
    } else {
      console.log('✅ Tables already exist!');
      console.log('   Found patient_audio_summaries table');
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

runMigration();
