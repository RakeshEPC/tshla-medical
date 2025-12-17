/**
 * CCD Summary API
 * HIPAA-Compliant CCD file upload and AI-powered summary generation
 *
 * Endpoints:
 * - POST /api/ccd/upload - Upload and parse CCD XML file
 * - POST /api/ccd/generate-summary - Generate AI summary with user's custom prompt
 * - GET /api/ccd/summaries/:patientId - Get all summaries for a patient
 * - GET /api/ccd/summary/:id - Get specific summary by ID
 * - DELETE /api/ccd/summary/:id - Delete a summary
 */

const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const ccdParser = require('../services/ccdXMLParser.service');
require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env') });

const app = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept XML files only
    if (file.mimetype === 'text/xml' ||
        file.mimetype === 'application/xml' ||
        file.originalname.endsWith('.xml')) {
      cb(null, true);
    } else {
      cb(new Error('Only XML files are allowed'));
    }
  }
});

// Helper: Get Azure OpenAI credentials (HIPAA compliant)
const getAzureOpenAIConfig = () => {
  return {
    endpoint: process.env.VITE_AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.VITE_AZURE_OPENAI_KEY,
    deployment: process.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
    apiVersion: process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01'
  };
};

/**
 * POST /api/ccd/upload
 * Upload and parse CCD XML file
 */
app.post('/api/ccd/upload', upload.single('ccdFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    console.log('📤 CCD file upload received:', req.file.originalname);
    console.log('   - Size:', Math.round(req.file.size / 1024), 'KB');
    console.log('   - Patient ID:', patientId);

    // Convert buffer to string
    const xmlString = req.file.buffer.toString('utf-8');

    // Validate CCD structure
    const validation = ccdParser.validateCCD(xmlString);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid CCD file',
        details: validation.error
      });
    }

    // Parse CCD XML
    const extractedData = ccdParser.parseCCD(xmlString);

    console.log('✅ CCD parsing successful');
    console.log('   - Patient:', extractedData.demographics?.fullName || 'Unknown');
    console.log('   - Medications:', extractedData.medications.length);
    console.log('   - Conditions:', extractedData.conditions.length);

    // Return parsed data (do not save to DB yet - wait for summary generation)
    res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      extractedData,
      message: 'CCD file parsed successfully. Ready to generate summary.'
    });

  } catch (error) {
    console.error('❌ CCD upload error:', error);
    res.status(500).json({
      error: 'Failed to process CCD file',
      message: error.message
    });
  }
});

/**
 * POST /api/ccd/generate-summary
 * Generate AI summary using user's custom prompt
 */
app.post('/api/ccd/generate-summary', async (req, res) => {
  try {
    const { patientId, customPrompt, extractedData, ccdXml, fileName } = req.body;

    if (!patientId || !customPrompt || !extractedData || !ccdXml) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, customPrompt, extractedData, ccdXml'
      });
    }

    console.log('🤖 Generating AI summary...');
    console.log('   - Patient ID:', patientId);
    console.log('   - Custom prompt length:', customPrompt.length, 'characters');

    // Get Azure OpenAI config (HIPAA compliant)
    const azureConfig = getAzureOpenAIConfig();
    if (!azureConfig.endpoint || !azureConfig.apiKey) {
      return res.status(500).json({ error: 'Azure OpenAI not configured' });
    }

    console.log('   - Using Azure OpenAI (HIPAA compliant)');
    console.log('   - Deployment:', azureConfig.deployment);

    // Build context for AI (structured data from CCD)
    const medicalContext = buildMedicalContext(extractedData);

    // Azure OpenAI endpoint format
    const azureUrl = `${azureConfig.endpoint}/openai/deployments/${azureConfig.deployment}/chat/completions?api-version=${azureConfig.apiVersion}`;

    // Call Azure OpenAI API with user's EXACT custom prompt
    // We provide the medical context as system message, and user's prompt as user message
    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': azureConfig.apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `You are a medical assistant. Below is the structured medical data extracted from a patient's CCD file:\n\n${medicalContext}`
          },
          {
            role: 'user',
            content: customPrompt  // USER'S EXACT PROMPT - NO MODIFICATION
          }
        ],
        temperature: 0.7,
        max_tokens: 800  // Allow up to ~600 words
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const summaryText = data.choices[0]?.message?.content || '';

    // Calculate word count
    const wordCount = summaryText.split(/\s+/).filter(w => w).length;

    console.log('✅ AI summary generated');
    console.log('   - Word count:', wordCount);
    console.log('   - Model:', azureConfig.deployment);

    // Validate patient_id (must be UUID or null)
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId);
    const validPatientId = isValidUUID ? patientId : null;

    if (!isValidUUID) {
      console.log('⚠️  Invalid patient ID format, setting to null');
    }

    // Save to database
    const { data: savedSummary, error } = await supabase
      .from('ccd_summaries')
      .insert({
        patient_id: validPatientId,
        uploaded_by: req.user?.id || null,  // If using auth middleware
        ccd_xml_encrypted: ccdXml,
        file_name: fileName || 'ccd_file.xml',
        file_size_bytes: ccdXml.length,
        extracted_data: extractedData,
        custom_prompt: customPrompt,
        summary_text: summaryText,
        ai_model: azureConfig.deployment,
        ai_provider: 'azure-openai',
        word_count: wordCount
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: 'Failed to save summary to database' });
    }

    console.log('💾 Summary saved to database:', savedSummary.id);

    // Audit logging disabled (trigger removed due to schema mismatch)
    // Can be re-enabled later once audit_logs table schema is confirmed

    res.json({
      success: true,
      summary: savedSummary,
      wordCount,
      message: 'Summary generated and saved successfully'
    });

  } catch (error) {
    console.error('❌ Summary generation error:', error);
    res.status(500).json({
      error: 'Failed to generate summary',
      message: error.message
    });
  }
});

/**
 * GET /api/ccd/summaries/:patientId
 * Get all CCD summaries for a patient
 */
app.get('/api/ccd/summaries/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    const { data, error } = await supabase
      .from('ccd_summaries')
      .select('id, file_name, word_count, ai_model, created_at, summary_text, custom_prompt')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch summaries' });
    }

    res.json({
      success: true,
      summaries: data,
      count: data.length
    });

  } catch (error) {
    console.error('❌ Error fetching summaries:', error);
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
});

/**
 * GET /api/ccd/summary/:id
 * Get specific CCD summary by ID
 */
app.get('/api/ccd/summary/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('ccd_summaries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    // Log audit trail
    await supabase.from('audit_logs').insert({
      table_name: 'ccd_summaries',
      record_id: id,
      action: 'SELECT',
      user_id: req.user?.id || null,
      changed_data: { viewed: true }
    });

    res.json({
      success: true,
      summary: data
    });

  } catch (error) {
    console.error('❌ Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

/**
 * DELETE /api/ccd/summary/:id
 * Delete a CCD summary
 */
app.delete('/api/ccd/summary/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('ccd_summaries')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete summary' });
    }

    // Log audit trail
    await supabase.from('audit_logs').insert({
      table_name: 'ccd_summaries',
      record_id: id,
      action: 'DELETE',
      user_id: req.user?.id || null,
      changed_data: { deleted: true }
    });

    res.json({
      success: true,
      message: 'Summary deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting summary:', error);
    res.status(500).json({ error: 'Failed to delete summary' });
  }
});

/**
 * Helper function to build medical context for OpenAI
 */
function buildMedicalContext(extractedData) {
  let context = '=== PATIENT MEDICAL RECORD ===\n\n';

  // Demographics
  if (extractedData.demographics) {
    const demo = extractedData.demographics;
    context += '**PATIENT INFORMATION:**\n';
    context += `Name: ${demo.fullName}\n`;
    context += `Date of Birth: ${demo.dateOfBirth}\n`;
    context += `Gender: ${demo.gender}\n`;
    context += `MRN: ${demo.mrn}\n\n`;
  }

  // Conditions
  if (extractedData.conditions && extractedData.conditions.length > 0) {
    context += '**ACTIVE CONDITIONS:**\n';
    extractedData.conditions.forEach(condition => {
      context += `- ${condition.name} (${condition.status})\n`;
    });
    context += '\n';
  }

  // Medications
  if (extractedData.medications && extractedData.medications.length > 0) {
    context += '**CURRENT MEDICATIONS:**\n';
    extractedData.medications.forEach(med => {
      context += `- ${med.name}`;
      if (med.dose) context += ` - ${med.dose}`;
      if (med.frequency) context += ` - ${med.frequency}`;
      context += '\n';
    });
    context += '\n';
  }

  // Allergies
  if (extractedData.allergies && extractedData.allergies.length > 0) {
    context += '**ALLERGIES:**\n';
    extractedData.allergies.forEach(allergy => {
      context += `- ${allergy.allergen}`;
      if (allergy.reaction) context += ` (${allergy.reaction})`;
      context += '\n';
    });
    context += '\n';
  }

  // Labs
  if (extractedData.labs && extractedData.labs.length > 0) {
    context += '**RECENT LAB RESULTS:**\n';
    extractedData.labs.forEach(lab => {
      context += `- ${lab.name}: ${lab.value} ${lab.unit || ''}`;
      if (lab.date) context += ` (${lab.date})`;
      context += '\n';
    });
    context += '\n';
  }

  // Vitals
  if (extractedData.vitals && extractedData.vitals.length > 0) {
    context += '**VITAL SIGNS:**\n';
    extractedData.vitals.forEach(vital => {
      context += `- ${vital.name}: ${vital.value} ${vital.unit || ''}\n`;
    });
    context += '\n';
  }

  // Immunizations
  if (extractedData.immunizations && extractedData.immunizations.length > 0) {
    context += '**IMMUNIZATION HISTORY:**\n';
    extractedData.immunizations.forEach(imm => {
      context += `- ${imm.name}`;
      if (imm.date) context += ` (${imm.date})`;
      context += '\n';
    });
    context += '\n';
  }

  // Procedures
  if (extractedData.procedures && extractedData.procedures.length > 0) {
    context += '**PAST PROCEDURES:**\n';
    extractedData.procedures.forEach(proc => {
      context += `- ${proc.name}`;
      if (proc.date) context += ` (${proc.date})`;
      context += '\n';
    });
    context += '\n';
  }

  context += '=== END OF MEDICAL RECORD ===';

  return context;
}

module.exports = app;
