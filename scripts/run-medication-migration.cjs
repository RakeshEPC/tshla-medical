/**
 * Run medication management database migration
 * Created: 2026-01-25
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🔧 Running medication management migration...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/migrations/add-patient-medications-management.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file:', migrationPath);
    console.log('📝 SQL length:', sql.length, 'characters\n');

    // Execute the migration using the service role key
    // Note: Supabase JS client doesn't support raw SQL execution directly
    // We need to use the SQL editor or PostgREST API

    console.log('⚠️  Manual migration required:');
    console.log('1. Go to Supabase dashboard: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new');
    console.log('2. Copy and paste the SQL from:', migrationPath);
    console.log('3. Click "Run" to execute the migration\n');

    console.log('📋 Migration SQL:\n');
    console.log('=' .repeat(80));
    console.log(sql);
    console.log('=' .repeat(80));

    // Check if table already exists
    const { data, error } = await supabase
      .from('patient_medications')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      console.log('\n✅ Table does not exist yet - migration needs to be run');
    } else if (!error) {
      console.log('\n✅ Table already exists - migration may have already been run');
      console.log('   Row count check:', data?.length || 0);
    } else {
      console.log('\n⚠️  Error checking table:', error.message);
    }

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

runMigration();
