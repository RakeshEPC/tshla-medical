/**
 * Find all Patel appointments in the schedule
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function findPatelAppointments() {
  console.log('🔍 Searching for Patel appointments...\n');

  // Try various searches
  const searches = [
    { name: 'Patel (any)', pattern: '%patel%' },
    { name: 'R Patel', pattern: '%r%patel%' },
    { name: 'Rakesh', pattern: '%rakesh%' },
    { name: 'R. Patel', pattern: '%r.%patel%' }
  ];

  for (const search of searches) {
    console.log(`📋 Searching for "${search.name}"...`);

    const { data, error } = await supabase
      .from('provider_schedules')
      .select('id, patient_name, scheduled_date, start_time, provider_name')
      .ilike('patient_name', search.pattern)
      .gte('scheduled_date', '2026-01-14')
      .lte('scheduled_date', '2026-01-22')
      .order('scheduled_date', { ascending: true });

    if (data && data.length > 0) {
      console.log(`✅ Found ${data.length} appointment(s):`);
      data.forEach(apt => {
        console.log(`   - ${apt.patient_name} on ${apt.scheduled_date} at ${apt.start_time} (ID: ${apt.id})`);
        console.log(`     Provider: ${apt.provider_name}`);
      });
      console.log('');
    } else {
      console.log(`   No appointments found\n`);
    }
  }

  // Also check Monday Jan 19 specifically
  console.log('📅 Checking Monday, January 19, 2026 schedule...\n');
  const { data: mondayAppts } = await supabase
    .from('provider_schedules')
    .select('id, patient_name, scheduled_date, start_time, provider_name, pre_visit_complete')
    .eq('scheduled_date', '2026-01-19')
    .order('start_time', { ascending: true });

  if (mondayAppts && mondayAppts.length > 0) {
    console.log(`Found ${mondayAppts.length} appointments on Monday:\n`);
    mondayAppts.forEach(apt => {
      const pvStatus = apt.pre_visit_complete ? '✅' : '❌';
      console.log(`${pvStatus} ${apt.patient_name} at ${apt.start_time}`);
    });
  }
}

findPatelAppointments();
