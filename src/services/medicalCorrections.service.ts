/**
 * Medical Corrections Service
 * Fixes common transcription errors for medical terms
 */

import { specialtyService } from './specialty.service';

export class MedicalCorrectionsService {
  // Common medication corrections
  private medicationCorrections: Record<string, string> = {
    lenses: 'Lantus',
    lances: 'Lantus',
    'land us': 'Lantus',
    landis: 'Lantus',
    'lance us': 'Lantus',
    novolog: 'NovoLog',
    'novo log': 'NovoLog',
    overlock: 'NovoLog',
    'nova log': 'NovoLog',
    metformin: 'Metformin',
    'met foreman': 'Metformin',
    glucophage: 'Glucophage',
    farxiga: 'Farxiga',
    'for ziga': 'Farxiga',
    'far sega': 'Farxiga',
    jardiance: 'Jardiance',
    ozempic: 'Ozempic',
    olympic: 'Ozempic',
    mounjaro: 'Mounjaro',
    'moon jarro': 'Mounjaro',
    trulicity: 'Trulicity',
    'truly city': 'Trulicity',
    glipizide: 'Glipizide',
    glyburide: 'Glyburide',
    lisinopril: 'Lisinopril',
    'listen april': 'Lisinopril',
    losartan: 'Losartan',
    'low sartan': 'Losartan',
    atorvastatin: 'Atorvastatin',
    'a tor of a statin': 'Atorvastatin',
    lipitor: 'Lipitor',
    crestor: 'Crestor',
    simvastatin: 'Simvastatin',
    zocor: 'Zocor',
    pravastatin: 'Pravastatin',
    rosuvastatin: 'Rosuvastatin',
    levothyroxine: 'Levothyroxine',
    'thirdly with our oxidant': 'levothyroxine',
    'thirdly oxidant': 'levothyroxine',
    'third oxidant': 'levothyroxine',
    synthroid: 'Synthroid',
    'sin thyroid': 'Synthroid',
    gabapentin: 'Gabapentin',
    'gaba pentin': 'Gabapentin',
    neurontin: 'Neurontin',
    pregabalin: 'Pregabalin',
    lyrica: 'Lyrica',
    duloxetine: 'Duloxetine',
    cymbalta: 'Cymbalta',
    'sim balta': 'Cymbalta',
    sertraline: 'Sertraline',
    zoloft: 'Zoloft',
    escitalopram: 'Escitalopram',
    lexapro: 'Lexapro',
    'lex a pro': 'Lexapro',
    fluoxetine: 'Fluoxetine',
    prozac: 'Prozac',
    'pro zack': 'Prozac',
    paroxetine: 'Paroxetine',
    paxil: 'Paxil',
    'pack sil': 'Paxil',
    venlafaxine: 'Venlafaxine',
    effexor: 'Effexor',
    aspirin: 'Aspirin',
    'ass prin': 'Aspirin',
    plavix: 'Plavix',
    'play vix': 'Plavix',
    clopidogrel: 'Clopidogrel',
    eliquis: 'Eliquis',
    'alley quis': 'Eliquis',
    xarelto: 'Xarelto',
    zarelto: 'Xarelto',
    warfarin: 'Warfarin',
    coumadin: 'Coumadin',
    omeprazole: 'Omeprazole',
    prilosec: 'Prilosec',
    pantoprazole: 'Pantoprazole',
    protonix: 'Protonix',
    albuterol: 'Albuterol',
    proair: 'ProAir',
    'pro air': 'ProAir',
    ventolin: 'Ventolin',
    advair: 'Advair',
    'ad vair': 'Advair',
    symbicort: 'Symbicort',
    'sim be court': 'Symbicort',
    spiriva: 'Spiriva',
    'spear riva': 'Spiriva',
    trelegy: 'Trelegy',
    'tree ledgy': 'Trelegy',
    breo: 'Breo',
    'bree oh': 'Breo',
  };

  // Common medical terms corrections
  private medicalTermCorrections: Record<string, string> = {
    a1c: 'A1C',
    'a 1 c': 'A1C',
    'a one c': 'A1C',
    'hemoglobin a1c': 'hemoglobin A1C',
    hemogonal: 'hemoglobin',
    ccnp: 'CMP',
    hba1c: 'HbA1c',
    cmp: 'CMP',
    'c m p': 'CMP',
    cbc: 'CBC',
    'c b c': 'CBC',
    ccbc: 'CBC',
    'c c b c': 'CBC',
    bmp: 'BMP',
    'b m p': 'BMP',
    tsh: 'TSH',
    't s h': 'TSH',
    ldl: 'LDL',
    'l d l': 'LDL',
    hdl: 'HDL',
    'h d l': 'HDL',
    ekg: 'EKG',
    'e k g': 'EKG',
    ecg: 'ECG',
    'e c g': 'ECG',
    mri: 'MRI',
    'm r i': 'MRI',
    ct: 'CT',
    'c t scan': 'CT scan',
    'cat scan': 'CAT scan',
    'blood pressure': 'blood pressure',
    'b p': 'BP',
    'heart rate': 'heart rate',
    'h r': 'HR',
    'respiratory rate': 'respiratory rate',
    'r r': 'RR',
    'oxygen saturation': 'oxygen saturation',
    'o2 sat': 'O2 sat',
    'oh two sat': 'O2 sat',
    'micro albumin': 'microalbumin',
    'micro albumen': 'microalbumin',
    creatinine: 'creatinine',
    'create a nine': 'creatinine',
    egfr: 'eGFR',
    'e g f r': 'eGFR',
    bun: 'BUN',
    'b u n': 'BUN',
    alt: 'ALT',
    'a l t': 'ALT',
    ast: 'AST',
    'a s t': 'AST',
    inr: 'INR',
    'i n r': 'INR',
    ptt: 'PTT',
    'p t t': 'PTT',
    pt: 'PT',
    'p t': 'PT',
  };

  // Common phrases corrections
  private phraseCorrections: Record<string, string> = {
    'pushing complains': 'patient complains',
    'patient complains': 'patient complains',
    'passion complains': 'patient complains',
    'patient complaints': 'patient complains',
    'sugars in the': 'sugars in the',
    'sugars and the': 'sugars in the',
    'get the heroin': 'get the hemoglobin',
    'get the hero in': 'get the hemoglobin',
    'see back in': 'see back in',
    'sea back in': 'see back in',
    'c back in': 'see back in',
    'follow up in': 'follow up in',
    'follow-up in': 'follow-up in',
    'units a day': 'units daily',
    'units per day': 'units daily',
    'with each meal': 'with each meal',
    'with meals': 'with meals',
    'at meal time': 'at mealtime',
    'blood sugars': 'blood sugars',
    'blood sugar is': 'blood sugars',
    'type 2 diabetes': 'Type 2 diabetes',
    'type two diabetes': 'Type 2 diabetes',
    'diabetes type 2': 'diabetes Type 2',
    'diabetes type two': 'diabetes Type 2',
    'emergency room': 'emergency room',
    'e r': 'ER',
    'emergency department': 'emergency department',
    'e d': 'ED',
    'primary care': 'primary care',
    'primary care doctor': 'primary care doctor',
    pcp: 'PCP',
    'p c p': 'PCP',
  };

  /**
   * Correct medical transcription errors
   */
  public correctTranscription(transcript: string): string {
    if (!transcript) return '';

    // Check if we should use specialty-specific corrections
    const currentDoctor = specialtyService.getCurrentDoctor();
    if (currentDoctor) {
      // Use specialty-specific corrections
      return specialtyService.applyCorrections(this.fixCommonPatterns(transcript));
    }

    // Use default corrections
    let corrected = transcript;

    // Apply medication corrections (case-insensitive)
    Object.entries(this.medicationCorrections).forEach(([error, correction]) => {
      const regex = new RegExp(`\\b${error}\\b`, 'gi');
      corrected = corrected.replace(regex, correction);
    });

    // Apply medical term corrections
    Object.entries(this.medicalTermCorrections).forEach(([error, correction]) => {
      const regex = new RegExp(`\\b${error}\\b`, 'gi');
      corrected = corrected.replace(regex, correction);
    });

    // Apply phrase corrections
    Object.entries(this.phraseCorrections).forEach(([error, correction]) => {
      const regex = new RegExp(error, 'gi');
      corrected = corrected.replace(regex, correction);
    });

    // Fix common patterns
    corrected = this.fixCommonPatterns(corrected);

    return corrected;
  }

  /**
   * Fix common speech recognition patterns
   */
  private fixCommonPatterns(text: string): string {
    // Fix "300s" pattern
    text = text.replace(/(\d+)s\b/g, '$1s');

    // Fix dosage patterns
    text = text.replace(/(\d+)\s*mg\b/gi, '$1mg');
    text = text.replace(/(\d+)\s*mcg\b/gi, '$1mcg');
    text = text.replace(/(\d+)\s*units?\b/gi, '$1 units');
    text = text.replace(/(\d+)\s*mL\b/gi, '$1mL');

    // Fix time patterns
    text = text.replace(/(\d+)\s+weeks?\b/gi, '$1 weeks');
    text = text.replace(/(\d+)\s+days?\b/gi, '$1 days');
    text = text.replace(/(\d+)\s+months?\b/gi, '$1 months');

    // Fix decimal numbers
    text = text.replace(/(\d+)\s+point\s+(\d+)/gi, '$1.$2');

    // Fix temperature format (from highQualityDictation)
    text = text.replace(/(\d+\.?\d*)\s+degrees?\s*(fahrenheit|f)?/gi, '$1°F');

    // Fix blood pressure format (from highQualityDictation)
    text = text.replace(/(\d+)\s+over\s+(\d+)/gi, '$1/$2');

    // Fix times/frequency format (from highQualityDictation)
    text = text.replace(/times\s+(\d+)/gi, 'x$1');

    // Fix common medication abbreviations (from highQualityDictation)
    text = text.replace(/\bp\.?o\.?\b/gi, 'PO');
    text = text.replace(/\bb\.?i\.?d\.?\b/gi, 'BID');
    text = text.replace(/\bt\.?i\.?d\.?\b/gi, 'TID');
    text = text.replace(/\bq\.?d\.?\b/gi, 'QD');
    text = text.replace(/\bp\.?r\.?n\.?\b/gi, 'PRN');
    text = text.replace(/\bq\.?h\.?\b/gi, 'QH');
    text = text.replace(/\bq\.?i\.?d\.?\b/gi, 'QID');

    // Fix lab value patterns
    text = text.replace(/A1C\s+(?:is|was)?\s*(\d+(?:\.\d+)?)/gi, 'A1C $1');
    text = text.replace(/blood sugar\s+(\d+)/gi, 'blood sugar $1');
    text = text.replace(/glucose\s+(\d+)/gi, 'glucose $1');

    // Remove duplicate spaces
    text = text.replace(/\s+/g, ' ');

    // Capitalize sentences
    text = text.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());

    return text.trim();
  }

  /**
   * Get suggested corrections for a word
   */
  public getSuggestions(word: string): string[] {
    const suggestions: string[] = [];
    const lowerWord = word.toLowerCase();

    // Check medications
    Object.entries(this.medicationCorrections).forEach(([error, correction]) => {
      if (error.includes(lowerWord) || lowerWord.includes(error)) {
        suggestions.push(correction);
      }
    });

    // Check medical terms
    Object.entries(this.medicalTermCorrections).forEach(([error, correction]) => {
      if (error.includes(lowerWord) || lowerWord.includes(error)) {
        suggestions.push(correction);
      }
    });

    return [...new Set(suggestions)]; // Remove duplicates
  }
}

export const medicalCorrections = new MedicalCorrectionsService();
