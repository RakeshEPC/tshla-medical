/**
 * Database Migration Script
 * Adds tshla_id column to unified_patients table
 *
 * Run with: node server/migrate-add-tshla-id.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🔄 Starting database migration: Add TSHLA ID Column');
  console.log('========================================\n');

  try {
    // Read migration SQL file
    const migrationPath = path.resolve(__dirname, '../database/migrations/add-tshla-id-column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📊 SQL commands to execute:');
    console.log(migrationSQL.split('\n').filter(line => line.trim() && !line.trim().startsWith('--')).slice(0, 5).join('\n'));
    console.log('...\n');

    // Execute migration
    console.log('⏳ Executing migration...');

    // Note: Supabase JS client doesn't support raw SQL for security
    // We need to use the Supabase SQL Editor or REST API
    // For now, we'll use rpc to execute the migration

    // Alternative: Use Supabase REST API to execute raw SQL
    const response = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/rpc`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          sql: migrationSQL
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Migration failed: ${error}`);
    }

    console.log('✅ Migration executed successfully!\n');

    // Verify migration
    console.log('🔍 Verifying migration...');

    const { data, error } = await supabase
      .from('unified_patients')
      .select('*')
      .limit(1);

    if (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }

    // Check if tshla_id column exists
    if (data && data.length > 0) {
      const hasColumn = 'tshla_id' in data[0];
      if (hasColumn) {
        console.log('✅ Column tshla_id verified in unified_patients table');
      } else {
        console.warn('⚠️  Column tshla_id not found - migration may have failed');
      }
    }

    // Get patient statistics
    const { count: total } = await supabase
      .from('unified_patients')
      .select('id', { count: 'exact', head: true });

    const { count: withIds } = await supabase
      .from('unified_patients')
      .select('id', { count: 'exact', head: true })
      .not('tshla_id', 'is', null);

    console.log('\n📊 Patient Statistics:');
    console.log(`   Total patients: ${total || 0}`);
    console.log(`   With TSHLA ID: ${withIds || 0}`);
    console.log(`   Without TSHLA ID: ${(total || 0) - (withIds || 0)}`);

    console.log('\n========================================');
    console.log('✅ Migration completed successfully!');
    console.log('========================================\n');

    console.log('📝 Next steps:');
    console.log('   1. Run: node server/services/patientIdGenerator.service.js');
    console.log('      To generate IDs for existing patients');
    console.log('   2. Test patient ID generation in the app');
    console.log('   3. Import legacy EMR data with MRNs\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n🔧 Manual migration required:');
    console.error('   1. Go to Supabase Dashboard: https://supabase.com');
    console.error('   2. Navigate to: SQL Editor');
    console.error('   3. Run the SQL from: database/migrations/add-tshla-id-column.sql\n');
    process.exit(1);
  }
}

// Run migration
runMigration();
