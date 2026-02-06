/**
 * Patient AI Search Service
 * Provides AI-powered natural language search across patient health data
 *
 * Uses Azure OpenAI to process patient queries and return
 * structured responses with visualization data
 *
 * Created: 2026-02-05
 * Updated: Enhanced prompts for smarter, more conversational responses
 */

const { createClient } = require('@supabase/supabase-js');
const { generateCompletion } = require('./azureOpenAI.service');
const logger = require('../logger');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class PatientAISearchService {
  /**
   * Gather complete patient context for AI processing
   * @param {string} tshlaId - Patient TSH ID (e.g., "TSH 123-456" or "TSH123456")
   * @returns {Object} Complete patient context
   */
  async getPatientContext(tshlaId) {
    // Normalize TSH ID formats
    const normalizedId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
    const formattedId = normalizedId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');

    logger.info('PatientAISearch', 'Gathering patient context', { tshlaId: normalizedId });

    // Fetch all data sources in parallel
    const [
      patientResult,
      chartResult,
      medsResult,
      cgmResult,
      dictationsResult
    ] = await Promise.all([
      // 1. Demographics
      supabase
        .from('unified_patients')
        .select('first_name, last_name, date_of_birth, phone_primary, tshla_id')
        .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
        .limit(1)
        .maybeSingle(),

      // 2. Comprehensive chart (labs, diagnoses, allergies, vitals)
      supabase
        .from('patient_comprehensive_chart')
        .select('labs, diagnoses, allergies, vitals, medications, full_hp_narrative')
        .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
        .order('created_at', { ascending: false })
        .limit(1),

      // 3. Medications table (more detailed)
      supabase
        .from('patient_medications')
        .select('medication_name, dosage, frequency, route, status, start_date')
        .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
        .order('status', { ascending: true }), // Active first

      // 4. CGM readings (last 24 hours)
      supabase
        .from('cgm_readings')
        .select('glucose_value, trend_arrow, trend_direction, reading_timestamp')
        .gte('reading_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('reading_timestamp', { ascending: false })
        .limit(288), // 5-min intervals for 24h

      // 5. Recent dictations/visit notes
      supabase
        .from('dictated_notes')
        .select('visit_date, ai_summary, processed_note, provider_name, chief_complaint')
        .or(`tshla_id.eq.${normalizedId},tshla_id.eq.${formattedId}`)
        .eq('status', 'final')
        .order('visit_date', { ascending: false })
        .limit(3)
    ]);

    // Get patient phone for CGM lookup if needed
    const patient = patientResult.data;
    let cgmReadings = cgmResult.data || [];

    // If no CGM by TSH ID, try by phone
    if (cgmReadings.length === 0 && patient?.phone_primary) {
      const { data: cgmByPhone } = await supabase
        .from('cgm_readings')
        .select('glucose_value, trend_arrow, trend_direction, reading_timestamp')
        .eq('patient_phone', patient.phone_primary)
        .gte('reading_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('reading_timestamp', { ascending: false })
        .limit(288);
      cgmReadings = cgmByPhone || [];
    }

    const chart = chartResult.data?.[0] || {};

    return {
      patient: patient || {},
      labs: chart.labs || {},
      diagnoses: chart.diagnoses || [],
      allergies: chart.allergies || [],
      vitals: chart.vitals || {},
      medications: medsResult.data || chart.medications || [],
      cgmReadings,
      dictations: dictationsResult.data || [],
      hpNarrative: chart.full_hp_narrative || ''
    };
  }

  /**
   * Build optimized context string for AI
   */
  buildContextString(context) {
    const sections = [];

    // Patient info
    const firstName = context.patient.first_name || 'there';
    sections.push(`PATIENT: ${firstName} ${context.patient.last_name || ''}`);

    // Labs - format for better readability
    if (Object.keys(context.labs).length > 0) {
      const labStrings = [];
      for (const [testName, results] of Object.entries(context.labs)) {
        if (Array.isArray(results) && results.length > 0) {
          const latest = results[0];
          const trend = results.length > 1
            ? (latest.value > results[1].value ? '↑' : latest.value < results[1].value ? '↓' : '→')
            : '';
          labStrings.push(`${testName}: ${latest.value}${latest.unit || ''} (${latest.date}) ${trend}`);
        }
      }
      sections.push(`\nLABS:\n${labStrings.join('\n')}`);
    }

    // Medications - only active ones prominently
    if (context.medications.length > 0) {
      const activeMeds = context.medications.filter(m => m.status === 'active' || !m.status);
      const medStrings = activeMeds.slice(0, 15).map(m =>
        `- ${m.medication_name || m.name}: ${m.dosage || m.dose || ''} ${m.frequency || ''}`
      );
      sections.push(`\nCURRENT MEDICATIONS:\n${medStrings.join('\n')}`);
    }

    // Diagnoses
    if (context.diagnoses.length > 0) {
      const diagStrings = context.diagnoses.slice(0, 8).map(d =>
        typeof d === 'string' ? d : (d.name || d.description || JSON.stringify(d))
      );
      sections.push(`\nDIAGNOSES:\n${diagStrings.map(d => `- ${d}`).join('\n')}`);
    }

    // Allergies
    if (context.allergies.length > 0) {
      sections.push(`\nALLERGIES: ${context.allergies.join(', ')}`);
    }

    // Vitals
    if (Object.keys(context.vitals).length > 0) {
      const vitalStrings = Object.entries(context.vitals).map(([k, v]) => `${k}: ${v}`);
      sections.push(`\nVITALS: ${vitalStrings.join(', ')}`);
    }

    // CGM summary
    if (context.cgmReadings.length > 0) {
      const readings = context.cgmReadings;
      const avg = Math.round(readings.reduce((s, r) => s + r.glucose_value, 0) / readings.length);
      const latest = readings[0];
      const high = readings.filter(r => r.glucose_value > 180).length;
      const low = readings.filter(r => r.glucose_value < 70).length;
      const inRange = readings.length - high - low;
      const timeInRange = Math.round((inRange / readings.length) * 100);

      sections.push(`\nGLUCOSE (24h): Current ${latest.glucose_value} mg/dL ${latest.trend_arrow || ''}, Avg ${avg}, Time in range: ${timeInRange}%`);
    }

    // Recent visits
    if (context.dictations.length > 0) {
      const visitStrings = context.dictations.slice(0, 2).map(d =>
        `${d.visit_date}: ${d.chief_complaint || 'Visit'} - ${(d.ai_summary || '').slice(0, 150)}`
      );
      sections.push(`\nRECENT VISITS:\n${visitStrings.join('\n')}`);
    }

    return sections.join('\n');
  }

  /**
   * Process natural language query with AI
   * @param {string} query - Patient's question
   * @param {Object} context - Patient context from getPatientContext()
   * @returns {Object} Structured response with visualization data
   */
  async processQuery(query, context) {
    const firstName = context.patient.first_name || 'there';
    const contextString = this.buildContextString(context);

    const systemPrompt = `You are a friendly, knowledgeable health assistant for ${firstName}. Your job is to help patients understand their health data in a warm, reassuring way.

${contextString}

RESPONSE GUIDELINES:
1. Be conversational and warm - use the patient's first name occasionally
2. Explain medical terms in plain language
3. When discussing values, mention if they're good, concerning, or improved
4. For A1C: <5.7% is normal, 5.7-6.4% is prediabetes, >6.5% is diabetic range
5. For glucose: 70-100 fasting is ideal, 70-140 after meals is good
6. Always be encouraging about positive trends
7. If data is missing, be honest but reassuring
8. Keep answers concise - 2-3 sentences for simple questions, up to a paragraph for complex ones

VISUALIZATION RULES:
- lab_chart: When showing lab trends over time (A1C, cholesterol, etc.) - needs array with date, value, unit
- medication_list: When listing medications - needs array with name, dose, frequency, status
- glucose_graph: When showing blood sugar patterns - needs array with time, value, trend
- vitals_display: When showing vital signs - needs object with vital names and values
- text_summary: For visit summaries or explanations - needs string content
- none: For simple conversational answers

You MUST respond with valid JSON in this exact format:
{
  "answer": "Your friendly response here",
  "visualization": {
    "type": "lab_chart|medication_list|glucose_graph|vitals_display|text_summary|none",
    "title": "Chart/List Title",
    "data": []
  },
  "followUp": "Optional helpful tip (omit if not needed)"
}`;

    const userPrompt = `Question: "${query}"

Respond with JSON only. Choose the most appropriate visualization for the question.`;

    try {
      const result = await generateCompletion({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,  // Slightly lower for more consistent responses
        maxTokens: 1200
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Parse AI response
      let aiResponse;
      try {
        // Clean up response - remove markdown code blocks if present
        let content = result.content.trim();
        if (content.startsWith('```json')) {
          content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (content.startsWith('```')) {
          content = content.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }
        aiResponse = JSON.parse(content);
      } catch (parseError) {
        // If JSON parsing fails, try to extract meaningful content
        logger.warn('PatientAISearch', 'Failed to parse AI JSON response', { error: parseError.message });

        // Try to extract just the answer from the response
        const answerMatch = result.content.match(/"answer"\s*:\s*"([^"]+)"/);
        aiResponse = {
          answer: answerMatch ? answerMatch[1] : result.content.slice(0, 500),
          visualization: { type: 'none', data: [] },
          followUp: null
        };
      }

      // Validate and sanitize response
      aiResponse = this.validateResponse(aiResponse, context);

      logger.info('PatientAISearch', 'Query processed', {
        query,
        vizType: aiResponse.visualization?.type,
        hasFollowUp: !!aiResponse.followUp
      });

      return aiResponse;

    } catch (error) {
      logger.error('PatientAISearch', 'Query processing error', { error: error.message });
      return {
        answer: `I apologize, ${firstName}, but I'm having a bit of trouble right now. Could you try rephrasing your question or try again in a moment?`,
        visualization: { type: 'none', data: [] },
        followUp: null,
        error: error.message
      };
    }
  }

  /**
   * Validate and sanitize AI response
   */
  validateResponse(response, context) {
    // Ensure required fields exist
    if (!response.answer || typeof response.answer !== 'string') {
      response.answer = "I found some information for you.";
    }

    // Ensure visualization object exists
    if (!response.visualization || typeof response.visualization !== 'object') {
      response.visualization = { type: 'none', data: [] };
    }

    // Validate visualization type
    const validTypes = ['lab_chart', 'medication_list', 'glucose_graph', 'vitals_display', 'text_summary', 'none'];
    if (!validTypes.includes(response.visualization.type)) {
      response.visualization.type = 'none';
    }

    // Ensure data is present for visualization types that need it
    if (response.visualization.type !== 'none' && !response.visualization.data) {
      response.visualization.data = [];
    }

    // Convert data to proper format for each type
    if (response.visualization.type === 'lab_chart' && Array.isArray(response.visualization.data)) {
      response.visualization.data = response.visualization.data.map(item => ({
        date: item.date || new Date().toISOString().split('T')[0],
        value: Number(item.value) || 0,
        unit: item.unit || ''
      }));
    }

    if (response.visualization.type === 'medication_list' && Array.isArray(response.visualization.data)) {
      response.visualization.data = response.visualization.data.map(item => ({
        name: item.name || item.medication_name || 'Unknown',
        dose: item.dose || item.dosage || '',
        frequency: item.frequency || '',
        status: item.status || 'active'
      }));
    }

    if (response.visualization.type === 'glucose_graph' && Array.isArray(response.visualization.data)) {
      response.visualization.data = response.visualization.data.map(item => ({
        time: item.time || item.reading_timestamp || new Date().toISOString(),
        value: Number(item.value) || Number(item.glucose_value) || 100,
        trend: item.trend || item.trend_arrow || '→'
      }));
    }

    // Ensure title exists for visualizations
    if (response.visualization.type !== 'none' && !response.visualization.title) {
      const titles = {
        'lab_chart': 'Lab Results',
        'medication_list': 'Your Medications',
        'glucose_graph': 'Glucose Readings',
        'vitals_display': 'Vital Signs',
        'text_summary': 'Summary'
      };
      response.visualization.title = titles[response.visualization.type] || 'Results';
    }

    // Ensure followUp is string or null
    if (response.followUp && typeof response.followUp !== 'string') {
      response.followUp = null;
    }

    return response;
  }

  /**
   * Main search function - combines context gathering and query processing
   */
  async search(query, tshlaId) {
    const context = await this.getPatientContext(tshlaId);

    // Check if we have any data
    const hasData = Object.keys(context.labs).length > 0 ||
                    context.medications.length > 0 ||
                    context.diagnoses.length > 0 ||
                    context.cgmReadings.length > 0;

    const firstName = context.patient.first_name || 'there';

    if (!hasData && !context.hpNarrative) {
      return {
        answer: `Hi ${firstName}! I don't see any health records on file for you just yet. This could mean your records are still being uploaded, or you might need to check with the front desk.`,
        visualization: { type: 'none', data: [] },
        followUp: "Once your records are in the system, you'll be able to ask about your labs, medications, and more!"
      };
    }

    return this.processQuery(query, context);
  }
}

module.exports = new PatientAISearchService();
