/**
 * Patient Summary Generator Service
 * Converts medical SOAP notes into patient-friendly summaries
 *
 * Features:
 * - Plain English conversion (no medical jargon)
 * - 15-30 second read time (150-200 words)
 * - Action-oriented (what patient needs to do)
 * - Structured output with key actions
 *
 * BETA FEATURE - for testing and feedback
 */

import { logInfo, logError, logDebug } from './logger.service';

export interface SOAPInput {
  plan?: string;
  assessment?: string;
  medications?: string;
  followUp?: string;
  orders?: {
    medications?: any[];
    labs?: any[];
    imaging?: any[];
    appointments?: any[];
  };
}

export interface PatientSummary {
  summary_text: string;
  key_actions: {
    medications: string[];
    labs: string[];
    appointments: string[];
    lifestyle: string[];
  };
  word_count: number;
  estimated_read_time_seconds: number;
}

class PatientSummaryGeneratorService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    this.model = import.meta.env.VITE_OPENAI_MODEL_STAGE4 || 'gpt-4o-mini'; // Cheaper model for summaries

    if (!this.apiKey) {
      logError('patientSummary', 'OpenAI API key not configured for patient summaries');
    }
  }

  /**
   * Generate patient-friendly summary from SOAP note
   */
  async generateSummary(soapInput: SOAPInput): Promise<PatientSummary> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    logInfo('patientSummary', 'Generating patient-friendly summary');

    try {
      const prompt = this.buildPrompt(soapInput);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are a compassionate medical assistant who explains doctor visits to patients in simple, friendly terms.

CRITICAL RULES:
- Use plain English (6th grade reading level)
- Say "you/your" not "the patient"
- Avoid medical jargon (say "blood sugar" not "glucose", "high blood pressure" not "hypertension")
- Be warm and encouraging
- Keep it SHORT (150-200 words total)
- Focus on what the patient NEEDS TO DO

Your goal is to help patients understand and remember the key takeaways from their visit.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7, // Slightly creative for friendly tone
          max_tokens: 500,  // Keep it concise
          response_format: { type: 'json_object' } // Request JSON format
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const rawContent = data.choices[0]?.message?.content || '';

      if (!rawContent.trim()) {
        throw new Error('OpenAI returned empty response');
      }

      // Parse JSON response
      const parsedSummary = JSON.parse(rawContent);

      // Format and validate the summary
      const summary = this.formatSummary(parsedSummary);

      logInfo('patientSummary', 'Patient summary generated successfully', {
        wordCount: summary.word_count,
        readTime: summary.estimated_read_time_seconds
      });

      return summary;

    } catch (error: any) {
      logError('patientSummary', `Failed to generate patient summary: ${error.message}`);

      // Return a fallback summary
      return this.createFallbackSummary(soapInput);
    }
  }

  /**
   * Build AI prompt for summary generation
   */
  private buildPrompt(soapInput: SOAPInput): string {
    return `Create a SHORT, friendly summary of this doctor's visit for the patient.

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
    "medications": ["Action item 1", "Action item 2"],
    "labs": ["Lab to do 1", "Lab to do 2"],
    "appointments": ["Schedule follow-up in 3 months"],
    "lifestyle": ["Diet change 1", "Exercise goal 1"]
  }
}

RULES FOR WRITING:
- Use "you/your" (not "patient/the patient")
- Translate jargon:
  * "blood sugar" not "glucose"
  * "high blood pressure" not "hypertension"
  * "kidney function" not "creatinine"
  * "cholesterol" not "lipids"
- Keep each bullet SHORT (max 10 words)
- Be specific: "Take Lantus 20 units at bedtime" not "Adjust insulin"
- Be encouraging: "Great job managing your diabetes!"
- If no action needed, say "Keep doing what you're doing!"

Remember: This patient just left the doctor's office and needs clear instructions on what to do next!`;
  }

  /**
   * Format AI response into structured PatientSummary
   */
  private formatSummary(aiResponse: any): PatientSummary {
    const sections = aiResponse.summary_sections || {};

    // Build narrative summary text
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

    // Clean up key actions (ensure they're arrays)
    const keyActions = {
      medications: Array.isArray(aiResponse.key_actions?.medications)
        ? aiResponse.key_actions.medications
        : [],
      labs: Array.isArray(aiResponse.key_actions?.labs)
        ? aiResponse.key_actions.labs
        : [],
      appointments: Array.isArray(aiResponse.key_actions?.appointments)
        ? aiResponse.key_actions.appointments
        : [],
      lifestyle: Array.isArray(aiResponse.key_actions?.lifestyle)
        ? aiResponse.key_actions.lifestyle
        : []
    };

    // Calculate word count and reading time
    const wordCount = summaryText.split(/\s+/).filter(w => w).length;
    const estimatedReadTime = Math.ceil(wordCount / 200 * 60); // 200 words per minute

    return {
      summary_text: summaryText.trim(),
      key_actions: keyActions,
      word_count: wordCount,
      estimated_read_time_seconds: estimatedReadTime
    };
  }

  /**
   * Create fallback summary when AI fails
   */
  private createFallbackSummary(soapInput: SOAPInput): PatientSummary {
    logDebug('patientSummary', 'Creating fallback summary (AI unavailable)');

    let summaryText = '**What We Talked About:**\n';
    summaryText += 'We reviewed your health and discussed your treatment plan.\n\n';

    if (soapInput.plan) {
      summaryText += '**The Plan:**\n';
      // Extract first few sentences from plan
      const planSentences = soapInput.plan.split(/[.!?]+/).slice(0, 3).join('. ');
      summaryText += planSentences + '.\n\n';
    }

    summaryText += '**Next Steps:**\n';
    summaryText += '- Follow your current medication plan\n';
    summaryText += '- Contact us if you have questions or concerns\n';
    summaryText += '- Schedule your follow-up appointment\n\n';

    summaryText += '**Questions?**\n';
    summaryText += 'Please call our office if anything is unclear.';

    const wordCount = summaryText.split(/\s+/).filter(w => w).length;

    return {
      summary_text: summaryText,
      key_actions: {
        medications: [],
        labs: [],
        appointments: ['Schedule follow-up appointment'],
        lifestyle: []
      },
      word_count: wordCount,
      estimated_read_time_seconds: Math.ceil(wordCount / 200 * 60)
    };
  }

  /**
   * Extract plain text from markdown/formatted text
   */
  private extractPlainText(text: string): string {
    return text
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/\*/g, '')   // Remove italic markers
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .trim();
  }

  /**
   * Validate summary meets quality standards
   */
  validateSummary(summary: PatientSummary): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check word count (target: 150-200, acceptable: 100-300)
    if (summary.word_count < 100) {
      issues.push('Summary too short (under 100 words)');
    }
    if (summary.word_count > 300) {
      issues.push('Summary too long (over 300 words)');
    }

    // Check read time (target: 15-30 seconds, acceptable: 10-45)
    if (summary.estimated_read_time_seconds < 10) {
      issues.push('Read time too short (under 10 seconds)');
    }
    if (summary.estimated_read_time_seconds > 45) {
      issues.push('Read time too long (over 45 seconds)');
    }

    // Check for medical jargon (common terms that should be avoided)
    const jargonTerms = [
      'hypertension',
      'hyperglycemia',
      'hyperlipidemia',
      'dyslipidemia',
      'nephropathy',
      'neuropathy',
      'retinopathy',
      'creatinine',
      'lipid panel',
      'titrate',
      'prn'
    ];

    const summaryLower = summary.summary_text.toLowerCase();
    jargonTerms.forEach(term => {
      if (summaryLower.includes(term)) {
        issues.push(`Contains medical jargon: "${term}"`);
      }
    });

    // Check for "patient" references (should use "you/your")
    if (summaryLower.includes('the patient') || summaryLower.includes('patient will')) {
      issues.push('Uses "the patient" instead of "you/your"');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const patientSummaryGenerator = new PatientSummaryGeneratorService();
