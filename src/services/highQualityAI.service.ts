import { logError, logWarn, logInfo, logDebug } from './logger.service';
/**
 * High-Quality AI Processing Service
 * Optimized prompts for Azure OpenAI to match your original quality
 */

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  additionalNotes?: string;
}

interface PatientContext {
  name: string;
  age: number;
  mrn: string;
  visitDate: string;
  chiefComplaint?: string;
  medications?: string[];
  allergies?: string[];
  conditions?: string[];
  vitals?: {
    bp?: string;
    hr?: string;
    temp?: string;
    rr?: string;
    o2?: string;
    weight?: string;
  };
}

export class HighQualityAIService {
  private azureOpenAIEndpoint: string;
  private azureOpenAIKey: string;
  private deploymentName: string = 'gpt-4'; // or 'gpt-35-turbo' for faster/cheaper

  constructor() {
    this.azureOpenAIEndpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    this.azureOpenAIKey = import.meta.env.VITE_AZURE_OPENAI_KEY;
  }

  /**
   * THE PROMPT THAT MAKES ALL THE DIFFERENCE
   * This is what likely worked perfectly before
   */
  private createOptimalPrompt(transcript: string, patient: PatientContext): string {
    return `You are an expert medical scribe creating a professional clinical note.

PATIENT INFORMATION:
• Name: ${patient.name}
• Age: ${patient.age}
• MRN: ${patient.mrn}
• Date: ${patient.visitDate}
${patient.chiefComplaint ? `• Chief Complaint: ${patient.chiefComplaint}` : ''}
${patient.conditions?.length ? `• Active Conditions: ${patient.conditions.join(', ')}` : ''}
${patient.medications?.length ? `• Current Medications: ${patient.medications.join(', ')}` : ''}
${patient.allergies?.length ? `• Allergies: ${patient.allergies.join(', ')}` : ''}

${
  patient.vitals
    ? `VITAL SIGNS:
• Blood Pressure: ${patient.vitals.bp || 'not recorded'}
• Heart Rate: ${patient.vitals.hr || 'not recorded'}
• Temperature: ${patient.vitals.temp || 'not recorded'}
• Respiratory Rate: ${patient.vitals.rr || 'not recorded'}
• O2 Saturation: ${patient.vitals.o2 || 'not recorded'}
• Weight: ${patient.vitals.weight || 'not recorded'}
`
    : ''
}

TRANSCRIBED ENCOUNTER:
${transcript}

INSTRUCTIONS:
Create a professional SOAP note from the above encounter. Follow these EXACT rules:

SUBJECTIVE:
- Start with the chief complaint in the patient's words
- Include all symptoms with:
  • Onset (when it started)
  • Duration (how long)
  • Character (type of pain/symptom)
  • Location (where)
  • Severity (1-10 scale if mentioned)
  • Timing (constant/intermittent)
  • Aggravating factors (what makes it worse)
  • Relieving factors (what makes it better)
- Include pertinent positives AND negatives
- Include relevant medical history mentioned
- DO NOT include exam findings here

OBJECTIVE:
- Start with vital signs (even if normal, state them)
- Physical exam findings in standard order:
  • General appearance
  • HEENT (if examined)
  • Cardiovascular (if examined)
  • Pulmonary (if examined)
  • Abdomen (if examined)
  • Extremities (if examined)
  • Neurological (if examined)
  • Skin (if examined)
  • Psychiatric (if examined)
- Include all lab/imaging results mentioned
- Use medical terminology
- Be specific with findings (don't just say "normal")

ASSESSMENT:
- List diagnoses with ICD-10 codes if possible
- Start with primary diagnosis
- Include differential diagnoses if discussed
- Provide clinical reasoning for primary diagnosis
- Comment on condition status (stable/improving/worsening)
- Format as numbered list:
  1. Primary diagnosis - reasoning
  2. Secondary diagnosis - status
  3. Other conditions - notes

PLAN:
- Organize by problem or category
- Include specific details:
  • Medication: name, dose, route, frequency, duration
  • Labs: specific tests ordered
  • Imaging: type and area
  • Referrals: specialty and reason
  • Follow-up: timeframe and purpose
  • Patient education: topics discussed
- Format as numbered list with categories:
  1. Medications:
     - Started: [medication details]
     - Continued: [medication details]
     - Stopped: [medication details]
  2. Diagnostic Testing:
     - Labs: [specific tests]
     - Imaging: [type and area]
  3. Referrals: [specialty and reason]
  4. Follow-up: [timeframe]
  5. Patient Education: [topics]

IMPORTANT RULES:
- If something wasn't mentioned, don't make it up
- Keep the original meaning from the transcript
- Use proper medical terminology
- Include ONLY information from the encounter
- Be concise but complete
- Format lists properly
- Maintain professional tone

OUTPUT FORMAT:
Provide the SOAP note with clear section headers.`;
  }

  /**
   * Process transcript with optimal settings
   */
  async processTranscriptToSOAP(transcript: string, patient: PatientContext): Promise<SOAPNote> {
    try {
      const prompt = this.createOptimalPrompt(transcript, patient);

      const response = await fetch(
        `${this.azureOpenAIEndpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=2024-02-15-preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.azureOpenAIKey,
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content:
                  'You are a medical scribe. Create accurate SOAP notes from clinical encounters.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3, // Lower = more consistent
            max_tokens: 2000,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
            stop: null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`AI processing failed: ${response.statusText}`);
      }

      const data = await response.json();
      const soapText = data.choices[0].message.content;

      // Parse SOAP sections
      return this.parseSOAPNote(soapText);
    } catch (error) {
      logError('highQualityAI', 'Error message', {});
      // Return structured transcript as fallback
      return this.createFallbackSOAP(transcript, patient);
    }
  }

  /**
   * Parse AI response into structured SOAP
   */
  private parseSOAPNote(text: string): SOAPNote {
    const sections: SOAPNote = {
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    };

    // Extract each section
    const subjectiveMatch = text.match(/SUBJECTIVE:?\s*([\s\S]*?)(?=OBJECTIVE:|$)/i);
    const objectiveMatch = text.match(/OBJECTIVE:?\s*([\s\S]*?)(?=ASSESSMENT:|$)/i);
    const assessmentMatch = text.match(/ASSESSMENT:?\s*([\s\S]*?)(?=PLAN:|$)/i);
    const planMatch = text.match(/PLAN:?\s*([\s\S]*?)(?=$)/i);

    if (subjectiveMatch) sections.subjective = subjectiveMatch[1].trim();
    if (objectiveMatch) sections.objective = objectiveMatch[1].trim();
    if (assessmentMatch) sections.assessment = assessmentMatch[1].trim();
    if (planMatch) sections.plan = planMatch[1].trim();

    // If parsing fails, return the whole text in subjective
    if (!sections.subjective && !sections.objective && !sections.assessment && !sections.plan) {
      sections.subjective = text;
    }

    return sections;
  }

  /**
   * Fallback SOAP generation without AI
   */
  private createFallbackSOAP(transcript: string, patient: PatientContext): SOAPNote {
    return {
      subjective: `Chief Complaint: ${patient.chiefComplaint || 'See transcript'}\n\nHistory of Present Illness:\n${transcript}`,
      objective: `Vital Signs:\n${
        patient.vitals
          ? Object.entries(patient.vitals)
              .map(([key, value]) => `${key.toUpperCase()}: ${value}`)
              .join('\n')
          : 'See documentation'
      }\n\nPhysical Exam:\nSee documentation`,
      assessment: 'Assessment pending physician review',
      plan: 'Plan pending physician review',
    };
  }

  /**
   * Test AI quality with known input/output
   */
  async testAIQuality(): Promise<{ score: number; issues: string[] }> {
    const testTranscript =
      'Patient is a 45-year-old male presenting with chest pain for 2 days. Pain is sharp, worse with deep breathing, better with sitting forward. No shortness of breath. No fever. Vital signs: BP 130/80, HR 88, temp 98.6. Lungs clear. Heart regular rate and rhythm. Abdomen soft. Assessment: likely pericarditis. Plan: start ibuprofen 600mg three times daily, EKG, follow up in one week.';

    const testPatient: PatientContext = {
      name: 'Test Patient',
      age: 45,
      mrn: 'TEST123',
      visitDate: new Date().toLocaleDateString(),
    };

    const result = await this.processTranscriptToSOAP(testTranscript, testPatient);

    // Check quality markers
    const issues: string[] = [];
    let score = 100;

    if (!result.subjective.includes('chest pain')) {
      issues.push('Missing chief complaint');
      score -= 20;
    }
    if (!result.objective.includes('130/80')) {
      issues.push('Missing vital signs');
      score -= 20;
    }
    if (!result.assessment.toLowerCase().includes('pericarditis')) {
      issues.push('Missing diagnosis');
      score -= 20;
    }
    if (!result.plan.includes('ibuprofen')) {
      issues.push('Missing medication');
      score -= 20;
    }

    return { score: score / 100, issues };
  }

  /**
   * Optimize prompts based on feedback
   */
  optimizePrompt(feedback: { goodExamples: string[]; badExamples: string[] }): void {
    // Store examples for future prompt improvement
    localStorage.setItem('ai_feedback', JSON.stringify(feedback));
  }
}
