/**
 * Cancel Laura Kozielec Appointment
 *
 * Manually marks Laura Kozielec's Jan 7, 2026 appointment as cancelled
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cancelLaura() {
  console.log('🔍 Finding Laura Kozielec appointment on Jan 7, 2026...\n');

  // Find the appointment
  const { data: appointments } = await supabase
    .from('provider_schedules')
    .select('*')
    .ilike('patient_name', '%kozielec%')
    .eq('scheduled_date', '2026-01-07');

  if (!appointments || appointments.length === 0) {
    console.log('❌ No Laura Kozielec appointments found on Jan 7, 2026');
    return;
  }

  console.log(`Found ${appointments.length} appointment(s):\n`);
  appointments.forEach(apt => {
    console.log(`ID: ${apt.id}`);
    console.log(`  Patient: ${apt.patient_name}`);
    console.log(`  Date: ${apt.scheduled_date} at ${apt.start_time}`);
    console.log(`  Provider: ${apt.provider_name || apt.provider_id}`);
    console.log(`  Current Status: ${apt.status}`);
    console.log('');
  });

  // Mark as cancelled
  const today = new Date().toISOString().split('T')[0];

  for (const apt of appointments) {
    const { error } = await supabase
      .from('provider_schedules')
      .update({
        status: 'cancelled',
        cancellation_date: today
      })
      .eq('id', apt.id);

    if (error) {
      console.error(`❌ Error cancelling appointment ${apt.id}:`, error);
    } else {
      console.log(`✅ Cancelled appointment ID ${apt.id}`);
    }
  }

  console.log('\n✅ Done!');
}

cancelLaura().catch(console.error).finally(() => process.exit(0));
