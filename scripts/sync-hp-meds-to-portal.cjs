/**
 * Sync H&P medications to patient portal
 * This script imports medications from patient_comprehensive_chart to patient_medications table
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncHPMedsToPortal() {
  console.log('🔄 Syncing H&P medications to patient portal...\n');

  // Get all H&P charts with medications
  const { data: hpCharts, error: hpError } = await supabase
    .from('patient_comprehensive_chart')
    .select('patient_phone, tshla_id, medications');

  if (hpError) {
    console.error('Error:', hpError.message);
    return;
  }

  console.log(`Found ${hpCharts?.length || 0} H&P charts\n`);

  let totalImported = 0;
  let totalSkipped = 0;

  for (const chart of hpCharts || []) {
    if (!chart.medications || chart.medications.length === 0) {
      console.log(`⏭️  Skipping ${chart.tshla_id || chart.patient_phone} - no medications`);
      continue;
    }

    // Get patient ID
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('id, tshla_id')
      .eq('phone_primary', chart.patient_phone)
      .maybeSingle();

    if (!patient) {
      console.log(`❌ Patient not found for phone: ${chart.patient_phone}`);
      continue;
    }

    console.log(`\n📋 Processing ${patient.tshla_id || patient.id}`);
    console.log(`   H&P Medications: ${chart.medications.length}`);

    // Get existing medications
    const { data: existingMeds } = await supabase
      .from('patient_medications')
      .select('medication_name, dosage, frequency')
      .eq('patient_id', patient.id);

    const existingSet = new Set(
      (existingMeds || []).map(m =>
        `${m.medication_name?.toLowerCase()}-${m.dosage?.toLowerCase()}-${m.frequency?.toLowerCase()}`
      )
    );

    // Import each medication
    for (const hpMed of chart.medications) {
      const lookupKey = `${hpMed.name?.toLowerCase() || ''}-${hpMed.dose?.toLowerCase() || ''}-${hpMed.frequency?.toLowerCase() || ''}`;

      if (existingSet.has(lookupKey)) {
        totalSkipped++;
        console.log(`   ⏭️  Skipped: ${hpMed.name} (already exists)`);
        continue;
      }

      // Insert medication
      const { error: insertError } = await supabase
        .from('patient_medications')
        .insert({
          patient_id: patient.id,
          tshla_id: patient.tshla_id,
          medication_name: hpMed.name || '',
          dosage: hpMed.dose || hpMed.dosage || '',
          frequency: hpMed.frequency || '',
          route: hpMed.route || 'oral',
          sig: hpMed.sig || `Take ${hpMed.dose || ''} ${hpMed.frequency || ''}`,
          status: hpMed.active === false ? 'prior' : 'active',
          source: 'hp_import',
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.log(`   ❌ Error importing ${hpMed.name}: ${insertError.message}`);
      } else {
        totalImported++;
        console.log(`   ✅ Imported: ${hpMed.name} ${hpMed.dose || ''} ${hpMed.frequency || ''}`);
      }
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   Imported: ${totalImported}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log(`   Total: ${totalImported + totalSkipped}`);
}

syncHPMedsToPortal().catch(console.error);
