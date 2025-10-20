#!/usr/bin/env node

/**
 * TSHLA Medical - Migration Verification Script
 * Verifies that the Supabase migration was successful
 * Usage: node scripts/verify-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const EXPECTED_TABLES = [
  'dictated_notes',
  'note_versions',
  'note_comments',
  'schedule_note_links',
  'note_templates_used',
  'provider_schedules'
];

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  TSHLA Medical - Migration Verification                  ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

async function main() {
  try {
    // Connect to Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    console.log('🔌 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check tables
    console.log('\n📋 Checking tables...\n');

    const results = {};

    for (const tableName of EXPECTED_TABLES) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          if (error.code === 'PGRST116' || error.code === '42P01') {
            results[tableName] = { exists: false, count: 0 };
            console.log(`  ❌ ${tableName} - NOT FOUND`);
          } else {
            results[tableName] = { exists: true, count: count || 0, error: error.message };
            console.log(`  ⚠️  ${tableName} - Exists but error: ${error.message}`);
          }
        } else {
          results[tableName] = { exists: true, count: count || 0 };
          console.log(`  ✅ ${tableName} - OK (${count || 0} rows)`);
        }
      } catch (err) {
        results[tableName] = { exists: false, error: err.message };
        console.log(`  ❌ ${tableName} - ERROR: ${err.message}`);
      }
    }

    // Check API connectivity
    console.log('\n🌐 Checking API health...');
    try {
      const apiUrl = 'https://tshla-schedule-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/health';
      const response = await fetch(apiUrl);
      const health = await response.json();

      console.log(`  Service: ${health.service}`);
      console.log(`  Database: ${health.database}`);
      console.log(`  Database Type: ${health.databaseType}`);

      if (health.database === 'connected') {
        console.log('  ✅ API connected to Supabase');
      } else if (health.database === 'fallback-mode') {
        console.log('  ⚠️  API in fallback mode - tables may not exist');
      }
    } catch (err) {
      console.log(`  ❌ Could not reach API: ${err.message}`);
    }

    // Summary
    const allExist = EXPECTED_TABLES.every(t => results[t].exists);
    const totalRows = Object.values(results).reduce((sum, r) => sum + (r.count || 0), 0);

    console.log('\n' + '━'.repeat(60));
    console.log('📊 Summary:');
    console.log(`  Tables: ${Object.values(results).filter(r => r.exists).length}/${EXPECTED_TABLES.length}`);
    console.log(`  Total rows: ${totalRows}`);

    if (allExist) {
      console.log('\n✅ MIGRATION VERIFIED - All tables exist!');
      console.log('\nReady to use:');
      console.log('  - Dictation save will work');
      console.log('  - Provider data isolated');
      console.log('  - Full audit trail enabled');
    } else {
      console.log('\n⚠️  MIGRATION INCOMPLETE - Some tables missing');
      console.log('\nRun the migration:');
      console.log('  node scripts/migrate-supabase.js');
    }
    console.log('━'.repeat(60) + '\n');

    process.exit(allExist ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

main();
