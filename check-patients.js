require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPatients() {
  console.log('\n📋 Checking diabetes_education_patients table...\n');
  
  const { data, error, count } = await supabase
    .from('diabetes_education_patients')
    .select('*', { count: 'exact' });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`   Total patients: ${count || 0}`);
  
  if (data && data.length > 0) {
    console.log('\n   Patients:');
    data.forEach((p, i) => {
      console.log(`   ${i+1}. ${p.first_name} ${p.last_name}`);
      console.log(`      Phone: ${p.phone_number}`);
      console.log(`      Language: ${p.preferred_language}`);
      console.log(`      Active: ${p.is_active}`);
      console.log(`      Enrolled: ${p.created_at}`);
      console.log('');
    });
  } else {
    console.log('   ✓ Table is empty (as expected)\n');
  }
}

checkPatients().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
