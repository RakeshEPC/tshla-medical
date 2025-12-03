/**
 * Diabetes Education API
 * Handles patient account management and call logging for phone-based AI diabetes education
 * Created: 2025-12-03
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const { OpenAI } = require('openai');

const router = express.Router();

// =====================================================
// CONFIGURATION
// =====================================================

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
});

// Configure multer for file uploads (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images allowed.'));
    }
  },
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extract medical data from document using OpenAI Vision
 */
async function extractMedicalDataFromDocument(fileBuffer, mimeType) {
  try {
    console.log('[DiabetesEdu] Extracting medical data from document...');

    // Convert buffer to base64
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Use OpenAI Vision to extract structured data
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a medical data extraction assistant. Extract the following information from medical documents:
1. Medications (name, dose, frequency)
2. Lab values (A1C, glucose, creatinine, etc.)
3. Diagnoses (especially diabetes-related)
4. Allergies
5. Any relevant clinical notes

Return ONLY valid JSON in this exact structure:
{
  "medications": [{"name": "", "dose": "", "frequency": ""}],
  "labs": {"a1c": {"value": 0, "date": "", "unit": ""}, "glucose_fasting": {"value": 0, "date": "", "unit": ""}},
  "diagnoses": [],
  "allergies": [],
  "notes": ""
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract medical data from this document and return JSON only.'
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const extractedText = response.choices[0].message.content;
    console.log('[DiabetesEdu] Raw extracted text:', extractedText);

    // Parse JSON (handle markdown code blocks if present)
    const jsonMatch = extractedText.match(/```json\n([\s\S]*?)\n```/) ||
                     extractedText.match(/```\n([\s\S]*?)\n```/) ||
                     [null, extractedText];

    const jsonText = jsonMatch[1] || extractedText;
    const medicalData = JSON.parse(jsonText.trim());

    console.log('[DiabetesEdu] Successfully extracted medical data');
    return medicalData;

  } catch (error) {
    console.error('[DiabetesEdu] Error extracting medical data:', error);
    throw new Error('Failed to extract medical data from document');
  }
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone) {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If doesn't start with country code, assume US (+1)
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Already formatted or international
  return phone.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Validate medical staff authentication
 */
async function validateStaffAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.substring(7);

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is medical staff
    const { data: staff, error: staffError } = await supabase
      .from('medical_staff')
      .select('id, first_name, last_name')
      .eq('auth_user_id', user.id)
      .single();

    if (staffError || !staff) {
      return res.status(403).json({ error: 'Not authorized - medical staff only' });
    }

    // Attach staff info to request
    req.staff = staff;
    req.user = user;
    next();

  } catch (error) {
    console.error('[DiabetesEdu] Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// =====================================================
// API ENDPOINTS
// =====================================================

/**
 * GET /api/diabetes-education/patients
 * List all diabetes education patients (staff only)
 */
router.get('/patients', validateStaffAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('diabetes_education_patients')
      .select(`
        id,
        phone_number,
        first_name,
        last_name,
        date_of_birth,
        preferred_language,
        medical_document_url,
        created_at,
        is_active,
        created_by_staff:medical_staff!created_by_staff_id(first_name, last_name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ patients: data });

  } catch (error) {
    console.error('[DiabetesEdu] Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

/**
 * GET /api/diabetes-education/patients/:id
 * Get single patient with full details (staff only)
 */
router.get('/patients/:id', validateStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('diabetes_education_patients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ patient: data });

  } catch (error) {
    console.error('[DiabetesEdu] Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

/**
 * POST /api/diabetes-education/patients
 * Create new diabetes education patient with medical document upload (staff only)
 */
router.post('/patients', validateStaffAuth, upload.single('medical_document'), async (req, res) => {
  try {
    const { first_name, last_name, date_of_birth, phone_number, preferred_language } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !date_of_birth || !phone_number) {
      return res.status(400).json({
        error: 'Missing required fields: first_name, last_name, date_of_birth, phone_number'
      });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone_number);

    // Check if phone number already exists
    const { data: existing } = await supabase
      .from('diabetes_education_patients')
      .select('id')
      .eq('phone_number', formattedPhone)
      .eq('is_active', true)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    let medical_data = null;
    let medical_document_url = null;

    // Process uploaded document if present
    if (req.file) {
      console.log('[DiabetesEdu] Processing uploaded document...');

      try {
        // Extract medical data using AI
        medical_data = await extractMedicalDataFromDocument(
          req.file.buffer,
          req.file.mimetype
        );

        // Upload document to Supabase Storage (optional)
        const fileName = `diabetes-education/${Date.now()}-${req.file.originalname}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('medical-documents')
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false
          });

        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('medical-documents')
            .getPublicUrl(fileName);

          medical_document_url = publicUrl;
        }

      } catch (extractError) {
        console.error('[DiabetesEdu] Document processing error:', extractError);
        // Continue without medical data if extraction fails
      }
    }

    // Create patient record
    const { data: patient, error: insertError } = await supabase
      .from('diabetes_education_patients')
      .insert({
        first_name,
        last_name,
        date_of_birth,
        phone_number: formattedPhone,
        preferred_language: preferred_language || 'en',
        medical_data,
        medical_document_url,
        created_by_staff_id: req.staff.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('[DiabetesEdu] Patient created successfully:', patient.id);

    res.status(201).json({
      success: true,
      patient: {
        id: patient.id,
        phone_number: patient.phone_number,
        first_name: patient.first_name,
        last_name: patient.last_name,
        preferred_language: patient.preferred_language,
        medical_data: patient.medical_data,
      }
    });

  } catch (error) {
    console.error('[DiabetesEdu] Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

/**
 * PUT /api/diabetes-education/patients/:id
 * Update patient information (staff only)
 */
router.put('/patients/:id', validateStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, date_of_birth, preferred_language, medical_data, is_active } = req.body;

    const updates = {};
    if (first_name) updates.first_name = first_name;
    if (last_name) updates.last_name = last_name;
    if (date_of_birth) updates.date_of_birth = date_of_birth;
    if (preferred_language) updates.preferred_language = preferred_language;
    if (medical_data) updates.medical_data = medical_data;
    if (typeof is_active === 'boolean') updates.is_active = is_active;

    const { data, error } = await supabase
      .from('diabetes_education_patients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, patient: data });

  } catch (error) {
    console.error('[DiabetesEdu] Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

/**
 * GET /api/diabetes-education/patients/:id/calls
 * Get call history for a patient (staff only)
 */
router.get('/patients/:id/calls', validateStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('diabetes_education_calls')
      .select('*')
      .eq('patient_id', id)
      .order('call_started_at', { ascending: false });

    if (error) throw error;

    res.json({ calls: data });

  } catch (error) {
    console.error('[DiabetesEdu] Error fetching calls:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

/**
 * GET /api/diabetes-education/calls/stats
 * Get call statistics (staff only)
 */
router.get('/calls/stats', validateStaffAuth, async (req, res) => {
  try {
    // Total calls
    const { count: totalCalls } = await supabase
      .from('diabetes_education_calls')
      .select('*', { count: 'exact', head: true });

    // Calls today
    const today = new Date().toISOString().split('T')[0];
    const { count: callsToday } = await supabase
      .from('diabetes_education_calls')
      .select('*', { count: 'exact', head: true })
      .gte('call_started_at', `${today}T00:00:00`);

    // Active patients
    const { count: activePatients } = await supabase
      .from('diabetes_education_patients')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Average call duration
    const { data: durationData } = await supabase
      .from('diabetes_education_calls')
      .select('duration_seconds');

    const avgDuration = durationData && durationData.length > 0
      ? Math.round(durationData.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / durationData.length / 60)
      : 0;

    res.json({
      stats: {
        total_calls: totalCalls || 0,
        calls_today: callsToday || 0,
        active_patients: activePatients || 0,
        avg_duration_minutes: avgDuration,
      }
    });

  } catch (error) {
    console.error('[DiabetesEdu] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * POST /api/diabetes-education/calls/log
 * Internal endpoint: Log call start (called by Twilio webhook)
 */
router.post('/calls/log', async (req, res) => {
  try {
    const { patient_id, twilio_call_sid, language, caller_phone_number } = req.body;

    if (!patient_id || !twilio_call_sid || !language) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('diabetes_education_calls')
      .insert({
        patient_id,
        twilio_call_sid,
        language,
        caller_phone_number,
        call_status: 'in-progress',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, call_id: data.id });

  } catch (error) {
    console.error('[DiabetesEdu] Error logging call:', error);
    res.status(500).json({ error: 'Failed to log call' });
  }
});

/**
 * PUT /api/diabetes-education/calls/:call_sid/complete
 * Internal endpoint: Update call when it ends (called by Twilio webhook)
 */
router.put('/calls/:call_sid/complete', async (req, res) => {
  try {
    const { call_sid } = req.params;
    const { duration_seconds, call_status, disconnect_reason, transcript } = req.body;

    const updates = {
      call_ended_at: new Date().toISOString(),
      call_status: call_status || 'completed',
    };

    if (duration_seconds) updates.duration_seconds = duration_seconds;
    if (disconnect_reason) updates.disconnect_reason = disconnect_reason;
    if (transcript) updates.transcript = transcript;

    const { data, error } = await supabase
      .from('diabetes_education_calls')
      .update(updates)
      .eq('twilio_call_sid', call_sid)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, call: data });

  } catch (error) {
    console.error('[DiabetesEdu] Error updating call:', error);
    res.status(500).json({ error: 'Failed to update call' });
  }
});

// =====================================================
// HEALTH CHECK
// =====================================================

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'diabetes-education-api',
    timestamp: new Date().toISOString()
  });
});

// =====================================================
// ERROR HANDLER
// =====================================================

router.use((error, req, res, next) => {
  console.error('[DiabetesEdu] Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

module.exports = router;
