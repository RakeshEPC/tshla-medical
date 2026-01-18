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
   * Uses multiple detection methods and returns the highest count
   * FIX: Previously only counted array length (1 big string = 1 problem)
   */
  countProblems(assessment: string[]): number {
    if (!assessment || assessment.length === 0) return 0;

    const assessmentText = assessment.join(' ');
    let problemCount = 0;

    // METHOD 1: Count ICD-10 codes (most reliable)
    // Matches: E11.9, I10, E78.5, I25.2, I63.9, E13.10
    const icd10Pattern = /[A-Z]\d{2}\.?\d*/g;
    const icd10Codes = assessmentText.match(icd10Pattern) || [];
    const uniqueICD10 = [...new Set(icd10Codes)]; // Remove duplicates
    problemCount = Math.max(problemCount, uniqueICD10.length);

    // METHOD 2: Count bullet points/list items
    // Matches: •, -, 1., 2., etc.
    const bulletPattern = /^[\s]*[•\-\*]|\d+\./gm;
    const bullets = assessmentText.match(bulletPattern) || [];
    problemCount = Math.max(problemCount, bullets.length);

    // METHOD 3: Count distinct medical conditions by keyword
    const conditionKeywords = [
      // Endocrine
      'diabetes', 'diabetic', 'hyperglycemia', 'hypoglycemia',
      'hypothyroid', 'hyperthyroid', 'thyroid disorder',
      'obesity', 'metabolic syndrome',

      // Cardiovascular
      'hypertension', 'HTN', 'high blood pressure',
      'hyperlipidemia', 'HLD', 'dyslipidemia', 'cholesterol',
      'coronary disease', 'CAD', 'heart disease',
      'myocardial infarction', 'MI', 'heart attack',
      'heart failure', 'CHF', 'atrial fibrillation',
      'stroke', 'CVA', 'TIA',

      // Respiratory
      'COPD', 'emphysema', 'chronic bronchitis',
      'asthma', 'pneumonia', 'bronchitis',

      // Acute conditions
      'ketoacidosis', 'DKA', 'sepsis',
      'chest pain', 'angina', 'dyspnea',
      'shortness of breath', 'SOB',

      // Other chronic
      'chronic kidney disease', 'CKD', 'renal',
      'depression', 'anxiety', 'PTSD',
      'arthritis', 'osteoarthritis', 'gout',
      'neuropathy', 'retinopathy', 'nephropathy'
    ];

    const textLower = assessmentText.toLowerCase();
    const foundConditions = conditionKeywords.filter(keyword =>
      textLower.includes(keyword.toLowerCase())
    );
    problemCount = Math.max(problemCount, foundConditions.length);

    // METHOD 4: Count commas and semicolons (fallback)
    // "Type 2 DM, HTN, HLD, hypothyroid" = 4 items
    const items = assessmentText.split(/[,;]/).filter(item =>
      item.trim().length > 3 // Ignore tiny fragments
    );
    problemCount = Math.max(problemCount, items.length);

    // BONUS: Add points for complexity indicators
    const complexityBonus = [
      /multiple\s+chronic\s+conditions?/i,
      /\d+\s+chronic\s+conditions?/i,
      /complicated\s+by/i,
      /poorly\s+controlled/i,
      /uncontrolled/i,
      /refractory/i,
      /progressive/i
    ];

    for (const pattern of complexityBonus) {
      if (pattern.test(assessmentText)) {
        problemCount += 1; // Bonus for complexity
        break; // Only add once
      }
    }

    // Use highest count from all methods, but keep array length as minimum
    problemCount = Math.max(problemCount, assessment.length);

    return problemCount;
  }

  /**
   * Count data points reviewed, ordered, or analyzed
   * Searches BOTH plan section AND original transcript
   * FIX: Previously only searched plan, missed hospital records and provider coordination
   *
   * Data categories (per CMS guidelines):
   * - Each unique test/imaging = 1 point
   * - External records reviewed = 2 points
   * - Independent historian = 1 point
   * - Provider coordination = 1 point
   */
  countDataPoints(plan: string[], transcript: string): number {
    if (!plan || plan.length === 0) return 0;

    // Search BOTH plan and transcript
    const planText = plan.join(' ').toLowerCase();
    const transcriptLower = transcript.toLowerCase();
    const combinedText = planText + ' ' + transcriptLower;

    let dataPoints = 0;

    // CATEGORY 1: Laboratory Tests Ordered (+1 each, unique)
    const labTests = [
      // Metabolic panels
      'cmp', 'bmp', 'comprehensive metabolic', 'basic metabolic',

      // Blood counts
      'cbc', 'complete blood count', 'hemoglobin', 'hematocrit',

      // Diabetes
      'a1c', 'hemoglobin a1c', 'glucose', 'fructosamine',

      // Thyroid
      'tsh', 'free t4', 'free t3', 't4', 't3', 'thyroid panel',

      // Lipids
      'lipid panel', 'cholesterol', 'ldl', 'hdl', 'triglycerides',

      // Liver/kidney
      'liver panel', 'lft', 'ast', 'alt', 'bilirubin',
      'kidney function', 'creatinine', 'bun', 'gfr',
      'microalbumin', 'urine albumin', 'protein/creatinine ratio',

      // Other
      'vitamin d', 'b12', 'folate', 'iron', 'ferritin',
      'ptt', 'pt', 'inr', 'coagulation',
      'urinalysis', 'urine culture'
    ];

    const labsFound = new Set<string>();
    for (const lab of labTests) {
      if (combinedText.includes(lab)) {
        labsFound.add(lab);
      }
    }
    dataPoints += labsFound.size;

    // CATEGORY 2: Imaging Studies Ordered (+1 each, unique)
    const imagingTests = [
      'x-ray', 'xray', 'chest x-ray', 'cxr',
      'ct scan', 'ct', 'cat scan',
      'mri', 'magnetic resonance',
      'ultrasound', 'us', 'sonogram',
      'dexa', 'bone density',
      'echo', 'echocardiogram', 'cardiac echo',
      'ekg', 'ecg', 'electrocardiogram',
      'stress test', 'nuclear stress',
      'doppler', 'vascular study',
      'mammogram', 'breast imaging'
    ];

    const imagingFound = new Set<string>();
    for (const img of imagingTests) {
      if (combinedText.includes(img)) {
        imagingFound.add(img);
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
   * FIX: Now detects recent hospitalization, MI, DKA, and other acute events
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

    // CATEGORY 1: Recent Hospitalization (HIGH RISK +3)
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
    for (const pattern of hospitalizationPatterns) {
      if (pattern.test(combinedText)) {
        wasHospitalized = true;
        riskScore += 3; // Recent hospitalization = HIGH risk
        break;
      }
    }

    // CATEGORY 2: Post-Discharge Timing (Additional +2 if <7 days)
    if (wasHospitalized) {
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
          }
          break;
        }
      }
    }

    // CATEGORY 3: Life-Threatening Events (HIGH RISK +3 each)
    const acuteLifeThreateningEvents = [
      /(?:recent|new|another)\s+(?:MI|myocardial\s+infarction|heart\s+attack)/i,
      /(?:had|with)\s+(?:another|new)\s+(?:MI|heart\s+attack)/i,
      /(?:STEMI|NSTEMI)/i,
      /(?:acute|unstable)\s+(?:coronary|angina)/i,
      /(?:DKA|diabetic\s+ketoacidosis)/i,
      /(?:HHS|hyperosmolar)/i,
      /severe\s+hypoglycemia/i,
      /(?:sepsis|septic\s+shock)/i,
      /(?:recent|new)\s+stroke/i,
      /(?:PE|pulmonary\s+embolism)/i,
      /(?:CHF|heart\s+failure)\s+exacerbation/i,
      /(?:COPD|asthma)\s+exacerbation/i,
      /respiratory\s+failure/i,
      /acute\s+kidney\s+injury/i
    ];

    for (const pattern of acuteLifeThreateningEvents) {
      if (pattern.test(combinedText)) {
        riskScore += 3; // Life-threatening event = HIGH risk
        // Don't break - multiple events should stack
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
   * Fixes Bug #4: Parse actual medication actions instead of array length
   */
  countMedicationChanges(medicationTexts: string[], transcript: string): number {
    if (!medicationTexts || medicationTexts.length === 0) {
      return 0;
    }

    const combinedText = medicationTexts.join(' ') + ' ' + transcript;
    const textLower = combinedText.toLowerCase();

    let changeCount = 0;

    // METHOD 1: Count medication action keywords (most reliable)
    const actionPatterns = [
      // Starting medications
      /start(?:ed|ing)?\s+(?:on\s+)?[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))/gi,
      /initiat(?:e|ed|ing)\s+[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))/gi,
      /begin(?:ning)?\s+[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))/gi,
      /add(?:ed|ing)?\s+[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))/gi,
      /prescrib(?:e|ed|ing)\s+[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))/gi,

      // Increasing doses
      /increas(?:e|ed|ing)\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,
      /up(?:ped|ping)?\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,
      /rais(?:e|ed|ing)\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,
      /titrat(?:e|ed|ing)\s+up\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,

      // Decreasing doses
      /decreas(?:e|ed|ing)\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,
      /lower(?:ed|ing)?\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,
      /reduc(?:e|ed|ing)\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,
      /down(?:ped|ping)?\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,

      // Stopping medications
      /stop(?:ped|ping)?\s+[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))?/gi,
      /discontinu(?:e|ed|ing)\s+[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))?/gi,
      /hold(?:ing)?\s+[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))?/gi,
      /ceas(?:e|ed|ing)\s+[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))?/gi,

      // Adjusting/changing
      /adjust(?:ed|ing)?\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,
      /chang(?:e|ed|ing)\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,
      /modif(?:y|ied|ying)\s+[\w\s]+?(?:to\s+)?\d+\s*(?:mg|mcg|units?|ml)/gi,
      /switch(?:ed|ing)?\s+(?:to\s+)?[\w\s]+?(?:\d+\s*(?:mg|mcg|units?|ml))/gi,
    ];

    let actionMatches = new Set<string>();
    for (const pattern of actionPatterns) {
      const matches = combinedText.match(pattern) || [];
      matches.forEach(match => actionMatches.add(match.toLowerCase().trim()));
    }
    changeCount = Math.max(changeCount, actionMatches.size);

    // METHOD 2: Count distinct medication names mentioned
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

    let medicationsFound = new Set<string>();
    for (const med of commonMedications) {
      const pattern = new RegExp(`\\b${med}\\b`, 'gi');
      if (pattern.test(textLower)) {
        medicationsFound.add(med);
      }
    }
    changeCount = Math.max(changeCount, medicationsFound.size);

    // METHOD 3: Count dose specifications (number + unit patterns)
    const dosePattern = /\d+\s*(?:mg|mcg|units?|ml|tabs?|capsules?)\b/gi;
    const doses = combinedText.match(dosePattern) || [];
    const uniqueDoses = new Set(doses.map(d => d.toLowerCase().trim()));
    changeCount = Math.max(changeCount, uniqueDoses.size);

    // METHOD 4: Count commas and semicolons in medication text (fallback)
    const medicationOnlyText = medicationTexts.join(' ');
    const items = medicationOnlyText.split(/[,;]/).filter(item => {
      const trimmed = item.trim();
      // Must have a number (dose) or medication action keyword
      return trimmed.length > 10 &&
             (/\d+/.test(trimmed) ||
              /(?:start|stop|increas|decreas|adjust|change)/i.test(trimmed));
    });
    changeCount = Math.max(changeCount, items.length);

    // BONUS: Add points for insulin regimen complexity
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
    if (hasComplexInsulin) {
      changeCount += 1; // Bonus for complex insulin management
    }

    // Ensure we count at least the array length (backward compatibility)
    changeCount = Math.max(changeCount, medicationTexts.length);

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
   * Suggest CPT E&M codes based on analysis
   */
  suggestCPTCodes(
    analysis: ComplexityAnalysis,
    hasChiefComplaint: boolean,
    hasAssessment: boolean,
    hasPlan: boolean
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
BILLING INFORMATION (AI-GENERATED)
═══════════════════════════════════════════════════════\n\n`;

    section += `POSSIBLE CPT CODES FOR THIS VISIT:\n\n`;

    // Primary recommendation
    section += `Primary Recommendation: ${cptRecommendation.primaryCode}\n`;
    section += `  • ${cptRecommendation.primaryDescription}\n`;
    section += `  • Time Range: ${cptRecommendation.timeRange}\n`;
    section += `  • Complexity: ${cptRecommendation.complexity.toUpperCase()}\n`;
    section += `  • Confidence: ${cptRecommendation.confidenceScore}%\n\n`;

    // MDM Justification
    section += `Medical Decision Making (MDM) Justification:\n`;
    for (const point of cptRecommendation.mdmJustification) {
      section += `  • ${point}\n`;
    }
    section += `\n`;

    // Alternative codes
    if (cptRecommendation.alternativeCodes.length > 0) {
      section += `Alternative Codes to Consider:\n`;
      for (const alt of cptRecommendation.alternativeCodes) {
        section += `  • ${alt.code} - ${alt.description}\n`;
        section += `    Reason: ${alt.reason}\n`;
      }
      section += `\n`;
    }

    // Supporting evidence
    section += `SUPPORTING DOCUMENTATION:\n`;
    section += `${cptRecommendation.supportingEvidence.chiefComplaintPresent ? '✓' : '⚠'} Chief complaint documented\n`;
    section += `${cptRecommendation.supportingEvidence.assessmentPresent ? '✓' : '⚠'} Assessment with diagnosis codes present\n`;
    section += `${cptRecommendation.supportingEvidence.planPresent ? '✓' : '⚠'} Treatment plan documented\n`;
    section += `${cptRecommendation.supportingEvidence.followUpPresent ? '✓' : '⚠'} Follow-up plan included\n`;
    section += `${cptRecommendation.supportingEvidence.timeDocumented ? '✓' : '⚠'} Time spent documented\n`;

    if (!cptRecommendation.supportingEvidence.timeDocumented) {
      section += `\n⚠ Consider documenting: Total time spent for more accurate billing\n`;
    }

    // ICD-10 suggestions
    if (icd10Suggestions.length > 0) {
      section += `\nICD-10 Diagnosis Code Suggestions:\n`;
      for (const icd of icd10Suggestions) {
        const confidenceSymbol =
          icd.confidence === 'high' ? '✓✓' : icd.confidence === 'medium' ? '✓' : '○';
        section += `  ${confidenceSymbol} ${icd.code} - ${icd.description}\n`;
      }
    }

    // In-office procedures detected
    if (procedures.length > 0) {
      section += `\nIN-OFFICE PROCEDURES DETECTED:\n`;
      for (const proc of procedures) {
        const confidenceSymbol =
          proc.confidence === 'high' ? '✓✓' : proc.confidence === 'medium' ? '✓' : '○';
        section += `  ${confidenceSymbol} CPT ${proc.cptCode} - ${proc.description}\n`;
        if (proc.modifier) {
          section += `     Modifier: ${proc.modifier}\n`;
        }
        section += `     Note: ${proc.note}\n`;
      }
      section += `\n⚠ IMPORTANT: When billing E/M visit + procedure on same day:\n`;
      section += `   • Add modifier -25 to E/M code (99213, 99214, etc.)\n`;
      section += `   • Modifier -25 indicates "significant, separately identifiable E/M service"\n`;
      section += `   • Document medical necessity for both services\n`;
    }

    section += `\n`;
    section += `⚠ DISCLAIMER: AI-generated billing codes for reference only.\n`;
    section += `   Provider must verify accuracy and appropriateness before billing.\n`;
    section += `   Ensure all documentation supports the selected code.\n`;

    return section;
  }
}

export const cptBillingAnalyzer = new CPTBillingAnalyzer();
