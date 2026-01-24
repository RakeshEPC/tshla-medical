/**
 * Create Patient Portal Tables - Supabase Direct
 * Uses Supabase client to create tables programmatically
 * Created: 2026-01-23
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeSQLViaRPC(sql) {
  // Attempt to use custom RPC function if it exists
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    throw error;
  }
  
  return data;
}

async function createTables() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🗄️  Patient Portal Table Creation');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('⚠️  This script requires a custom Supabase function called exec_sql');
  console.log('   that allows executing arbitrary SQL.');
  console.log('');
  console.log('📋 To create this function:');
  console.log('   1. Go to Supabase Dashboard → SQL Editor');
  console.log('   2. Run this SQL:');
  console.log('');
  console.log('   CREATE OR REPLACE FUNCTION exec_sql(query TEXT)');
  console.log('   RETURNS JSON');
  console.log('   LANGUAGE plpgsql');
  console.log('   SECURITY DEFINER');
  console.log('   AS $$');
  console.log('   BEGIN');
  console.log('     EXECUTE query;');
  console.log('     RETURN json_build_object(''success'', true);');
  console.log('   END;');
  console.log('   $$;');
  console.log('');
  console.log('   3. Grant permissions:');
  console.log('');
  console.log('   GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('⚠️  ALTERNATE APPROACH (RECOMMENDED):');
  console.log('');
  console.log('   Simply copy and paste the migration files directly in');
  console.log('   Supabase SQL Editor:');
  console.log('');
  console.log('   1. database/migrations/add-comprehensive-hp.sql');
  console.log('   2. database/migrations/add-patient-portal-analytics.sql');
  console.log('   3. database/migrations/add-ai-chat-conversations.sql');
  console.log('');
  console.log('   This is the simplest and safest approach.');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════\n');
}

createTables().catch(console.error);
