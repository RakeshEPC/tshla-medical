/**
 * Patient Portal Database Migrations Runner
 * Executes SQL migrations using Supabase REST API
 * Created: 2026-01-23
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable required');
  process.exit(1);
}

const migrations = [
  {
    name: '1. Comprehensive H&P Tables',
    file: 'add-comprehensive-hp.sql',
    tables: ['patient_comprehensive_chart', 'patient_chart_history', 'visit_dictations_archive']
  },
  {
    name: '2. Portal Analytics Tables',
    file: 'add-patient-portal-analytics.sql',
    tables: ['patient_portal_sessions', 'staff_review_queue', 'portal_usage_analytics', 'ai_common_questions']
  },
  {
    name: '3. AI Chat Tables',
    file: 'add-ai-chat-conversations.sql',
    tables: ['patient_ai_conversations', 'patient_ai_analytics', 'patient_urgent_alerts']
  }
];

async function executeSQL(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({ sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SQL execution failed: ${error}`);
  }

  return response.json();
}

async function tableExists(tableName) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?limit=0`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function runMigrations() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🗄️  Patient Portal Database Migrations');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📍 Database: ${SUPABASE_URL}\n`);

  console.log('⚠️  NOTE: Supabase REST API does not support executing DDL directly.');
  console.log('');
  console.log('✅ RECOMMENDED APPROACH:');
  console.log('   1. Go to https://supabase.com/dashboard');
  console.log('   2. Select your project');
  console.log('   3. Navigate to SQL Editor');
  console.log('   4. Copy and paste each migration file below:\n');

  for (const migration of migrations) {
    const filePath = path.join(__dirname, '..', 'database', 'migrations', migration.file);
    console.log(`   ${migration.name}`);
    console.log(`   File: database/migrations/${migration.file}`);
    console.log(`   Creates: ${migration.tables.join(', ')}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Checking if tables already exist...\n');

  const allTables = migrations.flatMap(m => m.tables);
  const results = [];

  for (const tableName of allTables) {
    const exists = await tableExists(tableName);
    results.push({ tableName, exists });
    console.log(`   ${exists ? '✅' : '❌'} ${tableName}`);
  }

  const existingCount = results.filter(r => r.exists).length;
  console.log('');
  console.log(`   ${existingCount}/${allTables.length} tables exist`);

  if (existingCount === allTables.length) {
    console.log('\n✨ All tables already exist! Migrations appear to be complete.\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 Next Steps:');
    console.log('   1. ✅ Database migrations (already complete)');
    console.log('   2. Configure Azure environment variables');
    console.log('   3. Create Supabase storage buckets');
    console.log('   4. Run: node scripts/seed-patient-portal-data.js');
    console.log('═══════════════════════════════════════════════════════════\n');
  } else {
    console.log('\n⚠️  Some tables are missing. Please run migrations manually.\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 Migration Files to Run (in order):');
    migrations.forEach((m, idx) => {
      console.log(`\n${idx + 1}. ${m.name}`);
      console.log(`   File: database/migrations/${m.file}`);
    });
    console.log('\n═══════════════════════════════════════════════════════════\n');
  }
}

runMigrations().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
