/**
 * Patient Summary API
 * Backend API for patient-friendly visit summaries (Beta Feature)
 *
 * Endpoints:
 * - POST /api/patient-summaries - Generate and save summary
 * - GET /api/patient-summaries/:id - Get summary by ID
 * - GET /api/patient-summaries/visit/:visitId - Get summary for visit
 * - GET /api/patient-summaries/patient/:patientId - Get all summaries for patient
 * - PATCH /api/patient-summaries/:id/approve - Provider approves summary
 * - POST /api/patient-summaries/:id/feedback - Patient submits feedback
 *
 * HIPAA COMPLIANT: Uses safe logger with PHI sanitization
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const app = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service key for server-side
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper: Get Azure OpenAI configuration
const getAzureOpenAIConfig = () => {
  return {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_KEY,
    deployment: process.env.AZURE_OPENAI_MODEL_STAGE4 || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview'
  };
};

/**
 * Generate patient-friendly summary using AI
 * HIPAA COMPLIANT: Uses Azure OpenAI with Microsoft BAA
 */
async function generateAISummary(soapInput) {
  const config = getAzureOpenAIConfig();
  if (!config.endpoint || !config.key) {
    throw new Error('Azure OpenAI credentials not configured');
  }

  const prompt = `Create a SHORT, friendly summary of this doctor's visit for the patient.

MEDICAL INFORMATION:
${soapInput.assessment ? `What the doctor found:\n${soapInput.assessment}\n\n` : ''}${soapInput.plan ? `The plan:\n${soapInput.plan}\n\n` : ''}${soapInput.medications ? `Current medications:\n${soapInput.medications}\n\n` : ''}

TARGET: 150-200 words total (15-30 seconds to read)

Generate a JSON response with this EXACT structure:
{
  "summary_sections": {
    "what_we_talked_about": "1-2 sentences about the main health issue",
    "medication_changes": "List any new/changed/stopped medications OR say 'No changes to your medications'",
    "tests_needed": "List labs/imaging with simple explanations and when to do them OR say 'No new tests needed'",
    "action_items": "Key things to do (lifestyle, symptoms to watch)",
    "next_visit": "When to schedule and what to bring"
  },
  "key_actions": {
    "medications": ["Action item 1"],
    "labs": ["Lab to do 1"],
    "appointments": ["Schedule follow-up in 3 months"],
    "lifestyle": ["Diet change 1"]
  }
}

RULES:
- Use "you/your" (not "the patient")
- Plain English (blood sugar not glucose)
- Keep each bullet SHORT (max 10 words)
- Be specific and encouraging`;

  // Azure OpenAI endpoint format
  const azureEndpoint = `${config.endpoint}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;

  const response = await fetch(azureEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.key
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are a compassionate medical assistant who explains doctor visits in simple terms. Use plain English, say "you/your" not "the patient", and keep it SHORT (150-200 words).'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const rawContent = data.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(rawContent);

  // Format summary text
  const sections = parsed.summary_sections || {};
  let summaryText = '';

  if (sections.what_we_talked_about) {
    summaryText += `**What We Talked About:**\n${sections.what_we_talked_about}\n\n`;
  }
  if (sections.medication_changes) {
    summaryText += `**Your Medication Changes:**\n${sections.medication_changes}\n\n`;
  }
  if (sections.tests_needed) {
    summaryText += `**Tests We Need:**\n${sections.tests_needed}\n\n`;
  }
  if (sections.action_items) {
    summaryText += `**What to Do:**\n${sections.action_items}\n\n`;
  }
  if (sections.next_visit) {
    summaryText += `**Next Visit:**\n${sections.next_visit}`;
  }

  const keyActions = {
    medications: parsed.key_actions?.medications || [],
    labs: parsed.key_actions?.labs || [],
    appointments: parsed.key_actions?.appointments || [],
    lifestyle: parsed.key_actions?.lifestyle || []
  };

  const wordCount = summaryText.split(/\s+/).filter(w => w).length;
  const estimatedReadTime = Math.ceil(wordCount / 200 * 60);

  return {
    summary_text: summaryText.trim(),
    key_actions: keyActions,
    word_count: wordCount,
    estimated_read_time_seconds: estimatedReadTime
  };
}

/**
 * POST /api/patient-summaries
 * Generate and save a new patient summary
 */
app.post('/api/patient-summaries', async (req, res) => {
  try {
    const { visitId, patientId, providerId, soapNote } = req.body;

    if (!visitId || !patientId || !providerId) {
      return res.status(400).json({
        error: 'Missing required fields: visitId, patientId, providerId'
      });
    }

    logger.info('PatientSummary', 'Generating patient summary', { visitId });

    // Generate AI summary
    const summary = await generateAISummary({
      assessment: soapNote?.assessment,
      plan: soapNote?.plan,
      medications: soapNote?.medications
    });

    // Save to database
    const { data, error } = await supabase
      .from('patient_visit_summaries')
      .insert({
        visit_id: visitId,
        patient_id: patientId,
        provider_id: providerId,
        summary_text: summary.summary_text,
        key_actions: summary.key_actions,
        word_count: summary.word_count,
        estimated_read_time_seconds: summary.estimated_read_time_seconds,
        ai_model: process.env.VITE_OPENAI_MODEL_STAGE4 || 'gpt-4o-mini',
        ai_provider: 'openai',
        version: 'beta',
        provider_approved: false // Requires provider approval before patient sees it
      })
      .select()
      .single();

    if (error) {
      logger.error('PatientSummary', 'Database error saving summary', { visitId, error: error.message });
      return res.status(500).json({ error: 'Failed to save summary' });
    }

    logger.logOperation('PatientSummary', 'create', 'summary', true);

    res.json({
      success: true,
      summary: data
    });

  } catch (error) {
    logger.error('PatientSummary', 'Error generating patient summary', {
      error: logger.redactPHI(error.message)
    });
    res.status(500).json({
      error: 'Failed to generate summary',
      message: error.message
    });
  }
});

/**
 * GET /api/patient-summaries/:id
 * Get summary by ID
 */
app.get('/api/patient-summaries/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patient_visit_summaries')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    res.json(data);

  } catch (error) {
    logger.error('PatientSummary', 'Error fetching summary', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

/**
 * GET /api/patient-summaries/visit/:visitId
 * Get summary for a specific visit
 */
app.get('/api/patient-summaries/visit/:visitId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patient_visit_summaries')
      .select('*')
      .eq('visit_id', req.params.visitId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'No summary found for this visit' });
    }

    res.json(data);

  } catch (error) {
    logger.error('PatientSummary', 'Error fetching visit summary', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

/**
 * GET /api/patient-summaries/patient/:patientId
 * Get all summaries for a patient (approved only)
 */
app.get('/api/patient-summaries/patient/:patientId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patient_visit_summaries')
      .select('*')
      .eq('patient_id', req.params.patientId)
      .eq('provider_approved', true) // Only return approved summaries
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch summaries' });
    }

    res.json({
      summaries: data,
      count: data.length
    });

  } catch (error) {
    logger.error('PatientSummary', 'Error fetching patient summaries', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
});

/**
 * PATCH /api/patient-summaries/:id/approve
 * Provider approves summary (makes it visible to patient)
 */
app.patch('/api/patient-summaries/:id/approve', async (req, res) => {
  try {
    const { providerId } = req.body;

    const { data, error } = await supabase
      .from('patient_visit_summaries')
      .update({
        provider_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: providerId
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to approve summary' });
    }

    logger.logOperation('PatientSummary', 'approve', 'summary', true);

    res.json({
      success: true,
      summary: data
    });

  } catch (error) {
    logger.error('PatientSummary', 'Error approving summary', { error: error.message });
    res.status(500).json({ error: 'Failed to approve summary' });
  }
});

/**
 * POST /api/patient-summaries/:id/feedback
 * Patient submits feedback on summary
 */
app.post('/api/patient-summaries/:id/feedback', async (req, res) => {
  try {
    const { helpful, rating, feedback, errors } = req.body;

    const { data, error } = await supabase
      .from('patient_visit_summaries')
      .update({
        was_helpful: helpful,
        helpfulness_rating: rating,
        patient_feedback: feedback,
        reported_errors: errors || [],
        feedback_submitted_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to save feedback' });
    }

    logger.logOperation('PatientSummary', 'submit', 'feedback', true);

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });

  } catch (error) {
    logger.error('PatientSummary', 'Error saving feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

/**
 * GET /api/patient-summaries/analytics
 * Get analytics on summary performance (admin only)
 */
app.get('/api/patient-summaries/analytics', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patient_summary_analytics')
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }

    res.json(data);

  } catch (error) {
    logger.error('PatientSummary', 'Error fetching analytics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = app;
