/**
 * Check pre-visit work for patient TSH 477-391 (from the payment webhook)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTSH477391() {
  console.log('🔍 Checking Pre-Visit Work for TSH 477-391');
  console.log('(This is the patient from the $0.60 copay payment we just fixed)');
  console.log('=' .repeat(80));
  console.log('');

  try {
    // 1. Find patient by TSHLA ID
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('*')
      .eq('tshla_id', 'TSH 477-391')
      .maybeSingle();

    if (patientError) {
      console.error('❌ Error fetching patient:', patientError);
      return;
    }

    if (!patient) {
      console.log('⚠️  Patient TSH 477-391 not found in unified_patients table');
      return;
    }

    console.log('👤 PATIENT INFORMATION:');
    console.log(`  Name: ${patient.first_name} ${patient.last_name}`);
    console.log(`  TSHLA ID: ${patient.tshla_id}`);
    console.log(`  Patient ID: ${patient.patient_id}`);
    console.log(`  Phone: ${patient.phone_primary}`);
    console.log(`  MRN: ${patient.mrn || 'N/A'}`);
    console.log('');

    // 2. Find appointments for this patient
    const { data: appointments } = await supabase
      .from('provider_schedules')
      .select(`
        id,
        patient_name,
        scheduled_date,
        start_time,
        provider_name,
        pre_visit_complete,
        pre_visit_completed_at
      `)
      .eq('unified_patient_id', patient.id)
      .gte('scheduled_date', '2026-01-14')
      .lte('scheduled_date', '2026-01-22')
      .order('scheduled_date', { ascending: true });

    if (!appointments || appointments.length === 0) {
      console.log('⚠️  No appointments found for this patient between Jan 14-22, 2026');
      return;
    }

    console.log(`📅 APPOINTMENTS (${appointments.length} found):\n`);

    for (const apt of appointments) {
      console.log(`Appointment ID: ${apt.id}`);
      console.log(`  Date: ${apt.scheduled_date} at ${apt.start_time}`);
      console.log(`  Provider: ${apt.provider_name}`);
      console.log(`  Pre-Visit Complete: ${apt.pre_visit_complete ? '✅ YES' : '❌ NO'}`);
      if (apt.pre_visit_completed_at) {
        console.log(`  Completed At: ${new Date(apt.pre_visit_completed_at).toLocaleString()}`);
      }

      // Check previsit_data for this appointment
      const { data: previsitData } = await supabase
        .from('previsit_data')
        .select('*')
        .eq('appointment_id', apt.id)
        .maybeSingle();

      if (previsitData) {
        console.log('  📋 PRE-VISIT DATA:');
        console.log(`    Status: ${previsitData.completed ? '✅ COMPLETE - Ready for Dictation' : '⚠️  DRAFT ONLY'}`);
        console.log(`    Created: ${new Date(previsitData.created_at).toLocaleString()}`);
        console.log(`    Updated: ${new Date(previsitData.updated_at).toLocaleString()}`);

        if (previsitData.completed_at) {
          console.log(`    Completed: ${new Date(previsitData.completed_at).toLocaleString()}`);
        }

        // Show what data was entered
        const dataFields = [];
        if (previsitData.previous_notes) dataFields.push('Previous Notes');
        if (previsitData.medications_list) dataFields.push('Medications');
        if (previsitData.lab_results) dataFields.push('Lab Results');
        if (previsitData.vitals) dataFields.push('Vitals');
        if (previsitData.patient_questionnaire) dataFields.push('Questionnaire');
        if (previsitData.insurance_notes) dataFields.push('Insurance');

        console.log(`    Data Entered: ${dataFields.length > 0 ? dataFields.join(', ') : 'None'}`);

        // Show billing info
        console.log('  💰 BILLING:');
        console.log(`    E/M Code: ${previsitData.em_code || 'Not set'}`);
        console.log(`    Copay: ${previsitData.copay_amount ? '$' + previsitData.copay_amount : 'Not set'}`);
        console.log(`    Patient Paid: ${previsitData.patient_paid ? '✅ YES' : '❌ NO'}`);
        console.log(`    Payment Method: ${previsitData.payment_method || 'N/A'}`);

        // Show AI summary status
        console.log('  🤖 AI SUMMARY:');
        console.log(`    Generated: ${previsitData.ai_summary ? '✅ YES' : '❌ NO'}`);
        if (previsitData.ai_summary) {
          console.log(`    Preview: "${previsitData.ai_summary.substring(0, 100)}..."`);
        }
      } else {
        console.log('  ⚠️  NO PRE-VISIT DATA FOUND');
      }

      console.log('');
    }

    // 3. Check payment requests
    console.log('💳 PAYMENT REQUESTS:\n');
    const { data: payments } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('tshla_id', 'TSH 477-391')
      .order('created_at', { ascending: false });

    if (payments && payments.length > 0) {
      payments.forEach(payment => {
        console.log(`Payment ID: ${payment.id}`);
        console.log(`  Amount: $${(payment.amount_cents / 100).toFixed(2)}`);
        console.log(`  Type: ${payment.payment_type}`);
        console.log(`  Status: ${payment.payment_status}`);
        console.log(`  Created: ${new Date(payment.created_at).toLocaleString()}`);
        if (payment.paid_at) {
          console.log(`  Paid At: ${new Date(payment.paid_at).toLocaleString()}`);
        }
        console.log(`  Appointment ID: ${payment.appointment_id || 'N/A'}`);
        console.log(`  E/M Code: ${payment.em_code || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('  No payment requests found');
      console.log('');
    }

    // 4. Final answer
    console.log('=' .repeat(80));
    console.log('📊 ANSWER TO YOUR QUESTION:');
    console.log('=' .repeat(80));

    const appointmentsWithData = appointments.filter(apt => {
      return previsitData !== null;
    });

    const readyForDictation = await Promise.all(
      appointments.map(async apt => {
        const { data } = await supabase
          .from('previsit_data')
          .select('completed')
          .eq('appointment_id', apt.id)
          .maybeSingle();
        return data?.completed || false;
      })
    );

    const anyReady = readyForDictation.some(ready => ready);

    if (anyReady) {
      console.log('✅ YES - Pre-visit work is COMPLETE and ready for dictation on Monday!');
      console.log('   Staff has entered the data AND generated the AI summary.');
      console.log('   You can create the dictation summary on Monday.');
    } else if (appointments.some(apt => apt.pre_visit_complete === false)) {
      console.log('⚠️  PARTIAL - Pre-visit data may exist but is NOT marked complete.');
      console.log('   Staff needs to click "Generate Summary" to finalize the prep.');
      console.log('   The dictation page may not show the pre-visit data until it\'s marked complete.');
    } else {
      console.log('❌ NO - No pre-visit work has been completed yet.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTSH477391();
