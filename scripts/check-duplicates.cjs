require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDuplicates() {
  console.log('🔍 Checking for Laura Kozielec and duplicates...\n');

  // Check Laura Kozielec
  const { data: laura } = await supabase
    .from('provider_schedules')
    .select('*')
    .ilike('patient_name', '%kozielec%')
    .order('scheduled_date');

  console.log('=== LAURA KOZIELEC ===');
  if (laura && laura.length > 0) {
    laura.forEach(apt => {
      console.log(`Date: ${apt.scheduled_date} | Time: ${apt.start_time} | Status: ${apt.status} | Cancelled: ${apt.cancellation_date || 'N/A'} | ID: ${apt.id}`);
    });
  } else {
    console.log('No records found');
  }

  // Check for duplicates on Monday Jan 6
  const { data: monday } = await supabase
    .from('provider_schedules')
    .select('id, patient_name, start_time, status')
    .eq('scheduled_date', '2026-01-06')
    .eq('provider_id', 'GC_EPC_Chamakkala_T')
    .neq('status', 'cancelled')
    .order('start_time');

  console.log('\n=== MONDAY JAN 6 - GC_EPC_Chamakkala_T ===');
  if (monday) {
    console.log(`Total: ${monday.length} appointments`);
    const grouped = {};
    monday.forEach(apt => {
      const key = `${apt.start_time}-${apt.patient_name}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(apt.id);
    });

    console.log('\nDuplicates found:');
    let dupCount = 0;
    Object.entries(grouped).forEach(([key, ids]) => {
      if (ids.length > 1) {
        dupCount++;
        console.log(`  ${key}: ${ids.length} copies (IDs: ${ids.join(', ')})`);
      }
    });

    if (dupCount === 0) {
      console.log('  ✅ No duplicates found!');
    } else {
      console.log(`\n❌ Found ${dupCount} duplicate appointment groups`);
    }
  }
}

checkDuplicates().catch(console.error).finally(() => process.exit(0));
