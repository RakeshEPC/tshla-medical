/**
 * Check Pre-Visit Work for Dr. R Patel's Schedule (provider GC_EPC_Patel_R)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkRPatelSchedule() {
  console.log('🔍 Checking Pre-Visit Work for Dr. R Patel\'s Schedule');
  console.log('   Looking for appointments with provider: GC_EPC_Patel_R');
  console.log('   Checking work done yesterday (Friday, Jan 16, 2026) for Monday\'s appointments');
  console.log('='.repeat(85));
  console.log('');

  try {
    // Find all appointments for provider R Patel around this week
    const { data: appointments, error } = await supabase
      .from('provider_schedules')
      .select(`
        id,
        patient_name,
        scheduled_date,
        start_time,
        provider_name,
        provider_id,
        pre_visit_complete,
        pre_visit_completed_at,
        unified_patient_id,
        unified_patients!unified_patient_id (
          tshla_id,
          phone_primary
        )
      `)
      .eq('provider_name', 'GC_EPC_Patel_R')
      .gte('scheduled_date', '2026-01-15')
      .lte('scheduled_date', '2026-01-22')
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!appointments || appointments.length === 0) {
      console.log('⚠️  No appointments found for provider GC_EPC_Patel_R between Jan 15-22, 2026');
      return;
    }

    console.log(`📅 Found ${appointments.length} appointments for Dr. R Patel\n`);

    let totalWithPrevisit = 0;
    let totalCompleted = 0;
    let mondayAppointments = [];

    for (const apt of appointments) {
      const isMonday = apt.scheduled_date === '2026-01-19';
      if (isMonday) {
        mondayAppointments.push(apt);
      }

      console.log(`${isMonday ? '📌 MONDAY' : '📅'} ${apt.scheduled_date} at ${apt.start_time} - ${apt.patient_name}`);
      console.log(`   Appointment ID: ${apt.id}`);
      console.log(`   TSHLA ID: ${apt.unified_patients?.tshla_id || 'N/A'}`);
      console.log(`   Pre-Visit Complete (Schedule): ${apt.pre_visit_complete ? '✅ YES' : '❌ NO'}`);

      // Check previsit_data
      const { data: previsitData } = await supabase
        .from('previsit_data')
        .select('*')
        .eq('appointment_id', apt.id)
        .maybeSingle();

      if (previsitData) {
        totalWithPrevisit++;
        if (previsitData.completed) {
          totalCompleted++;
        }

        const updatedDate = new Date(previsitData.updated_at);
        const wasYesterday = updatedDate.toDateString() === new Date('2026-01-16').toDateString();

        console.log(`   📋 Pre-Visit Data: ${previsitData.completed ? '✅ COMPLETE' : '⚠️  DRAFT ONLY'}`);
        console.log(`   Last Updated: ${updatedDate.toLocaleString()} ${wasYesterday ? '✅ (Yesterday!)' : ''}`);

        if (previsitData.completed_at) {
          console.log(`   Completed At: ${new Date(previsitData.completed_at).toLocaleString()}`);
        }

        // Show what was entered
        const entered = [];
        if (previsitData.previous_notes) entered.push('Notes');
        if (previsitData.medications_list) entered.push('Meds');
        if (previsitData.lab_results) entered.push('Labs');
        if (previsitData.vitals) entered.push('Vitals');
        if (previsitData.patient_questionnaire) entered.push('Questionnaire');
        if (previsitData.insurance_notes) entered.push('Insurance');

        console.log(`   Data Entered: ${entered.join(', ') || 'None'}`);

        // Billing
        if (previsitData.em_code || previsitData.copay_amount) {
          console.log(`   Billing: E/M ${previsitData.em_code || 'N/A'}, Copay $${previsitData.copay_amount || '0'}, Paid: ${previsitData.patient_paid ? 'Yes' : 'No'}`);
        }

        // AI Summary
        if (previsitData.ai_summary) {
          console.log(`   AI Summary: ✅ Generated`);
          console.log(`   Chief Complaint: ${previsitData.chief_complaint || 'N/A'}`);
        } else {
          console.log(`   AI Summary: ❌ Not generated yet`);
        }
      } else {
        console.log(`   📋 Pre-Visit Data: ❌ NONE - Staff has not started prep`);
      }

      console.log('');
    }

    // Summary for Monday appointments
    console.log('='.repeat(85));
    console.log('📊 SUMMARY FOR MONDAY (January 19, 2026):');
    console.log('='.repeat(85));

    if (mondayAppointments.length === 0) {
      console.log('⚠️  No appointments scheduled for Monday, January 19, 2026');
    } else {
      console.log(`Total Monday Appointments: ${mondayAppointments.length}`);

      let mondayWithData = 0;
      let mondayReady = 0;

      for (const apt of mondayAppointments) {
        const { data: pvData } = await supabase
          .from('previsit_data')
          .select('completed')
          .eq('appointment_id', apt.id)
          .maybeSingle();

        if (pvData) {
          mondayWithData++;
          if (pvData.completed) {
            mondayReady++;
          }
        }
      }

      console.log(`Appointments with Pre-Visit Data: ${mondayWithData}`);
      console.log(`Pre-Visit Marked Complete: ${mondayReady}`);
      console.log(`Ready for Dictation Summary: ${mondayReady}`);
      console.log('');

      console.log('='.repeat(85));
      console.log('ANSWER TO YOUR QUESTION:');
      console.log('='.repeat(85));

      if (mondayReady === mondayAppointments.length) {
        console.log('✅ YES - ALL Monday appointments have pre-visit work COMPLETE!');
        console.log('   Staff finished the work and it\'s ready for dictation summary creation on Monday.');
      } else if (mondayWithData > 0) {
        console.log(`⚠️  PARTIAL - ${mondayWithData}/${mondayAppointments.length} Monday appointments have pre-visit data.`);
        console.log(`   Only ${mondayReady} are marked COMPLETE and ready for dictation.`);
        console.log('');
        console.log('   💡 What this means:');
        console.log('   - Staff saved draft data but didn\'t click "Generate Summary"');
        console.log('   - The dictation page may not show pre-visit info until marked complete');
        console.log('   - Staff needs to finish and click "Generate Summary" for remaining appointments');
      } else {
        console.log('❌ NO - No pre-visit work has been completed for Monday\'s appointments yet.');
      }
    }

    console.log('');
    console.log('='.repeat(85));
    console.log('OVERALL STATISTICS (All appointments Jan 15-22):');
    console.log('='.repeat(85));
    console.log(`Total Appointments: ${appointments.length}`);
    console.log(`With Pre-Visit Data: ${totalWithPrevisit}`);
    console.log(`Marked Complete: ${totalCompleted}`);
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkRPatelSchedule();
