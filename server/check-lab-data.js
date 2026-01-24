const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM'
);

async function checkLabData() {
  console.log('🔬 Checking for lab data in uploaded CCD file...\n');
  
  const { data, error } = await supabase
    .from('patient_document_uploads')
    .select('*')
    .eq('id', '0e914079-2a2a-4743-a6bf-dde71d26cb40')
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('📊 Extracted Data from CCD:\n');
  
  const extracted = data.extracted_data;
  
  console.log(`Diagnoses: ${extracted.diagnoses?.length || 0}`);
  if (extracted.diagnoses?.length > 0) {
    extracted.diagnoses.forEach((d, i) => console.log(`  ${i+1}. ${d}`));
  }
  
  console.log(`\nMedications: ${extracted.medications?.length || 0}`);
  if (extracted.medications?.length > 0) {
    extracted.medications.slice(0, 10).forEach((m, i) => console.log(`  ${i+1}. ${m}`));
    if (extracted.medications.length > 10) {
      console.log(`  ... and ${extracted.medications.length - 10} more`);
    }
  }
  
  console.log(`\nAllergies: ${extracted.allergies?.length || 0}`);
  if (extracted.allergies?.length > 0) {
    extracted.allergies.forEach((a, i) => console.log(`  ${i+1}. ${a}`));
  }
  
  console.log(`\nLabs: ${extracted.labs?.length || 0}`);
  if (extracted.labs?.length > 0) {
    extracted.labs.forEach((l, i) => console.log(`  ${i+1}. ${JSON.stringify(l)}`));
  } else {
    console.log('  ⚠️  No lab data extracted');
  }
  
  console.log(`\nProcedures: ${extracted.procedures?.length || 0}`);
  if (extracted.procedures?.length > 0) {
    extracted.procedures.forEach((p, i) => console.log(`  ${i+1}. ${p}`));
  }
  
  console.log(`\nVitals: ${JSON.stringify(extracted.vitals)}`);
  
  // Check raw content for lab-related keywords
  console.log('\n🔍 Searching raw XML for lab-related content...');
  const rawContent = data.raw_content;
  
  const hasResults = rawContent.includes('<component>') && 
                     (rawContent.includes('Result') || rawContent.includes('Laboratory'));
  const hasObservations = rawContent.includes('<observation');
  const hasLOINC = rawContent.includes('2.16.840.1.113883.6.1'); // LOINC code system
  
  console.log(`  Contains result sections: ${hasResults ? '✅' : '❌'}`);
  console.log(`  Contains observations: ${hasObservations ? '✅' : '❌'}`);
  console.log(`  Contains LOINC codes: ${hasLOINC ? '✅' : '❌'}`);
  
  if (hasObservations) {
    const observationMatches = rawContent.match(/<observation[\s\S]*?<\/observation>/g);
    console.log(`  Found ${observationMatches?.length || 0} observation elements`);
  }
}

checkLabData().catch(console.error);
