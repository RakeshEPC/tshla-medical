/**
 * Import today's schedule for R Patel
 * Run: VITE_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/import-todays-schedule.cjs
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// R Patel's provider ID from the parser mapping
const PROVIDER_ID = '652d519e-1d9d-4cdb-9768-111d4ccc03da';
const PROVIDER_NAME = 'Dr. Rakesh Patel';

// Today's date
const today = new Date().toISOString().split('T')[0];

// Today's schedule for R Patel
const appointments = [
  {
    time: '13:00:00',
    patient_name: 'Douglas Peters',
    age: 83,
    gender: 'M',
    dob: '1942-10-31',
    reason: 'follow up',
    duration: 15
  },
  {
    time: '13:15:00',
    patient_name: 'Teresa Seay',
    age: 58,
    gender: 'F',
    dob: '1967-05-28',
    reason: 'Biopsy per Dr Chamakkala',
    duration: 15
  },
  {
    time: '13:30:00',
    patient_name: 'Jefferson Udall',
    age: 48,
    gender: 'M',
    dob: '1978-01-11',
    reason: '3 month follow up; 3 month follow up',
    duration: 15
  },
  {
    time: '13:30:00',
    patient_name: 'Gail Kennedy',
    age: 67,
    gender: 'F',
    dob: '1958-08-22',
    reason: '6 week follow up',
    duration: 15
  },
  {
    time: '14:00:00',
    patient_name: 'Teresa Riley',
    age: 56,
    gender: 'F',
    dob: '1969-06-21',
    reason: '4 month f/up; F/up-15 mins',
    duration: 15
  },
  {
    time: '14:15:00',
    patient_name: 'Kathleen McQueen',
    age: 63,
    gender: 'F',
    dob: '1962-03-15',
    reason: 'f/up 15mins OV - PT of Dr Butler; last seen Jan 2024',
    duration: 15
  },
  {
    time: '14:30:00',
    patient_name: 'Steve C Frost',
    age: 52,
    gender: 'M',
    dob: '1973-03-17',
    reason: 'F/U Hypertensive disorder, Hypoglycemia due to type 2 diabetes mellitus, Mixed hyperlipidemia, Disorder of pituitary gland PREPPED',
    duration: 15
  },
  {
    time: '15:00:00',
    patient_name: 'Federico Amezaga Epalza',
    age: 71,
    gender: 'M',
    dob: '1954-05-12',
    reason: '1 month follow up',
    duration: 15
  },
  {
    time: '15:00:00',
    patient_name: 'Deepak L Patel',
    age: 70,
    gender: 'M',
    dob: '1955-11-25',
    reason: '6 month f/up-15 mins; F/up-15 mins',
    duration: 15
  },
  {
    time: '15:15:00',
    patient_name: 'Quyen Ho',
    age: 45,
    gender: 'F',
    dob: '1980-03-22',
    reason: 'F/up-15 mins',
    duration: 15
  },
  {
    time: '15:30:00',
    patient_name: 'William Talbott',
    age: 63,
    gender: 'M',
    dob: '1962-11-12',
    reason: 'FOLLOW UP; FOLLOW UP',
    duration: 15
  },
  {
    time: '15:45:00',
    patient_name: 'Mohammad R Bhuiyan',
    age: 48,
    gender: 'M',
    dob: '1977-07-02',
    reason: 'f/u 30 mins ok per dr patel; follow up',
    duration: 15
  },
  {
    time: '16:15:00',
    patient_name: 'Sarah N Wehe',
    age: 29,
    gender: 'F',
    dob: '1996-09-25',
    reason: 'Privia Virtual Visit',
    duration: 30
  }
];

async function importSchedule() {
  console.log(`\n📅 Importing schedule for ${PROVIDER_NAME} on ${today}`);
  console.log(`Total appointments: ${appointments.length}\n`);

  // First, delete existing appointments for this provider on this date (replace mode)
  console.log('🗑️  Clearing existing appointments for this date...');
  const { error: deleteError } = await supabase
    .from('appointments')
    .delete()
    .eq('appointment_date', today)
    .eq('provider_id', PROVIDER_ID);

  if (deleteError) {
    console.error('❌ Error clearing existing appointments:', deleteError.message);
    return;
  }

  console.log('✅ Cleared existing appointments\n');

  // Insert new appointments
  let successCount = 0;
  let errorCount = 0;

  for (const apt of appointments) {
    const appointmentData = {
      provider_id: PROVIDER_ID,
      provider_name: PROVIDER_NAME,
      appointment_date: today,
      appointment_time: apt.time,
      duration_minutes: apt.duration,
      patient_name: apt.patient_name,
      patient_age: apt.age,
      patient_gender: apt.gender,
      patient_dob: apt.dob,
      visit_reason: apt.reason,
      status: 'scheduled',
      imported_by: 'admin@tshla.ai',
      import_source: 'manual_script'
    };

    const { error } = await supabase
      .from('appointments')
      .insert(appointmentData);

    if (error) {
      console.error(`❌ ${apt.time} - ${apt.patient_name}: ${error.message}`);
      errorCount++;
    } else {
      console.log(`✅ ${apt.time} - ${apt.patient_name}`);
      successCount++;
    }
  }

  console.log(`\n📊 Import Summary:`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${appointments.length}`);
}

importSchedule().catch(console.error);
