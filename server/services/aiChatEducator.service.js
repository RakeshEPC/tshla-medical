/**
 * AI Chat Educator Service
 * Provides diabetes education to patients via AI chat
 * Uses comprehensive H&P as context (not individual dictations)
 * Implements safety guardrails and urgent symptom detection
 * HIPAA-compliant with Azure OpenAI
 *
 * Created: 2026-01-23
 */

const { createClient } = require('@supabase/supabase-js');
const { AzureOpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Azure OpenAI (HIPAA-compliant)
const azureClient = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.VITE_AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || process.env.VITE_AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01'
});

// Rate limiting storage (in-memory for now, consider Redis for production)
const rateLimits = new Map();

// Urgent symptom keywords
const URGENT_SYMPTOMS = [
  'chest pain',
  'shortness of breath',
  'severe headache',
  'vision loss',
  'numbness',
  'confusion',
  'unconscious',
  'seizure',
  'suicidal',
  'blood sugar over 400',
  'blood sugar under 40',
  'severe hypoglycemia',
  'ketoacidosis',
  'dka'
];

/**
 * Main AI chat function
 * @param {string} patientPhone - Patient phone number
 * @param {string} userMessage - Patient's question
 * @param {string} sessionId - Patient portal session ID
 * @returns {Promise<{success: boolean, assistantMessage?: string, audioText?: string, urgentAlert?: boolean, error?: string}>}
 */
async function chatWithEducator(patientPhone, userMessage, sessionId) {
  try {
    // 1. Check rate limits (20 questions per day, 500 char per question)
    const rateLimitCheck = await checkRateLimit(patientPhone);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: rateLimitCheck.error
      };
    }

    // 2. Validate message length
    if (userMessage.length > 500) {
      return {
        success: false,
        error: 'Question is too long. Please keep questions under 500 characters.'
      };
    }

    // 3. Load patient's comprehensive H&P for context
    const hpContext = await loadPatientHPContext(patientPhone);
    if (!hpContext.success) {
      return {
        success: false,
        error: 'Unable to load your medical information. Please try again.'
      };
    }

    // 4. Check for urgent symptoms
    const urgentCheck = checkForUrgentSymptoms(userMessage);
    if (urgentCheck.isUrgent) {
      // Create alert for staff
      await createUrgentAlert(patientPhone, urgentCheck.symptoms, userMessage);

      return {
        success: true,
        assistantMessage: 'I\'ve detected that you may be experiencing urgent symptoms. I\'ve notified your care team immediately. If this is an emergency, please call 911 or go to the nearest emergency room right away.',
        audioText: 'I\'ve detected that you may be experiencing urgent symptoms. I\'ve notified your care team immediately. If this is an emergency, please call 911 or go to the nearest emergency room right away.',
        urgentAlert: true
      };
    }

    // 5. Build AI prompt with H&P context
    const systemPrompt = buildEducatorPrompt(hpContext.hp);

    // 6. Call Azure OpenAI
    const startTime = Date.now();
    const completion = await azureClient.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 800,
      top_p: 0.9,
      frequency_penalty: 0.3,
      presence_penalty: 0.3
    });

    const assistantMessage = completion.choices[0].message.content;
    const tokensUsed = completion.usage.total_tokens;
    const responseTime = Date.now() - startTime;

    // 7. Calculate cost (Azure OpenAI pricing: ~$0.03 per 1K tokens for GPT-4)
    const costCents = Math.ceil((tokensUsed / 1000) * 3); // 3 cents per 1K tokens

    // 8. Classify topic (do this async, don't wait for it - it's not critical for response)
    const topic = classifyTopicQuick(userMessage);

    // 9. Save conversation to database (async in background)
    const conversationId = uuidv4();
    saveConversation({
      conversationId,
      patientPhone,
      sessionId,
      userMessage,
      assistantMessage,
      topic,
      tokensUsed,
      costCents,
      responseTime
    }).catch(error => logger.error('AIChat', 'Background save conversation error', { error: error.message }));

    // 10. Return response (audio text same as message for ElevenLabs)
    return {
      success: true,
      assistantMessage,
      audioText: assistantMessage,
      urgentAlert: false,
      tokensUsed,
      costCents,
      topic,
      conversationId
    };

  } catch (error) {
    logger.error('AIChat', 'AI Chat Educator error:', error);
    return {
      success: false,
      error: 'Sorry, I\'m having trouble right now. Please try again in a moment.'
    };
  }
}

/**
 * Check rate limits
 */
async function checkRateLimit(patientPhone) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get today's question count
    const { data: analytics } = await supabase
      .from('patient_ai_analytics')
      .select('total_questions')
      .eq('patient_phone', patientPhone)
      .eq('date', today)
      .single();

    const questionsToday = analytics?.total_questions || 0;

    if (questionsToday >= 20) {
      return {
        allowed: false,
        error: 'You\'ve reached your daily limit of 20 questions. Please try again tomorrow.'
      };
    }

    return { allowed: true };
  } catch (error) {
    logger.error('AIChat', 'Rate limit check error:', error);
    return { allowed: true }; // Fail open to not block patients
  }
}

/**
 * Load patient's comprehensive H&P for context
 */
async function loadPatientHPContext(patientPhone) {
  try {
    const { data: hp, error } = await supabase
      .from('patient_comprehensive_chart')
      .select('*')
      .eq('patient_phone', patientPhone)
      .single();

    if (error || !hp) {
      return { success: false };
    }

    return { success: true, hp };
  } catch (error) {
    logger.error('AIChat', 'Load H&P context error:', error);
    return { success: false };
  }
}

/**
 * Build educator system prompt with H&P context
 */
function buildEducatorPrompt(hp) {
  const prompt = `You are a caring, empathetic diabetes educator assistant named Rachel. You provide education and support to patients with diabetes, but you do NOT provide medical advice or diagnose conditions.

PATIENT CONTEXT (Use this to personalize your responses):
- Medications: ${JSON.stringify(hp.medications || [])}
- Diagnoses: ${JSON.stringify(hp.diagnoses || [])}
- Current Goals: ${JSON.stringify(hp.current_goals || [])}
- Allergies: ${JSON.stringify(hp.allergies || [])}
- Recent Labs: ${hp.labs ? Object.keys(hp.labs).slice(0, 5).join(', ') : 'None recorded'}

YOUR ROLE:
1. Provide education about diabetes, medications, lifestyle, and self-management
2. Explain lab results, medication purposes, and general health concepts
3. Support patients in achieving their health goals
4. Answer questions about diet, exercise, and daily diabetes care
5. Explain what to expect from treatments and procedures

STRICT BOUNDARIES (You MUST refuse these requests):
- DO NOT diagnose any condition or symptom
- DO NOT prescribe medications or change dosages
- DO NOT provide medical advice requiring clinical judgment
- DO NOT interpret symptoms as medical conditions
- DO NOT answer non-medical questions (politics, weather, jokes, etc.)

SAFETY RESPONSES:
- If patient describes urgent symptoms (chest pain, confusion, severe hypo/hyperglycemia), respond: "These symptoms require immediate medical attention. Please call 911 or go to the emergency room right away. I'm also alerting your care team."
- For clinical questions requiring a doctor, respond: "That's an important question for your doctor. I recommend calling the office to discuss this with your healthcare provider."
- For off-topic questions, respond: "I'm here to help with diabetes education and self-management. For other topics, I recommend speaking with your healthcare team or other resources."

COMMUNICATION STYLE:
- Warm, empathetic, and encouraging (like a friendly educator, not a robot)
- Use simple language (avoid medical jargon, or explain it clearly)
- Keep responses concise (2-3 paragraphs max)
- Be specific and actionable when possible
- Acknowledge the patient's feelings and challenges
- Reference their current medications/goals when relevant

Remember: You are Rachel, a knowledgeable diabetes educator who cares deeply about helping patients understand and manage their diabetes. Be human, be warm, be supportive.`;

  return prompt;
}

/**
 * Check for urgent symptoms in message
 */
function checkForUrgentSymptoms(message) {
  const lowerMessage = message.toLowerCase();
  const detectedSymptoms = [];

  for (const symptom of URGENT_SYMPTOMS) {
    if (lowerMessage.includes(symptom)) {
      detectedSymptoms.push(symptom);
    }
  }

  return {
    isUrgent: detectedSymptoms.length > 0,
    symptoms: detectedSymptoms
  };
}

/**
 * Create urgent alert for staff
 */
async function createUrgentAlert(patientPhone, symptoms, message) {
  try {
    await supabase.from('patient_urgent_alerts').insert({
      id: uuidv4(),
      patient_phone: patientPhone,
      alert_type: 'urgent_symptom',
      detected_symptoms: symptoms,
      patient_message: message,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('AIChat', 'Create urgent alert error:', error);
  }
}

/**
 * Classify topic quickly (keyword-based, instant)
 */
function classifyTopicQuick(userMessage) {
  const message = userMessage.toLowerCase();

  // Simple keyword-based classification (instant)
  if (message.includes('insulin') || message.includes('medication') || message.includes('drug')) {
    return 'medications';
  } else if (message.includes('eat') || message.includes('food') || message.includes('diet') || message.includes('carb') || message.includes('meal')) {
    return 'diet';
  } else if (message.includes('exercise') || message.includes('activity') || message.includes('walk') || message.includes('gym')) {
    return 'exercise';
  } else if (message.includes('blood sugar') || message.includes('glucose') || message.includes('a1c') || message.includes('monitor')) {
    return 'monitoring';
  } else if (message.includes('symptom') || message.includes('side effect') || message.includes('feel')) {
    return 'symptoms';
  } else if (message.includes('lab') || message.includes('test') || message.includes('result')) {
    return 'lab_results';
  } else {
    return 'general';
  }
}

/**
 * Classify conversation topic (DEPRECATED - use classifyTopicQuick instead)
 */
async function classifyTopic(userMessage, assistantMessage) {
  const combined = `${userMessage} ${assistantMessage}`.toLowerCase();

  // Simple keyword-based classification
  if (combined.includes('insulin') || combined.includes('medication')) {
    return 'medications';
  } else if (combined.includes('diet') || combined.includes('food') || combined.includes('carb')) {
    return 'diet';
  } else if (combined.includes('exercise') || combined.includes('activity')) {
    return 'exercise';
  } else if (combined.includes('blood sugar') || combined.includes('glucose') || combined.includes('a1c')) {
    return 'monitoring';
  } else if (combined.includes('symptom') || combined.includes('side effect')) {
    return 'symptoms';
  } else if (combined.includes('lab') || combined.includes('test')) {
    return 'lab_results';
  } else {
    return 'general';
  }
}

/**
 * Save conversation to database
 * @returns {Promise<string>} assistantMessageId - ID of assistant message for audio URL update
 */
async function saveConversation({
  conversationId,
  patientPhone,
  sessionId,
  userMessage,
  assistantMessage,
  topic,
  tokensUsed,
  costCents,
  responseTime
}) {
  try {
    // 1. Save user message
    await supabase.from('patient_ai_conversations').insert({
      id: uuidv4(),
      patient_phone: patientPhone,
      session_id: sessionId,
      message_role: 'user',
      message_text: userMessage,
      topic_category: topic,
      tokens_used: 0,
      cost_cents: 0,
      created_at: new Date().toISOString()
    });

    // 2. Save assistant message (use provided conversationId)
    await supabase.from('patient_ai_conversations').insert({
      id: conversationId,
      patient_phone: patientPhone,
      session_id: sessionId,
      message_role: 'assistant',
      message_text: assistantMessage,
      topic_category: topic,
      tokens_used: tokensUsed,
      audio_characters: assistantMessage.length,
      cost_cents: costCents,
      created_at: new Date().toISOString()
    });

    // 3. Update daily analytics
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('patient_ai_analytics')
      .select('*')
      .eq('patient_phone', patientPhone)
      .eq('date', today)
      .single();

    if (existing) {
      // Update existing record
      await supabase
        .from('patient_ai_analytics')
        .update({
          total_questions: existing.total_questions + 1,
          total_tokens: existing.total_tokens + tokensUsed,
          total_cost_cents: existing.total_cost_cents + costCents,
          avg_response_time_ms: Math.round(
            (existing.avg_response_time_ms * existing.total_questions + responseTime) /
            (existing.total_questions + 1)
          )
        })
        .eq('id', existing.id);
    } else {
      // Create new record
      await supabase.from('patient_ai_analytics').insert({
        id: uuidv4(),
        patient_phone: patientPhone,
        date: today,
        total_questions: 1,
        total_tokens: tokensUsed,
        total_cost_cents: costCents,
        avg_response_time_ms: responseTime
      });
    }

    return conversationId;

  } catch (error) {
    logger.error('AIChat', 'Save conversation error:', error);
    // Non-critical, don't throw
    return null;
  }
}

/**
 * Get conversation history for patient (for staff/analytics only)
 */
async function getConversationHistory(patientPhone, limit = 50) {
  try {
    const { data: conversations } = await supabase
      .from('patient_ai_conversations')
      .select('*')
      .eq('patient_phone', patientPhone)
      .order('created_at', { ascending: false })
      .limit(limit);

    return {
      success: true,
      conversations: conversations || []
    };
  } catch (error) {
    logger.error('AIChat', 'Get conversation history error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rate conversation (thumbs up/down)
 */
async function rateConversation(conversationId, helpful) {
  try {
    await supabase
      .from('patient_ai_conversations')
      .update({ helpful_rating: helpful })
      .eq('id', conversationId);

    return { success: true };
  } catch (error) {
    logger.error('AIChat', 'Rate conversation error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update conversation with audio URL
 */
async function updateConversationAudio(conversationId, audioUrl) {
  try {
    await supabase
      .from('patient_ai_conversations')
      .update({ audio_url: audioUrl })
      .eq('id', conversationId);

    return { success: true };
  } catch (error) {
    logger.error('AIChat', 'Update conversation audio error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  chatWithEducator,
  getConversationHistory,
  rateConversation,
  updateConversationAudio
};
