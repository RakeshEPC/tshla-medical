const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log('🔍 COMPREHENSIVE SYSTEM ARCHITECTURE ANALYSIS\n');
  console.log('=' .repeat(80) + '\n');

  // 1. Patient Tables
  console.log('📊 PATIENT TABLES:\n');

  const { count: unifiedCount } = await supabase.from('unified_patients').select('*', { count: 'exact', head: true });
  const { count: portalUsersCount } = await supabase.from('pump_users').select('*', { count: 'exact', head: true });

  console.log('  unified_patients:', unifiedCount || 0, 'patients');
  console.log('  pump_users (patient portal):', portalUsersCount || 0, 'patients\n');

  // 2. Dictation Tables
  console.log('📝 DICTATION TABLES:\n');

  const { count: dictatedNotes } = await supabase.from('dictated_notes').select('*', { count: 'exact', head: true });
  const { count: dictations } = await supabase.from('dictations').select('*', { count: 'exact', head: true });

  console.log('  dictated_notes:', dictatedNotes || 0, 'records');
  console.log('  dictations:', dictations || 0, 'records\n');

  // 3. H&P and Medication Tables
  console.log('💊 H&P AND MEDICATION TABLES:\n');

  const { count: hpCharts } = await supabase.from('patient_comprehensive_chart').select('*', { count: 'exact', head: true });
  const { count: patientMeds } = await supabase.from('patient_medications').select('*', { count: 'exact', head: true });

  console.log('  patient_comprehensive_chart:', hpCharts || 0, 'charts');
  console.log('  patient_medications:', patientMeds || 0, 'medications\n');

  // 4. Sample Data Analysis
  console.log('🔎 SAMPLE DATA FROM EACH TABLE:\n');

  // Unified Patients
  const { data: sampleUnified } = await supabase
    .from('unified_patients')
    .select('tshla_id, first_name, last_name, phone_primary, patient_id, mrn, created_from')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('  unified_patients samples (most recent):');
  sampleUnified?.forEach(p => {
    console.log(`    ${p.tshla_id} | ${p.first_name} ${p.last_name} | phone: ${p.phone_primary} | patient_id: ${p.patient_id} | mrn: ${p.mrn} | from: ${p.created_from}`);
  });

  // Portal Users
  const { data: samplePortal } = await supabase
    .from('pump_users')
    .select('id, name, phone, tshla_id')
    .limit(5);

  console.log('\n  pump_users (portal) samples:');
  samplePortal?.forEach(p => {
    console.log(`    id: ${p.id} | ${p.name} | phone: ${p.phone} | tshla_id: ${p.tshla_id}`);
  });

  // H&P Charts
  const { data: sampleHP } = await supabase
    .from('patient_comprehensive_chart')
    .select('tshla_id, patient_phone, medications')
    .limit(5);

  console.log('\n  patient_comprehensive_chart samples:');
  sampleHP?.forEach(hp => {
    const medCount = hp.medications ? hp.medications.length : 0;
    console.log(`    ${hp.tshla_id} | phone: ${hp.patient_phone} | meds: ${medCount}`);
  });

  // Patient Medications
  const { data: sampleMeds } = await supabase
    .from('patient_medications')
    .select('tshla_id, patient_id, medication_name, source')
    .limit(5);

  console.log('\n  patient_medications samples:');
  sampleMeds?.forEach(m => {
    console.log(`    tshla: ${m.tshla_id} | patient_id: ${m.patient_id} | med: ${m.medication_name} | source: ${m.source}`);
  });

  console.log('\n' + '=' .repeat(80));
  console.log('\n🎯 DANIEL DAUES CASE STUDY:\n');

  const { data: daniels } = await supabase
    .from('unified_patients')
    .select('tshla_id, patient_id, phone_primary, created_from')
    .ilike('first_name', 'DANIEL')
    .ilike('last_name', 'DAUES');

  console.log('  Found in unified_patients:', daniels?.length || 0);
  daniels?.forEach(d => {
    console.log(`    ${d.tshla_id} | patient_id: ${d.patient_id} | phone: ${d.phone_primary} | from: ${d.created_from}`);
  });

  // Check each Daniel in other tables
  for (const daniel of daniels || []) {
    console.log(`\n  Checking ${daniel.tshla_id}:`);

    const { data: portalUser } = await supabase
      .from('pump_users')
      .select('id, name, phone')
      .eq('tshla_id', daniel.tshla_id)
      .maybeSingle();
    console.log(`    pump_users: ${portalUser ? 'YES (id: ' + portalUser.id + ')' : 'NO'}`);

    const { data: hp } = await supabase
      .from('patient_comprehensive_chart')
      .select('medications')
      .eq('tshla_id', daniel.tshla_id)
      .maybeSingle();
    const hpMedCount = hp && hp.medications ? hp.medications.length : 0;
    console.log(`    H&P chart: ${hp ? 'YES (' + hpMedCount + ' meds)' : 'NO'}`);

    const { data: meds } = await supabase
      .from('patient_medications')
      .select('id')
      .eq('tshla_id', daniel.tshla_id);
    console.log(`    patient_medications: ${meds?.length || 0} meds`);
  }

  console.log('\n' + '=' .repeat(80));
  console.log('\n🔗 CHECKING patient_id REQUIREMENT:\n');

  // Check if patient_medications requires patient_id
  const { data: medsWithNullPatientId } = await supabase
    .from('patient_medications')
    .select('id, tshla_id, medication_name')
    .is('patient_id', null)
    .limit(5);

  if (medsWithNullPatientId && medsWithNullPatientId.length > 0) {
    console.log('  WARNING: Found medications with NULL patient_id:');
    medsWithNullPatientId.forEach(m => {
      console.log(`    ${m.tshla_id} - ${m.medication_name}`);
    });
  } else {
    console.log('  All medications have patient_id (NOT NULL constraint active)');
  }

  console.log('\n' + '=' .repeat(80));
  console.log('\n💡 KEY FINDINGS:\n');
})();
