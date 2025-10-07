#!/usr/bin/env node
/**
 * Import all 23 pump dimensions from TypeScript source to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Read the TypeScript file and extract PUMP_DIMENSIONS
const tsContent = fs.readFileSync('src/lib/pump-dimensions.ts', 'utf8');

// Extract the JSON array (it's exported as const)
// Find the start of the array after "export const PUMP_DIMENSIONS"
const startMarker = 'export const PUMP_DIMENSIONS';
const startIndex = tsContent.indexOf(startMarker);
if (startIndex === -1) {
  console.error('❌ Could not find PUMP_DIMENSIONS in pump-dimensions.ts');
  process.exit(1);
}

// Find the opening bracket
const arrayStart = tsContent.indexOf('[', startIndex);
// Find the matching closing bracket (need to count brackets)
let bracketCount = 0;
let arrayEnd = -1;
for (let i = arrayStart; i < tsContent.length; i++) {
  if (tsContent[i] === '[') bracketCount++;
  if (tsContent[i] === ']') bracketCount--;
  if (bracketCount === 0) {
    arrayEnd = i + 1;
    break;
  }
}

if (arrayEnd === -1) {
  console.error('❌ Could not parse PUMP_DIMENSIONS array');
  process.exit(1);
}

const arrayString = tsContent.substring(arrayStart, arrayEnd);

// Convert TypeScript to JSON by removing type annotations and using eval
// This is safe because we control the source file
const PUMP_DIMENSIONS = eval(`(${arrayString})`);

console.log(`📦 Loaded ${PUMP_DIMENSIONS.length} dimensions from TypeScript file\n`);

async function importDimensions() {
  console.log('🚀 Starting import to Supabase...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const dimension of PUMP_DIMENSIONS) {
    try {
      const { error } = await supabase
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

  console.log(`\n📊 Total dimensions in database: ${count}/23`);
}

importDimensions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
