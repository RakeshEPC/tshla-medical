#!/usr/bin/env node

/**
 * Process Quest Diagnostics lab uploads
 * Extracts lab values from Quest text format
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function extractQuestLabs(text) {
  console.log('🔬 Extracting Quest Diagnostics labs...');

  const labs = [];
  const lines = text.split('\n');

  let currentTest = null;
  let currentValue = null;
  let currentRefRange = null;
  let currentUnit = null;
  let currentStatus = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and headers
    if (!line || line.startsWith('Note to Patient') || line.startsWith('Ordering Provider')) continue;

    // Look for lab result pattern: TEST_NAME value range unit status
    // Examples:
    // GLUCOSE 209 65-99 MG/DL HIGH Final RGA
    // HEMOGLOBIN A1C 6.9 <5.7 % HIGH Final RGA

    const labMatch = line.match(/^([A-Z][A-Z\s,\/-]+?)\s+(\d+\.?\d*|\w+)\s+([\d<>\.=\-\s]+)\s+([A-Z\/\s\(\)]+?)\s+(NORMAL|HIGH|LOW|SEE NOTE)/);

    if (labMatch) {
      const testName = labMatch[1].trim();
      const value = labMatch[2];
      const refRange = labMatch[3].trim();
      const unit = labMatch[4].trim();
      const status = labMatch[5];

      // Filter out invalid entries
      if (testName.length > 3 && !testName.includes('Final') && !testName.includes('Report')) {
        labs.push({
          name: testName.substring(0, 100), // Limit name length
          value: String(value).substring(0, 50), // Limit value length
          unit: unit.substring(0, 20), // Limit unit length
          reference_range: refRange.substring(0, 50), // Limit ref range
          status: status.substring(0, 20), // Limit status
          date: new Date().toISOString().substring(0, 10) // Just the date, not time
        });
      }
    }
  }

  console.log(`   ✅ Extracted ${labs.length} lab results`);

  if (labs.length > 0) {
    console.log('   First few labs:');
    labs.slice(0, 5).forEach(lab => {
      console.log(`      ${lab.name}: ${lab.value} ${lab.unit} (${lab.status})`);
    });
  }

  return labs;
}

function extractMedications(text) {
  console.log('💊 Extracting medications...');

  const meds = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Look for "Renew" pattern
    const renewMatch = line.match(/Renew\s+([^$]+)/i);
    if (renewMatch) {
      const medText = renewMatch[1].trim();

      // Parse medication name and dosage
      // Examples:
      // "atorvastatin 40 mg tablet"
      // "Mounjaro 2.5 mg/0.5 mL subcutaneous pen injector"

      const parts = medText.match(/^([A-Za-z\s]+?)\s+([\d\.\/]+\s*mg[\/mL]*)/);

      if (parts) {
        meds.push({
          name: parts[1].trim(),
          dosage: parts[2].trim(),
          frequency: '',
          route: medText.includes('subcutaneous') ? 'Subcutaneous' : medText.includes('tablet') ? 'Oral' : '',
          sig: `Renew ${medText}`,
          status: 'active'
        });
      }
    }
  }

  console.log(`   ✅ Extracted ${meds.length} medications`);
  return meds;
}

function extractDiagnoses(text) {
  console.log('🏥 Extracting diagnoses...');

  const diagnoses = [];
  const commonDiagnoses = [
    'diabetes mellitus',
    'hypertension',
    'hyperlipidemia',
    'retinopathy'
  ];

  const lowerText = text.toLowerCase();

  for (const dx of commonDiagnoses) {
    if (lowerText.includes(dx)) {
      // Find the full diagnosis text
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes(dx) && line.trim().length > 10 && line.trim().length < 200) {
          diagnoses.push({
            name: line.trim(),
            status: 'active'
          });
          break;
        }
      }
    }
  }

  console.log(`   ✅ Extracted ${diagnoses.length} diagnoses`);
  return diagnoses;
}

async function saveToHP(patientId, tshlaId, extractedData) {
  console.log('\n💾 Saving to H&P...');

  // Get existing HP or create structure
  const { data: existingHP } = await supabase
    .from('patient_comprehensive_chart')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  // Normalize TSH ID to correct format "TSH XXX-XXX"
  let normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase(); // Remove spaces/dashes
  if (normalizedTshId.match(/^TSH(\d{6})$/)) {
    // Convert TSH123456 to TSH 123-456
    normalizedTshId = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
  }

  let hpData = existingHP || {
    patient_id: patientId,
    tshla_id: normalizedTshId,
    unified_patient_id: patientId,
    diagnoses: [],
    medications: [],
    labs: [],
    allergies: [],
    current_goals: [],
    vitals: null,
    last_updated: new Date().toISOString(),
    version: 0
  };

  let saved = { diagnoses: 0, medications: 0, labs: 0 };

  // Add labs (always add new results)
  if (extractedData.labs && extractedData.labs.length > 0) {
    const existingLabs = hpData.labs || [];
    extractedData.labs.forEach(lab => {
      existingLabs.push({
        ...lab,
        imported_at: new Date().toISOString()
      });
      saved.labs++;
    });
    hpData.labs = existingLabs;
  }

  // Add medications (avoid duplicates)
  if (extractedData.medications && extractedData.medications.length > 0) {
    const existingMeds = hpData.medications || [];
    extractedData.medications.forEach(med => {
      if (!existingMeds.some(m => m.name.toLowerCase() === med.name.toLowerCase())) {
        existingMeds.push(med);
        saved.medications++;
      }
    });
    hpData.medications = existingMeds;
  }

  // Add diagnoses (avoid duplicates)
  if (extractedData.diagnoses && extractedData.diagnoses.length > 0) {
    const existingDx = hpData.diagnoses || [];
    extractedData.diagnoses.forEach(dx => {
      if (!existingDx.some(d => d.name.toLowerCase() === dx.name.toLowerCase())) {
        existingDx.push(dx);
        saved.diagnoses++;
      }
    });
    hpData.diagnoses = existingDx;
  }

  // Save to database
  if (existingHP) {
    const { error } = await supabase
      .from('patient_comprehensive_chart')
      .update(hpData)
      .eq('id', existingHP.id);

    if (error) throw error;
    console.log('   ✅ Updated existing H&P');
  } else {
    const { error } = await supabase
      .from('patient_comprehensive_chart')
      .insert(hpData);

    if (error) throw error;
    console.log('   ✅ Created new H&P');
  }

  console.log('   📊 Saved:');
  console.log('      Diagnoses:', saved.diagnoses);
  console.log('      Medications:', saved.medications);
  console.log('      Labs:', saved.labs);

  return saved;
}

async function processUpload(uploadId) {
  console.log(`\n🔄 Processing upload: ${uploadId}\n`);

  const { data: upload } = await supabase
    .from('patient_document_uploads')
    .select('*')
    .eq('id', uploadId)
    .single();

  if (!upload) {
    console.error('❌ Upload not found');
    return;
  }

  console.log('📄 Patient:', upload.tshla_id);
  console.log('   Content length:', upload.raw_content?.length || 0);
  console.log('');

  const extractedData = {
    labs: extractQuestLabs(upload.raw_content),
    medications: extractMedications(upload.raw_content),
    diagnoses: extractDiagnoses(upload.raw_content)
  };

  await saveToHP(upload.patient_id, upload.tshla_id, extractedData);

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
}

const uploadId = process.argv[2];
if (uploadId) {
  processUpload(uploadId).catch(console.error);
} else {
  console.log('Usage: node process-quest-labs.cjs <upload-id>');
}
