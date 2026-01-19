const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTiana() {
  console.log('🔍 Checking TIANA BERRYMAN Pre-Visit Data\n');
  
  // Find appointment
  const { data: appt, error: apptError } = await supabase
    .from('provider_schedules')
    .select('*')
    .ilike('patient_name', '%TIANA%BERRYMAN%')
    .eq('scheduled_date', '2026-01-19')
    .single();

  if (apptError) {
    console.error('Error finding appointment:', apptError);
    return;
  }

  console.log('📋 Appointment Found:');
  console.log(`   ID: ${appt.id}`);
  console.log(`   Patient: ${appt.patient_name}`);
  console.log(`   Time: ${appt.start_time}`);
  console.log(`   MRN: ${appt.patient_mrn}\n`);

  // Check previsit_data
  const { data: previsit, error: previsitError } = await supabase
    .from('previsit_data')
    .select('*')
    .eq('appointment_id', appt.id)
    .single();

  if (previsitError) {
    console.log('❌ No pre-visit data found');
    return;
  }

  console.log('📊 Pre-Visit Data Status:');
  console.log('─'.repeat(60));
  console.log(`✅ Record Exists: Yes`);
  console.log(`📝 Completed Flag: ${previsit.completed}`);
  console.log(`📅 Created At: ${previsit.created_at}`);
  console.log(`📅 Completed At: ${previsit.completed_at || 'Not set'}`);
  console.log(`📅 AI Summary Generated At: ${previsit.ai_summary_generated_at || 'Not set'}`);
  console.log(`📋 Chief Complaint: ${previsit.chief_complaint || 'None'}`);
  console.log(`🤖 Has AI Summary: ${previsit.ai_summary ? 'Yes (' + previsit.ai_summary.length + ' chars)' : 'No'}`);
  console.log(`💊 Medication Changes: ${previsit.medication_changes || 'None'}`);
  console.log(`🧪 Abnormal Labs: ${previsit.abnormal_labs || 'None'}`);
  console.log('─'.repeat(60));
  
  if (previsit.completed) {
    console.log('\n✅ STATUS: SHOULD BE VISIBLE IN DICTATION');
  } else {
    console.log('\n⚠️  STATUS: NOT VISIBLE - completed flag is FALSE');
    console.log('   Reason: Staff needs to click "Generate AI Summary" button');
    console.log('   (The fix I deployed today should resolve this issue)');
  }
}

checkTiana().catch(console.error);
