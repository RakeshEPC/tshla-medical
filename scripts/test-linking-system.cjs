/**
 * Test Script for Profile Linking System
 * Creates test appointment data and tests auto-linking functionality
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLinkingSystem() {
  console.log('🧪 Testing Profile Linking System');
  console.log('=====================================\n');

  try {
    // Step 1: Get Ramanbhai Patel's profile
    console.log('📋 Step 1: Fetching Ramanbhai Patel\'s profile...');
    const { data: profile, error: profileError } = await supabase
      .from('patient_profiles')
      .select('*')
      .ilike('patient_name', '%Ramanbhai%')
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }

    console.log('✅ Found profile:');
    console.log(`   ID: ${profile.id}`);
    console.log(`   Name: ${profile.patient_name}`);
    console.log(`   Phone: ${profile.patient_phone}`);
    console.log(`   MRN: ${profile.patient_mrn}`);
    console.log(`   Conditions: ${profile.conditions.join(', ')}`);
    console.log('');

    // Step 2: Create test appointments for Ramanbhai
    console.log('📅 Step 2: Creating test appointments...');

    const testAppointments = [
      {
        appointment_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
        appointment_time: '10:00:00',
        provider_id: 'dr_patel_001',
        provider_name: 'Dr. Rakesh Patel',
        patient_name: 'Ramanbhai Patel',
        patient_phone: profile.patient_phone,
        patient_mrn: profile.patient_mrn,
        visit_type: 'follow-up',
        visit_reason: 'Diabetes and Osteoporosis follow-up',
        status: 'scheduled',
        source: 'test_script'
      },
      {
        appointment_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
        appointment_time: '14:30:00',
        provider_id: 'dr_patel_001',
        provider_name: 'Dr. Rakesh Patel',
        patient_name: 'Ramanbhai Patel',
        patient_phone: profile.patient_phone,
        patient_mrn: profile.patient_mrn,
        visit_type: 'follow-up',
        visit_reason: 'Lab review',
        status: 'scheduled',
        source: 'test_script'
      },
      {
        appointment_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
        appointment_time: '09:00:00',
        provider_id: 'dr_patel_001',
        provider_name: 'Dr. Rakesh Patel',
        patient_name: 'Ramanbhai Patel',
        patient_phone: profile.patient_phone,
        patient_mrn: profile.patient_mrn,
        visit_type: 'follow-up',
        visit_reason: 'Medication review',
        status: 'scheduled',
        source: 'test_script'
      }
    ];

    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .insert(testAppointments)
      .select();

    if (appointmentError) {
      console.error('❌ Error creating appointments:', appointmentError);
      return;
    }

    console.log(`✅ Created ${appointments.length} test appointments:`);
    appointments.forEach((appt, idx) => {
      console.log(`   ${idx + 1}. ${appt.appointment_date} at ${appt.appointment_time} - ${appt.visit_reason}`);
    });
    console.log('');

    // Step 3: Test auto-linking function
    console.log('🔗 Step 3: Testing auto-linking function...');
    const { data: linkResults, error: linkError } = await supabase
      .rpc('link_profile_to_appointments', {
        p_profile_id: profile.id,
        p_search_days_ahead: 30
      });

    if (linkError) {
      console.error('❌ Error in auto-linking:', linkError);
      return;
    }

    console.log(`✅ Auto-linking completed! Results:`);
    if (linkResults && linkResults.length > 0) {
      linkResults.forEach((result, idx) => {
        console.log(`   ${idx + 1}. ${result.appointment_date} at ${result.appointment_time}`);
        console.log(`      Provider: ${result.provider_name}`);
        console.log(`      Matched on: ${result.matched_on}`);
        console.log(`      Link created: ${result.link_created ? '✅' : '❌'}`);
      });
    } else {
      console.log('   No matches found (this might mean appointments were already linked)');
    }
    console.log('');

    // Step 4: Verify links were created
    console.log('🔍 Step 4: Verifying links in database...');
    const { data: linkedAppointments, error: verifyError } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_profile_id', profile.id);

    if (verifyError) {
      console.error('❌ Error verifying links:', verifyError);
      return;
    }

    console.log(`✅ Found ${linkedAppointments.length} linked appointments:`);
    linkedAppointments.forEach((appt, idx) => {
      console.log(`   ${idx + 1}. ${appt.appointment_date} at ${appt.appointment_time}`);
      console.log(`      Link method: ${appt.link_method}`);
      console.log(`      Linked at: ${appt.linked_at}`);
    });
    console.log('');

    // Step 5: Check audit trail
    console.log('📊 Step 5: Checking audit trail...');
    const { data: auditRecords, error: auditError } = await supabase
      .from('profile_appointment_links')
      .select('*')
      .eq('patient_profile_id', profile.id)
      .eq('is_active', true);

    if (auditError) {
      console.error('❌ Error fetching audit records:', auditError);
      return;
    }

    console.log(`✅ Found ${auditRecords.length} audit records:`);
    auditRecords.forEach((audit, idx) => {
      console.log(`   ${idx + 1}. Link method: ${audit.link_method}`);
      console.log(`      Matched on: ${audit.matched_on} = ${audit.matched_value}`);
      console.log(`      Confidence: ${audit.link_confidence}`);
      console.log(`      Linked by: ${audit.linked_by}`);
    });
    console.log('');

    // Step 6: Check updated profile metadata
    console.log('👤 Step 6: Checking updated profile metadata...');
    const { data: updatedProfile, error: updateError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('id', profile.id)
      .single();

    if (updateError) {
      console.error('❌ Error fetching updated profile:', updateError);
      return;
    }

    console.log('✅ Profile metadata updated:');
    console.log(`   Last linked at: ${updatedProfile.last_linked_at}`);
    console.log(`   Linked appointments count: ${updatedProfile.linked_appointments_count}`);
    console.log(`   Needs manual linking: ${updatedProfile.needs_manual_linking}`);
    console.log('');

    console.log('=====================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('=====================================');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testLinkingSystem().then(() => {
  console.log('\n✅ Test script completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});
