#!/usr/bin/env node
/**
 * Verify Schedule Upload
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyUpload() {
  console.log('\n🔍 Verifying Upload...\n');

  const { data, error } = await supabase
    .from('provider_schedules')
    .select('*')
    .eq('scheduled_date', '2026-01-29')
    .order('start_time');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${data.length} appointments for 2026-01-29\n`);

  // Group by provider
  const byProvider = {};
  const byStatus = {};

  data.forEach(apt => {
    byProvider[apt.provider_name] = (byProvider[apt.provider_name] || 0) + 1;
    byStatus[apt.status] = (byStatus[apt.status] || 0) + 1;
  });

  console.log('📊 By Provider:');
  Object.entries(byProvider).forEach(([name, count]) => {
    console.log(`   ${name}: ${count}`);
  });

  console.log('\n📊 By Status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log('\n📋 Sample appointments:\n');
  data.slice(0, 5).forEach(apt => {
    console.log(`   ${apt.start_time} - ${apt.patient_name} (${apt.status})`);
  });

  console.log('\n✅ Verification complete!\n');
}

verifyUpload();
