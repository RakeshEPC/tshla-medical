/**
 * AI Chat Educator API Routes
 * Handles patient AI chat requests for diabetes education
 * Integrates with ElevenLabs for text-to-speech
 * Created: 2026-01-23
 */

const express = require('express');
const router = express.Router();
const aiChatService = require('../services/aiChatEducator.service');
const axios = require('axios');
const logger = require('../logger');

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.VITE_ELEVENLABS_DEFAULT_VOICE_ID || 'cgSgspJ2msm6clMCkdW9'; // Rachel voice

/**
 * POST /api/ai-chat/message
 * Send a message to the AI educator
 *
 * Body:
 *  - tshlaId: string
 *  - message: string
 *  - sessionId: string
 */
router.post('/message', async (req, res) => {
  try {
    const { tshlaId, message, sessionId } = req.body;

    if (!tshlaId || !message || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Get patient phone from TSH ID (try both normalized and formatted versions)
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    let patient = null;

    // Try normalized format first (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('phone_primary')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('phone_primary')
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

    // Call AI chat service
    const result = await aiChatService.chatWithEducator(
      patient.phone_primary,
      message,
      sessionId
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Generate audio using ElevenLabs
    let audioUrl = null;
    if (result.audioText && ELEVENLABS_API_KEY && result.conversationId) {
      try {
        const audioResult = await generateElevenLabsAudio(result.audioText);
        if (audioResult.success && audioResult.audioUrl) {
          audioUrl = audioResult.audioUrl;

          // Update conversation with audio URL
          await aiChatService.updateConversationAudio(
            result.conversationId,
            audioUrl
          );
        }
      } catch (audioError) {
        logger.error('AIChat', 'ElevenLabs audio generation error:', audioError);
        // Non-critical, continue without audio
      }
    }

    res.json({
      success: true,
      message: result.assistantMessage,
      audioUrl,
      urgentAlert: result.urgentAlert,
      tokensUsed: result.tokensUsed,
      costCents: result.costCents,
      topic: result.topic
    });

  } catch (error) {
    logger.error('AIChat', 'AI chat message error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/ai-chat/stats
 * Get patient's AI chat statistics for today
 *
 * Query:
 *  - tshlaId: string
 */
router.get('/stats', async (req, res) => {
  try {
    const { tshlaId } = req.query;

    if (!tshlaId) {
      return res.status(400).json({
        success: false,
        error: 'Missing tshlaId'
      });
    }

    // Get patient phone from TSH ID (try both normalized and formatted versions)
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    let patient = null;

    // Try normalized format first (TSH123001)
    const result1 = await supabase
      .from('unified_patients')
      .select('phone_primary')
      .eq('tshla_id', normalizedTshId)
      .maybeSingle();

    if (result1.data) {
      patient = result1.data;
    } else {
      // Try formatted version (TSH 123-001)
      const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
      const result2 = await supabase
        .from('unified_patients')
        .select('phone_primary')
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

    // Get today's analytics
    const today = new Date().toISOString().split('T')[0];
    const { data: analytics } = await supabase
      .from('patient_ai_analytics')
      .select('*')
      .eq('patient_phone', patient.phone_primary)
      .eq('date', today)
      .single();

    res.json({
      success: true,
      stats: {
        questionsToday: analytics?.total_questions || 0,
        questionsRemaining: 20 - (analytics?.total_questions || 0),
        dailyLimit: 20
      }
    });

  } catch (error) {
    logger.error('AIChat', 'AI chat stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/ai-chat/rate
 * Rate a conversation message
 *
 * Body:
 *  - conversationId: string
 *  - helpful: boolean
 */
router.post('/rate', async (req, res) => {
  try {
    const { conversationId, helpful } = req.body;

    if (!conversationId || typeof helpful !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const result = await aiChatService.rateConversation(conversationId, helpful);

    res.json(result);

  } catch (error) {
    logger.error('AIChat', 'Rate conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/ai-chat/history (Staff only)
 * Get conversation history for analytics
 *
 * Query:
 *  - tshlaId: string
 *  - limit: number (optional, default 50)
 */
router.get('/history', async (req, res) => {
  try {
    const { tshlaId, limit } = req.query;

    if (!tshlaId) {
      return res.status(400).json({
        success: false,
        error: 'Missing tshlaId'
      });
    }

    // Get patient phone from TSH ID
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: patient } = await supabase
      .from('unified_patients')
      .select('phone_primary')
      .eq('tshla_id', tshlaId)
      .single();

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    const result = await aiChatService.getConversationHistory(
      patient.phone_primary,
      parseInt(limit) || 50
    );

    res.json(result);

  } catch (error) {
    logger.error('AIChat', 'Get conversation history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Generate audio using ElevenLabs
 * @param {string} text - Text to convert to speech
 * @returns {Promise<{success: boolean, audioUrl?: string, audioCharacters?: number}>}
 */
async function generateElevenLabsAudio(text) {
  try {
    if (!ELEVENLABS_API_KEY) {
      logger.warn('AIChat', 'ElevenLabs API key not configured, skipping audio generation');
      return { success: true, audioUrl: null, audioCharacters: 0 };
    }

    // ElevenLabs API call
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    // Get audio data
    const audioBuffer = Buffer.from(response.data);

    // Upload to Supabase Storage
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const fileName = `ai-chat-audio/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('patient-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      logger.error('AIChat', 'Supabase storage upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('patient-audio')
      .getPublicUrl(fileName);

    return {
      success: true,
      audioUrl: urlData.publicUrl,
      audioCharacters: text.length
    };

  } catch (error) {
    logger.error('AIChat', 'ElevenLabs audio generation error:', error);
    return {
      success: false,
      error: error.message,
      audioUrl: null
    };
  }
}

/**
 * GET /api/ai-chat/analytics (Staff only)
 * Get aggregated analytics for date range
 *
 * Query:
 *  - startDate: string (YYYY-MM-DD)
 *  - endDate: string (YYYY-MM-DD)
 */
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing startDate or endDate'
      });
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get aggregated analytics
    const { data: analytics } = await supabase
      .from('patient_ai_analytics')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    // Calculate totals
    const totals = (analytics || []).reduce(
      (acc, day) => ({
        total_questions: acc.total_questions + day.total_questions,
        total_tokens: acc.total_tokens + day.total_tokens,
        total_cost_cents: acc.total_cost_cents + day.total_cost_cents,
        avg_response_time_ms:
          acc.avg_response_time_ms + day.avg_response_time_ms * day.total_questions
      }),
      { total_questions: 0, total_tokens: 0, total_cost_cents: 0, avg_response_time_ms: 0 }
    );

    const avg_response_time_ms =
      totals.total_questions > 0
        ? totals.avg_response_time_ms / totals.total_questions
        : 0;

    // Count active patients
    const uniquePatients = new Set((analytics || []).map((a) => a.patient_phone));

    // Get satisfaction rate
    const { data: ratings } = await supabase
      .from('patient_ai_conversations')
      .select('helpful_rating')
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`)
      .not('helpful_rating', 'is', null);

    const helpfulCount = (ratings || []).filter((r) => r.helpful_rating === true).length;
    const satisfaction_rate =
      ratings && ratings.length > 0 ? helpfulCount / ratings.length : 0;

    // Get topic breakdown
    const { data: conversations } = await supabase
      .from('patient_ai_conversations')
      .select('topic_category')
      .eq('message_role', 'assistant')
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`);

    const topicCounts = {};
    (conversations || []).forEach((c) => {
      topicCounts[c.topic_category] = (topicCounts[c.topic_category] || 0) + 1;
    });

    const topicBreakdown = Object.entries(topicCounts)
      .map(([topic, count]) => ({
        topic,
        count,
        percentage: ((count / (conversations?.length || 1)) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      analytics: {
        total_questions: totals.total_questions,
        total_tokens: totals.total_tokens,
        total_cost_cents: totals.total_cost_cents,
        avg_response_time_ms: Math.round(avg_response_time_ms),
        satisfaction_rate,
        active_patients: uniquePatients.size
      },
      topicBreakdown
    });

  } catch (error) {
    logger.error('AIChat', 'Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/ai-chat/conversations (Staff only)
 * Get recent conversations with filters
 *
 * Query:
 *  - limit: number (optional, default 50)
 *  - topic: string (optional, default 'all')
 */
router.get('/conversations', async (req, res) => {
  try {
    const { limit, topic } = req.query;

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let query = supabase
      .from('patient_ai_conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit) || 50);

    if (topic && topic !== 'all') {
      query = query.eq('topic_category', topic);
    }

    const { data: conversations } = await query;

    res.json({
      success: true,
      conversations: conversations || []
    });

  } catch (error) {
    logger.error('AIChat', 'Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/ai-chat/urgent-alerts (Staff only)
 * Get pending urgent alerts
 */
router.get('/urgent-alerts', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: alerts } = await supabase
      .from('patient_urgent_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    res.json({
      success: true,
      alerts: alerts || []
    });

  } catch (error) {
    logger.error('AIChat', 'Get urgent alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
