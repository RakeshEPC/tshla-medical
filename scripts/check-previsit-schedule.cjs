/**
 * Check Pre-Visit Data for Today's Schedule
 * Diagnostic script to see why pre-visit data isn't showing
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPreVisitData() {
  console.log('🔍 Checking Pre-Visit Data for Today\'s Schedule');
  console.log('=============================================\n');

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  console.log(`📅 Checking appointments for: ${today}\n`);

  // Step 1: Get today's appointments for Dr. R Patel
  console.log('📋 Querying provider_schedules...');
  const { data: appointments, error: apptError } = await supabase
    .from('provider_schedules')
    .select('*')
    .eq('scheduled_date', today)
    .ilike('provider_name', '%patel%')
    .order('start_time', { ascending: true });

  if (apptError) {
    console.error('❌ Error fetching appointments:', apptError);
    return;
  }

  console.log(`✅ Found ${appointments?.length || 0} appointments for Dr. Patel\n`);

  if (!appointments || appointments.length === 0) {
    console.log('ℹ️  No appointments scheduled for today');
    return;
  }

  // Step 2: For each appointment, check if pre-visit data exists
  console.log('📊 Checking pre-visit data for each appointment:\n');
  console.log('═'.repeat(80));

  for (const appt of appointments) {
    console.log(`\n🏥 Appointment ID: ${appt.id}`);
    console.log(`   Patient: ${appt.patient_name}`);
    console.log(`   Time: ${appt.start_time}`);
    console.log(`   Status: ${appt.status || 'N/A'}`);

    // Check previsit_data table
    const { data: previsitData, error: previsitError } = await supabase
      .from('previsit_data')
      .select('*')
      .eq('appointment_id', appt.id)
      .maybeSingle();

    if (previsitError) {
      console.log(`   ❌ Error checking pre-visit: ${previsitError.message}`);
      continue;
    }

    if (!previsitData) {
      console.log('   📝 Pre-visit Status: ❌ NO DATA');
      console.log('   → Staff has not started pre-visit for this appointment');
    } else {
      console.log(`   📝 Pre-visit Status: ${previsitData.completed ? '✅ COMPLETED' : '⏳ IN PROGRESS'}`);
      console.log(`   → Chief Complaint: ${previsitData.chief_complaint || 'N/A'}`);
      console.log(`   → Created: ${previsitData.created_at}`);
      console.log(`   → Completed At: ${previsitData.completed_at || 'Not completed yet'}`);
      console.log(`   → Has AI Summary: ${previsitData.ai_summary ? 'Yes' : 'No'}`);

      if (!previsitData.completed) {
        console.log('   ⚠️  REASON NOT SHOWING: Staff started but didn\'t click "Generate AI Summary"');
      } else {
        console.log('   ✅ This pre-visit data SHOULD be visible in dictation');
      }
    }
    console.log('─'.repeat(80));
  }

  console.log('\n=============================================');
  console.log('✅ Diagnostic check complete!\n');

  // Summary
  const totalAppts = appointments.length;
  const withPrevisit = appointments.filter(async (appt) => {
    const { data } = await supabase
      .from('previsit_data')
      .select('id')
      .eq('appointment_id', appt.id)
      .single();
    return data;
  }).length;

  console.log('📊 SUMMARY:');
  console.log(`   Total appointments: ${totalAppts}`);
  console.log(`   With pre-visit data: ${withPrevisit}`);
  console.log(`   Without pre-visit: ${totalAppts - withPrevisit}`);
}

checkPreVisitData().catch(console.error);
