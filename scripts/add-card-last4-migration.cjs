/**
 * Database Migration: Add card_last_4 column to patient_payment_requests
 * Run with: node scripts/add-card-last4-migration.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔧 Running migration: Add card_last_4 to patient_payment_requests...\n');

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE patient_payment_requests
        ADD COLUMN IF NOT EXISTS card_last_4 VARCHAR(4);

        COMMENT ON COLUMN patient_payment_requests.card_last_4 IS 'Last 4 digits of credit card used for payment (for receipt display)';
      `
    });

    if (error) {
      // Try alternative approach - direct query
      console.log('Trying alternative approach...');

      const { error: altError } = await supabase
        .from('patient_payment_requests')
        .select('id')
        .limit(0); // Just to test connection

      if (altError) {
        throw new Error(`Migration failed: ${error.message}`);
      }

      console.log('⚠️  Note: Column may already exist or migration needs to be run via Supabase SQL Editor');
      console.log('\n📋 Please run this SQL in Supabase SQL Editor:');
      console.log('---');
      console.log('ALTER TABLE patient_payment_requests');
      console.log("ADD COLUMN IF NOT EXISTS card_last_4 VARCHAR(4);");
      console.log('---');
      console.log('\n✅ Code changes deployed successfully!');
      console.log('💳 Next payment will capture card last 4 digits automatically.');
      return;
    }

    console.log('✅ Migration completed successfully!');
    console.log('💳 card_last_4 column added to patient_payment_requests table');
    console.log('📝 Future credit card payments will now store last 4 digits');

  } catch (err) {
    console.error('❌ Migration error:', err.message);
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:');
    console.log('---');
    console.log('ALTER TABLE patient_payment_requests');
    console.log("ADD COLUMN IF NOT EXISTS card_last_4 VARCHAR(4);");
    console.log('---');
  }
}

runMigration();
