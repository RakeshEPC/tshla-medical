import { PriorAuthRequest, PAValidation, MissingField } from '@/types/priorAuth';
import { findMedication } from './medicationDatabase';

export function validatePriorAuth(request: Partial<PriorAuthRequest>): PAValidation {
  const missingFields: MissingField[] = [];
  const suggestions: string[] = [];

  // Find medication info
  const medInfo = request.medication ? findMedication(request.medication) : null;

  // Check required fields based on medication
  if (!request.medication) {
    missingFields.push({
      field: 'medication',
      required: true,
      description: 'Medication name',
      prompt: 'What medication are you prescribing?',
    });
  }

  if (!request.diagnosis || request.diagnosis.length === 0) {
    missingFields.push({
      field: 'diagnosis',
      required: true,
      description: 'Primary diagnosis',
      prompt: 'What is the primary diagnosis for this medication?',
    });
  }

  if (!request.icd10Codes || request.icd10Codes.length === 0) {
    missingFields.push({
      field: 'icd10Codes',
      required: true,
      description: 'ICD-10 codes',
      prompt: 'Please provide ICD-10 codes for the diagnosis',
    });

    if (medInfo) {
      suggestions.push(
        `Common ICD-10 codes for ${medInfo.brandName}: ${medInfo.commonICD10.join(', ')}`
      );
    }
  }

  if (!request.clinicalJustification || request.clinicalJustification.length < 50) {
    missingFields.push({
      field: 'clinicalJustification',
      required: true,
      description: 'Clinical justification',
      prompt:
        'Please provide detailed clinical justification (why this medication over alternatives?)',
    });
  }

  // Check medication-specific requirements
  if (medInfo) {
    // Check if required labs are mentioned
    if (medInfo.labsRequired && medInfo.labsRequired.length > 0) {
      const hasLabs = request.labResults && request.labResults.length > 0;
      if (!hasLabs) {
        missingFields.push({
          field: 'labResults',
          required: true,
          description: 'Laboratory results',
          prompt: `Please provide the following labs: ${medInfo.labsRequired.join(', ')}`,
        });
      } else {
        // Check if specific labs are present
        medInfo.labsRequired.forEach(requiredLab => {
          const hasLab = request.labResults?.some(lab =>
            lab.testName.toLowerCase().includes(requiredLab.toLowerCase())
          );
          if (!hasLab) {
            missingFields.push({
              field: `lab_${requiredLab}`,
              required: true,
              description: requiredLab,
              prompt: `Missing required lab: ${requiredLab}`,
            });
          }
        });
      }
    }

    // Check if alternatives have been tried
    if (medInfo.typicalRequirements.some(req => req.toLowerCase().includes('failed'))) {
      if (!request.triedAlternatives || request.triedAlternatives.length === 0) {
        missingFields.push({
          field: 'triedAlternatives',
          required: true,
          description: 'Previously tried medications',
          prompt:
            'What medications has the patient already tried? Please list failures and reasons.',
        });

        const alternativeNames = medInfo.alternatives
          .filter(alt => !alt.priorAuthRequired)
          .map(alt => alt.name);
        if (alternativeNames.length > 0) {
          suggestions.push(`Consider documenting trials of: ${alternativeNames.join(', ')}`);
        }
      }
    }

    // Add medication-specific suggestions
    suggestions.push(...medInfo.typicalRequirements.map(req => `Ensure: ${req}`));

    // BMI requirement for weight loss meds
    if (medInfo.commonICD10.some(code => code.startsWith('Z68'))) {
      if (!request.clinicalJustification?.includes('BMI')) {
        missingFields.push({
          field: 'bmi',
          required: true,
          description: 'BMI documentation',
          prompt: "Please provide patient's current BMI and weight history",
        });
      }
    }
  }

  return {
    isComplete: missingFields.filter(f => f.required).length === 0,
    missingFields,
    suggestions,
  };
}

export function generatePAPrompts(medication: string, transcript: string): string[] {
  const prompts: string[] = [];
  const medInfo = findMedication(medication);

  if (!medInfo) return prompts;

  // Check what's missing from transcript
  const transcriptLower = transcript.toLowerCase();

  // Check for diagnosis
  if (!medInfo.commonICD10.some(icd => transcript.includes(icd))) {
    prompts.push('Please specify the exact diagnosis and ICD-10 code for this prescription');
  }

  // Check for alternatives mentioned
  const alternativesMentioned = medInfo.alternatives.some(
    alt =>
      transcriptLower.includes(alt.name.toLowerCase()) ||
      (alt.generic && transcriptLower.includes(alt.generic.toLowerCase()))
  );

  if (!alternativesMentioned) {
    prompts.push(
      `Have you tried any of these alternatives: ${medInfo.alternatives.map(a => a.name).join(', ')}? Please document.`
    );
  }

  // Check for labs
  if (medInfo.labsRequired) {
    medInfo.labsRequired.forEach(lab => {
      if (!transcriptLower.includes(lab.toLowerCase())) {
        prompts.push(`Please provide ${lab} result`);
      }
    });
  }

  // Check for clinical criteria
  medInfo.clinicalCriteria.forEach(criteria => {
    const keywords = criteria
      .toLowerCase()
      .split(' ')
      .filter(w => w.length > 4);
    const mentioned = keywords.some(keyword => transcriptLower.includes(keyword));
    if (!mentioned) {
      prompts.push(`Please confirm: ${criteria}`);
    }
  });

  return prompts;
}

export function extractMedicationsFromTranscript(transcript: string): string[] {
  const medications: string[] = [];
  const transcriptLower = transcript.toLowerCase();

  // Check against our database
  const { priorAuthMedications } = require('./medicationDatabase');

  priorAuthMedications.forEach((med: any) => {
    if (transcriptLower.includes(med.brandName.toLowerCase())) {
      medications.push(med.brandName);
    } else if (med.genericName && transcriptLower.includes(med.genericName.toLowerCase())) {
      medications.push(med.brandName);
    }
  });

  // Also check for common variations
  const medicationPatterns = [
    /(?:start|begin|initiate|prescribe|switch to|change to)\s+(\w+)/gi,
    /(\w+)\s+(?:\d+\s*mg|\d+\s*mcg|\d+\s*units)/gi,
  ];

  medicationPatterns.forEach(pattern => {
    const matches = transcript.matchAll(pattern);
    for (const match of matches) {
      const potentialMed = match[1];
      if (potentialMed && potentialMed.length > 3) {
        const found = findMedication(potentialMed);
        if (found && !medications.includes(found.brandName)) {
          medications.push(found.brandName);
        }
      }
    }
  });

  return [...new Set(medications)];
}
