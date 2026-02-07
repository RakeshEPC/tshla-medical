/**
 * Chart Update Extraction Service
 *
 * AI-powered extraction of clinical data from voice dictation.
 * Extracts medications, labs, vitals, conditions, allergies, and history
 * with completeness scoring and standardization codes.
 */

import { AzureOpenAI } from 'openai';
import { logger } from '../utils/logger';

// Types
export interface MedicationUpdate {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  indication?: string;
  status?: 'active' | 'discontinued' | 'prior';
  rxnorm_code?: string;
  completeness: number;
  missingFields: string[];
}

export interface LabUpdate {
  test_name: string;
  value: number | string;
  unit?: string;
  date?: string;
  date_inferred?: boolean;
  loinc_code?: string;
  completeness: number;
  missingFields: string[];
}

export interface VitalUpdate {
  type: string;
  value: number | string;
  systolic?: number;
  diastolic?: number;
  unit?: string;
  date?: string;
  completeness: number;
}

export interface ConditionUpdate {
  condition: string;
  icd10?: string;
  status?: 'active' | 'resolved' | 'chronic';
  date_diagnosed?: string;
}

export interface AllergyUpdate {
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
}

export interface FamilyHistoryUpdate {
  condition: string;
  relative: string;
  age_of_onset?: string;
}

export interface SocialHistoryUpdate {
  smoking?: {
    status: string;
    details?: string;
  };
  alcohol?: {
    status: string;
    details?: string;
  };
  occupation?: string;
  exercise?: string;
  diet?: string;
}

export interface ChartUpdateResult {
  medications: MedicationUpdate[];
  labs: LabUpdate[];
  vitals: VitalUpdate[];
  conditions: ConditionUpdate[];
  allergies: AllergyUpdate[];
  familyHistory: FamilyHistoryUpdate[];
  socialHistory: SocialHistoryUpdate;
  rawTranscript: string;
  processingTimeMs: number;
  overallCompleteness: number;
  itemsNeedingReview: number;
}

// AI Extraction Prompt
const CHART_UPDATE_EXTRACTION_PROMPT = `You are a medical data extraction specialist. Extract structured clinical data from this voice dictation of chart updates.

CRITICAL REQUIREMENTS:
1. Extract ONLY what is explicitly mentioned - do not infer or assume
2. Use standard medical terminology
3. Normalize medication names (generic preferred, correct spelling)
4. For labs without dates, mark date_inferred: true and use today's date
5. Calculate completeness score for each item

EXTRACT THE FOLLOWING:

1. MEDICATIONS
   - name (required): Generic name preferred, correct spelling
   - dosage: Amount + unit (e.g., "500mg", "10 units")
   - frequency: How often (normalize to: "once daily", "twice daily", "three times daily", "at bedtime", "as needed", or specific like "every 8 hours")
   - route: PO, IM, IV, SC, topical, inhaled, etc.
   - indication: Why prescribed (if mentioned)
   - status: "active" (default), "discontinued", or "prior"

2. LABS
   - test_name (required): Standard lab name (e.g., "A1C", "TSH", "LDL")
   - value (required): Numeric value or result
   - unit: Standard units (mg/dL, %, mIU/L, etc.)
   - date: When collected (parse relative dates like "last week", "yesterday", "3 days ago")
   - date_inferred: true if date was not explicitly stated

3. VITALS
   - type: "Blood Pressure", "Weight", "Heart Rate", "Temperature", "Oxygen Saturation", "BMI"
   - value: Numeric value (for BP, use systolic/diastolic fields)
   - systolic/diastolic: For blood pressure only
   - unit: Standard units
   - date: When measured

4. CONDITIONS/DIAGNOSES
   - condition: Diagnosis name (standardized)
   - status: "active", "resolved", "chronic"
   - date_diagnosed: If mentioned

5. ALLERGIES
   - allergen: Substance name
   - reaction: Type of reaction
   - severity: "mild", "moderate", "severe"

6. FAMILY HISTORY
   - condition: Medical condition
   - relative: "mother", "father", "sister", "brother", "maternal grandmother", etc.
   - age_of_onset: If mentioned

7. SOCIAL HISTORY
   - smoking: {status: "never"/"former"/"current", details: pack-years or quit date}
   - alcohol: {status: "none"/"social"/"moderate"/"heavy", details: drinks/week}
   - occupation: Current job
   - exercise: Activity level
   - diet: Dietary patterns

COMPLETENESS SCORING (0-100):
- Medication: 100 if name + dosage + frequency present; -33 for each missing
- Lab: 100 if name + value + date present; -33 for each missing
- Vital: 100 if type + value present

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown, no code blocks, no explanation).

EXAMPLE INPUT:
"Updating meds for this patient. Metformin 500mg twice daily for diabetes, lisinopril 10mg once daily for blood pressure. Also needs to stop the aspirin. Blood pressure today was 128/82. A1C came back at 7.2 from last week. LDL was 142. She also mentioned her mother had diabetes."

EXAMPLE OUTPUT:
{
  "medications": [
    {
      "name": "Metformin",
      "dosage": "500mg",
      "frequency": "twice daily",
      "indication": "diabetes",
      "status": "active",
      "completeness": 100,
      "missingFields": []
    },
    {
      "name": "Lisinopril",
      "dosage": "10mg",
      "frequency": "once daily",
      "indication": "blood pressure",
      "status": "active",
      "completeness": 100,
      "missingFields": []
    },
    {
      "name": "Aspirin",
      "status": "discontinued",
      "completeness": 33,
      "missingFields": ["dosage", "frequency"]
    }
  ],
  "labs": [
    {
      "test_name": "A1C",
      "value": 7.2,
      "unit": "%",
      "date": "2026-01-31",
      "date_inferred": false,
      "completeness": 100,
      "missingFields": []
    },
    {
      "test_name": "LDL",
      "value": 142,
      "unit": "mg/dL",
      "date": "2026-02-07",
      "date_inferred": true,
      "completeness": 67,
      "missingFields": ["date"]
    }
  ],
  "vitals": [
    {
      "type": "Blood Pressure",
      "systolic": 128,
      "diastolic": 82,
      "unit": "mmHg",
      "date": "2026-02-07",
      "completeness": 100
    }
  ],
  "conditions": [],
  "allergies": [],
  "familyHistory": [
    {
      "condition": "Diabetes",
      "relative": "mother"
    }
  ],
  "socialHistory": {}
}

NOW PROCESS THIS TRANSCRIPT:
`;

class ChartUpdateExtractionService {
  private client: AzureOpenAI | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';

    if (!apiKey || !endpoint) {
      logger.warn('ChartUpdateExtraction', 'Azure OpenAI credentials not configured');
      return;
    }

    this.client = new AzureOpenAI({
      apiKey,
      endpoint,
      apiVersion,
      deployment,
    });

    logger.info('ChartUpdateExtraction', 'Azure OpenAI client initialized');
  }

  /**
   * Extract structured clinical data from voice transcript
   */
  async extractFromTranscript(transcript: string, currentDate?: Date): Promise<ChartUpdateResult> {
    const startTime = Date.now();
    const today = currentDate || new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (!transcript || transcript.trim().length === 0) {
      return this.createEmptyResult(transcript, 0);
    }

    if (!this.client) {
      logger.error('ChartUpdateExtraction', 'Azure OpenAI client not initialized');
      throw new Error('AI service not configured');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a medical data extraction expert. Today's date is ${todayStr}. Always output valid JSON only.`
          },
          {
            role: 'user',
            content: CHART_UPDATE_EXTRACTION_PROMPT + transcript
          }
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const extracted = JSON.parse(content);
      const processingTimeMs = Date.now() - startTime;

      // Calculate overall completeness and items needing review
      const result = this.normalizeResult(extracted, transcript, processingTimeMs);

      logger.info('ChartUpdateExtraction', 'Extraction complete', {
        medications: result.medications.length,
        labs: result.labs.length,
        vitals: result.vitals.length,
        overallCompleteness: result.overallCompleteness,
        processingTimeMs
      });

      return result;

    } catch (error: any) {
      logger.error('ChartUpdateExtraction', 'Extraction failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalize and validate the extracted result
   */
  private normalizeResult(
    extracted: any,
    transcript: string,
    processingTimeMs: number
  ): ChartUpdateResult {
    const medications = this.normalizeMedications(extracted.medications || []);
    const labs = this.normalizeLabs(extracted.labs || []);
    const vitals = this.normalizeVitals(extracted.vitals || []);
    const conditions = extracted.conditions || [];
    const allergies = extracted.allergies || [];
    const familyHistory = extracted.familyHistory || [];
    const socialHistory = extracted.socialHistory || {};

    // Calculate overall completeness
    const allItems = [...medications, ...labs, ...vitals];
    const totalCompleteness = allItems.reduce((sum, item) => sum + (item.completeness || 0), 0);
    const overallCompleteness = allItems.length > 0
      ? Math.round(totalCompleteness / allItems.length)
      : 100;

    // Count items needing review (completeness < 100)
    const itemsNeedingReview = allItems.filter(item => item.completeness < 100).length;

    return {
      medications,
      labs,
      vitals,
      conditions,
      allergies,
      familyHistory,
      socialHistory,
      rawTranscript: transcript,
      processingTimeMs,
      overallCompleteness,
      itemsNeedingReview
    };
  }

  /**
   * Normalize medications and ensure completeness scores
   */
  private normalizeMedications(meds: any[]): MedicationUpdate[] {
    return meds.map(med => {
      const missingFields: string[] = [];
      if (!med.dosage) missingFields.push('dosage');
      if (!med.frequency) missingFields.push('frequency');

      // Recalculate completeness
      const requiredFields = 3; // name, dosage, frequency
      const presentFields = requiredFields - missingFields.length;
      const completeness = Math.round((presentFields / requiredFields) * 100);

      return {
        name: this.normalizeMedicationName(med.name || ''),
        dosage: med.dosage,
        frequency: this.normalizeFrequency(med.frequency),
        route: med.route,
        indication: med.indication,
        status: med.status || 'active',
        rxnorm_code: med.rxnorm_code,
        completeness,
        missingFields
      };
    });
  }

  /**
   * Normalize labs and ensure completeness scores
   */
  private normalizeLabs(labs: any[]): LabUpdate[] {
    return labs.map(lab => {
      const missingFields: string[] = [];
      if (!lab.date || lab.date_inferred) missingFields.push('date');
      if (!lab.unit) missingFields.push('unit');

      // Recalculate completeness
      const requiredFields = 3; // name, value, date
      const hasDate = lab.date && !lab.date_inferred;
      const presentFields = 2 + (hasDate ? 1 : 0); // name and value are required
      const completeness = Math.round((presentFields / requiredFields) * 100);

      return {
        test_name: this.normalizeLabName(lab.test_name || ''),
        value: lab.value,
        unit: lab.unit,
        date: lab.date,
        date_inferred: lab.date_inferred,
        loinc_code: lab.loinc_code,
        completeness,
        missingFields
      };
    });
  }

  /**
   * Normalize vitals
   */
  private normalizeVitals(vitals: any[]): VitalUpdate[] {
    return vitals.map(vital => ({
      type: vital.type,
      value: vital.value,
      systolic: vital.systolic,
      diastolic: vital.diastolic,
      unit: vital.unit,
      date: vital.date,
      completeness: vital.completeness || 100
    }));
  }

  /**
   * Normalize medication name (capitalize properly)
   */
  private normalizeMedicationName(name: string): string {
    if (!name) return '';

    // Common medication name corrections
    const corrections: Record<string, string> = {
      'metforman': 'Metformin',
      'lisinipril': 'Lisinopril',
      'lisnapril': 'Lisinopril',
      'atorvistatin': 'Atorvastatin',
      'amlodopine': 'Amlodipine',
      'ozempik': 'Ozempic',
      'ozempick': 'Ozempic',
      'trulicity': 'Trulicity',
      'jardiance': 'Jardiance',
      'farxiga': 'Farxiga',
      'victoza': 'Victoza',
      'lantis': 'Lantus',
      'humilin': 'Humulin',
      'novolog': 'NovoLog',
      'humalog': 'Humalog'
    };

    const normalized = name.toLowerCase().trim();
    if (corrections[normalized]) {
      return corrections[normalized];
    }

    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  /**
   * Normalize frequency to standard terms
   */
  private normalizeFrequency(freq: string | undefined): string | undefined {
    if (!freq) return undefined;

    const normalized = freq.toLowerCase().trim();
    const mappings: Record<string, string> = {
      'qd': 'once daily',
      'od': 'once daily',
      'daily': 'once daily',
      'qam': 'once daily in morning',
      'qpm': 'once daily at night',
      'bid': 'twice daily',
      'tid': 'three times daily',
      'qid': 'four times daily',
      'qhs': 'at bedtime',
      'prn': 'as needed',
      'q8h': 'every 8 hours',
      'q12h': 'every 12 hours',
      'q6h': 'every 6 hours',
      'weekly': 'once weekly'
    };

    return mappings[normalized] || freq;
  }

  /**
   * Normalize lab name to standard form
   */
  private normalizeLabName(name: string): string {
    if (!name) return '';

    const mappings: Record<string, string> = {
      'hemoglobin a1c': 'A1C',
      'hba1c': 'A1C',
      'glycated hemoglobin': 'A1C',
      'ldl cholesterol': 'LDL',
      'ldl-c': 'LDL',
      'hdl cholesterol': 'HDL',
      'hdl-c': 'HDL',
      'thyroid stimulating hormone': 'TSH',
      'free t4': 'Free T4',
      'ft4': 'Free T4',
      'serum creatinine': 'Creatinine',
      'blood urea nitrogen': 'BUN',
      'estimated gfr': 'eGFR',
      'glomerular filtration rate': 'eGFR'
    };

    const normalized = name.toLowerCase().trim();
    return mappings[normalized] || name;
  }

  /**
   * Create empty result
   */
  private createEmptyResult(transcript: string, processingTimeMs: number): ChartUpdateResult {
    return {
      medications: [],
      labs: [],
      vitals: [],
      conditions: [],
      allergies: [],
      familyHistory: [],
      socialHistory: {},
      rawTranscript: transcript,
      processingTimeMs,
      overallCompleteness: 100,
      itemsNeedingReview: 0
    };
  }
}

// Export singleton instance
export const chartUpdateExtractionService = new ChartUpdateExtractionService();

export default chartUpdateExtractionService;
