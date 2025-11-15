/**
 * Pre-Visit Call Scheduler
 * Cron job that runs daily to schedule and make pre-visit calls
 * Created: January 2025
 *
 * Schedule:
 * - Day -3: Send Klara text notifications
 * - Day -2: First call attempt (10 AM - 12 PM)
 * - Day -1: Second call attempt (2 PM - 4 PM)
 * - Day 0: Third call attempt (8 AM - 10 AM)
 */

import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import twilioService from '../services/twilioService';
import klaraService from '../services/klaraService';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format time as HH:MM
 */
function formatTime(date: Date): string {
  return date.toTimeString().split(' ')[0].substring(0, 5);
}

// =====================================================
// DAY -3: SEND KLARA NOTIFICATIONS
// =====================================================

async function sendDay3Notifications() {
  console.log('\n' + '='.repeat(60));
  console.log('📱 DAY -3: SENDING KLARA NOTIFICATIONS');
  console.log('='.repeat(60));

  const targetDate = formatDate(addDays(new Date(), 3));
  console.log(`Target date: ${targetDate} (3 days from now)`);

  try {
    // Get appointments needing pre-visit calls
    const { data: appointments, error } = await supabase.rpc(
      'get_appointments_needing_previsit_calls',
      { target_date: targetDate }
    );

    if (error) {
      console.error('❌ Failed to get appointments:', error);
      return;
    }

    console.log(`Found ${appointments?.length || 0} appointments`);

    for (const appt of appointments || []) {
      // Skip if already sent notification
      const { data: existingNotif } = await supabase
        .from('previsit_notification_log')
        .select('id')
        .eq('patient_id', appt.patient_id)
        .eq('notification_type', 'klara-text')
        .gte('sent_at', formatDate(new Date())) // Sent today or later
        .single();

      if (existingNotif) {
        console.log(`   ⏭️  Skipping ${appt.patient_name} - already notified`);
        continue;
      }

      // Send Klara notification
      console.log(`   📱 Sending notification to ${appt.patient_name}`);

      const result = await klaraService.sendPreVisitNotification({
        patientId: appt.patient_id,
        patientPhone: appt.patient_phone,
        patientName: appt.patient_name,
        appointmentId: appt.appointment_id,
        providerName: 'Your Provider', // TODO: Get from database
        appointmentDate: targetDate,
        appointmentTime: formatTime(new Date(appt.appointment_time)),
      });

      if (result.success) {
        console.log(`   ✅ Sent to ${appt.patient_name}`);
      } else {
        console.log(`   ❌ Failed to send to ${appt.patient_name}: ${result.error}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n✅ Day -3 notifications complete`);
  } catch (error) {
    console.error('❌ Error in sendDay3Notifications:', error);
  }
}

// =====================================================
// DAY -2: FIRST CALL ATTEMPT
// =====================================================

async function makeDay2Calls() {
  console.log('\n' + '='.repeat(60));
  console.log('📞 DAY -2: FIRST CALL ATTEMPT (10 AM - 12 PM)');
  console.log('='.repeat(60));

  const targetDate = formatDate(addDays(new Date(), 2));
  console.log(`Target date: ${targetDate} (2 days from now)`);

  // Only make calls during optimal time window
  const currentHour = new Date().getHours();
  if (currentHour < 10 || currentHour >= 12) {
    console.log(`⏸️  Outside optimal call window (current time: ${currentHour}:00)`);
    console.log('   Optimal window: 10 AM - 12 PM');
    return;
  }

  await makeCallsForDate(targetDate, 1);
}

// =====================================================
// DAY -1: SECOND CALL ATTEMPT
// =====================================================

async function makeDay1Calls() {
  console.log('\n' + '='.repeat(60));
  console.log('📞 DAY -1: SECOND CALL ATTEMPT (2 PM - 4 PM)');
  console.log('='.repeat(60));

  const targetDate = formatDate(addDays(new Date(), 1));
  console.log(`Target date: ${targetDate} (1 day from now)`);

  // Only make calls during optimal time window
  const currentHour = new Date().getHours();
  if (currentHour < 14 || currentHour >= 16) {
    console.log(`⏸️  Outside optimal call window (current time: ${currentHour}:00)`);
    console.log('   Optimal window: 2 PM - 4 PM');
    return;
  }

  await makeCallsForDate(targetDate, 2);
}

// =====================================================
// DAY 0: THIRD CALL ATTEMPT (MORNING OF APPOINTMENT)
// =====================================================

async function makeSameDayCalls() {
  console.log('\n' + '='.repeat(60));
  console.log('📞 DAY 0: THIRD CALL ATTEMPT (8 AM - 10 AM)');
  console.log('='.repeat(60));

  const targetDate = formatDate(new Date());
  console.log(`Target date: ${targetDate} (today)`);

  // Only make calls during optimal time window
  const currentHour = new Date().getHours();
  if (currentHour < 8 || currentHour >= 10) {
    console.log(`⏸️  Outside optimal call window (current time: ${currentHour}:00)`);
    console.log('   Optimal window: 8 AM - 10 AM');
    return;
  }

  await makeCallsForDate(targetDate, 3);
}

// =====================================================
// SHARED CALL LOGIC
// =====================================================

async function makeCallsForDate(targetDate: string, attemptNumber: number) {
  try {
    // Get appointments needing pre-visit calls
    const { data: appointments, error } = await supabase.rpc(
      'get_appointments_needing_previsit_calls',
      { target_date: targetDate }
    );

    if (error) {
      console.error('❌ Failed to get appointments:', error);
      return;
    }

    console.log(`Found ${appointments?.length || 0} appointments`);

    let callsMade = 0;
    let callsSkipped = 0;

    for (const appt of appointments || []) {
      // Skip if already completed
      if (appt.already_called) {
        console.log(`   ⏭️  Skipping ${appt.patient_name} - already completed`);
        callsSkipped++;
        continue;
      }

      // Skip if already made 3 attempts
      if (appt.call_attempts >= 3) {
        console.log(`   ⏭️  Skipping ${appt.patient_name} - max attempts reached`);
        callsSkipped++;
        continue;
      }

      // Only make the current attempt if previous attempts have been made
      if (appt.call_attempts < attemptNumber - 1) {
        console.log(
          `   ⏭️  Skipping ${appt.patient_name} - not ready for attempt #${attemptNumber}`
        );
        callsSkipped++;
        continue;
      }

      // Make the call
      console.log(`   📞 Calling ${appt.patient_name} (attempt #${attemptNumber})`);

      const result = await twilioService.initiatePreVisitCall({
        patientId: appt.patient_id,
        patientName: appt.patient_name,
        patientPhone: appt.patient_phone,
        appointmentId: appt.appointment_id,
        appointmentDate: targetDate,
        appointmentTime: formatTime(new Date(appt.appointment_time)),
        providerName: 'Your Provider', // TODO: Get from database
        providerId: appt.provider_id || '',
        attemptNumber,
      });

      if (result.success) {
        console.log(`   ✅ Call initiated: ${result.callSid}`);
        callsMade++;
      } else {
        console.log(`   ❌ Call failed: ${result.error}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n✅ Attempt #${attemptNumber} complete`);
    console.log(`   Calls made: ${callsMade}`);
    console.log(`   Calls skipped: ${callsSkipped}`);
  } catch (error) {
    console.error(`❌ Error making calls for attempt #${attemptNumber}:`, error);
  }
}

// =====================================================
// CRON JOB CONFIGURATION
// =====================================================

/**
 * Main cron job - runs every hour
 * Checks what needs to be done and executes appropriate function
 */
export const preVisitCallScheduler = cron.schedule(
  '0 * * * *', // Every hour on the hour
  async () => {
    console.log('\n\n' + '='.repeat(60));
    console.log('🔄 PRE-VISIT CALL SCHEDULER');
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));

    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay(); // 0 = Sunday

    // Don't run on Sundays
    if (currentDay === 0) {
      console.log('⏸️  Sunday - scheduler paused');
      return;
    }

    // Don't run outside business hours
    if (currentHour < 8 || currentHour >= 19) {
      console.log(`⏸️  Outside business hours (${currentHour}:00) - scheduler paused`);
      return;
    }

    try {
      // Day -3: Send notifications (runs at 10 AM)
      if (currentHour === 10) {
        await sendDay3Notifications();
      }

      // Day -2: First call attempt (runs 10 AM - 12 PM)
      if (currentHour >= 10 && currentHour < 12) {
        await makeDay2Calls();
      }

      // Day -1: Second call attempt (runs 2 PM - 4 PM)
      if (currentHour >= 14 && currentHour < 16) {
        await makeDay1Calls();
      }

      // Day 0: Third call attempt (runs 8 AM - 10 AM)
      if (currentHour >= 8 && currentHour < 10) {
        await makeSameDayCalls();
      }
    } catch (error) {
      console.error('❌ Scheduler error:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Scheduler cycle complete');
    console.log('='.repeat(60) + '\n\n');
  },
  {
    scheduled: true,
    timezone: 'America/New_York', // Adjust to your timezone
  }
);

/**
 * Start the scheduler
 */
export function startScheduler() {
  console.log('🚀 Starting pre-visit call scheduler...');
  console.log('   Schedule: Every hour');
  console.log('   Timezone: America/New_York');
  console.log('   Business hours: 8 AM - 7 PM');
  console.log('   No calls on Sundays');
  console.log('');
  console.log('   Day -3 (10 AM): Send Klara notifications');
  console.log('   Day -2 (10 AM - 12 PM): First call attempt');
  console.log('   Day -1 (2 PM - 4 PM): Second call attempt');
  console.log('   Day 0 (8 AM - 10 AM): Third call attempt');
  console.log('');

  preVisitCallScheduler.start();
  console.log('✅ Scheduler started\n');
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  preVisitCallScheduler.stop();
  console.log('⏹️  Scheduler stopped');
}

// Export for use in server
export default {
  startScheduler,
  stopScheduler,
  preVisitCallScheduler,
};
