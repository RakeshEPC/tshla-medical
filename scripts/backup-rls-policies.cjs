#!/usr/bin/env node
/**
 * BACKUP RLS POLICIES FROM SUPABASE
 *
 * Purpose: Export current RLS policies from Supabase database to a SQL file
 * Use this before making changes to verify current state
 *
 * Usage:
 *   node scripts/backup-rls-policies.cjs
 *   node scripts/backup-rls-policies.cjs --table templates
 *   node scripts/backup-rls-policies.cjs --output backup-2026-01-11.sql
 *
 * Requirements:
 *   - SUPABASE_SERVICE_ROLE_KEY in env
 *   - Database access via Supabase client
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
const outputArg = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

const DEFAULT_OUTPUT = path.join(__dirname, '..', 'supabase', 'policies', `${tableArg}-backup.sql`);
const OUTPUT_FILE = outputArg || DEFAULT_OUTPUT;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function backupRLSPolicies() {
  console.log('🔍 Backing up RLS policies from Supabase...\n');
  console.log(`   Table: ${tableArg}`);
  console.log(`   Output: ${OUTPUT_FILE}\n`);

  try {
    // Query pg_policies to get all policies for the table
    const { data, error } = await supabase.rpc('query_policies', {
      p_table_name: tableArg
    });

    if (error) {
      // RPC function doesn't exist, try manual query via raw SQL
      console.log('⚠️  RPC function not available, using alternative method...\n');

      // Try to get policy info from information we can access
      const { data: tableData, error: tableError } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', tableArg);

      if (tableError) {
        console.log('❌ Cannot access pg_policies directly.');
        console.log('   This is expected - pg_policies requires superuser access.\n');
        console.log('📋 MANUAL BACKUP REQUIRED:');
        console.log('   1. Go to Supabase Dashboard');
        console.log('   2. SQL Editor → New Query');
        console.log('   3. Run this query:\n');
        console.log(`      SELECT schemaname, tablename, policyname, cmd, roles,`);
        console.log(`             qual, with_check`);
        console.log(`      FROM pg_policies`);
        console.log(`      WHERE tablename = '${tableArg}' AND schemaname = 'public';`);
        console.log('\n   4. Copy results and save manually\n');
        console.log('💡 ALTERNATIVE: Use the source of truth file:');
        console.log(`   supabase/policies/${tableArg}.sql\n`);

        // Still create a placeholder file
        createPlaceholderBackup();
        return;
      }
    }

    // If we got here, we have policy data
    console.log('✅ Retrieved policies from database\n');

    // Generate SQL file
    const sqlContent = generateSQLFromPolicies(data || []);

    // Ensure directory exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, sqlContent, 'utf8');

    console.log(`✅ Backup saved to: ${OUTPUT_FILE}`);
    console.log(`   Policies backed up: ${data?.length || 0}\n`);

    // Show summary
    if (data && data.length > 0) {
      console.log('📋 Policies backed up:');
      data.forEach((policy, i) => {
        console.log(`   ${i + 1}. ${policy.policyname} (${policy.cmd})`);
      });
    } else {
      console.log('⚠️  No policies found for table:', tableArg);
      console.log('   This might mean:');
      console.log('   - RLS is disabled on the table');
      console.log('   - Policies were deleted');
      console.log('   - Table name is incorrect');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

function generateSQLFromPolicies(policies) {
  const timestamp = new Date().toISOString();

  let sql = `-- ============================================================================
-- RLS POLICY BACKUP FOR ${tableArg.toUpperCase()} TABLE
-- ============================================================================
-- Generated: ${timestamp}
-- Source: Supabase Database (pg_policies)
-- Tool: scripts/backup-rls-policies.cjs
--
-- IMPORTANT: This is a BACKUP file, not the source of truth.
-- Source of truth: supabase/policies/${tableArg}.sql
--
-- To restore these policies: node scripts/restore-rls-policies.cjs
-- ============================================================================

`;

  if (policies.length === 0) {
    sql += `-- ⚠️  NO POLICIES FOUND
-- This could indicate:
-- 1. RLS is not enabled on the ${tableArg} table
-- 2. All policies were deleted (check after auth changes)
-- 3. Backup script couldn't access pg_policies

-- To restore from source of truth:
-- Run: node scripts/restore-rls-policies.cjs

`;
    return sql;
  }

  policies.forEach((policy, i) => {
    sql += `
-- ============================================================================
-- POLICY ${i + 1}: ${policy.policyname}
-- ============================================================================
-- Command: ${policy.cmd}
-- Roles: ${policy.roles?.join(', ') || 'N/A'}
-- ============================================================================

DROP POLICY IF EXISTS "${policy.policyname}" ON public.${tableArg};

CREATE POLICY "${policy.policyname}"
ON public.${tableArg}
FOR ${policy.cmd}
TO ${policy.roles?.join(', ') || 'authenticated'}`;

    if (policy.qual) {
      sql += `\nUSING (${policy.qual})`;
    }

    if (policy.with_check) {
      sql += `\nWITH CHECK (${policy.with_check})`;
    }

    sql += ';\n';
  });

  sql += `
-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check policies exist (should return ${policies.length})
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = '${tableArg}';

-- List all policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = '${tableArg}'
ORDER BY policyname;

-- ============================================================================
`;

  return sql;
}

function createPlaceholderBackup() {
  const timestamp = new Date().toISOString();
  const content = `-- ============================================================================
-- RLS POLICY BACKUP PLACEHOLDER
-- ============================================================================
-- Generated: ${timestamp}
-- Status: Could not access pg_policies (requires superuser)
--
-- ⚠️  MANUAL BACKUP REQUIRED
--
-- The backup script cannot access pg_policies directly from the Supabase API.
-- This is expected for security reasons.
--
-- To create a backup manually:
-- 1. Go to: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new
-- 2. Run this query:
--
--    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
--    FROM pg_policies
--    WHERE tablename = '${tableArg}' AND schemaname = 'public';
--
-- 3. Save the results
--
-- ============================================================================
-- SOURCE OF TRUTH
-- ============================================================================
--
-- The actual source of truth for policies is:
-- supabase/policies/${tableArg}.sql
--
-- To restore policies from source of truth:
-- node scripts/restore-rls-policies.cjs
--
-- ============================================================================
`;

  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
  console.log(`📝 Placeholder backup created: ${OUTPUT_FILE}\n`);
}

// Run the backup
backupRLSPolicies().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
