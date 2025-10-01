import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';
// Enhanced speech recognition with medical vocabulary support
// This module provides better accuracy for medical dictation

export interface EnhancedRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  language?: string;
  medicalMode?: boolean;
}

// Medical vocabulary for better recognition
export const MEDICAL_VOCABULARY = {
  medications: [
    'ozempic',
    'semaglutide',
    'wegovy',
    'mounjaro',
    'tirzepatide',
    'saxenda',
    'liraglutide',
    'trulicity',
    'dulaglutide',
    'humira',
    'adalimumab',
    'enbrel',
    'etanercept',
    'remicade',
    'infliximab',
    'stelara',
    'ustekinumab',
    'cosentyx',
    'secukinumab',
    'dupixent',
    'dupilumab',
    'xeljanz',
    'tofacitinib',
    'otezla',
    'apremilast',
    'taltz',
    'ixekizumab',
    'skyrizi',
    'risankizumab',
    'farxiga',
    'dapagliflozin',
    'jardiance',
    'empagliflozin',
    'lantus',
    'insulin glargine',
    'toujeo',
    'dexcom',
    'libre',
    'freestyle libre',
    'prolia',
    'denosumab',
    'forteo',
    'teriparatide',
    'tymlos',
    'abaloparatide',
    'lispro',
    'insulin lispro',
    'humalog',
    'metformin',
  ],

  medicalTerms: [
    'hemoglobin A1C',
    'A1C',
    'glycated hemoglobin',
    'HbA1c',
    'body mass index',
    'BMI',
    'kilograms',
    'pounds',
    'milliliters',
    'milligrams',
    'micrograms',
    'units',
    'subcutaneous',
    'intramuscular',
    'intravenous',
    'oral',
    'once daily',
    'twice daily',
    'three times daily',
    'four times daily',
    'QD',
    'BID',
    'TID',
    'QID',
    'PRN',
    'as needed',
    'diabetes mellitus',
    'type 1 diabetes',
    'type 2 diabetes',
    'hypertension',
    'hyperlipidemia',
    'dyslipidemia',
    'cardiovascular disease',
    'CVD',
    'CHF',
    'congestive heart failure',
    'chronic kidney disease',
    'CKD',
    'end stage renal disease',
    'ESRD',
    'glomerular filtration rate',
    'GFR',
    'eGFR',
    'creatinine',
    'blood pressure',
    'systolic',
    'diastolic',
    'mmHg',
    'cholesterol',
    'LDL',
    'HDL',
    'triglycerides',
    'osteoporosis',
    'osteopenia',
    'bone density',
    'T-score',
    'Z-score',
    'fracture',
    'vertebral',
    'hip fracture',
    'compression fracture',
    'psoriasis',
    'psoriatic arthritis',
    'rheumatoid arthritis',
    'inflammatory bowel disease',
    'IBD',
    "Crohn's disease",
    'ulcerative colitis',
    'atopic dermatitis',
    'eczema',
    'asthma',
    'COPD',
    'anaphylaxis',
    'allergic reaction',
    'hypersensitivity',
  ],

  labValues: [
    'normal range',
    'elevated',
    'decreased',
    'within normal limits',
    'point',
    'decimal',
    'percent',
    'percentage',
    'less than',
    'greater than',
    'equal to',
    'millimoles per liter',
    'milligrams per deciliter',
    'international units',
    'nanograms',
    'picograms',
  ],
};

// Create enhanced speech recognition instance
export function createEnhancedRecognition(options: EnhancedRecognitionOptions = {}) {
  if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window)) {
    logWarn('App', 'Warning message', {});
    return null;
  }

  const SpeechRecognition = (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  // Set basic options
  recognition.continuous = options.continuous ?? true;
  recognition.interimResults = options.interimResults ?? true;
  recognition.maxAlternatives = options.maxAlternatives ?? 5;
  recognition.lang = options.language ?? 'en-US';

  // Add medical grammar if supported
  if (options.medicalMode && (window as any).webkitSpeechGrammarList) {
    try {
      const SpeechGrammarList = (window as any).webkitSpeechGrammarList;
      const grammarList = new SpeechGrammarList();

      // Combine all medical terms
      const allTerms = [
        ...MEDICAL_VOCABULARY.medications,
        ...MEDICAL_VOCABULARY.medicalTerms,
        ...MEDICAL_VOCABULARY.labValues,
      ];

      // Create JSGF grammar
      const grammar =
        '#JSGF V1.0; grammar medical; public <medical> = ' +
        allTerms.map(term => term.replace(/[^a-zA-Z0-9\s]/g, '')).join(' | ') +
        ' ;';

      grammarList.addFromString(grammar, 1);
      recognition.grammars = grammarList;
    } catch (err) {
      logWarn('App', 'Warning message', {});
    }
  }

  return recognition;
}

// Post-process transcript to fix common medical term errors
export function correctMedicalTerms(transcript: string): string {
  let corrected = transcript;

  // Common misrecognitions and their corrections
  const corrections: { [key: string]: string } = {
    olympic: 'Ozempic',
    olympics: 'Ozempic',
    ozembic: 'Ozempic',
    'we go v': 'Wegovy',
    'moon jaro': 'Mounjaro',
    'moon jar o': 'Mounjaro',
    'sax and a': 'Saxenda',
    'truly city': 'Trulicity',
    'hugh mira': 'Humira',
    'hugh mirror': 'Humira',
    'and brel': 'Enbrel',
    'n brel': 'Enbrel',
    'remedy cade': 'Remicade',
    'stella ra': 'Stelara',
    'stellar a': 'Stelara',
    'consent ix': 'Cosentyx',
    'consent icks': 'Cosentyx',
    'do pics sent': 'Dupixent',
    'duplex sent': 'Dupixent',
    'cell jans': 'Xeljanz',
    'sell jans': 'Xeljanz',
    'oh tesla': 'Otezla',
    'o tesla': 'Otezla',
    'tall ts': 'Taltz',
    'sky rizzy': 'Skyrizi',
    'sky risky': 'Skyrizi',
    'far sega': 'Farxiga',
    'far xiga': 'Farxiga',
    'jar dance': 'Jardiance',
    'jar dee ants': 'Jardiance',
    'land us': 'Lantus',
    'land tus': 'Lantus',
    'to geo': 'Toujeo',
    'two geo': 'Toujeo',
    'decks com': 'Dexcom',
    'lee bray': 'Libre',
    'lee bruh': 'Libre',
    'pro leah': 'Prolia',
    'pro liya': 'Prolia',
    'for teo': 'Forteo',
    'fort eo': 'Forteo',
    'tim loss': 'Tymlos',
    'time loss': 'Tymlos',
    'lease pro': 'lispro',
    'hugh ma log': 'Humalog',
    'hugh muh log': 'Humalog',
    'a one c': 'A1C',
    'a 1 c': 'A1C',
    'a one see': 'A1C',
    'hemoglobin a one c': 'hemoglobin A1C',
    'b m i': 'BMI',
    'bee em eye': 'BMI',
    'e g f r': 'eGFR',
    'e g f are': 'eGFR',
    'kidney function e g f r': 'kidney function (eGFR)',
    milligram: 'mg',
    milligrams: 'mg',
    microgram: 'mcg',
    micrograms: 'mcg',
  };

  // Apply corrections (case-insensitive)
  for (const [wrong, right] of Object.entries(corrections)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    corrected = corrected.replace(regex, right);
  }

  // Fix common number + unit patterns
  corrected = corrected.replace(/(\d+)\s+(milligrams?|mg)/gi, '$1 mg');
  corrected = corrected.replace(/(\d+)\s+(micrograms?|mcg)/gi, '$1 mcg');
  corrected = corrected.replace(/(\d+)\s+(units?)/gi, '$1 units');
  corrected = corrected.replace(/(\d+)\s+(milliliters?|ml)/gi, '$1 mL');

  // Fix A1C patterns
  corrected = corrected.replace(/a\s*1\s*c\s+(?:is\s+)?(\d+\.?\d*)/gi, 'A1C is $1');
  corrected = corrected.replace(/hemoglobin\s+a\s*1\s*c/gi, 'hemoglobin A1C');

  // Fix BMI patterns
  corrected = corrected.replace(/b\s*m\s*i\s+(?:is\s+)?(\d+\.?\d*)/gi, 'BMI is $1');
  corrected = corrected.replace(/body\s+mass\s+index\s+(?:is\s+)?(\d+\.?\d*)/gi, 'BMI is $1');

  return corrected;
}

// Alternative: Use OpenAI Whisper API for better accuracy
export async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append(
      'prompt',
      'Medical dictation with medications like Ozempic, Mounjaro, Wegovy. Lab values like A1C, BMI, eGFR.'
    );

    const response = await fetch('/api/speech/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Transcription failed');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    logError('App', 'Error message', {});
    throw error;
  }
}

// Export all the utilities
export default {
  createEnhancedRecognition,
  correctMedicalTerms,
  transcribeWithWhisper,
  MEDICAL_VOCABULARY,
};
