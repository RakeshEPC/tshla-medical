/**
 * Quick script to register a phone number for diabetes education
 * Usage: node register-diabetes-patient.js "+18324003930" "Test" "User"
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function registerPatient(phoneNumber, firstName, lastName) {
  console.log('\n📝 Registering new diabetes education patient:');
  console.log(`   Phone: ${phoneNumber}`);
  console.log(`   Name: ${firstName} ${lastName}`);

  // Check if already exists
  const { data: existing, error: checkError } = await supabase
    .from('diabetes_education_patients')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  if (existing) {
    console.log('\n⚠️  Patient already registered!');
    console.log('   ID:', existing.id);
    console.log('   Name:', existing.first_name, existing.last_name);
    console.log('   Active:', existing.is_active);
    return existing;
  }

  // Insert new patient
  const { data: patient, error } = await supabase
    .from('diabetes_education_patients')
    .insert({
      phone_number: phoneNumber,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: '1980-01-01', // Default DOB
      preferred_language: 'en',
      is_active: true,
      clinical_notes: 'Test patient account for diabetes education phone system',
      focus_areas: ['general diabetes education']
    })
    .select()
    .single();

  if (error) {
    console.error('\n❌ Error registering patient:', error);
    throw error;
  }

  console.log('\n✅ Patient registered successfully!');
  console.log('   ID:', patient.id);
  console.log('   Phone:', patient.phone_number);
  console.log('   Name:', patient.first_name, patient.last_name);
  console.log('   Language:', patient.preferred_language);
  console.log('   Active:', patient.is_active);

  return patient;
}

async function main() {
  const phoneNumber = process.argv[2];
  const firstName = process.argv[3] || 'Test';
  const lastName = process.argv[4] || 'User';

  if (!phoneNumber) {
    console.error('❌ Usage: node register-diabetes-patient.js "+18324003930" "FirstName" "LastName"');
    process.exit(1);
  }

  // Format phone number to E.164
  let formattedPhone = phoneNumber;
  if (!phoneNumber.startsWith('+')) {
    formattedPhone = `+${phoneNumber.replace(/\D/g, '')}`;
  }

  try {
    await registerPatient(formattedPhone, firstName, lastName);
    console.log('\n🎉 Done! You can now call 832-400-3930 from this number.');
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
