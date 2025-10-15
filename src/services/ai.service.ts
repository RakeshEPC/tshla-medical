import { logError, logWarn, logInfo, logDebug } from './logger.service';
import { azureAIService } from './azureAI.service';

/**
 * AI Processing Service
 * Handles all AI-related operations
 * Updated to use Azure OpenAI service directly instead of API endpoint
 */

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  mentalHealth?: string;
  followUpTasks?: string;
  timestamp?: string;
}

export interface ProcessingOptions {
  template?: any;
  includeHistory?: boolean;
  includeMentalHealth?: boolean;
}

export class AIService {
  /**
   * Process raw dictation into structured SOAP note
   * Now using Azure OpenAI service directly
   */
  public async processToSOAP(
    transcript: string,
    patient: any,
    visitDate: string,
    options: ProcessingOptions = {}
  ): Promise<{ success: boolean; soap?: SOAPNote; error?: string }> {
    try {
      logInfo('ai', 'Processing transcript to SOAP note', {
        transcriptLength: transcript.length,
        patientId: patient.id
      });

      // Build patient data for Azure AI service
      const patientData = {
        fullName: `${patient.firstName} ${patient.lastName}`,
        name: `${patient.firstName} ${patient.lastName}`,
        mrn: patient.id || patient.mrn || 'Unknown',
        dateOfBirth: patient.dob || 'Unknown',
        dob: patient.dob || 'Unknown'
      };

      // Build additional context with patient information
      const additionalContext = this.buildPatientContext(patient);

      // Use Azure AI service to process the transcription
      logDebug('ai', 'Calling Azure AI service', { template: options.template?.name });
      const result = await azureAIService.processMedicalTranscription(
        transcript,
        patientData as any,
        options.template || null,
        additionalContext
      );

      if (!result || !result.formatted) {
        throw new Error('AI processing returned no results');
      }

      logInfo('ai', 'Successfully processed transcript', {
        hasFormatted: !!result.formatted,
        hasSections: !!result.sections
      });

      // Convert the Azure AI result to SOAP format
      const soap = this.convertToSOAPNote(result, patient, visitDate);

      return {
        success: true,
        soap
      };
    } catch (error) {
      logError('ai', 'Failed to process transcript to SOAP', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientId: patient.id
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }

  /**
   * Convert Azure AI ProcessedNote to SOAPNote format
   */
  private convertToSOAPNote(result: any, patient: any, visitDate: string): SOAPNote {
    const sections = result.sections || {};

    // Build SOAP sections from the AI result
    let subjective = sections.chiefComplaint || sections.historyOfPresentIllness || '';
    let objective = sections.physicalExam || sections.reviewOfSystems || '';
    let assessment = sections.assessment || '';
    let plan = sections.plan || '';

    // Merge patient data to ensure completeness
    const mergedSoap = this.mergePatientDataIntoSoap(
      { subjective, objective, assessment, plan },
      patient,
      visitDate
    );

    return mergedSoap;
  }

  /**
   * Build simplified patient context
   */
  private buildPatientContext(patient: any): string {
    let context = '';

    // Active conditions
    const activeConditions = patient.conditions?.filter((c: any) => c.status !== 'resolved');
    if (activeConditions?.length > 0) {
      context += 'Active Conditions: ';
      context += activeConditions.map((c: any) => c.name).join(', ');
      context += '\n';
    }

    // Current medications
    const activeMeds = patient.medications?.filter((m: any) => m.status === 'active');
    if (activeMeds?.length > 0) {
      context += 'Current Medications: ';
      context += activeMeds.map((m: any) => `${m.name} ${m.dosage}`).join(', ');
      context += '\n';
    }

    // Recent labs
    if (patient.labs?.length > 0) {
      context += 'Recent Labs: ';
      context += patient.labs.slice(0, 3).map((l: any) => `${l.name} ${l.value}${l.unit}`).join(', ');
      context += '\n';
    }

    return context;
  }


  /**
   * Extract mental health section from patient data
   */
  private extractMentalHealthSection(patient: any): string {
    if (!patient.screeningScores) return '';

    let mentalHealth = 'MENTAL HEALTH SCREENING:\n';

    if (patient.screeningScores.PHQ9) {
      const phq = patient.screeningScores.PHQ9;
      mentalHealth += `• PHQ-9 Score: ${phq.score} - ${phq.severity} (${phq.date})\n`;
      if (phq.score >= 10) {
        mentalHealth += '  → Moderate to severe depression, consider treatment adjustment\n';
      }
    }

    if (patient.screeningScores.GAD7) {
      const gad = patient.screeningScores.GAD7;
      mentalHealth += `• GAD-7 Score: ${gad.score} - ${gad.severity} (${gad.date})\n`;
      if (gad.score >= 10) {
        mentalHealth += '  → Moderate to severe anxiety, evaluate current management\n';
      }
    }

    return mentalHealth.trim();
  }

  /**
   * Merge patient data into SOAP note to ensure completeness
   */
  private mergePatientDataIntoSoap(soap: any, patient: any, visitDate: string): SOAPNote {
    const subjective = soap?.subjective || soap?.S || '';
    let objective = soap?.objective || soap?.O || '';
    let assessment = soap?.assessment || soap?.A || '';
    let plan = soap?.plan || soap?.P || '';
    let mentalHealth = soap?.mentalHealth || '';
    let followUpTasks = soap?.followUpTasks || '';

    // Ensure recent labs are in objective if not already mentioned
    if (!objective.toLowerCase().includes('lab')) {
      objective += '\n\nRECENT LABS:\n';
      patient.labs?.slice(0, 3).forEach((l: any) => {
        const flag = l.abnormal ? ` (${l.abnormal})` : '';
        objective += `• ${l.name}: ${l.value} ${l.unit}${flag} (${l.date})\n`;
      });
    }

    // Build mental health section if patient has scores
    if (patient.screeningScores && !mentalHealth) {
      mentalHealth = 'MENTAL HEALTH SCREENING:\n';
      if (patient.screeningScores.PHQ9) {
        const phq = patient.screeningScores.PHQ9;
        mentalHealth += `• PHQ-9 Score: ${phq.score} - ${phq.severity} (${phq.date})\n`;
        if (phq.score >= 10) {
          mentalHealth += '  → Moderate to severe depression, consider treatment adjustment\n';
        }
      }
      if (patient.screeningScores.GAD7) {
        const gad = patient.screeningScores.GAD7;
        mentalHealth += `• GAD-7 Score: ${gad.score} - ${gad.severity} (${gad.date})\n`;
        if (gad.score >= 10) {
          mentalHealth += '  → Moderate to severe anxiety, evaluate current management\n';
        }
      }
    }

    // Ensure active conditions are in assessment
    const activeConditions = patient.conditions?.filter((c: any) => c.status !== 'resolved');
    if (
      activeConditions?.length > 0 &&
      !assessment.toLowerCase().includes(activeConditions[0].name.toLowerCase())
    ) {
      assessment += '\n\nACTIVE CONDITIONS:\n';
      activeConditions.forEach((c: any) => {
        assessment += `• ${c.name} (${c.icd10}) - ${c.status}\n`;
      });
    }

    // Ensure current medications are in plan
    if (!plan.toLowerCase().includes('continue') && !plan.toLowerCase().includes('medication')) {
      plan += '\n\nMEDICATIONS:\n';
      patient.medications
        ?.filter((m: any) => m.status === 'active')
        .forEach((m: any) => {
          plan += `• CONTINUE ${m.name} ${m.dosage} ${m.frequency}\n`;
        });
    }

    return {
      subjective: subjective.trim(),
      objective: objective.trim(),
      assessment: assessment.trim(),
      plan: plan.trim(),
      mentalHealth: mentalHealth.trim(),
      followUpTasks: followUpTasks.trim() || 'None specified',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Format SOAP note for display or printing
   */
  public formatSOAPNote(
    soap: SOAPNote,
    patient: any,
    visitDate: string,
    includeScreenings = true
  ): string {
    let formatted = `DATE OF SERVICE: ${visitDate}\n`;
    formatted += `PATIENT: ${patient.firstName} ${patient.lastName} (${patient.id})\n`;
    formatted += `═══════════════════════════════════════════════════════════\n\n`;

    formatted += `SUBJECTIVE:\n${soap.subjective}\n\n`;
    formatted += `OBJECTIVE:\n${soap.objective}\n\n`;
    formatted += `ASSESSMENT:\n${soap.assessment}\n\n`;
    formatted += `PLAN:\n${soap.plan}\n`;

    // Add mental health section if present
    if (soap.mentalHealth && soap.mentalHealth.length > 0) {
      formatted += `\n═══════════════════════════════════════════════════════════\n`;
      formatted += `\n${soap.mentalHealth}\n`;
    }

    // Add follow-up tasks section
    if (soap.followUpTasks && soap.followUpTasks !== 'None specified') {
      formatted += `\n═══════════════════════════════════════════════════════════\n`;
      formatted += `\nFOLLOW-UP TASKS FOR STAFF:\n${soap.followUpTasks}\n`;
    }

    return formatted;
  }

  /**
   * Generate patient summary for context
   */
  public generatePatientSummary(patient: any): string {
    let summary = `=== PATIENT INFORMATION ===\n`;
    summary += `Name: ${patient.firstName} ${patient.lastName}\n`;
    summary += `ID: ${patient.id} | AVA: ${patient.avaId}\n`;
    summary += `DOB: ${patient.dob}\n\n`;

    summary += `=== ACTIVE CONDITIONS ===\n`;
    patient.conditions
      ?.filter((c: any) => c.status !== 'resolved')
      .forEach((c: any) => {
        summary += `• ${c.name} (${c.icd10})\n`;
      });

    summary += `\n=== CURRENT MEDICATIONS ===\n`;
    patient.medications
      ?.filter((m: any) => m.status === 'active')
      .forEach((m: any) => {
        summary += `• ${m.name} ${m.dosage} ${m.frequency}\n`;
      });

    summary += `\n=== RECENT LABS ===\n`;
    patient.labs?.slice(0, 5).forEach((l: any) => {
      const flag = l.abnormal ? ` [${l.abnormal}]` : '';
      summary += `• ${l.name}: ${l.value} ${l.unit}${flag} (${l.date})\n`;
    });

    if (patient.screeningScores) {
      summary += `\n=== MENTAL HEALTH SCREENING ===\n`;
      if (patient.screeningScores.PHQ9) {
        const phq = patient.screeningScores.PHQ9;
        summary += `PHQ-9: ${phq.score} - ${phq.severity} (${phq.date})\n`;
      }
      if (patient.screeningScores.GAD7) {
        const gad = patient.screeningScores.GAD7;
        summary += `GAD-7: ${gad.score} - ${gad.severity} (${gad.date})\n`;
      }
    }

    return summary;
  }
}

// Singleton instance
export const aiService = new AIService();
