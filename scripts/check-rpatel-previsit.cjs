/**
 * Check R Patel's Pre-Visit Work from January 16, 2026
 * Queries Supabase to verify what staff completed yesterday
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkRPatelPreVisit() {
  console.log('🔍 Checking R Patel Pre-Visit Work from Yesterday (Jan 16, 2026)');
  console.log('=' .repeat(80));
  console.log('');

  try {
    // 1. Find appointments for patients with name containing "Patel" or "R Patel"
    console.log('📅 Step 1: Finding R Patel appointments...\n');

    const { data: appointments, error: apptError } = await supabase
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
        pre_visit_staff_id,
        unified_patient_id,
        unified_patients!unified_patient_id (
          patient_id,
          tshla_id,
          phone_primary,
          mrn
        )
      `)
      .ilike('patient_name', '%patel%')
      .gte('scheduled_date', '2026-01-15')
      .lte('scheduled_date', '2026-01-20')
      .order('scheduled_date', { ascending: true });

    if (apptError) {
      console.error('❌ Error fetching appointments:', apptError);
      return;
    }

    if (!appointments || appointments.length === 0) {
      console.log('⚠️  No appointments found for "Patel" between Jan 15-20, 2026');
      console.log('');

      // Try broader search
      console.log('🔍 Trying broader search for all recent appointments...\n');
      const { data: allAppts } = await supabase
        .from('provider_schedules')
        .select('patient_name, scheduled_date')
        .gte('scheduled_date', '2026-01-15')
        .lte('scheduled_date', '2026-01-20')
        .order('scheduled_date', { ascending: true })
        .limit(10);

      if (allAppts && allAppts.length > 0) {
        console.log('📋 Recent appointments found:');
        allAppts.forEach(apt => {
          console.log(`   - ${apt.patient_name} on ${apt.scheduled_date}`);
        });
      }
      return;
    }

    console.log(`✅ Found ${appointments.length} appointment(s) for Patel:\n`);

    // Display appointments
    appointments.forEach((apt, index) => {
      console.log(`Appointment #${index + 1}:`);
      console.log(`  Patient: ${apt.patient_name}`);
      console.log(`  Date: ${apt.scheduled_date} at ${apt.start_time}`);
      console.log(`  Provider: ${apt.provider_name || apt.provider_id}`);
      console.log(`  Appointment ID: ${apt.id}`);
      console.log(`  TSHLA ID: ${apt.unified_patients?.tshla_id || 'N/A'}`);
      console.log(`  MRN: ${apt.unified_patients?.mrn || 'N/A'}`);
      console.log(`  Pre-Visit Complete: ${apt.pre_visit_complete ? '✅ YES' : '❌ NO'}`);
      if (apt.pre_visit_completed_at) {
        console.log(`  Completed At: ${new Date(apt.pre_visit_completed_at).toLocaleString()}`);
      }
      console.log('');
    });

    // 2. Check previsit_data for each appointment
    console.log('📋 Step 2: Checking previsit data details...\n');
    console.log('=' .repeat(80));
    console.log('');

    for (const apt of appointments) {
      console.log(`🔎 Previsit Data for ${apt.patient_name} (Appt ID: ${apt.id})`);
      console.log('-' .repeat(80));

      const { data: previsitData, error: previsitError } = await supabase
        .from('previsit_data')
        .select('*')
        .eq('appointment_id', apt.id)
        .maybeSingle();

      if (previsitError) {
        console.error('❌ Error fetching previsit data:', previsitError);
        continue;
      }

      if (!previsitData) {
        console.log('⚠️  NO PREVISIT DATA FOUND - Staff has not started pre-visit prep');
        console.log('');
        continue;
      }

      // Display previsit data details
      console.log('📝 GENERAL INFO:');
      console.log(`  Created: ${new Date(previsitData.created_at).toLocaleString()}`);
      console.log(`  Last Updated: ${new Date(previsitData.updated_at).toLocaleString()}`);
      console.log(`  Completed: ${previsitData.completed ? '✅ YES - Ready for Dictation' : '⚠️  NO - Only Draft Saved'}`);
      if (previsitData.completed_at) {
        console.log(`  Completed At: ${new Date(previsitData.completed_at).toLocaleString()}`);
      }
      console.log('');

      console.log('📋 STAFF-ENTERED DATA:');
      console.log(`  Previous Notes: ${previsitData.previous_notes ? `✅ (${previsitData.previous_notes.length} chars)` : '❌ Empty'}`);
      console.log(`  Medications: ${previsitData.medications_list ? `✅ (${previsitData.medications_list.length} chars)` : '❌ Empty'}`);
      console.log(`  Lab Results: ${previsitData.lab_results ? `✅ (${previsitData.lab_results.length} chars)` : '❌ Empty'}`);
      console.log(`  Vitals: ${previsitData.vitals ? '✅ Entered' : '❌ Empty'}`);
      if (previsitData.vitals) {
        const vitals = previsitData.vitals;
        console.log(`    - BP: ${vitals.bp || 'N/A'}`);
        console.log(`    - HR: ${vitals.hr || 'N/A'}`);
        console.log(`    - Temp: ${vitals.temp || 'N/A'}`);
        console.log(`    - Weight: ${vitals.weight || 'N/A'}`);
        console.log(`    - Height: ${vitals.height || 'N/A'}`);
        console.log(`    - BMI: ${vitals.bmi || 'N/A'}`);
      }
      console.log(`  Questionnaire: ${previsitData.patient_questionnaire ? `✅ (${previsitData.patient_questionnaire.length} chars)` : '❌ Empty'}`);
      console.log(`  Insurance Notes: ${previsitData.insurance_notes ? `✅ (${previsitData.insurance_notes.length} chars)` : '❌ Empty'}`);
      console.log(`  Other Documents: ${previsitData.other_documents ? `✅ (${previsitData.other_documents.length} chars)` : '❌ Empty'}`);
      console.log('');

      console.log('💰 BILLING INFORMATION:');
      console.log(`  E/M Code: ${previsitData.em_code || '❌ Not Set'}`);
      console.log(`  Copay Amount: ${previsitData.copay_amount ? `$${previsitData.copay_amount}` : '❌ Not Set'}`);
      console.log(`  Amount Charged: ${previsitData.amount_charged ? `$${previsitData.amount_charged}` : '❌ Not Set'}`);
      console.log(`  Patient Paid: ${previsitData.patient_paid ? '✅ YES' : '❌ NO'}`);
      console.log(`  Payment Method: ${previsitData.payment_method || 'N/A'}`);
      console.log(`  Billing Notes: ${previsitData.billing_notes || 'None'}`);
      if (previsitData.billing_updated_at) {
        console.log(`  Billing Updated: ${new Date(previsitData.billing_updated_at).toLocaleString()}`);
      }
      console.log('');

      console.log('🤖 AI-GENERATED CONTENT:');
      console.log(`  AI Summary: ${previsitData.ai_summary ? '✅ Generated' : '❌ Not Generated'}`);
      if (previsitData.ai_summary) {
        console.log(`  Summary Preview: "${previsitData.ai_summary.substring(0, 150)}..."`);
        console.log(`  Generated At: ${previsitData.ai_summary_generated_at ? new Date(previsitData.ai_summary_generated_at).toLocaleString() : 'Unknown'}`);
      }
      console.log(`  Chief Complaint: ${previsitData.chief_complaint || '❌ Not Extracted'}`);
      console.log(`  Medication Changes: ${previsitData.medication_changes ? '✅ Extracted' : '❌ None'}`);
      console.log(`  Abnormal Labs: ${previsitData.abnormal_labs ? '✅ Flagged' : '❌ None'}`);
      console.log('');

      // 3. Check payment request if active_payment_request_id exists
      if (previsitData.active_payment_request_id) {
        console.log('💳 PAYMENT REQUEST:');
        const { data: paymentRequest } = await supabase
          .from('patient_payment_requests')
          .select('*')
          .eq('id', previsitData.active_payment_request_id)
          .single();

        if (paymentRequest) {
          console.log(`  Payment ID: ${paymentRequest.id}`);
          console.log(`  Amount: $${(paymentRequest.amount_cents / 100).toFixed(2)}`);
          console.log(`  Type: ${paymentRequest.payment_type}`);
          console.log(`  Status: ${paymentRequest.payment_status}`);
          console.log(`  Created: ${new Date(paymentRequest.created_at).toLocaleString()}`);
          if (paymentRequest.paid_at) {
            console.log(`  Paid At: ${new Date(paymentRequest.paid_at).toLocaleString()}`);
          }
          console.log(`  Payment Link: ${window?.location?.origin || 'https://www.tshla.ai'}/payment/${paymentRequest.id}`);
        }
        console.log('');
      }

      console.log('=' .repeat(80));
      console.log('');
    }

    // 4. Final Summary
    console.log('📊 SUMMARY:');
    console.log('=' .repeat(80));
    const completedCount = appointments.filter(apt => apt.pre_visit_complete).length;
    const withDataCount = appointments.length; // We'll check this below

    let actualDataCount = 0;
    let readyForDictationCount = 0;

    for (const apt of appointments) {
      const { data: pvData } = await supabase
        .from('previsit_data')
        .select('completed')
        .eq('appointment_id', apt.id)
        .maybeSingle();

      if (pvData) {
        actualDataCount++;
        if (pvData.completed) {
          readyForDictationCount++;
        }
      }
    }

    console.log(`Total Appointments Found: ${appointments.length}`);
    console.log(`Appointments with Pre-Visit Data: ${actualDataCount}`);
    console.log(`Pre-Visit Marked Complete in Schedule: ${completedCount}`);
    console.log(`Pre-Visit Ready for Dictation: ${readyForDictationCount}`);
    console.log('');

    if (readyForDictationCount > 0) {
      console.log('✅ YES - Pre-visit work is COMPLETE and ready for dictation summary on Monday!');
    } else if (actualDataCount > 0) {
      console.log('⚠️  PARTIAL - Pre-visit data was saved as DRAFT but NOT marked complete');
      console.log('   Staff needs to click "Generate Summary" to mark it complete for dictation');
    } else {
      console.log('❌ NO - No pre-visit work has been started yet');
    }
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check
checkRPatelPreVisit();
