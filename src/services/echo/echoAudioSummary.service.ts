/**
 * Echo Audio Summary Service
 * Generates patient-friendly conversational summaries from SOAP notes
 * For use in automated phone calls via Twilio + ElevenLabs
 */

import { logInfo, logError, logDebug } from '../logger.service';

export interface AudioSummaryResult {
  script: string;
  wordCount: number;
  estimatedSeconds: number;
  model: string;
}

class EchoAudioSummaryService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    this.model = import.meta.env.VITE_OPENAI_MODEL_STAGE4 || 'gpt-4o-mini';

    if (!this.apiKey) {
      logError('EchoAudioSummary', 'OpenAI API key not configured');
    } else {
      logInfo('EchoAudioSummary', `Initialized with model: ${this.model}`);
    }
  }

  /**
   * Generate patient-friendly conversational summary from SOAP note
   * Target: 15-30 seconds when spoken (100-150 words)
   */
  async generatePatientSummary(soapNote: string): Promise<AudioSummaryResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!soapNote || soapNote.trim().length === 0) {
      throw new Error('SOAP note cannot be empty');
    }

    logInfo('EchoAudioSummary', `Generating patient summary from SOAP note (${soapNote.length} chars)`);

    const prompt = this.buildPrompt(soapNote);

    try {
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
              content: 'You are a medical communication specialist creating patient-friendly phone call scripts. Be conversational, warm, and clear. Avoid medical jargon.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7, // Slightly creative for natural conversational tone
          max_tokens: 300 // Limit to keep it concise
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError('EchoAudioSummary', `OpenAI API error (${response.status})`, { error: errorText });
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const script = data.choices[0]?.message?.content || '';

      if (!script.trim()) {
        throw new Error('OpenAI returned empty response');
      }

      // Calculate metrics
      const wordCount = script.split(/\s+/).length;
      const estimatedSeconds = Math.ceil((wordCount / 150) * 60); // 150 words/min average

      logInfo('EchoAudioSummary', `Summary generated successfully`, {
        wordCount,
        estimatedSeconds: `${estimatedSeconds}s`,
        targetRange: '15-30s'
      });

      // Warn if too long
      if (estimatedSeconds > 35) {
        logError('EchoAudioSummary', `Summary is too long (${estimatedSeconds}s). Target is 15-30s.`, {
          wordCount,
          suggestion: 'Consider regenerating with stricter length constraints'
        });
      }

      return {
        script: script.trim(),
        wordCount,
        estimatedSeconds,
        model: this.model
      };
    } catch (error: any) {
      logError('EchoAudioSummary', `Failed to generate summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the AI prompt for summary generation
   */
  private buildPrompt(soapNote: string): string {
    return `You are converting a medical SOAP note into a patient-friendly phone call script.

CRITICAL RULES:
1. START with exactly: "This is a beta project from your doctor's office."
2. Use warm, conversational, natural language (avoid clinical jargon)
3. Say "You came in for [reason]" NOT "Chief complaint was" or "Presented with"
4. Include in this exact order:
   a) Why they came in (conversational, friendly tone)
   b) Key findings (blood sugar levels, vitals, important results - use plain English)
   c) Medication changes (what's new, what's different, doses stated clearly)
   d) Tests ordered (labs, imaging - explain what and why in simple terms)
   e) Follow-up plan (when to come back, specific date if possible)
   f) What patient should do (take meds, diet, exercise, lifestyle)
5. END with exactly: "If you notice any errors in this summary, please let us know. We are still testing this feature."
6. TARGET LENGTH: 100-150 words total (will read in 15-30 seconds)
7. NUMBERS: Say "9 point 5" not "nine point five", say "400" not "four hundred"
8. MEDICATIONS: Say full name and dose very clearly: "Metformin 1500 milligrams twice daily"
9. TONE: Warm but professional, like a caring nurse explaining things to a family member
10. NO MEDICAL JARGON: Replace terms like "A1C" with "diabetes test", "BP" with "blood pressure"

SOAP NOTE:
${soapNote}

Generate ONLY the conversational phone script (no preamble, no explanations, no meta-commentary - just the script that will be read to the patient):`;
  }

  /**
   * Extract patient name from SOAP note (if available)
   * Used for personalizing the greeting
   */
  private extractPatientName(soapNote: string): string | null {
    // Try to find patient name in common SOAP formats
    const patterns = [
      /PATIENT:\s*([A-Za-z\s]+),/i,
      /Patient Name:\s*([A-Za-z\s]+)/i,
      /Name:\s*([A-Za-z\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = soapNote.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const echoAudioSummaryService = new EchoAudioSummaryService();
