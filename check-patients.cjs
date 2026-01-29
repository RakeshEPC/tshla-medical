#!/usr/bin/env node
/**
 * Check Patient Data
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPatients() {
  console.log('\n🔍 Checking Patient Data...\n');

  // Get appointments
  const { data: schedules, error: schedError } = await supabase
    .from('provider_schedules')
    .select('*')
    .eq('scheduled_date', '2026-01-29')
    .eq('provider_name', 'Dr. Rakesh Patel')
    .order('start_time')
    .limit(5);

  if (schedError) {
    console.error('❌ Error fetching schedules:', schedError.message);
    return;
  }

  console.log('📅 Schedule Table Data (first 5):\n');
  schedules.forEach(apt => {
    console.log(`Patient: ${apt.patient_name}`);
    console.log(`  Phone: ${apt.patient_phone || 'NOT SET'}`);
    console.log(`  Email: ${apt.patient_email || 'NOT SET'}`);
    console.log(`  MRN: ${apt.patient_mrn || 'NOT SET'}`);
    console.log(`  DOB: ${apt.patient_dob || 'NOT SET'}`);
    console.log('');
  });

  // Check if patients table exists and has data
  console.log('\n🔍 Checking patients table...\n');

  const { data: patients, error: patError } = await supabase
    .from('patients')
    .select('tsh_id, first_name, last_name, phone, email, athena_patient_id, athena_chart_id, date_of_birth')
    .limit(3);

  if (patError) {
    console.error('❌ Error fetching patients:', patError.message);
    console.log('   (Table may not exist or have different schema)');
  } else {
    console.log(`✅ Patients table exists with ${patients.length} sample records`);
    if (patients.length > 0) {
      console.log('\nSample patient data:');
      console.log(JSON.stringify(patients[0], null, 2));
    }
  }

  // Search for one specific patient
  console.log('\n🔍 Searching for DONNA FORSYTHE in patients table...\n');

  const { data: donnaRecords, error: donnaError } = await supabase
    .from('patients')
    .select('*')
    .or('first_name.ilike.%DONNA%,last_name.ilike.%FORSYTHE%');

  if (!donnaError && donnaRecords) {
    console.log(`Found ${donnaRecords.length} potential matches`);
    if (donnaRecords.length > 0) {
      console.log(JSON.stringify(donnaRecords[0], null, 2));
    }
  }
}

checkPatients();
