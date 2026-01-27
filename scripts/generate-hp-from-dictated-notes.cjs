/**
 * Generate H&P from dictated_notes table
 * Works directly with raw dictation text without copying to dictations table
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');
const { AzureOpenAI } = require('openai');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Azure OpenAI
const azureClient = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01'
});

// AI Extraction Prompt
const EXTRACTION_PROMPT = `ROLE: Medical data extraction specialist

TASK: Extract structured medical information from this dictation. Return JSON only.

Extract:
1. Medications: name, dose, frequency, start_date (if mentioned)
2. Diagnoses: diagnosis, icd10 (if mentioned), status (active/chronic/resolved)
3. Labs: test_name, value, date, unit (A1C, LDL, Urine Microalbumin, Creat, TSH, T4, etc)
4. Vitals: BP (systolic/diastolic), weight, height (with dates)
5. Allergies: allergen, reaction
6. Current Goals: category, goal, target_date

OUTPUT FORMAT (JSON only, no markdown):
{
  "medications": [{"name": "...", "dose": "...", "frequency": "...", "start_date": "..."}],
  "diagnoses": [{"diagnosis": "...", "icd10": "...", "status": "..."}],
  "labs": {"A1C": [{"value": 7.2, "date": "2024-01-15", "unit": "%"}]},
  "vitals": {"Blood Pressure": [{"systolic": 128, "diastolic": 82, "date": "2024-01-15"}]},
  "allergies": [{"allergen": "...", "reaction": "..."}],
  "current_goals": [{"category": "...", "goal": "...", "target_date": "..."}]
}

DICTATION TEXT:
`;

/**
 * Normalize phone number
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.length > 0 ? `+1${digits.slice(-10)}` : null;
}

async function generateHPFromDictatedNotes() {
  console.log('🚀 Starting H&P generation from dictated_notes...\n');

  // 1. Load all dictations
  const { data: dictations, error: dictationsError } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, patient_phone, provider_name, created_at, raw_transcript, processed_note')
    .order('created_at', { ascending: true });

  if (dictationsError) {
    console.error('❌ Error loading dictations:', dictationsError.message);
    return;
  }

  console.log(`📝 Found ${dictations?.length || 0} dictations\n`);

  if (!dictations || dictations.length === 0) {
    console.log('⚠️  No dictations found!\n');
    return;
  }

  // 2. Group by patient
  const patientGroups = {};
  dictations.forEach(dict => {
    const key = dict.patient_phone || 'no-phone';
    if (!patientGroups[key]) {
      patientGroups[key] = {
        phone: dict.patient_phone,
        name: dict.patient_name,
        dictations: []
      };
    }
    patientGroups[key].dictations.push(dict);
  });

  const uniquePatients = Object.values(patientGroups).filter(p => p.phone && p.phone !== 'no-phone');
  console.log(`👥 Found ${uniquePatients.length} patients\n`);
  console.log('=' .repeat(70) + '\n');

  // 3. Process each patient
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (const patient of uniquePatients) {
    console.log(`\n🔄 ${patient.name} (${patient.phone})`);
    console.log(`   Dictations: ${patient.dictations.length}`);

    try {
      // Normalize phone number
      const normalizedPhone = normalizePhone(patient.phone);
      if (!normalizedPhone) {
        console.log(`   ⚠️  Invalid phone number: ${patient.phone}, skipping...`);
        failCount++;
        continue;
      }

      // Get TSHLA ID
      const { data: existingPatient } = await supabase
        .from('unified_patients')
        .select('tshla_id, first_name, last_name')
        .eq('phone_primary', normalizedPhone)
        .maybeSingle();

      let tshlaId = existingPatient?.tshla_id;

      if (!tshlaId) {
        console.log(`   ⚠️  No TSHLA ID found for ${normalizedPhone}, skipping...`);
        failCount++;
        continue;
      }

      // Combine all dictations for this patient
      const allDictationText = patient.dictations
        .map(d => {
          const text = d.processed_note || d.raw_transcript || '';
          const date = d.created_at?.substring(0, 10) || 'unknown date';
          return `[Visit ${date}]\n${text}`;
        })
        .join('\n\n---\n\n');

      console.log(`   📄 Processing ${allDictationText.length} characters of dictation text...`);

      // Extract structured data using AI
      const extractedData = await extractWithAI(allDictationText);

      // Save to patient_comprehensive_chart
      const { error: saveError } = await supabase
        .from('patient_comprehensive_chart')
        .upsert({
          patient_phone: normalizedPhone,
          tshla_id: tshlaId,
          demographics: {
            name: existingPatient?.first_name && existingPatient?.last_name
              ? `${existingPatient.first_name} ${existingPatient.last_name}`
              : patient.name
          },
          medications: extractedData.medications || [],
          diagnoses: extractedData.diagnoses || [],
          allergies: extractedData.allergies || [],
          labs: extractedData.labs || {},
          vitals: extractedData.vitals || {},
          current_goals: extractedData.current_goals || [],
          family_history: [],
          social_history: {},
          external_documents: [],
          full_hp_narrative: '',
          last_ai_generated: new Date().toISOString(),
          version: 1
        }, {
          onConflict: 'patient_phone'
        });

      if (saveError) {
        throw new Error(`Failed to save H&P: ${saveError.message}`);
      }

      successCount++;
      console.log(`   ✅ H&P created`);
      console.log(`      Medications: ${extractedData.medications?.length || 0}`);
      console.log(`      Diagnoses: ${extractedData.diagnoses?.length || 0}`);
      console.log(`      Labs: ${Object.keys(extractedData.labs || {}).length}`);

    } catch (error) {
      failCount++;
      const errorMsg = `${patient.name} (${patient.phone}): ${error.message}`;
      errors.push(errorMsg);
      console.error(`   ❌ ${error.message}`);
    }

    // Rate limit - pause between patients
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 4. Summary
  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 SUMMARY:\n');
  console.log(`Total patients: ${uniquePatients.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);

  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS:\n');
    errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
  }

  console.log('\n' + '=' .repeat(70));
  console.log('\n🎯 NEXT STEPS:\n');
  console.log('1. Run: scripts/check-89-patients.cjs');
  console.log('2. Run: scripts/sync-hp-meds-to-portal.cjs\n');

  return { total: uniquePatients.length, success: successCount, failed: failCount, errors };
}

/**
 * Extract structured data using Azure OpenAI
 */
async function extractWithAI(dictationText) {
  try {
    const response = await azureClient.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a medical data extraction specialist. Return only valid JSON.' },
        { role: 'user', content: EXTRACTION_PROMPT + dictationText }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    let content = response.choices[0].message.content;

    // Remove markdown code blocks if present
    if (content.includes('```')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const extracted = JSON.parse(content.trim());
    return extracted;

  } catch (error) {
    console.error(`   ⚠️  AI extraction error: ${error.message}`);
    // Return empty structure on error
    return {
      medications: [],
      diagnoses: [],
      labs: {},
      vitals: {},
      allergies: [],
      current_goals: []
    };
  }
}

// Run
generateHPFromDictatedNotes()
  .then(stats => {
    process.exit(stats && stats.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
