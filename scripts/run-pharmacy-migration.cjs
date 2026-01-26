/**
 * Run pharmacy and refill fields migration
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🔧 Running pharmacy and refill fields migration...\n');

  try {
    // Add pharmacy fields to unified_patients
    console.log('1. Adding pharmacy fields to unified_patients table...');
    const { error: error1 } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE unified_patients
        ADD COLUMN IF NOT EXISTS preferred_pharmacy_name TEXT,
        ADD COLUMN IF NOT EXISTS preferred_pharmacy_phone TEXT,
        ADD COLUMN IF NOT EXISTS preferred_pharmacy_address TEXT,
        ADD COLUMN IF NOT EXISTS preferred_pharmacy_fax TEXT;
      `
    });
    if (error1) console.error('Error:', error1.message);
    else console.log('✓ Pharmacy fields added to unified_patients\n');

    // Add refill fields to patient_medications
    console.log('2. Adding refill tracking fields to patient_medications table...');
    const { error: error2 } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE patient_medications
        ADD COLUMN IF NOT EXISTS refill_duration_days INTEGER,
        ADD COLUMN IF NOT EXISTS refill_quantity TEXT,
        ADD COLUMN IF NOT EXISTS last_refill_date TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS next_refill_due_date TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS refill_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS refill_notes TEXT,
        ADD COLUMN IF NOT EXISTS sent_to_pharmacy_confirmation TEXT;
      `
    });
    if (error2) console.error('Error:', error2.message);
    else console.log('✓ Refill fields added to patient_medications\n');

    // Create indexes
    console.log('3. Creating indexes for refill queries...');
    const { error: error3 } = await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_patient_medications_refill_due
          ON patient_medications(next_refill_due_date)
          WHERE send_to_pharmacy = TRUE;
      `
    });
    if (error3) console.error('Error:', error3.message);
    else console.log('✓ Refill due date index created\n');

    const { error: error4 } = await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_patient_medications_pharmacy_pending
          ON patient_medications(send_to_pharmacy, sent_to_pharmacy_at)
          WHERE send_to_pharmacy = TRUE;
      `
    });
    if (error4) console.error('Error:', error4.message);
    else console.log('✓ Pharmacy pending index created\n');

    console.log('✅ Migration completed successfully!');
    console.log('\nNew fields added:');
    console.log('  unified_patients:');
    console.log('    - preferred_pharmacy_name');
    console.log('    - preferred_pharmacy_phone');
    console.log('    - preferred_pharmacy_address');
    console.log('    - preferred_pharmacy_fax');
    console.log('\n  patient_medications:');
    console.log('    - refill_duration_days (30, 60, or 90)');
    console.log('    - refill_quantity');
    console.log('    - last_refill_date');
    console.log('    - next_refill_due_date');
    console.log('    - refill_count');
    console.log('    - refill_notes');
    console.log('    - sent_to_pharmacy_confirmation');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
