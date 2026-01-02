const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPatient() {
  const { data, error } = await supabase
    .from('diabetes_education_patients')
    .select('*')
    .eq('phone_number', '+18326073630')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📋 Patient Record for +18326073630:\n');
  console.log('Name:', data.first_name, data.last_name);
  console.log('Language:', data.preferred_language);
  console.log('\n📊 Medical Data:', JSON.stringify(data.medical_data, null, 2));
  console.log('\n📝 Clinical Notes:', data.clinical_notes);
  console.log('\n🎯 Focus Areas:', JSON.stringify(data.focus_areas, null, 2));
}

checkPatient();
