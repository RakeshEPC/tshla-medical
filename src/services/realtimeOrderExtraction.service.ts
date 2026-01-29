/**
 * Real-Time Order Extraction Service
 * Extracts medications and lab orders in real-time as the user dictates
 * Handles modifications and changes with sophisticated NLP
 */

export interface RealtimeMedication {
  id: string;
  drugName: string;
  dosage: string;
  frequency: string;
  route: string;
  duration?: string;
  quantity?: string;
  refills?: string;
  indication?: string;
  pharmacy?: string;
  status: 'new' | 'modified' | 'cancelled';
  rawText: string;
  confidence: number;
}

export interface RealtimeLabOrder {
  id: string;
  testName: string;
  orderDate: string;
  urgency: 'routine' | 'urgent' | 'stat';
  fasting?: boolean;
  notes?: string;
  location?: string;
  status: 'new' | 'modified' | 'cancelled';
  rawText: string;
  confidence: number;
}

export interface RealtimeOrders {
  medications: RealtimeMedication[];
  labs: RealtimeLabOrder[];
  lastUpdated: Date;
}

class RealtimeOrderExtractionService {
  // Medication patterns
  private medicationPatterns = {
    // Common medication formats
    standard: /\b([A-Z][a-z]+(?:ol|in|pril|pine|statin|ide|one|pam|oxin|mycin|cillin|cycline|floxacin|azole|vir))\s+(\d+\s*(?:mg|mcg|g|ml|units?))\s+(?:PO|po|by mouth|orally)?\s*(?:once|twice|three times|qd|bid|tid|qid|q\d+h|daily|nightly|prn)?/gi,
    // "start X", "begin X", "prescribe X", "we'll X"
    startCommand: /\b(?:start|begin|initiate|prescribe|give|add|we'?ll)\s+(?:go ahead and\s+)?([A-Z][a-z]+(?:ol|in|pril|pine|statin|ide|one|pam|oxin|mycin|cillin|cycline|floxacin|azole|vir|formin))\s+(\d+\s*(?:mg|mcg|g|ml|units?))/gi,
    // "Taking X", "On X", "Currently on X", "Patient takes X", "Comes in on X"
    takingCommand: /\b(?:taking|on|currently on|patient on|patient takes?|pt takes?|takes?|comes in on)\s+([A-Z][a-z]+(?:ol|in|pril|pine|statin|ide|one|pam|oxin|mycin|cillin|cycline|floxacin|azole|vir|formin))\s+(\d+\s*(?:mg|mcg|g|ml|units?))/gi,
    // "refill X", "continue X"
    refillCommand: /\b(?:refill|continue|renew)\s+(?:the\s+)?([A-Z][a-z]+(?:ol|in|pril|pine|statin|ide|one|pam|oxin|mycin|cillin|cycline|floxacin|azole|vir|formin))\s*(?:(\d+\s*(?:mg|mcg|g|ml|units?)))?/gi,
    // "stop X", "discontinue X", "cancel X"
    stopCommand: /\b(?:stop|discontinue|cancel|hold|cease|dc|d\/c)\s+(?:the\s+)?([A-Z][a-z]+(?:ol|in|pril|pine|statin|ide|one|pam|oxin|mycin|cillin|cycline|floxacin|azole|vir|formin))/gi,
    // "increase X to Y", "decrease X to Y"
    modifyCommand: /\b(?:increase|raise|up|decrease|lower|reduce|change)\s+(?:the\s+)?([A-Z][a-z]+(?:ol|in|pril|pine|statin|ide|one|pam|oxin|mycin|cillin|cycline|floxacin|azole|vir|formin))\s+(?:to|from\s+\S+\s+to)\s+(\d+\s*(?:mg|mcg|g|ml|units?))/gi,
  };

  // Common drug names for better detection
  private commonDrugs = [
    'metformin', 'lisinopril', 'atorvastatin', 'amlodipine', 'losartan', 'simvastatin',
    'omeprazole', 'levothyroxine', 'azithromycin', 'amoxicillin', 'gabapentin', 'hydrochlorothiazide',
    'sertraline', 'ibuprofen', 'prednisone', 'insulin', 'albuterol', 'furosemide',
    'citalopram', 'tramadol', 'trazodone', 'pantoprazole', 'escitalopram', 'carvedilol',
    'montelukast', 'rosuvastatin', 'warfarin', 'apixaban', 'rivaroxaban', 'empagliflozin',
    'semaglutide', 'ozempic', 'wegovy', 'mounjaro', 'tirzepatide', 'trulicity', 'victoza',
    'januvia', 'jardiance', 'farxiga', 'invokana', 'glipizide', 'glyburide',
    'lipitor', 'zofran', 'ondansetron'
  ];

  // Lab test patterns - improved to capture full test names
  private labPatterns = {
    // "order X lab", "get X test", "check X" - capture everything up to 'at', 'in', 'for' or end
    orderCommand: /\b(?:order|get|draw|check|obtain|send)\s+(?:a\s+)?(?:STAT\s+)?([^.!?,]+?)(?:\s+(?:at|in|for)\s+|\s+and\s+|,|$)/gi,
    // "let's get X", "let's check X", "we'll check X", "I will check X"
    letsCommand: /\b(?:let'?s|we'?ll|i will|i'll)\s+(?:go ahead and\s+)?(?:get|check|order|draw|do)\s+(?:a\s+)?(?:that\s+)?([^.!?,]+?)(?:\s+(?:at|in|for)\s+|\s+and\s+|,|$)/gi,
    // Specific tests - keep these for fallback
    specificTests: /\b(CBC|CMP|BMP|TSH|A1C|HbA1c|hemoglobin A1C|lipid panel|metabolic panel|liver function|kidney function|thyroid panel|glucose|creatinine|hemoglobin|cholesterol|LDL|HDL|triglycerides|free T3|free T4|microalbumin|urine microalbumin)/gi,
  };

  // Common lab tests - ordered by length (longest first for better matching)
  private commonLabs = [
    'hemoglobin A1C', 'lipid panel', 'liver function', 'kidney function', 'renal panel',
    'thyroid panel', 'fasting glucose', 'platelet count', 'vitamin D', 'vitamin B12',
    'iron panel', 'microalbumin', 'urine microalbumin',
    'CBC', 'CMP', 'BMP', 'TSH', 'A1C', 'HbA1c', 'LFT', 'glucose', 'creatinine',
    'BUN', 'eGFR', 'hemoglobin', 'hematocrit', 'cholesterol', 'LDL', 'HDL',
    'triglycerides', 'urinalysis', 'UA', 'ferritin', 'PSA', 'troponin', 'BNP', 'INR',
    'PT/PTT', 'FSH', 'LH', 'estrogen', 'progesterone'
  ];

  // Urgency keywords
  private urgencyKeywords = {
    stat: ['stat', 'emergency', 'immediately', 'urgent stat', 'asap'],
    urgent: ['urgent', 'today', 'this week', 'soon', 'priority'],
    routine: ['routine', 'standard', 'regular', 'next visit', 'follow-up']
  };

  /**
   * Extract orders in real-time from transcript
   */
  extractOrders(transcript: string, previousOrders?: RealtimeOrders): RealtimeOrders {
    const medications = this.extractMedications(transcript, previousOrders?.medications || []);
    const labs = this.extractLabOrders(transcript, previousOrders?.labs || []);

    return {
      medications,
      labs,
      lastUpdated: new Date()
    };
  }

  /**
   * Extract medication orders with change detection
   */
  private extractMedications(transcript: string, previousMeds: RealtimeMedication[]): RealtimeMedication[] {
    const medications: RealtimeMedication[] = [...previousMeds];
    const lowerTranscript = transcript.toLowerCase();

    // Split into sentences for better context
    const sentences = transcript.split(/[.!?]\s+/);

    // Process each sentence that might contain a medication order
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const convertedSentence = this.convertSpelledNumber(sentence);

      // Skip sentences that don't look like medication orders
      if (!lowerSentence.includes('start') &&
          !lowerSentence.includes('prescribe') &&
          !lowerSentence.includes('add') &&
          !lowerSentence.includes('continue') &&
          !lowerSentence.includes('give') &&
          !lowerSentence.includes('takes') &&
          !lowerSentence.includes('taking') &&
          !lowerSentence.includes('refill') &&
          !sentence.match(/\b\d+\s*mg\b/i) &&
          !convertedSentence.match(/\b\d+\s*mg\b/i)) {
        continue;
      }

      // Try to extract medication from this sentence
      for (const drug of this.commonDrugs) {
        if (lowerSentence.includes(drug)) {
          // Try to match dosage from converted sentence (handles spelled numbers)
          const dosageMatch = convertedSentence.match(/\b(\d+\s*(?:mg|mcg|g|ml|units?))\b/i);
          if (dosageMatch) {
            const existingMed = medications.find(m =>
              this.normalizeDrugName(m.drugName) === drug && m.status !== 'cancelled'
            );

            if (!existingMed) {
              medications.push(this.createMedication(drug, dosageMatch[1], sentence, 'new'));
            }
          }
        }
      }
    }

    // Check for stop/cancel commands
    const stopMatches = [...transcript.matchAll(this.medicationPatterns.stopCommand)];
    for (const match of stopMatches) {
      const drugName = this.normalizeDrugName(match[1]);
      const existingMed = medications.find(m =>
        this.normalizeDrugName(m.drugName) === drugName && m.status !== 'cancelled'
      );

      if (existingMed) {
        existingMed.status = 'cancelled';
        existingMed.rawText = match[0];
      }
    }

    // Check for modify commands (increase/decrease)
    const modifyMatches = [...transcript.matchAll(this.medicationPatterns.modifyCommand)];
    for (const match of modifyMatches) {
      const drugName = this.normalizeDrugName(match[1]);
      const newDosage = match[2];

      const existingMed = medications.find(m =>
        this.normalizeDrugName(m.drugName) === drugName && m.status !== 'cancelled'
      );

      if (existingMed) {
        existingMed.dosage = newDosage;
        existingMed.status = 'modified';
        existingMed.rawText = match[0];
      } else {
        // Create new medication with modified dosage
        medications.push(this.createMedication(drugName, newDosage, match[0], 'modified'));
      }
    }

    // Check for new medication orders
    const standardMatches = [...transcript.matchAll(this.medicationPatterns.standard)];
    for (const match of standardMatches) {
      const drugName = this.normalizeDrugName(match[1]);
      const dosage = match[2];

      // Check if this medication already exists
      const existingMed = medications.find(m =>
        this.normalizeDrugName(m.drugName) === drugName
      );

      if (!existingMed || existingMed.status === 'cancelled') {
        medications.push(this.createMedication(drugName, dosage, match[0], 'new'));
      }
    }

    // Check for start commands
    const startMatches = [...transcript.matchAll(this.medicationPatterns.startCommand)];
    for (const match of startMatches) {
      const drugName = this.normalizeDrugName(match[1]);
      const dosage = match[2];

      const existingMed = medications.find(m =>
        this.normalizeDrugName(m.drugName) === drugName
      );

      if (!existingMed || existingMed.status === 'cancelled') {
        medications.push(this.createMedication(drugName, dosage, match[0], 'new'));
      }
    }

    // Check for "Taking" commands (patient currently on medication)
    const takingMatches = [...transcript.matchAll(this.medicationPatterns.takingCommand)];
    for (const match of takingMatches) {
      const drugName = this.normalizeDrugName(match[1]);
      const dosage = match[2];

      const existingMed = medications.find(m =>
        this.normalizeDrugName(m.drugName) === drugName
      );

      if (!existingMed || existingMed.status === 'cancelled') {
        medications.push(this.createMedication(drugName, dosage, match[0], 'new'));
      }
    }

    // Check for refill commands
    const refillMatches = [...transcript.matchAll(this.medicationPatterns.refillCommand)];
    for (const match of refillMatches) {
      const drugName = this.normalizeDrugName(match[1]);
      const dosage = match[2]; // May be undefined if not specified

      // Try to find existing medication to refill
      const existingMed = medications.find(m =>
        this.normalizeDrugName(m.drugName) === drugName && m.status !== 'cancelled'
      );

      if (existingMed && dosage) {
        // Update dosage if specified
        existingMed.dosage = dosage;
      } else if (!existingMed) {
        // If dosage provided, create new medication
        if (dosage) {
          medications.push(this.createMedication(drugName, dosage, match[0], 'new'));
        } else {
          // Try to find dosage from earlier in transcript
          const context = this.getContext(transcript, match.index!, 500);
          const contextDosage = this.extractDosageFromContext(context);
          if (contextDosage) {
            medications.push(this.createMedication(drugName, contextDosage, match[0], 'new'));
          }
        }
      }
    }

    // Check for "refill both" or "refill all" patterns - applies to previously mentioned meds
    const refillBothPattern = /\b(?:refill|continue|renew)\s+(?:both|all|those|these)\s+(?:medications?|meds?)\b/gi;
    const refillBothMatches = [...transcript.matchAll(refillBothPattern)];
    if (refillBothMatches.length > 0) {
      // Mark all existing medications as confirmed
      // This ensures they stay in the list even if mentioned before
      medications.forEach(med => {
        if (med.status !== 'cancelled') {
          med.status = 'new'; // Keep them as active orders
        }
      });
    }

    // Fuzzy matching for common drugs mentioned in transcript
    for (const drug of this.commonDrugs) {
      const regex = new RegExp(`\\b${drug}\\b`, 'gi');
      const matches = [...transcript.matchAll(regex)];

      for (const match of matches) {
        const context = this.getContext(transcript, match.index!, 200); // Wider context
        const dosage = this.extractDosageFromContext(context);

        if (dosage) {
          const existingMed = medications.find(m =>
            this.normalizeDrugName(m.drugName) === drug
          );

          if (!existingMed || existingMed.status === 'cancelled') {
            medications.push(this.createMedication(drug, dosage, context, 'new'));
          }
        }
      }
    }

    return medications;
  }

  /**
   * Extract lab orders with urgency detection
   */
  private extractLabOrders(transcript: string, previousLabs: RealtimeLabOrder[]): RealtimeLabOrder[] {
    const labs: RealtimeLabOrder[] = [...previousLabs];
    const uniqueTests = new Set<string>();

    // Track existing tests
    labs.forEach(lab => {
      if (lab.status !== 'cancelled') {
        uniqueTests.add(lab.testName.toLowerCase());
      }
    });

    // Extract from order commands
    const orderMatches = [...transcript.matchAll(this.labPatterns.orderCommand)];
    for (const match of orderMatches) {
      const fullMatch = match[0];
      const capturedText = match[1];

      // Split combined lab names into individual tests
      const testNames = this.splitCombinedLabNames(capturedText);

      for (const testName of testNames) {
        if (testName && !uniqueTests.has(testName.toLowerCase())) {
          const urgency = this.detectUrgency(fullMatch, 0);
          const fasting = this.detectFasting(fullMatch, 0);

          // Get wider context for location extraction
          const context = this.getContext(transcript, match.index!, 150);

          labs.push(this.createLabOrder(testName, urgency, fasting, context));
          uniqueTests.add(testName.toLowerCase());
        }
      }
    }

    // Extract from "let's" commands
    const letsMatches = [...transcript.matchAll(this.labPatterns.letsCommand)];
    for (const match of letsMatches) {
      // Split combined lab names into individual tests
      const testNames = this.splitCombinedLabNames(match[1]);

      for (const testName of testNames) {
        if (testName && !uniqueTests.has(testName.toLowerCase())) {
          const urgency = this.detectUrgency(transcript, match.index!);
          const fasting = this.detectFasting(transcript, match.index!);

          // Get wider context for location extraction
          const context = this.getContext(transcript, match.index!, 150);

          labs.push(this.createLabOrder(testName, urgency, fasting, context));
          uniqueTests.add(testName.toLowerCase());
        }
      }
    }

    // Extract specific tests
    const specificMatches = [...transcript.matchAll(this.labPatterns.specificTests)];
    for (const match of specificMatches) {
      const testName = this.normalizeTestName(match[1]);

      if (testName && !uniqueTests.has(testName.toLowerCase())) {
        const context = this.getContext(transcript, match.index!);

        // Only add if it looks like an order (not a lab result)
        if (this.isLabOrder(context)) {
          const urgency = this.detectUrgency(transcript, match.index!);
          const fasting = this.detectFasting(transcript, match.index!);

          labs.push(this.createLabOrder(testName, urgency, fasting, match[0]));
          uniqueTests.add(testName.toLowerCase());
        }
      }
    }

    // Fuzzy matching for common labs
    for (const labTest of this.commonLabs) {
      const regex = new RegExp(`\\b${labTest}\\b`, 'gi');
      const matches = [...transcript.matchAll(regex)];

      for (const match of matches) {
        const testName = this.normalizeTestName(labTest);

        if (testName && !uniqueTests.has(testName.toLowerCase())) {
          const context = this.getContext(transcript, match.index!);

          if (this.isLabOrder(context)) {
            const urgency = this.detectUrgency(transcript, match.index!);
            const fasting = this.detectFasting(transcript, match.index!);

            labs.push(this.createLabOrder(testName, urgency, fasting, context));
            uniqueTests.add(testName.toLowerCase());
          }
        }
      }
    }

    return labs;
  }

  /**
   * Helper: Create medication object
   */
  private createMedication(
    drugName: string,
    dosage: string,
    rawText: string,
    status: 'new' | 'modified' | 'cancelled'
  ): RealtimeMedication {
    // Extract additional details from raw text
    const frequency = this.extractFrequency(rawText);
    const route = this.extractRoute(rawText);
    const duration = this.extractDuration(rawText);

    return {
      id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      drugName,
      dosage,
      frequency: frequency || 'as directed',
      route: route || 'PO',
      duration,
      quantity: this.extractQuantity(rawText),
      refills: this.extractRefills(rawText),
      pharmacy: this.extractPharmacy(rawText),
      status,
      rawText,
      confidence: 0.8
    };
  }

  /**
   * Helper: Create lab order object
   */
  private createLabOrder(
    testName: string,
    urgency: 'routine' | 'urgent' | 'stat',
    fasting: boolean,
    rawText: string
  ): RealtimeLabOrder {
    // Try to extract specific date/time from text first
    const extractedDate = this.extractOrderDate(rawText);
    const orderDate = extractedDate || this.calculateOrderDate(urgency);

    return {
      id: `lab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      testName,
      orderDate,
      urgency,
      fasting,
      location: this.extractLabLocation(rawText),
      status: 'new',
      rawText,
      confidence: 0.85
    };
  }

  /**
   * Helper: Extract order date from text (e.g., "in 3 months", "tomorrow", "next week")
   */
  private extractOrderDate(text: string): string | null {
    const converted = this.convertSpelledNumber(text.toLowerCase());

    // Check for specific time references
    if (/\btoday\b/i.test(text)) {
      return 'Today';
    }
    if (/\btomorrow\b/i.test(text)) {
      return 'Tomorrow';
    }
    if (/\bnext week\b/i.test(text)) {
      return 'Next Week';
    }

    // Check for "in X days/weeks/months"
    const inTimeMatch = converted.match(/\bin\s+(\d+)\s+(day|week|month)s?\b/i);
    if (inTimeMatch) {
      const num = inTimeMatch[1];
      const unit = inTimeMatch[2];
      return `In ${num} ${unit}${num !== '1' ? 's' : ''}`;
    }

    // Check for "X months" or "X weeks"
    const timeMatch = converted.match(/\b(\d+)\s+(day|week|month)s?\b/i);
    if (timeMatch) {
      const num = timeMatch[1];
      const unit = timeMatch[2];
      return `In ${num} ${unit}${num !== '1' ? 's' : ''}`;
    }

    return null;
  }

  /**
   * Helper: Normalize drug name
   */
  private normalizeDrugName(name: string): string {
    return name.toLowerCase().trim();
  }

  /**
   * Helper: Normalize test name
   */
  private normalizeTestName(name: string): string {
    let cleaned = name.trim().replace(/\s+/g, ' ');

    // Remove common prefixes/suffixes that aren't part of the test name
    cleaned = cleaned.replace(/\b(also|order|get|send|draw|check|obtain|a|an|the|for|tomorrow|today|next week|this week|that|i will|we'll|we will|go ahead and|patient takes?|takes?)\b/gi, '');
    cleaned = cleaned.replace(/\b(stat|urgent|routine)\b/gi, '');

    // Remove phrases about pharmacies/locations that snuck in
    cleaned = cleaned.replace(/\b(?:to|at|send to|send that to)\s+(?:cvs|walgreens|costco|target|quest|labcorp|pharmacy|pharm)\b/gi, '');

    cleaned = cleaned.trim().replace(/\s+/g, ' ');

    // Filter out common false positives and pharmacy-related words
    const falsePositives = ['to', 'at', 'send', 'get', 'order', 'a', 'the', 'is', 'was', 'that', 'cvs', 'walgreens', 'costco', 'target', 'walmart', 'pharmacy', 'pharm', 'takes', 'patient', ''];
    if (falsePositives.includes(cleaned.toLowerCase()) || cleaned.length < 2) {
      return '';
    }

    // If it contains pharmacy names, likely not a lab test
    if (/\b(cvs|walgreens|costco|target|walmart|kroger|pharmacy)\b/i.test(cleaned)) {
      return '';
    }

    // If it's just a single letter or very short and not a known abbreviation, filter it
    if (cleaned.length < 2 || (cleaned.length === 2 && !/^(a1c|cbc|cmp|bmp|tsh|lft|ldl|hdl)$/i.test(cleaned))) {
      return '';
    }

    // Filter out common medication name patterns (they should not be labs)
    if (/\b(metformin|lisinopril|amlodipine|atorvastatin|losartan|simvastatin|omeprazole|levothyroxine|gabapentin|hydrochlorothiazide|sertraline|ibuprofen|prednisone|insulin|albuterol|furosemide)\b/i.test(cleaned)) {
      return '';
    }

    // Capitalize properly
    return cleaned
      .split(' ')
      .map(word => {
        // Keep acronyms uppercase
        if (word.toUpperCase() === word && word.length <= 4) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  /**
   * Helper: Split combined lab names into individual tests
   * e.g., "hemoglobin A1C lipid panel CMP" → ["Hemoglobin A1C", "Lipid Panel", "CMP"]
   */
  private splitCombinedLabNames(text: string): string[] {
    const found: string[] = [];
    let remaining = text;

    // Try to match known lab tests from longest to shortest
    for (const labTest of this.commonLabs) {
      const regex = new RegExp(`\\b${labTest}\\b`, 'gi');
      const match = remaining.match(regex);

      if (match) {
        found.push(this.normalizeTestName(labTest));
        // Remove matched test from remaining text
        remaining = remaining.replace(regex, '').trim();
      }
    }

    // If we found multiple tests, return them
    if (found.length > 1) {
      return found;
    }

    // If we only found one or none, return the original normalized text
    const normalized = this.normalizeTestName(text);
    return normalized ? [normalized] : [];
  }

  /**
   * Helper: Get context around a match
   */
  private getContext(text: string, index: number, contextLength: number = 100): string {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + contextLength);
    return text.substring(start, end);
  }

  /**
   * Helper: Convert spelled-out numbers to digits
   */
  private convertSpelledNumber(text: string): string {
    const numbers: Record<string, string> = {
      'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
      'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
      'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
      'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20',
      'twenty-five': '25', 'thirty': '30', 'forty': '40', 'fifty': '50',
      'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90',
      'one hundred': '100', 'two hundred': '200', 'three hundred': '300',
      'four hundred': '400', 'five hundred': '500', 'thousand': '1000'
    };

    let converted = text.toLowerCase();
    for (const [word, digit] of Object.entries(numbers)) {
      converted = converted.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
    }
    return converted;
  }

  /**
   * Helper: Extract dosage from context
   */
  private extractDosageFromContext(context: string): string | null {
    // First, convert spelled-out numbers to digits
    const converted = this.convertSpelledNumber(context);

    // Now try to match dosage patterns
    const dosageMatch = converted.match(/\b(\d+\s*(?:mg|mcg|g|ml|units?))\b/i);
    return dosageMatch ? dosageMatch[1] : null;
  }

  /**
   * Helper: Extract frequency
   */
  private extractFrequency(text: string): string | null {
    const patterns = [
      /\b(once daily|twice daily|three times daily|four times daily)\b/i,
      /\b(twice a day|two times a day|three times a day)\b/i,
      /\b(qd|bid|tid|qid|qhs|qam)\b/i,
      /\b(q\d+h)\b/i,
      /\b(\d+ times? (?:daily|per day|a day))\b/i,
      /\b(once|twice|daily|nightly|weekly|monthly)\b/i,
      /\b(as needed|prn|when needed)\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let freq = match[1];
        // Normalize common variations
        if (freq.toLowerCase().includes('twice')) return 'twice daily';
        if (freq.toLowerCase().includes('once')) return 'once daily';
        if (freq.toLowerCase().includes('three')) return 'three times daily';
        return freq;
      }
    }

    return null;
  }

  /**
   * Helper: Extract route
   */
  private extractRoute(text: string): string | null {
    const lowerText = text.toLowerCase();

    // Check for explicit mentions first (more specific)
    if (lowerText.includes('by mouth') || lowerText.includes('orally') || /\bpo\b/i.test(text)) {
      return 'PO';
    }

    if (/\biv\b/i.test(text)) return 'IV';
    if (/\bim\b/i.test(text)) return 'IM';
    if (/\bsc\b|\bsq\b|subcutaneous/i.test(text)) return 'SC';
    if (lowerText.includes('topical')) return 'Topical';
    if (lowerText.includes('ophthalmic')) return 'Ophthalmic';
    if (lowerText.includes('otic')) return 'Otic';
    if (lowerText.includes('rectal')) return 'Rectal';
    if (lowerText.includes('vaginal')) return 'Vaginal';
    if (lowerText.includes('inhaled')) return 'Inhaled';
    if (lowerText.includes('nasal')) return 'Nasal';

    return null;
  }

  /**
   * Helper: Extract duration
   */
  private extractDuration(text: string): string | undefined {
    const durationMatch = text.match(/\b(?:for|x)\s*(\d+\s*(?:day|week|month)s?)\b/i);
    return durationMatch ? durationMatch[1] : undefined;
  }

  /**
   * Helper: Extract quantity
   */
  private extractQuantity(text: string): string | undefined {
    // Convert spelled numbers first
    const converted = this.convertSpelledNumber(text);

    const patterns = [
      /\b(?:dispense|disp)\s+(\d+)\b/i,  // "dispense 30" or "disp 30"
      /\b(?:quantity|qty)\s*:?\s*(\d+)\b/i,  // "quantity 60" or "qty: 60"
      /\b#\s*(\d+)\b/i,  // "#30"
      /\b(\d+)\s+(?:tablets?|capsules?|pills?|vials?|bottles?|inhalers?|pens?)\b/i,  // "30 tablets"
      /\b(\d+)\s+day supply\b/i  // "90 day supply" or "ninety day supply"
    ];

    for (const pattern of patterns) {
      const match = converted.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  }

  /**
   * Helper: Extract refills
   */
  private extractRefills(text: string): string | undefined {
    const patterns = [
      /\b(\d+)\s*refills?\b/i,
      /\brefills?:\s*(\d+)/i,
      /\brefills?\s+(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  }

  /**
   * Helper: Detect urgency
   */
  private detectUrgency(text: string, index: number): 'routine' | 'urgent' | 'stat' {
    const context = this.getContext(text, index, 50).toLowerCase();

    for (const keyword of this.urgencyKeywords.stat) {
      if (context.includes(keyword)) return 'stat';
    }

    for (const keyword of this.urgencyKeywords.urgent) {
      if (context.includes(keyword)) return 'urgent';
    }

    return 'routine';
  }

  /**
   * Helper: Detect fasting requirement
   */
  private detectFasting(text: string, index: number): boolean {
    const context = this.getContext(text, index, 50).toLowerCase();
    return context.includes('fasting') || context.includes('fast');
  }

  /**
   * Helper: Check if this is a lab order (not a result)
   */
  private isLabOrder(context: string): boolean {
    const lowerContext = context.toLowerCase();

    // Check for order keywords
    const orderKeywords = ['order', 'get', 'draw', 'check', 'obtain', 'send', "let's", "we'll"];
    const hasOrderKeyword = orderKeywords.some(keyword => lowerContext.includes(keyword));

    // Check for result indicators (exclude these)
    const resultKeywords = ['of', 'is', 'was', 'shows', 'showed', 'result', 'value', 'level of'];
    const hasResultKeyword = resultKeywords.some(keyword => lowerContext.includes(keyword));

    return hasOrderKeyword && !hasResultKeyword;
  }

  /**
   * Helper: Calculate order date
   */
  private calculateOrderDate(urgency: 'routine' | 'urgent' | 'stat'): string {
    const today = new Date();

    switch (urgency) {
      case 'stat':
        return 'Today - STAT';
      case 'urgent':
        return 'Today';
      case 'routine':
      default:
        // Next business day
        const nextDay = new Date(today);
        nextDay.setDate(today.getDate() + 1);
        return nextDay.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
    }
  }

  /**
   * Helper: Extract pharmacy information
   */
  private extractPharmacy(text: string): string | undefined {
    const lowerText = text.toLowerCase();

    // Common pharmacy chains
    const pharmacyChains = [
      'CVS', 'Walgreens', 'Walmart', 'Rite Aid', 'Kroger', 'Safeway',
      'Target', 'Costco', 'Sam\'s Club', 'Publix', 'HEB', 'Albertsons'
    ];

    // Check for specific pharmacy mentions
    for (const pharmacy of pharmacyChains) {
      if (lowerText.includes(pharmacy.toLowerCase())) {
        return pharmacy;
      }
    }

    // Check for generic pharmacy patterns
    const patterns = [
      /(?:send to|to|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:pharmacy|pharm)/i,
      /pharmacy:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /mail order/i,
      /specialty pharmacy/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (pattern === /mail order/i) return 'Mail Order';
        if (pattern === /specialty pharmacy/i) return 'Specialty Pharmacy';
        return match[1] || 'Pharmacy';
      }
    }

    return undefined;
  }

  /**
   * Helper: Extract lab location
   */
  private extractLabLocation(text: string): string | undefined {
    const lowerText = text.toLowerCase();

    // Common lab locations
    const labLocations = [
      'Quest', 'LabCorp', 'BioReference', 'Mayo Clinic', 'ARUP'
    ];

    // Check for specific lab mentions
    for (const lab of labLocations) {
      if (lowerText.includes(lab.toLowerCase())) {
        return lab;
      }
    }

    // Check for location patterns
    const patterns = [
      /(?:send to|to|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:lab|laboratory)/i,
      /(?:lab|laboratory):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /in-office|in office/i,
      /hospital lab/i,
      /outpatient lab/i,
      /fasting lab/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (pattern === /in-office|in office/i) return 'In-Office';
        if (pattern === /hospital lab/i) return 'Hospital Lab';
        if (pattern === /outpatient lab/i) return 'Outpatient Lab';
        if (pattern === /fasting lab/i) return 'Fasting Lab';
        return match[1] || 'Lab';
      }
    }

    return undefined;
  }
}

// Export singleton instance
export const realtimeOrderExtractionService = new RealtimeOrderExtractionService();
