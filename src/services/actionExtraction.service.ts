/**
 * Action Extraction Service
 * Parses doctor notes to extract medication and lab orders
 * Creates structured action items for staff to process
 */

import type {
  ActionItems,
  MedicationAction,
  LabAction,
  ExtractActionsRequest,
  ExtractActionsResponse
} from '../types/clinic.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

class ActionExtractionService {
  
  /**
   * Main extraction function - parses note text for actions
   */
  async extractActions(noteBody: string): Promise<ActionItems> {
    const meds = this.extractMedications(noteBody);
    const labs = this.extractLabs(noteBody);
    
    logDebug('actionExtraction', 'Debug message', {});
    
    return { meds, labs };
  }
  
  /**
   * Extract medication-related actions from text
   */
  private extractMedications(text: string): MedicationAction[] {
    const medications: MedicationAction[] = [];
    const normalizedText = text.toLowerCase();
    
    // Patterns for medication actions
    const patterns = {
      start: [
        /\bstart(?:ing|ed)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|units?|ml|g)\b/gi,
        /\binitiate(?:d)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|units?|ml|g)\b/gi,
        /\bbegin(?:ning)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|units?|ml|g)\b/gi
      ],
      stop: [
        /\bstop(?:ping|ped)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\b/gi,
        /\bdiscontinue(?:d)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\b/gi,
        /\bhold(?:ing)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\b/gi
      ],
      refill: [
        /\brefill(?:ing|ed)?\s+(?:all\s+)?(?:meds|medications|([a-z\-]+(?:\s+[a-z\-]+)?))\b/gi,
        /\brenew(?:ing|ed)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\b/gi,
        /\bcontinue\s+(?:all\s+)?(?:current\s+)?(?:meds|medications|([a-z\-]+(?:\s+[a-z\-]+)?))\b/gi
      ],
      increase: [
        /\bincrease(?:d)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(mg|mcg|units?|ml|g)\b/gi,
        /\braise(?:d)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(mg|mcg|units?|ml|g)\b/gi,
        /\bup\s+([a-z\-]+(?:\s+[a-z\-]+)?)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(mg|mcg|units?|ml|g)\b/gi
      ],
      decrease: [
        /\bdecrease(?:d)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(mg|mcg|units?|ml|g)\b/gi,
        /\blower(?:ed)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(mg|mcg|units?|ml|g)\b/gi,
        /\breduce(?:d)?\s+([a-z\-]+(?:\s+[a-z\-]+)?)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(mg|mcg|units?|ml|g)\b/gi
      ]
    };
    
    // Process each action type
    for (const [action, actionPatterns] of Object.entries(patterns)) {
      for (const pattern of actionPatterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          const drug = this.cleanDrugName(match[1]);
          
          // Skip if drug name is too generic
          if (drug && !this.isGenericTerm(drug)) {
            const medication: MedicationAction = {
              action: action as MedicationAction['action'],
              drug
            };
            
            // Add dose if captured
            if (match[2] && match[3]) {
              medication.dose = `${match[2]} ${match[3]}`;
            }
            
            // Try to extract frequency
            const frequency = this.extractFrequency(text, match.index);
            if (frequency) {
              medication.frequency = frequency;
            }
            
            medications.push(medication);
          }
        }
      }
    }
    
    // Also check for common medication mentions with context
    this.extractCommonMedications(text, medications);
    
    // Remove duplicates
    return this.deduplicateMedications(medications);
  }
  
  /**
   * Extract lab-related actions from text
   */
  private extractLabs(text: string): LabAction[] {
    const labs: LabAction[] = [];
    
    // Common lab test names and abbreviations
    const labTests = [
      'A1C', 'HbA1c', 'hemoglobin A1C',
      'CBC', 'complete blood count',
      'CMP', 'comprehensive metabolic panel',
      'BMP', 'basic metabolic panel',
      'TSH', 'thyroid stimulating hormone',
      'T3', 'T4', 'free T3', 'free T4',
      'lipid panel', 'cholesterol', 'LDL', 'HDL', 'triglycerides',
      'liver function', 'LFT', 'AST', 'ALT',
      'kidney function', 'creatinine', 'BUN', 'eGFR',
      'urinalysis', 'UA', 'urine',
      'glucose', 'fasting glucose', 'random glucose',
      'B12', 'vitamin B12', 'folate',
      'vitamin D', '25-OH vitamin D',
      'iron', 'ferritin', 'TIBC',
      'PSA', 'prostate specific antigen',
      'PT', 'INR', 'PTT',
      'blood culture', 'urine culture',
      'chest x-ray', 'CXR', 'EKG', 'ECG',
      'cortisol', 'ACTH',
      'testosterone', 'estrogen', 'progesterone',
      'microalbumin', 'urine microalbumin'
    ];
    
    // Patterns for lab orders
    const orderPatterns = [
      /\border(?:ing|ed)?\s+(?:labs?|blood\s+work|tests?)?\s*:?\s*([^.]+)/gi,
      /\bcheck(?:ing)?\s+(?:labs?|blood\s+work)?\s*:?\s*([^.]+)/gi,
      /\bget(?:ting)?\s+(?:labs?|blood\s+work)?\s*:?\s*([^.]+)/gi,
      /\bdraw(?:ing)?\s+(?:labs?|blood)?\s*:?\s*([^.]+)/gi,
      /\blabs?\s+(?:to\s+)?(?:order|check|draw)\s*:?\s*([^.]+)/gi,
      /\brepeat\s+(?:labs?|([^.]+))/gi
    ];
    
    // Process order patterns
    for (const pattern of orderPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const labText = match[1];
        if (labText) {
          const extractedTests = this.extractTestNames(labText, labTests);
          if (extractedTests.length > 0) {
            labs.push({
              action: 'order',
              tests: extractedTests
            });
          }
        }
      }
    }
    
    // Check for specific test mentions
    const testMentionPattern = new RegExp(
      `\\b(?:order|check|repeat|draw|get)\\s+(?:a\\s+)?(?:${labTests.join('|')})\\b`,
      'gi'
    );
    
    let match;
    while ((match = testMentionPattern.exec(text)) !== null) {
      const testName = this.extractSingleTest(match[0], labTests);
      if (testName) {
        // Check if this test is already in a lab order
        const exists = labs.some(lab => 
          lab.tests.some(t => t.toLowerCase() === testName.toLowerCase())
        );
        
        if (!exists) {
          labs.push({
            action: 'order',
            tests: [testName]
          });
        }
      }
    }
    
    // Merge similar lab orders
    return this.mergeLabs(labs);
  }
  
  /**
   * Extract common medications with specific patterns
   */
  private extractCommonMedications(text: string, medications: MedicationAction[]): void {
    // Common diabetes medications
    const diabetesMeds = [
      'metformin', 'glipizide', 'glyburide', 'glimepiride',
      'insulin', 'lantus', 'humalog', 'novolog', 'tresiba',
      'ozempic', 'semaglutide', 'trulicity', 'victoza',
      'jardiance', 'farxiga', 'invokana'
    ];
    
    // Common thyroid medications
    const thyroidMeds = [
      'levothyroxine', 'synthroid', 'armour thyroid',
      'liothyronine', 'cytomel'
    ];
    
    // Common cardiac medications
    const cardiacMeds = [
      'lisinopril', 'enalapril', 'losartan', 'valsartan',
      'metoprolol', 'atenolol', 'carvedilol',
      'amlodipine', 'diltiazem', 'verapamil',
      'furosemide', 'hydrochlorothiazide', 'spironolactone'
    ];
    
    const allCommonMeds = [...diabetesMeds, ...thyroidMeds, ...cardiacMeds];
    
    for (const med of allCommonMeds) {
      const medPattern = new RegExp(`\\b${med}\\b`, 'gi');
      if (medPattern.test(text)) {
        // Check context around the medication mention
        const contextPattern = new RegExp(
          `(start|stop|continue|refill|increase|decrease|hold|discontinue)\\s+(?:\\w+\\s+){0,3}${med}|` +
          `${med}\\s+(?:\\w+\\s+){0,3}(started|stopped|continued|refilled|increased|decreased)`,
          'gi'
        );
        
        const contextMatch = contextPattern.exec(text);
        if (contextMatch) {
          const action = this.determineAction(contextMatch[1] || contextMatch[2]);
          if (action && !this.medicationExists(medications, med)) {
            medications.push({
              action,
              drug: med
            });
          }
        }
      }
    }
  }
  
  /**
   * Extract test names from text
   */
  private extractTestNames(text: string, knownTests: string[]): string[] {
    const tests: string[] = [];
    const normalizedText = text.toUpperCase();
    
    for (const test of knownTests) {
      const testUpper = test.toUpperCase();
      if (normalizedText.includes(testUpper)) {
        tests.push(test);
      }
    }
    
    // Also check for comma or "and" separated lists
    const listPattern = /\b([A-Z0-9]+(?:\s+[A-Z0-9]+)?)\b/g;
    let match;
    while ((match = listPattern.exec(normalizedText)) !== null) {
      const potential = match[1];
      if (this.isLikelyLabTest(potential) && !tests.includes(potential)) {
        tests.push(potential);
      }
    }
    
    return [...new Set(tests)]; // Remove duplicates
  }
  
  /**
   * Extract a single test name from match
   */
  private extractSingleTest(matchText: string, knownTests: string[]): string | null {
    const upper = matchText.toUpperCase();
    for (const test of knownTests) {
      if (upper.includes(test.toUpperCase())) {
        return test;
      }
    }
    return null;
  }
  
  /**
   * Extract frequency information near a medication mention
   */
  private extractFrequency(text: string, nearIndex: number): string | null {
    const frequencyPatterns = [
      'QD', 'daily', 'once daily', 'once a day',
      'BID', 'twice daily', 'twice a day', 'two times daily',
      'TID', 'three times daily', 'three times a day',
      'QID', 'four times daily', 'four times a day',
      'QHS', 'at bedtime', 'bedtime',
      'QAM', 'in the morning', 'morning',
      'QPM', 'in the evening', 'evening',
      'PRN', 'as needed', 'when needed',
      'weekly', 'once weekly', 'every week',
      'monthly', 'once monthly', 'every month'
    ];
    
    // Look for frequency within 50 characters of the medication mention
    const contextStart = Math.max(0, nearIndex - 50);
    const contextEnd = Math.min(text.length, nearIndex + 100);
    const context = text.substring(contextStart, contextEnd).toLowerCase();
    
    for (const freq of frequencyPatterns) {
      if (context.includes(freq.toLowerCase())) {
        return freq;
      }
    }
    
    return null;
  }
  
  /**
   * Clean and normalize drug names
   */
  private cleanDrugName(name: string | undefined): string {
    if (!name) return '';
    
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-]/g, '')
      .toLowerCase();
  }
  
  /**
   * Check if term is too generic to be a drug name
   */
  private isGenericTerm(term: string): boolean {
    const genericTerms = ['medication', 'medications', 'meds', 'drug', 'drugs', 'medicine', 'all'];
    return genericTerms.includes(term.toLowerCase());
  }
  
  /**
   * Check if a medication already exists in the list
   */
  private medicationExists(medications: MedicationAction[], drug: string): boolean {
    return medications.some(m => 
      m.drug.toLowerCase() === drug.toLowerCase()
    );
  }
  
  /**
   * Determine action from verb
   */
  private determineAction(verb: string): MedicationAction['action'] | null {
    const v = verb.toLowerCase();
    if (v.includes('start') || v.includes('begin') || v.includes('initiate')) return 'start';
    if (v.includes('stop') || v.includes('discontinue') || v.includes('hold')) return 'stop';
    if (v.includes('continue') || v.includes('refill') || v.includes('renew')) return 'refill';
    if (v.includes('increase') || v.includes('raise')) return 'increase';
    if (v.includes('decrease') || v.includes('lower') || v.includes('reduce')) return 'decrease';
    return null;
  }
  
  /**
   * Check if string is likely a lab test
   */
  private isLikelyLabTest(text: string): boolean {
    // Common patterns for lab tests
    return /^[A-Z]{2,4}$/.test(text) || // Acronyms like CBC, CMP
           /^[A-Z]\d+$/.test(text) ||    // Like B12, T3
           /^\d+-[A-Z]+/.test(text);     // Like 25-OH
  }
  
  /**
   * Remove duplicate medications
   */
  private deduplicateMedications(medications: MedicationAction[]): MedicationAction[] {
    const seen = new Set<string>();
    return medications.filter(med => {
      const key = `${med.action}-${med.drug}-${med.dose || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  /**
   * Merge similar lab orders
   */
  private mergeLabs(labs: LabAction[]): LabAction[] {
    const merged: LabAction[] = [];
    
    for (const lab of labs) {
      const existing = merged.find(m => m.action === lab.action);
      if (existing) {
        // Merge tests, avoiding duplicates
        const allTests = [...existing.tests, ...lab.tests];
        existing.tests = [...new Set(allTests)];
      } else {
        merged.push({
          ...lab,
          tests: [...new Set(lab.tests)]
        });
      }
    }

    return merged;
  }
  
  /**
   * Process extraction request
   */
  async processExtractionRequest(request: ExtractActionsRequest): Promise<ExtractActionsResponse> {
    const actions = await this.extractActions(request.noteBody);
    return {
      meds: actions.meds,
      labs: actions.labs
    };
  }
}

// Export singleton instance
export const actionExtractionService = new ActionExtractionService();

// Also export for backward compatibility
export default actionExtractionService;