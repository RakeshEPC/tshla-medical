/**
 * Check what staff member Natalya did yesterday (Jan 16, 2026)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkNatalyaWork() {
  console.log('🔍 Checking Natalya\'s Pre-Visit Work from Yesterday (Jan 16, 2026)');
  console.log('='.repeat(85));
  console.log('');

  try {
    // 1. Find Natalya in medical_staff table
    const { data: staffMembers } = await supabase
      .from('medical_staff')
      .select('*')
      .or('full_name.ilike.%natalya%,first_name.ilike.%natalya%,email.ilike.%natalya%');

    if (!staffMembers || staffMembers.length === 0) {
      console.log('⚠️  Staff member "Natalya" not found in medical_staff table');
      console.log('');

      // Try pump_users table
      const { data: pumpUsers } = await supabase
        .from('pump_users')
        .select('*')
        .ilike('username', '%natalya%');

      if (pumpUsers && pumpUsers.length > 0) {
        console.log('Found in pump_users table:');
        pumpUsers.forEach(user => {
          console.log(`  - Username: ${user.username}`);
          console.log(`    ID: ${user.id}`);
          console.log(`    Email: ${user.email || 'N/A'}`);
        });
        console.log('');
      }

      return;
    }

    console.log('👤 STAFF MEMBER(S) FOUND:\n');
    staffMembers.forEach(staff => {
      console.log(`Name: ${staff.full_name || staff.first_name + ' ' + staff.last_name}`);
      console.log(`  ID: ${staff.id}`);
      console.log(`  Email: ${staff.email}`);
      console.log(`  Role: ${staff.role || 'N/A'}`);
      console.log('');
    });

    const staffId = staffMembers[0].id;

    // 2. Find all previsit_data records updated by this staff member yesterday
    const yesterday = '2026-01-16';
    const { data: previsitRecords } = await supabase
      .from('previsit_data')
      .select(`
        *,
        provider_schedules!appointment_id (
          id,
          patient_name,
          scheduled_date,
          start_time,
          provider_name
        )
      `)
      .gte('updated_at', `${yesterday}T00:00:00`)
      .lte('updated_at', `${yesterday}T23:59:59`)
      .order('updated_at', { ascending: true });

    if (!previsitRecords || previsitRecords.length === 0) {
      console.log(`⚠️  No pre-visit records found updated on ${yesterday}`);
      console.log('');

      // Check if any records exist at all
      const { data: anyRecords, count } = await supabase
        .from('previsit_data')
        .select('*', { count: 'exact', head: true });

      console.log(`Total previsit_data records in database: ${count || 0}`);
      return;
    }

    console.log('📋 PRE-VISIT WORK DONE ON FRIDAY, JANUARY 16, 2026:\n');
    console.log(`Total Records Updated: ${previsitRecords.length}`);
    console.log('='.repeat(85));
    console.log('');

    // Group by time to show workflow
    previsitRecords.forEach((record, index) => {
      const appointment = record.provider_schedules;
      const updatedTime = new Date(record.updated_at);
      const createdTime = new Date(record.created_at);
      const isNewRecord = createdTime.toDateString() === new Date(yesterday).toDateString();

      console.log(`${index + 1}. ${appointment?.patient_name || 'Unknown Patient'}`);
      console.log(`   Scheduled: ${appointment?.scheduled_date} at ${appointment?.start_time}`);
      console.log(`   Provider: ${appointment?.provider_name || 'N/A'}`);
      console.log(`   Work Time: ${updatedTime.toLocaleTimeString()}`);
      console.log(`   Action: ${isNewRecord ? '📝 Created new pre-visit' : '✏️  Updated existing pre-visit'}`);

      // Show what was entered
      const entered = [];
      if (record.previous_notes) {
        entered.push(`Notes (${record.previous_notes.length} chars)`);
      }
      if (record.medications_list) {
        entered.push(`Medications (${record.medications_list.length} chars)`);
      }
      if (record.lab_results) {
        entered.push(`Labs (${record.lab_results.length} chars)`);
      }
      if (record.vitals) {
        const v = record.vitals;
        const vitalsList = [];
        if (v.bp) vitalsList.push(`BP: ${v.bp}`);
        if (v.hr) vitalsList.push(`HR: ${v.hr}`);
        if (v.temp) vitalsList.push(`Temp: ${v.temp}`);
        if (v.weight) vitalsList.push(`Wt: ${v.weight}`);
        if (v.height) vitalsList.push(`Ht: ${v.height}`);
        if (v.bmi) vitalsList.push(`BMI: ${v.bmi}`);
        if (vitalsList.length > 0) {
          entered.push(`Vitals (${vitalsList.join(', ')})`);
        }
      }
      if (record.patient_questionnaire) {
        entered.push(`Questionnaire (${record.patient_questionnaire.length} chars)`);
      }
      if (record.insurance_notes) {
        entered.push(`Insurance (${record.insurance_notes.length} chars)`);
      }
      if (record.other_documents) {
        entered.push(`Docs (${record.other_documents.length} chars)`);
      }

      console.log(`   Data: ${entered.length > 0 ? entered.join(', ') : 'None'}`);

      // Billing info
      if (record.em_code || record.copay_amount || record.patient_paid) {
        const billing = [];
        if (record.em_code) billing.push(`E/M: ${record.em_code}`);
        if (record.copay_amount) billing.push(`Copay: $${record.copay_amount}`);
        if (record.patient_paid) billing.push('PAID');
        console.log(`   Billing: ${billing.join(', ')}`);
      }

      // AI Summary status
      console.log(`   AI Summary: ${record.ai_summary ? '✅ Generated' : '❌ Not generated'}`);
      console.log(`   Status: ${record.completed ? '✅ COMPLETE' : '⚠️  DRAFT ONLY'}`);
      console.log('');
    });

    // Timeline summary
    console.log('='.repeat(85));
    console.log('⏰ WORK TIMELINE:\n');

    const firstRecord = new Date(previsitRecords[0].updated_at);
    const lastRecord = new Date(previsitRecords[previsitRecords.length - 1].updated_at);

    console.log(`Started: ${firstRecord.toLocaleTimeString()}`);
    console.log(`Finished: ${lastRecord.toLocaleTimeString()}`);
    console.log(`Duration: ~${Math.round((lastRecord - firstRecord) / (1000 * 60))} minutes`);
    console.log('');

    // Status summary
    const completedCount = previsitRecords.filter(r => r.completed).length;
    const withAISummary = previsitRecords.filter(r => r.ai_summary).length;

    console.log('='.repeat(85));
    console.log('📊 SUMMARY OF NATALYA\'S WORK:\n');
    console.log(`Total Patients Worked On: ${previsitRecords.length}`);
    console.log(`Marked as Complete: ${completedCount} (${Math.round(completedCount/previsitRecords.length*100)}%)`);
    console.log(`AI Summary Generated: ${withAISummary}`);
    console.log(`Draft Only: ${previsitRecords.length - completedCount}`);
    console.log('');

    if (completedCount === 0) {
      console.log('⚠️  IMPORTANT: No appointments were marked as COMPLETE');
      console.log('   This means the pre-visit data will NOT appear in the dictation page on Monday.');
      console.log('   Natalya needs to go back and click "Generate Summary" for each patient.');
    } else if (completedCount < previsitRecords.length) {
      console.log(`⚠️  PARTIAL: ${previsitRecords.length - completedCount} appointment(s) still need to be marked complete.`);
    } else {
      console.log('✅ EXCELLENT: All pre-visit work is complete and ready for dictation on Monday!');
    }

    // Check which provider's schedule was worked on
    console.log('');
    console.log('='.repeat(85));
    console.log('📅 PROVIDERS WORKED ON:\n');

    const providerCounts = {};
    previsitRecords.forEach(record => {
      const provider = record.provider_schedules?.provider_name || 'Unknown';
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    });

    Object.entries(providerCounts).forEach(([provider, count]) => {
      console.log(`  ${provider}: ${count} patients`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkNatalyaWork();
