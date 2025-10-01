import { logError, logWarn, logInfo, logDebug } from '../../src/services/logger.service';
/**
 * TSHLA Medical Call Intelligence Service
 * AI-powered analysis of call transcripts for staff dashboard
 * Generates summaries, action items, and priority assessments
 */

const { AzureOpenAI } = require('openai');

class CallIntelligenceService {
  constructor() {
    this.azureOpenAI = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_KEY,
      apiVersion: '2024-02-15-preview',
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
    });

    logDebug('call-intelligence', '$1', $2);
  }

  /**
   * Analyze a complete phone call and generate insights for staff review
   */
  async analyzeCall(callData) {
    try {
      const { call_sid, raw_transcript, patient_name, phone_number, duration_seconds } = callData;

      if (!raw_transcript || raw_transcript.trim().length < 50) {
        logDebug('call-intelligence', '$1', $2);
        return this.generateMinimalSummary(callData);
      }

      logDebug('call-intelligence', '$1', $2);

      const analysis = await this.generateCallAnalysis(raw_transcript, {
        patientName: patient_name,
        phoneNumber: phone_number,
        duration: Math.round(duration_seconds / 60),
      });

      return {
        call_sid,
        summary: analysis.summary,
        key_points: analysis.keyPoints,
        action_items: analysis.actionItems,
        urgency_level: analysis.urgencyLevel,
        provider_needed: analysis.providerNeeded,
        medical_concerns: analysis.medicalConcerns,
        patient_sentiment: analysis.patientSentiment,
        staff_notes: analysis.staffNotes,
        processed_at: new Date(),
      };
    } catch (error) {
      logError('call-intelligence', '$1', $2);
      return this.generateErrorSummary(callData, error.message);
    }
  }

  /**
   * Generate comprehensive call analysis using Azure OpenAI GPT-4
   */
  async generateCallAnalysis(transcript, metadata) {
    const prompt = this.buildAnalysisPrompt(transcript, metadata);

    const response = await this.azureOpenAI.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a medical call analysis AI for TSHLA Medical staff. Analyze phone conversations and generate actionable insights for healthcare staff review. Focus on medical accuracy, urgency assessment, and clear action items.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const analysis = response.choices[0].message.content;
    return this.parseAnalysisResponse(analysis);
  }

  /**
   * Build the analysis prompt for GPT-4
   */
  buildAnalysisPrompt(transcript, metadata) {
    return `
Analyze this medical phone call and provide insights for healthcare staff:

CALL DETAILS:
- Patient: ${metadata.patientName || 'Unknown'}
- Phone: ${metadata.phoneNumber || 'Unknown'}
- Duration: ${metadata.duration || 'Unknown'} minutes

TRANSCRIPT:
${transcript}

REQUIRED ANALYSIS (respond in valid JSON format):
{
    "summary": "2-3 sentence summary of the call focusing on main medical concerns",
    "keyPoints": [
        "Key medical point 1",
        "Key medical point 2",
        "Key medical point 3"
    ],
    "actionItems": [
        {
            "task": "Specific action needed",
            "priority": "high|medium|low",
            "category": "clinical|administrative|follow-up|insurance",
            "assigned_to": "provider|staff|billing",
            "due_date": "timeframe (e.g., '24 hours', '1 week')"
        }
    ],
    "urgencyLevel": "high|medium|low",
    "providerNeeded": true|false,
    "medicalConcerns": [
        "Specific medical concern 1",
        "Specific medical concern 2"
    ],
    "patientSentiment": "satisfied|concerned|frustrated|urgent",
    "staffNotes": "Additional context for staff review"
}

Focus on:
- Medical urgency and safety
- Clear, actionable tasks for staff
- Provider involvement recommendations
- Patient satisfaction and concerns
`;
  }

  /**
   * Parse GPT-4 response into structured data
   */
  parseAnalysisResponse(analysis) {
    try {
      // Extract JSON from the response
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in analysis response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      return {
        summary: parsed.summary || 'Call analysis completed',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        urgencyLevel: ['high', 'medium', 'low'].includes(parsed.urgencyLevel)
          ? parsed.urgencyLevel
          : 'medium',
        providerNeeded: typeof parsed.providerNeeded === 'boolean' ? parsed.providerNeeded : false,
        medicalConcerns: Array.isArray(parsed.medicalConcerns) ? parsed.medicalConcerns : [],
        patientSentiment: parsed.patientSentiment || 'neutral',
        staffNotes: parsed.staffNotes || 'No additional notes',
      };
    } catch (error) {
      logError('call-intelligence', '$1', $2);
      return this.generateFallbackAnalysis(analysis);
    }
  }

  /**
   * Generate fallback analysis when parsing fails
   */
  generateFallbackAnalysis(rawAnalysis) {
    return {
      summary: 'AI analysis completed - please review transcript for details',
      keyPoints: ['Call transcript available for review'],
      actionItems: [
        {
          task: 'Review call transcript manually',
          priority: 'medium',
          category: 'administrative',
          assigned_to: 'staff',
          due_date: '24 hours',
        },
      ],
      urgencyLevel: 'medium',
      providerNeeded: false,
      medicalConcerns: [],
      patientSentiment: 'neutral',
      staffNotes: 'AI analysis parsing failed - raw analysis available in logs',
    };
  }

  /**
   * Generate minimal summary for short transcripts
   */
  generateMinimalSummary(callData) {
    return {
      call_sid: callData.call_sid,
      summary: `Brief ${Math.round(callData.duration_seconds / 60)}-minute call with ${callData.patient_name || 'patient'}`,
      key_points: ['Short call - full transcript available'],
      action_items: [
        {
          task: 'Review short call if needed',
          priority: 'low',
          category: 'administrative',
          assigned_to: 'staff',
          due_date: '1 week',
        },
      ],
      urgency_level: 'low',
      provider_needed: false,
      medical_concerns: [],
      patient_sentiment: 'neutral',
      staff_notes: 'Transcript too short for detailed AI analysis',
      processed_at: new Date(),
    };
  }

  /**
   * Generate error summary when analysis fails
   */
  generateErrorSummary(callData, errorMessage) {
    return {
      call_sid: callData.call_sid,
      summary: `Call analysis failed - manual review needed`,
      key_points: ['AI analysis encountered an error'],
      action_items: [
        {
          task: 'Manually review call transcript',
          priority: 'medium',
          category: 'administrative',
          assigned_to: 'staff',
          due_date: '24 hours',
        },
      ],
      urgency_level: 'medium',
      provider_needed: false,
      medical_concerns: [],
      patient_sentiment: 'unknown',
      staff_notes: `Analysis error: ${errorMessage}`,
      processed_at: new Date(),
    };
  }

  /**
   * Batch analyze multiple calls
   */
  async batchAnalyzeCalls(calls) {
    logDebug('call-intelligence', '$1', $2);
    const results = [];

    for (const call of calls) {
      try {
        const analysis = await this.analyzeCall(call);
        results.push(analysis);

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logError('call-intelligence', '$1', $2);
        results.push(this.generateErrorSummary(call, error.message));
      }
    }

    logInfo('call-intelligence', '$1', $2);
    return results;
  }

  /**
   * Generate provider referral summary
   */
  async generateProviderReferral(callAnalysis, providerType = 'primary care') {
    try {
      const prompt = `
Based on this call analysis, generate a professional summary for referral to a ${providerType} provider:

CALL SUMMARY: ${callAnalysis.summary}
KEY MEDICAL CONCERNS: ${callAnalysis.medical_concerns.join(', ')}
PATIENT SENTIMENT: ${callAnalysis.patient_sentiment}
URGENCY: ${callAnalysis.urgency_level}

Generate a concise, professional summary for the provider including:
1. Brief patient situation
2. Key medical concerns requiring attention
3. Recommended timeline for follow-up
4. Any urgent considerations

Keep it professional and under 200 words.
            `;

      const response = await this.azureOpenAI.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are a medical assistant preparing provider referral summaries. Be concise, professional, and medically accurate.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 300,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      logError('call-intelligence', '$1', $2);
      return `Call Summary: ${callAnalysis.summary}\n\nKey Concerns: ${callAnalysis.medical_concerns.join(', ')}\n\nUrgency Level: ${callAnalysis.urgency_level}\n\nPlease review call transcript for full details.`;
    }
  }
}

module.exports = CallIntelligenceService;
