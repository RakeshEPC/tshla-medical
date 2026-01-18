/**
 * Check if a phone number is registered in diabetes education patients
 * HIPAA COMPLIANT - Uses safe logging (no PHI in production logs)
 */
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Config', 'Missing Supabase credentials');
  logger.info('Config', 'Environment check', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    keyLength: supabaseKey ? supabaseKey.length : 0
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPatient(phoneNumber) {
  // HIPAA: Log operation without PHI (phone number is redacted)
  logger.info('Patient', 'Checking patient registration', {
    phoneProvided: !!phoneNumber
  });

  const { data, error } = await supabase
    .from('diabetes_education_patients')
    .select('*')
    .eq('phone_number', phoneNumber);

  if (error) {
    logger.error('Database', 'Patient query failed', { error: error.message });
    return null;
  }

  // HIPAA: In dev mode (this is a CLI script), show data. In prod, use safe logging
  if (process.env.NODE_ENV === 'production') {
    if (data && data.length > 0) {
      logger.logCount('Patient', 'Found patients', data.length);
      logger.info('Patient', 'Patient found', {
        id: data[0].id,
        isActive: data[0].is_active,
        hasData: !!data[0].medical_data,
        hasNotes: !!data[0].clinical_notes,
        created: data[0].created_at
      });
      return data[0];
    } else {
      logger.info('Patient', 'No patient found for provided phone number');
      return null;
    }
  } else {
    // Development mode - show full data for debugging
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
}

async function listAllPatients() {
  logger.info('Patient', 'Listing active patients');

  const { data, error } = await supabase
    .from('diabetes_education_patients')
    .select('id, phone_number, first_name, last_name, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Database', 'Failed to list patients', { error: error.message });
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    // HIPAA: Production - log count only, no PHI
    logger.logCount('Patient', 'Active patients in database', data?.length || 0);
  } else {
    // Development mode - show full list
    if (data && data.length > 0) {
      console.log(`\nFound ${data.length} active patient(s):\n`);
      data.forEach((p, i) => {
        console.log(`${i + 1}. ${p.first_name} ${p.last_name} - ${p.phone_number}`);
      });
    } else {
      console.log('\n⚠️  No active patients in database');
    }
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
