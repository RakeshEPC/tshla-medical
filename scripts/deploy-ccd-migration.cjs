/**
 * Deploy CCD Summaries Migration to Supabase
 * Runs the SQL migration via Supabase Management API
 */

const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

// Read migration file
const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add_ccd_summaries.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

console.log('📋 CCD Summaries Migration Deployment');
console.log('=====================================');
console.log('Migration file:', migrationPath);
console.log('Supabase URL:', SUPABASE_URL);
console.log('SQL length:', migrationSQL.length, 'characters');
console.log('');

// Since we can't run DDL via REST API directly, we'll provide instructions
console.log('⚠️  MANUAL DEPLOYMENT REQUIRED');
console.log('');
console.log('The CCD migration must be run manually in Supabase SQL Editor:');
console.log('');
console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb');
console.log('2. Click "SQL Editor" in the left sidebar');
console.log('3. Click "New query"');
console.log('4. Copy the contents of: database/migrations/add_ccd_summaries.sql');
console.log('5. Paste into SQL Editor');
console.log('6. Click "Run"');
console.log('');
console.log('Expected output:');
console.log('  ✅ CCD SUMMARIES TABLE CREATED SUCCESSFULLY');
console.log('  ✅ Tables with RLS enabled: 20+');
console.log('  ✅ Total policies created: 100+');
console.log('');
console.log('Migration file location:');
console.log('  ' + migrationPath);
console.log('');
console.log('📋 Quick copy command:');
console.log('  cat ' + migrationPath + ' | pbcopy');
console.log('');

// For verification, let's check if the table already exists
async function checkIfMigrationNeeded() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/ccd_summaries?limit=1`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    if (response.status === 200) {
      console.log('✅ Table ccd_summaries already exists!');
      console.log('Migration may have already been run.');
      return true;
    } else if (response.status === 404) {
      console.log('⏳ Table ccd_summaries does not exist yet.');
      console.log('Please run the migration as described above.');
      return false;
    } else {
      console.log('Status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('⏳ Could not verify table existence');
    console.log('Please run the migration as described above.');
    return false;
  }
}

checkIfMigrationNeeded();
