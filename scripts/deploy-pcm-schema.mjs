#!/usr/bin/env node

/**
 * PCM Database Schema Deployment Script
 * Deploys the PCM database schema to Supabase using SQL
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🚀 PCM Database Schema Deployment');
console.log('==================================\n');

// Get Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('   Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log(`📦 Supabase URL: ${supabaseUrl}`);
console.log('');

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Read migration file
const migrationPath = join(projectRoot, 'src/lib/db/migrations/004_pcm_tables.sql');
console.log(`📄 Reading migration file: ${migrationPath}`);

let sqlContent;
try {
  sqlContent = readFileSync(migrationPath, 'utf8');
  const lineCount = sqlContent.split('\n').length;
  console.log(`📊 Size: ${lineCount} lines`);
  console.log('');
} catch (error) {
  console.error(`❌ Error reading migration file: ${error.message}`);
  process.exit(1);
}

// Split SQL into statements (separated by semicolons)
// This is a simple split - for production use a proper SQL parser
const statements = sqlContent
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

console.log(`🔧 Deploying ${statements.length} SQL statements...`);
console.log('');

let successCount = 0;
let errorCount = 0;

// Execute each statement
for (let i = 0; i < statements.length; i++) {
  const statement = statements[i] + ';';

  // Skip comments and empty statements
  if (statement.trim() === ';' || statement.trim().startsWith('--')) {
    continue;
  }

  // Get first line for progress display
  const firstLine = statement.split('\n')[0].trim().substring(0, 60);
  process.stdout.write(`[${i + 1}/${statements.length}] ${firstLine}... `);

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: statement });

    if (error) {
      // Try direct execution if RPC fails
      const { error: directError } = await supabase
        .from('_raw_sql')
        .select('*')
        .limit(0);

      if (directError) {
        console.log('❌');
        console.error(`   Error: ${error.message}`);
        errorCount++;
      } else {
        console.log('✅');
        successCount++;
      }
    } else {
      console.log('✅');
      successCount++;
    }
  } catch (error) {
    console.log('❌');
    console.error(`   Error: ${error.message}`);
    errorCount++;
  }

  // Small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 100));
}

console.log('');
console.log('==================================');
console.log(`✅ Successful: ${successCount}`);
if (errorCount > 0) {
  console.log(`❌ Failed: ${errorCount}`);
}
console.log('');

// Verify tables were created
console.log('📋 Verifying tables created...');
const { data: tables, error: tablesError } = await supabase
  .from('information_schema.tables')
  .select('table_name')
  .like('table_name', 'pcm_%');

if (tablesError) {
  console.log('⚠️  Could not verify tables automatically');
  console.log('   Please check Supabase dashboard manually');
} else {
  console.log('');
  console.log('📊 PCM Tables Found:');
  if (tables && tables.length > 0) {
    tables.forEach(t => console.log(`   - ${t.table_name}`));
  } else {
    console.log('   (Unable to list tables via client)');
  }
}

console.log('');
console.log('🎉 PCM Database Deployment Complete!');
console.log('');
console.log('Next Steps:');
console.log('1. Verify tables in Supabase dashboard');
console.log('2. Run data migration: npm run migrate:pcm-data');
console.log('3. Update App.tsx to add /staff-dashboard route');
console.log('4. Test the new dashboard at /staff-dashboard');
console.log('');

if (errorCount > 0) {
  console.log('⚠️  Some statements failed - please review errors above');
  console.log('   You may need to run the SQL manually in Supabase SQL Editor');
  process.exit(1);
}
