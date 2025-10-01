/**
 * Medical Vocabulary Enhancement Service
 * Improves transcription accuracy by correcting common medical term errors
 */

export class MedicalVocabularyService {
  // Common medical term corrections for speech recognition errors
  private readonly corrections: Map<RegExp, string> = new Map([
    // Medication corrections
    [/\bfenergan\b/gi, 'Phenergan'],
    [/\bphenergan\b/gi, 'Phenergan'],
    [/\bzofran\b/gi, 'Zofran'],
    [/\bfarxiga\b/gi, 'Farxiga'],
    [/\blantus\b/gi, 'Lantus'],
    [/\bnovolog\b/gi, 'Novolog'],
    [/\boverlock\b/gi, 'Novolog'],
    [/\bnovo\s*log\b/gi, 'Novolog'],
    [/\bmetformin\b/gi, 'Metformin'],
    [/\blisinopril\b/gi, 'Lisinopril'],
    [/\batorvastatin\b/gi, 'Atorvastatin'],
    [/\bsimvastatin\b/gi, 'Simvastatin'],
    [/\bgabapentin\b/gi, 'Gabapentin'],
    [/\bomeprazole\b/gi, 'Omeprazole'],
    [/\bamlodipine\b/gi, 'Amlodipine'],
    [/\bmetoprolol\b/gi, 'Metoprolol'],
    [/\blosartan\b/gi, 'Losartan'],
    [/\bhydrochlorothiazide\b/gi, 'Hydrochlorothiazide'],
    [/\bhctz\b/gi, 'HCTZ'],

    // Medical conditions
    [/\bdiabetes mellitus\b/gi, 'Diabetes Mellitus'],
    [/\bhypertension\b/gi, 'Hypertension'],
    [/\bhyperlipidemia\b/gi, 'Hyperlipidemia'],
    [/\bgerd\b/gi, 'GERD'],
    [/\bcopd\b/gi, 'COPD'],
    [/\bchf\b/gi, 'CHF'],
    [/\bcad\b/gi, 'CAD'],
    [/\bafib\b/gi, 'AFib'],
    [/\ba fib\b/gi, 'AFib'],
    [/\batrial fibrillation\b/gi, 'Atrial Fibrillation'],

    // Lab values and tests
    [/\ba1c\b/gi, 'A1C'],
    [/\bhemoglobin a1c\b/gi, 'Hemoglobin A1C'],
    [/\bcmp\b/gi, 'CMP'],
    [/\bcbc\b/gi, 'CBC'],
    [/\btsh\b/gi, 'TSH'],
    [/\bbmp\b/gi, 'BMP'],
    [/\bldl\b/gi, 'LDL'],
    [/\bhdl\b/gi, 'HDL'],
    [/\begfr\b/gi, 'eGFR'],
    [/\bbun\b/gi, 'BUN'],
    [/\bast\b/gi, 'AST'],
    [/\balt\b/gi, 'ALT'],

    // Units corrections
    [/\bmilligrams?\b/gi, 'mg'],
    [/\bunits?\s+(?=\d)/gi, 'units '],
    [/\b(\d+)\s*mgs?\b/gi, '$1 mg'],
    [/\b(\d+)\s*mls?\b/gi, '$1 mL'],

    // Common speech recognition errors for medical context
    [/\bemail\s+(?=insulin|meal)/gi, 'meal'],
    [/\bwith\s+email\b/gi, 'with meal'],
    [/\bat\s+email\b/gi, 'at meal'],
    [/\beach\s+email\b/gi, 'each meal'],
    [/\bsugar\s+3\s+picture\b/gi, 'sugar 300'],
    [/\bsugar\s+4\s+picture\b/gi, 'sugar 400'],
    [/\bthey're like in the (\d+) and (\d+)s?\b/gi, 'blood sugars $1-$2'],

    // Anatomical terms
    [/\babdomen\b/gi, 'abdomen'],
    [/\bthorax\b/gi, 'thorax'],
    [/\bextremities\b/gi, 'extremities'],
    [/\bbilateral\b/gi, 'bilateral'],
    [/\banterior\b/gi, 'anterior'],
    [/\bposterior\b/gi, 'posterior'],
    [/\blateral\b/gi, 'lateral'],
    [/\bmedial\b/gi, 'medial'],

    // Vital signs
    [/\bblood pressure\b/gi, 'blood pressure'],
    [/\bheart rate\b/gi, 'heart rate'],
    [/\brespiratory rate\b/gi, 'respiratory rate'],
    [/\btemperature\b/gi, 'temperature'],
    [/\boxygen saturation\b/gi, 'oxygen saturation'],
    [/\bO2 sat\b/gi, 'O2 sat'],

    // Common medical phrases
    [/\bpatient presents with\b/gi, 'patient presents with'],
    [/\bchief complaint\b/gi, 'chief complaint'],
    [/\bhistory of present illness\b/gi, 'history of present illness'],
    [/\breview of systems\b/gi, 'review of systems'],
    [/\bphysical exam\b/gi, 'physical exam'],
    [/\bno acute distress\b/gi, 'no acute distress'],
    [/\bwithin normal limits\b/gi, 'within normal limits'],
    [/\bfollow up\b/gi, 'follow-up'],
    [/\bas needed\b/gi, 'as needed'],
    [/\bprn\b/gi, 'PRN'],
    [/\btid\b/gi, 'TID'],
    [/\bbid\b/gi, 'BID'],
    [/\bqd\b/gi, 'QD'],
    [/\bqid\b/gi, 'QID'],
    [/\bpo\b/gi, 'PO'],
    [/\bim\b/gi, 'IM'],
    [/\biv\b/gi, 'IV'],
    [/\bsubq\b/gi, 'SubQ'],
  ]);

  /**
   * Enhance transcript with medical vocabulary corrections
   */
  public enhanceTranscript(transcript: string): string {
    if (!transcript) return '';

    let enhanced = transcript;

    // Apply all corrections
    this.corrections.forEach((replacement, pattern) => {
      enhanced = enhanced.replace(pattern, replacement);
    });

    // Fix common number patterns in medical context
    enhanced = this.fixMedicalNumbers(enhanced);

    // Fix dosage patterns
    enhanced = this.fixDosagePatterns(enhanced);

    // Clean up spacing around punctuation
    enhanced = this.cleanupSpacing(enhanced);

    return enhanced;
  }

  /**
   * Fix common number patterns in medical context
   */
  private fixMedicalNumbers(text: string): string {
    // Fix blood sugar readings that are transcribed as single digits
    text = text.replace(/\bsugar\s+(\d)\s*(?:\s|$|,|\.|;)/gi, (match, digit) => {
      const num = parseInt(digit);
      if (num <= 9) {
        return `sugar ${digit}00 `;
      }
      return match;
    });

    // Fix blood pressure readings
    text = text.replace(/\b(\d{2,3})\s+over\s+(\d{2,3})\b/gi, '$1/$2');

    // Fix "in the 200s/300s" patterns
    text = text.replace(/\bin\s+the\s+(\d+)s\b/gi, 'in the $1s');

    return text;
  }

  /**
   * Fix dosage patterns
   */
  private fixDosagePatterns(text: string): string {
    // Fix "X units with each meal"
    text = text.replace(
      /(\d+)\s*units?\s+(?:with\s+)?(?:each\s+)?(?:email|mill)\b/gi,
      '$1 units with each meal'
    );

    // Fix "increase to X units"
    text = text.replace(/increase\s+to\s+(\d+)\s*units?\b/gi, 'increase to $1 units');

    // Fix "X mg daily/twice daily"
    text = text.replace(/(\d+)\s*(?:mg|milligrams?)\s+daily\b/gi, '$1 mg daily');
    text = text.replace(/(\d+)\s*(?:mg|milligrams?)\s+twice\s+daily\b/gi, '$1 mg twice daily');

    return text;
  }

  /**
   * Clean up spacing around punctuation
   */
  private cleanupSpacing(text: string): string {
    // Remove extra spaces
    text = text.replace(/\s+/g, ' ');

    // Fix spacing around punctuation
    text = text.replace(/\s+([.,;!?])/g, '$1');
    text = text.replace(/([.,;!?])(?=[A-Z])/g, '$1 ');

    // Ensure sentences are properly spaced
    text = text.replace(/\.(?=[A-Z])/g, '. ');

    return text.trim();
  }

  /**
   * Get medical specialty from transcript content
   */
  public detectSpecialty(transcript: string): string {
    const text = transcript.toLowerCase();

    // Check for specialty-specific keywords
    if (
      text.includes('diabetes') ||
      text.includes('insulin') ||
      text.includes('a1c') ||
      text.includes('glucose')
    ) {
      return 'Endocrinology';
    }

    if (
      text.includes('chest pain') ||
      text.includes('cardiac') ||
      text.includes('heart') ||
      text.includes('ekg')
    ) {
      return 'Cardiology';
    }

    if (
      text.includes('depression') ||
      text.includes('anxiety') ||
      text.includes('psychiatric') ||
      text.includes('mental health')
    ) {
      return 'Psychiatry';
    }

    if (
      text.includes('joint') ||
      text.includes('arthritis') ||
      text.includes('fracture') ||
      text.includes('orthopedic')
    ) {
      return 'Orthopedics';
    }

    if (
      text.includes('headache') ||
      text.includes('seizure') ||
      text.includes('neurological') ||
      text.includes('nerve')
    ) {
      return 'Neurology';
    }

    if (
      text.includes('rash') ||
      text.includes('skin') ||
      text.includes('dermatitis') ||
      text.includes('lesion')
    ) {
      return 'Dermatology';
    }

    if (
      text.includes('pregnant') ||
      text.includes('prenatal') ||
      text.includes('obstetric') ||
      text.includes('gynecologic')
    ) {
      return 'OB/GYN';
    }

    if (
      text.includes('pediatric') ||
      text.includes('child') ||
      text.includes('infant') ||
      text.includes('vaccination')
    ) {
      return 'Pediatrics';
    }

    return 'Primary Care';
  }

  /**
   * Add medical context to improve recognition
   */
  public addMedicalContext(transcript: string, patientHistory?: any): string {
    let contextualTranscript = transcript;

    // If patient has known conditions, bias recognition toward related terms
    if (patientHistory?.diagnoses) {
      const diagnoses = patientHistory.diagnoses.toLowerCase();

      if (diagnoses.includes('diabetes')) {
        // Bias toward diabetes-related terms
        contextualTranscript = contextualTranscript
          .replace(/\bsugar\b/gi, 'blood sugar')
          .replace(/\binsulin\s+pump\b/gi, 'insulin pump')
          .replace(/\bcgm\b/gi, 'CGM');
      }

      if (diagnoses.includes('hypertension')) {
        // Bias toward hypertension-related terms
        contextualTranscript = contextualTranscript
          .replace(/\bpressure\b/gi, 'blood pressure')
          .replace(/\bace\b/gi, 'ACE');
      }
    }

    return contextualTranscript;
  }
}

// Singleton instance
export const medicalVocabularyService = new MedicalVocabularyService();
