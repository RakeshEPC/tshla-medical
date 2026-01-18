/**
 * Check ALL pre-visit work done on January 16, 2026
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAllPrevisitWorkJan16() {
  console.log('🔍 Checking ALL Pre-Visit Work from Friday, January 16, 2026');
  console.log('='.repeat(85));
  console.log('');

  try {
    const yesterday = '2026-01-16';

    // Get all previsit records updated yesterday
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
      return;
    }

    console.log(`📋 Found ${previsitRecords.length} pre-visit records updated on Jan 16, 2026\n`);
    console.log('='.repeat(85));
    console.log('');

    // Show detailed timeline
    previsitRecords.forEach((record, index) => {
      const appointment = record.provider_schedules;
      const updatedTime = new Date(record.updated_at);
      const createdTime = new Date(record.created_at);
      const isNewRecord = createdTime.toDateString() === new Date(yesterday).toDateString();

      console.log(`${index + 1}. ${updatedTime.toLocaleTimeString()} - ${appointment?.patient_name || 'Unknown'}`);
      console.log(`   Appt: ${appointment?.scheduled_date} at ${appointment?.start_time}`);
      console.log(`   Provider: ${appointment?.provider_name || 'N/A'}`);
      console.log(`   Created: ${createdTime.toLocaleDateString()} ${createdTime.toLocaleTimeString()}`);
      console.log(`   Updated: ${updatedTime.toLocaleDateString()} ${updatedTime.toLocaleTimeString()}`);
      console.log(`   Uploaded By Staff ID: ${record.uploaded_by_staff_id || 'N/A'}`);

      // Show what data was entered
      const dataFields = [];
      if (record.previous_notes) dataFields.push('Notes');
      if (record.medications_list) dataFields.push('Meds');
      if (record.lab_results) dataFields.push('Labs');
      if (record.vitals) dataFields.push('Vitals');
      if (record.patient_questionnaire) dataFields.push('Questionnaire');
      if (record.insurance_notes) dataFields.push('Insurance');
      if (record.other_documents) dataFields.push('Documents');

      console.log(`   Data Entered: ${dataFields.join(', ') || 'None'}`);

      // Show vitals if present
      if (record.vitals) {
        const v = record.vitals;
        const vitalsInfo = [];
        if (v.bp) vitalsInfo.push(`BP: ${v.bp}`);
        if (v.hr) vitalsInfo.push(`HR: ${v.hr}`);
        if (v.temp) vitalsInfo.push(`T: ${v.temp}`);
        if (v.weight) vitalsInfo.push(`Wt: ${v.weight}`);
        if (v.height) vitalsInfo.push(`Ht: ${v.height}`);
        if (v.bmi) vitalsInfo.push(`BMI: ${v.bmi}`);
        if (vitalsInfo.length > 0) {
          console.log(`   Vitals: ${vitalsInfo.join(', ')}`);
        }
      }

      // Billing
      if (record.em_code || record.copay_amount) {
        const billing = [];
        if (record.em_code) billing.push(`E/M: ${record.em_code}`);
        if (record.copay_amount) billing.push(`Copay: $${record.copay_amount}`);
        if (record.patient_paid) billing.push('PAID ✅');
        console.log(`   Billing: ${billing.join(', ')}`);
      }

      // Status
      console.log(`   AI Summary: ${record.ai_summary ? '✅ YES' : '❌ NO'}`);
      if (record.ai_summary && record.chief_complaint) {
        console.log(`   Chief Complaint: ${record.chief_complaint}`);
      }
      console.log(`   Complete: ${record.completed ? '✅ YES' : '⚠️  DRAFT ONLY'}`);
      if (record.completed_at) {
        console.log(`   Completed At: ${new Date(record.completed_at).toLocaleTimeString()}`);
      }
      console.log('');
    });

    // Summary statistics
    console.log('='.repeat(85));
    console.log('📊 SUMMARY STATISTICS:\n');

    const firstTime = new Date(previsitRecords[0].updated_at);
    const lastTime = new Date(previsitRecords[previsitRecords.length - 1].updated_at);
    const durationMinutes = Math.round((lastTime - firstTime) / (1000 * 60));

    console.log(`⏰ Work Period: ${firstTime.toLocaleTimeString()} - ${lastTime.toLocaleTimeString()}`);
    console.log(`   Duration: ${durationMinutes} minutes (${(durationMinutes / 60).toFixed(1)} hours)`);
    console.log('');

    const completedCount = previsitRecords.filter(r => r.completed).length;
    const withAISummary = previsitRecords.filter(r => r.ai_summary).length;
    const withVitals = previsitRecords.filter(r => r.vitals).length;
    const withBilling = previsitRecords.filter(r => r.em_code || r.copay_amount).length;

    console.log(`📝 Total Records: ${previsitRecords.length}`);
    console.log(`✅ Marked Complete: ${completedCount} (${Math.round(completedCount/previsitRecords.length*100)}%)`);
    console.log(`🤖 AI Summary Generated: ${withAISummary}`);
    console.log(`💉 With Vitals: ${withVitals}`);
    console.log(`💰 With Billing Info: ${withBilling}`);
    console.log(`⚠️  Draft Only: ${previsitRecords.length - completedCount}`);
    console.log('');

    // Provider breakdown
    console.log('='.repeat(85));
    console.log('📅 BREAKDOWN BY PROVIDER:\n');

    const providerStats = {};
    previsitRecords.forEach(record => {
      const provider = record.provider_schedules?.provider_name || 'Unknown';
      if (!providerStats[provider]) {
        providerStats[provider] = {
          total: 0,
          completed: 0,
          withAI: 0
        };
      }
      providerStats[provider].total++;
      if (record.completed) providerStats[provider].completed++;
      if (record.ai_summary) providerStats[provider].withAI++;
    });

    Object.entries(providerStats)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([provider, stats]) => {
        console.log(`${provider}:`);
        console.log(`  Total: ${stats.total} patients`);
        console.log(`  Complete: ${stats.completed} (${Math.round(stats.completed/stats.total*100)}%)`);
        console.log(`  AI Summary: ${stats.withAI}`);
        console.log('');
      });

    // Date breakdown
    console.log('='.repeat(85));
    console.log('📅 BREAKDOWN BY APPOINTMENT DATE:\n');

    const dateStats = {};
    previsitRecords.forEach(record => {
      const date = record.provider_schedules?.scheduled_date || 'Unknown';
      if (!dateStats[date]) {
        dateStats[date] = {
          total: 0,
          completed: 0
        };
      }
      dateStats[date].total++;
      if (record.completed) dateStats[date].completed++;
    });

    Object.entries(dateStats)
      .sort()
      .forEach(([date, stats]) => {
        console.log(`${date}: ${stats.total} patients (${stats.completed} complete)`);
      });
    console.log('');

    // Final answer
    console.log('='.repeat(85));
    console.log('📋 ANSWER TO YOUR QUESTION:\n');

    console.log(`Staff worked on ${previsitRecords.length} patients yesterday (Friday, Jan 16, 2026).`);
    console.log(`Work period: ${durationMinutes} minutes from ${firstTime.toLocaleTimeString()} to ${lastTime.toLocaleTimeString()}`);
    console.log('');

    if (completedCount === 0) {
      console.log('⚠️  CRITICAL: NO appointments were marked as COMPLETE!');
      console.log('');
      console.log('This means:');
      console.log('- Pre-visit data WAS entered and saved as drafts');
      console.log('- But the "Generate Summary" button was NOT clicked');
      console.log('- The dictation page will NOT show this data on Monday');
      console.log('- Staff needs to go back and complete each pre-visit');
    } else if (completedCount < previsitRecords.length) {
      console.log(`⚠️  PARTIAL: ${completedCount}/${previsitRecords.length} appointments completed.`);
      console.log(`   ${previsitRecords.length - completedCount} still need "Generate Summary" clicked.`);
    } else {
      console.log('✅ EXCELLENT: All pre-visit work is complete and ready for Monday!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllPrevisitWorkJan16();
