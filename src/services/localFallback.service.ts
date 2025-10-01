/**
 * Local Fallback Service for Medical Note Processing
 * Used when both Azure OpenAI and AWS Bedrock are unavailable
 * Provides basic template-based SOAP note generation
 */

import type { PatientData } from './patientData.service';
import type { Template } from '../types/template.types';
import type { ProcessedNote } from './bedrock.service';
import { logInfo, logWarn, logDebug } from './logger.service';

export class LocalFallbackService {

  /**
   * Process medical transcript using local template-based approach
   * No AI required - uses pattern matching and templates
   */
  async processMedicalTranscription(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    additionalContext?: string
  ): Promise<ProcessedNote> {
    logWarn('localFallback', 'Using local fallback processing - AI services unavailable');

    try {
      // Extract basic medical information using patterns
      const extractedData = this.extractMedicalData(transcript);

      // Generate basic SOAP note structure
      const soapNote = this.generateBasicSOAP(extractedData, patient, template);

      // Format the final note
      const formattedNote = this.formatNote(soapNote, patient);

      const processedNote: ProcessedNote = {
        formatted: formattedNote,
        sections: {
          chiefComplaint: extractedData.chiefComplaint || 'Not specified',
          historyOfPresentIllness: extractedData.hpi || 'See subjective section',
          physicalExam: extractedData.physicalExam || 'Not documented',
          assessment: extractedData.assessment || 'Pending further evaluation',
          plan: extractedData.plan || 'To be determined',
          patientSummary: this.generatePatientSummary(extractedData, patient)
        },
        metadata: {
          processedAt: new Date().toISOString(),
          model: 'Local Fallback Processor',
          confidence: 0.7 // Lower confidence for template-based processing
        }
      };

      logInfo('localFallback', 'Local fallback processing completed successfully');
      return processedNote;

    } catch (error) {
      logWarn('localFallback', `Local fallback processing failed: ${error}`);

      // Return basic emergency fallback
      return this.createEmergencyFallback(transcript, patient);
    }
  }

  /**
   * Extract medical data using pattern matching
   */
  private extractMedicalData(transcript: string): MedicalData {
    const text = transcript.toLowerCase();

    return {
      chiefComplaint: this.extractChiefComplaint(text),
      hpi: this.extractHPI(text),
      physicalExam: this.extractPhysicalExam(text),
      assessment: this.extractAssessment(text),
      plan: this.extractPlan(text),
      medications: this.extractMedications(text),
      vitals: this.extractVitals(text)
    };
  }

  private extractChiefComplaint(text: string): string {
    const patterns = [
      /presents?\s+with\s+([^.]+)/i,
      /chief\s+complaint\s*:?\s*([^.]+)/i,
      /complains?\s+of\s+([^.]+)/i,
      /here\s+for\s+([^.]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.cleanExtracted(match[1]);
      }
    }

    return 'Not clearly specified';
  }

  private extractHPI(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

    // Look for sentences that describe the current illness
    const hpiSentences = sentences.filter(sentence => {
      const hpiKeywords = [
        'pain', 'ache', 'symptoms', 'started', 'began', 'duration',
        'quality', 'severity', 'location', 'radiation', 'timing',
        'aggravating', 'alleviating', 'associated'
      ];

      return hpiKeywords.some(keyword => sentence.includes(keyword));
    });

    return hpiSentences.length > 0
      ? hpiSentences.slice(0, 3).join('. ').trim() + '.'
      : 'Patient describes current symptoms as documented above.';
  }

  private extractPhysicalExam(text: string): string {
    const examKeywords = [
      'vital signs', 'blood pressure', 'heart rate', 'temperature',
      'exam', 'examination', 'inspection', 'palpation', 'auscultation',
      'normal', 'abnormal', 'findings'
    ];

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const examSentences = sentences.filter(sentence =>
      examKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    );

    return examSentences.length > 0
      ? examSentences.join('. ').trim() + '.'
      : 'Physical examination findings as documented.';
  }

  private extractAssessment(text: string): string {
    const assessmentPatterns = [
      /diagnosis\s*:?\s*([^.]+)/i,
      /assessment\s*:?\s*([^.]+)/i,
      /impression\s*:?\s*([^.]+)/i,
      /likely\s+([^.]+)/i,
      /suggests?\s+([^.]+)/i
    ];

    for (const pattern of assessmentPatterns) {
      const match = text.match(pattern);
      if (match) {
        return this.cleanExtracted(match[1]);
      }
    }

    // Look for common medical conditions mentioned
    const conditions = [
      'hypertension', 'diabetes', 'pneumonia', 'bronchitis', 'migraine',
      'arthritis', 'depression', 'anxiety', 'asthma', 'infection'
    ];

    const foundConditions = conditions.filter(condition =>
      text.includes(condition)
    );

    if (foundConditions.length > 0) {
      return `Likely ${foundConditions[0]} based on presentation.`;
    }

    return 'Clinical assessment pending further evaluation.';
  }

  private extractPlan(text: string): string {
    const planPatterns = [
      /plan\s*:?\s*([^.]+)/i,
      /treatment\s*:?\s*([^.]+)/i,
      /recommend\s+([^.]+)/i,
      /will\s+(start|begin|initiate|order)\s+([^.]+)/i,
      /follow\s*up\s+([^.]+)/i
    ];

    const planItems = [];

    for (const pattern of planPatterns) {
      const match = text.match(pattern);
      if (match) {
        planItems.push(this.cleanExtracted(match[1] || match[2]));
      }
    }

    return planItems.length > 0
      ? planItems.join('. ') + '.'
      : 'Treatment plan to be determined based on assessment.';
  }

  private extractMedications(text: string): string[] {
    const commonMeds = [
      'ibuprofen', 'acetaminophen', 'aspirin', 'metformin', 'lisinopril',
      'amlodipine', 'atorvastatin', 'omeprazole', 'metoprolol', 'hydrochlorothiazide'
    ];

    return commonMeds.filter(med => text.includes(med));
  }

  private extractVitals(text: string): string {
    const vitalPatterns = [
      /blood\s+pressure\s*:?\s*(\d+\/\d+)/i,
      /bp\s*:?\s*(\d+\/\d+)/i,
      /heart\s+rate\s*:?\s*(\d+)/i,
      /hr\s*:?\s*(\d+)/i,
      /temperature\s*:?\s*(\d+\.?\d*)/i,
      /temp\s*:?\s*(\d+\.?\d*)/i
    ];

    const vitals = [];
    for (const pattern of vitalPatterns) {
      const match = text.match(pattern);
      if (match) {
        vitals.push(match[0]);
      }
    }

    return vitals.length > 0 ? vitals.join(', ') : 'Vitals as documented';
  }

  private cleanExtracted(text: string): string {
    return text.trim()
      .replace(/^[,.\s]+/, '')
      .replace(/[,.\s]+$/, '')
      .replace(/\s+/g, ' ');
  }

  private generateBasicSOAP(data: MedicalData, patient: PatientData, template: Template | null): SOAPNote {
    return {
      subjective: this.generateSubjective(data, patient),
      objective: this.generateObjective(data),
      assessment: data.assessment || 'Assessment pending',
      plan: data.plan || 'Plan to be determined'
    };
  }

  private generateSubjective(data: MedicalData, patient: PatientData): string {
    const age = patient.dob ? this.calculateAge(patient.dob) : 'unknown age';
    const gender = patient.gender || 'patient';

    let subjective = `${age} year old ${gender}`;

    if (data.chiefComplaint) {
      subjective += ` presents with ${data.chiefComplaint}.`;
    }

    if (data.hpi) {
      subjective += ` ${data.hpi}`;
    }

    return subjective;
  }

  private generateObjective(data: MedicalData): string {
    let objective = 'Physical examination: ';

    if (data.vitals) {
      objective += `Vital signs: ${data.vitals}. `;
    }

    if (data.physicalExam) {
      objective += data.physicalExam;
    } else {
      objective += 'Examination findings as documented.';
    }

    return objective;
  }

  private formatNote(soap: SOAPNote, patient: PatientData): string {
    return `
**CLINICAL NOTE - ${new Date().toLocaleDateString()}**

**Patient:** ${patient.name || 'Unknown'}
**MRN:** ${patient.mrn || 'Not provided'}
**Date:** ${new Date().toLocaleDateString()}

**SUBJECTIVE:**
${soap.subjective}

**OBJECTIVE:**
${soap.objective}

**ASSESSMENT:**
${soap.assessment}

**PLAN:**
${soap.plan}

---
*Note generated using local fallback processor due to AI service unavailability*
*Please review and edit as needed*
`.trim();
  }

  private generatePatientSummary(data: MedicalData, patient: PatientData): string {
    const age = patient.dob ? this.calculateAge(patient.dob) : 'unknown age';
    return `${age} year old patient with ${data.chiefComplaint || 'medical concerns'} requiring evaluation and treatment.`;
  }

  private calculateAge(dob: string): number {
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }

    return age;
  }

  private createEmergencyFallback(transcript: string, patient: PatientData): ProcessedNote {
    const emergencyNote = `
**EMERGENCY FALLBACK NOTE**

**Patient:** ${patient.name || 'Unknown'}
**Date:** ${new Date().toLocaleDateString()}

**ORIGINAL DICTATION:**
${transcript}

**NOTE:** This note was generated using emergency fallback processing.
All AI services were unavailable. Please review the original dictation
and create a proper clinical note manually.

**STATUS:** Requires manual review and completion by clinician.
`;

    return {
      formatted: emergencyNote,
      sections: {
        chiefComplaint: 'Requires manual entry',
        historyOfPresentIllness: 'See original dictation above',
        physicalExam: 'Requires manual entry',
        assessment: 'Requires manual entry',
        plan: 'Requires manual entry',
        patientSummary: 'Patient requires clinical evaluation - AI processing unavailable'
      },
      metadata: {
        processedAt: new Date().toISOString(),
        model: 'Emergency Fallback',
        confidence: 0.1
      }
    };
  }
}

// Types for local processing
interface MedicalData {
  chiefComplaint?: string;
  hpi?: string;
  physicalExam?: string;
  assessment?: string;
  plan?: string;
  medications?: string[];
  vitals?: string;
}

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

// Export singleton instance
export const localFallbackService = new LocalFallbackService();