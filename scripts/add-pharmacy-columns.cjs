#!/usr/bin/env node

/**
 * Add pharmacy information columns to unified_patients table
 * Columns: preferred_pharmacy_name, preferred_pharmacy_phone, preferred_pharmacy_address, preferred_pharmacy_fax
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPharmacyColumns() {
  console.log('🏥 Adding pharmacy columns to unified_patients table...\n');

  try {
    // Check if columns already exist
    const { data: sample, error: sampleError } = await supabase
      .from('unified_patients')
      .select('*')
      .limit(1)
      .single();

    if (sample && 'preferred_pharmacy_name' in sample) {
      console.log('✅ Pharmacy columns already exist in unified_patients table');
      console.log('   Columns present:', [
        'preferred_pharmacy_name',
        'preferred_pharmacy_phone',
        'preferred_pharmacy_address',
        'preferred_pharmacy_fax'
      ].filter(col => col in sample).join(', '));
      return;
    }

    console.log('📝 Pharmacy columns need to be added via Supabase Dashboard or SQL migration');
    console.log('\n📋 SQL to run in Supabase SQL Editor:\n');
    console.log('-- Add pharmacy information columns to unified_patients');
    console.log('ALTER TABLE unified_patients');
    console.log('  ADD COLUMN IF NOT EXISTS preferred_pharmacy_name TEXT,');
    console.log('  ADD COLUMN IF NOT EXISTS preferred_pharmacy_phone TEXT,');
    console.log('  ADD COLUMN IF NOT EXISTS preferred_pharmacy_address TEXT,');
    console.log('  ADD COLUMN IF NOT EXISTS preferred_pharmacy_fax TEXT;');
    console.log('\n-- Add index for pharmacy name lookups');
    console.log('CREATE INDEX IF NOT EXISTS idx_unified_patients_pharmacy_name');
    console.log('  ON unified_patients(preferred_pharmacy_name);');
    console.log('\n💡 Run the above SQL in Supabase Dashboard > SQL Editor');

  } catch (error) {
    console.error('❌ Error checking pharmacy columns:', error.message);
    process.exit(1);
  }
}

addPharmacyColumns();
