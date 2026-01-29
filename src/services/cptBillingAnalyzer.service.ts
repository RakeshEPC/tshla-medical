/**
 * CPT Billing Analyzer Service
 * Automatically suggests CPT codes based on visit complexity and time spent
 */

export type ComplexityLevel = 'minimal' | 'low' | 'moderate' | 'high';
export type RiskLevel = 'minimal' | 'low' | 'moderate' | 'high';

export interface ComplexityAnalysis {
  timeSpent: number | null; // in minutes
  problemCount: number;
  dataPoints: number; // labs, imaging, external records
  riskLevel: RiskLevel;
  complexityLevel: ComplexityLevel;
  medicationChanges: number;
  chronicConditions: number;
}

export interface CPTRecommendation {
  primaryCode: string;
  primaryDescription: string;
  timeRange: string;
  complexity: ComplexityLevel;
  alternativeCodes: Array<{
    code: string;
    description: string;
    reason: string;
  }>;
  supportingEvidence: {
    timeDocumented: boolean;
    chiefComplaintPresent: boolean;
    assessmentPresent: boolean;
    planPresent: boolean;
    followUpPresent: boolean;
  };
  confidenceScore: number; // 0-100
  mdmJustification: string[]; // Medical Decision Making justification points
}

export interface ICD10Suggestion {
  code: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ProcedureRecommendation {
  cptCode: string;
  description: string;
  modifier?: string; // e.g., "-25" for E/M with procedure
  note: string;
  confidence: 'high' | 'medium' | 'low';
}

export class CPTBillingAnalyzer {
  /**
   * Extract time spent from transcript
   * Looks for patterns like "spent 25 minutes", "40 minute visit", "total time 35 minutes"
   */
  extractTimeSpent(transcript: string): number | null {
    const timePatterns = [
      /(?:spent|took|total\s+time|visit\s+time|time\s+spent)\s+(?:was\s+)?(\d+)\s*(?:minutes?|mins?)/i,
      /(\d+)\s*(?:minute|min)\s+(?:visit|appointment|encounter)/i,
      /(?:face[\s-]?to[\s-]?face|counseling|spent)\s+(?:time\s+)?(?:of\s+)?(\d+)\s*(?:minutes?|mins?)/i,
      /total\s+(?:of\s+)?(\d+)\s*(?:minutes?|mins?)/i,
    ];

    for (const pattern of timePatterns) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const minutes = parseInt(match[1], 10);
        if (minutes >= 5 && minutes <= 120) {
          // Reasonable range for office visit
          return minutes;
        }
      }
    }

    return null;
  }

  /**
   * Count number of distinct problems/diagnoses addressed
   * IMPROVED: Better deduplication to prevent overcounting when same condition mentioned multiple times
   * FIX: Prevents keyword overcounting by grouping related terms
   */
  countProblems(assessment: string[]): number {
    if (!assessment || assessment.length === 0) return 0;

    const assessmentText = assessment.join(' ');
    const textLower = assessmentText.toLowerCase();

    // METHOD 1: Count ICD-10 codes (MOST RELIABLE - prioritize this)
    // Matches: E11.9, I10, E78.5, I25.2, I63.9, E13.10
    const icd10Pattern = /[A-Z]\d{2}\.?\d*/g;
    const icd10Codes = assessmentText.match(icd10Pattern) || [];
    const uniqueICD10 = [...new Set(icd10Codes)]; // Remove duplicates
    const icd10Count = uniqueICD10.length;

    // If we have ICD-10 codes, strongly prefer that count
    if (icd10Count > 0) {
      // Only allow other methods to increase count by max 1 (for uncoded symptoms)
      const baseCount = icd10Count;

      // Check for additional ACUTE symptoms not captured in ICD-10 codes
      // CHANGED: More restrictive - only count truly distinct acute symptoms
      let additionalConditions = 0;
      const countedSymptoms = new Set<string>(); // Track what we've counted

      // Look for symptom keywords that might not have ICD codes yet
      const symptomGroups = [
        { name: 'respiratory', keywords: ['shortness of breath', 'SOB', 'dyspnea'] },
        { name: 'chest-pain', keywords: ['chest pain'] },
        { name: 'throat-pain', keywords: ['throat pain'] },
        { name: 'abdominal-pain', keywords: ['abdominal pain'] },
        { name: 'headache', keywords: ['headache'] },
        { name: 'dizziness', keywords: ['dizziness', 'vertigo'] },
        { name: 'fatigue', keywords: ['fatigue', 'weakness'] },
        { name: 'gi-symptoms', keywords: ['nausea', 'vomiting', 'diarrhea'] }
      ];

      // Only count each symptom group once
      for (const group of symptomGroups) {
        for (const keyword of group.keywords) {
          if (textLower.includes(keyword.toLowerCase()) && !countedSymptoms.has(group.name)) {
            countedSymptoms.add(group.name);
            additionalConditions = Math.min(additionalConditions + 1, 1); // Max 1 additional
            break;
          }
        }
      }

      return baseCount + additionalConditions;
    }

    // If no ICD-10 codes, use other methods with better deduplication
    const countedProblems = new Set<string>(); // Track what we've counted to prevent duplicates

    // METHOD 2: Count bullet points/list items (each represents a distinct problem)
    // Matches: •, -, 1., 2., etc.
    const bulletPattern = /^[\s]*[•\-\*]|\d+\./gm;
    const bullets = assessmentText.match(bulletPattern) || [];

    // If we have bullet points, prefer that (doctor explicitly separated problems)
    if (bullets.length > 0) {
      return bullets.length;
    }

    // METHOD 3: Count distinct CONDITION GROUPS (not individual keywords)
    // IMPROVED: Only count each condition group ONCE even if mentioned multiple times
    const conditionGroups = [
      // Diabetes group - only count once even if multiple keywords match
      { name: 'diabetes', keywords: ['diabetes', 'diabetic', 'hyperglycemia', 'hypoglycemia', 'DKA', 'ketoacidosis', 'poorly controlled diabetes', 'uncontrolled diabetes'] },

      // Thyroid group - only count once
      { name: 'thyroid', keywords: ['hypothyroid', 'hyperthyroid', 'thyroid disorder', 'thyroid nodule', 'goiter', 'hashimoto', 'graves'] },

      // Hypertension group - only count once
      { name: 'hypertension', keywords: ['hypertension', 'HTN', 'high blood pressure', 'elevated blood pressure'] },

      // Lipid group - only count once
      { name: 'lipid', keywords: ['hyperlipidemia', 'HLD', 'dyslipidemia', 'cholesterol', 'high cholesterol', 'triglycerides', 'elevated ldl'] },

      // Coronary disease group - only count once
      { name: 'coronary', keywords: ['coronary disease', 'CAD', 'heart disease', 'myocardial infarction', 'MI', 'heart attack', 'acute coronary'] },

      // Heart failure group - only count once
      { name: 'heart-failure', keywords: ['heart failure', 'CHF', 'cardiomyopathy', 'congestive heart failure'] },

      // Respiratory group - only count once
      { name: 'respiratory', keywords: ['COPD', 'emphysema', 'chronic bronchitis', 'asthma', 'chronic obstructive'] },

      // Obesity/metabolic - only count once
      { name: 'obesity', keywords: ['obesity', 'metabolic syndrome', 'overweight', 'BMI elevated'] },

      // Kidney disease - only count once
      { name: 'kidney', keywords: ['chronic kidney disease', 'CKD', 'renal insufficiency', 'nephropathy', 'decreased gfr'] },

      // Mental health - only count once
      { name: 'mental-health', keywords: ['depression', 'anxiety', 'PTSD', 'depressive disorder'] },

      // Symptoms - count each distinct symptom GROUP (not individual words)
      { name: 'respiratory-symptoms', keywords: ['shortness of breath', 'SOB', 'dyspnea'] },
      { name: 'chest-pain', keywords: ['chest pain', 'angina'] },
      { name: 'throat-pain', keywords: ['throat pain'] },
      { name: 'neuropathy', keywords: ['neuropathy', 'peripheral neuropathy'] },
      { name: 'retinopathy', keywords: ['retinopathy', 'diabetic retinopathy'] },
    ];

    // Check which condition groups are present - only count each group ONCE
    for (const group of conditionGroups) {
      for (const keyword of group.keywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          // Add to set - automatically prevents duplicates
          countedProblems.add(group.name);
          break; // Stop checking this group once matched
        }
      }
    }

    // Return the count of unique problem groups
    // Use Math.max with assessment.length to ensure we don't undercount
    return Math.max(countedProblems.size, Math.min(assessment.length, 1));
  }

  /**
   * Count data points reviewed, ordered, or analyzed
   * IMPROVED: Better deduplication between plan and transcript to prevent double-counting
   * FIX: Previously counted same test twice if mentioned in both plan and transcript
   *
   * Data categories (per CMS guidelines):
   * - Each unique test/imaging = 1 point
   * - External records reviewed = 2 points
   * - Independent historian = 1 point
   * - Provider coordination = 1 point
   */
  countDataPoints(plan: string[], transcript: string): number {
    if (!plan || plan.length === 0) return 0;

    // Search BOTH plan and transcript but deduplicate
    const planText = plan.join(' ').toLowerCase();
    const transcriptLower = transcript.toLowerCase();
    const combinedText = planText + ' ' + transcriptLower;

    let dataPoints = 0;

    // CATEGORY 1: Laboratory Tests Ordered (+1 each, unique)
    // IMPROVED: Use Set to automatically deduplicate if mentioned multiple times
    const labTests = [
      // Metabolic panels (group related terms to prevent double counting)
      { name: 'cmp', aliases: ['cmp', 'comprehensive metabolic panel', 'comprehensive metabolic'] },
      { name: 'bmp', aliases: ['bmp', 'basic metabolic panel', 'basic metabolic'] },

      // Blood counts
      { name: 'cbc', aliases: ['cbc', 'complete blood count'] },

      // Diabetes tests
      { name: 'a1c', aliases: ['a1c', 'hemoglobin a1c', 'hba1c', 'glycohemoglobin'] },
      { name: 'glucose', aliases: ['glucose', 'blood glucose', 'fasting glucose'] },

      // Thyroid tests
      { name: 'tsh', aliases: ['tsh', 'thyroid stimulating hormone'] },
      { name: 'thyroid-panel', aliases: ['thyroid panel', 'free t4', 'free t3', 't4', 't3'] },

      // Lipid tests
      { name: 'lipid-panel', aliases: ['lipid panel', 'cholesterol', 'ldl', 'hdl', 'triglycerides'] },

      // Liver function
      { name: 'lft', aliases: ['liver panel', 'lft', 'liver function', 'ast', 'alt', 'bilirubin'] },

      // Kidney function
      { name: 'kidney-function', aliases: ['kidney function', 'creatinine', 'bun', 'gfr', 'renal function'] },
      { name: 'urine-albumin', aliases: ['microalbumin', 'urine albumin', 'protein/creatinine ratio', 'uacr'] },

      // Vitamins and minerals
      { name: 'vitamin-d', aliases: ['vitamin d', '25-oh vitamin d'] },
      { name: 'b12', aliases: ['b12', 'vitamin b12'] },
      { name: 'iron', aliases: ['iron', 'ferritin', 'iron panel'] },

      // Coagulation
      { name: 'coagulation', aliases: ['ptt', 'pt', 'inr', 'coagulation'] },

      // Urine tests
      { name: 'urinalysis', aliases: ['urinalysis', 'ua', 'urine culture'] }
    ];

    const labsFound = new Set<string>();
    for (const labGroup of labTests) {
      // Check if ANY alias from this group is mentioned
      for (const alias of labGroup.aliases) {
        if (combinedText.includes(alias.toLowerCase())) {
          labsFound.add(labGroup.name); // Add the GROUP name, not the alias
          break; // Stop checking other aliases for this group
        }
      }
    }
    dataPoints += labsFound.size;

    // CATEGORY 2: Imaging Studies Ordered (+1 each, unique)
    // IMPROVED: Group related imaging terms to prevent double counting
    const imagingTests = [
      { name: 'chest-xray', aliases: ['chest x-ray', 'cxr', 'chest xray'] },
      { name: 'xray', aliases: ['x-ray', 'xray', 'radiograph'] },
      { name: 'ct', aliases: ['ct scan', 'ct', 'cat scan', 'computed tomography'] },
      { name: 'mri', aliases: ['mri', 'magnetic resonance', 'magnetic resonance imaging'] },
      { name: 'ultrasound', aliases: ['ultrasound', 'us', 'sonogram', 'ultrasonography'] },
      { name: 'dexa', aliases: ['dexa', 'bone density', 'bone densitometry'] },
      { name: 'echo', aliases: ['echo', 'echocardiogram', 'cardiac echo', 'cardiac ultrasound'] },
      { name: 'ekg', aliases: ['ekg', 'ecg', 'electrocardiogram'] },
      { name: 'stress-test', aliases: ['stress test', 'nuclear stress', 'exercise stress test'] },
      { name: 'doppler', aliases: ['doppler', 'vascular study', 'vascular ultrasound'] },
      { name: 'mammogram', aliases: ['mammogram', 'breast imaging'] }
    ];

    const imagingFound = new Set<string>();
    for (const imgGroup of imagingTests) {
      // Check if ANY alias from this group is mentioned
      for (const alias of imgGroup.aliases) {
        if (combinedText.includes(alias.toLowerCase())) {
          imagingFound.add(imgGroup.name); // Add the GROUP name, not the alias
          break; // Stop checking other aliases for this group
        }
      }
    }
    dataPoints += imagingFound.size;

    // CATEGORY 3: External Records Reviewed (+2 points)
    const recordsPatterns = [
      // Hospital records
      /reviewed?\s+(?:hospital|inpatient)\s+records?/i,
      /reviewed?\s+(?:discharge|admission)\s+(?:summary|records?)/i,
      /records?\s+from\s+(?:hospital|admission|recent\s+hospitalization)/i,
      /went\s+over\s+(?:hospital|admission)\s+(?:records?|summary)/i,
      /hospital\s+course\s+reviewed/i,

      // Outside provider records
      /reviewed?\s+(?:outside|external|previous)\s+records?/i,
      /records?\s+from\s+(?:cardiologist|specialist|other\s+provider)/i,
      /obtained\s+records?\s+from/i,

      // Previous labs/studies
      /reviewed?\s+(?:prior|previous|old)\s+(?:labs?|studies|imaging)/i,
      /compared?\s+(?:to|with)\s+(?:prior|previous)\s+(?:labs?|imaging)/i,
      /labs?\s+from\s+(?:hospital|last\s+visit|previous)/i
    ];

    let hasExternalRecords = false;
    for (const pattern of recordsPatterns) {
      if (pattern.test(combinedText)) {
        hasExternalRecords = true;
        break;
      }
    }
    if (hasExternalRecords) {
      dataPoints += 2; // External records = 2 points per CMS
    }

    // CATEGORY 4: Provider Coordination (+1 point)
    const coordinationPatterns = [
      // Discussed with other providers
      /discussed?\s+with\s+(?:primary|PCP|cardiologist|endocrinologist|specialist)/i,
      /spoke\s+(?:to|with)\s+(?:doctor|physician|provider|specialist)/i,
      /coordinated?\s+(?:with|care)/i,
      /consulted\s+with/i,
      /called\s+(?:doctor|physician|specialist)/i,

      // Team-based care
      /(?:multidisciplinary|team)\s+(?:approach|discussion|meeting)/i,
      /care\s+coordination/i
    ];

    let hasCoordination = false;
    for (const pattern of coordinationPatterns) {
      if (pattern.test(combinedText)) {
        hasCoordination = true;
        break;
      }
    }
    if (hasCoordination) {
      dataPoints += 1;
    }

    // CATEGORY 5: Independent Historian (+1 point)
    const historianPatterns = [
      /history\s+(?:obtained|from)\s+(?:family|spouse|daughter|son)/i,
      /(?:wife|husband|daughter|son)\s+(?:reports|states)/i,
      /unable\s+to\s+provide\s+reliable\s+history/i,
      /history\s+limited\s+due\s+to/i
    ];

    let hasIndependentHistorian = false;
    for (const pattern of historianPatterns) {
      if (pattern.test(combinedText)) {
        hasIndependentHistorian = true;
        break;
      }
    }
    if (hasIndependentHistorian) {
      dataPoints += 1;
    }

    // CATEGORY 6: Specific Lab Values Documented (+1)
    // If specific values mentioned (not just ordered)
    const labValuePatterns = [
      /A1C\s+(?:was|of|=|:)\s*\d+\.?\d*/i,
      /(?:glucose|blood\s+sugar)\s+(?:was|of|=|:)?\s*\d+/i,
      /TSH\s+(?:was|of|=|:)\s*\d+\.?\d*/i,
      /creatinine\s+(?:was|of|=|:)\s*\d+\.?\d*/i,
      /(?:cholesterol|LDL|HDL)\s+(?:was|of|=|:)\s*\d+/i
    ];

    let hasLabValues = false;
    for (const pattern of labValuePatterns) {
      if (pattern.test(combinedText)) {
        hasLabValues = true;
        break;
      }
    }
    if (hasLabValues) {
      dataPoints += 1; // Bonus for documenting actual values
    }

    return dataPoints;
  }

  /**
   * Assess clinical risk level based on:
   * - Medication complexity
   * - Acute/chronic conditions
   * - Recent hospitalizations/events
   * - Critical lab values
   * - Post-discharge status
   *
   * IMPROVED: Better deduplication to prevent overcounting when same event mentioned multiple times
   * Per CMS 2021 guidelines for MDM risk assessment
   */
  assessRiskLevel(
    medicationChanges: string[],
    assessment: string[],
    vitals: any,
    transcript: string  // NEW: Also search full transcript
  ): RiskLevel {
    let riskScore = 0;

    // Combine all text sources
    const assessmentText = assessment.join(' ');
    const medicationText = medicationChanges.join(' ');
    const combinedText = `${assessmentText} ${medicationText} ${transcript}`.toLowerCase();

    // Track what we've counted to prevent double-counting
    const countedRisks = new Set<string>();

    // CATEGORY 1: Recent Hospitalization (HIGH RISK +3, COUNT ONCE)
    const hospitalizationPatterns = [
      /admitted\s+(?:to\s+)?(?:the\s+)?hospital/i,
      /recent(?:ly)?\s+(?:admitted|hospitalized|hospitalization)/i,
      /discharged\s+(?:from\s+)?(?:hospital|the\s+hospital)/i,
      /status\s+post\s+(?:discharge|admission)/i,
      /post[\s-]?discharge/i,
      /(\d+)\s+days?\s+(?:ago|status\s+post)\s+discharge/i,
      /(\d+)\s+days?\s+(?:post|after)\s+(?:discharge|hospitalization)/i,
      /hospital\s+course/i,
      /during\s+(?:hospitalization|admission)/i
    ];

    let wasHospitalized = false;
    if (!countedRisks.has('hospitalization')) {
      for (const pattern of hospitalizationPatterns) {
        if (pattern.test(combinedText)) {
          wasHospitalized = true;
          riskScore += 3; // Recent hospitalization = HIGH risk
          countedRisks.add('hospitalization');
          break;
        }
      }
    }

    // CATEGORY 2: Post-Discharge Timing (Additional +2 if <7 days, COUNT ONCE)
    if (wasHospitalized && !countedRisks.has('post-discharge-timing')) {
      const daysMatches = [
        /discharged\s+(\d+)\s+days?\s+ago/i.exec(combinedText),
        /(\d+)\s+days?\s+(?:post|status\s+post)\s+discharge/i.exec(combinedText),
        /two\s+days?\s+(?:ago|status\s+post)/i.exec(combinedText)
      ];

      for (const match of daysMatches) {
        if (match) {
          const days = match[1] === 'two' ? 2 : parseInt(match[1] || '999');
          if (days <= 7) {
            riskScore += 2; // Post-discharge within 7 days = extra HIGH risk
            countedRisks.add('post-discharge-timing');
          }
          break;
        }
      }
    }

    // CATEGORY 3: Life-Threatening Events (HIGH RISK +3, but cap at +6 total for this category)
    // IMPROVED: Each EVENT TYPE is counted only once, max 2 different event types
    const acuteLifeThreateningEventGroups = [
      { name: 'cardiac', patterns: [
        /(?:recent|new|another)\s+(?:MI|myocardial\s+infarction|heart\s+attack)/i,
        /(?:had|with)\s+(?:another|new)\s+(?:MI|heart\s+attack)/i,
        /(?:STEMI|NSTEMI)/i,
        /(?:acute|unstable)\s+(?:coronary|angina)/i
      ]},
      { name: 'metabolic', patterns: [
        /(?:DKA|diabetic\s+ketoacidosis)/i,
        /(?:HHS|hyperosmolar)/i,
        /severe\s+hypoglycemia/i
      ]},
      { name: 'infection', patterns: [
        /(?:sepsis|septic\s+shock)/i
      ]},
      { name: 'neurologic', patterns: [
        /(?:recent|new)\s+stroke/i
      ]},
      { name: 'pulmonary', patterns: [
        /(?:PE|pulmonary\s+embolism)/i,
        /(?:COPD|asthma)\s+exacerbation/i,
        /respiratory\s+failure/i
      ]},
      { name: 'heart-failure', patterns: [
        /(?:CHF|heart\s+failure)\s+exacerbation/i
      ]},
      { name: 'renal', patterns: [
        /acute\s+kidney\s+injury/i
      ]}
    ];

    let lifeThreateningEventCount = 0;
    for (const eventGroup of acuteLifeThreateningEventGroups) {
      // Only check if we haven't already counted this event group
      if (!countedRisks.has(`acute-${eventGroup.name}`) && lifeThreateningEventCount < 2) {
        for (const pattern of eventGroup.patterns) {
          if (pattern.test(combinedText)) {
            riskScore += 3; // Life-threatening event = HIGH risk
            countedRisks.add(`acute-${eventGroup.name}`);
            lifeThreateningEventCount++;
            break; // Only count this event group once
          }
        }
      }
    }

    // CATEGORY 4: Medication Risk Assessment
    if (medicationChanges && medicationChanges.length > 0) {
      // High-risk medications
      const highRiskMeds = [
        'insulin', 'lantus', 'novolog', 'humalog', 'levemir',
        'warfarin', 'coumadin', 'anticoagulant',
        'chemotherapy', 'immunosuppressant'
      ];

      let hasHighRiskMed = false;
      for (const med of highRiskMeds) {
        if (new RegExp(med, 'i').test(medicationText)) {
          hasHighRiskMed = true;
          break;
        }
      }
      if (hasHighRiskMed) riskScore += 2;

      // New medication started
      const hasNewMed = /start|begin|initiate|add/i.test(medicationText);
      if (hasNewMed) riskScore += 1;

      // Multiple medication changes (3+)
      if (medicationChanges.length >= 3) {
        riskScore += 1;
      }
    }

    // CATEGORY 5: Chronic Disease Severity
    const severityIndicators = [
      /uncontrolled/i,
      /poorly\s+controlled/i,
      /refractory/i,
      /progressive/i,
      /advanced/i,
      /end[\s-]stage/i,
      /decompensated/i
    ];

    let hasSeverity = false;
    for (const pattern of severityIndicators) {
      if (pattern.test(combinedText)) {
        hasSeverity = true;
        break;
      }
    }
    if (hasSeverity) riskScore += 2;

    // CATEGORY 6: Multiple Chronic Conditions
    const chronicConditions = [
      'diabetes', 'diabetic',
      'hypertension', 'HTN',
      'heart failure', 'CHF',
      'coronary disease', 'CAD',
      'COPD', 'emphysema',
      'chronic kidney', 'CKD',
      'cancer', 'malignancy'
    ];

    const foundConditions = chronicConditions.filter(condition =>
      new RegExp(condition, 'i').test(combinedText)
    ).length;

    if (foundConditions >= 4) riskScore += 2;  // 4+ chronic = HIGH risk
    else if (foundConditions >= 3) riskScore += 1;  // 3 chronic = moderate risk

    // CATEGORY 7: Critical Lab Values
    const criticalLabPatterns = [
      { pattern: /A1C\s+(?:was|of|=|:)?\s*(\d+\.?\d*)/i, threshold: 10, critical: true },
      { pattern: /(?:glucose|blood\s+sugar)\s+(?:was|of|=|:)?\s*(\d+)/i, threshold: 400, critical: true },
      { pattern: /creatinine\s+(?:was|of|=|:)?\s*(\d+\.?\d*)/i, threshold: 2.0, critical: true }
    ];

    for (const lab of criticalLabPatterns) {
      const match = lab.pattern.exec(combinedText);
      if (match) {
        const value = parseFloat(match[1]);
        if (value >= lab.threshold) {
          riskScore += 2; // Critical lab value = HIGH risk
        }
      }
    }

    // CATEGORY 8: Vitals (from vitals object)
    if (vitals) {
      if (vitals.bloodSugar && parseInt(vitals.bloodSugar) > 300) riskScore += 1;
      if (vitals.a1c && parseFloat(vitals.a1c) > 10) riskScore += 2;
      if (vitals.systolic && parseInt(vitals.systolic) > 180) riskScore += 1;
      if (vitals.heartRate && (parseInt(vitals.heartRate) > 120 || parseInt(vitals.heartRate) < 50)) riskScore += 1;
    }

    // Determine risk level (Adjusted thresholds for new scoring)
    if (riskScore >= 8) return 'high';      // 8+ points = HIGH risk
    if (riskScore >= 5) return 'moderate';  // 5-7 points = MODERATE risk
    if (riskScore >= 2) return 'low';       // 2-4 points = LOW risk
    return 'minimal';                       // 0-1 points = MINIMAL risk
  }

  /**
   * Count medication changes from text
   * IMPROVED: Better deduplication to prevent counting same medication multiple times
   * Fixes Bug #4: Parse actual medication actions instead of array length
   */
  countMedicationChanges(medicationTexts: string[], transcript: string): number {
    if (!medicationTexts || medicationTexts.length === 0) {
      return 0;
    }

    const combinedText = medicationTexts.join(' ') + ' ' + transcript;
    const textLower = combinedText.toLowerCase();

    // Track unique medications that had changes - prevent double counting
    const medicationsWithChanges = new Set<string>();

    // List of common medication names to extract
    const commonMedications = [
      'metformin', 'lantus', 'novolog', 'humalog', 'tresiba', 'basaglar',
      'levemir', 'toujeo', 'fiasp', 'apidra', 'insulin',
      'levothyroxine', 'synthroid', 'armour thyroid', 'cytomel',
      'lisinopril', 'losartan', 'amlodipine', 'hydrochlorothiazide', 'hctz',
      'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin',
      'jardiance', 'farxiga', 'invokana',
      'ozempic', 'victoza', 'trulicity', 'mounjaro', 'wegovy',
      'glipizide', 'glyburide', 'glimepiride',
      'aspirin', 'plavix', 'eliquis', 'warfarin',
      'gabapentin', 'pregabalin', 'duloxetine',
    ];

    // Medication action patterns that indicate a change
    const actionVerbs = [
      'start', 'started', 'starting', 'begin', 'beginning', 'initiated', 'initiate',
      'stop', 'stopped', 'stopping', 'discontinue', 'discontinued', 'hold',
      'increase', 'increased', 'increasing', 'up', 'upped', 'raise', 'raised', 'titrate',
      'decrease', 'decreased', 'decreasing', 'lower', 'lowered', 'reduce', 'reduced', 'down',
      'adjust', 'adjusted', 'change', 'changed', 'modify', 'modified', 'switch', 'switched'
    ];

    // METHOD 1: Extract medication names associated with action verbs
    // This is the most reliable method - find action + medication pairs
    for (const med of commonMedications) {
      for (const action of actionVerbs) {
        // Check for "action + medication" pattern (e.g., "started Lantus", "increase Metformin")
        const pattern1 = new RegExp(`\\b${action}\\b.*?\\b${med}\\b`, 'gi');
        // Check for "medication + action" pattern (e.g., "Lantus was started", "Metformin increased")
        const pattern2 = new RegExp(`\\b${med}\\b.*?\\b${action}`, 'gi');

        if (pattern1.test(textLower) || pattern2.test(textLower)) {
          medicationsWithChanges.add(med);
          break; // Found a change for this medication, no need to check other actions
        }
      }
    }

    // METHOD 2: Look for dose specifications with medication names
    // Pattern: "medication dose unit" (e.g., "Lantus 10 units", "Metformin 500 mg")
    for (const med of commonMedications) {
      const dosePattern = new RegExp(`\\b${med}\\b[\\s,]+\\d+\\s*(?:mg|mcg|units?|ml)`, 'gi');
      if (dosePattern.test(combinedText)) {
        // Only add if we found an action verb near it
        const contextPattern = new RegExp(`(?:${actionVerbs.join('|')}).*?\\b${med}\\b|\\b${med}\\b.*?(?:${actionVerbs.join('|')})`, 'gi');
        if (contextPattern.test(textLower)) {
          medicationsWithChanges.add(med);
        }
      }
    }

    // METHOD 3: Fallback - extract medications from generic patterns
    // Only use this if we haven't found many medications yet
    if (medicationsWithChanges.size < 2) {
      // Look for patterns like "start [medication name] [dose]"
      const genericPattern = /(?:start|stop|increase|decrease|adjust|change)\s+(?:on\s+)?([a-z]{4,20})\s+\d+\s*(?:mg|mcg|units?|ml)/gi;
      const genericMatches = combinedText.matchAll(genericPattern);

      for (const match of genericMatches) {
        const medicationName = match[1].toLowerCase().trim();
        // Filter out common non-medication words
        if (!['some', 'with', 'from', 'your', 'their', 'this', 'that'].includes(medicationName)) {
          medicationsWithChanges.add(medicationName);
        }
      }
    }

    // BONUS: Add 1 for complex insulin regimen (MDI, pump settings, etc.)
    // This counts as an additional medication management complexity
    const insulinPatterns = [
      /basal[\s-]bolus/i,
      /multiple\s+daily\s+injections?/i,
      /\bMDI\b/i,
      /pump\s+settings?/i,
      /carb\s+ratio/i,
      /correction\s+factor/i,
      /insulin[\s-]to[\s-]carb/i,
    ];

    let hasComplexInsulin = false;
    for (const pattern of insulinPatterns) {
      if (pattern.test(textLower)) {
        hasComplexInsulin = true;
        break;
      }
    }

    // Calculate final count
    let changeCount = medicationsWithChanges.size;

    // Add bonus for complex insulin management (only if we also have insulin changes)
    if (hasComplexInsulin && (medicationsWithChanges.has('insulin') ||
                               medicationsWithChanges.has('lantus') ||
                               medicationsWithChanges.has('novolog') ||
                               medicationsWithChanges.has('humalog'))) {
      changeCount += 1; // Bonus for complex insulin management
    }

    // Ensure we count at least 1 if there's any medication text provided
    // But don't use the array length anymore - that was the bug!
    changeCount = Math.max(changeCount, medicationTexts.length > 0 ? 1 : 0);

    return changeCount;
  }

  /**
   * Determine overall complexity level
   */
  determineComplexity(analysis: ComplexityAnalysis): ComplexityLevel {
    let complexityScore = 0;

    // Problem count contribution
    if (analysis.problemCount >= 3) complexityScore += 3;
    else if (analysis.problemCount >= 2) complexityScore += 2;
    else if (analysis.problemCount >= 1) complexityScore += 1;

    // Data points contribution
    if (analysis.dataPoints >= 4) complexityScore += 3;
    else if (analysis.dataPoints >= 2) complexityScore += 2;
    else if (analysis.dataPoints >= 1) complexityScore += 1;

    // Risk level contribution
    const riskMap: Record<RiskLevel, number> = {
      minimal: 0,
      low: 1,
      moderate: 2,
      high: 3,
    };
    complexityScore += riskMap[analysis.riskLevel];

    // Medication changes contribution
    if (analysis.medicationChanges >= 3) complexityScore += 2;
    else if (analysis.medicationChanges >= 2) complexityScore += 1;

    // Determine final complexity
    if (complexityScore >= 8) return 'high';
    if (complexityScore >= 5) return 'moderate';
    if (complexityScore >= 2) return 'low';
    return 'minimal';
  }

  /**
   * Analyze transcript and extracted info for complexity
   */
  analyzeComplexity(
    transcript: string,
    extractedInfo: {
      assessment?: string[];
      plan?: string[];
      medicationChanges?: string[];
      vitals?: any;
      currentMedications?: string[];
    }
  ): ComplexityAnalysis {
    const timeSpent = this.extractTimeSpent(transcript);
    const problemCount = this.countProblems(extractedInfo.assessment || []);
    const dataPoints = this.countDataPoints(extractedInfo.plan || [], transcript);
    const medicationChanges = this.countMedicationChanges(extractedInfo.medicationChanges || [], transcript);
    const riskLevel = this.assessRiskLevel(
      extractedInfo.medicationChanges || [],
      extractedInfo.assessment || [],
      extractedInfo.vitals,
      transcript
    );

    // Count chronic conditions
    const assessmentText = (extractedInfo.assessment || []).join(' ').toLowerCase();
    const chronicConditions = [
      /diabetes/i,
      /hypertension/i,
      /thyroid/i,
      /copd/i,
      /asthma/i,
      /heart\s+disease/i,
      /cancer/i,
    ].filter((pattern) => pattern.test(assessmentText)).length;

    const analysis: ComplexityAnalysis = {
      timeSpent,
      problemCount,
      dataPoints,
      riskLevel,
      medicationChanges,
      chronicConditions,
      complexityLevel: 'minimal', // Will be determined next
    };

    analysis.complexityLevel = this.determineComplexity(analysis);

    return analysis;
  }

  /**
   * Assess if E/M service is significant and separately identifiable from a procedure
   * Per CMS guidelines for modifier -25
   *
   * Returns whether E/M is significant enough to bill separately from procedure
   */
  assessEMSignificance(
    analysis: ComplexityAnalysis,
    hasProcedure: boolean
  ): { isSignificant: boolean; reason: string; suggestedApproach: string } {
    // If no procedure, this assessment doesn't apply
    if (!hasProcedure) {
      return {
        isSignificant: true,
        reason: 'No procedure detected',
        suggestedApproach: 'Bill E/M normally'
      };
    }

    // Check for indicators of significant, separately identifiable E/M
    const significanceScore = {
      multipleProblems: analysis.problemCount >= 2, // Multiple problems beyond procedure
      medicationChanges: analysis.medicationChanges >= 1, // Med changes unrelated to procedure
      chronicManagement: analysis.chronicConditions >= 2, // Managing chronic conditions
      moderateRisk: analysis.riskLevel === 'moderate' || analysis.riskLevel === 'high', // Clinical complexity
      substantialData: analysis.dataPoints >= 3 // Reviewing substantial data
    };

    const significantFactors = Object.values(significanceScore).filter(v => v).length;

    // SIGNIFICANT E/M (bill E/M with -25):
    // Need at least 2 factors indicating substantial work beyond the procedure
    if (significantFactors >= 2) {
      return {
        isSignificant: true,
        reason: `Significant E/M work beyond procedure: ${Object.entries(significanceScore)
          .filter(([_, v]) => v)
          .map(([k]) => k)
          .join(', ')}`,
        suggestedApproach: 'Bill E/M code with modifier -25 + procedure code'
      };
    }

    // MINIMAL E/M (procedure-focused visit):
    // Only 0-1 factors, visit focused primarily on procedure
    return {
      isSignificant: false,
      reason: `Visit appears procedure-focused with minimal separate E/M (only ${significantFactors} significant factor(s))`,
      suggestedApproach: 'Bill 99211 + procedure, or procedure only if no separate E/M performed'
    };
  }

  /**
   * Suggest CPT E&M codes based on analysis
   */
  suggestCPTCodes(
    analysis: ComplexityAnalysis,
    hasChiefComplaint: boolean,
    hasAssessment: boolean,
    hasPlan: boolean,
    hasProcedure: boolean = false
  ): CPTRecommendation {
    let primaryCode = '99213';
    let primaryDescription = 'Office/Outpatient Visit, Established Patient (20-29 min)';
    let timeRange = '20-29 minutes';
    let confidenceScore = 70;
    const alternativeCodes: Array<{
      code: string;
      description: string;
      reason: string;
    }> = [];

    // CRITICAL: If procedure detected, assess E/M significance first
    const emSignificance = this.assessEMSignificance(analysis, hasProcedure);

    // If E/M is NOT significant (procedure-focused visit), suggest 99211
    if (hasProcedure && !emSignificance.isSignificant) {
      primaryCode = '99211';
      primaryDescription = 'Office/Outpatient Visit, Established Patient (Minimal)';
      timeRange = 'Procedure-focused visit';
      confidenceScore = 70;

      alternativeCodes.push({
        code: 'Procedure only',
        description: 'Bill procedure code only without E/M',
        reason: 'If no separate E/M service was performed beyond procedure'
      });

      // Build MDM justification for 99211
      const mdmJustification: string[] = [];
      mdmJustification.push(`⚠️ PROCEDURE-FOCUSED VISIT`);
      mdmJustification.push(`Reason: ${emSignificance.reason}`);
      mdmJustification.push(`Recommendation: ${emSignificance.suggestedApproach}`);
      mdmJustification.push(`Problems addressed: ${analysis.problemCount}`);
      mdmJustification.push(`Data reviewed/ordered: ${analysis.dataPoints} items`);
      mdmJustification.push(`Risk level: ${analysis.riskLevel.toUpperCase()}`);
      mdmJustification.push(`Medication changes: ${analysis.medicationChanges}`);

      return {
        primaryCode,
        primaryDescription,
        timeRange,
        complexity: 'minimal',
        alternativeCodes,
        supportingEvidence: {
          timeDocumented: analysis.timeSpent !== null,
          chiefComplaintPresent: hasChiefComplaint,
          assessmentPresent: hasAssessment,
          planPresent: hasPlan,
          followUpPresent: true,
        },
        confidenceScore,
        mdmJustification,
      };
    }

    // Time-based determination (preferred method)
    if (analysis.timeSpent !== null) {
      if (analysis.timeSpent >= 40 && analysis.timeSpent <= 54) {
        primaryCode = '99215';
        primaryDescription = 'Office/Outpatient Visit, Established Patient (40-54 min)';
        timeRange = '40-54 minutes';
        confidenceScore = 95;
      } else if (analysis.timeSpent >= 30 && analysis.timeSpent <= 39) {
        primaryCode = '99214';
        primaryDescription = 'Office/Outpatient Visit, Established Patient (30-39 min)';
        timeRange = '30-39 minutes';
        confidenceScore = 95;
      } else if (analysis.timeSpent >= 20 && analysis.timeSpent <= 29) {
        primaryCode = '99213';
        primaryDescription = 'Office/Outpatient Visit, Established Patient (20-29 min)';
        timeRange = '20-29 minutes';
        confidenceScore = 95;
      } else if (analysis.timeSpent >= 10 && analysis.timeSpent <= 19) {
        primaryCode = '99212';
        primaryDescription = 'Office/Outpatient Visit, Established Patient (10-19 min)';
        timeRange = '10-19 minutes';
        confidenceScore = 90;
      } else if (analysis.timeSpent >= 55) {
        primaryCode = '99215';
        primaryDescription = 'Office/Outpatient Visit, Established Patient (40-54 min)';
        timeRange = '40-54 minutes (55+ minutes documented)';
        confidenceScore = 90;
        alternativeCodes.push({
          code: '99215 + prolonged services',
          description: 'Consider adding prolonged service code (99417)',
          reason: 'Visit exceeded 54 minutes',
        });
      }
    } else {
      // Complexity-based determination (when time not documented)
      if (analysis.complexityLevel === 'high') {
        primaryCode = '99215';
        primaryDescription = 'Office/Outpatient Visit, Established Patient (High Complexity)';
        timeRange = 'Time not documented - complexity-based';
        confidenceScore = 75;
      } else if (analysis.complexityLevel === 'moderate') {
        primaryCode = '99214';
        primaryDescription = 'Office/Outpatient Visit, Established Patient (Moderate Complexity)';
        timeRange = 'Time not documented - complexity-based';
        confidenceScore = 70;
      } else if (analysis.complexityLevel === 'low') {
        primaryCode = '99213';
        primaryDescription = 'Office/Outpatient Visit, Established Patient (Low Complexity)';
        timeRange = 'Time not documented - complexity-based';
        confidenceScore = 65;
      } else {
        primaryCode = '99212';
        primaryDescription =
          'Office/Outpatient Visit, Established Patient (Minimal Complexity)';
        timeRange = 'Time not documented - complexity-based';
        confidenceScore = 60;
      }
    }

    // Build alternative codes
    if (primaryCode === '99215') {
      alternativeCodes.push({
        code: '99214',
        description: 'If complexity reassessed as moderate',
        reason: 'Conservative coding option',
      });
    } else if (primaryCode === '99214') {
      alternativeCodes.push({
        code: '99215',
        description: 'If time >40 min or higher complexity documented',
        reason: 'Higher level if additional counseling documented',
      });
      alternativeCodes.push({
        code: '99213',
        description: 'If time <30 min or lower complexity',
        reason: 'Conservative coding option',
      });
    } else if (primaryCode === '99213') {
      alternativeCodes.push({
        code: '99214',
        description: 'If time 30-39 min or moderate complexity',
        reason: 'Consider if additional work documented',
      });
    }

    // Build MDM justification
    const mdmJustification: string[] = [];
    mdmJustification.push(`Problems addressed: ${analysis.problemCount}`);
    mdmJustification.push(`Data reviewed/ordered: ${analysis.dataPoints} items`);
    mdmJustification.push(`Risk level: ${analysis.riskLevel.toUpperCase()}`);
    if (analysis.medicationChanges > 0) {
      mdmJustification.push(`Medication changes: ${analysis.medicationChanges}`);
    }
    if (analysis.chronicConditions > 0) {
      mdmJustification.push(`Chronic conditions managed: ${analysis.chronicConditions}`);
    }

    return {
      primaryCode,
      primaryDescription,
      timeRange,
      complexity: analysis.complexityLevel,
      alternativeCodes,
      supportingEvidence: {
        timeDocumented: analysis.timeSpent !== null,
        chiefComplaintPresent: hasChiefComplaint,
        assessmentPresent: hasAssessment,
        planPresent: hasPlan,
        followUpPresent: true, // Assume follow-up is generally documented
      },
      confidenceScore,
      mdmJustification,
    };
  }

  /**
   * Suggest ICD-10 codes based on assessment
   */
  suggestICD10Codes(assessment: string[]): ICD10Suggestion[] {
    if (!assessment || assessment.length === 0) {
      return [];
    }

    const suggestions: ICD10Suggestion[] = [];
    const assessmentText = assessment.join(' ').toLowerCase();

    // Common endocrine conditions
    const icd10Map: Record<
      string,
      { pattern: RegExp; code: string; description: string; confidence: 'high' | 'medium' | 'low' }
    > = {
      diabetes_t2: {
        pattern: /type\s*2\s*diabetes/i,
        code: 'E11.9',
        description: 'Type 2 Diabetes Mellitus without complications',
        confidence: 'high',
      },
      diabetes_t2_uncontrolled: {
        pattern: /(?:uncontrolled|poorly\s+controlled).*?(?:type\s*2\s*)?diabetes/i,
        code: 'E11.65',
        description: 'Type 2 Diabetes Mellitus with hyperglycemia',
        confidence: 'high',
      },
      hypothyroid: {
        pattern: /hypothyroid/i,
        code: 'E03.9',
        description: 'Hypothyroidism, unspecified',
        confidence: 'high',
      },
      hyperthyroid: {
        pattern: /hyperthyroid|graves/i,
        code: 'E05.90',
        description: 'Thyrotoxicosis, unspecified',
        confidence: 'high',
      },
      nausea_vomiting: {
        pattern: /nausea.*?vomiting|vomiting.*?nausea/i,
        code: 'R11.2',
        description: 'Nausea with vomiting',
        confidence: 'high',
      },
      nausea: {
        pattern: /nausea/i,
        code: 'R11.0',
        description: 'Nausea',
        confidence: 'medium',
      },
      hypertension: {
        pattern: /hypertension|high\s+blood\s+pressure/i,
        code: 'I10',
        description: 'Essential (primary) hypertension',
        confidence: 'high',
      },
      obesity: {
        pattern: /obesity|obese/i,
        code: 'E66.9',
        description: 'Obesity, unspecified',
        confidence: 'medium',
      },
      prediabetes: {
        pattern: /prediabetes|pre-diabetes/i,
        code: 'R73.03',
        description: 'Prediabetes',
        confidence: 'high',
      },
    };

    // Check each pattern
    for (const [key, mapping] of Object.entries(icd10Map)) {
      if (mapping.pattern.test(assessmentText)) {
        // Avoid duplicates (e.g., don't add both diabetes_t2 and diabetes_t2_uncontrolled)
        if (
          key === 'diabetes_t2' &&
          suggestions.some((s) => s.code.startsWith('E11.'))
        ) {
          continue;
        }
        if (key === 'nausea' && suggestions.some((s) => s.code === 'R11.2')) {
          continue;
        }

        suggestions.push({
          code: mapping.code,
          description: mapping.description,
          confidence: mapping.confidence,
        });
      }
    }

    return suggestions;
  }

  /**
   * Detect in-office procedures performed during visit
   * Identifies procedures like thyroid ultrasound, FNA, EKG, etc.
   */
  detectInOfficeProcedures(
    transcript: string,
    plan: string[],
    assessment: string[]
  ): ProcedureRecommendation[] {
    const procedures: ProcedureRecommendation[] = [];

    const combinedText = `${transcript} ${plan.join(' ')} ${assessment.join(' ')}`.toLowerCase();

    // PROCEDURE 1: Thyroid Ultrasound (76536)
    const thyroidUSPatterns = [
      /thyroid\s+(?:ultrasound|US|sonogram)/i,
      /ultrasound\s+(?:of\s+)?(?:the\s+)?thyroid/i,
      /thyroid\s+imaging/i,
      /US\s+thyroid/i,
      /performed\s+(?:a\s+)?thyroid\s+scan/i,
    ];

    let hasThyroidUS = false;
    for (const pattern of thyroidUSPatterns) {
      if (pattern.test(combinedText)) {
        hasThyroidUS = true;
        break;
      }
    }

    if (hasThyroidUS) {
      procedures.push({
        cptCode: '76536',
        description: 'Ultrasound, soft tissues of head and neck (thyroid)',
        modifier: '-25',
        note: 'If performed with E/M visit, add modifier -25 to E/M code',
        confidence: 'high',
      });
    }

    // PROCEDURE 2: Fine Needle Aspiration (FNA) - Thyroid (10005-10012)
    const fnaPatterns = [
      /fine\s+needle\s+aspiration/i,
      /\bFNA\b/i,
      /thyroid\s+biopsy/i,
      /needle\s+biopsy\s+(?:of\s+)?(?:the\s+)?thyroid/i,
      /aspiration\s+(?:of\s+)?thyroid\s+nodule/i,
    ];

    let hasFNA = false;
    for (const pattern of fnaPatterns) {
      if (pattern.test(combinedText)) {
        hasFNA = true;
        break;
      }
    }

    if (hasFNA) {
      // Check if imaging guidance mentioned
      const hasImagingGuidance = /(?:ultrasound|US)[\s-]?guided/i.test(combinedText);

      if (hasImagingGuidance) {
        procedures.push({
          cptCode: '10005',
          description: 'Fine needle aspiration biopsy with imaging guidance (first lesion)',
          modifier: '-25',
          note: 'Use 10006 for each additional lesion. Add modifier -25 to E/M if same day.',
          confidence: 'high',
        });
      } else {
        procedures.push({
          cptCode: '10021',
          description: 'Fine needle aspiration without imaging guidance (first lesion)',
          modifier: '-25',
          note: 'Use 10004-10012 series if imaging guidance used. Add modifier -25 to E/M.',
          confidence: 'medium',
        });
      }
    }

    // PROCEDURE 3: EKG/ECG (93000, 93005, 93010)
    const ekgPatterns = [
      /\bEKG\b/i,
      /\bECG\b/i,
      /electrocardiogram/i,
      /performed\s+(?:an?\s+)?(?:EKG|ECG)/i,
      /(?:12[\s-]lead|twelve[\s-]lead)\s+(?:EKG|ECG)/i,
    ];

    let hasEKG = false;
    for (const pattern of ekgPatterns) {
      if (pattern.test(combinedText)) {
        hasEKG = true;
        break;
      }
    }

    if (hasEKG) {
      // Check if interpretation mentioned
      const hasInterpretation = /(?:interpreted|interpretation|read|reading|reviewed\s+EKG)/i.test(combinedText);

      if (hasInterpretation) {
        procedures.push({
          cptCode: '93000',
          description: 'Electrocardiogram (EKG) complete with interpretation',
          modifier: '-25',
          note: 'Complete = tracing + interpretation + report. Add modifier -25 to E/M.',
          confidence: 'high',
        });
      } else {
        procedures.push({
          cptCode: '93005',
          description: 'Electrocardiogram (EKG) tracing only',
          note: 'Use 93010 for interpretation only if separate. 93000 for complete.',
          confidence: 'medium',
        });
      }
    }

    // PROCEDURE 4: Glucose Monitoring Setup/Training (95249, 95250, 95251)
    const cgmPatterns = [
      /(?:set\s+up|started|placed|initiated)\s+(?:a\s+)?(?:CGM|continuous\s+glucose\s+monitor)/i,
      /CGM\s+(?:setup|training|initiation|placement)/i,
      /continuous\s+glucose\s+monitor(?:ing)?\s+(?:setup|training)/i,
      /placed\s+(?:a\s+)?(?:dexcom|freestyle\s+libre|guardian)/i,
    ];

    let hasCGMSetup = false;
    for (const pattern of cgmPatterns) {
      if (pattern.test(combinedText)) {
        hasCGMSetup = true;
        break;
      }
    }

    if (hasCGMSetup) {
      procedures.push({
        cptCode: '95249',
        description: 'Continuous glucose monitoring, professional (physician-owned device)',
        note: 'Use if provider-owned device. 95250 for patient-owned device setup.',
        confidence: 'medium',
      });
    }

    // PROCEDURE 5: Insulin Pump Setup/Programming (95251)
    const pumpPatterns = [
      /(?:programmed|reprogrammed|adjusted|set\s+up)\s+(?:insulin\s+)?pump/i,
      /pump\s+(?:programming|adjustment|settings|basal\s+rates)/i,
      /changed?\s+pump\s+settings/i,
      /updated?\s+basal\s+rates/i,
    ];

    let hasPumpProgramming = false;
    for (const pattern of pumpPatterns) {
      if (pattern.test(combinedText)) {
        hasPumpProgramming = true;
        break;
      }
    }

    if (hasPumpProgramming) {
      procedures.push({
        cptCode: '95251',
        description: 'Insulin pump initiation and training',
        note: 'Requires >1 hour of training. Document time spent for audit protection.',
        confidence: 'medium',
      });
    }

    // PROCEDURE 6: Spirometry (94010, 94060)
    const spirometryPatterns = [
      /spirometry/i,
      /pulmonary\s+function\s+test/i,
      /\bPFT\b/i,
      /lung\s+function\s+test/i,
    ];

    let hasSpirometry = false;
    for (const pattern of spirometryPatterns) {
      if (pattern.test(combinedText)) {
        hasSpirometry = true;
        break;
      }
    }

    if (hasSpirometry) {
      procedures.push({
        cptCode: '94010',
        description: 'Spirometry with graphic record',
        modifier: '-25',
        note: 'Use 94060 for bronchodilator responsiveness. Add modifier -25 to E/M.',
        confidence: 'high',
      });
    }

    return procedures;
  }

  /**
   * Generate formatted billing section for note
   */
  generateBillingSection(
    cptRecommendation: CPTRecommendation,
    icd10Suggestions: ICD10Suggestion[],
    procedures: ProcedureRecommendation[] = []
  ): string {
    let section = `\n═══════════════════════════════════════════════════════
BILLING CODES (AI-GENERATED)
═══════════════════════════════════════════════════════\n\n`;

    // ========== SECTION 1: CPT CODES TO BILL ==========
    section += `📋 CPT CODES TO BILL:\n`;
    section += `───────────────────────────────────────────────────────\n`;

    // Determine if we should add modifier -25
    // CRITICAL: Only add -25 if E/M is significant (NOT 99211)
    // 99211 = procedure-focused visit with minimal E/M
    const shouldAddModifier25 = procedures.length > 0 && cptRecommendation.primaryCode !== '99211';

    // List all CPT codes together at the top
    if (procedures.length > 0) {
      if (shouldAddModifier25) {
        section += `**${cptRecommendation.primaryCode}-25**  (E/M Visit with Modifier -25)\n`;
      } else {
        section += `**${cptRecommendation.primaryCode}**  (E/M Visit - Procedure-focused)\n`;
      }
      for (const proc of procedures) {
        section += `**${proc.cptCode}**  (${proc.description.split(',')[0]})\n`;
      }
    } else {
      section += `**${cptRecommendation.primaryCode}**  (E/M Visit)\n`;
    }

    section += `\n`;

    // ========== SECTION 2: CODE DETAILS ==========
    section += `📝 CODE DETAILS:\n`;
    section += `───────────────────────────────────────────────────────\n`;

    // E/M Code details
    if (procedures.length > 0) {
      if (shouldAddModifier25) {
        // Significant E/M with -25 modifier
        section += `**${cptRecommendation.primaryCode}-25** - ${cptRecommendation.primaryDescription}\n`;
        section += `  • Complexity Level: ${cptRecommendation.complexity.toUpperCase()}\n`;
        section += `  • Time Range: ${cptRecommendation.timeRange}\n`;
        section += `  • AI Confidence: ${cptRecommendation.confidenceScore}%\n`;
        section += `  • Modifier -25: "Significant, separately identifiable E/M service on same day as procedure"\n`;
        section += `  • Required when billing E/M + procedure on same day\n\n`;
      } else {
        // Minimal E/M (99211) - NO -25 modifier
        section += `**${cptRecommendation.primaryCode}** - ${cptRecommendation.primaryDescription}\n`;
        section += `  • Complexity Level: ${cptRecommendation.complexity.toUpperCase()}\n`;
        section += `  • Time Range: ${cptRecommendation.timeRange}\n`;
        section += `  • AI Confidence: ${cptRecommendation.confidenceScore}%\n`;
        section += `  • ⚠️ NO MODIFIER -25: Visit appears procedure-focused with minimal separate E/M\n`;
        section += `  • Consider billing procedure only if no separate E/M was performed\n\n`;
      }
    } else {
      section += `**${cptRecommendation.primaryCode}** - ${cptRecommendation.primaryDescription}\n`;
      section += `  • Complexity Level: ${cptRecommendation.complexity.toUpperCase()}\n`;
      section += `  • Time Range: ${cptRecommendation.timeRange}\n`;
      section += `  • AI Confidence: ${cptRecommendation.confidenceScore}%\n\n`;
    }

    // Procedure details (if any)
    if (procedures.length > 0) {
      for (const proc of procedures) {
        section += `**${proc.cptCode}** - ${proc.description}\n`;
        section += `  • ${proc.note}\n`;
        if (proc.confidence === 'medium') {
          section += `  • ⚠ Medium confidence - verify procedure was performed\n`;
        } else if (proc.confidence === 'low') {
          section += `  • ⚠ Low confidence - please verify\n`;
        }
        section += `\n`;
      }
    }

    // ICD-10 Codes
    if (icd10Suggestions.length > 0) {
      section += `🏥 ICD-10 DIAGNOSIS CODES:\n`;
      section += `───────────────────────────────────────────────────────\n`;
      for (const icd of icd10Suggestions) {
        section += `${icd.code} - ${icd.description}\n`;
      }
      section += `\n`;
    }

    // ========== SECTION 3: MEDICAL DECISION MAKING JUSTIFICATION ==========
    section += `📊 MEDICAL DECISION MAKING (MDM) JUSTIFICATION:\n`;
    section += `───────────────────────────────────────────────────────\n`;

    // Show all MDM points for audit defense
    for (const point of cptRecommendation.mdmJustification) {
      section += `• ${point}\n`;
    }

    // Show complexity scoring breakdown
    section += `\nComplexity Score Calculation:\n`;
    section += `• This visit qualifies as ${cptRecommendation.complexity.toUpperCase()} complexity\n`;
    section += `• Meets CMS 2021 E/M guidelines for ${cptRecommendation.primaryCode}\n`;

    // ========== SECTION 4: DISCLAIMER ==========
    section += `\n⚠ REMINDER: Provider must review and verify all codes before billing\n`;

    return section;
  }
}

export const cptBillingAnalyzer = new CPTBillingAnalyzer();
