/**
 * Comprehensive H&P Generator Service
 * AI-powered extraction and generation of structured patient medical charts
 *
 * This service:
 * 1. Extracts structured data from dictations (meds, diagnoses, labs, vitals)
 * 2. Merges new data into existing H&P
 * 3. Generates comprehensive narrative H&P for AI chat context
 * 4. Tracks changes and flags patient edits for staff review
 *
 * Created: 2026-01-23
 */

const { createClient } = require('@supabase/supabase-js');
const azureOpenAIService = require('./azureOpenAI.service');
const logger = require('./logger.service');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// AI Extraction Prompt Template
const EXTRACTION_PROMPT = `ROLE: Medical data extraction specialist

INPUT:
- Current H&P (structured JSON)
- New visit dictation (if provided)
- Uploaded documents (if provided)
- Patient edits (if provided)

TASK: Extract and structure medical information. Return JSON with updates.

INSTRUCTIONS:
1. Medications: Extract name, dose, frequency, start date
   - If new medication mentioned → add to list
   - If dose changed → update existing
   - If discontinued → mark end_date

2. Diagnoses: Extract diagnosis name, ICD-10 if mentioned
   - Add new diagnoses with date_diagnosed
   - Update status (active, resolved, chronic)

3. Labs: Extract test name, value, date, unit
   - Format: {test_name, value, date, unit}
   - Priority labs: A1C, LDL, Urine Microalbumin/Creat, Serum Creat, TSH, Free T4

4. Vitals: Extract BP (systolic/diastolic), weight
   - Always include date

5. Allergies: Extract allergen and reaction

6. Current Goals: Extract care plan items
   - Format: {category, goal, status}
   - Categories: Diet, Exercise, Habits, Monitoring, Doctor Visits

7. Narrative: Generate 2-3 paragraph summary of patient's current status

OUTPUT FORMAT (JSON):
{
  "medications": {"add": [...], "update": [...], "discontinue": [...]},
  "diagnoses": {"add": [...], "update": [...]},
  "labs": {"add": [...]},
  "vitals": {"add": [...]},
  "allergies": {"add": [...]},
  "current_goals": {"add": [...], "update": [...]},
  "narrative_update": "..."
}

EXAMPLE INPUT (New Dictation):
"Patient returns for diabetes follow-up. A1C improved to 7.2% from 7.5%.
Started on Jardiance 10mg daily. Blood pressure 128/82. Weight 178 lbs,
down 2 lbs. Continue Metformin 1000mg BID. Plan: Repeat labs in 3 months."

EXAMPLE OUTPUT:
{
  "medications": {
    "add": [{"name": "Jardiance", "dose": "10mg", "frequency": "daily", "start_date": "2024-03-14"}],
    "update": [{"name": "Metformin", "dose": "1000mg", "frequency": "BID", "status": "continue"}]
  },
  "diagnoses": {
    "update": [{"diagnosis": "Type 2 Diabetes Mellitus", "status": "active", "notes": "A1C improving"}]
  },
  "labs": {
    "add": [{"test_name": "A1C", "value": 7.2, "date": "2024-03-14", "unit": "%"}]
  },
  "vitals": {
    "add": [
      {"type": "Blood Pressure", "systolic": 128, "diastolic": 82, "date": "2024-03-14"},
      {"type": "Weight", "value": 178, "unit": "lbs", "date": "2024-03-14"}
    ]
  },
  "current_goals": {
    "add": [{"category": "Doctor Visits", "goal": "Repeat labs in 3 months", "target_date": "2024-06-14"}]
  },
  "narrative_update": "Patient with Type 2 Diabetes showing improvement. A1C decreased from 7.5% to 7.2%. Weight loss of 2 lbs. Blood pressure well-controlled at 128/82. Medication regimen optimized with addition of Jardiance. Plan for continued monitoring with labs in 3 months."
}

NOW EXTRACT FROM THE FOLLOWING DATA:
`;

// Narrative H&P Generation Prompt
const NARRATIVE_PROMPT = `ROLE: Medical documentation specialist

TASK: Generate a comprehensive History & Physical (H&P) narrative from structured patient data.

STYLE: Professional medical documentation, patient-friendly language (for AI chat context)

STRUCTURE:
1. Chief Complaint / Currently Working On
2. History of Present Illness
3. Past Medical History
4. Medications (current and discontinued)
5. Allergies
6. Family History
7. Social History
8. Vital Signs (latest + trends)
9. Laboratory Results (latest + trends)
10. Assessment & Plan

Keep concise but comprehensive. Include specific numbers and dates. Highlight trends (improving, stable, worsening).

EXAMPLE OUTPUT:
"Patient is a 49-year-old male with Type 2 Diabetes Mellitus, diagnosed in June 2023. Currently working on reducing carbohydrate intake to 150g/day and walking 30 minutes daily.

His A1C has steadily improved from 7.8% at diagnosis to 7.2% currently (goal <7.0%). Weight has decreased from 185 lbs to 178 lbs over 4 months. Blood pressure is well-controlled at 128/82 mmHg.

Current medications include Metformin 1000mg twice daily and Jardiance 10mg once daily, both taken with meals. Recently started Jardiance in March 2024 with good tolerance. No known drug allergies.

Family history is significant for Type 2 Diabetes in his father (diagnosed at age 55). He is a non-smoker and drinks alcohol occasionally (2 drinks per week). He works as a software engineer and lives with his spouse.

Latest lab results show A1C 7.2%, LDL 95 mg/dL (goal <100), serum creatinine 1.1 mg/dL, and urine microalbumin/creatinine ratio 18 mg/g (well below target of <30).

Plan: Continue current diabetes management. Repeat labs in 3 months. Continue dietary modifications and exercise program. Patient is engaged and motivated to reach A1C goal."

NOW GENERATE NARRATIVE FROM:
`;

/**
 * Main function: Generate or update comprehensive H&P
 * @param {string} patientPhone - Patient's phone number (primary identifier)
 * @param {object} options - Options for H&P generation
 * @param {number} options.newDictationId - New dictation to extract data from
 * @param {object} options.uploadedDocument - External document data
 * @param {object} options.patientEdit - Patient-submitted edits
 * @returns {object} Updated H&P
 */
async function generateOrUpdateHP(patientPhone, options = {}) {
  try {
    logger.info('HPGenerator', 'Starting H&P generation/update', { patientPhone, options });

    // 1. Load current H&P from database
    const currentHP = await loadPatientHP(patientPhone);

    // 2. Load new data sources
    let newDictation = null;
    if (options.newDictationId) {
      newDictation = await loadDictation(options.newDictationId);
    }

    // 3. AI Extraction - Extract structured data
    const extractedData = await extractStructuredData({
      currentHP,
      newDictation,
      uploadedDocument: options.uploadedDocument,
      patientEdit: options.patientEdit
    });

    // 4. Merge extracted data into H&P
    const updatedHP = await mergeHPData(currentHP, extractedData);

    // 5. Generate full narrative H&P (for AI chat context)
    const fullNarrative = await generateNarrativeHP(updatedHP);
    updatedHP.full_hp_narrative = fullNarrative;

    // 6. Save to database
    await savePatientHP(patientPhone, {
      ...updatedHP,
      last_ai_generated: new Date().toISOString(),
      version: currentHP.version + 1
    });

    // 7. Archive original dictation (don't send to AI in future)
    if (options.newDictationId) {
      await archiveDictation(options.newDictationId, patientPhone);
    }

    // 8. Log changes to audit trail
    await logHPChanges(patientPhone, extractedData, 'ai-auto');

    logger.info('HPGenerator', 'H&P generation complete', { patientPhone, version: updatedHP.version });

    return updatedHP;

  } catch (error) {
    logger.error('HPGenerator', 'H&P generation failed', { error: error.message, patientPhone });
    throw error;
  }
}

/**
 * Load current H&P from database
 */
async function loadPatientHP(patientPhone) {
  const { data, error } = await supabase
    .from('patient_comprehensive_chart')
    .select('*')
    .eq('patient_phone', patientPhone)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw new Error(`Failed to load H&P: ${error.message}`);
  }

  // If no H&P exists, create empty one
  if (!data) {
    logger.info('HPGenerator', 'Creating new H&P for patient', { patientPhone });
    return {
      patient_phone: patientPhone,
      tshla_id: '', // Will be set by caller
      demographics: {},
      medications: [],
      diagnoses: [],
      allergies: [],
      family_history: [],
      social_history: {},
      labs: {},
      vitals: {},
      current_goals: [],
      external_documents: [],
      full_hp_narrative: '',
      version: 0
    };
  }

  return data;
}

/**
 * Load dictation from database
 */
async function loadDictation(dictationId) {
  const { data, error } = await supabase
    .from('dictated_notes')
    .select('*')
    .eq('id', dictationId)
    .single();

  if (error) {
    throw new Error(`Failed to load dictation: ${error.message}`);
  }

  return data;
}

/**
 * Extract structured data using Azure OpenAI
 */
async function extractStructuredData(sources) {
  const { currentHP, newDictation, uploadedDocument, patientEdit } = sources;

  // Build context for AI
  let contextText = `CURRENT H&P:\n${JSON.stringify(currentHP, null, 2)}\n\n`;

  if (newDictation) {
    contextText += `NEW DICTATION:\n${newDictation.dictation_text}\n\n`;
  }

  if (uploadedDocument) {
    contextText += `UPLOADED DOCUMENT:\n${uploadedDocument.extractedText}\n\n`;
  }

  if (patientEdit) {
    contextText += `PATIENT EDIT:\nSection: ${patientEdit.section}\nData: ${JSON.stringify(patientEdit.data)}\n\n`;
  }

  // Call Azure OpenAI
  const prompt = EXTRACTION_PROMPT + contextText;

  const response = await azureOpenAIService.generateChatCompletion([
    { role: 'system', content: 'You are a medical data extraction specialist.' },
    { role: 'user', content: prompt }
  ], {
    temperature: 0.3,
    maxTokens: 2000,
    responseFormat: { type: 'json_object' }
  });

  // Parse JSON response
  let extractedData;
  try {
    extractedData = JSON.parse(response.choices[0].message.content);
  } catch (error) {
    logger.error('HPGenerator', 'Failed to parse AI extraction response', { error: error.message });
    throw new Error('AI extraction returned invalid JSON');
  }

  return extractedData;
}

/**
 * Merge extracted data into existing H&P
 */
async function mergeHPData(currentHP, extractedData) {
  const updatedHP = JSON.parse(JSON.stringify(currentHP)); // Deep copy

  // Merge medications
  if (extractedData.medications) {
    if (extractedData.medications.add) {
      updatedHP.medications.push(...extractedData.medications.add);
    }
    if (extractedData.medications.update) {
      for (const update of extractedData.medications.update) {
        const index = updatedHP.medications.findIndex(m => m.name === update.name);
        if (index >= 0) {
          updatedHP.medications[index] = { ...updatedHP.medications[index], ...update };
        }
      }
    }
    if (extractedData.medications.discontinue) {
      for (const disc of extractedData.medications.discontinue) {
        const index = updatedHP.medications.findIndex(m => m.name === disc.name);
        if (index >= 0) {
          updatedHP.medications[index].active = false;
          updatedHP.medications[index].end_date = disc.end_date || new Date().toISOString().split('T')[0];
        }
      }
    }
  }

  // Merge diagnoses
  if (extractedData.diagnoses) {
    if (extractedData.diagnoses.add) {
      updatedHP.diagnoses.push(...extractedData.diagnoses.add);
    }
    if (extractedData.diagnoses.update) {
      for (const update of extractedData.diagnoses.update) {
        const index = updatedHP.diagnoses.findIndex(d => d.diagnosis === update.diagnosis);
        if (index >= 0) {
          updatedHP.diagnoses[index] = { ...updatedHP.diagnoses[index], ...update };
        }
      }
    }
  }

  // Merge labs (append to arrays, keeping history)
  if (extractedData.labs && extractedData.labs.add) {
    for (const lab of extractedData.labs.add) {
      if (!updatedHP.labs[lab.test_name]) {
        updatedHP.labs[lab.test_name] = [];
      }
      // Add if not duplicate (same date)
      const exists = updatedHP.labs[lab.test_name].some(
        existing => existing.date === lab.date && existing.value === lab.value
      );
      if (!exists) {
        updatedHP.labs[lab.test_name].push({
          value: lab.value,
          date: lab.date,
          unit: lab.unit
        });
        // Sort by date descending
        updatedHP.labs[lab.test_name].sort((a, b) => new Date(b.date) - new Date(a.date));
      }
    }
  }

  // Merge vitals (append to arrays, keeping history)
  if (extractedData.vitals && extractedData.vitals.add) {
    for (const vital of extractedData.vitals.add) {
      if (!updatedHP.vitals[vital.type]) {
        updatedHP.vitals[vital.type] = [];
      }
      updatedHP.vitals[vital.type].push(vital);
      // Sort by date descending
      updatedHP.vitals[vital.type].sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  }

  // Merge allergies
  if (extractedData.allergies && extractedData.allergies.add) {
    updatedHP.allergies.push(...extractedData.allergies.add);
  }

  // Merge current goals
  if (extractedData.current_goals) {
    if (extractedData.current_goals.add) {
      updatedHP.current_goals.push(...extractedData.current_goals.add);
    }
    if (extractedData.current_goals.update) {
      for (const update of extractedData.current_goals.update) {
        const index = updatedHP.current_goals.findIndex(g => g.goal === update.goal);
        if (index >= 0) {
          updatedHP.current_goals[index] = { ...updatedHP.current_goals[index], ...update };
        }
      }
    }
  }

  return updatedHP;
}

/**
 * Generate comprehensive narrative H&P
 */
async function generateNarrativeHP(hp) {
  const prompt = NARRATIVE_PROMPT + JSON.stringify(hp, null, 2);

  const response = await azureOpenAIService.generateChatCompletion([
    { role: 'system', content: 'You are a medical documentation specialist.' },
    { role: 'user', content: prompt }
  ], {
    temperature: 0.5,
    maxTokens: 1500
  });

  return response.choices[0].message.content;
}

/**
 * Save updated H&P to database
 */
async function savePatientHP(patientPhone, hp) {
  const { error } = await supabase
    .from('patient_comprehensive_chart')
    .upsert({
      patient_phone: patientPhone,
      tshla_id: hp.tshla_id,
      demographics: hp.demographics,
      medications: hp.medications,
      diagnoses: hp.diagnoses,
      allergies: hp.allergies,
      family_history: hp.family_history,
      social_history: hp.social_history,
      labs: hp.labs,
      vitals: hp.vitals,
      current_goals: hp.current_goals,
      external_documents: hp.external_documents || [],
      full_hp_narrative: hp.full_hp_narrative,
      last_ai_generated: hp.last_ai_generated,
      version: hp.version
    }, {
      onConflict: 'patient_phone'
    });

  if (error) {
    throw new Error(`Failed to save H&P: ${error.message}`);
  }
}

/**
 * Archive dictation (store but don't use in AI prompts)
 */
async function archiveDictation(dictationId, patientPhone) {
  const dictation = await loadDictation(dictationId);

  const { error } = await supabase
    .from('visit_dictations_archive')
    .insert({
      patient_phone: patientPhone,
      visit_date: dictation.visit_date || new Date().toISOString().split('T')[0],
      dictation_text: dictation.dictation_text,
      dictation_id: dictationId,
      extracted_to_hp: true,
      extraction_date: new Date().toISOString()
    });

  if (error && error.code !== '23505') { // Ignore duplicates
    logger.error('HPGenerator', 'Failed to archive dictation', { error: error.message, dictationId });
  }
}

/**
 * Log changes to audit trail
 */
async function logHPChanges(patientPhone, extractedData, changedBy) {
  const changes = [];

  // Log medication changes
  if (extractedData.medications) {
    if (extractedData.medications.add) {
      changes.push({
        patient_phone: patientPhone,
        section_name: 'medications',
        change_type: 'add',
        new_value: extractedData.medications.add,
        changed_by: changedBy
      });
    }
  }

  // Log diagnosis changes
  if (extractedData.diagnoses && extractedData.diagnoses.add) {
    changes.push({
      patient_phone: patientPhone,
      section_name: 'diagnoses',
      change_type: 'add',
      new_value: extractedData.diagnoses.add,
      changed_by: changedBy
    });
  }

  // Log lab additions
  if (extractedData.labs && extractedData.labs.add) {
    changes.push({
      patient_phone: patientPhone,
      section_name: 'labs',
      change_type: 'add',
      new_value: extractedData.labs.add,
      changed_by: changedBy
    });
  }

  // Insert all changes
  if (changes.length > 0) {
    const { error } = await supabase
      .from('patient_chart_history')
      .insert(changes);

    if (error) {
      logger.error('HPGenerator', 'Failed to log changes', { error: error.message });
    }
  }
}

/**
 * Get patient H&P (public API)
 */
async function getPatientHP(patientPhone) {
  return await loadPatientHP(patientPhone);
}

/**
 * Trigger H&P regeneration (on-demand)
 */
async function triggerHPRegeneration(patientPhone) {
  logger.info('HPGenerator', 'Triggering on-demand H&P regeneration', { patientPhone });
  return await generateOrUpdateHP(patientPhone);
}

module.exports = {
  generateOrUpdateHP,
  getPatientHP,
  triggerHPRegeneration
};
