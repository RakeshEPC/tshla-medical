/**
 * Compare Athena Schedule with Database and Mark Cancellations
 *
 * Compares the current Athena schedule with what's in the database
 * and marks appointments as cancelled if they're missing from Athena
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Current Athena schedule for Jan 7, 2026 (from user's paste)
const athenaSchedule = {
  'GC_EPC_Chamakkala_T': [
    { time: '08:00', name: 'MICHAEL GENTRY' },
    { time: '08:45', name: 'KAHLA COOK' },
    { time: '09:00', name: 'MARGARET YVONNE FRANKS' },
    { time: '09:15', name: 'SAMANTHA FOSTER' },
    { time: '09:30', name: 'JAMES ROBERTSON' },
    { time: '09:45', name: 'ROSEMARY THIBODEAUX' },
    { time: '10:00', name: 'DAVID PATTISON' },
    { time: '10:15', name: 'PAMELA VELEZ' },
    { time: '10:30', name: 'RAMONA SNAPP' },
    { time: '11:00', name: 'CATALINA COLMENARES' },
    { time: '11:15', name: 'KEVIN PEOPLES' },
    { time: '11:30', name: 'FELIPA DE LA LUZ GARCELL AGUILAR' },
    { time: '13:00', name: 'MISTY PALMER' },
    { time: '13:30', name: 'THAIS VILCHEZ GARCIA' }
  ],
  'GC_EPC_Bernander_R': [
    { time: '08:00', name: 'GABRIEL SERRANO' },
    { time: '08:30', name: 'JORGE HERRERA ROMAN' },
    { time: '08:45', name: 'DIANA DOBBS' },
    { time: '09:30', name: 'MADISON JETER' },
    { time: '10:00', name: 'DYAN AGUILAR' },
    { time: '10:30', name: 'LAURA PEDDICORD' },
    { time: '10:45', name: 'VICTOR PEINADO' },
    { time: '11:30', name: 'DEBORAH JONES' }
  ]
};

async function compareAndCancel() {
  console.log('🔍 Comparing database with Athena schedule for Jan 7, 2026...\n');

  const scheduleDate = '2026-01-07';

  // Get all appointments from database for Jan 7
  const { data: dbAppointments, error } = await supabase
    .from('provider_schedules')
    .select('*')
    .eq('scheduled_date', scheduleDate)
    .neq('status', 'cancelled')
    .order('provider_id')
    .order('start_time');

  if (error) {
    console.error('❌ Error fetching appointments:', error);
    return;
  }

  console.log(`📊 Found ${dbAppointments.length} scheduled appointments in database\n`);

  const toCancel = [];
  const athenaSet = new Set();

  // Build set of Athena appointments
  Object.entries(athenaSchedule).forEach(([providerId, appointments]) => {
    appointments.forEach(apt => {
      athenaSet.add(`${providerId}|${apt.time}|${apt.name}`);
    });
  });

  // Check each DB appointment against Athena
  dbAppointments.forEach(apt => {
    const key = `${apt.provider_id}|${apt.start_time}|${apt.patient_name}`;

    if (!athenaSet.has(key)) {
      toCancel.push(apt);
    }
  });

  console.log('=== COMPARISON RESULTS ===\n');
  console.log(`✅ Appointments in Athena: ${athenaSet.size}`);
  console.log(`📋 Appointments in Database: ${dbAppointments.length}`);
  console.log(`❌ Appointments to cancel: ${toCancel.length}\n`);

  if (toCancel.length === 0) {
    console.log('✅ All database appointments match Athena - nothing to cancel!');
    return;
  }

  console.log('=== APPOINTMENTS TO CANCEL ===\n');
  toCancel.forEach((apt, i) => {
    console.log(`[${i + 1}] ${apt.patient_name}`);
    console.log(`    Time: ${apt.start_time}`);
    console.log(`    Provider: ${apt.provider_name || apt.provider_id}`);
    console.log(`    ID: ${apt.id}`);
    console.log('');
  });

  // Cancel appointments
  const today = new Date().toISOString().split('T')[0];
  let cancelled = 0;

  console.log('🗑️  Cancelling appointments...\n');

  for (const apt of toCancel) {
    const { error: updateError } = await supabase
      .from('provider_schedules')
      .update({
        status: 'cancelled',
        cancellation_date: today
      })
      .eq('id', apt.id);

    if (updateError) {
      console.error(`❌ Error cancelling ${apt.patient_name}:`, updateError);
    } else {
      cancelled++;
      console.log(`✅ Cancelled: ${apt.patient_name} (${apt.start_time})`);
    }
  }

  console.log(`\n✅ Done! Cancelled ${cancelled} out of ${toCancel.length} appointments`);
}

compareAndCancel().catch(console.error).finally(() => process.exit(0));
