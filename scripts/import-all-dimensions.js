#!/usr/bin/env node
/**
 * Import all 23 pump dimensions to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PUMP_DIMENSIONS = require('../pump-dimensions-data.cjs');
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importDimensions() {
  console.log('🚀 Starting import of 23 pump dimensions...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const dimension of PUMP_DIMENSIONS) {
    try {
      const { data, error } = await supabase
        .from('pump_comparison_data')
        .upsert({
          dimension_number: dimension.dimension_number,
          dimension_name: dimension.dimension_name,
          dimension_description: dimension.dimension_description,
          importance_scale: dimension.importance_scale,
          category: dimension.category,
          display_order: dimension.display_order,
          pump_details: dimension.pump_details,
          is_active: true
        }, {
          onConflict: 'dimension_number'
        });

      if (error) {
        console.error(`❌ Dimension ${dimension.dimension_number}: ${dimension.dimension_name}`);
        console.error(`   Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Dimension ${dimension.dimension_number}: ${dimension.dimension_name}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Dimension ${dimension.dimension_number}: ${dimension.dimension_name}`);
      console.error(`   Error: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully imported: ${successCount} dimensions`);
  if (errorCount > 0) {
    console.log(`❌ Failed: ${errorCount} dimensions`);
  }
  console.log('='.repeat(60));

  // Verify total count
  const { count } = await supabase
    .from('pump_comparison_data')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total dimensions in database: ${count}`);
}

importDimensions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
