/**
 * Pre-Visit AI Summary Generation API
 *
 * Processes uploaded EMR data and generates intelligent summaries for providers
 * HIPAA Compliant: Uses Microsoft Azure OpenAI (covered by Microsoft BAA)
 */

const express = require('express');
const router = express.Router();
const { AzureOpenAI } = require('openai');

// Azure OpenAI Configuration
const azureOpenAI = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
  deployment: process.env.AZURE_OPENAI_MODEL_STAGE5 || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'
});

/**
 * POST /api/ai/generate-previsit-summary
 *
 * Generates an AI summary from raw EMR data uploaded by staff
 */
router.post('/generate-previsit-summary', async (req, res) => {
  try {
    const {
      appointmentId,
      previousNotes,
      medications,
      labResults,
      vitals,
      questionnaire
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    // Build comprehensive prompt for AI
    const prompt = `You are a medical AI assistant helping to prepare a pre-visit summary for a physician.

Analyze the following patient data and create a concise, clinically relevant summary:

PREVIOUS VISIT NOTES:
${previousNotes || 'Not provided'}

CURRENT MEDICATIONS:
${medications || 'Not provided'}

RECENT LAB RESULTS:
${labResults || 'Not provided'}

TODAY'S VITALS:
${vitals ? JSON.stringify(vitals, null, 2) : 'Not provided'}

PATIENT QUESTIONNAIRE/CONCERNS:
${questionnaire || 'Not provided'}

Please provide:

1. A SUMMARY organized by diagnosis/condition as BULLET POINTS:
   - Group findings by each medical condition (e.g., Hypothyroidism, Diabetes, Hypertension)
   - Each bullet should be concise (1-2 lines maximum)
   - Focus on: current status, key labs, medication response, concerns
   - Format: "• [Condition]: [key finding/status]"

2. CHIEF COMPLAINT (1 sentence only)

3. MEDICATION CHANGES (JSON array - only actual changes, not current meds)

4. ABNORMAL LABS (JSON array - ONLY abnormal values with clinical significance)

5. KEY LAB SUMMARY (condensed table format, only most relevant labs)

Format your response as JSON:
{
  "summary": "• Hypothyroidism: TSH 7.49 (elevated), on levothyroxine 150mcg - needs dose adjustment\\n• Prediabetes: A1C improved to 5.5% on Mounjaro, good response\\n• Hypertension: BP 140/78, suboptimal control",
  "chiefComplaint": "Follow-up for multiple chronic conditions",
  "medicationChanges": [{"medication": "Mounjaro", "change": "started", "dosage": "2.5mg weekly, titrated to 5mg", "reason": "weight/glucose management"}],
  "abnormalLabs": [{"test": "TSH", "value": "7.49 uIU/mL", "reference": "0.5-4.5", "status": "high", "significance": "Suboptimal thyroid control"}],
  "keyLabs": "TSH 7.49↑ | A1C 5.5% | Cholesterol 209↑ | Triglycerides 328↑ | Testosterone 40.6↓ | BP 140/78"
}`;

    // Call Azure OpenAI API (HIPAA compliant)
    const deployment = process.env.AZURE_OPENAI_MODEL_STAGE5 || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

    const completion = await azureOpenAI.chat.completions.create({
      model: deployment, // Azure uses deployment name
      messages: [
        {
          role: 'system',
          content: 'You are an expert medical AI assistant specializing in endocrinology and diabetes care. Provide concise, clinically accurate summaries.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent medical summaries
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);

    // Return structured data
    res.json({
      summary: aiResponse.summary,
      chiefComplaint: aiResponse.chiefComplaint,
      medicationChanges: aiResponse.medicationChanges || [],
      abnormalLabs: aiResponse.abnormalLabs || [],
      keyLabs: aiResponse.keyLabs || '',
      followUpItems: aiResponse.followUpItems || [],
      tokensUsed: completion.usage.total_tokens
    });

  } catch (error) {
    // Log error without exposing PHI
    res.status(500).json({
      error: 'Failed to generate AI summary',
      details: error.message
    });
  }
});

module.exports = router;
