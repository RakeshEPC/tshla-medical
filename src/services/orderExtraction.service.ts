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

  // Prior auth keywords
  private priorAuthKeywords = [
    'prior auth',
    'prior authorization',
    'pre-auth',
    'preauth',
    'authorization',
    'approval needed',
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

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();

      // Check for medications
      const medicationOrder = this.extractMedicationOrder(sentence);
      if (medicationOrder) {
        result.medications.push(medicationOrder);
        orderSentences.push(sentence);
      }

      // Check for labs
      if (this.containsLabOrder(lowerSentence)) {
        const labOrder = this.extractLabOrder(sentence);
        if (labOrder) {
          result.labs.push(labOrder);
          orderSentences.push(sentence);
        }
      }

      // Check for imaging
      if (this.containsImagingOrder(lowerSentence)) {
        result.imaging.push({
          type: 'imaging',
          text: sentence,
          action: 'order',
          confidence: 0.8,
        });
        orderSentences.push(sentence);
      }

      // Check for prior auth
      if (this.containsPriorAuth(lowerSentence)) {
        result.priorAuths.push({
          type: 'prior_auth',
          text: sentence,
          action: 'order',
          confidence: 0.9,
        });
        orderSentences.push(sentence);
      }

      // Check for referrals
      if (this.containsReferral(lowerSentence)) {
        result.referrals.push({
          type: 'referral',
          text: sentence,
          action: 'order',
          confidence: 0.7,
        });
        orderSentences.push(sentence);
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

      return {
        type: 'medication',
        text: sentence.trim(),
        action: action as any,
        confidence,
        urgency: this.extractUrgency(sentence),
      };
    }

    return null;
  }

  /**
   * Check if sentence contains lab order
   */
  private containsLabOrder(sentence: string): boolean {
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
   * Extract lab order details
   */
  private extractLabOrder(sentence: string): ExtractedOrder {
    const urgency = this.extractUrgency(sentence);
    const lowerSentence = sentence.toLowerCase();

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
      text: sentence.trim(),
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
   * Check if sentence contains referral
   */
  private containsReferral(sentence: string): boolean {
    return this.referralKeywords.some(keyword => sentence.includes(keyword));
  }

  /**
   * Extract urgency from order
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
   * Format orders for display in note template
   */
  formatOrdersForTemplate(orders: OrderExtractionResult): string {
    const sections: string[] = [];

    if (orders.medications.length > 0) {
      sections.push('MEDICATIONS:');
      orders.medications.forEach(med => {
        const action = med.action ? med.action.toUpperCase() : 'ORDER';
        sections.push(`- ${action}: ${med.text}`);
      });
    }

    if (orders.labs.length > 0) {
      sections.push('\nLABS:');
      orders.labs.forEach(lab => {
        sections.push(`- ${lab.text}`);
      });
    }

    if (orders.imaging.length > 0) {
      sections.push('\nIMAGING:');
      orders.imaging.forEach(img => {
        sections.push(`- ${img.text}`);
      });
    }

    if (orders.priorAuths.length > 0) {
      sections.push('\nPRIOR AUTHORIZATIONS:');
      orders.priorAuths.forEach(auth => {
        sections.push(`- ${auth.text}`);
      });
    }

    if (orders.referrals.length > 0) {
      sections.push('\nREFERRALS:');
      orders.referrals.forEach(ref => {
        sections.push(`- ${ref.text}`);
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
