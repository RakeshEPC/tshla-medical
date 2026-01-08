require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTodaySchedule() {
  const today = '2026-01-07';
  
  console.log(`🔍 Checking schedule for ${today}...\n`);

  const { data: allApts } = await supabase
    .from('provider_schedules')
    .select('id, status')
    .eq('scheduled_date', today);

  if (allApts) {
    const total = allApts.length;
    const cancelled = allApts.filter(a => a.status === 'cancelled').length;
    const scheduled = allApts.filter(a => a.status === 'scheduled').length;
    
    console.log(`📊 TOTAL for ${today}: ${total} appointments`);
    console.log(`   ✅ Scheduled: ${scheduled}`);
    console.log(`   ❌ Cancelled: ${cancelled}\n`);
  }

  const { data, error } = await supabase
    .from('provider_schedules')
    .select('provider_id, provider_name, start_time, patient_name, status')
    .eq('scheduled_date', today)
    .neq('status', 'cancelled')
    .order('provider_id')
    .order('start_time');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ SCHEDULED appointments for ${today}:\n`);

  const byProvider = {};
  data.forEach(apt => {
    const pid = apt.provider_id || 'Unknown';
    if (!byProvider[pid]) {
      byProvider[pid] = { name: apt.provider_name || pid, appointments: [] };
    }
    byProvider[pid].appointments.push(apt);
  });

  Object.entries(byProvider).forEach(([pid, info]) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👨‍⚕️ ${info.name}`);
    console.log(`   ${info.appointments.length} appointments`);
    console.log(`${'='.repeat(60)}`);
    
    info.appointments.forEach((apt, i) => {
      console.log(`  ${apt.start_time} - ${apt.patient_name}`);
    });
  });
}

checkTodaySchedule().catch(console.error).finally(() => process.exit(0));
