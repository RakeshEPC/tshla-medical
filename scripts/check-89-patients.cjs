/**
 * Check all 89 patients' dictations and H&P status
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check89Patients() {
  console.log('🔍 Checking all patients with dictations...\n');

  // Get all dictated notes
  const { data: dictatedNotes, error: notesError } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, patient_phone, provider_name, created_at, raw_transcript, processed_note, status')
    .order('created_at', { ascending: false });

  if (notesError) {
    console.error('Error loading dictated_notes:', notesError.message);
    return;
  }

  console.log(`📝 Total dictated notes: ${dictatedNotes?.length || 0}\n`);

  if (!dictatedNotes || dictatedNotes.length === 0) {
    console.log('⚠️  No dictations found in system!\n');
    return;
  }

  // Group by patient phone
  const patientGroups = {};
  dictatedNotes.forEach(note => {
    const key = note.patient_phone || 'no-phone';
    if (!patientGroups[key]) {
      patientGroups[key] = {
        phone: note.patient_phone,
        name: note.patient_name,
        notes: []
      };
    }
    patientGroups[key].notes.push(note);
  });

  const uniquePatients = Object.values(patientGroups);
  console.log(`👥 Unique patients: ${uniquePatients.length}\n`);

  // Check H&P charts
  const { data: hpCharts } = await supabase
    .from('patient_comprehensive_chart')
    .select('patient_phone, tshla_id, medications, version');

  const phonesWithHP = new Set((hpCharts || []).map(h => h.patient_phone));

  // Analyze each patient
  let patientsWithHP = 0;
  let patientsWithoutHP = 0;
  let totalNotes = 0;

  console.log('=' .repeat(70));
  console.log('PATIENT STATUS:\n');

  uniquePatients.forEach((p, i) => {
    const hasHP = phonesWithHP.has(p.phone);
    totalNotes += p.notes.length;

    if (hasHP) {
      patientsWithHP++;
    } else {
      patientsWithoutHP++;
    }

    console.log(`${i + 1}. ${p.name || 'Unknown'} (${p.phone || 'No phone'})`);
    console.log(`   Notes: ${p.notes.length}`);
    console.log(`   H&P: ${hasHP ? '✅ Yes' : '❌ No'}`);
    console.log(`   Latest: ${p.notes[0].created_at?.substring(0, 10)}`);
    console.log('');
  });

  console.log('=' .repeat(70));
  console.log('\n📊 SUMMARY:\n');
  console.log(`Total patients with dictations: ${uniquePatients.length}`);
  console.log(`Total dictation notes: ${totalNotes}`);
  console.log(`Patients WITH H&P: ${patientsWithHP} (✅ ${Math.round(patientsWithHP / uniquePatients.length * 100)}%)`);
  console.log(`Patients WITHOUT H&P: ${patientsWithoutHP} (❌ ${Math.round(patientsWithoutHP / uniquePatients.length * 100)}%)`);

  if (hpCharts) {
    const hpWithMeds = hpCharts.filter(h => h.medications && h.medications.length > 0);
    console.log(`\nH&P Charts with medications: ${hpWithMeds.length} out of ${hpCharts.length}`);
  }

  console.log('\n' + '=' .repeat(70));

  return {
    totalPatients: uniquePatients.length,
    totalNotes: totalNotes,
    withHP: patientsWithHP,
    withoutHP: patientsWithoutHP
  };
}

check89Patients()
  .then(stats => {
    if (stats) {
      console.log('\n🎯 NEXT STEPS:\n');
      if (stats.withoutHP > 0) {
        console.log(`⚠️  Need to generate H&P for ${stats.withoutHP} patients`);
        console.log('   Run: scripts/generate-hp-for-all-dictations.cjs\n');
      }
      if (stats.withHP > 0) {
        console.log(`✅ ${stats.withHP} patients already have H&P`);
        console.log('   Run: scripts/sync-hp-meds-to-portal.cjs to sync medications\n');
      }
    }
  })
  .catch(console.error);
