#!/usr/bin/env node

/**
 * Process patient document uploads with AI
 * Extracts: diagnoses, medications, labs, vitals, allergies, goals
 * Saves to appropriate H&P sections
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function extractMedicalDataWithAI(textContent) {
  console.log('🤖 Processing with AI...');
  console.log('   Content length:', textContent.length);

  const prompt = `You are a medical data extraction assistant. Analyze the following medical document and extract all relevant information.

MEDICAL DOCUMENT:
${textContent}

Extract and categorize the information into the following categories. Return ONLY valid JSON with this exact structure:

{
  "diagnoses": [
    {"name": "diagnosis name", "icd10": "code if mentioned", "status": "active"},
    ...
  ],
  "medications": [
    {"name": "medication name", "dosage": "dose", "frequency": "frequency", "route": "route", "sig": "instructions", "status": "active"},
    ...
  ],
  "labs": [
    {"name": "test name", "value": "result value", "unit": "unit", "reference_range": "normal range", "status": "normal/high/low", "date": "test date if mentioned"},
    ...
  ],
  "vitals": {
    "blood_pressure_systolic": null or number,
    "blood_pressure_diastolic": null or number,
    "heart_rate": null or number,
    "temperature": null or number,
    "respiratory_rate": null or number,
    "oxygen_saturation": null or number,
    "weight": null or number,
    "height": null or number,
    "bmi": null or number
  },
  "allergies": [
    {"allergen": "allergen name", "reaction": "reaction description", "severity": "mild/moderate/severe"},
    ...
  ],
  "goals": [
    {"category": "diet/exercise/habits/monitoring/visits", "description": "goal description", "target": "target value or description"},
    ...
  ]
}

IMPORTANT:
- Extract ALL lab results with their values, units, and reference ranges
- For medications, extract dosage, frequency, route, and instructions
- Only include goals if there are explicit patient goals or care plans mentioned
- Use null for any vitals not mentioned
- Return valid JSON only, no other text`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a medical data extraction specialist. Extract structured medical data from documents and return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const extracted = JSON.parse(response.choices[0].message.content);

    console.log('✅ AI extraction complete:');
    console.log('   Diagnoses:', extracted.diagnoses?.length || 0);
    console.log('   Medications:', extracted.medications?.length || 0);
    console.log('   Labs:', extracted.labs?.length || 0);
    console.log('   Allergies:', extracted.allergies?.length || 0);
    console.log('   Goals:', extracted.goals?.length || 0);
    console.log('   Vitals:', Object.keys(extracted.vitals || {}).filter(k => extracted.vitals[k] !== null).length);

    return extracted;

  } catch (error) {
    console.error('❌ AI extraction error:', error.message);
    throw error;
  }
}

async function saveToHP(patientId, tshlaId, extractedData) {
  console.log('\n💾 Saving to H&P...');

  let saved = {
    diagnoses: 0,
    medications: 0,
    labs: 0,
    allergies: 0,
    goals: 0,
    vitals: 0
  };

  // Get existing HP or create new one
  const { data: existingHP } = await supabase
    .from('comprehensive_hp')
    .select('*')
    .eq('patient_id', patientId)
    .eq('tshla_id', tshlaId)
    .maybeSingle();

  let hpData = existingHP || {
    patient_id: patientId,
    tshla_id: tshlaId,
    diagnoses: [],
    medications: [],
    labs: [],
    allergies: [],
    goals: [],
    vitals: {},
    last_updated: new Date().toISOString()
  };

  // Merge diagnoses
  if (extractedData.diagnoses && extractedData.diagnoses.length > 0) {
    const existingDiagnoses = hpData.diagnoses || [];
    extractedData.diagnoses.forEach(newDx => {
      if (!existingDiagnoses.some(dx => dx.name === newDx.name)) {
        existingDiagnoses.push(newDx);
        saved.diagnoses++;
      }
    });
    hpData.diagnoses = existingDiagnoses;
  }

  // Merge medications
  if (extractedData.medications && extractedData.medications.length > 0) {
    const existingMeds = hpData.medications || [];
    extractedData.medications.forEach(newMed => {
      if (!existingMeds.some(med => med.name === newMed.name)) {
        existingMeds.push(newMed);
        saved.medications++;
      }
    });
    hpData.medications = existingMeds;
  }

  // Merge labs (always add new lab results, even for same test)
  if (extractedData.labs && extractedData.labs.length > 0) {
    const existingLabs = hpData.labs || [];
    extractedData.labs.forEach(newLab => {
      existingLabs.push({
        ...newLab,
        imported_at: new Date().toISOString()
      });
      saved.labs++;
    });
    hpData.labs = existingLabs;
  }

  // Merge allergies
  if (extractedData.allergies && extractedData.allergies.length > 0) {
    const existingAllergies = hpData.allergies || [];
    extractedData.allergies.forEach(newAllergy => {
      if (!existingAllergies.some(a => a.allergen === newAllergy.allergen)) {
        existingAllergies.push(newAllergy);
        saved.allergies++;
      }
    });
    hpData.allergies = existingAllergies;
  }

  // Merge goals
  if (extractedData.goals && extractedData.goals.length > 0) {
    const existingGoals = hpData.goals || [];
    extractedData.goals.forEach(newGoal => {
      existingGoals.push({
        ...newGoal,
        created_at: new Date().toISOString(),
        status: 'active'
      });
      saved.goals++;
    });
    hpData.goals = existingGoals;
  }

  // Update vitals (latest values win)
  if (extractedData.vitals) {
    hpData.vitals = {
      ...(hpData.vitals || {}),
      ...Object.fromEntries(
        Object.entries(extractedData.vitals).filter(([_, v]) => v !== null)
      ),
      last_updated: new Date().toISOString()
    };
    saved.vitals = Object.keys(extractedData.vitals).filter(k => extractedData.vitals[k] !== null).length;
  }

  // Save to database
  if (existingHP) {
    const { error } = await supabase
      .from('comprehensive_hp')
      .update(hpData)
      .eq('id', existingHP.id);

    if (error) throw error;
    console.log('   ✅ Updated existing H&P');
  } else {
    const { error } = await supabase
      .from('comprehensive_hp')
      .insert(hpData);

    if (error) throw error;
    console.log('   ✅ Created new H&P');
  }

  console.log('   📊 Saved:');
  console.log('      Diagnoses:', saved.diagnoses);
  console.log('      Medications:', saved.medications);
  console.log('      Labs:', saved.labs);
  console.log('      Allergies:', saved.allergies);
  console.log('      Goals:', saved.goals);
  console.log('      Vitals:', saved.vitals);

  return saved;
}

async function processUpload(uploadId) {
  console.log(`\n🔄 Processing upload: ${uploadId}`);

  // Get upload
  const { data: upload, error } = await supabase
    .from('patient_document_uploads')
    .select('*')
    .eq('id', uploadId)
    .single();

  if (error || !upload) {
    console.error('❌ Upload not found:', error?.message);
    return;
  }

  console.log('📄 Upload info:');
  console.log('   Patient ID:', upload.patient_id);
  console.log('   TSH ID:', upload.tshla_id);
  console.log('   Method:', upload.upload_method);
  console.log('   Date:', upload.uploaded_at);
  console.log('   Content length:', upload.raw_content?.length || 0);

  if (!upload.raw_content) {
    console.log('⚠️  No content to process');
    return;
  }

  // Extract with AI
  const extractedData = await extractMedicalDataWithAI(upload.raw_content);

  // Save to H&P
  const saved = await saveToHP(upload.patient_id, upload.tshla_id, extractedData);

  // Update upload record
  await supabase
    .from('patient_document_uploads')
    .update({
      extracted_data: extractedData,
      processed_at: new Date().toISOString(),
      processing_status: 'completed'
    })
    .eq('id', uploadId);

  console.log('\n✅ Processing complete!');
  return { extractedData, saved };
}

async function processAllPendingUploads() {
  console.log('🔍 Finding pending uploads...\n');

  const { data: uploads } = await supabase
    .from('patient_document_uploads')
    .select('id, patient_id, tshla_id, uploaded_at')
    .is('processed_at', null)
    .order('uploaded_at', { ascending: false })
    .limit(50);

  if (!uploads || uploads.length === 0) {
    console.log('✅ No pending uploads');
    return;
  }

  console.log(`Found ${uploads.length} pending uploads\n`);

  for (const upload of uploads) {
    try {
      await processUpload(upload.id);
    } catch (error) {
      console.error(`❌ Failed to process ${upload.id}:`, error.message);
    }
  }

  console.log('\n✅ All uploads processed!');
}

// Process specific upload or all pending
const uploadId = process.argv[2];

if (uploadId) {
  processUpload(uploadId).catch(console.error);
} else {
  processAllPendingUploads().catch(console.error);
}
