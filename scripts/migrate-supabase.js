#!/usr/bin/env node

/**
 * TSHLA Medical - Automated Supabase Migration
 * Runs the dictated notes schema migration automatically
 * Usage: node scripts/migrate-supabase.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SQL_FILE = path.join(__dirname, '../database/migrations/dictated-notes-schema.sql');
const EXPECTED_TABLES = [
  'dictated_notes',
  'note_versions',
  'note_comments',
  'schedule_note_links',
  'note_templates_used',
  'provider_schedules'
];

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  TSHLA Medical - Supabase Migration Tool                 ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

async function main() {
  try {
    // Step 1: Load configuration
    console.log('📋 Step 1: Loading configuration...');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in .env file');
    }

    console.log(`✅ Supabase URL: ${supabaseUrl}`);
    console.log(`✅ Service role key found (${supabaseKey.substring(0, 20)}...)`);

    // Step 2: Read SQL file
    console.log('\n📁 Step 2: Reading migration file...');
    if (!fs.existsSync(SQL_FILE)) {
      throw new Error(`SQL file not found: ${SQL_FILE}`);
    }

    const sqlContent = fs.readFileSync(SQL_FILE, 'utf8');
    const sqlSize = (sqlContent.length / 1024).toFixed(1);
    console.log(`✅ Found: ${path.basename(SQL_FILE)}`);
    console.log(`✅ SQL size: ${sqlSize}KB`);

    // Step 3: Connect to Supabase
    console.log('\n🔌 Step 3: Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test connection
    const { error: testError } = await supabase.from('medical_staff').select('id').limit(1);
    if (testError && testError.code !== 'PGRST116') {
      throw new Error(`Connection failed: ${testError.message}`);
    }
    console.log('✅ Connected successfully');

    // Step 4: Check what already exists
    console.log('\n🔍 Step 4: Checking existing tables...');
    const { data: existingTables, error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN (${EXPECTED_TABLES.map(t => `'${t}'`).join(',')})
        ORDER BY table_name
      `
    }).catch(async () => {
      // Fallback if RPC not available - try direct query
      return await supabase
        .from('information_schema.tables')
        .select('table_name')
        .in('table_name', EXPECTED_TABLES);
    });

    const existingTableNames = existingTables?.map(t => t.table_name) || [];

    if (existingTableNames.length > 0) {
      console.log(`⚠️  Found existing tables: ${existingTableNames.join(', ')}`);
      console.log('   Migration will skip existing items (using IF NOT EXISTS)');
    } else {
      console.log('✅ No existing tables found - will create all');
    }

    // Step 5: Execute migration (in smaller chunks)
    console.log('\n🗄️  Step 5: Running migration...');
    console.log('   This may take 15-30 seconds...\n');

    // Split SQL into statements (rough split by semicolons outside of functions)
    const statements = splitSQL(sqlContent);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt || stmt.startsWith('--')) continue;

      const progress = `[${i + 1}/${statements.length}]`;

      try {
        // Use Supabase's SQL execution (via rpc or admin API)
        const { error } = await executeSQL(supabase, stmt);

        if (error) {
          // Check if it's a "already exists" error (safe to ignore)
          if (isAlreadyExistsError(error)) {
            skipCount++;
            const item = extractItemName(stmt);
            console.log(`  ⏭️  ${progress} Skipped (exists): ${item}`);
          } else {
            errorCount++;
            console.log(`  ❌ ${progress} Error: ${error.message}`);
          }
        } else {
          successCount++;
          const item = extractItemName(stmt);
          if (item) {
            console.log(`  ✅ ${progress} Created: ${item}`);
          }
        }
      } catch (err) {
        if (isAlreadyExistsError(err)) {
          skipCount++;
        } else {
          errorCount++;
          console.log(`  ❌ ${progress} Unexpected error: ${err.message}`);
        }
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Created: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    // Step 6: Verify tables exist
    console.log('\n🔍 Step 6: Verifying migration...');

    const { data: finalTables } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN (${EXPECTED_TABLES.map(t => `'${t}'`).join(',')})
          ORDER BY table_name
        `
      })
      .catch(async () => {
        // Fallback
        return { data: existingTableNames.map(name => ({ table_name: name })) };
      });

    const createdTables = finalTables?.map(t => t.table_name) || [];

    console.log(`\n📋 Tables status:`);
    EXPECTED_TABLES.forEach(tableName => {
      if (createdTables.includes(tableName)) {
        console.log(`   ✅ ${tableName}`);
      } else {
        console.log(`   ❌ ${tableName} - MISSING!`);
      }
    });

    const allTablesExist = EXPECTED_TABLES.every(t => createdTables.includes(t));

    // Final result
    console.log('\n' + '━'.repeat(60));
    if (allTablesExist) {
      console.log('✅ MIGRATION COMPLETE!\n');
      console.log('Next steps:');
      console.log('1. Verify in Supabase: https://app.supabase.com/project/minvvjdflezibmgkplqb');
      console.log('2. Test dictation save in the app');
      console.log('3. Run: node scripts/verify-migration.js');
    } else {
      console.log('⚠️  MIGRATION INCOMPLETE\n');
      console.log('Some tables were not created. Please:');
      console.log('1. Check error messages above');
      console.log('2. Try running the SQL manually in Supabase SQL Editor');
      console.log('3. Contact support if issues persist');
    }
    console.log('━'.repeat(60) + '\n');

    process.exit(allTablesExist ? 0 : 1);

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nPlease try running the SQL manually:');
    console.error('1. Go to: https://app.supabase.com/project/minvvjdflezibmgkplqb/sql/new');
    console.error('2. Copy SQL from: database/migrations/dictated-notes-schema.sql');
    console.error('3. Paste and click RUN');
    process.exit(1);
  }
}

/**
 * Execute SQL statement via Supabase
 */
async function executeSQL(supabase, sql) {
  try {
    // Try using rpc if available
    return await supabase.rpc('exec_sql', { sql });
  } catch (error) {
    // Fallback: use fetch to hit Supabase REST API directly
    // This requires constructing the URL and using the service role key
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: { message: errorText } };
    }

    return { error: null };
  }
}

/**
 * Check if error is "already exists" type
 */
function isAlreadyExistsError(error) {
  const message = error?.message || error?.toString() || '';
  return (
    message.includes('already exists') ||
    message.includes('42P07') || // duplicate table
    message.includes('42710') || // duplicate object
    message.includes('42P16')    // invalid table definition
  );
}

/**
 * Extract item name from SQL statement
 */
function extractItemName(sql) {
  const match = sql.match(/CREATE (?:TABLE|INDEX|FUNCTION|TRIGGER|VIEW|POLICY) (?:IF NOT EXISTS )?(?:OR REPLACE )?["']?(\w+)["']?/i);
  return match ? match[1] : null;
}

/**
 * Split SQL into executable statements
 * This is a simple splitter - doesn't handle all edge cases
 */
function splitSQL(sql) {
  // Remove comments
  const noComments = sql.replace(/--.*$/gm, '');

  // Split by semicolons not inside function bodies
  const statements = [];
  let current = '';
  let inFunction = false;

  const lines = noComments.split('\n');

  for (const line of lines) {
    current += line + '\n';

    if (line.match(/CREATE (?:OR REPLACE )?FUNCTION/i)) {
      inFunction = true;
    }

    if (inFunction && line.match(/\$\$ LANGUAGE/i)) {
      inFunction = false;
    }

    if (line.includes(';') && !inFunction) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements.filter(s => s.length > 0);
}

// Run migration
main();
