/**
 * Nutrition Note Review API
 * AI-powered nutrition note processing with dietician feedback loop
 * Uses RAG (Retrieval-Augmented Generation) for continuous improvement
 *
 * HIPAA Compliant - Azure OpenAI with Microsoft BAA
 * Created: 2026-02-04
 */

const express = require('express');
const router = express.Router();
const { AzureOpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');

// Initialize Azure OpenAI client
const azureClient = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.VITE_AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || process.env.VITE_AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01'
});

// Initialize Supabase client (service role for server-side access)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Fetch approved past reviews for RAG context
 * Finds similar notes using full-text search, returns up to 3 examples
 */
async function getRAGContext(noteText) {
  try {
    // Extract key terms from the note for search
    const searchTerms = noteText
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 10)
      .join(' & ');

    if (!searchTerms) {
      // Fallback: get most recent approved reviews
      const { data } = await supabase
        .from('nutrition_note_reviews')
        .select('original_note, ai_summary, ai_recommendations, dietician_revised_summary, dietician_revised_recommendations, dietician_feedback, status')
        .in('status', ['approved', 'revised'])
        .order('created_at', { ascending: false })
        .limit(3);

      return data || [];
    }

    // Try full-text search first
    const { data, error } = await supabase
      .from('nutrition_note_reviews')
      .select('original_note, ai_summary, ai_recommendations, dietician_revised_summary, dietician_revised_recommendations, dietician_feedback, status')
      .in('status', ['approved', 'revised'])
      .textSearch('original_note', searchTerms, { type: 'websearch' })
      .order('created_at', { ascending: false })
      .limit(3);

    if (error || !data || data.length === 0) {
      // Fallback to most recent approved reviews
      const { data: fallbackData } = await supabase
        .from('nutrition_note_reviews')
        .select('original_note, ai_summary, ai_recommendations, dietician_revised_summary, dietician_revised_recommendations, dietician_feedback, status')
        .in('status', ['approved', 'revised'])
        .order('created_at', { ascending: false })
        .limit(3);

      return fallbackData || [];
    }

    return data;
  } catch (err) {
    logger.error('NutritionReview', 'RAG context fetch failed', { error: err.message });
    return [];
  }
}

/**
 * Build the system prompt with RAG context
 */
function buildSystemPrompt(ragExamples) {
  let prompt = `You are an expert clinical nutritionist AI assistant working in an endocrinology and diabetes practice.
Your job is to:
1. Read a nutrition note pasted by a nutritionist/dietician
2. Generate a concise clinical SUMMARY of the note (3-5 sentences)
3. Generate AI RECOMMENDATIONS that ADD VALUE beyond what is already in the note

IMPORTANT RULES FOR RECOMMENDATIONS:
- Your recommendations should be DIFFERENT from or ADDITIONAL to what the nutritionist already documented
- Focus on evidence-based suggestions the nutritionist may not have considered
- Include specific, actionable items (e.g., "Consider adding 25g fiber daily" not just "increase fiber")
- Consider diabetes management, metabolic health, micronutrient needs, and behavioral strategies
- If the note mentions labs, reference clinical guidelines for nutrition-related targets
- Flag any potential nutrient-drug interactions if medications are mentioned
- Suggest follow-up topics or monitoring that wasn't mentioned in the note

FORMAT:
Return your response as JSON with exactly two fields:
{
  "summary": "Your concise clinical summary here...",
  "recommendations": "Your additional AI recommendations here, using numbered points..."
}`;

  // Add RAG examples if available
  if (ragExamples && ragExamples.length > 0) {
    prompt += `\n\nHere are examples of past notes that were reviewed and approved by our dietician.
Use these as reference for the style and quality expected:\n`;

    ragExamples.forEach((example, i) => {
      const approvedSummary = example.dietician_revised_summary || example.ai_summary;
      const approvedRecs = example.dietician_revised_recommendations || example.ai_recommendations;

      prompt += `\n--- APPROVED EXAMPLE ${i + 1} ---`;
      prompt += `\nOriginal Note (excerpt): ${example.original_note.substring(0, 300)}...`;
      prompt += `\nApproved Summary: ${approvedSummary}`;
      prompt += `\nApproved Recommendations: ${approvedRecs}`;

      if (example.status === 'revised' && example.dietician_feedback) {
        prompt += `\nDietician Feedback: ${example.dietician_feedback}`;
      }
      prompt += `\n--- END EXAMPLE ${i + 1} ---\n`;
    });
  }

  return prompt;
}

/**
 * POST /api/nutrition-review/process
 * Process a nutrition note with AI
 *
 * Body:
 *  - note: string (the pasted nutrition note)
 *  - noteType: string (optional: 'diabetes', 'general', 'weight_management')
 */
router.post('/process', async (req, res) => {
  try {
    const { note, noteType } = req.body;

    if (!note || note.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a nutrition note with at least 20 characters'
      });
    }

    logger.info('NutritionReview', 'Processing nutrition note', {
      noteLength: note.length,
      noteType: noteType || 'general'
    });

    // Step 1: Get RAG context from past approved reviews
    const ragExamples = await getRAGContext(note);
    logger.info('NutritionReview', `Found ${ragExamples.length} RAG examples for context`);

    // Step 2: Build prompt with RAG context
    const systemPrompt = buildSystemPrompt(ragExamples);

    // Step 3: Call Azure OpenAI
    const completion = await azureClient.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please analyze this nutrition note and provide a summary and recommendations:\n\n${note}` }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0].message.content;
    const tokensUsed = completion.usage?.total_tokens || 0;

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      // If JSON parse fails, try to extract summary and recommendations from text
      parsed = {
        summary: responseText.substring(0, responseText.indexOf('\n\n') || 500),
        recommendations: responseText.substring(responseText.indexOf('\n\n') || 0)
      };
    }

    // Step 4: Save to database
    const { data: savedReview, error: saveError } = await supabase
      .from('nutrition_note_reviews')
      .insert({
        original_note: note,
        ai_summary: parsed.summary,
        ai_recommendations: parsed.recommendations,
        ai_model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
        ai_tokens_used: tokensUsed,
        note_type: noteType || 'general',
        rag_examples_used: ragExamples.length,
        status: 'pending_review'
      })
      .select()
      .single();

    if (saveError) {
      logger.error('NutritionReview', 'Failed to save review', { error: saveError.message });
      // Still return the AI result even if save fails
      return res.json({
        success: true,
        id: null,
        summary: parsed.summary,
        recommendations: parsed.recommendations,
        tokensUsed,
        ragExamplesUsed: ragExamples.length,
        saveError: 'Failed to save to database - review will not be stored'
      });
    }

    logger.info('NutritionReview', 'Note processed and saved', {
      id: savedReview.id,
      tokensUsed,
      ragExamples: ragExamples.length
    });

    res.json({
      success: true,
      id: savedReview.id,
      summary: parsed.summary,
      recommendations: parsed.recommendations,
      tokensUsed,
      ragExamplesUsed: ragExamples.length
    });

  } catch (error) {
    logger.error('NutritionReview', 'Processing error', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to process nutrition note. Please try again.'
    });
  }
});

/**
 * POST /api/nutrition-review/:id/feedback
 * Submit dietician feedback on an AI-processed note
 *
 * Body:
 *  - agrees: boolean
 *  - dieticianName: string
 *  - feedback: string (required if agrees=false)
 *  - revisedSummary: string (optional, if dietician wants to correct)
 *  - revisedRecommendations: string (optional, if dietician wants to correct)
 */
router.post('/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { agrees, dieticianName, feedback, revisedSummary, revisedRecommendations } = req.body;

    if (typeof agrees !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Please indicate whether you agree or disagree'
      });
    }

    if (!agrees && !feedback) {
      return res.status(400).json({
        success: false,
        error: 'Please provide feedback explaining why you disagree'
      });
    }

    // Determine status
    let status = 'approved';
    if (!agrees && (revisedSummary || revisedRecommendations)) {
      status = 'revised';
    } else if (!agrees) {
      status = 'rejected';
    }

    const updateData = {
      dietician_agrees: agrees,
      dietician_name: dieticianName || 'Anonymous',
      dietician_feedback: feedback || null,
      dietician_revised_summary: revisedSummary || null,
      dietician_revised_recommendations: revisedRecommendations || null,
      status,
      reviewed_at: new Date().toISOString()
    };

    const { data: updated, error: updateError } = await supabase
      .from('nutrition_note_reviews')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('NutritionReview', 'Failed to save feedback', { error: updateError.message, id });
      return res.status(500).json({
        success: false,
        error: 'Failed to save feedback'
      });
    }

    logger.info('NutritionReview', 'Dietician feedback saved', {
      id,
      agrees,
      status,
      dieticianName: dieticianName || 'Anonymous'
    });

    res.json({
      success: true,
      review: updated,
      message: agrees
        ? 'Review approved! This will help improve future AI recommendations.'
        : 'Feedback recorded. Your corrections will help improve future AI recommendations.'
    });

  } catch (error) {
    logger.error('NutritionReview', 'Feedback error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to save feedback'
    });
  }
});

/**
 * GET /api/nutrition-review/history
 * Get past reviews with pagination
 *
 * Query params:
 *  - page: number (default 1)
 *  - limit: number (default 20)
 *  - status: string (optional filter)
 */
router.get('/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status;

    let query = supabase
      .from('nutrition_note_reviews')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error('NutritionReview', 'History fetch error', { error: error.message });
      return res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }

    res.json({
      success: true,
      reviews: data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    logger.error('NutritionReview', 'History error', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

/**
 * GET /api/nutrition-review/stats
 * Get learning statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { data: allReviews, error } = await supabase
      .from('nutrition_note_reviews')
      .select('status, dietician_agrees');

    if (error) {
      return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }

    const stats = {
      total: allReviews?.length || 0,
      approved: allReviews?.filter(r => r.status === 'approved').length || 0,
      revised: allReviews?.filter(r => r.status === 'revised').length || 0,
      rejected: allReviews?.filter(r => r.status === 'rejected').length || 0,
      pendingReview: allReviews?.filter(r => r.status === 'pending_review').length || 0,
      agreementRate: 0
    };

    const reviewed = stats.approved + stats.revised + stats.rejected;
    if (reviewed > 0) {
      stats.agreementRate = Math.round((stats.approved / reviewed) * 100);
    }

    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

module.exports = router;
