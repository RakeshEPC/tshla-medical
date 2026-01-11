#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking templates table schema...\n');

  // Try to get one row to see actual columns
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);

    // Try without any filters
    const { data: allData, error: allError } = await supabase
      .from('templates')
      .select()
      .limit(1);

    if (allError) {
      console.error('❌ Cannot access templates table:', allError);
    } else if (allData && allData.length > 0) {
      console.log('✅ Sample template record:');
      console.log(JSON.stringify(allData[0], null, 2));
      console.log('\n📋 Columns found:');
      Object.keys(allData[0]).forEach(key => {
        console.log(`   - ${key}: ${typeof allData[0][key]}`);
      });
    } else {
      console.log('⚠️  Templates table exists but is EMPTY');
      console.log('\n🔧 Need to seed templates:');
      console.log('   npx tsx scripts/seed-templates.ts');
    }
  } else if (data && data.length > 0) {
    console.log('✅ Sample template:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️  Templates table is EMPTY');
  }

  // Count total templates
  const { count, error: countError } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`\n📊 Total templates in database: ${count}`);
  }
}

checkSchema().catch(console.error);
