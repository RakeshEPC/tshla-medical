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
   * Count number of problems addressed
   */
  countProblems(assessment: string[]): number {
    if (!assessment || assessment.length === 0) return 0;

    // Count unique problem mentions
    let problemCount = assessment.length;

    // Check for complexity indicators
    const complexityIndicators = [
      /multiple\s+chronic\s+conditions?/i,
      /\d+\s+chronic\s+conditions?/i,
      /complicated\s+by/i,
      /poorly\s+controlled/i,
      /uncontrolled/i,
    ];

    for (const indicator of complexityIndicators) {
      if (assessment.some((a) => indicator.test(a))) {
        problemCount += 1; // Increase count for complexity
      }
    }

    return problemCount;
  }

  /**
   * Count data points (labs, imaging, records reviewed)
   */
  countDataPoints(plan: string[]): number {
    if (!plan || plan.length === 0) return 0;

    let dataPoints = 0;

    const labTests = ['cmp', 'cbc', 'a1c', 'tsh', 'lipid', 'microalbumin', 'urine', 'bmp', 'liver'];
    const imaging = ['x-ray', 'mri', 'ct', 'ultrasound', 'dexa', 'echo'];

    const planText = plan.join(' ').toLowerCase();

    // Count unique lab tests ordered
    for (const lab of labTests) {
      if (planText.includes(lab)) {
        dataPoints++;
      }
    }

    // Count imaging ordered
    for (const img of imaging) {
      if (planText.includes(img)) {
        dataPoints++;
      }
    }

    // Check for external records review
    if (
      /(?:review|obtain|get).*?(?:records|labs|outside|previous|old)/i.test(planText) ||
      /(?:records|labs).*?(?:from|reviewed)/i.test(planText)
    ) {
      dataPoints += 2; // External records review counts as 2 data points
    }

    return dataPoints;
  }

  /**
   * Assess clinical risk level
   */
  assessRiskLevel(
    medicationChanges: string[],
    assessment: string[],
    vitals: any
  ): RiskLevel {
    let riskScore = 0;

    // Medication complexity
    if (medicationChanges && medicationChanges.length > 0) {
      const hasInsulin = medicationChanges.some((med) =>
        /insulin|lantus|novolog|humalog/i.test(med)
      );
      const hasNewMedication = medicationChanges.some((med) => /start/i.test(med));
      const hasMultipleChanges = medicationChanges.length >= 2;

      if (hasInsulin) riskScore += 2;
      if (hasNewMedication) riskScore += 1;
      if (hasMultipleChanges) riskScore += 1;
    }

    // Clinical conditions
    if (assessment && assessment.length > 0) {
      const assessmentText = assessment.join(' ').toLowerCase();

      // High-risk conditions
      if (
        /uncontrolled|poorly controlled|severe|acute|emergency/i.test(assessmentText)
      ) {
        riskScore += 2;
      }

      // Chronic disease management
      if (
        /diabetes|hypertension|heart|cancer|copd|asthma|chronic/i.test(assessmentText)
      ) {
        riskScore += 1;
      }

      // Multiple conditions
      if (assessment.length >= 3) {
        riskScore += 1;
      }
    }

    // Abnormal vitals
    if (vitals) {
      if (vitals.bloodSugar && parseInt(vitals.bloodSugar) > 200) riskScore += 1;
      if (vitals.a1c && parseFloat(vitals.a1c) > 9) riskScore += 1;
    }

    // Determine risk level
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'moderate';
    if (riskScore >= 1) return 'low';
    return 'minimal';
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
    const dataPoints = this.countDataPoints(extractedInfo.plan || []);
    const medicationChanges = (extractedInfo.medicationChanges || []).length;
    const riskLevel = this.assessRiskLevel(
      extractedInfo.medicationChanges || [],
      extractedInfo.assessment || [],
      extractedInfo.vitals
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
   * Generate formatted billing section for note
   */
  generateBillingSection(
    cptRecommendation: CPTRecommendation,
    icd10Suggestions: ICD10Suggestion[]
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

    section += `\n`;
    section += `⚠ DISCLAIMER: AI-generated billing codes for reference only.\n`;
    section += `   Provider must verify accuracy and appropriateness before billing.\n`;
    section += `   Ensure all documentation supports the selected code.\n`;

    return section;
  }
}

export const cptBillingAnalyzer = new CPTBillingAnalyzer();
