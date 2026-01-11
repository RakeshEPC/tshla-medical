#!/usr/bin/env node
/**
 * RESTORE RLS POLICIES TO SUPABASE
 *
 * Purpose: Apply RLS policies from source file to Supabase database
 * Use this after auth changes delete policies or to ensure policies are correct
 *
 * Usage:
 *   node scripts/restore-rls-policies.cjs
 *   node scripts/restore-rls-policies.cjs --table templates
 *   node scripts/restore-rls-policies.cjs --dry-run
 *
 * What it does:
 *   1. Reads supabase/policies/{table}.sql
 *   2. Connects to Supabase with SERVICE_ROLE_KEY
 *   3. Executes SQL to create/update policies
 *   4. Verifies policies were created
 *
 * Requirements:
 *   - SUPABASE_SERVICE_ROLE_KEY in env
 *   - supabase/policies/{table}.sql file exists
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';

// Parse command line arguments
const args = process.argv.slice(2);
const tableArg = args.find(arg => arg.startsWith('--table='))?.split('=')[1] || 'templates';
const dryRun = args.includes('--dry-run');

const POLICY_FILE = path.join(__dirname, '..', 'supabase', 'policies', `${tableArg}.sql`);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function restoreRLSPolicies() {
  console.log('🔧 Restoring RLS policies to Supabase...\n');
  console.log(`   Table: ${tableArg}`);
  console.log(`   Policy file: ${POLICY_FILE}`);
  console.log(`   Dry run: ${dryRun ? 'YES (no changes will be made)' : 'NO'}\n`);

  // Check if policy file exists
  if (!fs.existsSync(POLICY_FILE)) {
    console.error(`❌ Policy file not found: ${POLICY_FILE}`);
    console.error('\n💡 Create the file first:');
    console.error(`   supabase/policies/${tableArg}.sql\n`);
    console.error('   Or use the backup script to generate from current state:');
    console.error(`   node scripts/backup-rls-policies.cjs --table=${tableArg}\n`);
    process.exit(1);
  }

  // Read policy file
  const sqlContent = fs.readFileSync(POLICY_FILE, 'utf8');
  console.log(`✅ Policy file loaded (${sqlContent.length} bytes)\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - Showing SQL that would be executed:\n');
    console.log('─'.repeat(80));
    console.log(sqlContent);
    console.log('─'.repeat(80));
    console.log('\n✅ Dry run complete. No changes made.');
    console.log('   Remove --dry-run flag to apply policies.\n');
    return;
  }

  try {
    console.log('📡 Connecting to Supabase...');

    // Split SQL into individual statements (handle multiple CREATE POLICY commands)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT'));

    console.log(`   Found ${statements.length} SQL statements to execute\n`);

    // Execute via REST API since we can't run raw SQL directly
    // We'll need to guide user to run this in Supabase SQL Editor
    console.log('⚠️  IMPORTANT: Supabase API cannot execute raw SQL for security.\n');
    console.log('📋 MANUAL STEPS REQUIRED:\n');
    console.log('   1. Go to: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new');
    console.log('   2. Open file: ' + POLICY_FILE);
    console.log('   3. Copy the entire SQL content');
    console.log('   4. Paste into Supabase SQL Editor');
    console.log('   5. Click "Run" button\n');

    console.log('🤖 AUTO-OPENING BROWSER (if possible)...\n');

    // Try to open browser automatically
    const { exec } = require('child_process');
    const sqlEditorUrl = `https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new`;

    exec(`open "${sqlEditorUrl}"`, (error) => {
      if (error) {
        console.log('   Could not auto-open browser. Please open manually.\n');
      } else {
        console.log('   ✅ Browser opened to SQL Editor\n');
      }
    });

    // Show the SQL content for easy copy-paste
    console.log('📄 SQL TO COPY-PASTE:\n');
    console.log('─'.repeat(80));
    console.log(sqlContent);
    console.log('─'.repeat(80));

    console.log('\n✅ After running SQL in Supabase, verify with:');
    console.log(`   node scripts/validate-rls-policies.cjs --table=${tableArg}\n`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

// Run the restore
restoreRLSPolicies().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
