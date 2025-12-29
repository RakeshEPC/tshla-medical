/**
 * Check if a phone number is registered in diabetes education patients
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET (length ' + (supabaseKey ? supabaseKey.length : 0) + ')' : 'NOT SET');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPatient(phoneNumber) {
  console.log('\n📞 Checking for patient with phone:', phoneNumber);

  const { data, error } = await supabase
    .from('diabetes_education_patients')
    .select('*')
    .eq('phone_number', phoneNumber);

  if (error) {
    console.error('❌ Error querying database:', error);
    return null;
  }

  console.log('\n📋 Results:');
  if (data && data.length > 0) {
    data.forEach(patient => {
      console.log('✅ Found patient:');
      console.log('   ID:', patient.id);
      console.log('   Name:', patient.first_name, patient.last_name);
      console.log('   Phone:', patient.phone_number);
      console.log('   Language:', patient.preferred_language);
      console.log('   Active:', patient.is_active);
      console.log('   Has medical data:', patient.medical_data ? 'Yes' : 'No');
      console.log('   Has clinical notes:', patient.clinical_notes ? 'Yes' : 'No');
      console.log('   Created:', patient.created_at);
    });
    return data[0];
  } else {
    console.log('❌ No patients found for this number');
    return null;
  }
}

async function listAllPatients() {
  console.log('\n📋 Listing all active diabetes education patients...');

  const { data, error } = await supabase
    .from('diabetes_education_patients')
    .select('id, phone_number, first_name, last_name, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log(`\nFound ${data.length} active patient(s):\n`);
    data.forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name} - ${p.phone_number}`);
    });
  } else {
    console.log('\n⚠️  No active patients in database');
  }
}

async function main() {
  const phoneToCheck = process.argv[2] || '+18324003930';

  const patient = await checkPatient(phoneToCheck);

  if (!patient) {
    await listAllPatients();

    console.log('\n💡 To register a new patient:');
    console.log('   1. Go to https://www.tshla.ai/diabetes-education');
    console.log('   2. Log in as medical staff');
    console.log('   3. Click "Add New Patient"');
    console.log('   4. Enter patient info including phone number');
  }

  process.exit(0);
}

main();
