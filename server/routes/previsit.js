/**
 * Pre-Visit AI Summary Generation API
 *
 * Processes uploaded EMR data and generates intelligent summaries for providers
 */

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
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

1. A concise SUMMARY (2-3 paragraphs) highlighting:
   - Patient's current status
   - Key changes since last visit
   - Important clinical findings
   - Any red flags or urgent concerns

2. CHIEF COMPLAINT (1-2 sentences)

3. MEDICATION CHANGES (JSON array of any new/changed/discontinued meds)

4. ABNORMAL LABS (JSON array with lab name, value, and significance)

Format your response as JSON:
{
  "summary": "Full clinical summary here...",
  "chiefComplaint": "Main reason for visit...",
  "medicationChanges": [{"medication": "...", "change": "...", "reason": "..."}],
  "abnormalLabs": [{"test": "...", "value": "...", "status": "high/low", "significance": "..."}],
  "followUpItems": ["item 1", "item 2"]
}`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.VITE_OPENAI_MODEL_STAGE5 || 'gpt-4o',
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
      followUpItems: aiResponse.followUpItems || [],
      tokensUsed: completion.usage.total_tokens
    });

  } catch (error) {
    console.error('Error generating pre-visit summary:', error);
    res.status(500).json({
      error: 'Failed to generate AI summary',
      details: error.message
    });
  }
});

module.exports = router;
