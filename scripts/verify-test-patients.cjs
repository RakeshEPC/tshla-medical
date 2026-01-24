const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyPatients() {
  console.log('🔍 Checking test patients in database...\n');
  
  const testPatients = [
    { tshla_id: 'TSH 123-001', phone: '+18325551001' },
    { tshla_id: 'TSH 123-002', phone: '+18325551002' },
    { tshla_id: 'TSH 123-003', phone: '+18325551003' }
  ];

  for (const test of testPatients) {
    console.log(`📋 Checking: ${test.tshla_id}`);
    
    // Check in unified_patients
    const { data: patient, error } = await supabase
      .from('unified_patients')
      .select('id, tshla_id, phone_primary, first_name, last_name')
      .eq('tshla_id', test.tshla_id)
      .single();

    if (error) {
      console.log(`   ❌ Not found in unified_patients: ${error.message}`);
      
      // Try by phone
      const { data: byPhone } = await supabase
        .from('unified_patients')
        .select('id, tshla_id, phone_primary, first_name, last_name')
        .eq('phone_primary', test.phone)
        .single();
      
      if (byPhone) {
        console.log(`   ⚠️  Found by phone but TSH ID is: "${byPhone.tshla_id}"`);
      }
    } else {
      console.log(`   ✅ Found: ${patient.first_name} ${patient.last_name}`);
      console.log(`      Phone: ${patient.phone_primary}`);
      console.log(`      TSH ID: "${patient.tshla_id}"`);
      
      // Check H&P
      const { data: hp } = await supabase
        .from('patient_comprehensive_chart')
        .select('patient_phone, tshla_id')
        .eq('patient_phone', patient.phone_primary)
        .single();
      
      if (hp) {
        console.log(`      ✅ H&P exists`);
      } else {
        console.log(`      ❌ H&P missing`);
      }
    }
    console.log('');
  }
}

verifyPatients().catch(console.error);
