/**
 * Generate H&P for MIKLYN PROVENZANO specifically
 */

const { createClient } = require('@supabase/supabase-js');
const { AzureOpenAI } = require('openai');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const azureClient = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-02-01',
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4'
});

const EXTRACTION_PROMPT = `Extract structured medical information from this dictation. Return JSON only.

Extract:
1. Chief complaint
2. Medications: name, dose, frequency
3. Diagnoses: diagnosis, status (active/chronic/resolved)
4. Labs: test_name, value, date, unit
5. Vitals: BP, weight, height
6. Allergies

OUTPUT FORMAT (JSON only):
{
  "chief_complaint": "...",
  "medications": [{"name": "...", "dose": "...", "frequency": "..."}],
  "diagnoses": [{"diagnosis": "...", "status": "active"}],
  "labs": {"A1C": [{"value": 7.2, "date": "2024-01-15", "unit": "%"}]},
  "vitals": {"Blood Pressure": [{"systolic": 128, "diastolic": 82, "date": "2024-01-15"}]},
  "allergies": [{"allergen": "...", "reaction": "..."}]
}

DICTATION:
`;

async function generateHP() {
  console.log('🏥 Generating H&P for MIKLYN PROVENZANO\n');

  // 1. Get patient
  const { data: patient } = await supabase
    .from('unified_patients')
    .select('*')
    .eq('tshla_id', 'TSH 692-273')
    .single();

  if (!patient) {
    console.error('❌ Patient not found');
    return;
  }

  console.log(`✅ Patient: ${patient.first_name} ${patient.last_name}`);
  console.log(`   Phone: ${patient.phone_display}\n`);

  // 2. Get dictation
  const { data: dictation } = await supabase
    .from('dictated_notes')
    .select('*')
    .eq('patient_phone', patient.phone_display)
    .single();

  if (!dictation) {
    console.error('❌ No dictation found');
    return;
  }

  console.log(`✅ Dictation found (ID: ${dictation.id})`);
  console.log(`   Provider: ${dictation.provider_name}`);
  console.log(`   Date: ${dictation.visit_date}\n`);

  const textToProcess = dictation.processed_note || dictation.raw_transcript;
  console.log(`📄 Processing ${textToProcess.length} characters...\n`);

  // 3. Extract with AI
  console.log('🤖 Extracting medical data with AI...');

  const response = await azureClient.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a medical data extraction specialist. Extract structured data and return ONLY valid JSON.'
      },
      {
        role: 'user',
        content: EXTRACTION_PROMPT + textToProcess
      }
    ],
    temperature: 0.1,
    max_tokens: 2000
  });

  const aiResponse = response.choices[0].message.content;
  console.log('✅ AI extraction complete\n');

  // Parse JSON (remove markdown if present)
  let extractedData;
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    extractedData = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
  } catch (e) {
    console.error('❌ JSON parse error:', e.message);
    console.log('Raw response:', aiResponse.substring(0, 500));
    return;
  }

  // 4. Create comprehensive chart
  const chart = {
    patient_phone: patient.phone_primary,
    tshla_id: patient.tshla_id,
    unified_patient_id: patient.id,
    medications: extractedData.medications || [],
    diagnoses: extractedData.diagnoses || [],
    labs: extractedData.labs || {},
    vitals: extractedData.vitals || {},
    allergies: extractedData.allergies || [],
    current_goals: extractedData.current_goals || [],
    demographics: {},
    family_history: [],
    social_history: {},
    external_documents: [],
    patient_editable_sections: ['allergies', 'family_history', 'social_history', 'current_goals'],
    pending_staff_review: false,
    version: 1,
    last_updated: new Date().toISOString(),
    last_ai_generated: new Date().toISOString(),
    full_hp_narrative: extractedData.chief_complaint || null
  };

  console.log('📊 Extracted data:');
  console.log(`   - Chief Complaint: ${chart.full_hp_narrative || 'None'}`);
  console.log(`   - Medications: ${chart.medications.length}`);
  console.log(`   - Diagnoses: ${chart.diagnoses.length}`);
  console.log(`   - Labs: ${Object.keys(chart.labs).length}`);
  console.log(`   - Allergies: ${chart.allergies.length}\n`);

  // 5. Upsert to database
  console.log('💾 Saving to database...');

  const { error } = await supabase
    .from('patient_comprehensive_chart')
    .upsert(chart, {
      onConflict: 'patient_phone'
    });

  if (error) {
    console.error('❌ Database error:', error.message);
    return;
  }

  console.log('✅ H&P chart created successfully!\n');

  // Show some details
  if (chart.diagnoses.length > 0) {
    console.log('📋 Diagnoses:');
    chart.diagnoses.slice(0, 5).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.diagnosis || d.name}`);
    });
    console.log('');
  }

  if (chart.medications.length > 0) {
    console.log('💊 Medications:');
    chart.medications.slice(0, 5).forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.name} ${m.dose || ''} ${m.frequency || ''}`);
    });
    console.log('');
  }

  console.log('🎉 Done! MIKLYN can now view her H&P chart in the patient portal.');
}

generateHP()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
