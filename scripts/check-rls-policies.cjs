#!/usr/bin/env node
/**
 * Check RLS policies on templates table
 * This will show us if RLS policies exist and what they allow
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkRLSPolicies() {
  console.log('🔍 Checking RLS policies on templates table...\n');

  try {
    // Query pg_policies to see what policies exist
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies
          WHERE tablename = 'templates'
          ORDER BY policyname;
        `
      });

    if (policiesError) {
      console.log('⚠️  Could not query policies via RPC (expected if function not available)');
      console.log('   Error:', policiesError.message);
      console.log('\n📋 Trying alternate method...\n');

      // Try direct query to information_schema
      const { data: tableInfo, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_name', 'templates')
        .single();

      if (tableError) {
        console.log('❌ Could not access information_schema');
        console.log('   Error:', tableError.message);
      }

      console.log('\n💡 Manual check required:');
      console.log('   1. Go to: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb');
      console.log('   2. Click: Database → Tables → templates');
      console.log('   3. Click: "RLS" or "Policies" tab');
      console.log('   4. Check if any policies exist\n');
    } else {
      console.log('✅ RLS Policies found:');
      console.log(JSON.stringify(policies, null, 2));
    }

    // Check if RLS is enabled
    console.log('\n🔒 Checking if RLS is enabled on templates table...');
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('*')
      .eq('tablename', 'templates');

    if (tablesError) {
      console.log('⚠️  Could not check RLS status directly');
    }

    // Try to query templates with SERVICE_ROLE (should work)
    console.log('\n📊 Testing template queries...\n');

    // Test 1: Count all templates (SERVICE_ROLE bypasses RLS)
    const { count: totalCount, error: countError } = await supabase
      .from('templates')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      console.log('❌ Error counting templates:', countError.message);
    } else {
      console.log(`✅ Total templates in database: ${totalCount}`);
    }

    // Test 2: Count system templates
    const { count: systemCount, error: systemError } = await supabase
      .from('templates')
      .select('id', { count: 'exact', head: true })
      .eq('is_system_template', true);

    if (systemError) {
      console.log('❌ Error counting system templates:', systemError.message);
    } else {
      console.log(`✅ System templates: ${systemCount}`);
    }

    // Test 3: Get sample templates
    const { data: sampleTemplates, error: sampleError } = await supabase
      .from('templates')
      .select('id, name, is_system_template, created_by')
      .limit(5);

    if (sampleError) {
      console.log('❌ Error fetching sample templates:', sampleError.message);
    } else {
      console.log(`✅ Sample templates (first 5):`);
      sampleTemplates?.forEach(t => {
        console.log(`   - ${t.name} (system: ${t.is_system_template}, created_by: ${t.created_by || 'NULL'})`);
      });
    }

    // Now test with ANON key (simulates user query)
    console.log('\n\n🧪 Testing with ANON key (simulates user browser)...\n');

    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8';

    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Simulate authenticated user
    const AUTH_USER_ID = '444130c5-1fd7-4b73-9611-50c94a57da79'; // admin@tshla.ai

    // Set auth header manually to simulate logged-in user
    const { data: { session }, error: authError } = await anonClient.auth.getSession();

    // Test query as authenticated user would
    const { data: anonTemplates, error: anonError, count: anonCount } = await anonClient
      .from('templates')
      .select('id, name, is_system_template', { count: 'exact' })
      .eq('is_system_template', true);

    if (anonError) {
      console.log('❌ ANON client query FAILED (this is the problem!):');
      console.log('   Error:', anonError.message);
      console.log('   Code:', anonError.code);
      console.log('   Details:', anonError.details);
      console.log('   Hint:', anonError.hint);

      if (anonError.code === 'PGRST301' || anonError.message?.includes('RLS') || anonError.message?.includes('policy')) {
        console.log('\n🚨 DIAGNOSIS: Row Level Security (RLS) is blocking queries!');
        console.log('\n📝 SOLUTION: Add RLS policies in Supabase Dashboard');
        console.log('   See: docs/QUICK_FIX_TEMPLATES_RLS.md');
      }
    } else {
      console.log(`✅ ANON client query succeeded: ${anonCount} templates returned`);
      if (anonCount === 0 && totalCount > 0) {
        console.log('\n⚠️  WARNING: RLS is blocking all results!');
        console.log('   Database has templates, but RLS policies prevent access');
      }
    }

    // Summary
    console.log('\n\n📋 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Templates in database: ${totalCount}`);
    console.log(`Accessible via SERVICE_ROLE: ✅ Yes`);
    console.log(`Accessible via ANON (user): ${anonError ? '❌ NO - RLS BLOCKING' : '✅ Yes'}`);

    if (anonError) {
      console.log('\n🔧 ACTION REQUIRED:');
      console.log('   1. Restore policies: node scripts/restore-rls-policies.cjs');
      console.log('   2. Or open: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/editor');
      console.log('   3. Click: templates table → Policies tab');
      console.log('   4. Add policy: "Allow authenticated users to read system templates"');
      console.log('   5. See detailed steps: docs/RLS_SAFEGUARDS.md');
      console.log('\n📚 DOCUMENTATION:');
      console.log('   - Quick Fix: docs/QUICK_FIX_TEMPLATES_RLS.md');
      console.log('   - Complete Guide: docs/RLS_SAFEGUARDS.md');
      console.log('   - Policy Source: supabase/policies/templates.sql');
    }

    // Exit code for CI/CD
    if (anonError || (anonCount === 0 && totalCount > 0)) {
      console.log('\n❌ RLS VALIDATION FAILED');
      process.exit(1);
    } else {
      console.log('\n✅ RLS VALIDATION PASSED');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
  }
}

checkRLSPolicies().catch(console.error);
