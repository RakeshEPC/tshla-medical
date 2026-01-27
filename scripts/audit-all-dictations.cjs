/**
 * Audit all dictations and check H&P generation status
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllDictations() {
  console.log('🔍 Auditing all dictations and H&P charts...\n');

  // 1. Check saved dictations
  const { data: savedDictations } = await supabase
    .from('saved_dictations')
    .select('id, patient_name, patient_phone, created_at, audio_url, template_type, finalized_text')
    .order('created_at', { ascending: false });

  console.log(`📝 Total saved dictations: ${savedDictations?.length || 0}\n`);

  // 2. Check H&P charts
  const { data: hpCharts } = await supabase
    .from('patient_comprehensive_chart')
    .select('patient_phone, tshla_id, medications, version, last_updated');

  console.log(`📋 Total H&P charts: ${hpCharts?.length || 0}\n`);

  // 3. Find dictations without H&P
  const phonesWithHP = new Set((hpCharts || []).map(h => h.patient_phone));
  const dictationsGrouped = {};

  (savedDictations || []).forEach(d => {
    if (!dictationsGrouped[d.patient_phone]) {
      dictationsGrouped[d.patient_phone] = {
        patient_name: d.patient_name,
        phone: d.patient_phone,
        dictations: [],
        hasHP: phonesWithHP.has(d.patient_phone)
      };
    }
    dictationsGrouped[d.patient_phone].dictations.push({
      id: d.id,
      date: d.created_at,
      template: d.template_type,
      hasAudio: !!d.audio_url,
      hasText: !!d.finalized_text
    });
  });

  const patientsWithDictations = Object.values(dictationsGrouped);
  const patientsWithoutHP = patientsWithDictations.filter(p => !p.hasHP);

  console.log(`👥 Unique patients with dictations: ${patientsWithDictations.length}`);
  console.log(`✅ Patients WITH H&P: ${patientsWithDictations.length - patientsWithoutHP.length}`);
  console.log(`❌ Patients WITHOUT H&P: ${patientsWithoutHP.length}\n`);

  // 4. Show patients without H&P
  if (patientsWithoutHP.length > 0) {
    console.log('⚠️  PATIENTS WITH DICTATIONS BUT NO H&P CHART:\n');
    patientsWithoutHP.forEach((p, i) => {
      console.log(`${i + 1}. ${p.patient_name || 'Unknown'} (${p.phone})`);
      console.log(`   Dictations: ${p.dictations.length}`);
      p.dictations.slice(0, 3).forEach(d => {
        console.log(`   - ${d.date?.substring(0, 10)} | ${d.template || 'N/A'} | Audio: ${d.hasAudio ? 'Yes' : 'No'}`);
      });
      console.log('');
    });
  }

  // 5. Show H&P chart summary
  console.log('\n📊 H&P CHART SUMMARY:\n');
  const hpWithMeds = (hpCharts || []).filter(h => h.medications && h.medications.length > 0);
  console.log(`H&P charts with medications: ${hpWithMeds.length}`);
  console.log(`H&P charts without medications: ${(hpCharts?.length || 0) - hpWithMeds.length}\n`);

  if (hpWithMeds.length > 0) {
    console.log('Patients with medications in H&P:');
    hpWithMeds.forEach((h, i) => {
      console.log(`${i + 1}. ${h.tshla_id || h.patient_phone} - ${h.medications.length} medications`);
    });
  }

  // 6. Action items
  console.log('\n\n📝 ACTION ITEMS:\n');
  if (patientsWithoutHP.length > 0) {
    console.log(`⚠️  ${patientsWithoutHP.length} patients have dictations but NO H&P chart generated`);
    console.log('   This means AI extraction did NOT run after dictation was saved.');
    console.log('   Need to trigger H&P generation for these patients.\n');
  }

  const hpCount = hpCharts?.length || 0;
  console.log(`✅ ${hpCount} patients have H&P charts (AI extraction completed)`);
  console.log(`✅ ${hpWithMeds.length} of those have medications extracted\n`);

  return {
    totalDictations: savedDictations?.length || 0,
    uniquePatients: patientsWithDictations.length,
    patientsWithHP: patientsWithDictations.length - patientsWithoutHP.length,
    patientsWithoutHP: patientsWithoutHP.length,
    hpWithMedications: hpWithMeds.length
  };
}

checkAllDictations()
  .then(stats => {
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY STATISTICS:');
    console.log('='.repeat(60));
    console.log(`Total Dictations: ${stats.totalDictations}`);
    console.log(`Unique Patients: ${stats.uniquePatients}`);
    console.log(`Patients WITH H&P: ${stats.patientsWithHP}`);
    console.log(`Patients WITHOUT H&P: ${stats.patientsWithoutHP}`);
    console.log(`H&P Charts with Meds: ${stats.hpWithMedications}`);
    console.log('='.repeat(60));
  })
  .catch(console.error);
