/**
 * Clinical Data Extractor for Prior Authorization
 * Extracts key clinical information from dictation/transcript
 */

export interface ClinicalData {
  primaryDiagnosis?: string;
  icd10Codes?: string[];
  clinicalJustification?: string;
  labResults?: Array<{
    testName: string;
    value: string;
    date?: string;
    unit?: string;
  }>;
  priorMedications?: Array<{
    medication: string;
    reason: string; // why discontinued
    duration?: string;
  }>;
  bmi?: number;
  weight?: string;
  height?: string;
  bloodPressure?: string;
  hba1c?: string;
  allergies?: string[];
  comorbidities?: string[];
  failedTherapies?: string[];
  contraindications?: string[];
}

/**
 * Extract clinical data from transcript using pattern matching
 */
export function extractClinicalData(transcript: string): ClinicalData {
  const data: ClinicalData = {};
  const text = transcript.toLowerCase();

  // Extract Primary Diagnosis
  const diagnosisPatterns = [
    /diagnosis[:\s]+([^.]+)/i,
    /primary diagnosis[:\s]+([^.]+)/i,
    /assessment[:\s]+([^.]+)/i,
    /patient has[:\s]+([^.]+)/i,
    /diagnosed with[:\s]+([^.]+)/i,
  ];

  for (const pattern of diagnosisPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      data.primaryDiagnosis = match[1].trim();
      break;
    }
  }

  // Extract ICD-10 codes
  const icd10Pattern = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
  const icd10Matches = transcript.match(icd10Pattern);
  if (icd10Matches) {
    data.icd10Codes = [...new Set(icd10Matches)];
  }

  // Extract BMI
  const bmiPattern = /bmi[:\s]+(\d+(?:\.\d+)?)/i;
  const bmiMatch = transcript.match(bmiPattern);
  if (bmiMatch) {
    data.bmi = parseFloat(bmiMatch[1]);
  }

  // Extract Weight
  const weightPatterns = [
    /weight[:\s]+(\d+(?:\.\d+)?)\s*(kg|lb|pounds|kilograms)/i,
    /weighs[:\s]+(\d+(?:\.\d+)?)\s*(kg|lb|pounds|kilograms)/i,
  ];

  for (const pattern of weightPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      data.weight = `${match[1]} ${match[2]}`;
      break;
    }
  }

  // Extract Height
  const heightPatterns = [
    /height[:\s]+(\d+(?:\.\d+)?)\s*(cm|m|ft|feet|inches)/i,
    /(\d+)\s*feet\s*(\d+)\s*inch/i,
  ];

  for (const pattern of heightPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      if (match[2] && match[3]) {
        // feet and inches
        data.height = `${match[1]}' ${match[2]}"`;
      } else {
        data.height = `${match[1]} ${match[2] || ''}`.trim();
      }
      break;
    }
  }

  // Extract Blood Pressure
  const bpPattern = /(?:bp|blood pressure)[:\s]+(\d+\/\d+)/i;
  const bpMatch = transcript.match(bpPattern);
  if (bpMatch) {
    data.bloodPressure = bpMatch[1];
  }

  // Extract HbA1c
  const hba1cPatterns = [
    /(?:hba1c|a1c|hemoglobin a1c)[:\s]+(\d+(?:\.\d+)?)\s*%?/i,
    /glycated hemoglobin[:\s]+(\d+(?:\.\d+)?)\s*%?/i,
  ];

  for (const pattern of hba1cPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      data.hba1c = match[1] + (match[1].includes('%') ? '' : '%');
      break;
    }
  }

  // Extract Lab Results
  data.labResults = extractLabResults(transcript);

  // Extract Prior Medications
  data.priorMedications = extractPriorMedications(transcript);

  // Extract Failed Therapies
  const failedPatterns = [
    /failed (?:on |with |therapy |treatment )?([^,.]+)/gi,
    /tried ([^,.]+ (?:without success|unsuccessfully))/gi,
    /discontinued ([^,.]+ due to [^,.]+)/gi,
    /intolerant to ([^,.]+)/gi,
  ];

  data.failedTherapies = [];
  for (const pattern of failedPatterns) {
    const matches = [...transcript.matchAll(pattern)];
    for (const match of matches) {
      data.failedTherapies.push(match[1].trim());
    }
  }

  // Extract Allergies
  const allergyPatterns = [/allergies?[:\s]+([^.]+)/i, /allergic to[:\s]+([^.]+)/i];

  for (const pattern of allergyPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      data.allergies = match[1]
        .split(/,|\band\b/)
        .map(a => a.trim())
        .filter(a => a && a.toLowerCase() !== 'none');
      break;
    }
  }

  // Extract Comorbidities
  const comorbidPatterns = [
    /(?:comorbidities|medical history|past medical history|pmh)[:\s]+([^.]+)/i,
    /also has ([^.]+)/i,
    /history of ([^.]+)/i,
  ];

  data.comorbidities = [];
  for (const pattern of comorbidPatterns) {
    const matches = [...transcript.matchAll(pattern)];
    for (const match of matches) {
      const conditions = match[1]
        .split(/,|\band\b/)
        .map(c => c.trim())
        .filter(c => c);
      data.comorbidities.push(...conditions);
    }
  }
  data.comorbidities = [...new Set(data.comorbidities)];

  // Extract Clinical Justification
  const justificationPatterns = [
    /clinical (?:justification|rationale)[:\s]+([^.]+)/i,
    /medical necessity[:\s]+([^.]+)/i,
    /reason for (?:medication|treatment)[:\s]+([^.]+)/i,
    /(?:need|require)s? (?:this )?(?:medication|treatment) (?:because|due to|for)[:\s]+([^.]+)/i,
  ];

  for (const pattern of justificationPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      data.clinicalJustification = match[1].trim();
      break;
    }
  }

  // If no explicit justification, build one from available data
  if (!data.clinicalJustification && (data.primaryDiagnosis || data.failedTherapies?.length)) {
    const parts = [];
    if (data.primaryDiagnosis) {
      parts.push(`Patient has ${data.primaryDiagnosis}`);
    }
    if (data.failedTherapies?.length) {
      parts.push(`Failed previous therapies: ${data.failedTherapies.join(', ')}`);
    }
    if (data.hba1c && parseFloat(data.hba1c) > 7) {
      parts.push(`Uncontrolled with HbA1c of ${data.hba1c}`);
    }
    if (parts.length > 0) {
      data.clinicalJustification = parts.join('. ');
    }
  }

  return data;
}

/**
 * Extract lab results from transcript
 */
function extractLabResults(transcript: string): ClinicalData['labResults'] {
  const results: ClinicalData['labResults'] = [];

  // Common lab patterns
  const labPatterns = [
    { name: 'Creatinine', pattern: /creatinine[:\s]+(\d+(?:\.\d+)?)\s*(mg\/dl)?/i },
    { name: 'eGFR', pattern: /(?:egfr|gfr)[:\s]+(\d+(?:\.\d+)?)\s*(ml\/min)?/i },
    { name: 'ALT', pattern: /alt[:\s]+(\d+(?:\.\d+)?)\s*(u\/l)?/i },
    { name: 'AST', pattern: /ast[:\s]+(\d+(?:\.\d+)?)\s*(u\/l)?/i },
    { name: 'Glucose', pattern: /(?:glucose|blood sugar)[:\s]+(\d+(?:\.\d+)?)\s*(mg\/dl)?/i },
    {
      name: 'Total Cholesterol',
      pattern: /(?:total )?cholesterol[:\s]+(\d+(?:\.\d+)?)\s*(mg\/dl)?/i,
    },
    { name: 'LDL', pattern: /ldl[:\s]+(\d+(?:\.\d+)?)\s*(mg\/dl)?/i },
    { name: 'HDL', pattern: /hdl[:\s]+(\d+(?:\.\d+)?)\s*(mg\/dl)?/i },
    { name: 'Triglycerides', pattern: /triglycerides[:\s]+(\d+(?:\.\d+)?)\s*(mg\/dl)?/i },
    { name: 'TSH', pattern: /tsh[:\s]+(\d+(?:\.\d+)?)\s*(miu\/l)?/i },
    { name: 'Hemoglobin', pattern: /hemoglobin[:\s]+(\d+(?:\.\d+)?)\s*(g\/dl)?/i },
    { name: 'Potassium', pattern: /potassium[:\s]+(\d+(?:\.\d+)?)\s*(meq\/l)?/i },
    { name: 'Sodium', pattern: /sodium[:\s]+(\d+(?:\.\d+)?)\s*(meq\/l)?/i },
  ];

  for (const lab of labPatterns) {
    const match = transcript.match(lab.pattern);
    if (match) {
      results.push({
        testName: lab.name,
        value: match[1],
        unit: match[2] || undefined,
      });
    }
  }

  // Try to extract dates for labs
  const datePattern = /labs? (?:from|on|dated) (\d{1,2}\/\d{1,2}\/\d{2,4})/i;
  const dateMatch = transcript.match(datePattern);
  if (dateMatch && results.length > 0) {
    results.forEach(lab => {
      if (!lab.date) lab.date = dateMatch[1];
    });
  }

  return results.length > 0 ? results : undefined;
}

/**
 * Extract prior medications from transcript
 */
function extractPriorMedications(transcript: string): ClinicalData['priorMedications'] {
  const medications: ClinicalData['priorMedications'] = [];

  // Patterns for finding tried medications
  const medPatterns = [
    /tried ([a-z]+(?:in|ide|one|ate|ol))\s+(?:but |and |which )?([^,.]+)/gi,
    /previously on ([a-z]+(?:in|ide|one|ate|ol))[^,.]* (?:stopped|discontinued) (?:due to |because of )?([^,.]+)/gi,
    /failed ([a-z]+(?:in|ide|one|ate|ol))\s+(?:due to |because of )?([^,.]+)/gi,
    /([a-z]+(?:in|ide|one|ate|ol)) (?:caused|resulted in) ([^,.]+)/gi,
  ];

  for (const pattern of medPatterns) {
    const matches = [...transcript.matchAll(pattern)];
    for (const match of matches) {
      medications.push({
        medication: match[1].trim(),
        reason: match[2].trim(),
      });
    }
  }

  // Common medications mentioned as "tried"
  const commonMeds = ['metformin', 'januvia', 'jardiance', 'trulicity', 'ozempic', 'insulin'];
  for (const med of commonMeds) {
    const pattern = new RegExp(`${med}[^,.]*(?:tried|failed|discontinued|stopped)`, 'i');
    if (pattern.test(transcript) && !medications.find(m => m.medication.toLowerCase() === med)) {
      medications.push({
        medication: med,
        reason: 'mentioned as tried/failed',
      });
    }
  }

  return medications.length > 0 ? medications : undefined;
}

/**
 * Generate smart prompts for missing PA information
 */
export function generateSmartPAPrompts(clinicalData: ClinicalData, medication: string): string[] {
  const prompts: string[] = [];

  if (!clinicalData.primaryDiagnosis) {
    prompts.push('What is the primary diagnosis requiring this medication?');
  }

  if (!clinicalData.icd10Codes || clinicalData.icd10Codes.length === 0) {
    prompts.push('Please provide the ICD-10 code for the diagnosis.');
  }

  if (!clinicalData.priorMedications || clinicalData.priorMedications.length === 0) {
    prompts.push('What medications has the patient tried previously? Why were they discontinued?');
  }

  if (!clinicalData.clinicalJustification) {
    prompts.push(`Why is ${medication} medically necessary for this patient?`);
  }

  // Medication-specific prompts
  if (
    medication.toLowerCase().includes('ozempic') ||
    medication.toLowerCase().includes('mounjaro')
  ) {
    if (!clinicalData.hba1c) {
      prompts.push("What is the patient's most recent HbA1c?");
    }
    if (!clinicalData.bmi) {
      prompts.push("What is the patient's current BMI?");
    }
    if (
      !clinicalData.priorMedications?.find(m => m.medication.toLowerCase().includes('metformin'))
    ) {
      prompts.push('Has the patient tried metformin? If so, what was the outcome?');
    }
  }

  if (medication.toLowerCase().includes('humira') || medication.toLowerCase().includes('enbrel')) {
    if (!clinicalData.labResults?.find(l => l.testName.toLowerCase().includes('tb'))) {
      prompts.push('Has TB testing been completed?');
    }
  }

  return prompts;
}
