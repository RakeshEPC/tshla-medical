/**
 * AI Extraction Service
 * Extracts structured data from pre-visit call transcripts using Azure OpenAI
 * HIPAA Compliant: Uses Microsoft Azure OpenAI (covered by Microsoft BAA)
 * Created: January 2025
 */

import { AzureOpenAI } from 'openai';
import logger = require('../logger');

// Initialize Azure OpenAI client (HIPAA compliant)
const azureOpenAI = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY || '',
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
});

// =====================================================
// INTERFACES
// =====================================================

export interface MedicationData {
  name: string;
  dosage?: string;
  frequency?: string;
  side_effects?: string;
}

export interface RefillData {
  medication: string;
  supply_remaining?: string;
}

export interface SpecialistVisit {
  specialist: string;
  reason: string;
  date?: string;
}

export interface ChiefConcern {
  concern: string;
  urgency_1_10?: number;
  details?: string;
}

export interface PatientNeeds {
  prescriptions?: string[];
  referrals?: string[];
  forms?: string[];
  advice?: boolean;
}

export interface ExtractedData {
  // Structured data
  medications: MedicationData[];
  refills: RefillData[];
  labsCompleted: boolean;
  labsDetails?: string;
  labsNeeded: boolean;
  specialistVisits: SpecialistVisit[];
  concerns: ChiefConcern[];
  newSymptoms?: string;
  needs: PatientNeeds;
  questions: string[];
  appointmentConfirmed: boolean;

  // AI analysis
  aiSummary: string; // 2-3 sentence summary for provider
  clinicalNotes: string; // Formatted clinical notes
  riskFlags: string[]; // ['new-chest-pain', 'medication-confusion', etc]
  urgent: boolean; // Requires immediate callback
}

// =====================================================
// URGENT KEYWORD DETECTION
// =====================================================

const URGENT_KEYWORDS = [
  'chest pain',
  'severe pain',
  'can\'t breathe',
  'difficulty breathing',
  'suicidal',
  'suicide',
  'kill myself',
  'heavy bleeding',
  'severe bleeding',
  'unconscious',
  'seizure',
  'stroke',
  'heart attack',
  'emergency',
];

/**
 * Detect urgent keywords in transcript
 */
export function detectUrgentKeywords(transcript: string): string[] {
  const lowerTranscript = transcript.toLowerCase();
  const detected: string[] = [];

  for (const keyword of URGENT_KEYWORDS) {
    if (lowerTranscript.includes(keyword.toLowerCase())) {
      detected.push(keyword);
    }
  }

  return detected;
}

// =====================================================
// AI EXTRACTION
// =====================================================

/**
 * Extract structured data from pre-visit transcript using GPT-4
 */
export async function extractStructuredData(
  transcript: string
): Promise<ExtractedData> {
  logger.info('AIExtraction', 'Extracting structured data from transcript', {
    transcriptLength: transcript.length
  });

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript is empty');
  }

  // Quick urgent check before AI processing
  const urgentKeywords = detectUrgentKeywords(transcript);
  const hasUrgentKeywords = urgentKeywords.length > 0;

  const prompt = `You are a medical data extraction expert. Parse this pre-visit phone call transcript and extract the following structured information in JSON format.

IMPORTANT: Return ONLY valid JSON with no markdown formatting, no code blocks, no explanations.

**CRITICAL - CONSOLIDATE AND DEDUPLICATE:**
- If patient mentions same medication multiple times, list it ONCE with best available details
- If patient has similar concerns (e.g., "high blood sugar" and "diabetes not controlled"), consolidate into ONE concern
- Group related symptoms together (e.g., "nausea and vomiting" = ONE concern, not two)
- If patient repeats same question multiple ways, list it ONCE with clearest wording

Expected JSON structure:
{
  "medications": [{"name": "...", "dosage": "...", "frequency": "...", "side_effects": "..."}],
  "refills": [{"medication": "...", "supply_remaining": "..."}],
  "labsCompleted": true/false,
  "labsDetails": "string or null",
  "labsNeeded": true/false,
  "specialistVisits": [{"specialist": "...", "reason": "...", "date": "..."}],
  "concerns": [{"concern": "...", "urgency_1_10": 1-10, "details": "..."}],
  "newSymptoms": "string or null",
  "needs": {"prescriptions": ["..."], "referrals": ["..."], "forms": ["..."], "advice": true/false},
  "questions": ["...", "..."],
  "appointmentConfirmed": true/false,
  "aiSummary": "2-3 sentence summary for provider dashboard",
  "clinicalNotes": "Formatted clinical notes with sections",
  "riskFlags": ["new-chest-pain", "medication-confusion", etc],
  "urgent": true if urgent medical concern detected
}

RISK FLAGS to look for (list each flag type ONLY ONCE):
- "new-chest-pain" - patient mentions chest pain
- "difficulty-breathing" - breathing problems
- "severe-pain" - pain rated 8+ or described as severe
- "medication-confusion" - unclear about medications
- "new-symptoms" - concerning new symptoms
- "lab-abnormality" - mentioned abnormal lab results
- "specialist-urgency" - specialist said to see PCP urgently
- "mental-health-crisis" - suicidal thoughts, severe depression
- "fall-risk" - recent falls or dizziness
- "non-compliance" - not taking medications as prescribed

TRANSCRIPT:
${transcript}

Return only the JSON object with DEDUPLICATED, CONSOLIDATED information:`;

  try {
    // Azure OpenAI deployment name
    const deployment = process.env.AZURE_OPENAI_MODEL_STAGE6 || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

    const response = await azureOpenAI.chat.completions.create({
      model: deployment, // Azure uses deployment name
      messages: [
        {
          role: 'system',
          content:
            'You are a medical data extraction expert. Extract structured information from medical conversations and return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      response_format: { type: 'json_object' }, // Ensure JSON response
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from Azure OpenAI');
    }

    // Parse JSON response
    const extractedData = JSON.parse(content) as ExtractedData;

    // Override urgent flag if urgent keywords detected
    if (hasUrgentKeywords) {
      extractedData.urgent = true;
      extractedData.riskFlags = extractedData.riskFlags || [];
      urgentKeywords.forEach(keyword => {
        const flag = keyword.replace(/\s+/g, '-');
        if (!extractedData.riskFlags.includes(flag)) {
          extractedData.riskFlags.push(flag);
        }
      });
    }

    logger.info('AIExtraction', 'Extraction complete', {
      medicationsCount: extractedData.medications?.length || 0,
      concernsCount: extractedData.concerns?.length || 0,
      riskFlagsCount: extractedData.riskFlags?.length || 0,
      urgent: extractedData.urgent
    });

    return extractedData;
  } catch (error: any) {
    logger.error('AIExtraction', 'Failed to extract structured data', {
      error: logger.redactPHI(error.message)
    });

    // Return minimal data structure if AI fails
    return {
      medications: [],
      refills: [],
      labsCompleted: false,
      labsNeeded: false,
      specialistVisits: [],
      concerns: [],
      needs: {},
      questions: [],
      appointmentConfirmed: false,
      aiSummary: 'AI extraction failed. Review transcript manually.',
      clinicalNotes: `Error during AI extraction: ${error.message}\n\nRaw Transcript:\n${transcript}`,
      riskFlags: hasUrgentKeywords ? urgentKeywords : [],
      urgent: hasUrgentKeywords,
    };
  }
}

/**
 * Generate provider-friendly summary from extracted data
 */
export function formatProviderSummary(data: ExtractedData): string {
  const parts: string[] = [];

  // Medications
  if (data.medications && data.medications.length > 0) {
    parts.push(
      `Taking: ${data.medications.map(m => m.name).join(', ')}`
    );
  }

  // Refills
  if (data.refills && data.refills.length > 0) {
    parts.push(
      `Needs refills: ${data.refills.map(r => r.medication).join(', ')}`
    );
  }

  // Labs
  if (data.labsCompleted) {
    parts.push(`Labs completed${data.labsDetails ? `: ${data.labsDetails}` : ''}`);
  } else if (data.labsNeeded) {
    parts.push('Needs lab orders');
  }

  // Concerns
  if (data.concerns && data.concerns.length > 0) {
    const topConcern = data.concerns[0];
    parts.push(
      `Chief concern: ${topConcern.concern}${topConcern.urgency_1_10 ? ` (urgency: ${topConcern.urgency_1_10}/10)` : ''}`
    );
  }

  return parts.join(' | ');
}

/**
 * Generate clinical notes from extracted data
 */
export function formatClinicalNotes(data: ExtractedData): string {
  let notes = '=== PRE-VISIT SUMMARY ===\n\n';

  // Medications
  if (data.medications && data.medications.length > 0) {
    notes += 'CURRENT MEDICATIONS:\n';
    data.medications.forEach(med => {
      notes += `  • ${med.name}`;
      if (med.dosage) notes += ` ${med.dosage}`;
      if (med.frequency) notes += ` - ${med.frequency}`;
      notes += '\n';
      if (med.side_effects) {
        notes += `    Side effects: ${med.side_effects}\n`;
      }
    });
    notes += '\n';
  }

  // Refills
  if (data.refills && data.refills.length > 0) {
    notes += 'REFILLS NEEDED:\n';
    data.refills.forEach(refill => {
      notes += `  • ${refill.medication}`;
      if (refill.supply_remaining) {
        notes += ` (${refill.supply_remaining} remaining)`;
      }
      notes += '\n';
    });
    notes += '\n';
  }

  // Labs
  notes += 'LAB WORK:\n';
  if (data.labsCompleted) {
    notes += `  ✓ Completed${data.labsDetails ? `: ${data.labsDetails}` : ''}\n`;
  } else {
    notes += '  ✗ Not completed\n';
  }
  if (data.labsNeeded) {
    notes += '  Patient requests new lab orders\n';
  }
  notes += '\n';

  // Chief Concerns
  if (data.concerns && data.concerns.length > 0) {
    notes += 'CHIEF CONCERNS:\n';
    data.concerns.forEach((concern, i) => {
      notes += `  ${i + 1}. ${concern.concern}`;
      if (concern.urgency_1_10) {
        notes += ` (Urgency: ${concern.urgency_1_10}/10)`;
      }
      notes += '\n';
      if (concern.details) {
        notes += `     ${concern.details}\n`;
      }
    });
    notes += '\n';
  }

  // New Symptoms
  if (data.newSymptoms) {
    notes += 'NEW SYMPTOMS:\n';
    notes += `  ${data.newSymptoms}\n\n`;
  }

  // Questions
  if (data.questions && data.questions.length > 0) {
    notes += 'PATIENT QUESTIONS:\n';
    data.questions.forEach((q, i) => {
      notes += `  ${i + 1}. ${q}\n`;
    });
    notes += '\n';
  }

  // Risk Flags
  if (data.riskFlags && data.riskFlags.length > 0) {
    notes += '⚠️ RISK FLAGS:\n';
    data.riskFlags.forEach(flag => {
      notes += `  • ${flag}\n`;
    });
    notes += '\n';
  }

  // Appointment confirmation
  notes += `APPOINTMENT STATUS: ${data.appointmentConfirmed ? '✓ Confirmed' : '✗ Not confirmed'}\n`;

  return notes;
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  extractStructuredData,
  detectUrgentKeywords,
  formatProviderSummary,
  formatClinicalNotes,
};
