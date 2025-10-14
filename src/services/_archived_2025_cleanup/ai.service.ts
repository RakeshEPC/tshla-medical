import { logError, logWarn, logInfo, logDebug } from '../logger.service';
/**
 * AI Processing Service
 * Handles all AI-related operations
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
  private apiEndpoint = '/api/note';

  /**
   * Process raw dictation into structured SOAP note
   */
  public async processToSOAP(
    transcript: string,
    patient: any,
    visitDate: string,
    options: ProcessingOptions = {}
  ): Promise<{ success: boolean; soap?: SOAPNote; error?: string }> {
    try {
      // Extract the dictated portion (after "TODAY'S VISIT")
      const dictationStartIndex = transcript.indexOf("TODAY'S VISIT");
      const dictatedPortion =
        dictationStartIndex > -1 ? transcript.substring(dictationStartIndex) : transcript;

      // Build enriched context with all patient data
      const enrichedContext = this.buildEnrichedContext(patient, visitDate, dictatedPortion);

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: enrichedContext,
          meta: {
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            visitDate,
            conditions: patient.conditions,
            medications: patient.medications,
            labs: patient.labs,
            screeningScores: patient.screeningScores,
            lastVisit: patient.visitHistory?.[0],
          },
          template: options.template,
          mergeHistory: options.includeHistory ?? true,
          includeMentalHealth: options.includeMentalHealth ?? true,
          instructions:
            'Integrate all patient history, medications, conditions, labs, and mental health scores into appropriate SOAP sections. Include current medications in the plan, active conditions in assessment, and recent labs in objective.',
        }),
      });

      if (!response.ok) {
        throw new Error(`AI processing failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Merge the AI result with patient data to ensure nothing is missed
      const mergedSoap = this.mergePatientDataIntoSoap(result.soap, patient, visitDate);

      return {
        success: true,
        soap: mergedSoap,
      };
    } catch (error) {
      logError('ai', 'Error message', {});
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }

  /**
   * Build enriched context with all patient information
   */
  private buildEnrichedContext(patient: any, visitDate: string, dictatedPortion: string): string {
    let context = `COMPLETE PATIENT CONTEXT FOR SOAP NOTE GENERATION:\n\n`;

    // Patient demographics
    context += `PATIENT: ${patient.firstName} ${patient.lastName} (${patient.id})\n`;
    context += `DATE OF SERVICE: ${visitDate}\n\n`;

    // Active conditions
    context += `ACTIVE MEDICAL CONDITIONS:\n`;
    patient.conditions
      ?.filter((c: any) => c.status !== 'resolved')
      .forEach((c: any) => {
        context += `- ${c.name} (${c.icd10}) - Since ${c.diagnosisDate}\n`;
        if (c.notes) context += `  Notes: ${c.notes}\n`;
      });

    // Current medications
    context += `\nCURRENT MEDICATIONS:\n`;
    patient.medications
      ?.filter((m: any) => m.status === 'active')
      .forEach((m: any) => {
        context += `- ${m.name} ${m.dosage} ${m.frequency} (Started: ${m.startDate}, Effectiveness: ${m.effectiveness || 'not assessed'})\n`;
      });

    // Recent labs
    context += `\nRECENT LAB RESULTS:\n`;
    patient.labs?.slice(0, 5).forEach((l: any) => {
      const flag = l.abnormal ? ` [ABNORMAL: ${l.abnormal}]` : ' [NORMAL]';
      context += `- ${l.name}: ${l.value} ${l.unit}${flag} (${l.date})\n`;
    });

    // Mental health scores
    if (patient.screeningScores) {
      context += `\nMENTAL HEALTH SCREENING RESULTS:\n`;
      if (patient.screeningScores.PHQ9) {
        const phq = patient.screeningScores.PHQ9;
        context += `- PHQ-9 Depression Screen: Score ${phq.score} - ${phq.severity} (${phq.date})\n`;
        if (phq.score >= 10) {
          context += `  ALERT: Moderate to severe depression requiring attention\n`;
        }
      }
      if (patient.screeningScores.GAD7) {
        const gad = patient.screeningScores.GAD7;
        context += `- GAD-7 Anxiety Screen: Score ${gad.score} - ${gad.severity} (${gad.date})\n`;
        if (gad.score >= 10) {
          context += `  ALERT: Moderate to severe anxiety requiring attention\n`;
        }
      }
    }

    // Last visit
    if (patient.visitHistory && patient.visitHistory.length > 0) {
      const lastVisit = patient.visitHistory[0];
      context += `\nLAST VISIT (${lastVisit.date}):\n`;
      context += `- Chief Complaint: ${lastVisit.chiefComplaint}\n`;
      context += `- Assessment: ${lastVisit.assessment}\n`;
      context += `- Plan: ${lastVisit.plan}\n`;
    }

    // Today's dictation
    context += `\nTODAY'S DICTATION:\n${dictatedPortion}\n`;

    return context;
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
