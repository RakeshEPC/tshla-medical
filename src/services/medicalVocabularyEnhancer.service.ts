/**
 * Medical Vocabulary Enhancer
 * Post-processes transcripts to fix common medical term errors
 * This is what likely made your quality perfect before
 */

export class MedicalVocabularyEnhancerService {
  private medicalReplacements = new Map<RegExp, string>([
    // Medication corrections (most common errors)
    [/met formin/gi, 'metformin'],
    [/lice in a pril/gi, 'lisinopril'],
    [/a tor va statin/gi, 'atorvastatin'],
    [/met o pro lol/gi, 'metoprolol'],
    [/am lo di pine/gi, 'amlodipine'],
    [/oh meh pra zole/gi, 'omeprazole'],
    [/gaba pentin/gi, 'gabapentin'],
    [/hydro chloro thia zide/gi, 'hydrochlorothiazide'],
    [/los ar tan/gi, 'losartan'],
    [/sim va statin/gi, 'simvastatin'],

    // Dosage formatting
    [/(\d+)\s*(milligrams?|mg\.?)/gi, '$1mg'],
    [/(\d+)\s*(micrograms?|mcg\.?)/gi, '$1mcg'],
    [/(\d+)\s*units?\b/gi, '$1 units'],
    [/(\d+)\s*milli\s*equivalents?/gi, '$1mEq'],

    // Frequency corrections
    [/\bonce\s+(?:a|per)\s+day\b/gi, 'daily'],
    [/\btwice\s+(?:a|per)\s+day\b/gi, 'BID'],
    [/\bthree\s+times\s+(?:a|per)\s+day\b/gi, 'TID'],
    [/\bfour\s+times\s+(?:a|per)\s+day\b/gi, 'QID'],
    [/\bas\s+needed\b/gi, 'PRN'],
    [/\bat\s+bedtime\b/gi, 'HS'],
    [/\bevery\s+(\d+)\s+hours?\b/gi, 'Q$1H'],

    // Vital signs formatting
    [/(\d+)\s+over\s+(\d+)/gi, '$1/$2'],
    [/(\d+)\s+slash\s+(\d+)/gi, '$1/$2'],
    [/(\d+\.?\d*)\s*degrees?\s*(?:fahrenheit)?/gi, '$1°F'],
    [/(\d+\.?\d*)\s*degrees?\s*celsius/gi, '$1°C'],
    [/(\d+)\s*(?:beats?\s*)?per\s*minute/gi, '$1 bpm'],
    [/(\d+)\s*percent/gi, '$1%'],

    // Medical conditions
    [/high\s+blood\s+pressure/gi, 'hypertension'],
    [/sugar\s+diabetes/gi, 'diabetes mellitus'],
    [/type\s+two\s+diabetes/gi, 'type 2 diabetes'],
    [/a\s*fib\b/gi, 'atrial fibrillation'],
    [/c\s*o\s*p\s*d/gi, 'COPD'],
    [/c\s*h\s*f/gi, 'CHF'],
    [/m\s*i\b/gi, 'MI'],
    [/c\s*v\s*a/gi, 'CVA'],
    [/t\s*i\s*a/gi, 'TIA'],
    [/u\s*t\s*i/gi, 'UTI'],
    [/g\s*e\s*r\s*d/gi, 'GERD'],

    // Anatomy corrections
    [/cardio\s*vascular/gi, 'cardiovascular'],
    [/gastro\s*intestinal/gi, 'gastrointestinal'],
    [/genito\s*urinary/gi, 'genitourinary'],
    [/musculo\s*skeletal/gi, 'musculoskeletal'],

    // Physical exam phrases
    [/no\s+acute\s+distress/gi, 'no acute distress'],
    [/alert\s+and\s+oriented\s+times?\s+three/gi, 'alert and oriented x3'],
    [/clear\s+to\s+auscultation\s+bilaterally/gi, 'clear to auscultation bilaterally'],
    [/regular\s+rate\s+and\s+rhythm/gi, 'regular rate and rhythm'],
    [/no\s+murmurs\s+rubs\s+or\s+gallops/gi, 'no murmurs, rubs, or gallops'],
    [/soft\s+non-?tender\s+non-?distended/gi, 'soft, non-tender, non-distended'],
    [/no\s+clubbing\s+cyanosis\s+or\s+edema/gi, 'no clubbing, cyanosis, or edema'],

    // Lab values
    [/a\s+one\s+c/gi, 'A1C'],
    [/hemoglobin\s+a\s+one\s+c/gi, 'HbA1c'],
    [/b\s+u\s+n/gi, 'BUN'],
    [/c\s+b\s+c/gi, 'CBC'],
    [/c\s+m\s+p/gi, 'CMP'],
    [/t\s+s\s+h/gi, 'TSH'],
    [/p\s+t\s+slash\s+i\s+n\s+r/gi, 'PT/INR'],
    [/l\s+d\s+l/gi, 'LDL'],
    [/h\s+d\s+l/gi, 'HDL'],

    // Common medical abbreviations
    [/\bpo\b/gi, 'PO'],
    [/\bim\b/gi, 'IM'],
    [/\biv\b/gi, 'IV'],
    [/\bsubq\b/gi, 'SubQ'],
    [/\bbid\b/gi, 'BID'],
    [/\btid\b/gi, 'TID'],
    [/\bqid\b/gi, 'QID'],
    [/\bprn\b/gi, 'PRN'],
    [/\bhs\b/gi, 'HS'],
    [/\bac\b/gi, 'AC'],
    [/\bpc\b/gi, 'PC'],

    // Numbers spelled out
    [/\bone\s+thousand/gi, '1000'],
    [/\bfive\s+hundred/gi, '500'],
    [/\btwo\s+fifty/gi, '250'],
    [/\bone\s+twenty\s+five/gi, '125'],
    [/\bseventy\s+five/gi, '75'],
    [/\bfifty/gi, '50'],
    [/\btwenty\s+five/gi, '25'],
    [/\btwenty/gi, '20'],
    [/\bfifteen/gi, '15'],
    [/\bten/gi, '10'],
    [/\bfive/gi, '5'],
  ]);

  /**
   * Apply all medical corrections to transcript
   * This is the SECRET SAUCE for quality
   */
  public enhanceTranscript(text: string): string {
    let enhanced = text;

    // Apply all replacements
    this.medicalReplacements.forEach((replacement, pattern) => {
      enhanced = enhanced.replace(pattern, replacement);
    });

    // Fix sentence structure
    enhanced = this.fixSentenceStructure(enhanced);

    // Fix medical context
    enhanced = this.fixMedicalContext(enhanced);

    return enhanced;
  }

  private fixSentenceStructure(text: string): string {
    return (
      text
        // Add periods after common endings if missing
        .replace(/(\d+mg)(\s+[A-Z])/g, '$1.$2')
        .replace(/(daily|BID|TID|QID|PRN)(\s+[A-Z])/g, '$1.$2')
        .replace(/(follow up in \d+ (?:days?|weeks?|months?))(\s+[A-Z])/g, '$1.$2')
        // Fix double spaces
        .replace(/\s+/g, ' ')
        // Fix period spacing
        .replace(/\.\s*\./g, '.')
        .replace(/([.!?])\s*([a-z])/g, (match, p1, p2) => `${p1} ${p2.toUpperCase()}`)
        // Ensure space after punctuation
        .replace(/([.!?,;:])([A-Za-z])/g, '$1 $2')
        .trim()
    );
  }

  private fixMedicalContext(text: string): string {
    // Fix common context issues
    return (
      text
        // Blood pressure context
        .replace(/blood pressure[:\s]+(\d+\/\d+)/gi, 'Blood pressure: $1')
        .replace(/BP[:\s]+(\d+\/\d+)/gi, 'BP: $1')
        // Heart rate context
        .replace(/heart rate[:\s]+(\d+)/gi, 'Heart rate: $1 bpm')
        .replace(/pulse[:\s]+(\d+)/gi, 'Pulse: $1 bpm')
        // Temperature context
        .replace(/temperature[:\s]+(\d+\.?\d*)/gi, 'Temperature: $1°F')
        .replace(/temp[:\s]+(\d+\.?\d*)/gi, 'Temp: $1°F')
        // O2 saturation context
        .replace(/(?:oxygen|O2|sat)[:\s]+(\d+)/gi, 'O2 sat: $1%')
        // Weight context
        .replace(/weight[:\s]+(\d+)/gi, 'Weight: $1 lbs')
        // Labs context
        .replace(/A1C[:\s]+(\d+\.?\d*)/gi, 'A1C: $1%')
        .replace(/glucose[:\s]+(\d+)/gi, 'Glucose: $1 mg/dL')
        .replace(/creatinine[:\s]+(\d+\.?\d*)/gi, 'Creatinine: $1 mg/dL')
    );
  }

  /**
   * Check if transcript contains medical terms
   * Useful for quality monitoring
   */
  public getMedicalTermDensity(text: string): number {
    const medicalTerms = [
      'patient',
      'diagnosis',
      'medication',
      'mg',
      'daily',
      'BID',
      'TID',
      'blood pressure',
      'heart rate',
      'temperature',
      'exam',
      'assessment',
      'plan',
      'follow up',
      'symptoms',
      'history',
      'physical',
      'vital',
    ];

    const words = text.toLowerCase().split(/\s+/);
    const medicalWordCount = words.filter(word =>
      medicalTerms.some(term => term.includes(word) || word.includes(term))
    ).length;

    return words.length > 0 ? medicalWordCount / words.length : 0;
  }
}

// Singleton instance
export const medicalVocabularyEnhancer = new MedicalVocabularyEnhancerService();
