#!/usr/bin/env node
/**
 * Investigate Production Database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log('\n🔍 Investigating Production Database...\n');

  // 1. Check unified_patients table structure and data
  console.log('1️⃣ Checking unified_patients table...\n');

  const { data: patients, error: patError } = await supabase
    .from('unified_patients')
    .select('*')
    .limit(5);

  if (patError) {
    console.error('❌ Error:', patError.message);
  } else {
    console.log(`✅ Found ${patients.length} patients in unified_patients table`);
    if (patients.length > 0) {
      console.log('\nSample patient record:');
      console.log(JSON.stringify(patients[0], null, 2));
      console.log('\nColumn names:');
      console.log(Object.keys(patients[0]).join(', '));
    }
  }

  // 2. Check provider_schedules table columns
  console.log('\n\n2️⃣ Checking provider_schedules table structure...\n');

  const { data: schedules, error: schedError } = await supabase
    .from('provider_schedules')
    .select('*')
    .eq('scheduled_date', '2026-01-29')
    .limit(2);

  if (schedError) {
    console.error('❌ Error:', schedError.message);
  } else {
    console.log(`✅ Found ${schedules.length} appointments`);
    if (schedules.length > 0) {
      console.log('\nSample appointment record:');
      console.log(JSON.stringify(schedules[0], null, 2));
      console.log('\nColumn names:');
      console.log(Object.keys(schedules[0]).join(', '));
    }
  }

  // 3. Check if any patients match the schedule patients
  console.log('\n\n3️⃣ Checking for patient matches...\n');

  if (schedules && schedules.length > 0) {
    const firstAppt = schedules[0];
    console.log(`Searching for patient: ${firstAppt.patient_name}`);
    console.log(`MRN from schedule: ${firstAppt.patient_mrn}`);
    console.log(`Phone from schedule: ${firstAppt.patient_phone}`);

    // Try to find by phone
    if (firstAppt.patient_phone) {
      const phone = firstAppt.patient_phone.replace(/\D/g, ''); // Remove formatting
      const { data: phoneMatches } = await supabase
        .from('unified_patients')
        .select('*')
        .eq('phone_primary', phone);

      console.log(`\nMatches by phone: ${phoneMatches?.length || 0}`);
      if (phoneMatches && phoneMatches.length > 0) {
        console.log('Patient ID (TSH_ID):', phoneMatches[0].patient_id);
        console.log('MRN:', phoneMatches[0].mrn);
      }
    }
  }

  // 4. Check what the schedule view component is actually querying
  console.log('\n\n4️⃣ Simulating the component query...\n');

  const { data: componentData, error: componentError } = await supabase
    .from('provider_schedules')
    .select(`
      *,
      unified_patients!provider_schedules_unified_patient_id_fkey (
        id,
        patient_id,
        first_name,
        last_name,
        phone_primary,
        email,
        date_of_birth,
        gender,
        mrn
      )
    `)
    .eq('scheduled_date', '2026-01-29')
    .limit(2);

  if (componentError) {
    console.error('❌ Component query error:', componentError.message);
  } else {
    console.log(`✅ Component query returned ${componentData.length} appointments`);
    if (componentData.length > 0) {
      console.log('\nFirst appointment with joined data:');
      console.log('Appointment ID:', componentData[0].id);
      console.log('Patient Name:', componentData[0].patient_name);
      console.log('Patient MRN (from schedule):', componentData[0].patient_mrn);
      console.log('Unified Patient ID:', componentData[0].unified_patient_id);
      console.log('Joined patient data:', componentData[0].unified_patients);
    }
  }

  // 5. Count total patients
  console.log('\n\n5️⃣ Total counts...\n');

  const { count: patientCount } = await supabase
    .from('unified_patients')
    .select('*', { count: 'exact', head: true });

  const { count: scheduleCount } = await supabase
    .from('provider_schedules')
    .select('*', { count: 'exact', head: true })
    .eq('scheduled_date', '2026-01-29');

  console.log(`Total patients in unified_patients: ${patientCount || 0}`);
  console.log(`Total appointments for 2026-01-29: ${scheduleCount || 0}`);

  console.log('\n✅ Investigation complete!\n');
}

investigate();
