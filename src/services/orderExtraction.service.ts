/**
 * Order Extraction Service
 * Parses medical orders from dictation text using keyword detection
 */

export interface ExtractedOrder {
  order_id?: string;
  type: 'medication' | 'lab' | 'imaging' | 'prior_auth' | 'referral' | 'other';
  text: string;
  action?: 'start' | 'stop' | 'continue' | 'increase' | 'decrease' | 'order' | 'check';
  details?: string;
  urgency?: 'routine' | 'urgent' | 'stat';
  confidence: number; // 0-1 confidence score
}

export interface OrderExtractionResult {
  medications: ExtractedOrder[];
  labs: ExtractedOrder[];
  imaging: ExtractedOrder[];
  priorAuths: ExtractedOrder[];
  referrals: ExtractedOrder[];
  other: ExtractedOrder[];
  rawOrders: string; // Combined text for Orders & Actions section
}

class OrderExtractionService {
  // Medication keywords
  private medicationKeywords = {
    start: ['start', 'begin', 'initiate', 'prescribe', 'give', 'add'],
    stop: ['stop', 'discontinue', 'dc', 'd/c', 'hold', 'cease'],
    continue: ['continue', 'keep', 'maintain', 'stay on'],
    increase: ['increase', 'up', 'raise', 'higher', 'more'],
    decrease: ['decrease', 'lower', 'reduce', 'less', 'down', 'taper'],
  };

  // Lab keywords - expanded with common tests
  private labKeywords = [
    // Action words
    'order', "let's get", "let's check", "let's order", 'draw', 'check', 'obtain', 'send',
    'labs', 'blood work', 'bloodwork', 'test', 'panel', 'screen', 'workup',

    // General panels
    'cbc', 'complete blood count', 'cmp', 'comprehensive metabolic', 'bmp', 'basic metabolic',
    'lft', 'liver function', 'rft', 'renal function', 'lipid panel', 'metabolic panel',

    // Specific tests
    'tsh', 'thyroid', 't3', 't4', 'free t4', 'thyroid stimulating',
    'a1c', 'hemoglobin a1c', 'hba1c', 'glycated hemoglobin',
    'glucose', 'fasting glucose', 'blood sugar', 'random glucose',
    'creatinine', 'bun', 'egfr', 'kidney function',
    'alt', 'ast', 'alkaline phosphatase', 'bilirubin', 'albumin',
    'lipid', 'cholesterol', 'ldl', 'hdl', 'triglycerides',
    'hemoglobin', 'hematocrit', 'platelets', 'wbc', 'white blood',
    'inr', 'pt', 'ptt', 'coagulation', 'clotting',
    'urinalysis', 'ua', 'urine', 'microalbumin', 'protein/creatinine',
    'vitamin d', '25-oh vitamin d', 'vitamin b12', 'folate', 'iron', 'ferritin',
    'cortisol', 'acth', 'testosterone', 'estrogen', 'progesterone',
    'psa', 'prostate', 'cea', 'tumor marker',
    'crp', 'c-reactive protein', 'esr', 'sed rate', 'inflammatory',
    'culture', 'sensitivity', 'blood culture', 'urine culture',
    'strep', 'covid', 'flu', 'rsv', 'rapid test',
    'electrolytes', 'sodium', 'potassium', 'chloride', 'co2', 'bicarbonate',
    'troponin', 'bnp', 'cardiac enzymes', 'cpk', 'ck-mb',
    'hcg', 'pregnancy test', 'beta hcg',
  ];

  // Lab value keywords (for detecting existing lab results, not orders)
  private labValueKeywords = [
    'sugars of',
    'tsh of',
    'a1c of',
    'ldl',
    'hdl',
    'cholesterol',
    'glucose of',
    'hemoglobin of',
    'creatinine of',
    'a1c ',
    'tsh is',
    'tsh ',
    'glucose ',
  ];

  // Demographic keywords (exclude from lab orders)
  private demographicKeywords = [
    'year old',
    'years old',
    'comes in with',
    'patient with',
    'history of',
    'diagnosed with',
    'hyperlipidemia',
    'hypertension',
    'diabetes',
    'type 2 diabetes',
    'type 1 diabetes',
  ];

  // Imaging keywords
  private imagingKeywords = [
    'x-ray',
    'xray',
    'ct',
    'mri',
    'ultrasound',
    'echo',
    'scan',
    'imaging',
    'radiograph',
    'mammogram',
    'dexa',
  ];

  // Prior auth keywords - expanded for better detection
  private priorAuthKeywords = [
    'prior auth',
    'prior authorization',
    'pre-auth',
    'preauth',
    'pre auth',
    'authorization needed',
    'needs authorization',
    'requires authorization',
    'approval needed',
    'needs approval',
    'requires approval',
    'pa needed',
    'pa required',
    'get pa',
    'obtain pa',
    'submit for authorization',
  ];

  // Referral keywords
  private referralKeywords = [
    'refer',
    'referral',
    'consult',
    'send to',
    'see',
    'appointment with',
    'schedule with',
  ];

  // Common medication names for better detection (expanded)
  private commonMedications = [
    // Diabetes medications
    'metformin', 'glucophage', 'insulin', 'glipizide', 'glyburide', 'januvia', 'janumet',
    'ozempic', 'semaglutide', 'trulicity', 'dulaglutide', 'victoza', 'liraglutide',
    'mounjaro', 'tirzepatide', 'rybelsus', 'wegovy',
    'jardiance', 'empagliflozin', 'farxiga', 'dapagliflozin', 'invokana', 'canagliflozin',
    'humalog', 'novolog', 'lantus', 'levemir', 'basaglar', 'tresiba', 'toujeo',
    'glimepiride', 'amaryl', 'tradjenta', 'onglyza', 'nesina',

    // Thyroid medications
    'levothyroxine', 'synthroid', 'levoxyl', 'tirosint', 'armour thyroid', 'cytomel', 'liothyronine',

    // Cardiovascular medications
    'lisinopril', 'enalapril', 'ramipril', 'losartan', 'valsartan', 'olmesartan', 'irbesartan',
    'metoprolol', 'atenolol', 'carvedilol', 'bisoprolol', 'propranolol',
    'amlodipine', 'nifedipine', 'diltiazem', 'verapamil',
    'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin',
    'zetia', 'ezetimibe',
    'lipitor', 'crestor', 'zocor',
    'aspirin', 'clopidogrel', 'plavix', 'warfarin', 'coumadin', 'eliquis', 'apixaban',
    'xarelto', 'rivaroxaban', 'pradaxa', 'dabigatran',
    'furosemide', 'lasix', 'hydrochlorothiazide', 'hctz', 'chlorthalidone', 'spironolactone',

    // Pain/Anti-inflammatory
    'gabapentin', 'lyrica', 'pregabalin', 'ibuprofen', 'naproxen', 'meloxicam', 'celecoxib',
    'tramadol', 'acetaminophen', 'tylenol', 'diclofenac',

    // Antibiotics (common)
    'amoxicillin', 'augmentin', 'azithromycin', 'zithromax', 'ciprofloxacin', 'cipro',
    'levofloxacin', 'levaquin', 'doxycycline', 'cephalexin', 'keflex', 'bactrim', 'sulfamethoxazole',

    // Respiratory
    'albuterol', 'proair', 'ventolin', 'advair', 'symbicort', 'spiriva', 'tiotropium',
    'montelukast', 'singulair', 'fluticasone', 'flonase',

    // GI medications
    'omeprazole', 'prilosec', 'pantoprazole', 'protonix', 'esomeprazole', 'nexium',
    'ranitidine', 'famotidine', 'pepcid', 'zofran', 'ondansetron', 'metoclopramide', 'reglan',

    // Mental health
    'sertraline', 'zoloft', 'escitalopram', 'lexapro', 'fluoxetine', 'prozac',
    'citalopram', 'celexa', 'paroxetine', 'paxil', 'venlafaxine', 'effexor',
    'duloxetine', 'cymbalta', 'bupropion', 'wellbutrin', 'trazodone',
    'alprazolam', 'xanax', 'lorazepam', 'ativan', 'clonazepam', 'klonopin',

    // Other common
    'prednisone', 'methylprednisolone', 'vitamin d', 'calcium', 'multivitamin',
    'potassium', 'magnesium', 'iron', 'folic acid', 'b12', 'cobalamin',
  ];

  /**
   * Extract orders from dictation text
   */
  extractOrders(text: string): OrderExtractionResult {
    const result: OrderExtractionResult = {
      medications: [],
      labs: [],
      imaging: [],
      priorAuths: [],
      referrals: [],
      other: [],
      rawOrders: '',
    };

    // Split text into sentences for better parsing
    const sentences = this.splitIntoSentences(text);
    const orderSentences: string[] = [];
    const processedSentences = new Set<string>(); // Track to prevent duplicates

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      let wasProcessed = false;

      // Check for medications FIRST (highest priority)
      const medicationOrders = this.extractMedicationOrders(sentence);
      if (medicationOrders.length > 0) {
        result.medications.push(...medicationOrders);
        orderSentences.push(sentence);
        processedSentences.add(sentence);
        wasProcessed = true;
      }

      // Check for labs - expand comma-separated lists
      if (!wasProcessed && this.containsLabOrder(lowerSentence)) {
        const labOrders = this.extractLabOrders(sentence); // Returns array now
        if (labOrders.length > 0) {
          result.labs.push(...labOrders);
          orderSentences.push(sentence);
          processedSentences.add(sentence);
          wasProcessed = true;
        }
      }

      // Check for imaging
      if (!wasProcessed && this.containsImagingOrder(lowerSentence)) {
        result.imaging.push({
          type: 'imaging',
          text: sentence,
          action: 'order',
          confidence: 0.8,
        });
        orderSentences.push(sentence);
        processedSentences.add(sentence);
        wasProcessed = true;
      }

      // Check for prior auth - try to extract medication name
      if (!wasProcessed && this.containsPriorAuth(lowerSentence)) {
        const priorAuthOrder = this.extractPriorAuthOrder(sentence, result.medications);
        result.priorAuths.push(priorAuthOrder);
        orderSentences.push(sentence);
        processedSentences.add(sentence);
        wasProcessed = true;
      }

      // Check for follow-up appointments (not referrals)
      if (!wasProcessed && this.isFollowUpAppointment(lowerSentence)) {
        result.referrals.push({
          type: 'referral',
          text: sentence,
          action: 'order',
          confidence: 0.7,
        });
        orderSentences.push(sentence);
        processedSentences.add(sentence);
        wasProcessed = true;
      }

      // Check for actual referrals (to specialists)
      if (!wasProcessed && this.containsReferral(lowerSentence)) {
        result.referrals.push({
          type: 'referral',
          text: sentence,
          action: 'order',
          confidence: 0.7,
        });
        orderSentences.push(sentence);
        processedSentences.add(sentence);
      }
    }

    // Don't use raw orders - this causes duplication in the formatted note
    // The orderSentences will be formatted properly by formatOrdersForTemplate() instead
    result.rawOrders = '';

    return result;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Enhanced sentence splitting for medical dictation
    // Split on punctuation first
    let sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // If we have only one long sentence (no punctuation), try to split on medical action keywords
    if (sentences.length === 1 && sentences[0].length > 100) {
      const actionKeywords = [
        'continue',
        'start',
        'begin',
        'initiate',
        'stop',
        'discontinue',
        'check',
        'order',
        'refer',
      ];
      let splitText = sentences[0];

      // Find positions of action keywords
      const splitPositions: number[] = [];
      actionKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        let match;
        while ((match = regex.exec(splitText)) !== null) {
          if (match.index > 20) {
            // Don't split too early
            splitPositions.push(match.index);
          }
        }
      });

      // Sort positions and split
      if (splitPositions.length > 0) {
        splitPositions.sort((a, b) => a - b);
        const splitSentences: string[] = [];
        let lastPos = 0;

        splitPositions.forEach(pos => {
          if (pos > lastPos + 10) {
            // Minimum sentence length
            splitSentences.push(splitText.substring(lastPos, pos).trim());
            lastPos = pos;
          }
        });

        // Add the remainder
        if (lastPos < splitText.length) {
          splitSentences.push(splitText.substring(lastPos).trim());
        }

        sentences = splitSentences.filter(s => s.length > 0);
      }
    }

    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Calculate confidence score for an extraction
   */
  private calculateConfidence(
    sentence: string,
    type: 'medication' | 'lab' | 'imaging' | 'prior_auth' | 'referral' | 'other',
    hasAction: boolean,
    hasSpecificTerm: boolean
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost for specific action words
    if (hasAction) {
      confidence += 0.2;
    }

    // Boost for known medication names or lab tests
    if (hasSpecificTerm) {
      confidence += 0.25;
    }

    // Boost for dosage information (medications)
    if (type === 'medication' && /\d+\s*(mg|mcg|units?|ml|g|tablets?|capsules?)/i.test(sentence)) {
      confidence += 0.15;
    }

    // Boost for frequency information (medications)
    if (type === 'medication' && /(daily|twice|bid|tid|qid|prn|every|once|morning|evening|bedtime)/i.test(sentence)) {
      confidence += 0.1;
    }

    // Penalty for vague language
    if (/(maybe|possibly|consider|might|could)/i.test(sentence)) {
      confidence -= 0.15;
    }

    // Penalty for questions
    if (/\?|should we|do we want/i.test(sentence)) {
      confidence -= 0.2;
    }

    // Cap between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract medication order from sentence
   */
  /**
   * Extract multiple medication orders from a single sentence if it contains multiple medications
   * Example: "Continue Lisinopril 20 mg a day Add amlodipine 5 mg a day" → TWO medication orders
   */
  private extractMedicationOrders(sentence: string): ExtractedOrder[] {
    // Check if sentence contains multiple medication actions
    const actionMatches = [];
    const actionPattern = /\b(start|begin|initiate|add|continue|stop|discontinue|hold|increase|decrease|change|switch|refill|renew)\b/gi;

    let match;
    while ((match = actionPattern.exec(sentence)) !== null) {
      actionMatches.push({ action: match[1], index: match.index });
    }

    // If multiple actions found, split the sentence
    if (actionMatches.length > 1) {
      const medicationSentences: string[] = [];

      for (let i = 0; i < actionMatches.length; i++) {
        const startIndex = actionMatches[i].index;
        const endIndex = i < actionMatches.length - 1 ? actionMatches[i + 1].index : sentence.length;
        const medSentence = sentence.substring(startIndex, endIndex).trim();
        medicationSentences.push(medSentence);
      }

      // Extract each medication
      const orders = medicationSentences
        .map(s => this.extractMedicationOrder(s))
        .filter(order => order !== null) as ExtractedOrder[];

      return orders;
    }

    // Single medication - use existing method
    const order = this.extractMedicationOrder(sentence);
    return order ? [order] : [];
  }

  private extractMedicationOrder(sentence: string): ExtractedOrder | null {
    const lowerSentence = sentence.toLowerCase();
    let action: string | undefined;
    let hasSpecificMed = false;

    // Check for medication action keywords
    for (const [actionType, keywords] of Object.entries(this.medicationKeywords)) {
      for (const keyword of keywords) {
        if (lowerSentence.includes(keyword)) {
          action = actionType;
          break;
        }
      }
      if (action) break;
    }

    // Check for specific medication names
    hasSpecificMed = this.commonMedications.some(med => lowerSentence.includes(med.toLowerCase()));

    // Check if it's actually about medication
    const isMedication =
      hasSpecificMed ||
      lowerSentence.includes('mg') ||
      lowerSentence.includes('mcg') ||
      lowerSentence.includes('units') ||
      lowerSentence.includes('medication') ||
      lowerSentence.includes('prescription') ||
      lowerSentence.includes('drug');

    if (isMedication && action) {
      const confidence = this.calculateConfidence(sentence, 'medication', !!action, hasSpecificMed);

      // Determine urgency - "continue" medications are ALWAYS routine
      let urgency: 'routine' | 'urgent' | 'stat' = 'routine';
      if (action !== 'continue' && action !== 'refill') {
        // Only check for urgency markers on new/changed orders
        urgency = this.extractUrgency(sentence);
      }

      // Clean the text: normalize numbers and remove conversational phrases BEFORE storing
      let cleanedText = this.normalizeNumbers(sentence);

      // Fix common dosage typos like "5 100" → "500"
      cleanedText = cleanedText.replace(/\b(\d)\s+(\d{2,3})\s+(mg|mcg|units?)\b/gi, '$1$2 $3');

      cleanedText = cleanedText
        .replace(/^We'll\s+/i, '')
        .replace(/^Let's\s+/i, '')
        .replace(/^I'll\s+/i, '')
        .replace(/^Will\s+/i, '')
        .replace(/\s+for\s+that$/i, '')
        .replace(/\s+as\s+well$/i, '');

      // Capitalize first letter
      cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);

      // If medication has "units" but no specific medication name, try to infer it's insulin
      if (!hasSpecificMed && /\d+\s*units?\b/i.test(cleanedText)) {
        // Check if "insulin" or brand name already mentioned
        if (!/insulin|lantus|novolog|humalog|levemir|basaglar|tresiba|toujeo/i.test(cleanedText)) {
          // Add "insulin" as generic placeholder
          cleanedText = cleanedText.replace(/\b(start|begin|go ahead and start)\b/i, '$1 insulin');
        }
      }

      return {
        type: 'medication',
        text: cleanedText.trim(),
        action: action as any,
        confidence,
        urgency,
      };
    }

    return null;
  }

  /**
   * Check if sentence contains lab order
   */
  private containsLabOrder(sentence: string): boolean {
    // EXCLUDE if it looks like a medication (has dosage units)
    const hasMedicationUnits = /(mg|mcg|units?|ml|g|tablets?|capsules?|milligrams?|micrograms?)\b/i.test(sentence);
    if (hasMedicationUnits) {
      return false; // It's a medication, not a lab
    }

    // Check for actual lab orders (not just lab values)
    const hasLabOrder = this.labKeywords.some(keyword => sentence.includes(keyword));

    // Exclude sentences that only contain lab values without order words
    const isOnlyLabValue =
      this.labValueKeywords.some(keyword => sentence.includes(keyword)) &&
      !['check', 'order', 'get', 'draw', 'test', 'will check'].some(orderWord =>
        sentence.includes(orderWord)
      );

    // Exclude demographic information
    const isDemographic = this.demographicKeywords.some(keyword => sentence.includes(keyword));

    return hasLabOrder && !isOnlyLabValue && !isDemographic;
  }

  /**
   * Expand comma-separated OR space-separated lab list into individual orders
   * "Check A1C, CBC, CMP" → ["Check A1C", "Check CBC", "Check CMP"]
   * "Check CBC hemoglobin A1C" → ["Check CBC", "Check hemoglobin A1C"]
   */
  private expandLabList(sentence: string): string[] {
    const lower = sentence.toLowerCase();

    // Check if this contains a comma-separated list OR multiple lab keywords (space-separated)
    const hasCommaList = sentence.includes(',') && this.labKeywords.some(kw => lower.includes(kw));

    // Count how many lab keywords are in the sentence (excluding action words)
    const labKeywordMatches = this.labKeywords.filter(kw => {
      return kw.length > 4 && lower.includes(kw); // Only specific lab names
    });
    const hasMultipleLabs = labKeywordMatches.length > 1;

    if (!hasCommaList && !hasMultipleLabs) {
      return [sentence]; // Return as-is if not a list
    }

    // Extract the action phrase
    const actionMatch = sentence.match(/^(.*?)(check|order|get|draw|obtain|send)(?:\s+|,\s*)/i);

    if (!actionMatch) {
      return [sentence]; // Can't parse, return as-is
    }

    // Get the clean action word (e.g., "check" from "We'll check,")
    const actionWord = actionMatch[2];

    // Find where the lab list starts (after the action word and optional comma/space)
    const labListStart = actionMatch[0].length;
    const labPart = sentence.substring(labListStart);

    // Remove follow-up text (e.g., "and we'll see you back in two weeks")
    const cleanLabPart = labPart.replace(/\s*,?\s*(and\s+)?(we'll\s+|we\s+will\s+)?(see|schedule|return|come\s+back).*/i, '');

    let labItems: string[] = [];

    if (hasCommaList) {
      // Split on commas and "and"
      labItems = cleanLabPart
        .split(/,|\s+and\s+/i)
        .map(item => item.trim())
        .filter(item => item.length > 0);
    } else if (hasMultipleLabs) {
      // Space-separated list - split by lab keyword boundaries
      // Example: "CBC hemoglobin A1C lipid panel" → ["CBC", "hemoglobin A1C", "lipid panel"]
      labItems = this.splitSpaceSeparatedLabs(cleanLabPart);
    }

    // Reconstruct each lab with "Check [lab name]" format
    return labItems.map(lab => {
      // Clean up extra words
      const cleanLab = lab.replace(/^(a|an|the)\s+/i, '').trim();
      // Use capitalized action word: "Check A1C", "Check CBC"
      const capitalizedAction = actionWord.charAt(0).toUpperCase() + actionWord.slice(1);
      return `${capitalizedAction} ${cleanLab}`;
    });
  }

  /**
   * Split space-separated lab names
   * "CBC hemoglobin A1C cortisol" → ["CBC", "hemoglobin A1C", "cortisol"]
   */
  private splitSpaceSeparatedLabs(text: string): string[] {
    const words = text.split(/\s+/);
    const labs: string[] = [];
    let currentLab = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      currentLab += (currentLab ? ' ' : '') + word;

      // Check if current accumulated words match a lab keyword
      const matchesLabKeyword = this.labKeywords.some(kw => {
        return kw.length > 3 && currentLab.toLowerCase().includes(kw);
      });

      // Look ahead to see if next word would also match
      const nextWord = words[i + 1];
      let nextWouldExtend = false;
      if (nextWord) {
        const withNext = currentLab + ' ' + nextWord;
        nextWouldExtend = this.labKeywords.some(kw => {
          return kw.length > 3 && withNext.toLowerCase().includes(kw) && kw.length > currentLab.toLowerCase().length;
        });
      }

      // If we match and next word doesn't extend, save this lab
      if (matchesLabKeyword && !nextWouldExtend) {
        labs.push(currentLab);
        currentLab = '';
      }
    }

    // Add any remaining text
    if (currentLab) {
      labs.push(currentLab);
    }

    return labs.filter(lab => lab.trim().length > 0);
  }

  /**
   * Extract lab orders - returns array to handle comma-separated lists
   */
  private extractLabOrders(sentence: string): ExtractedOrder[] {
    // Expand comma-separated lists first
    const labSentences = this.expandLabList(sentence);
    const orders: ExtractedOrder[] = [];

    for (const labSentence of labSentences) {
      const order = this.extractSingleLabOrder(labSentence);
      if (order) {
        orders.push(order);
      }
    }

    return orders;
  }

  /**
   * Extract single lab order details
   */
  private extractSingleLabOrder(sentence: string): ExtractedOrder | null {
    const urgency = this.extractUrgency(sentence);
    const lowerSentence = sentence.toLowerCase();

    // Clean text first: remove any remaining conversational phrases
    let cleanedText = sentence
      .replace(/^We'll\s+/i, '')
      .replace(/^Let's\s+/i, '')
      .replace(/^I'll\s+/i, '');

    // Capitalize first letter if not already
    cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1).trim();

    // Filter out invalid/ambiguous lab names
    // Remove the action word to check the actual lab name
    const labNameOnly = cleanedText.replace(/^(Check|Order|Get|Draw|Obtain|Send)\s+/i, '').trim();

    // Reject if lab name is too short (< 3 chars) or is just abbreviation like "CS" without context
    if (labNameOnly.length < 3) {
      return null; // Too ambiguous
    }

    // Reject common invalid patterns
    const invalidPatterns = /^(cs|c\s*s)$/i;
    if (invalidPatterns.test(labNameOnly)) {
      return null; // Known invalid abbreviation
    }

    // Check if specific lab test is mentioned
    const hasSpecificTest = this.labKeywords.some(keyword => {
      // Only count specific tests, not action words
      return keyword.length > 4 && lowerSentence.includes(keyword);
    });

    // Check for action words
    const hasAction = /order|check|get|draw|obtain|send/i.test(sentence);

    const confidence = this.calculateConfidence(sentence, 'lab', hasAction, hasSpecificTest);

    return {
      type: 'lab',
      text: cleanedText,
      action: 'order',
      urgency,
      confidence,
    };
  }

  /**
   * Check if sentence contains imaging order
   */
  private containsImagingOrder(sentence: string): boolean {
    return this.imagingKeywords.some(keyword => sentence.includes(keyword));
  }

  /**
   * Check if sentence contains prior auth
   */
  private containsPriorAuth(sentence: string): boolean {
    return this.priorAuthKeywords.some(keyword => sentence.includes(keyword));
  }

  /**
   * Check if sentence is a follow-up appointment (not a specialist referral)
   */
  private isFollowUpAppointment(sentence: string): boolean {
    const followUpPatterns = [
      /see\s+you\s+back/i,
      /return\s+in/i,
      /come\s+back\s+in/i,
      /follow[\s-]?up\s+in/i,
      /recheck\s+in/i,
      /appointment\s+in/i,
    ];

    return followUpPatterns.some(pattern => pattern.test(sentence));
  }

  /**
   * Check if sentence contains referral to specialist
   */
  private containsReferral(sentence: string): boolean {
    // Only true referrals to specialists
    const referralPatterns = [
      /refer\s+to/i,
      /referral\s+to/i,
      /send\s+to/i,
      /consult\s+(with\s+)?cardiology|endocrin|neurology|psychiatry|dermatology|orthopedic/i,
      /see\s+(a\s+)?specialist/i,
      /appointment\s+with\s+(dr\.|doctor)/i,
    ];

    return referralPatterns.some(pattern => pattern.test(sentence));
  }

  /**
   * Extract prior authorization order with medication name
   */
  private extractPriorAuthOrder(sentence: string, medications: ExtractedOrder[]): ExtractedOrder {
    let medName = '';

    // Try to extract medication name from the sentence (e.g., "need PA for Zetia")
    const medMatch = sentence.match(/(for|authorization\s+for|auth\s+for|pa\s+for)\s+([A-Z][a-z]+(?:aro|lin|pril|stat|log|met|ide|mab|nib)?)\b/i);
    if (medMatch && medMatch[2] && medMatch[2].toLowerCase() !== 'that') {
      medName = medMatch[2];
    } else {
      // Sentence says "for that" - look in recently extracted medications
      if (medications.length > 0) {
        const lastMed = medications[medications.length - 1];
        // Extract medication name from last medication order - try multiple patterns
        const namePatterns = [
          // Match common medication name patterns with suffixes
          /\b([A-Z][a-z]+(?:aro|lin|pril|stat|log|met|ide|mab|nib|cin|lol|pine|zole|pam|done|cet|vir|mycin|cillin|oxin|azole|terol|prazole|jaro))\b/,
          // Match capitalized drug names
          /\b([A-Z][a-z]{3,})\b/,
          // Match two-word drug names
          /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/,
        ];

        for (const pattern of namePatterns) {
          const nameMatch = lastMed.text.match(pattern);
          if (nameMatch) {
            medName = nameMatch[1];
            break;
          }
        }
      }
    }

    const enhancedText = medName
      ? `Prior authorization needed for ${medName}`
      : sentence;

    return {
      type: 'prior_auth',
      text: enhancedText,
      action: 'order',
      confidence: medName ? 0.9 : 0.6,
    };
  }

  /**
   * Extract urgency from order - ONLY if explicitly stated
   */
  private extractUrgency(text: string): 'routine' | 'urgent' | 'stat' {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('stat') || lowerText.includes('immediately')) {
      return 'stat';
    }
    if (lowerText.includes('urgent') || lowerText.includes('asap')) {
      return 'urgent';
    }

    return 'routine';
  }

  /**
   * Get CPT code for lab order
   */
  private getCPTCode(labText: string): string {
    const lower = labText.toLowerCase();

    // Common lab CPT codes - more specific matches first
    const cptMap: Record<string, string> = {
      // Metabolic panels
      'cmp': '80053',
      'comprehensive metabolic': '80053',
      'complete metabolic': '80053',
      'bmp': '80048',
      'basic metabolic': '80048',

      // Blood counts
      'cbc': '85025',
      'complete blood count': '85025',

      // Lipids
      'lipid panel': '80061',
      'lipid profile': '80061',
      'cholesterol panel': '80061',

      // Diabetes
      'a1c': '83036',
      'hemoglobin a1c': '83036',
      'hba1c': '83036',
      'glycated hemoglobin': '83036',
      'fasting glucose': '82947',
      'glucose fasting': '82947',
      'random glucose': '82947',

      // Thyroid - specific matches
      't3 free': '84481',
      'free t3': '84481',
      't3': '84480',
      't4 free': '84439',
      'free t4': '84439',
      't4': '84436',
      'tsh': '84443',
      'thyroid stimulating': '84443',

      // Vitamins
      'vitamin d': '82306',
      '25-oh vitamin d': '82306',
      'b12': '82607',
      'vitamin b12': '82607',
      'folate': '82746',
      'folic acid': '82746',

      // Minerals
      'iron': '83540',
      'ferritin': '82728',
      'magnesium': '83735',
      'calcium': '82310',

      // Urinalysis
      'urinalysis': '81001',
      'ua': '81001',
      'urine analysis': '81001',

      // Hormones
      'testosterone free': '84402',
      'free testosterone': '84402',
      'testosterone': '84403',
      'testosterone total': '84403',
      'estrogen': '82670',
      'cortisol': '82533',
      'cortisol am': '82533',
      'progesterone': '84144',

      // Cardiac
      'troponin': '84484',
      'bnp': '83880',
      'cpk': '82550',
      'ck-mb': '82553',

      // Liver function
      'lft': '80076',
      'liver function': '80076',
      'alt': '84460',
      'ast': '84450',
      'alkaline phosphatase': '84075',
      'bilirubin': '82247',
      'albumin': '82040',

      // Kidney function
      'creatinine': '82565',
      'bun': '84520',
      'egfr': '80069',

      // Coagulation
      'inr': '85610',
      'pt': '85610',
      'ptt': '85730',
      'aptt': '85730',

      // Inflammation
      'crp': '86140',
      'c-reactive protein': '86140',
      'esr': '85652',
      'sed rate': '85652',

      // Other
      'psa': '84153',
      'hcg': '84702',
      'pregnancy test': '84702',
      'acth': '82024',
    };

    // Find matching CPT code - check for exact matches first
    for (const [keyword, cpt] of Object.entries(cptMap)) {
      if (lower.includes(keyword)) {
        return cpt;
      }
    }

    return ''; // No CPT code found
  }

  /**
   * Normalize numeric text (convert words to digits)
   */
  private normalizeNumbers(text: string): string {
    const numberWords: Record<string, string> = {
      'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
      'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
      'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14',
      'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19',
      'twenty': '20', 'thirty': '30', 'forty': '40', 'fifty': '50',
      'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90',
      'hundred': '100', 'thousand': '1000'
    };

    let result = text;

    // First, handle "point" for decimals (e.g., "two point five" -> "2.5")
    result = result.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+point\s+(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi, (match, whole, decimal) => {
      const wholeNum = numberWords[whole.toLowerCase()] || whole;
      const decimalNum = numberWords[decimal.toLowerCase()] || decimal;
      return `${wholeNum}.${decimalNum}`;
    });

    // Handle compound numbers (e.g., "twenty five" -> "25")
    result = result.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/gi, (match, tens, ones) => {
      const tensNum = parseInt(numberWords[tens.toLowerCase()]);
      const onesNum = parseInt(numberWords[ones.toLowerCase()]);
      return String(tensNum + onesNum);
    });

    // Replace all number words with digits when they appear before common medical/dosage keywords
    // This handles: "ten units", "twenty milligrams", "five times a day", etc.
    const dosageContext = /(mg|mcg|units?|milligrams?|micrograms?|ml|g|lbs|pounds|weeks?|days?|months?|years?|times?|hours?|capsules?|tablets?|pills?|drops?|sprays?|puffs?|a\s+day|daily|twice|once|bid|tid|qid|prn)/i;

    for (const [word, digit] of Object.entries(numberWords)) {
      // Match number word followed by dosage-related terms
      const regex = new RegExp(`\\b${word}\\b(?=\\s+${dosageContext.source})`, 'gi');
      result = result.replace(regex, digit);
    }

    // Also replace number words that appear after medication names
    // This handles: "Simvastatin twenty" -> "Simvastatin 20"
    for (const [word, digit] of Object.entries(numberWords)) {
      // Match medication name patterns followed by number word
      const regex = new RegExp(`(\\b[A-Z][a-z]+(?:aro|lin|pril|stat|log|met|ide|mab|nib|cin|lol|pine|zole|pam|done|cet|vir|mycin|cillin|oxin|azole|terol|prazole)?)\\s+${word}\\b`, 'gi');
      result = result.replace(regex, (match, medName) => {
        return `${medName} ${digit}`;
      });
    }

    // Normalize "milligrams" to "mg", "micrograms" to "mcg" AFTER number conversion
    result = result.replace(/\bmilligrams?\b/gi, 'mg');
    result = result.replace(/\bmicrograms?\b/gi, 'mcg');

    return result;
  }

  /**
   * Clean and format order text for staff readability
   * Note: Text cleaning now happens during extraction, so this just ensures consistency
   */
  private cleanOrderText(text: string): string {
    // Text is already cleaned during extraction (numbers normalized, conversational phrases removed)
    // Just return as-is, ensuring proper trimming
    return text.trim();
  }

  /**
   * Extract prior authorization details from AI-generated clinical note
   */
  private extractPriorAuthFromNote(aiNote: string): Map<string, string> {
    const priorAuthMap = new Map<string, string>();

    console.log('=== EXTRACTING PA FROM AI NOTE ===');
    console.log('AI Note length:', aiNote.length);

    // Find the PRIOR AUTH section with more flexible matching
    const priorAuthMatch = aiNote.match(/(?:PRIOR AUTH(?:ORIZATION)?)[:\s]*\n([\s\S]*?)(?:\n\n[A-Z]|\n--|\n═|$)/i);

    console.log('Prior Auth Match found:', !!priorAuthMatch);

    if (priorAuthMatch) {
      const priorAuthSection = priorAuthMatch[1];
      console.log('Prior Auth Section:', priorAuthSection);

      // Parse each medication's PA details
      // Format: • Zetia (Ezetimibe) – Prior authorization required; indication is...
      const paLines = priorAuthSection.split('\n').filter(line => line.trim().startsWith('•'));
      console.log('PA Lines found:', paLines.length, paLines);

      for (const line of paLines) {
        // Extract medication name (first word or phrase before parenthesis/dash)
        const medMatch = line.match(/^•\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(?:\(|–|—|-)/);
        if (medMatch) {
          const medName = medMatch[1].trim();
          // Extract full justification (everything after the bullet)
          const justification = line.replace(/^•\s*/, '').trim();
          console.log(`Adding PA: ${medName.toLowerCase()} -> ${justification}`);
          priorAuthMap.set(medName.toLowerCase(), justification);
        }
      }
    }

    console.log('Final PA Map size:', priorAuthMap.size);
    return priorAuthMap;
  }

  /**
   * Format orders for display in note template
   * Enhanced for staff readability with action items, CPT codes, and confidence warnings
   */
  formatOrdersForTemplate(orders: OrderExtractionResult, aiGeneratedNote?: string): string {
    const sections: string[] = [];

    console.log('=== FORMAT ORDERS FOR TEMPLATE ===');
    console.log('AI Note provided:', !!aiGeneratedNote);
    console.log('AI Note preview:', aiGeneratedNote ? aiGeneratedNote.substring(0, 500) : 'none');

    // Extract PA details from AI note if available
    const priorAuthDetails = aiGeneratedNote ? this.extractPriorAuthFromNote(aiGeneratedNote) : new Map();

    // MEDICATIONS
    if (orders.medications.length > 0) {
      sections.push('═══════════════════════════════════════════════════════');
      sections.push('📋 MEDICATION ORDERS');
      sections.push('═══════════════════════════════════════════════════════');
      orders.medications.forEach((med, index) => {
        const action = med.action ? med.action.toUpperCase() : 'ORDER';
        const cleanText = this.cleanOrderText(med.text);
        const urgency = med.urgency === 'stat' ? ' ⚡ STAT' : med.urgency === 'urgent' ? ' 🔴 URGENT' : '';
        const confidence = med.confidence < 0.7 ? ` ⚠️ Low confidence (${Math.round(med.confidence * 100)}%) - verify` : '';

        sections.push(`\n${index + 1}. ✅ ${action}`);
        sections.push(`   ${cleanText}${urgency}${confidence}`);
      });
      sections.push('');
    }

    // LAB ORDERS - condensed format with CPT codes
    if (orders.labs.length > 0) {
      sections.push('═══════════════════════════════════════════════════════');
      sections.push('🧪 LAB ORDERS');
      sections.push('═══════════════════════════════════════════════════════');

      const labItems = orders.labs.map((lab, index) => {
        const cleanText = this.cleanOrderText(lab.text);
        const cpt = this.getCPTCode(lab.text);
        const cptDisplay = cpt ? ` [CPT: ${cpt}]` : '';
        return `${cleanText}${cptDisplay}`;
      });

      // Join all labs in one line, separated by commas
      sections.push(labItems.join(', '));
      sections.push('');
    }

    // IMAGING ORDERS
    if (orders.imaging.length > 0) {
      sections.push('═══════════════════════════════════════════════════════');
      sections.push('📷 IMAGING ORDERS');
      sections.push('═══════════════════════════════════════════════════════');
      orders.imaging.forEach((img, index) => {
        const cleanText = this.cleanOrderText(img.text);
        const urgency = img.urgency === 'stat' ? ' ⚡ STAT' : img.urgency === 'urgent' ? ' 🔴 URGENT' : '';
        const confidence = img.confidence < 0.7 ? ` ⚠️ Low confidence (${Math.round(img.confidence * 100)}%) - verify` : '';

        sections.push(`\n${index + 1}. ✅ ORDER IMAGING`);
        sections.push(`   ${cleanText}${urgency}${confidence}`);
      });
      sections.push('');
    }

    // PRIOR AUTHORIZATIONS with detailed clinical justification
    if (orders.priorAuths.length > 0) {
      sections.push('═══════════════════════════════════════════════════════');
      sections.push('⚠️ PRIOR AUTHORIZATION REQUIRED');
      sections.push('═══════════════════════════════════════════════════════');
      sections.push('ACTION REQUIRED: Submit prior authorizations for:');
      sections.push('');
      orders.priorAuths.forEach((auth, index) => {
        const cleanText = this.cleanOrderText(auth.text);

        // Extract medication name from the auth text
        const medMatch = cleanText.match(/(?:for|authorization needed for|auth needed for)\s+([A-Za-z]+)/i);
        const medName = medMatch ? medMatch[1].toLowerCase() : '';

        // Check if we have detailed PA justification from AI note
        let detailedJustification = '';
        if (medName && priorAuthDetails.has(medName)) {
          detailedJustification = priorAuthDetails.get(medName)!;
        }

        sections.push(`${index + 1}. 🔒 PRIOR AUTH NEEDED`);

        if (detailedJustification) {
          // Show detailed clinical justification from AI note
          sections.push(`   ${detailedJustification}`);
        } else {
          // Fall back to simple message
          sections.push(`   ${cleanText}`);
        }

        sections.push('');
      });
    }

    // FOLLOW-UP / REFERRALS
    if (orders.referrals.length > 0) {
      sections.push('═══════════════════════════════════════════════════════');
      sections.push('📅 FOLLOW-UP APPOINTMENTS');
      sections.push('═══════════════════════════════════════════════════════');
      orders.referrals.forEach((ref, index) => {
        const cleanText = this.cleanOrderText(ref.text);
        const confidence = ref.confidence < 0.7 ? ` ⚠️ Low confidence (${Math.round(ref.confidence * 100)}%) - verify` : '';

        sections.push(`${index + 1}. 📆 SCHEDULE FOLLOW-UP`);
        sections.push(`   ${cleanText}${confidence}`);
        sections.push('');
      });
    }

    return sections.join('\n');
  }

  /**
   * Parse orders from the Orders & Actions section of a note
   */
  parseOrdersSection(ordersText: string): ExtractedOrder[] {
    const orders: ExtractedOrder[] = [];
    const lines = ordersText.split('\n');

    let currentType: ExtractedOrder['type'] = 'other';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check for section headers
      if (trimmedLine.includes('MEDICATION')) {
        currentType = 'medication';
        continue;
      }
      if (trimmedLine.includes('LAB')) {
        currentType = 'lab';
        continue;
      }
      if (trimmedLine.includes('IMAGING')) {
        currentType = 'imaging';
        continue;
      }
      if (trimmedLine.includes('PRIOR AUTH')) {
        currentType = 'prior_auth';
        continue;
      }
      if (trimmedLine.includes('REFERRAL')) {
        currentType = 'referral';
        continue;
      }

      // Parse individual order lines
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
        const orderText = trimmedLine.substring(1).trim();

        // Extract action if present
        const actionMatch = orderText.match(/^(START|STOP|CONTINUE|INCREASE|DECREASE|ORDER):\s*/i);
        let action: ExtractedOrder['action'] | undefined;
        let text = orderText;

        if (actionMatch) {
          action = actionMatch[1].toLowerCase() as ExtractedOrder['action'];
          text = orderText.substring(actionMatch[0].length);
        }

        orders.push({
          type: currentType,
          text,
          action,
          confidence: 1.0, // High confidence since it's from structured section
        });
      }
    }

    return orders;
  }

  /**
   * Merge extracted orders with existing orders
   */
  mergeOrders(existing: ExtractedOrder[], extracted: ExtractedOrder[]): ExtractedOrder[] {
    const merged = [...existing];

    for (const newOrder of extracted) {
      // Check if order already exists (simple duplicate check)
      const isDuplicate = merged.some(
        order =>
          order.text.toLowerCase() === newOrder.text.toLowerCase() && order.type === newOrder.type
      );

      if (!isDuplicate) {
        merged.push(newOrder);
      }
    }

    return merged;
  }
}

// Export singleton instance
export const orderExtractionService = new OrderExtractionService();
