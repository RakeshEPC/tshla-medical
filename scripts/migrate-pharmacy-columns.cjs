#!/usr/bin/env node

/**
 * Add pharmacy information columns to unified_patients table via RPC
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migratePharmacyColumns() {
  console.log('🏥 Adding pharmacy columns to unified_patients table...\n');

  const sql = `
    ALTER TABLE unified_patients
      ADD COLUMN IF NOT EXISTS preferred_pharmacy_name TEXT,
      ADD COLUMN IF NOT EXISTS preferred_pharmacy_phone TEXT,
      ADD COLUMN IF NOT EXISTS preferred_pharmacy_address TEXT,
      ADD COLUMN IF NOT EXISTS preferred_pharmacy_fax TEXT;

    CREATE INDEX IF NOT EXISTS idx_unified_patients_pharmacy_name
      ON unified_patients(preferred_pharmacy_name);
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      throw error;
    }

    console.log('✅ Pharmacy columns added successfully!');
    console.log('   - preferred_pharmacy_name');
    console.log('   - preferred_pharmacy_phone');
    console.log('   - preferred_pharmacy_address');
    console.log('   - preferred_pharmacy_fax');
    console.log('   - Index: idx_unified_patients_pharmacy_name');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Manual SQL needed - run this in Supabase Dashboard:');
    console.log(sql);
  }
}

migratePharmacyColumns();
