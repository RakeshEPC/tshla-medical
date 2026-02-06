/**
 * Patient Portal API Routes
 * Handles unified portal authentication, dashboard data, and session management
 *
 * Created: 2026-01-23
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');
const pdf = require('pdf-parse');
const { createClient: createDeepgramClient } = require('@deepgram/sdk');
const OpenAI = require('openai');

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Deepgram client for transcription
const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY);

// Initialize OpenAI client for medical extraction
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Rate limiting map (in-memory, for MVP - move to Redis for production)
const loginAttempts = new Map();

// Active sessions map (in-memory, for MVP - move to Redis for production)
// This tracks active patient portal sessions for validation
const activeSessions = new Map();

// Staff-initiated patient portal access tokens (one-time, 5-min expiry)
const staffAccessTokens = new Map();

/**
 * Parse athenaCollector PDF files for medical data
 * Handles multiple formats: clinical visit notes, lab reports, etc.
 */
function parseAthenaCollectorPDF(text) {
  logger.info('PatientPortal', 'Parsing athenaCollector PDF');

  const extractedData = {
    diagnoses: [],
    medications: [],
    procedures: [],
    labs: [],
    allergies: [],
    vitals: {},
    billing_codes: [],
    raw_content: text
  };

  const lines = text.split('\n');
  let currentSection = null;

  // Extract date from document (multiple formats)
  let documentDate = null;
  const dateMatch = text.match(/(?:Date:|DOS:|Collected|Observation date:)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (dateMatch) {
    const parts = dateMatch[1].split('/');
    documentDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }

  // **NEW: Extract labs from table format**
  // Common in lab reports with format: "TEST_NAME  VALUE  UNIT  FLAG  REFERENCE"
  const labTablePatterns = [
    // Pattern 1: Test name on left, values following (athenaCollector lab reports)
    // Example: "A1c WB Gen.2   1.34   g/dL"
    /^([A-Z][A-Za-z\d\s\/_\-\.]+?)\s+([\d\.]+)\s+(mg\/d[Ll]|g\/d[Ll]|mmol\/L|U\/L|%|mEq\/L|mL\/min\/[\d\.]+m2)/,

    // Pattern 2: Test name with value and unit (more compact)
    // Example: "Glucose   166   mg/dl   H   70-115"
    /^([A-Z][A-Za-z\s]+?)\s+([\d\.]+)\s+(mg\/d[Ll]|g\/d[Ll]|mmol\/L|U\/L|%|mEq\/L)\s+([HL])?\s*([\d\-\.]+)?/,

    // Pattern 3: Common lab tests with specific patterns
    /^(A1[Cc]|Glucose|Cholesterol|Triglycerides|HDL|LDL|Creatinine|eGFR|TSH|PSA|Testosterone|Hemoglobin|Sodium|Potassium|Chloride|BUN|Calcium|Albumin|Protein|Bilirubin|ALP|ALT|AST|BICARBONATE)\s+[A-Za-z\s]*?\s*([\d\.]+)\s*([A-Za-z\/\d%]+)/i
  ];

  // Common lab test names for multi-line format
  const knownLabTests = [
    'A1c', 'A/G RATIO', 'ALBUMIN', 'ALP', 'Alanine Aminotrans', 'Aspartate Aminotrans',
    'BICARBONATE', 'Bilirubin Total', 'Bun/Creatinine Ratio', 'CREA', 'Calcium',
    'Calculated LDL', 'Chloride', 'Cholesterol', 'Glucose', 'HDL-C', 'Hb', 'Potassium',
    'Sodium', 'Total Protein', 'Triglycerides', 'Urea/Bun', 'AGAP', 'Globulin',
    'Creatinine', 'eGFR', 'CO2', 'TSH', 'PSA', 'Testosterone', 'Hemoglobin',
    'WBC', 'RBC', 'HGB', 'HCT', 'MCV', 'MCH', 'MCHC', 'RDW', 'PLT', 'MPV'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and headers
    if (!line || line.length < 3) continue;

    // Identify sections
    if (line.match(/diagnosis|icd-?10|problem list/i)) {
      currentSection = 'diagnoses';
    } else if (line.match(/medication|prescri|drug|current med/i)) {
      currentSection = 'medications';
    } else if (line.match(/procedure|cpt|billing/i)) {
      currentSection = 'procedures';
    } else if (line.match(/allerg/i)) {
      currentSection = 'allergies';
    } else if (line.match(/lab|result|test|chemistry|hematology/i)) {
      currentSection = 'labs';
    }

    // **NEW: Check for multi-line lab format (test name on one line, value on another)**
    // Example: Line i: "A1c", Line i+4: "8.77", Line i+5: "%"
    const isKnownTest = knownLabTests.some(test =>
      line.toLowerCase() === test.toLowerCase() ||
      line.toLowerCase().includes(test.toLowerCase())
    );

    if (isKnownTest && line.length < 50) {
      // Look ahead for numeric value (within next 10 lines)
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j].trim();

        // Check if it's a numeric value
        if (nextLine.match(/^[\d\.]+$/)) {
          const value = nextLine;

          // Look for unit in next few lines
          let unit = '';
          for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
            const unitLine = lines[k].trim();
            if (unitLine.match(/^(mg\/d[Ll]|g\/d[Ll]|mmol\/L|U\/L|%|mEq\/L|10\^3\/mm|10\^6\/mm|m\^3|mL\/min\/[\d\.]+m2)$/)) {
              unit = unitLine;
              break;
            }
          }

          // Check if it's a duplicate
          const isDuplicate = extractedData.labs.some(lab =>
            lab.name.toLowerCase() === line.toLowerCase()
          );

          if (!isDuplicate) {
            extractedData.labs.push({
              name: line,
              value: value,
              unit: unit,
              date: documentDate || new Date().toISOString().split('T')[0]
            });
          }
          break;
        }
      }
      continue;
    }

    // **Try lab table patterns (single-line format)**
    let labExtracted = false;
    for (const pattern of labTablePatterns) {
      const labMatch = pattern.exec(line);
      if (labMatch) {
        const testName = labMatch[1].trim();
        const value = labMatch[2];
        const unit = labMatch[3] || '';

        // Validate it's a real lab test
        if (testName.length > 2 && testName.length < 60 &&
            !testName.match(/patient|doctor|provider|page|printed|report|specimen|collected|received|reported/i)) {

          // Check if it's a duplicate
          const isDuplicate = extractedData.labs.some(lab =>
            lab.name.toLowerCase() === testName.toLowerCase()
          );

          if (!isDuplicate) {
            extractedData.labs.push({
              name: testName,
              value: value,
              unit: unit,
              date: documentDate || new Date().toISOString().split('T')[0]
            });
            labExtracted = true;
          }
        }
        break;
      }
    }

    if (labExtracted) continue;

    // Extract ICD-10 codes and diagnoses
    // Format: "E11.9 Type 2 diabetes mellitus without complications"
    const icdMatch = line.match(/([A-Z]\d{2}(?:\.\d{1,3})?)\s+(.+)/);
    if (icdMatch && icdMatch[2].length > 5 && !icdMatch[2].match(/^\d+$/)) {
      extractedData.diagnoses.push({
        icd_code: icdMatch[1],
        name: icdMatch[2].trim(),
        status: 'active'
      });
      continue;
    }

    // Extract CPT codes and procedures (skip if it's just numbers)
    const cptMatch = line.match(/(\d{5})\s+(.+)/);
    if (cptMatch && cptMatch[2].length > 5 && !line.match(/\d{5}\s+\d{5}/)) {
      const procName = cptMatch[2].trim();
      if (!procName.match(/^\d+$/) && procName.length < 100) {
        extractedData.procedures.push({
          cpt_code: cptMatch[1],
          name: procName,
          date: documentDate || new Date().toISOString().split('T')[0]
        });
      }
      continue;
    }

    // Extract medications
    // Format: "atorvastatin 40 mg tablet" or "Mounjaro 2.5 mg/0.5 mL"
    const medMatch = line.match(/^([A-Z][A-Za-z\s]+?)\s+([\d\.\/]+\s*mg(?:\/[\d\.]+\s*m[Ll])?)\s*(tablet|capsule|injection|subcutaneous|oral)?/i);
    if (medMatch && !line.match(/patient|doctor|specimen/i)) {
      const medObj = {
        name: medMatch[1].trim(),
        dosage: medMatch[2].trim(),
        route: medMatch[3] ? medMatch[3].toLowerCase() : '',
        frequency: '',
        sig: line,
        status: 'active'
      };

      // Look for frequency
      const freqMatch = line.match(/\b(once daily|twice daily|three times daily|once weekly|bid|tid|qid|q\d+h)\b/i);
      if (freqMatch) {
        medObj.frequency = freqMatch[1];
      }

      extractedData.medications.push(medObj);
      continue;
    }

    // Extract allergies
    if (currentSection === 'allergies' && line.length > 3 && !line.match(/allerg|none|nkda/i)) {
      const allergyMatch = line.match(/^([A-Za-z\s]+?)(?:\s*-\s*(.+))?$/);
      if (allergyMatch) {
        extractedData.allergies.push({
          allergen: allergyMatch[1].trim(),
          reaction: allergyMatch[2] ? allergyMatch[2].trim() : ''
        });
      }
      continue;
    }

    // Extract vitals
    const bpMatch = line.match(/\b(?:BP|Blood Pressure):\s*(\d{2,3})\/(\d{2,3})/i);
    if (bpMatch) {
      extractedData.vitals.systolic_bp = { value: bpMatch[1], unit: 'mmHg' };
      extractedData.vitals.diastolic_bp = { value: bpMatch[2], unit: 'mmHg' };
      continue;
    }

    const weightMatch = line.match(/\b(?:Weight|Wt):\s*([\d\.]+)\s*(lbs?|kg)/i);
    if (weightMatch) {
      extractedData.vitals.weight = { value: weightMatch[1], unit: weightMatch[2] };
      continue;
    }

    const heightMatch = line.match(/\b(?:Height|Ht):\s*([\d'"\s]+)/i);
    if (heightMatch) {
      extractedData.vitals.height = { value: heightMatch[1].trim(), unit: '' };
      continue;
    }

    const tempMatch = line.match(/\b(?:Temp|Temperature):\s*([\d\.]+)\s*°?F?/i);
    if (tempMatch) {
      extractedData.vitals.temperature = { value: tempMatch[1], unit: '°F' };
      continue;
    }

    const pulseMatch = line.match(/\b(?:Pulse|HR|Heart Rate):\s*(\d+)/i);
    if (pulseMatch) {
      extractedData.vitals.pulse = { value: pulseMatch[1], unit: 'bpm' };
      continue;
    }

    // Fallback: Simple colon format for labs
    // Format: "A1C: 6.9%" or "Glucose: 209 mg/dL"
    const simpleLabMatch = line.match(/^([A-Za-z][A-Za-z\d\s]+?):\s*([\d\.]+)\s*([%A-Za-z\/]+)?$/);
    if (simpleLabMatch && !line.match(/date|time|patient|doctor|provider|dob|page|specimen|collected|received/i)) {
      const testName = simpleLabMatch[1].trim();
      const hasUnit = simpleLabMatch[3] && simpleLabMatch[3].length > 0;
      const isKnownLab = testName.match(/a1c|glucose|cholesterol|triglyceride|hdl|ldl|creatinine|egfr|tsh|psa|testosterone|hemoglobin|sodium|potassium|calcium|albumin|protein/i);

      if (testName.length > 2 && testName.length < 50 && (hasUnit || isKnownLab)) {
        const isDuplicate = extractedData.labs.some(lab =>
          lab.name.toLowerCase() === testName.toLowerCase()
        );

        if (!isDuplicate) {
          extractedData.labs.push({
            name: testName,
            value: simpleLabMatch[2],
            unit: simpleLabMatch[3] ? simpleLabMatch[3].trim() : '',
            date: documentDate || new Date().toISOString().split('T')[0]
          });
        }
      }
    }
  }

  // Remove duplicates
  extractedData.diagnoses = extractedData.diagnoses.filter((dx, index, self) =>
    index === self.findIndex(d => d.icd_code === dx.icd_code)
  );

  extractedData.medications = extractedData.medications.filter((med, index, self) =>
    index === self.findIndex(m => m.name.toLowerCase() === med.name.toLowerCase())
  );

  logger.info('PatientPortal', 'Parsed athenaCollector PDF', {
    diagnoses: extractedData.diagnoses.length,
    medications: extractedData.medications.length,
    procedures: extractedData.procedures.length,
    labs: extractedData.labs.length,
    allergies: extractedData.allergies.length,
    vitals: Object.keys(extractedData.vitals).length
  });

  return extractedData;
}

/**
 * Extract medical information from voice transcript using OpenAI
 * Analyzes patient voice recordings for symptoms, medications, etc.
 */
async function extractMedicalInfoFromTranscript(transcript) {
  logger.info('PatientPortal', 'Extracting medical info from transcript');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      temperature: 0.3, // Lower temperature for more consistent extraction
      messages: [
        {
          role: 'system',
          content: `You are a medical information extraction assistant. Extract structured medical information from patient voice recordings.

Extract and return ONLY valid JSON in this exact format:
{
  "chief_complaint": "Brief description of main concern",
  "symptoms": [{"description": "symptom name", "severity": "mild|moderate|severe", "duration": "timeframe"}],
  "medications": [{"name": "medication name", "dosage": "amount", "frequency": "how often", "route": "oral|topical|etc"}],
  "allergies": [{"allergen": "substance", "reaction": "reaction type"}],
  "vitals": {"bp": "120/80", "weight": "180 lbs", "temperature": "98.6 F"},
  "diagnoses": [{"name": "condition name", "icd_code": "code if mentioned"}],
  "labs": [{"name": "lab test name", "value": "numeric value", "unit": "unit of measurement", "date": "YYYY-MM-DD if mentioned"}],
  "family_history": ["conditions in family"],
  "notes": "Any other relevant information NOT covered by other fields"
}

Rules:
- Only extract information explicitly stated by the patient
- Leave arrays empty [] if no relevant information
- Leave vitals empty {} if not mentioned
- Use "unknown" for unclear information
- Standardize medication names (e.g., "Tylenol" → "acetaminophen")
- Infer severity from patient's description if not explicitly stated
- IMPORTANT: Extract lab values into the labs array, NOT into notes
- Common lab tests: A1c, glucose, cholesterol, HDL, LDL, triglycerides, TSH, T3, T4, cortisol, ACTH, vitamin D, B12, hemoglobin, WBC, RBC, platelets, creatinine, BUN, ALT, AST, etc.
- Extract numeric values and units separately (e.g., "cortisol was 1.4" → {"name": "cortisol", "value": "1.4", "unit": ""})`
        },
        {
          role: 'user',
          content: `Extract medical information from this patient recording:\n\n"${transcript}"`
        }
      ]
    });

    const responseText = completion.choices[0].message.content.trim();

    // Parse JSON response
    let extracted;
    try {
      extracted = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // Convert to our database format
    const extractedData = {
      diagnoses: (extracted.diagnoses || []).map(dx => ({
        icd_code: dx.icd_code || '',
        name: dx.name,
        status: 'active'
      })),
      medications: (extracted.medications || []).map(med => ({
        name: med.name,
        dosage: med.dosage || '',
        frequency: med.frequency || '',
        route: med.route || '',
        sig: `${med.name} ${med.dosage} ${med.frequency}`.trim(),
        status: 'active'
      })),
      allergies: extracted.allergies || [],
      symptoms: extracted.symptoms || [],
      vitals: extracted.vitals || {},
      chief_complaint: extracted.chief_complaint || '',
      family_history: extracted.family_history || [],
      notes: extracted.notes || '',
      labs: (extracted.labs || []).map(lab => ({
        name: lab.name,
        value: lab.value,
        unit: lab.unit || '',
        date: lab.date || new Date().toISOString().split('T')[0]
      })),
      procedures: []
    };

    logger.info('PatientPortal', 'Extracted medical info from transcript', {
      diagnoses: extractedData.diagnoses.length,
      medications: extractedData.medications.length,
      allergies: extractedData.allergies.length,
      symptoms: extractedData.symptoms.length,
      labs: extractedData.labs.length,
      hasChiefComplaint: !!extractedData.chief_complaint,
      rawExtracted: JSON.stringify(extracted).substring(0, 500)
    });

    return extractedData;

  } catch (error) {
    logger.error('PatientPortal', 'Failed to extract medical info from transcript', {
      error: error.message
    });
    throw error;
  }
}

/**
 * POST /api/patient-portal/login
 * Authenticate with TSH ID + last 4 digits of phone
 */
router.post('/login', async (req, res) => {
  try {
    const { tshlaId, phoneLast4 } = req.body;

    // Normalize TSH ID (remove spaces, dashes)
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Login attempt', { tshlaId: normalizedTshId });

    // Rate limiting check
    const clientIp = req.ip || req.connection.remoteAddress;
    const attemptKey = `${clientIp}-${normalizedTshId}`;
    const attempts = loginAttempts.get(attemptKey) || { count: 0, firstAttempt: Date.now() };

    // Reset after 1 hour
    if (Date.now() - attempts.firstAttempt > 60 * 60 * 1000) {
      loginAttempts.delete(attemptKey);
      attempts.count = 0;
      attempts.firstAttempt = Date.now();
    }

    // Check if locked out (5 attempts)
    if (attempts.count >= 5) {
      logger.warn('PatientPortal', 'Too many login attempts', { tshlaId: normalizedTshId, ip: clientIp });
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please try again in 1 hour or contact our office.'
      });
    }

    // 1. Find patient by TSH ID
    // Try exact match first, then try with space format (TSH XXX-XXX)
    let patient, findError;

    // Try normalized format (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('id, phone_primary, phone_display, first_name, last_name, tshla_id, is_active')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('id, phone_primary, phone_display, first_name, last_name, tshla_id, is_active')
        .eq('tshla_id', formatted)
        .maybeSingle();

      patient = result2.data;
      findError = result2.error;
    }

    if (findError || !patient) {
      // Increment failed attempts
      attempts.count++;
      loginAttempts.set(attemptKey, attempts);

      logger.warn('PatientPortal', 'TSH ID not found', { tshlaId: normalizedTshId });
      return res.status(404).json({
        success: false,
        error: 'TSH ID not found. Please check your ID or contact our office.'
      });
    }

    // Check if account is active
    if (!patient.is_active) {
      logger.warn('PatientPortal', 'Inactive account', { tshlaId: normalizedTshId });
      return res.status(403).json({
        success: false,
        error: 'Account is inactive. Please contact our office.'
      });
    }

    // 2. Verify last 4 digits of phone
    const fullPhone = patient.phone_primary.replace(/\D/g, '');
    const last4 = fullPhone.slice(-4);

    if (phoneLast4 !== last4) {
      // Increment failed attempts
      attempts.count++;
      loginAttempts.set(attemptKey, attempts);

      logger.warn('PatientPortal', 'Phone verification failed', {
        tshlaId: normalizedTshId,
        attempts: attempts.count
      });
      return res.status(403).json({
        success: false,
        error: 'Phone verification failed. Please check the last 4 digits.'
      });
    }

    // 3. Success! Create session
    const sessionId = uuidv4();
    const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();

    // Clear failed attempts
    loginAttempts.delete(attemptKey);

    // Store active session (expires in 2 hours)
    activeSessions.set(sessionId, {
      tshlaId: normalizedTshId,
      patientPhone: patient.phone_primary,
      patientName,
      createdAt: Date.now()
    });

    // Auto-expire sessions after 2 hours
    setTimeout(() => {
      activeSessions.delete(sessionId);
      logger.info('PatientPortal', 'Session expired', { sessionId, tshlaId: normalizedTshId });
    }, 2 * 60 * 60 * 1000);

    // 4. Create session record in database
    const { error: sessionError } = await supabase
      .from('patient_portal_sessions')
      .insert({
        id: sessionId, // Store the session ID for validation
        patient_phone: patient.phone_primary,
        tshla_id: normalizedTshId,
        session_start: new Date().toISOString(),
        device_type: getDeviceType(req.headers['user-agent']),
        ip_address: clientIp,
        user_agent: req.headers['user-agent'],
        sections_viewed: [],
        actions_performed: {}
      });

    if (sessionError) {
      logger.error('PatientPortal', 'Failed to create session', { error: sessionError.message });
      // Non-critical, continue
    }

    // 5. Log access for HIPAA compliance
    await supabase
      .from('access_logs')
      .insert({
        user_type: 'patient',
        user_id: patient.id,
        action: 'portal_login',
        resource_type: 'patient_portal',
        ip_address: clientIp,
        user_agent: req.headers['user-agent'],
        details: { tshla_id: normalizedTshId }
      });

    logger.info('PatientPortal', 'Login successful', {
      tshlaId: normalizedTshId,
      patientName
    });

    res.json({
      success: true,
      sessionId,
      patientPhone: patient.phone_primary,
      tshlaId: normalizedTshId,
      patientName
    });

  } catch (error) {
    logger.error('PatientPortal', 'Login error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Server error during login. Please try again.'
    });
  }
});

/**
 * POST /api/patient-portal/staff-access
 * Create a one-time token for staff to open patient portal as a patient
 * Called from the schedule view when staff clicks a TSH ID
 */
router.post('/staff-access', async (req, res) => {
  try {
    const { tshlaId } = req.body;

    if (!tshlaId) {
      return res.status(400).json({ success: false, error: 'TSH ID required' });
    }

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    // Look up patient by TSH ID (try normalized, then formatted)
    let patient;
    const result1 = await supabase
      .from('unified_patients')
      .select('id, phone_primary, first_name, last_name, tshla_id, is_active')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('id, phone_primary, first_name, last_name, tshla_id, is_active')
        .eq('tshla_id', formatted)
        .maybeSingle();
      patient = result2.data;
    }

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Create one-time token
    const token = uuidv4();
    const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();

    staffAccessTokens.set(token, {
      tshlaId: patient.tshla_id,
      patientPhone: patient.phone_primary,
      patientName,
      createdAt: Date.now()
    });

    // Auto-expire token after 5 minutes
    setTimeout(() => staffAccessTokens.delete(token), 5 * 60 * 1000);

    // Log for HIPAA
    await supabase.from('access_logs').insert({
      user_type: 'staff',
      action: 'staff_portal_access_token_created',
      resource_type: 'patient_portal',
      details: { tshla_id: patient.tshla_id, patient_name: patientName }
    });

    logger.info('PatientPortal', 'Staff access token created', { tshlaId: patient.tshla_id });

    res.json({ success: true, token });
  } catch (error) {
    logger.error('PatientPortal', 'Staff access token error', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create access token' });
  }
});

/**
 * POST /api/patient-portal/validate-staff-token
 * Validate a one-time staff access token and return session data
 */
router.post('/validate-staff-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }

    const tokenData = staffAccessTokens.get(token);

    if (!tokenData) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    // Check if token is older than 5 minutes
    if (Date.now() - tokenData.createdAt > 5 * 60 * 1000) {
      staffAccessTokens.delete(token);
      return res.status(401).json({ success: false, error: 'Token expired' });
    }

    // One-time use — delete immediately
    staffAccessTokens.delete(token);

    // Create a real session (same as normal login)
    const sessionId = uuidv4();

    activeSessions.set(sessionId, {
      tshlaId: tokenData.tshlaId,
      patientPhone: tokenData.patientPhone,
      patientName: tokenData.patientName,
      createdAt: Date.now()
    });

    // Auto-expire session after 2 hours
    setTimeout(() => activeSessions.delete(sessionId), 2 * 60 * 60 * 1000);

    // Log for HIPAA
    await supabase.from('access_logs').insert({
      user_type: 'staff',
      action: 'staff_portal_access_login',
      resource_type: 'patient_portal',
      details: { tshla_id: tokenData.tshlaId }
    });

    logger.info('PatientPortal', 'Staff access login', { tshlaId: tokenData.tshlaId });

    res.json({
      success: true,
      sessionId,
      patientPhone: tokenData.patientPhone,
      tshlaId: tokenData.tshlaId,
      patientName: tokenData.patientName
    });
  } catch (error) {
    logger.error('PatientPortal', 'Staff token validation error', { error: error.message });
    res.status(500).json({ success: false, error: 'Token validation failed' });
  }
});

/**
 * GET /api/patient-portal/dashboard
 * Get dashboard statistics for patient
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { tshlaId } = req.query;
    const sessionId = req.headers['x-session-id'];

    if (!tshlaId) {
      return res.status(400).json({ success: false, error: 'TSH ID required' });
    }

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Loading dashboard', { tshlaId: normalizedTshId });

    // Get patient (try both normalized and formatted versions)
    let patient = null;

    // Try normalized format first (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('id, phone_primary, tshla_id')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('id, phone_primary, tshla_id')
        .eq('tshla_id', formatted)
        .maybeSingle();

      patient = result2.data;
    }

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // 1. Get payment statistics
    const { data: payments, error: paymentError } = await supabase
      .from('payment_requests')
      .select('amount_cents, payment_status, due_date')
      .eq('tshla_id', normalizedTshId)
      .eq('payment_status', 'pending');

    const pendingPayments = payments || [];
    const pendingPaymentAmount = pendingPayments.reduce((sum, p) => sum + p.amount_cents, 0);
    const nextPaymentDue = pendingPayments.length > 0
      ? pendingPayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0].due_date
      : null;

    // 2. Get audio summary statistics
    const { data: audioSummaries, error: audioError } = await supabase
      .from('patient_audio_summaries')
      .select('created_at, expires_at')
      .eq('patient_phone', patient.phone_primary)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    const audioSummariesCount = audioSummaries?.length || 0;
    const latestAudioDate = audioSummaries && audioSummaries.length > 0
      ? audioSummaries[0].created_at
      : null;

    // 3. Get AI chat statistics (today)
    const today = new Date().toISOString().split('T')[0];
    const { data: aiStats, error: aiError } = await supabase
      .from('patient_ai_analytics')
      .select('total_questions')
      .eq('patient_phone', patient.phone_primary)
      .eq('date', today)
      .single();

    const aiQuestionsToday = aiStats?.total_questions || 0;
    const aiQuestionsRemaining = Math.max(0, 20 - aiQuestionsToday);

    // Return dashboard stats
    res.json({
      success: true,
      stats: {
        pendingPayments: pendingPayments.length,
        pendingPaymentAmount,
        nextPaymentDue,
        audioSummaries: audioSummariesCount,
        latestAudioDate,
        aiQuestionsToday,
        aiQuestionsRemaining
      }
    });

  } catch (error) {
    logger.error('PatientPortal', 'Dashboard error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard'
    });
  }
});

/**
 * POST /api/patient-portal/track-login
 * Track portal login for analytics
 */
router.post('/track-login', async (req, res) => {
  try {
    const { patientPhone, tshlaId, sessionId, deviceType, userAgent } = req.body;

    // This endpoint is for analytics only, don't fail if it errors
    await supabase
      .from('patient_portal_sessions')
      .update({
        device_type: deviceType,
        user_agent: userAgent
      })
      .eq('tshla_id', tshlaId)
      .eq('session_start', new Date().toISOString());

    res.json({ success: true });
  } catch (error) {
    // Non-critical, just log
    logger.error('PatientPortal', 'Track login error', { error: error.message });
    res.json({ success: false });
  }
});

/**
 * POST /api/patient-portal/track-view
 * Track section view for analytics
 */
router.post('/track-view', async (req, res) => {
  try {
    const { sessionId, section } = req.body;

    // Update session with viewed section
    const { data: session } = await supabase
      .from('patient_portal_sessions')
      .select('sections_viewed')
      .eq('id', sessionId)
      .single();

    if (session) {
      const sectionsViewed = session.sections_viewed || [];
      if (!sectionsViewed.includes(section)) {
        sectionsViewed.push(section);

        await supabase
          .from('patient_portal_sessions')
          .update({ sections_viewed: sectionsViewed })
          .eq('id', sessionId);
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('PatientPortal', 'Track view error', { error: error.message });
    res.json({ success: false });
  }
});

/**
 * POST /api/patient-portal/upload-document
 * Upload medical documents (files, text, or audio) and extract information with AI
 */
router.post('/upload-document', upload.any(), async (req, res) => {
  try {
    const { tshlaId, patientId, sessionId, uploadMethod, textContent } = req.body;

    if (!tshlaId || !sessionId || !uploadMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Document upload started', {
      tshlaId: normalizedTshId,
      method: uploadMethod
    });

    // Verify patient exists (try both normalized and formatted versions)
    let patient = null;

    // Try normalized format first (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('id, phone_primary, first_name, last_name')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('id, phone_primary, first_name, last_name')
        .eq('tshla_id', formatted)
        .maybeSingle();

      patient = result2.data;
    }

    if (!patient) {
      logger.warn('PatientPortal', 'Patient not found for upload', {
        tshlaId: normalizedTshId
      });
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    let extractedData = {
      diagnoses: [],
      medications: [],
      allergies: [],
      labs: [],
      procedures: [],
      vitals: {},
      raw_content: ''
    };

    // Process based on upload method
    if (uploadMethod === 'text') {
      // Process text content with AI
      extractedData.raw_content = textContent;

      // TODO: Integrate with OpenAI/Azure AI to extract medical information
      // For now, store the raw text
      logger.info('PatientPortal', 'Processing text upload', {
        tshlaId: normalizedTshId,
        length: textContent?.length
      });

    } else if (uploadMethod === 'file') {
      // Process file uploads
      logger.info('PatientPortal', 'Processing file upload', {
        tshlaId: normalizedTshId,
        fileCount: req.files?.length
      });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      // Process each uploaded file
      for (const file of req.files) {
        const fileName = file.originalname;
        const fileType = file.mimetype;
        const fileSize = file.size;

        logger.info('PatientPortal', 'Processing file', {
          fileName,
          fileType,
          fileSize
        });

        // Convert buffer to string for XML/CCD files
        if (fileName.toLowerCase().endsWith('.xml') ||
            fileName.toLowerCase().endsWith('.ccd') ||
            fileType === 'text/xml' ||
            fileType === 'application/xml') {

          const xmlContent = file.buffer.toString('utf-8');
          extractedData.raw_content = xmlContent;

          // Basic CCD parsing - extract key sections
          // This is a simplified parser - CCD/C-CDA files are complex
          try {
            // Extract diagnoses/problems
            const problemMatches = xmlContent.match(/<code code="([^"]*)" displayName="([^"]*)"/g);
            if (problemMatches) {
              problemMatches.forEach(match => {
                const displayMatch = match.match(/displayName="([^"]*)"/);
                if (displayMatch) {
                  extractedData.diagnoses.push(displayMatch[1]);
                }
              });
            }

            // Extract medications with detailed information
            // CCD medications are in substanceAdministration sections
            const medSectionMatches = xmlContent.match(/<substanceAdministration[\s\S]*?<\/substanceAdministration>/g);
            if (medSectionMatches) {
              medSectionMatches.forEach(medSection => {
                // Medication name
                const nameMatch = medSection.match(/<name>([^<]*)<\/name>/);

                // Dosage/strength - look for doseQuantity
                const doseMatch = medSection.match(/<doseQuantity[\s\S]*?value="([^"]*)"[\s\S]*?unit="([^"]*)"/);

                // Frequency - look for frequency text or period
                let frequency = '';
                const freqPeriodMatch = medSection.match(/<period[\s\S]*?value="([^"]*)"[\s\S]*?unit="([^"]*)"/);
                if (freqPeriodMatch) {
                  const value = freqPeriodMatch[1];
                  const unit = freqPeriodMatch[2];
                  if (value === '1' && unit === 'd') frequency = 'Daily';
                  else if (value === '12' && unit === 'h') frequency = 'BID (twice daily)';
                  else if (value === '8' && unit === 'h') frequency = 'TID (three times daily)';
                  else if (value === '6' && unit === 'h') frequency = 'QID (four times daily)';
                  else frequency = `Every ${value} ${unit}`;
                }

                // Route of administration
                const routeMatch = medSection.match(/<routeCode[\s\S]*?displayName="([^"]*)"/);

                // Sig/Instructions - look for text in instructions
                let sig = '';
                const sigMatch = medSection.match(/<text>([^<]*)<\/text>/);
                if (sigMatch && sigMatch[1] && !sigMatch[1].includes('xml')) {
                  sig = sigMatch[1].trim();
                }

                // Status - active or not
                const statusMatch = medSection.match(/<statusCode code="([^"]*)"/);
                const isActive = !statusMatch || statusMatch[1] === 'active' || statusMatch[1] === 'completed';

                if (nameMatch && nameMatch[1] && nameMatch[1] !== 'AthenaHealth') {
                  const medObj = {
                    name: nameMatch[1],
                    dosage: doseMatch ? `${doseMatch[1]} ${doseMatch[2]}` : '',
                    frequency: frequency,
                    route: routeMatch ? routeMatch[1] : '',
                    sig: sig,
                    status: isActive ? 'active' : 'inactive'
                  };

                  extractedData.medications.push(medObj);
                }
              });
            }

            // Fallback: if no substanceAdministration found, try simpler pattern
            if (extractedData.medications.length === 0) {
              const simpleMedMatches = xmlContent.match(/<manufacturedMaterial>[\s\S]*?<name>([^<]*)<\/name>/g);
              if (simpleMedMatches) {
                simpleMedMatches.forEach(match => {
                  const nameMatch = match.match(/<name>([^<]*)<\/name>/);
                  if (nameMatch && nameMatch[1] !== 'AthenaHealth') {
                    extractedData.medications.push({
                      name: nameMatch[1],
                      dosage: '',
                      frequency: '',
                      route: '',
                      sig: '',
                      status: 'active'
                    });
                  }
                });
              }
            }

            // Extract allergies
            const allergyMatches = xmlContent.match(/<participant typeCode="CSM">[\s\S]*?<name>([^<]*)<\/name>/g);
            if (allergyMatches) {
              allergyMatches.forEach(match => {
                const nameMatch = match.match(/<name>([^<]*)<\/name>/);
                if (nameMatch) {
                  extractedData.allergies.push(nameMatch[1]);
                }
              });
            }

            // Extract lab results from observations
            const observationMatches = xmlContent.match(/<observation[\s\S]*?<\/observation>/g);
            if (observationMatches) {
              observationMatches.forEach(obs => {
                // Look for result observations with numeric values (PQ = Physical Quantity)
                const codeMatch = obs.match(/<code[\s\S]*?displayName="([^"]*)"/);

                // Match both formats: unit="x" value="y" OR value="y" unit="x"
                const valueMatch1 = obs.match(/<value[\s\S]*?value="([^"]*)"[\s\S]*?unit="([^"]*)"/);
                const valueMatch2 = obs.match(/<value[\s\S]*?unit="([^"]*)"[\s\S]*?value="([^"]*)"/);
                const valueMatch = valueMatch1 || valueMatch2;

                if (codeMatch && valueMatch) {
                  const labName = codeMatch[1];
                  // Handle both match orders
                  const labValue = valueMatch1 ? valueMatch[1] : valueMatch[2];
                  const labUnit = valueMatch1 ? valueMatch[2] : valueMatch[1];

                  // Filter out non-lab observations and ensure we have valid data
                  if (labName && labValue && !labName.includes('Instruction') &&
                      !labName.includes('Order') && !labName.includes('Sex') &&
                      !labName.includes('Birth')) {
                    extractedData.labs.push({
                      name: labName,
                      value: labValue,
                      unit: labUnit
                    });
                  }
                }
              });
            }

            // Extract vitals
            const vitalMatches = xmlContent.match(/<vital-sign[\s\S]*?<\/vital-sign>|<organizer[\s\S]*?templateId root="2\.16\.840\.1\.113883\.10\.20\.22\.4\.26"[\s\S]*?<\/organizer>/g);
            if (vitalMatches) {
              vitalMatches.forEach(vital => {
                const codeMatch = vital.match(/<code[\s\S]*?displayName="([^"]*)"/);
                const valueMatch = vital.match(/<value[\s\S]*?value="([^"]*)"[\s\S]*?unit="([^"]*)"/);

                if (codeMatch && valueMatch) {
                  const vitalName = codeMatch[1];
                  extractedData.vitals[vitalName] = {
                    value: valueMatch[1],
                    unit: valueMatch[2]
                  };
                }
              });
            }

            logger.info('PatientPortal', 'Extracted CCD data', {
              diagnoses: extractedData.diagnoses.length,
              medications: extractedData.medications.length,
              allergies: extractedData.allergies.length,
              labs: extractedData.labs.length,
              vitals: Object.keys(extractedData.vitals).length
            });

          } catch (parseError) {
            logger.error('PatientPortal', 'CCD parsing error', {
              error: parseError.message
            });
          }

        } else if (fileName.toLowerCase().endsWith('.pdf')) {
          // Process PDF files
          logger.info('PatientPortal', 'Processing PDF file', { fileName });

          try {
            // Extract text from PDF
            const pdfData = await pdf(file.buffer);
            const pdfText = pdfData.text;

            logger.info('PatientPortal', 'PDF text extracted', {
              pages: pdfData.numpages,
              textLength: pdfText.length
            });

            // Store raw content
            extractedData.raw_content = pdfText;

            // Upload PDF to Supabase Storage
            const timestamp = Date.now();
            const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${normalizedTshId}/${timestamp}_${sanitizedFileName}`;

            logger.info('PatientPortal', 'Uploading PDF to storage', { storagePath });

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('patient-documents')
              .upload(storagePath, file.buffer, {
                contentType: fileType,
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              logger.error('PatientPortal', 'Failed to upload PDF to storage', {
                error: uploadError.message
              });
              throw new Error(`Storage upload failed: ${uploadError.message}`);
            }

            // Get public URL (bucket is private, so this is a signed URL approach)
            const { data: urlData } = supabase.storage
              .from('patient-documents')
              .getPublicUrl(storagePath);

            // Store file metadata
            extractedData.file_url = urlData.publicUrl;
            extractedData.file_name = fileName;
            extractedData.file_type = fileType;
            extractedData.file_size_bytes = fileSize;

            logger.info('PatientPortal', 'PDF uploaded successfully', {
              url: urlData.publicUrl
            });

            // Parse athenaCollector PDF for medical data
            if (fileName.toLowerCase().includes('athenacollector') ||
                fileName.toLowerCase().includes('athena')) {

              logger.info('PatientPortal', 'Parsing as athenaCollector PDF');
              const parsedData = parseAthenaCollectorPDF(pdfText);

              // Merge parsed data with extractedData
              extractedData.diagnoses = parsedData.diagnoses;
              extractedData.medications = parsedData.medications;
              extractedData.procedures = parsedData.procedures;
              extractedData.labs = parsedData.labs;
              extractedData.allergies = parsedData.allergies;
              extractedData.vitals = parsedData.vitals;

              logger.info('PatientPortal', 'Extracted medical data from PDF', {
                diagnoses: extractedData.diagnoses.length,
                medications: extractedData.medications.length,
                procedures: extractedData.procedures.length,
                labs: extractedData.labs.length
              });
            }

          } catch (pdfError) {
            logger.error('PatientPortal', 'PDF processing error', {
              error: pdfError.message,
              stack: pdfError.stack
            });

            // Store error but don't fail the upload
            extractedData.raw_content = `[PDF processing failed: ${pdfError.message}]`;
            extractedData.processing_error = pdfError.message;
          }

        } else if (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/)) {
          // TODO: OCR image files
          extractedData.raw_content = `[Image file: ${fileName}]`;

        } else {
          // For other file types, just store the text content if possible
          try {
            extractedData.raw_content = file.buffer.toString('utf-8');
          } catch (e) {
            extractedData.raw_content = `[Binary file: ${fileName}]`;
          }
        }
      }

    } else if (uploadMethod === 'voice') {
      // Process voice recording
      logger.info('PatientPortal', 'Processing voice upload', {
        tshlaId: normalizedTshId
      });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No audio file uploaded'
        });
      }

      const audioFile = req.files[0];
      const fileName = audioFile.originalname || 'recording.webm';
      const fileType = audioFile.mimetype || 'audio/webm';
      const fileSize = audioFile.size;

      logger.info('PatientPortal', 'Processing audio file', {
        fileName,
        fileType,
        fileSize
      });

      try {
        // 1. Try to upload audio to Supabase Storage (optional - continue even if fails)
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${normalizedTshId}/${timestamp}_${sanitizedFileName}`;

        logger.info('PatientPortal', 'Attempting to upload audio to storage', { storagePath });

        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('patient-audio')
            .upload(storagePath, audioFile.buffer, {
              contentType: fileType,
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            logger.warn('PatientPortal', 'Storage upload failed, continuing without storage', {
              error: uploadError.message
            });
          } else {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('patient-audio')
              .getPublicUrl(storagePath);

            extractedData.file_url = urlData.publicUrl;
            logger.info('PatientPortal', 'Audio uploaded successfully', {
              url: urlData.publicUrl
            });
          }
        } catch (storageError) {
          logger.warn('PatientPortal', 'Storage upload exception, continuing without storage', {
            error: storageError.message
          });
        }

        extractedData.file_name = fileName;
        extractedData.file_type = fileType;
        extractedData.file_size_bytes = fileSize;

        // 2. Transcribe audio with Deepgram
        logger.info('PatientPortal', 'Transcribing audio with Deepgram');

        const { result, error: transcribeError } = await deepgram.listen.prerecorded.transcribeFile(
          audioFile.buffer,
          {
            model: 'nova-2-medical',
            smart_format: true,
            diarize: false,
            punctuate: true,
            paragraphs: true
          }
        );

        if (transcribeError) {
          throw new Error(`Transcription failed: ${transcribeError.message}`);
        }

        const transcript = result.results.channels[0].alternatives[0].transcript;

        if (!transcript || transcript.length === 0) {
          throw new Error('No speech detected in audio');
        }

        extractedData.raw_content = transcript;

        logger.info('PatientPortal', 'Audio transcribed successfully', {
          transcriptLength: transcript.length,
          confidence: result.results.channels[0].alternatives[0].confidence
        });

        // 3. Extract medical information with OpenAI
        logger.info('PatientPortal', 'Extracting medical information from transcript');

        const medicalInfo = await extractMedicalInfoFromTranscript(transcript);

        // Merge extracted medical information
        extractedData.diagnoses = medicalInfo.diagnoses;
        extractedData.medications = medicalInfo.medications;
        extractedData.allergies = medicalInfo.allergies;
        extractedData.symptoms = medicalInfo.symptoms;
        extractedData.vitals = medicalInfo.vitals;
        extractedData.chief_complaint = medicalInfo.chief_complaint;
        extractedData.family_history = medicalInfo.family_history;
        extractedData.notes = medicalInfo.notes;

        logger.info('PatientPortal', 'Voice upload processed successfully', {
          transcriptLength: transcript.length,
          diagnoses: extractedData.diagnoses.length,
          medications: extractedData.medications.length,
          symptoms: extractedData.symptoms?.length || 0
        });

      } catch (voiceError) {
        logger.error('PatientPortal', 'Voice processing error', {
          error: voiceError.message,
          stack: voiceError.stack
        });

        // Store error but don't completely fail
        extractedData.raw_content = `[Voice processing failed: ${voiceError.message}]`;
        extractedData.processing_error = voiceError.message;
      }
    }

    // Store upload record
    const uploadData = {
      patient_id: patient.id,
      tshla_id: normalizedTshId,
      upload_method: uploadMethod,
      raw_content: extractedData.raw_content,
      extracted_data: extractedData,
      uploaded_at: new Date().toISOString(),
      session_id: sessionId
    };

    // Add file metadata if available (from PDF or other file uploads)
    if (extractedData.file_url) {
      uploadData.file_url = extractedData.file_url;
      uploadData.file_name = extractedData.file_name;
      uploadData.file_type = extractedData.file_type;
      uploadData.file_size_bytes = extractedData.file_size_bytes;
    }

    // Set processing status
    if (extractedData.processing_error) {
      uploadData.ai_processing_status = 'failed';
      uploadData.ai_processing_error = extractedData.processing_error;
    } else if (extractedData.diagnoses?.length > 0 ||
               extractedData.medications?.length > 0 ||
               extractedData.labs?.length > 0 ||
               extractedData.procedures?.length > 0 ||
               extractedData.allergies?.length > 0 ||
               extractedData.symptoms?.length > 0 ||
               extractedData.raw_content?.length > 0) {
      uploadData.ai_processing_status = 'completed';
      uploadData.processed_at = new Date().toISOString();
    } else {
      uploadData.ai_processing_status = 'pending';
    }

    const { data: uploadRecord, error: uploadError } = await supabase
      .from('patient_document_uploads')
      .insert(uploadData)
      .select()
      .single();

    if (uploadError) {
      logger.error('PatientPortal', 'Failed to store upload', {
        error: uploadError.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to save upload'
      });
    }

    // Log access for HIPAA compliance
    await supabase
      .from('access_logs')
      .insert({
        user_type: 'patient',
        user_id: patient.id,
        action: 'document_upload',
        resource_type: 'patient_document',
        resource_id: uploadRecord.id,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        details: { upload_method: uploadMethod, tshla_id: normalizedTshId }
      });

    logger.info('PatientPortal', 'Document upload completed', {
      tshlaId: normalizedTshId,
      uploadId: uploadRecord.id
    });

    res.json({
      success: true,
      uploadId: uploadRecord.id,
      message: 'Document uploaded successfully. Our team will review and add information to your chart.'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Upload error', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to process upload. Please try again.'
    });
  }
});

/**
 * GET /api/patient-portal/medical-records
 * Get patient's uploaded documents and extracted lab data
 */
router.get('/medical-records', async (req, res) => {
  try {
    const { tshlaId, sessionId } = req.query;

    if (!tshlaId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Fetching medical records', {
      tshlaId: normalizedTshId
    });

    // Verify patient exists (try both formats)
    let patient = null;
    const result1 = await supabase
      .from('unified_patients')
      .select('id, first_name, last_name, tshla_id')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('id, first_name, last_name, tshla_id')
        .eq('tshla_id', formatted)
        .maybeSingle();
      patient = result2.data;
    }

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Get all uploaded documents for this patient
    const { data: uploads, error: uploadsError } = await supabase
      .from('patient_document_uploads')
      .select('*')
      .eq('patient_id', patient.id)
      .order('uploaded_at', { ascending: false });

    if (uploadsError) {
      logger.error('PatientPortal', 'Error fetching uploads', {
        error: uploadsError.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch medical records'
      });
    }

    // Aggregate all labs and medications from uploads
    const allLabs = [];
    const allMedications = [];
    const medicationNames = new Set(); // Track unique names
    const allAllergies = new Set();

    uploads.forEach(upload => {
      if (upload.extracted_data) {
        const e = upload.extracted_data;

        // Collect labs
        if (e.labs && Array.isArray(e.labs)) {
          e.labs.forEach(lab => {
            allLabs.push({
              ...lab,
              upload_date: upload.uploaded_at,
              upload_id: upload.id
            });
          });
        }

        // Collect medications (handle both old string format and new object format)
        if (e.medications && Array.isArray(e.medications)) {
          e.medications.forEach(med => {
            // Handle new object format {name, dosage, frequency, etc}
            if (typeof med === 'object' && med.name) {
              const medName = med.name.toLowerCase();
              if (!medicationNames.has(medName) && med.name !== 'AthenaHealth') {
                medicationNames.add(medName);
                allMedications.push({
                  name: med.name,
                  dosage: med.dosage || '',
                  frequency: med.frequency || '',
                  route: med.route || '',
                  sig: med.sig || '',
                  status: med.status || 'active'
                });
              }
            }
            // Handle old string format (for backwards compatibility)
            else if (typeof med === 'string') {
              const medName = med.toLowerCase();
              if (!medicationNames.has(medName) && med !== 'AthenaHealth') {
                medicationNames.add(medName);
                allMedications.push({
                  name: med,
                  dosage: '',
                  frequency: '',
                  route: '',
                  sig: '',
                  status: 'active'
                });
              }
            }
          });
        }

        // Collect allergies
        if (e.allergies && Array.isArray(e.allergies)) {
          e.allergies.forEach(allergy => allAllergies.add(allergy));
        }
      }
    });

    // Organize labs by name and deduplicate by date+value
    const labsByName = {};
    allLabs.forEach(lab => {
      if (!labsByName[lab.name]) {
        labsByName[lab.name] = [];
      }

      // Check if this exact lab (same date and value) already exists
      const dateStr = new Date(lab.upload_date).toISOString().split('T')[0]; // Just the date part
      const isDuplicate = labsByName[lab.name].some(existing => {
        const existingDateStr = new Date(existing.date).toISOString().split('T')[0];
        return existingDateStr === dateStr &&
               existing.value === lab.value &&
               existing.unit === lab.unit;
      });

      // Only add if not a duplicate
      if (!isDuplicate) {
        labsByName[lab.name].push({
          value: lab.value,
          unit: lab.unit,
          date: lab.upload_date
        });
      }
    });

    // Log access
    await supabase
      .from('access_logs')
      .insert({
        user_type: 'patient',
        user_id: patient.id,
        action: 'view_medical_records',
        resource_type: 'patient_documents',
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        details: { tshla_id: normalizedTshId, upload_count: uploads.length }
      });

    res.json({
      success: true,
      patient: {
        name: `${patient.first_name} ${patient.last_name}`,
        tshla_id: patient.tshla_id
      },
      uploads: uploads.map(u => ({
        id: u.id,
        upload_method: u.upload_method,
        uploaded_at: u.uploaded_at,
        lab_count: u.extracted_data?.labs?.length || 0,
        medication_count: u.extracted_data?.medications?.length || 0,
        allergy_count: u.extracted_data?.allergies?.length || 0
      })),
      labs: labsByName,
      medications: allMedications, // Already an array
      allergies: Array.from(allAllergies),
      total_uploads: uploads.length,
      total_labs: allLabs.length,
      total_medications: allMedications.length
    });

  } catch (error) {
    logger.error('PatientPortal', 'Medical records error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical records'
    });
  }
});

/**
 * POST /api/patient-portal/admin/clear-rate-limit
 * Clear rate limiting for a specific TSH ID or IP (admin only)
 */
router.post('/admin/clear-rate-limit', async (req, res) => {
  try {
    const { tshlaId, clearAll } = req.body;

    if (clearAll === true) {
      // Clear all rate limits
      loginAttempts.clear();
      logger.info('PatientPortal', 'Cleared all rate limits');
      return res.json({
        success: true,
        message: 'All rate limits cleared'
      });
    }

    if (tshlaId) {
      // Clear rate limits for specific TSH ID
      const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
      let cleared = 0;

      // Remove all entries that contain this TSH ID
      for (const [key, value] of loginAttempts.entries()) {
        if (key.includes(normalizedTshId)) {
          loginAttempts.delete(key);
          cleared++;
        }
      }

      logger.info('PatientPortal', 'Cleared rate limits', { tshlaId: normalizedTshId, count: cleared });
      return res.json({
        success: true,
        message: `Cleared ${cleared} rate limit(s) for TSH ID ${normalizedTshId}`
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Must provide tshlaId or clearAll=true'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Clear rate limit error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to clear rate limit'
    });
  }
});

/**
 * GET /api/patient-portal/medications/refill-queue
 * Get all medications that need refill processing (staff view)
 * Grouped by patient with their pharmacy information
 */
router.get('/medications/refill-queue', async (req, res) => {
  try {
    logger.info('PatientPortal', 'Loading medication refill queue for staff', {});

    // Get all medications flagged for refill or pharmacy send
    const { data: medications, error: medsError } = await supabase
      .from('patient_medications')
      .select(`
        id,
        patient_id,
        tshla_id,
        medication_name,
        dosage,
        frequency,
        route,
        sig,
        status,
        need_refill,
        refill_requested_at,
        send_to_pharmacy,
        sent_to_pharmacy_at,
        sent_to_pharmacy_by,
        pharmacy_name,
        created_at,
        updated_at
      `)
      .or('need_refill.eq.true,send_to_pharmacy.eq.true')
      .eq('status', 'active')
      .order('refill_requested_at', { ascending: true, nullsFirst: false });

    if (medsError) {
      // If columns don't exist yet (migration not run), return empty queue
      if (medsError.message && medsError.message.includes('column') && medsError.message.includes('does not exist')) {
        logger.warn('PatientPortal', 'Refill tracking columns not yet added - migration needed', {
          error: medsError.message
        });
        return res.json({
          success: true,
          queue: [],
          summary: {
            totalPatients: 0,
            totalMedications: 0,
            totalPending: 0,
            totalSent: 0
          },
          message: 'Database migration pending - pharmacy fields not yet available'
        });
      }
      throw medsError;
    }

    // Handle no medications case
    if (!medications || medications.length === 0) {
      return res.json({
        success: true,
        queue: [],
        summary: {
          totalPatients: 0,
          totalMedications: 0,
          totalPending: 0,
          totalSent: 0
        }
      });
    }

    // Get unique patient IDs
    const patientIds = [...new Set(medications.map(m => m.patient_id))];

    // Handle no patient IDs case
    if (patientIds.length === 0) {
      return res.json({
        success: true,
        queue: [],
        summary: {
          totalPatients: 0,
          totalMedications: 0,
          totalPending: 0,
          totalSent: 0
        }
      });
    }

    // Get patient information including pharmacy (if columns exist)
    let patients;
    let patientsError;

    // Try to fetch with pharmacy columns first
    const pharmacyQuery = await supabase
      .from('unified_patients')
      .select(`
        id,
        tshla_id,
        first_name,
        last_name,
        phone_primary,
        phone_display,
        preferred_pharmacy_name,
        preferred_pharmacy_phone,
        preferred_pharmacy_address,
        preferred_pharmacy_fax
      `)
      .in('id', patientIds);

    // If pharmacy columns don't exist (column not found error), fall back to basic query
    if (pharmacyQuery.error && pharmacyQuery.error.message && pharmacyQuery.error.message.includes('column')) {
      logger.warn('PatientPortal', 'Pharmacy columns not found, using basic patient query', {
        error: pharmacyQuery.error.message
      });

      const basicQuery = await supabase
        .from('unified_patients')
        .select(`
          id,
          tshla_id,
          first_name,
          last_name,
          phone_primary,
          phone_display
        `)
        .in('id', patientIds);

      patients = basicQuery.data;
      patientsError = basicQuery.error;
    } else {
      patients = pharmacyQuery.data;
      patientsError = pharmacyQuery.error;
    }

    if (patientsError) {
      throw patientsError;
    }

    // Create patient lookup map
    const patientMap = new Map(patients.map(p => [p.id, p]));

    // Group medications by patient
    const patientGroups = {};

    medications.forEach(med => {
      const patient = patientMap.get(med.patient_id);
      if (!patient) return;

      const patientKey = patient.id;

      if (!patientGroups[patientKey]) {
        patientGroups[patientKey] = {
          patient: {
            id: patient.id,
            tshla_id: patient.tshla_id,
            name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
            phone: patient.phone_display || patient.phone_primary,
            pharmacy: {
              name: patient.preferred_pharmacy_name || null,
              phone: patient.preferred_pharmacy_phone || null,
              address: patient.preferred_pharmacy_address || null,
              fax: patient.preferred_pharmacy_fax || null
            }
          },
          medications: [],
          totalPending: 0,
          totalSent: 0
        };
      }

      patientGroups[patientKey].medications.push(med);

      // Count pending vs sent
      if (med.send_to_pharmacy && !med.sent_to_pharmacy_at) {
        patientGroups[patientKey].totalPending++;
      } else if (med.sent_to_pharmacy_at) {
        patientGroups[patientKey].totalSent++;
      }
    });

    // Convert to array and sort by most pending
    const refillQueue = Object.values(patientGroups).sort((a, b) => {
      return b.totalPending - a.totalPending;
    });

    logger.info('PatientPortal', 'Refill queue loaded', {
      totalPatients: refillQueue.length,
      totalMedications: medications.length
    });

    res.json({
      success: true,
      queue: refillQueue,
      summary: {
        totalPatients: refillQueue.length,
        totalMedications: medications.length,
        totalPending: refillQueue.reduce((sum, g) => sum + g.totalPending, 0),
        totalSent: refillQueue.reduce((sum, g) => sum + g.totalSent, 0)
      }
    });

  } catch (error) {
    logger.error('PatientPortal', 'Refill queue error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to load refill queue'
    });
  }
});
/**
 * GET /api/patient-portal/medications/:tshlaId
 * Get medications for a patient with full management data
 */
router.get('/medications/:tshlaId', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Fetching medications', {
      tshlaId: normalizedTshId,
      originalParam: tshlaId
    });

    // Try both formats (TSH123001 and TSH 123-001)
    const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    logger.info('PatientPortal', 'Searching for medications with TSH IDs', {
      normalized: normalizedTshId,
      formatted: formatted
    });

    // Get medications from patient_medications table
    const { data: medications, error } = await supabase
      .from('patient_medications')
      .select('*')
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`)
      .order('status', { ascending: true }) // 'active' comes before 'prior'
      .order('medication_name', { ascending: true});

    if (error) {
      logger.error('PatientPortal', 'Get medications query error', {
        error: error.message,
        code: error.code
      });
      throw error;
    }

    logger.info('PatientPortal', 'Found medications', {
      count: medications?.length || 0
    });

    res.json({
      success: true,
      medications: medications || []
    });

  } catch (error) {
    logger.error('PatientPortal', 'Get medications error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medications'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:tshlaId/update-status
 * Update medication status (active <-> prior)
 */
router.post('/medications/:tshlaId/update-status', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const { medicationId, newStatus, staffId, reason } = req.body;

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Updating medication status', {
      tshlaId: normalizedTshId,
      medicationId,
      newStatus
    });

    // Prepare update data
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // If discontinuing, add tracking
    if (newStatus === 'prior' || newStatus === 'discontinued') {
      updateData.discontinued_at = new Date().toISOString();
      if (staffId) updateData.discontinued_by = staffId;
      if (reason) updateData.discontinue_reason = reason;
    }

    // Update medication
    // Note: We only need to filter by medication ID since it's unique
    // No need to filter by tshla_id which can have format inconsistencies
    const { data, error } = await supabase
      .from('patient_medications')
      .update(updateData)
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      medication: data
    });

  } catch (error) {
    logger.error('PatientPortal', 'Update medication status error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update medication status'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:tshlaId/update-flags
 * Update medication flags (need_refill, send_to_pharmacy)
 */
router.post('/medications/:tshlaId/update-flags', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const { medicationId, needRefill, sendToPharmacy, staffId } = req.body;

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Updating medication flags', {
      tshlaId: normalizedTshId,
      medicationId,
      needRefill,
      sendToPharmacy
    });

    // Prepare update data
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (typeof needRefill === 'boolean') {
      updateData.need_refill = needRefill;
      if (needRefill) {
        updateData.refill_requested_at = new Date().toISOString();
      }
    }

    if (typeof sendToPharmacy === 'boolean') {
      updateData.send_to_pharmacy = sendToPharmacy;
      if (sendToPharmacy) {
        updateData.sent_to_pharmacy_at = new Date().toISOString();
        if (staffId) updateData.sent_to_pharmacy_by = staffId;
      }
    }

    // Update medication
    // Note: We only need to filter by medication ID since it's unique
    // No need to filter by tshla_id which can have format inconsistencies
    const { data, error } = await supabase
      .from('patient_medications')
      .update(updateData)
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      medication: data
    });

  } catch (error) {
    logger.error('PatientPortal', 'Update medication flags error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update medication flags'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:tshlaId/import-from-uploads
 * Import medications from uploaded documents into patient_medications table
 */
router.post('/medications/:tshlaId/import-from-uploads', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    logger.info('PatientPortal', 'Importing medications from uploads', { tshlaId: normalizedTshId });

    // 1. Get patient ID (try both normalized and formatted versions)
    let patient, patientError;

    // Try normalized format first (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('id, tshla_id')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const result2 = await supabase
        .from('unified_patients')
        .select('id, tshla_id')
        .eq('tshla_id', formatted)
        .maybeSingle();

      patient = result2.data;
      patientError = result2.error;
    }

    if (patientError || !patient) {
      throw new Error('Patient not found');
    }

    logger.info('PatientPortal', 'Found patient', {
      tshlaId: patient.tshla_id,
      patientId: patient.id
    });

    // 2. Get all uploaded medications (use actual TSH ID from database)
    // Don't filter by ai_processing_status - if medications are in extracted_data, use them
    // Search for both TSH ID formats since uploads might use normalized version
    const { data: uploads, error: uploadsError } = await supabase
      .from('patient_document_uploads')
      .select('id, extracted_data, uploaded_at, ai_processing_status, tshla_id')
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`);

    if (uploadsError) {
      throw uploadsError;
    }

    logger.info('PatientPortal', 'Found uploads', {
      count: uploads?.length || 0,
      searchedFor: [normalizedTshId, formatted],
      foundTshIds: uploads?.map(u => u.tshla_id)
    });

    // 3. Collect all unique medications
    const medicationsToImport = [];
    const seenMeds = new Set();

    for (const upload of uploads || []) {
      const meds = upload.extracted_data?.medications || [];

      for (const med of meds) {
        const medName = typeof med === 'string' ? med : med.name;
        const medKey = medName.toLowerCase();

        if (!seenMeds.has(medKey) && medName && medName !== 'AthenaHealth') {
          seenMeds.add(medKey);

          medicationsToImport.push({
            patient_id: patient.id,
            tshla_id: patient.tshla_id, // Use actual TSH ID from database
            medication_name: medName,
            dosage: typeof med === 'object' ? med.dosage || '' : '',
            frequency: typeof med === 'object' ? med.frequency || '' : '',
            route: typeof med === 'object' ? med.route || '' : '',
            sig: typeof med === 'object' ? med.sig || '' : '',
            status: typeof med === 'object' && med.status ? med.status : 'active',
            source: 'ccd_upload',
            source_upload_id: upload.id,
            need_refill: false,
            send_to_pharmacy: false
          });
        }
      }
    }

    // 4. Insert medications (upsert to avoid duplicates)
    let imported = 0;
    const errors = [];
    const skipped = [];

    logger.info('PatientPortal', 'Starting import of medications', {
      count: medicationsToImport.length,
      sampleMed: medicationsToImport[0]
    });

    for (const med of medicationsToImport) {
      // Check if medication already exists (check both TSH ID formats)
      const { data: existing, error: checkError } = await supabase
        .from('patient_medications')
        .select('id')
        .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`)
        .eq('medication_name', med.medication_name)
        .maybeSingle();

      if (checkError) {
        logger.error('PatientPortal', 'Check existing medication error', {
          med: med.medication_name,
          error: checkError.message,
          code: checkError.code
        });
        errors.push({
          medication: med.medication_name,
          error: checkError.message,
          step: 'check'
        });
        continue;
      }

      if (existing) {
        skipped.push(med.medication_name);
        continue;
      }

      // Insert medication
      const { data: inserted, error: insertError } = await supabase
        .from('patient_medications')
        .insert(med)
        .select();

      if (insertError) {
        logger.error('PatientPortal', 'Insert medication error', {
          med: med.medication_name,
          error: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        });
        errors.push({
          medication: med.medication_name,
          error: insertError.message,
          code: insertError.code,
          details: insertError.details,
          step: 'insert'
        });
      } else {
        imported++;
        logger.info('PatientPortal', 'Medication inserted', {
          id: inserted[0]?.id,
          name: med.medication_name
        });
      }
    }

    logger.info('PatientPortal', 'Medications import complete', {
      tshlaId: normalizedTshId,
      total: medicationsToImport.length,
      imported,
      skipped: skipped.length,
      errors: errors.length
    });

    res.json({
      success: true,
      total: medicationsToImport.length,
      imported,
      skipped: skipped.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Imported ${imported} new medications from uploaded documents${skipped.length > 0 ? ` (${skipped.length} already existed)` : ''}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
    });

  } catch (error) {
    logger.error('PatientPortal', 'Import medications error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to import medications'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:tshlaId/import-from-hp
 * Import medications from H&P comprehensive chart into patient_medications table
 * This syncs AI-extracted medications from dictations to the patient portal
 */
router.post('/medications/:tshlaId/import-from-hp', async (req, res) => {
  const { tshlaId } = req.params;

  logger.info('PatientPortal', 'Import medications from H&P', {
    tshlaId,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  try {
    // 1. Get patient by TSH ID (normalize with/without space and dash)
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('id, tshla_id, phone_primary, first_name, last_name')
      .or(`tshla_id.eq.${tshlaId},tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .maybeSingle();

    if (patientError) {
      logger.error('PatientPortal', 'Patient lookup error', { error: patientError.message, tshlaId });
      return res.status(500).json({
        success: false,
        error: 'Failed to find patient'
      });
    }

    if (!patient) {
      logger.warn('PatientPortal', 'Patient not found for H&P import', { tshlaId });
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // 2. Get H&P medications from comprehensive chart
    const { data: hpChart, error: hpError } = await supabase
      .from('patient_comprehensive_chart')
      .select('medications, last_updated, version')
      .eq('patient_phone', patient.phone_primary)
      .maybeSingle();

    if (hpError) {
      logger.error('PatientPortal', 'H&P chart lookup error', { error: hpError.message, patientPhone: patient.phone_primary });
      return res.status(500).json({
        success: false,
        error: 'Failed to load H&P chart'
      });
    }

    if (!hpChart || !hpChart.medications || hpChart.medications.length === 0) {
      logger.info('PatientPortal', 'No medications in H&P chart', { tshlaId, patientPhone: patient.phone_primary });
      return res.json({
        success: true,
        message: 'No medications found in H&P chart',
        imported: 0,
        skipped: 0
      });
    }

    // 3. Get existing medications in patient_medications table
    const { data: existingMeds, error: existingError } = await supabase
      .from('patient_medications')
      .select('medication_name, dosage, frequency')
      .eq('patient_id', patient.id);

    if (existingError) {
      logger.error('PatientPortal', 'Existing medications lookup error', { error: existingError.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to load existing medications'
      });
    }

    // Create lookup set for duplicates
    const existingMedSet = new Set(
      (existingMeds || []).map(m =>
        `${m.medication_name?.toLowerCase()}-${m.dosage?.toLowerCase()}-${m.frequency?.toLowerCase()}`
      )
    );

    // 4. Transform H&P medications to patient_medications format
    const medsToImport = [];
    const skippedMeds = [];

    for (const hpMed of hpChart.medications) {
      // Create lookup key
      const lookupKey = `${hpMed.name?.toLowerCase() || ''}-${hpMed.dose?.toLowerCase() || ''}-${hpMed.frequency?.toLowerCase() || ''}`;

      // Skip if already exists
      if (existingMedSet.has(lookupKey)) {
        skippedMeds.push(hpMed.name);
        continue;
      }

      // Map H&P fields to patient_medications fields
      const medToInsert = {
        patient_id: patient.id,
        tshla_id: patient.tshla_id,
        medication_name: hpMed.name || '',
        dosage: hpMed.dose || '',
        frequency: hpMed.frequency || '',
        route: hpMed.route || null,
        sig: hpMed.indication || null,
        prescribed_by: hpMed.prescribedBy || null,
        status: (hpMed.active === false || hpMed.status === 'discontinued') ? 'prior' : 'active',
        source: 'hp_import',
        need_refill: false,
        send_to_pharmacy: false
      };

      medsToImport.push(medToInsert);
    }

    // 5. Insert new medications
    let importedCount = 0;
    if (medsToImport.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('patient_medications')
        .insert(medsToImport)
        .select('id');

      if (insertError) {
        logger.error('PatientPortal', 'Medication insert error', {
          error: insertError.message,
          count: medsToImport.length
        });
        return res.status(500).json({
          success: false,
          error: 'Failed to import medications'
        });
      }

      importedCount = inserted?.length || 0;
    }

    logger.info('PatientPortal', 'H&P medications imported', {
      tshlaId,
      patientName: `${patient.first_name} ${patient.last_name}`,
      imported: importedCount,
      skipped: skippedMeds.length,
      hpVersion: hpChart.version
    });

    res.json({
      success: true,
      message: `Imported ${importedCount} medication(s) from H&P chart`,
      imported: importedCount,
      skipped: skippedMeds.length,
      skippedMedications: skippedMeds
    });

  } catch (error) {
    logger.error('PatientPortal', 'Import from H&P error', {
      error: error.message,
      stack: error.stack,
      tshlaId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to import medications from H&P'
    });
  }
});


/**
 * POST /api/patient-portal/medications/:medicationId/process-refill
 * Mark medication as sent to pharmacy (staff action)
 */
router.post('/medications/:medicationId/process-refill', async (req, res) => {
  try {
    const { medicationId } = req.params;
    const {
      staffId,
      staffName,
      pharmacyName,
      refillDurationDays,
      refillQuantity,
      confirmationNumber,
      notes
    } = req.body;

    logger.info('PatientPortal', 'Processing medication refill', {
      medicationId,
      staffId,
      refillDurationDays
    });

    const now = new Date().toISOString();

    // Calculate next refill due date
    let nextRefillDueDate = null;
    if (refillDurationDays) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + refillDurationDays);
      nextRefillDueDate = dueDate.toISOString();
    }

    // Update medication record
    const { data, error } = await supabase
      .from('patient_medications')
      .update({
        send_to_pharmacy: true,
        sent_to_pharmacy_at: now,
        sent_to_pharmacy_by: staffId,
        pharmacy_name: pharmacyName,
        refill_duration_days: refillDurationDays,
        refill_quantity: refillQuantity,
        last_refill_date: now,
        next_refill_due_date: nextRefillDueDate,
        refill_count: supabase.sql`COALESCE(refill_count, 0) + 1`,
        refill_notes: notes,
        sent_to_pharmacy_confirmation: confirmationNumber,
        need_refill: false, // Clear the patient flag
        updated_at: now
      })
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the action
    await supabase
      .from('access_logs')
      .insert({
        user_type: 'staff',
        user_id: staffId,
        action: 'process_medication_refill',
        resource_type: 'patient_medication',
        resource_id: medicationId,
        details: {
          medication_id: medicationId,
          pharmacy_name: pharmacyName,
          refill_duration_days: refillDurationDays,
          staff_name: staffName,
          confirmation: confirmationNumber
        }
      });

    logger.info('PatientPortal', 'Medication refill processed', {
      medicationId,
      pharmacyName,
      refillDurationDays
    });

    res.json({
      success: true,
      medication: data,
      message: 'Refill processed and sent to pharmacy successfully'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Process refill error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to process refill'
    });
  }
});

/**
 * POST /api/patient-portal/medications/:medicationId/clear-refill-flag
 * Remove medication from refill queue by clearing send_to_pharmacy flag
 */
router.post('/medications/:medicationId/clear-refill-flag', async (req, res) => {
  try {
    const { medicationId } = req.params;

    logger.info('PatientPortal', 'Clearing refill flag for medication', {
      medicationId
    });

    // Update medication record to clear flags
    const { data, error } = await supabase
      .from('patient_medications')
      .update({
        send_to_pharmacy: false,
        need_refill: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('PatientPortal', 'Refill flag cleared', {
      medicationId
    });

    res.json({
      success: true,
      medication: data,
      message: 'Medication removed from refill queue'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Clear refill flag error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to remove medication from refill queue'
    });
  }
});

/**
 * GET /api/patient-portal/patients/:tshlaId
 * Get patient information including pharmacy details
 */
router.get('/patients/:tshlaId', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Fetching patient information', {
      tshlaId: normalizedTshId
    });

    // Try both formats (TSH123001 and TSH 123-001)
    const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    // Try to fetch with pharmacy columns first
    let data, error;

    const pharmacyQuery = await supabase
      .from('unified_patients')
      .select(`
        id,
        tshla_id,
        first_name,
        last_name,
        phone_primary,
        phone_display,
        email,
        preferred_pharmacy_name,
        preferred_pharmacy_phone,
        preferred_pharmacy_address,
        preferred_pharmacy_fax
      `)
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`)
      .single();

    // If pharmacy columns don't exist, fall back to basic query
    if (pharmacyQuery.error && pharmacyQuery.error.message && pharmacyQuery.error.message.includes('column')) {
      logger.warn('PatientPortal', 'Pharmacy columns not found, using basic patient query', {
        error: pharmacyQuery.error.message
      });

      const basicQuery = await supabase
        .from('unified_patients')
        .select(`
          id,
          tshla_id,
          first_name,
          last_name,
          phone_primary,
          phone_display,
          email
        `)
        .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`)
        .single();

      data = basicQuery.data;
      error = basicQuery.error;

      // Add null pharmacy fields for consistency
      if (data) {
        data.preferred_pharmacy_name = null;
        data.preferred_pharmacy_phone = null;
        data.preferred_pharmacy_address = null;
        data.preferred_pharmacy_fax = null;
      }
    } else {
      data = pharmacyQuery.data;
      error = pharmacyQuery.error;
    }

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    logger.info('PatientPortal', 'Patient information retrieved', {
      tshlaId: normalizedTshId
    });

    res.json({
      success: true,
      patient: data
    });

  } catch (error) {
    logger.error('PatientPortal', 'Get patient error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve patient information'
    });
  }
});

/**
 * POST /api/patient-portal/patients/:tshlaId/pharmacy
 * Update patient's preferred pharmacy information
 */
router.post('/patients/:tshlaId/pharmacy', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const { pharmacyName, pharmacyPhone, pharmacyAddress, pharmacyFax } = req.body;

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Updating pharmacy information', {
      tshlaId: normalizedTshId
    });

    // Update patient pharmacy info (try both TSH ID formats)
    const { data, error } = await supabase
      .from('unified_patients')
      .update({
        preferred_pharmacy_name: pharmacyName,
        preferred_pharmacy_phone: pharmacyPhone,
        preferred_pharmacy_address: pharmacyAddress,
        preferred_pharmacy_fax: pharmacyFax,
        updated_at: new Date().toISOString()
      })
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2')}`)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('PatientPortal', 'Pharmacy information updated', {
      tshlaId: normalizedTshId,
      pharmacyName
    });

    res.json({
      success: true,
      patient: data,
      message: 'Pharmacy information updated successfully'
    });

  } catch (error) {
    logger.error('PatientPortal', 'Update pharmacy error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update pharmacy information'
    });
  }
});

/**
 * GET /api/patient-portal/dictations/:tshlaId
 * Get all dictations (with audio) for a patient
 */
router.get('/dictations/:tshlaId', async (req, res) => {
  try {
    const { tshlaId } = req.params;
    const sessionId = req.headers['x-session-id'];

    // Normalize TSH ID
    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    logger.info('PatientPortal', 'Load dictations request', {
      tshlaId: normalizedTshId,
      sessionId
    });

    // Verify session ownership
    // First check in-memory sessions (fast path)
    let session = activeSessions.get(sessionId);

    // If not in memory (server restart), validate against database
    if (!session) {
      logger.info('PatientPortal', 'Session not in memory, checking database', { sessionId });

      // Try to find by session ID first
      let dbSession = null;
      const { data: sessionById, error: byIdError } = await supabase
        .from('patient_portal_sessions')
        .select('tshla_id, patient_phone')
        .eq('id', sessionId)
        .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (sessionById) {
        dbSession = sessionById;
      } else {
        // Fallback: Check for any recent session for this TSH ID (for backward compatibility)
        logger.info('PatientPortal', 'Session ID not found, checking by TSH ID', { tshlaId: normalizedTshId });
        const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
        const { data: sessionByTshId } = await supabase
          .from('patient_portal_sessions')
          .select('tshla_id, patient_phone')
          .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formatted}`)
          .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
          .order('session_start', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionByTshId) {
          dbSession = sessionByTshId;
          logger.info('PatientPortal', 'Session found by TSH ID', { tshlaId: sessionByTshId.tshla_id });
        }
      }

      if (dbSession) {
        session = { tshlaId: dbSession.tshla_id };
      }
    }

    // Normalize session TSH ID for comparison (handle both formats)
    const sessionTshIdNormalized = session?.tshlaId?.replace(/[\s-]/g, '').toUpperCase();

    if (!session || sessionTshIdNormalized !== normalizedTshId) {
      logger.warn('PatientPortal', 'Session validation failed', {
        hasSession: !!session,
        sessionTshId: session?.tshlaId,
        sessionTshIdNormalized,
        requestedTshId: normalizedTshId,
        sessionId
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied - Session expired. Please log in again.'
      });
    }

    // Get patient to find phone number
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('phone_primary, phone_display')
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2')}`)
      .maybeSingle();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Fetch all dictations for this patient by phone
    // Need to handle phone format variations: "8324492930" vs "(832) 449-2930" vs "+18324492930"
    const digitsOnly = patient.phone_primary?.replace(/\D/g, '');
    const phoneVariations = [
      patient.phone_primary, // Original format (e.g., "8324492930")
      patient.phone_display, // Display format (e.g., "(832) 449-2930")
      digitsOnly, // Digits only
      digitsOnly ? `(${digitsOnly.substring(0,3)}) ${digitsOnly.substring(3,6)}-${digitsOnly.substring(6)}` : null, // Formatted
      digitsOnly ? `+1${digitsOnly}` : null // E.164 format
    ].filter(Boolean);

    logger.info('PatientPortal', 'Searching for dictations with phone variations', {
      tshlaId: normalizedTshId,
      phoneVariations
    });

    // Query with IN operator for all phone variations (more reliable than OR with special chars)
    const { data: dictations, error: dictError } = await supabase
      .from('dictated_notes')
      .select('id, provider_name, patient_name, visit_date, raw_transcript, processed_note, ai_summary, audio_url, audio_deleted, audio_deleted_at, audio_generated_at, created_at, dictated_at')
      .in('patient_phone', phoneVariations)
      .order('created_at', { ascending: false });

    if (dictError) {
      throw dictError;
    }

    // Fetch patient-friendly summaries and audio URLs from patient_audio_summaries
    const dictationIds = (dictations || []).map(d => d.id).filter(Boolean);
    let summaryMap = {};
    if (dictationIds.length > 0) {
      const { data: summaries } = await supabase
        .from('patient_audio_summaries')
        .select('dictation_id, summary_script, audio_blob_url')
        .in('dictation_id', dictationIds);

      (summaries || []).forEach(s => {
        summaryMap[s.dictation_id] = s;
      });
    }

    // Format dictations for frontend, preferring patient-friendly data
    const formattedDictations = (dictations || []).map(d => {
      const patientSummary = summaryMap[d.id];
      return {
        id: d.id,
        provider_name: d.provider_name || 'Dr. Unknown',
        patient_name: d.patient_name,
        visit_date: d.visit_date || d.dictated_at || d.created_at,
        summary_text: patientSummary?.summary_script || d.ai_summary || d.processed_note || d.raw_transcript || '',
        audio_url: patientSummary?.audio_blob_url || (d.audio_deleted ? null : d.audio_url),
        audio_deleted: d.audio_deleted || false,
        audio_deleted_at: d.audio_deleted_at,
        created_at: d.created_at,
        has_audio: !!(patientSummary || (d.audio_url && !d.audio_deleted))
      };
    });

    logger.info('PatientPortal', 'Dictations loaded', {
      tshlaId: normalizedTshId,
      count: formattedDictations.length
    });

    res.json({
      success: true,
      dictations: formattedDictations,
      count: formattedDictations.length
    });

  } catch (error) {
    logger.error('PatientPortal', 'Load dictations error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to load dictations'
    });
  }
});

/**
 * DELETE /api/patient-portal/dictations/:dictationId/audio
 * Patient-initiated audio file deletion (soft delete)
 */
router.delete('/dictations/:dictationId/audio', async (req, res) => {
  try {
    const { dictationId } = req.params;
    const sessionId = req.headers['x-session-id'];

    logger.info('PatientPortal', 'Delete dictation audio request', {
      dictationId,
      sessionId
    });

    // Verify session exists
    // First check in-memory sessions (fast path)
    let session = activeSessions.get(sessionId);

    // If not in memory (server restart), validate against database
    if (!session) {
      logger.info('PatientPortal', 'Session not in memory for delete, checking database', { sessionId });

      // Try to find by session ID first
      let dbSession = null;
      const { data: sessionById } = await supabase
        .from('patient_portal_sessions')
        .select('tshla_id, patient_phone')
        .eq('id', sessionId)
        .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (sessionById) {
        dbSession = sessionById;
      } else {
        // Fallback: Check for any recent session (for backward compatibility)
        logger.info('PatientPortal', 'Session ID not found for delete, checking recent sessions');
        const { data: recentSession } = await supabase
          .from('patient_portal_sessions')
          .select('tshla_id, patient_phone')
          .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
          .order('session_start', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentSession) {
          dbSession = recentSession;
          logger.info('PatientPortal', 'Session found by recent activity', { tshlaId: recentSession.tshla_id });
        }
      }

      if (dbSession) {
        session = { tshlaId: dbSession.tshla_id };
      }
    }

    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Session expired. Please log in again.'
      });
    }

    // Get dictation to verify ownership
    const { data: dictation, error: fetchError } = await supabase
      .from('dictated_notes')
      .select('id, patient_phone, audio_url, audio_deleted')
      .eq('id', dictationId)
      .maybeSingle();

    if (fetchError || !dictation) {
      return res.status(404).json({
        success: false,
        error: 'Dictation not found'
      });
    }

    // Verify patient ownership via phone number
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('phone_primary')
      .eq('tshla_id', session.tshlaId)
      .maybeSingle();

    if (!patient || patient.phone_primary !== dictation.patient_phone) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Already deleted?
    if (dictation.audio_deleted) {
      return res.json({
        success: true,
        message: 'Audio already deleted',
        already_deleted: true
      });
    }

    // Soft delete: Mark as deleted but keep URL for potential recovery
    const { error: updateError } = await supabase
      .from('dictated_notes')
      .update({
        audio_deleted: true,
        audio_deleted_at: new Date().toISOString()
      })
      .eq('id', dictationId);

    if (updateError) {
      throw updateError;
    }

    logger.info('PatientPortal', 'Dictation audio deleted', {
      dictationId,
      tshlaId: session.tshlaId
    });

    res.json({
      success: true,
      message: 'Audio deleted successfully',
      dictation_id: dictationId
    });

  } catch (error) {
    logger.error('PatientPortal', 'Delete dictation audio error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete audio'
    });
  }
});

/**
 * Helper: Get device type from user agent
 */
function getDeviceType(userAgent) {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * GET /api/patient-portal/staff/dictations
 * Get all dictations for staff (dictation history page)
 * Includes filtering by status, date range, and search
 */
router.get('/staff/dictations', async (req, res) => {
  try {
    const { status, dateRange, search, limit = 100 } = req.query;

    logger.info('PatientPortal', 'Staff loading dictations', {
      status,
      dateRange,
      hasSearch: !!search,
      limit
    });

    // Build query
    let query = supabase
      .from('dictations')
      .select('*', { count: 'exact' })
      .is('deleted_at', null) // Only non-deleted dictations
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      const daysAgo = {
        '7days': 7,
        '30days': 30,
        '90days': 90
      }[dateRange];

      if (daysAgo) {
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() - daysAgo);
        query = query.gte('created_at', thresholdDate.toISOString());
      }
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Apply search filter (client-side for now, can be optimized with full-text search)
    let filteredData = data || [];
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredData = filteredData.filter(d =>
        (d.patient_name && d.patient_name.toLowerCase().includes(searchLower)) ||
        (d.patient_mrn && d.patient_mrn.toLowerCase().includes(searchLower)) ||
        (d.raw_transcript && d.raw_transcript.toLowerCase().includes(searchLower)) ||
        (d.processed_note && d.processed_note.toLowerCase().includes(searchLower))
      );
    }

    logger.info('PatientPortal', 'Staff dictations loaded', {
      total: count,
      filtered: filteredData.length,
      hasSearch: !!search
    });

    res.json({
      success: true,
      dictations: filteredData,
      total: count,
      filtered: filteredData.length
    });

  } catch (error) {
    logger.error('PatientPortal', 'Staff dictations error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to load dictations'
    });
  }
});

/**
 * POST /api/patient-portal/search
 * Search patient health data (labs, medications, glucose, appointments)
 * Used by the TSHLA Patient mobile app
 */
router.post('/search', async (req, res) => {
  try {
    const { query, tshlaId } = req.body;
    const sessionId = req.headers['x-session-id'];

    if (!query || !tshlaId) {
      return res.status(400).json({
        success: false,
        error: 'Query and TSH ID required'
      });
    }

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedTshId = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    logger.info('PatientPortal', 'Search request', {
      query,
      tshlaId: normalizedTshId,
      sessionId
    });

    // Validate session
    let session = activeSessions.get(sessionId);
    if (!session) {
      // Check database for recent session
      const { data: dbSession } = await supabase
        .from('patient_portal_sessions')
        .select('tshla_id')
        .eq('id', sessionId)
        .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (!dbSession) {
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please log in again.'
        });
      }
      session = { tshlaId: dbSession.tshla_id };
    }

    // Verify session ownership
    const sessionTshId = session.tshlaId.replace(/[\s-]/g, '').toUpperCase();
    if (sessionTshId !== normalizedTshId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const results = [];
    const queryLower = query.toLowerCase();

    // 1. Search Labs (use limit(1) since there may be duplicate records)
    const { data: hpDataArr } = await supabase
      .from('patient_comprehensive_chart')
      .select('labs')
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formattedTshId}`)
      .order('created_at', { ascending: false })
      .limit(1);

    const hpData = hpDataArr?.[0];
    if (hpData?.labs && typeof hpData.labs === 'object') {
      // Labs stored as { testName: [{ value, date, unit }] }
      for (const [testName, values] of Object.entries(hpData.labs)) {
        if (testName.toLowerCase().includes(queryLower) ||
            queryLower.includes('lab') ||
            queryLower.includes('a1c') && testName.toLowerCase().includes('a1c') ||
            queryLower.includes('cholesterol') && testName.toLowerCase().includes('cholesterol') ||
            queryLower.includes('ldl') && testName.toLowerCase().includes('ldl') ||
            queryLower.includes('glucose') && testName.toLowerCase().includes('glucose')) {

          const labValues = Array.isArray(values) ? values : [];
          for (const lab of labValues.slice(0, 5)) { // Limit to 5 per test
            results.push({
              type: 'lab',
              name: testName,
              value: String(lab.value),
              date: lab.date,
              unit: lab.unit || ''
            });
          }
        }
      }
    }

    // 2. Search Medications
    const { data: meds } = await supabase
      .from('patient_medications')
      .select('drug_name, dose, frequency, status, start_date, end_date')
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formattedTshId}`);

    if (meds) {
      for (const med of meds) {
        if (med.drug_name?.toLowerCase().includes(queryLower) ||
            queryLower.includes('medication') ||
            queryLower.includes('med') ||
            queryLower.includes('drug') ||
            queryLower.includes('prescription')) {

          results.push({
            type: 'medication',
            name: med.drug_name,
            value: med.dose,
            details: med.frequency,
            status: med.status || 'active',
            date: med.start_date || new Date().toISOString().split('T')[0]
          });
        }
      }
    }

    // 3. Search Appointments
    const { data: appointments } = await supabase
      .from('appointments')
      .select('appointment_date, appointment_time, appointment_type, provider_name, status')
      .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formattedTshId}`)
      .order('appointment_date', { ascending: false })
      .limit(10);

    if (appointments) {
      for (const apt of appointments) {
        if (queryLower.includes('appointment') ||
            queryLower.includes('visit') ||
            queryLower.includes('schedule') ||
            queryLower.includes('next') ||
            apt.appointment_type?.toLowerCase().includes(queryLower) ||
            apt.provider_name?.toLowerCase().includes(queryLower)) {

          results.push({
            type: 'appointment',
            name: apt.appointment_type || 'Office Visit',
            details: apt.provider_name ? `with ${apt.provider_name}` : '',
            value: apt.appointment_time,
            status: apt.status,
            date: apt.appointment_date
          });
        }
      }
    }

    // 4. Search CGM/Glucose data (if query mentions glucose)
    if (queryLower.includes('glucose') || queryLower.includes('sugar') || queryLower.includes('cgm')) {
      // Check if patient has CGM configured
      const { data: cgmConfig } = await supabase
        .from('patient_nightscout_config')
        .select('cgm_type')
        .or(`tshla_id.eq.${normalizedTshId},tshla_id.eq.${formattedTshId}`)
        .maybeSingle();

      if (cgmConfig) {
        // Note: Actual CGM readings would require calling the CGM service
        // For now, just indicate CGM is configured
        results.push({
          type: 'glucose',
          name: 'CGM Connected',
          details: `${cgmConfig.cgm_type} - View real-time data in your chart`,
          date: new Date().toISOString().split('T')[0]
        });
      }
    }

    // Sort results by date (most recent first)
    results.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB.getTime() - dateA.getTime();
    });

    logger.info('PatientPortal', 'Search complete', {
      query,
      tshlaId: normalizedTshId,
      resultCount: results.length
    });

    res.json({
      success: true,
      results: results.slice(0, 20) // Limit to 20 results
    });

  } catch (error) {
    logger.error('PatientPortal', 'Search error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Search failed. Please try again.'
    });
  }
});

/**
 * POST /api/patient-portal/ai-search
 * AI-powered natural language search across all patient health data
 * HIPAA Compliance: Validates session ownership, logs all PHI access
 */
router.post('/ai-search', async (req, res) => {
  const startTime = Date.now();

  try {
    const { query, tshlaId } = req.body;
    const sessionId = req.headers['x-session-id'];
    const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';

    // HIPAA: Input validation
    if (!query || !tshlaId) {
      return res.status(400).json({
        success: false,
        error: 'Query and TSH ID required'
      });
    }

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();

    // HIPAA: Log PHI access attempt
    logger.info('PatientPortal', 'AI Search - PHI Access Attempt', {
      action: 'ai_search_start',
      tshlaId: normalizedTshId,
      sessionId,
      clientIp,
      queryLength: query.length,
      timestamp: new Date().toISOString()
    });

    // HIPAA: Session validation
    let session = activeSessions.get(sessionId);
    if (!session) {
      const { data: dbSession } = await supabase
        .from('patient_portal_sessions')
        .select('tshla_id')
        .eq('id', sessionId)
        .gte('session_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (!dbSession) {
        // HIPAA: Log failed access attempt
        logger.warn('PatientPortal', 'AI Search - Session Invalid', {
          action: 'ai_search_denied',
          reason: 'session_expired',
          sessionId,
          clientIp,
          timestamp: new Date().toISOString()
        });

        return res.status(401).json({
          success: false,
          error: 'Session expired. Please log in again.'
        });
      }
      session = { tshlaId: dbSession.tshla_id };
    }

    // HIPAA: Verify session ownership (patient can only access own data)
    const sessionTshId = session.tshlaId.replace(/[\s-]/g, '').toUpperCase();
    if (sessionTshId !== normalizedTshId) {
      // HIPAA: Log unauthorized access attempt - potential security event
      logger.error('PatientPortal', 'AI Search - Unauthorized Access Attempt', {
        action: 'ai_search_denied',
        reason: 'tshla_id_mismatch',
        requestedTshId: normalizedTshId,
        sessionTshId: sessionTshId,
        sessionId,
        clientIp,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Import the AI search service
    const patientAISearch = require('../services/patientAISearch.service');

    // Process the AI search
    const result = await patientAISearch.search(query, normalizedTshId);

    const processingTime = Date.now() - startTime;

    // HIPAA: Log successful PHI access
    logger.info('PatientPortal', 'AI Search - PHI Access Complete', {
      action: 'ai_search_complete',
      tshlaId: normalizedTshId,
      sessionId,
      clientIp,
      queryLength: query.length,
      visualizationType: result.visualization?.type || 'none',
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });

    // HIPAA: Record PHI access in audit log table (async, non-blocking)
    supabase
      .from('phi_access_log')
      .insert({
        tshla_id: normalizedTshId,
        session_id: sessionId,
        access_type: 'ai_search',
        client_ip: clientIp,
        query_summary: query.substring(0, 100), // Truncate for privacy
        response_type: result.visualization?.type || 'none',
        processing_time_ms: processingTime
      })
      .then(() => {})
      .catch(err => {
        // Don't fail the request if audit logging fails, but do log it
        logger.warn('PatientPortal', 'PHI audit log insert failed', { error: err.message });
      });

    res.json({
      success: true,
      answer: result.answer,
      visualization: result.visualization,
      followUp: result.followUp
    });

  } catch (error) {
    logger.error('PatientPortal', 'AI Search error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      answer: "I'm sorry, I had trouble processing your question. Please try asking in a different way.",
      visualization: { type: 'none', data: [] },
      followUp: null,
      error: 'Search failed'
    });
  }
});

// ============================================
// NEW 5-SCREEN PORTAL ENDPOINTS
// Added: 2026-02-06
// ============================================

/**
 * GET /status - Get patient daily status (HOME screen)
 * Returns pre-computed AI status from patient_daily_status table
 */
router.get('/status', async (req, res) => {
  const { tshlaId } = req.query;
  const sessionId = req.headers['x-session-id'];

  try {
    // Validate session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Normalize TSH ID
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    // Look up patient
    const { data: patient, error: patientError } = await supabase
      .from('unified_patients')
      .select('id, first_name, last_name, tshla_id')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get latest status
    const { data: status, error: statusError } = await supabase
      .from('patient_daily_status')
      .select('*')
      .eq('unified_patient_id', patient.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (statusError || !status) {
      // Return default status if none computed yet
      return res.json({
        status_type: 'stable',
        status_headline: `Welcome back, ${patient.first_name}! Everything is looking good.`,
        status_emoji: '✅',
        patient_first_name: patient.first_name,
        changes: [],
        focus_item: 'Keep up your current routine',
        focus_category: 'stable',
        next_action: null,
        next_action_type: 'none',
        council_status: {},
        clinical_snapshot: {}
      });
    }

    res.json({
      ...status,
      patient_first_name: patient.first_name
    });

  } catch (error) {
    logger.error('PatientPortal', 'Status fetch error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

/**
 * GET /results - Get patient lab results and CGM data (RESULTS screen)
 */
router.get('/results', async (req, res) => {
  const { tshlaId } = req.query;
  const sessionId = req.headers['x-session-id'];

  try {
    // Validate session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Normalize TSH ID
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    // Get patient chart with labs
    const { data: chart, error: chartError } = await supabase
      .from('patient_comprehensive_chart')
      .select('labs, vitals, tshla_id')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get patient for CGM lookup
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('id, phone_primary')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .single();

    // Get CGM data (last 24 hours)
    let cgmData = [];
    if (patient?.id) {
      const { data: cgm } = await supabase
        .from('cgm_readings')
        .select('glucose_value, trend_arrow, reading_timestamp')
        .eq('unified_patient_id', patient.id)
        .gte('reading_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('reading_timestamp', { ascending: false })
        .limit(288);

      cgmData = (cgm || []).map(r => ({
        time: r.reading_timestamp,
        value: r.glucose_value,
        trend: r.trend_arrow
      }));
    }

    // Process labs with categories and interpretations
    const processedLabs = {};
    if (chart?.labs) {
      for (const [labName, results] of Object.entries(chart.labs)) {
        if (!Array.isArray(results) || results.length === 0) continue;

        const latest = results[0];
        const previous = results[1];
        const value = parseFloat(latest.value);

        // Determine category based on lab type and value
        let category = 'green';
        let interpretation = '';

        if (labName.toLowerCase().includes('a1c')) {
          if (value > 9) {
            category = 'red';
            interpretation = 'Your A1C is elevated. Let\'s discuss ways to improve it.';
          } else if (value > 7.5) {
            category = 'yellow';
            interpretation = 'Your A1C is above target. We\'re working on bringing it down.';
          } else if (value <= 7) {
            interpretation = 'Great job! Your A1C is at or near goal.';
          }
        } else if (labName.toLowerCase().includes('glucose')) {
          if (value > 180) {
            category = 'yellow';
            interpretation = 'This glucose reading was elevated.';
          } else if (value < 70) {
            category = 'yellow';
            interpretation = 'This glucose reading was low.';
          } else {
            interpretation = 'This glucose level is in the normal range.';
          }
        }

        // Determine trend
        let trend = 'stable';
        if (previous) {
          const prevValue = parseFloat(previous.value);
          if (value > prevValue * 1.05) trend = 'up';
          else if (value < prevValue * 0.95) trend = 'down';
        }

        processedLabs[labName] = {
          latest_value: latest.value,
          unit: latest.unit || '',
          trend,
          category,
          interpretation,
          history: results.map(r => ({
            date: r.date,
            value: parseFloat(r.value),
            unit: r.unit || ''
          }))
        };
      }
    }

    // Generate summary
    const redCount = Object.values(processedLabs).filter((l) => l.category === 'red').length;
    const yellowCount = Object.values(processedLabs).filter((l) => l.category === 'yellow').length;

    let summary = 'Your results are looking good overall.';
    let worryAnswer = 'No immediate concerns. Keep up your current routine.';

    if (redCount > 0) {
      summary = 'Some results need attention. Let\'s discuss at your next visit.';
      worryAnswer = 'There are a few values we should address. Your care team will reach out.';
    } else if (yellowCount > 0) {
      summary = 'Most results are good, with a few to watch.';
      worryAnswer = 'Nothing urgent, but we\'ll keep an eye on a few values.';
    }

    // CGM summary
    let cgmSummary = null;
    if (cgmData.length > 0) {
      const inRange = cgmData.filter(r => r.value >= 70 && r.value <= 180).length;
      const tir = Math.round((inRange / cgmData.length) * 100);
      cgmSummary = `Over the last 24 hours, you've been in target range (70-180) ${tir}% of the time.`;
    }

    res.json({
      summary,
      worry_answer: worryAnswer,
      labs: processedLabs,
      cgm_data: cgmData,
      cgm_summary: cgmSummary
    });

  } catch (error) {
    logger.error('PatientPortal', 'Results fetch error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

/**
 * GET /plan - Get patient care plan (PLAN screen)
 */
router.get('/plan', async (req, res) => {
  const { tshlaId } = req.query;
  const sessionId = req.headers['x-session-id'];

  try {
    // Validate session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Normalize TSH ID
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    // Get patient
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('id, next_appointment_date')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .single();

    // Get latest dictation for plan content
    const { data: dictation } = await supabase
      .from('dictated_notes')
      .select('visit_date, processed_note, ai_summary')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .eq('status', 'final')
      .order('visit_date', { ascending: false })
      .limit(1)
      .single();

    // Get diagnoses from chart
    const { data: chart } = await supabase
      .from('patient_comprehensive_chart')
      .select('diagnoses, medications')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .single();

    // Build plan from available data
    const treating = [];
    if (chart?.diagnoses) {
      for (const diag of chart.diagnoses.slice(0, 5)) {
        treating.push(typeof diag === 'string' ? diag : diag.name || diag.description || 'Condition');
      }
    }
    if (treating.length === 0) {
      treating.push('Your ongoing health management');
    }

    const actions = [];
    if (chart?.medications) {
      const meds = Array.isArray(chart.medications) ? chart.medications : [];
      const activeMeds = meds.filter(m => m.active !== false).slice(0, 5);
      for (const med of activeMeds) {
        actions.push({
          title: `Continue ${med.name || med.medication_name}`,
          description: med.dose ? `${med.dose} ${med.frequency || ''}`.trim() : null
        });
      }
    }
    if (actions.length === 0) {
      actions.push({
        title: 'Follow up with your care team',
        description: 'Your personalized plan will be updated after your next visit.'
      });
    }

    res.json({
      last_visit_date: dictation?.visit_date || null,
      treating,
      actions,
      why_it_matters: 'Following your care plan helps prevent complications and keeps you feeling your best. Each step is designed to work together for your overall health.',
      success_metrics: [
        'A1C at or below your target',
        'Fewer high and low glucose episodes',
        'More energy and better sleep',
        'Reduced risk of complications'
      ],
      next_appointment: patient?.next_appointment_date || null
    });

  } catch (error) {
    logger.error('PatientPortal', 'Plan fetch error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

/**
 * GET /messages - Get patient message thread (MESSAGES screen)
 */
router.get('/messages', async (req, res) => {
  const { tshlaId } = req.query;
  const sessionId = req.headers['x-session-id'];

  try {
    // Validate session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Normalize TSH ID
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    // Get patient
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('id')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .single();

    if (!patient) {
      return res.json({ messages: [] });
    }

    // Get messages (if messages table exists)
    const { data: messages, error } = await supabase
      .from('patient_messages')
      .select('*')
      .eq('unified_patient_id', patient.id)
      .order('created_at', { ascending: true });

    if (error) {
      // Table might not exist yet, return empty
      return res.json({ messages: [] });
    }

    res.json({ messages: messages || [] });

  } catch (error) {
    logger.error('PatientPortal', 'Messages fetch error', { error: error.message });
    res.json({ messages: [] });
  }
});

/**
 * POST /messages - Send a patient message (MESSAGES screen)
 */
router.post('/messages', async (req, res) => {
  const { tshlaId, category, content } = req.body;
  const sessionId = req.headers['x-session-id'];

  try {
    // Validate session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Normalize TSH ID
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    // Get patient
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('id')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .single();

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Insert message
    const { error } = await supabase
      .from('patient_messages')
      .insert({
        unified_patient_id: patient.id,
        sender: 'patient',
        category,
        content,
        created_at: new Date().toISOString()
      });

    if (error) {
      // Table might not exist yet
      logger.warn('PatientPortal', 'Message insert failed - table may not exist', { error: error.message });
      return res.status(500).json({ error: 'Failed to send message' });
    }

    logger.info('PatientPortal', 'Patient message sent', { tshlaId: normalizedId, category });
    res.json({ success: true });

  } catch (error) {
    logger.error('PatientPortal', 'Message send error', { error: error.message });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * GET /progress - Get patient progress data (PROGRESS screen)
 */
router.get('/progress', async (req, res) => {
  const { tshlaId } = req.query;
  const sessionId = req.headers['x-session-id'];

  try {
    // Validate session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Normalize TSH ID
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    // Get patient chart with labs
    const { data: chart } = await supabase
      .from('patient_comprehensive_chart')
      .select('labs')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .single();

    // Get patient for CGM lookup
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('id, first_name')
      .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
      .single();

    // Build A1C history
    let a1cHistory = [];
    let a1cSummary = null;
    if (chart?.labs) {
      const a1cResults = chart.labs['A1C'] || chart.labs['HbA1c'] || [];
      if (Array.isArray(a1cResults) && a1cResults.length > 0) {
        a1cHistory = a1cResults.slice(0, 6).map(r => ({
          date: r.date,
          value: parseFloat(r.value)
        })).reverse();

        if (a1cResults.length >= 2) {
          const latest = parseFloat(a1cResults[0].value);
          const previous = parseFloat(a1cResults[1].value);
          a1cSummary = {
            direction: latest < previous ? 'improving' : latest > previous ? 'worsening' : 'stable'
          };
        }
      }
    }

    // Get CGM stats for time in range
    let timeInRange = null;
    let timeAboveRange = null;
    let timeBelowRange = null;
    let tirInterpretation = null;

    if (patient?.id) {
      const { data: cgm } = await supabase
        .from('cgm_readings')
        .select('glucose_value')
        .eq('unified_patient_id', patient.id)
        .gte('reading_timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(2016); // 7 days of 5-min readings

      if (cgm && cgm.length > 0) {
        const inRange = cgm.filter(r => r.glucose_value >= 70 && r.glucose_value <= 180).length;
        const below = cgm.filter(r => r.glucose_value < 70).length;
        const above = cgm.filter(r => r.glucose_value > 180).length;

        timeInRange = Math.round((inRange / cgm.length) * 100);
        timeBelowRange = Math.round((below / cgm.length) * 100);
        timeAboveRange = Math.round((above / cgm.length) * 100);

        if (timeInRange >= 70) {
          tirInterpretation = 'Excellent! You\'re meeting the target of 70% or more time in range.';
        } else if (timeInRange >= 50) {
          tirInterpretation = 'Good progress! Keep working toward 70% time in range.';
        } else {
          tirInterpretation = 'Let\'s work together to improve your time in range.';
        }
      }
    }

    // Generate win of the week
    let winOfWeek = 'You checked in this week - that\'s a win!';
    if (a1cSummary?.direction === 'improving') {
      winOfWeek = 'Your A1C is improving - great work!';
    } else if (timeInRange && timeInRange >= 70) {
      winOfWeek = `You\'re at ${timeInRange}% time in range this week - excellent!`;
    }

    res.json({
      win_of_week: winOfWeek,
      a1c_history: a1cHistory,
      a1c_summary: a1cSummary,
      a1c_interpretation: 'Your A1C shows your average blood sugar control over the past 3 months.',
      time_in_range: timeInRange,
      time_above_range: timeAboveRange,
      time_below_range: timeBelowRange,
      tir_interpretation: tirInterpretation,
      habits: [
        { name: 'Check-ins', value: 'Active this week', icon: 'checkmark-circle', status: 'good' }
      ],
      encouragement: `Keep going, ${patient?.first_name || 'there'}! Every small step counts.`
    });

  } catch (error) {
    logger.error('PatientPortal', 'Progress fetch error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// ============================================
// STAFF MESSAGE ENDPOINTS (for PatientMessagesInbox)
// ============================================

/**
 * GET /staff/message-threads - Get all patient message threads for staff
 */
router.get('/staff/message-threads', async (req, res) => {
  const { category, status } = req.query;

  try {
    let query = supabase
      .from('v_patient_message_threads')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (status === 'unread') {
      query = query.eq('has_unread', true);
    } else if (status === 'pending') {
      query = query.eq('has_pending', true);
    }

    const { data: threads, error } = await query.limit(100);

    if (error) {
      // View might not exist yet, return empty
      logger.warn('PatientPortal', 'Message threads query failed - view may not exist', { error: error.message });
      return res.json({ threads: [] });
    }

    res.json({ threads: threads || [] });

  } catch (error) {
    logger.error('PatientPortal', 'Staff message threads error', { error: error.message });
    res.json({ threads: [] });
  }
});

/**
 * GET /staff/messages/:patientId - Get messages for a specific patient
 */
router.get('/staff/messages/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const { thread_id } = req.query;

  try {
    // Get patient info
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('tshla_id, full_name, phone_display')
      .eq('id', patientId)
      .single();

    // Get messages
    let query = supabase
      .from('patient_messages')
      .select('*')
      .eq('unified_patient_id', patientId)
      .order('created_at', { ascending: true });

    if (thread_id) {
      query = query.eq('thread_id', thread_id);
    }

    const { data: messages, error } = await query;

    if (error) {
      logger.warn('PatientPortal', 'Messages query failed - table may not exist', { error: error.message });
      return res.json({ messages: [], patient });
    }

    res.json({ messages: messages || [], patient });

  } catch (error) {
    logger.error('PatientPortal', 'Staff messages fetch error', { error: error.message });
    res.json({ messages: [] });
  }
});

/**
 * POST /staff/messages/:patientId - Send a staff message to patient
 */
router.post('/staff/messages/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const { content, thread_id } = req.body;

  try {
    const { error } = await supabase
      .from('patient_messages')
      .insert({
        unified_patient_id: patientId,
        sender: 'staff',
        content,
        thread_id,
        status: 'unread',
        created_at: new Date().toISOString()
      });

    if (error) {
      logger.error('PatientPortal', 'Staff message insert failed', { error: error.message });
      return res.status(500).json({ error: 'Failed to send message' });
    }

    logger.info('PatientPortal', 'Staff message sent', { patientId });
    res.json({ success: true });

  } catch (error) {
    logger.error('PatientPortal', 'Staff message send error', { error: error.message });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * POST /staff/messages/:patientId/mark-read - Mark messages as read
 */
router.post('/staff/messages/:patientId/mark-read', async (req, res) => {
  const { patientId } = req.params;
  const { thread_id } = req.body;

  try {
    let query = supabase
      .from('patient_messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('unified_patient_id', patientId)
      .eq('sender', 'patient')
      .eq('status', 'unread');

    if (thread_id) {
      query = query.eq('thread_id', thread_id);
    }

    await query;
    res.json({ success: true });

  } catch (error) {
    logger.error('PatientPortal', 'Mark read error', { error: error.message });
    res.json({ success: false });
  }
});

/**
 * POST /staff/messages/:patientId/resolve - Resolve a message thread
 */
router.post('/staff/messages/:patientId/resolve', async (req, res) => {
  const { patientId } = req.params;
  const { thread_id } = req.body;

  try {
    let query = supabase
      .from('patient_messages')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('unified_patient_id', patientId);

    if (thread_id) {
      query = query.eq('thread_id', thread_id);
    }

    await query;

    logger.info('PatientPortal', 'Thread resolved', { patientId, thread_id });
    res.json({ success: true });

  } catch (error) {
    logger.error('PatientPortal', 'Resolve error', { error: error.message });
    res.json({ success: false });
  }
});

/**
 * POST /refresh-status - Trigger status recomputation for a patient
 */
router.post('/refresh-status', async (req, res) => {
  const { tshlaId } = req.body;

  try {
    // Get the patientStatusEngine from app.locals
    const patientStatusEngine = req.app.locals?.patientStatusEngine;

    if (!patientStatusEngine) {
      logger.warn('PatientPortal', 'patientStatusEngine not available');
      return res.json({ success: false, error: 'Status engine not available' });
    }

    // Find the patient
    const { data: patient } = await supabase
      .from('unified_patients')
      .select('id')
      .or(`tshla_id.eq.${tshlaId},tshla_id.eq.${tshlaId.replace(/[\s-]/g, '')}`)
      .single();

    if (!patient) {
      return res.json({ success: false, error: 'Patient not found' });
    }

    // Compute status
    await patientStatusEngine.computePatientStatus(patient.id);

    logger.info('PatientPortal', 'Status refreshed', { tshlaId });
    res.json({ success: true });

  } catch (error) {
    logger.error('PatientPortal', 'Status refresh error', { error: error.message });
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;
