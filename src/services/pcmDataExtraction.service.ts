/**
 * PCM Data Extraction Service
 * Extracts baseline values and goals from clinical dictation for PCM enrollment
 *
 * Supports extraction of:
 * - A1C (current and target)
 * - Blood Pressure (current and target)
 * - Lipids: LDL, HDL, Triglycerides
 * - Kidney function: eGFR, Creatinine
 * - Weight (current and target)
 * - Medications (current regimen)
 */

import { logDebug, logError } from './logger.service';

export interface ExtractedMetric {
  metric: string;
  currentValue: string | number | null;
  targetValue: string | number | null;
  unit?: string;
  confidence: number; // 0-100
  rawText: string; // The sentence this was extracted from
}

export interface PCMExtractionResult {
  // Diabetes metrics
  a1c: ExtractedMetric | null;
  glucose: ExtractedMetric | null;

  // Blood pressure
  bloodPressure: ExtractedMetric | null;

  // Lipids
  ldl: ExtractedMetric | null;
  hdl: ExtractedMetric | null;
  triglycerides: ExtractedMetric | null;
  totalCholesterol: ExtractedMetric | null;

  // Kidney function
  egfr: ExtractedMetric | null;
  creatinine: ExtractedMetric | null;

  // Weight
  weight: ExtractedMetric | null;
  bmi: ExtractedMetric | null;

  // Medications (list of current medications mentioned)
  currentMedications: string[];

  // Raw text for debugging
  processedText: string;
}

class PCMDataExtractionService {
  /**
   * Main extraction method - analyze clinical note and extract PCM-relevant data
   */
  extractPCMData(clinicalNote: string): PCMExtractionResult {
    logDebug('PCMDataExtraction', 'Starting PCM data extraction', {
      textLength: clinicalNote.length
    });

    const result: PCMExtractionResult = {
      a1c: null,
      glucose: null,
      bloodPressure: null,
      ldl: null,
      hdl: null,
      triglycerides: null,
      totalCholesterol: null,
      egfr: null,
      creatinine: null,
      weight: null,
      bmi: null,
      currentMedications: [],
      processedText: clinicalNote
    };

    // Split into sentences for processing
    const sentences = this.splitIntoSentences(clinicalNote);

    // Extract each metric type
    sentences.forEach(sentence => {
      const lower = sentence.toLowerCase();

      // A1C extraction
      if (!result.a1c && this.mentionsA1C(lower)) {
        result.a1c = this.extractA1C(sentence);
      }

      // Glucose extraction
      if (!result.glucose && this.mentionsGlucose(lower)) {
        result.glucose = this.extractGlucose(sentence);
      }

      // Blood pressure extraction
      if (!result.bloodPressure && this.mentionsBloodPressure(lower)) {
        result.bloodPressure = this.extractBloodPressure(sentence);
      }

      // LDL extraction
      if (!result.ldl && this.mentionsLDL(lower)) {
        result.ldl = this.extractLDL(sentence);
      }

      // HDL extraction
      if (!result.hdl && this.mentionsHDL(lower)) {
        result.hdl = this.extractHDL(sentence);
      }

      // Triglycerides extraction
      if (!result.triglycerides && this.mentionsTriglycerides(lower)) {
        result.triglycerides = this.extractTriglycerides(sentence);
      }

      // Total cholesterol extraction
      if (!result.totalCholesterol && this.mentionsTotalCholesterol(lower)) {
        result.totalCholesterol = this.extractTotalCholesterol(sentence);
      }

      // eGFR extraction
      if (!result.egfr && this.mentionsEGFR(lower)) {
        result.egfr = this.extractEGFR(sentence);
      }

      // Creatinine extraction
      if (!result.creatinine && this.mentionsCreatinine(lower)) {
        result.creatinine = this.extractCreatinine(sentence);
      }

      // Weight extraction
      if (!result.weight && this.mentionsWeight(lower)) {
        result.weight = this.extractWeight(sentence);
      }

      // BMI extraction
      if (!result.bmi && this.mentionsBMI(lower)) {
        result.bmi = this.extractBMI(sentence);
      }
    });

    // Extract current medications
    result.currentMedications = this.extractCurrentMedications(clinicalNote);

    logDebug('PCMDataExtraction', 'Extraction complete', {
      metricsFound: Object.keys(result).filter(k => result[k as keyof PCMExtractionResult] !== null).length,
      medicationsFound: result.currentMedications.length
    });

    return result;
  }

  /**
   * Split text into sentences for analysis
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
  }

  // ========== A1C Extraction ==========

  private mentionsA1C(text: string): boolean {
    return /\ba1c\b|hemoglobin a1c|hba1c|glycated hemoglobin/i.test(text);
  }

  private extractA1C(sentence: string): ExtractedMetric | null {
    // Patterns:
    // "A1C is 8.5"
    // "A1C 8.5%"
    // "A1C of 8.5"
    // "A1C is 8.5 goal is 7.0"
    // "A1C 8.5%, target 7.0%"

    const patterns = [
      // Current and target together
      /a1c\s+(?:is\s+|of\s+)?(\d+\.?\d*)\s*%?\s+(?:and\s+)?(?:goal|target)\s+(?:is\s+|of\s+)?(\d+\.?\d*)\s*%?/i,
      /a1c\s+(\d+\.?\d*)\s*%?\s*,?\s*(?:goal|target)\s+(\d+\.?\d*)\s*%?/i,

      // Just current value
      /a1c\s+(?:is\s+|of\s+|=\s+)?(\d+\.?\d*)\s*%?/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 2;
        return {
          metric: 'A1C',
          currentValue: parseFloat(match[1]),
          targetValue: hasTarget ? parseFloat(match[2]) : null,
          unit: '%',
          confidence: hasTarget ? 95 : 85,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== Glucose Extraction ==========

  private mentionsGlucose(text: string): boolean {
    return /\b(blood sugar|glucose|bg|fasting glucose|random glucose)\b/i.test(text);
  }

  private extractGlucose(sentence: string): ExtractedMetric | null {
    // Patterns:
    // "Blood sugar is 180"
    // "Glucose 240 mg/dL"
    // "Fasting glucose 110, goal <100"

    const patterns = [
      // Current and target together
      /(blood sugar|glucose|bg)\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?\s*,?\s*(?:goal|target)\s+<?(\d+)/i,

      // Just current value
      /(blood sugar|glucose|bg)\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 3;
        return {
          metric: 'Glucose',
          currentValue: parseInt(match[2]),
          targetValue: hasTarget ? parseInt(match[3]) : null,
          unit: 'mg/dL',
          confidence: hasTarget ? 90 : 80,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== Blood Pressure Extraction ==========

  private mentionsBloodPressure(text: string): boolean {
    return /\b(blood pressure|bp|systolic|diastolic)\b/i.test(text);
  }

  private extractBloodPressure(sentence: string): ExtractedMetric | null {
    // Patterns:
    // "BP 140/90"
    // "Blood pressure is 140/90"
    // "BP of 140/90 and goal is 120/80"
    // "BP 140/90, goal 120/80"

    const patterns = [
      // Current and target together
      /(bp|blood pressure)\s+(?:is\s+|of\s+)?(\d{2,3})\/(\d{2,3})\s*(?:and\s+)?(?:goal|target)\s+(?:is\s+)?(\d{2,3})\/(\d{2,3})/i,
      /(bp|blood pressure)\s+(\d{2,3})\/(\d{2,3})\s*,\s*(?:goal|target)\s+(\d{2,3})\/(\d{2,3})/i,

      // Just current value
      /(bp|blood pressure)\s+(?:is\s+|of\s+)?(\d{2,3})\/(\d{2,3})/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 4;
        const currentBP = hasTarget ? `${match[2]}/${match[3]}` : `${match[2]}/${match[3]}`;
        const targetBP = hasTarget ? `${match[4]}/${match[5]}` : null;

        return {
          metric: 'Blood Pressure',
          currentValue: currentBP,
          targetValue: targetBP,
          unit: 'mmHg',
          confidence: hasTarget ? 95 : 85,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== LDL Extraction ==========

  private mentionsLDL(text: string): boolean {
    return /\bldl\b|ldl cholesterol|bad cholesterol/i.test(text);
  }

  private extractLDL(sentence: string): ExtractedMetric | null {
    // Patterns:
    // "LDL is 140"
    // "LDL 140 mg/dL"
    // "LDL is 140 goal is 70"
    // "LDL 140, target <100"

    const patterns = [
      // Current and target together
      /ldl\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?\s*(?:and\s+)?(?:goal|target)\s+<?(\d+)/i,
      /ldl\s+(\d+)\s*,?\s*(?:goal|target)\s+<?(\d+)/i,

      // Just current value
      /ldl\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 2;
        return {
          metric: 'LDL',
          currentValue: parseInt(match[1]),
          targetValue: hasTarget ? parseInt(match[2]) : null,
          unit: 'mg/dL',
          confidence: hasTarget ? 95 : 85,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== HDL Extraction ==========

  private mentionsHDL(text: string): boolean {
    return /\bhdl\b|hdl cholesterol|good cholesterol/i.test(text);
  }

  private extractHDL(sentence: string): ExtractedMetric | null {
    const patterns = [
      // Current and target together
      /hdl\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?\s*(?:and\s+)?(?:goal|target)\s+>?(\d+)/i,

      // Just current value
      /hdl\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 2;
        return {
          metric: 'HDL',
          currentValue: parseInt(match[1]),
          targetValue: hasTarget ? parseInt(match[2]) : null,
          unit: 'mg/dL',
          confidence: hasTarget ? 95 : 85,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== Triglycerides Extraction ==========

  private mentionsTriglycerides(text: string): boolean {
    return /\btriglycerides?\b|trig\b/i.test(text);
  }

  private extractTriglycerides(sentence: string): ExtractedMetric | null {
    const patterns = [
      // Current and target together
      /triglycerides?\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?\s*(?:and\s+)?(?:goal|target)\s+<?(\d+)/i,

      // Just current value
      /triglycerides?\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 2;
        return {
          metric: 'Triglycerides',
          currentValue: parseInt(match[1]),
          targetValue: hasTarget ? parseInt(match[2]) : null,
          unit: 'mg/dL',
          confidence: hasTarget ? 95 : 85,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== Total Cholesterol Extraction ==========

  private mentionsTotalCholesterol(text: string): boolean {
    return /\btotal cholesterol\b|cholesterol total/i.test(text);
  }

  private extractTotalCholesterol(sentence: string): ExtractedMetric | null {
    const patterns = [
      // Current and target together
      /total cholesterol\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?\s*(?:and\s+)?(?:goal|target)\s+<?(\d+)/i,

      // Just current value
      /total cholesterol\s+(?:is\s+|of\s+)?(\d+)\s*(?:mg\/dl)?/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 2;
        return {
          metric: 'Total Cholesterol',
          currentValue: parseInt(match[1]),
          targetValue: hasTarget ? parseInt(match[2]) : null,
          unit: 'mg/dL',
          confidence: hasTarget ? 90 : 80,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== eGFR Extraction ==========

  private mentionsEGFR(text: string): boolean {
    return /\begfr\b|estimated gfr|glomerular filtration/i.test(text);
  }

  private extractEGFR(sentence: string): ExtractedMetric | null {
    const patterns = [
      // Current and target together
      /egfr\s+(?:is\s+|of\s+)?(\d+)\s*(?:ml\/min)?\s*(?:and\s+)?(?:goal|target)\s+>?(\d+)/i,

      // Just current value
      /egfr\s+(?:is\s+|of\s+)?(\d+)\s*(?:ml\/min)?/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 2;
        return {
          metric: 'eGFR',
          currentValue: parseInt(match[1]),
          targetValue: hasTarget ? parseInt(match[2]) : null,
          unit: 'mL/min/1.73m²',
          confidence: hasTarget ? 90 : 80,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== Creatinine Extraction ==========

  private mentionsCreatinine(text: string): boolean {
    return /\bcreatinine\b|serum creatinine/i.test(text);
  }

  private extractCreatinine(sentence: string): ExtractedMetric | null {
    const patterns = [
      // Current and target together
      /creatinine\s+(?:is\s+|of\s+)?(\d+\.?\d*)\s*(?:mg\/dl)?\s*(?:and\s+)?(?:goal|target)\s+<?(\d+\.?\d*)/i,

      // Just current value
      /creatinine\s+(?:is\s+|of\s+)?(\d+\.?\d*)\s*(?:mg\/dl)?/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 2;
        return {
          metric: 'Creatinine',
          currentValue: parseFloat(match[1]),
          targetValue: hasTarget ? parseFloat(match[2]) : null,
          unit: 'mg/dL',
          confidence: hasTarget ? 90 : 80,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== Weight Extraction ==========

  private mentionsWeight(text: string): boolean {
    return /\bweight\b|weighs|body weight/i.test(text);
  }

  private extractWeight(sentence: string): ExtractedMetric | null {
    // Patterns:
    // "Weight is 220 lbs"
    // "Weighs 220 pounds"
    // "Weight 220, goal 190"
    // "Current weight 220 lbs, target 190 lbs"

    const patterns = [
      // Current and target together
      /weight\s+(?:is\s+|of\s+)?(\d+\.?\d*)\s*(?:lbs?|pounds?)?\s*(?:and\s+)?(?:goal|target)\s+(\d+\.?\d*)\s*(?:lbs?|pounds?)?/i,
      /weight\s+(\d+\.?\d*)\s*,?\s*(?:goal|target)\s+(\d+\.?\d*)/i,

      // Just current value
      /weight\s+(?:is\s+|of\s+)?(\d+\.?\d*)\s*(?:lbs?|pounds?)?/i,
      /weighs\s+(\d+\.?\d*)\s*(?:lbs?|pounds?)?/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 2;
        return {
          metric: 'Weight',
          currentValue: parseFloat(match[1]),
          targetValue: hasTarget ? parseFloat(match[2]) : null,
          unit: 'lbs',
          confidence: hasTarget ? 95 : 85,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== BMI Extraction ==========

  private mentionsBMI(text: string): boolean {
    return /\bbmi\b|body mass index/i.test(text);
  }

  private extractBMI(sentence: string): ExtractedMetric | null {
    const patterns = [
      // Current and target together
      /bmi\s+(?:is\s+|of\s+)?(\d+\.?\d*)\s*(?:and\s+)?(?:goal|target)\s+<?(\d+\.?\d*)/i,

      // Just current value
      /bmi\s+(?:is\s+|of\s+)?(\d+\.?\d*)/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const hasTarget = match.length > 2;
        return {
          metric: 'BMI',
          currentValue: parseFloat(match[1]),
          targetValue: hasTarget ? parseFloat(match[2]) : null,
          unit: 'kg/m²',
          confidence: hasTarget ? 90 : 80,
          rawText: sentence
        };
      }
    }

    return null;
  }

  // ========== Medication Extraction ==========

  /**
   * Extract current medications from clinical note
   * Looks for "continue", "on", "taking" keywords
   */
  private extractCurrentMedications(text: string): string[] {
    const medications: string[] = [];
    const lower = text.toLowerCase();

    // Common medication keywords to look for
    const medKeywords = [
      'metformin', 'insulin', 'lantus', 'novolog', 'humalog',
      'lisinopril', 'losartan', 'amlodipine', 'atenolol', 'carvedilol',
      'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin',
      'aspirin', 'warfarin', 'eliquis', 'xarelto',
      'levothyroxine', 'synthroid',
      'gabapentin', 'pregabalin',
      'omeprazole', 'pantoprazole',
      'furosemide', 'hydrochlorothiazide',
    ];

    // Look for patterns indicating current medication use
    const continuePatterns = [
      /continue\s+([a-z]+(?:\s+\d+\s*mg)?)/gi,
      /on\s+([a-z]+(?:\s+\d+\s*mg)?)/gi,
      /taking\s+([a-z]+(?:\s+\d+\s*mg)?)/gi,
      /current(?:ly)?\s+(?:on|taking)\s+([a-z]+(?:\s+\d+\s*mg)?)/gi,
    ];

    continuePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(lower)) !== null) {
        const medication = match[1].trim();

        // Check if it's a known medication
        const isKnownMed = medKeywords.some(keyword => medication.includes(keyword));

        if (isKnownMed && !medications.includes(medication)) {
          medications.push(medication);
        }
      }
    });

    return medications;
  }

  /**
   * Helper: Format extracted data for display
   */
  formatForDisplay(result: PCMExtractionResult): string {
    const lines: string[] = [];

    if (result.a1c) {
      lines.push(`A1C: ${result.a1c.currentValue}%${result.a1c.targetValue ? ` → Goal: ${result.a1c.targetValue}%` : ''}`);
    }

    if (result.bloodPressure) {
      lines.push(`BP: ${result.bloodPressure.currentValue}${result.bloodPressure.targetValue ? ` → Goal: ${result.bloodPressure.targetValue}` : ''}`);
    }

    if (result.ldl) {
      lines.push(`LDL: ${result.ldl.currentValue} mg/dL${result.ldl.targetValue ? ` → Goal: ${result.ldl.targetValue} mg/dL` : ''}`);
    }

    if (result.hdl) {
      lines.push(`HDL: ${result.hdl.currentValue} mg/dL${result.hdl.targetValue ? ` → Goal: ${result.hdl.targetValue} mg/dL` : ''}`);
    }

    if (result.triglycerides) {
      lines.push(`Triglycerides: ${result.triglycerides.currentValue} mg/dL${result.triglycerides.targetValue ? ` → Goal: ${result.triglycerides.targetValue} mg/dL` : ''}`);
    }

    if (result.weight) {
      lines.push(`Weight: ${result.weight.currentValue} lbs${result.weight.targetValue ? ` → Goal: ${result.weight.targetValue} lbs` : ''}`);
    }

    if (result.currentMedications.length > 0) {
      lines.push(`\nCurrent Medications:`);
      result.currentMedications.forEach(med => lines.push(`  - ${med}`));
    }

    return lines.join('\n');
  }
}

// Export singleton instance
export const pcmDataExtractionService = new PCMDataExtractionService();
