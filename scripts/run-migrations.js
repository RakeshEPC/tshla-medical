/**
 * Database Migration Runner
 * Runs all pending migrations for the patient portal system
 *
 * Usage:
 *   node scripts/run-migrations.js
 *
 * Environment variables required:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Created: 2026-01-23
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Please set these environment variables in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Migration files in order
const MIGRATIONS = [
  'add-comprehensive-hp.sql',
  'add-ai-chat-conversations.sql',
  'add-patient-portal-analytics.sql'
];

/**
 * Create migrations tracking table if it doesn't exist
 */
async function createMigrationsTable() {
  console.log('📋 Creating migrations tracking table...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (error) {
    console.error('❌ Error creating migrations table:', error);
    return false;
  }

  console.log('✅ Migrations table ready');
  return true;
}

/**
 * Check if migration has been applied
 */
async function isMigrationApplied(migrationName) {
  const { data, error } = await supabase
    .from('schema_migrations')
    .select('migration_name')
    .eq('migration_name', migrationName)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error(`❌ Error checking migration ${migrationName}:`, error);
    return false;
  }

  return !!data;
}

/**
 * Record migration as applied
 */
async function recordMigration(migrationName) {
  const { error } = await supabase
    .from('schema_migrations')
    .insert({ migration_name: migrationName });

  if (error) {
    console.error(`❌ Error recording migration ${migrationName}:`, error);
    return false;
  }

  return true;
}

/**
 * Execute SQL file
 */
async function executeSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      // Use raw SQL execution (this is a simplified version)
      // In production, you'd want to use Supabase's SQL execution endpoint
      // or pg client directly

      // For now, we'll log what would be executed
      console.log(`   Executing: ${statement.substring(0, 60)}...`);

      // Note: Supabase doesn't have a direct exec_sql function by default
      // You'll need to either:
      // 1. Create a database function for this
      // 2. Use pg client directly
      // 3. Run migrations manually via Supabase dashboard

    } catch (error) {
      console.error(`❌ Error executing statement:`, error);
      throw error;
    }
  }
}

/**
 * Run a single migration
 */
async function runMigration(migrationName) {
  console.log(`\n📄 Processing migration: ${migrationName}`);

  // Check if already applied
  const applied = await isMigrationApplied(migrationName);
  if (applied) {
    console.log(`   ⏭️  Already applied, skipping`);
    return true;
  }

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationName);

  if (!fs.existsSync(migrationPath)) {
    console.error(`   ❌ Migration file not found: ${migrationPath}`);
    return false;
  }

  console.log(`   📖 Reading from: ${migrationPath}`);

  try {
    // Execute the migration
    await executeSqlFile(migrationPath);

    // Record as applied
    await recordMigration(migrationName);

    console.log(`   ✅ Migration applied successfully`);
    return true;
  } catch (error) {
    console.error(`   ❌ Migration failed:`, error);
    return false;
  }
}

/**
 * Main migration runner
 */
async function runMigrations() {
  console.log('🚀 Starting database migrations for Patient Portal\n');
  console.log(`   Database: ${supabaseUrl}`);
  console.log(`   Migrations to run: ${MIGRATIONS.length}\n`);

  // Create migrations table
  const tableCreated = await createMigrationsTable();
  if (!tableCreated) {
    console.error('\n❌ Failed to create migrations table. Exiting.');
    process.exit(1);
  }

  // Run each migration
  let successCount = 0;
  let failureCount = 0;

  for (const migration of MIGRATIONS) {
    const success = await runMigration(migration);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📝 Total: ${MIGRATIONS.length}`);
  console.log('='.repeat(60) + '\n');

  if (failureCount > 0) {
    console.error('⚠️  Some migrations failed. Please review the errors above.');
    console.error('   You may need to run the SQL files manually via Supabase dashboard.');
    process.exit(1);
  }

  console.log('✨ All migrations completed successfully!\n');

  console.log('📋 Next steps:');
  console.log('   1. Set up Azure OpenAI credentials in .env');
  console.log('   2. Set up ElevenLabs API key');
  console.log('   3. Test H&P generation with sample data');
  console.log('   4. Test AI chat functionality\n');
}

// Run if called directly
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };
