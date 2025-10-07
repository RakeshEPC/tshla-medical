/**
 * Import 23 Pump Comparison Dimensions to Supabase
 * Migrates pump comparison data from the import script to Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Import the 23 dimensions data
const PUMP_DIMENSIONS = require('./pump-dimensions-data.cjs');

async function importDimensions() {
  console.log('\n🚀 Starting 23 Dimensions Import to Supabase...\n');

  try {
    // Check if data already exists
    const { data: existingData, error: checkError } = await supabase
      .from('pump_comparison_data')
      .select('dimension_number');

    if (checkError) {
      console.error('❌ Error checking existing data:', checkError.message);
      return;
    }

    if (existingData && existingData.length > 0) {
      console.log(`⚠️  Found ${existingData.length} existing dimensions`);
      console.log('Clearing existing data...');

      const { error: deleteError } = await supabase
        .from('pump_comparison_data')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) {
        console.error('❌ Error deleting existing data:', deleteError.message);
        return;
      }
    }

    // Insert all 23 dimensions
    console.log(`📊 Importing ${PUMP_DIMENSIONS.length} dimensions...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const dimension of PUMP_DIMENSIONS) {
      const { error } = await supabase
        .from('pump_comparison_data')
        .insert({
          dimension_number: dimension.dimension_number,
          dimension_name: dimension.dimension_name,
          dimension_description: dimension.dimension_description,
          importance_scale: dimension.importance_scale || '1-10',
          category: dimension.category,
          display_order: dimension.display_order,
          pump_details: dimension.pump_details,
          is_active: true
        });

      if (error) {
        console.error(`❌ Error importing dimension ${dimension.dimension_number}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Dimension ${dimension.dimension_number}: ${dimension.dimension_name}`);
        successCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Import Complete!`);
    console.log(`   Success: ${successCount} dimensions`);
    console.log(`   Errors: ${errorCount} dimensions`);
    console.log('='.repeat(60) + '\n');

    // Verify the import
    const { data: verifyData, error: verifyError } = await supabase
      .from('pump_comparison_data')
      .select('dimension_number, dimension_name')
      .order('dimension_number');

    if (!verifyError && verifyData) {
      console.log('📋 Verification - Dimensions in database:');
      verifyData.forEach(d => {
        console.log(`   ${d.dimension_number}. ${d.dimension_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

importDimensions();
