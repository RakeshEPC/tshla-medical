/**
 * Check if appointments were uploaded successfully
 * Specifically checking for today's date (2026-01-26)
 */

const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 CHECKING UPLOADED APPOINTMENTS\n');
  console.log('=' .repeat(70) + '\n');

  const targetDate = '2026-01-26';

  // Check appointments table
  const { data: appointments, error } = await s
    .from('appointments')
    .select('*')
    .eq('schedule_date', targetDate)
    .order('appointment_time');

  if (error) {
    console.log('❌ Error querying appointments:', error.message);
    return;
  }

  console.log(`📅 Appointments for ${targetDate}:`, appointments?.length || 0);
  console.log();

  if (appointments && appointments.length > 0) {
    // Group by provider
    const byProvider = {};
    appointments.forEach(apt => {
      const provider = apt.provider_name || apt.provider_id || 'Unknown';
      if (!byProvider[provider]) {
        byProvider[provider] = [];
      }
      byProvider[provider].push(apt);
    });

    console.log('📊 Breakdown by Provider:\n');
    Object.keys(byProvider).forEach(provider => {
      const apts = byProvider[provider];
      console.log(`   ${provider}: ${apts.length} appointments`);

      // Show status breakdown
      const statusCounts = {};
      apts.forEach(a => {
        const status = a.status || a.appointment_status || 'scheduled';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      Object.keys(statusCounts).forEach(status => {
        console.log(`      - ${status}: ${statusCounts[status]}`);
      });
    });

    console.log('\n📋 Sample appointments:\n');
    appointments.slice(0, 5).forEach((apt, i) => {
      console.log(`   ${i+1}. ${apt.appointment_time || 'No time'} - ${apt.patient_name || apt.patient_first_name + ' ' + apt.patient_last_name || 'No name'}`);
      console.log(`      Provider: ${apt.provider_name || 'Unknown'}`);
      console.log(`      Status: ${apt.status || apt.appointment_status || 'scheduled'}`);
      console.log(`      Type: ${apt.appointment_type || 'N/A'}`);
      console.log();
    });

    if (appointments.length > 5) {
      console.log(`   ... and ${appointments.length - 5} more\n`);
    }
  } else {
    console.log('⚠️  No appointments found for this date.\n');
    console.log('Possible reasons:');
    console.log('  1. File upload failed or returned error');
    console.log('  2. Wrong schedule_date format in database');
    console.log('  3. Appointments inserted into different table');
    console.log('  4. Deployment not yet complete\n');

    // Check other common table names
    console.log('🔍 Checking alternative table names...\n');

    const alternativeTables = ['schedule', 'provider_schedule', 'daily_schedule', 'athena_appointments'];

    for (const tableName of alternativeTables) {
      try {
        const { data, error } = await s.from(tableName).select('*').limit(1);
        if (!error && data) {
          console.log(`   ✅ Found table: ${tableName}`);
        }
      } catch (e) {
        // Table doesn't exist
      }
    }
  }

  console.log('\n' + '=' .repeat(70));
})();
