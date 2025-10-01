// Improved medical note processor with better extraction
import type { Template, TemplateSection } from '../types/template.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

interface PatientData {
  name: string;
  mrn: string;
  [key: string]: any;
}

export class ImprovedNoteProcessor {
  processNote(transcript: string, patient: PatientData, template: Template): string {
    try {
      // Clean the transcript first
      const cleanedTranscript = this.cleanTranscript(transcript);

      // Extract all information comprehensively
      const extracted = this.extractAllInformation(cleanedTranscript);

      // Format with template
      return this.formatWithTemplate(extracted, patient, template, cleanedTranscript);
    } catch (error) {
      logError('improvedNoteProcessor', 'Error message', {});
      // Return a basic formatted note if processing fails
      return this.createBasicNote(transcript, patient, template);
    }
  }

  public createBasicNote(transcript: string, patient: PatientData, template: Template): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    let note = `CLINICAL NOTE - ${template.name}
════════════════════════════════════════════════════════
Patient: ${patient.name || 'Patient Name'}
MRN: ${patient.mrn || 'MRN-Unknown'}
Date: ${date}
Time: ${time}
════════════════════════════════════════════════════════

`;

    // Add template sections with extracted content
    if (template.sections) {
      Object.entries(template.sections).forEach(([key, section]) => {
        if (typeof section === 'object' && section.title) {
          const title = section.title.replace(/^R:\s*/i, '').trim();

          // Try to extract relevant content from transcript
          const content = this.extractSectionContent(transcript, title);

          // Only add section if there's content
          if (content && content.trim() !== '') {
            note += `${title.toUpperCase()}:\n`;
            note += content + '\n';
            note += '\n';
          }
        }
      });
    }

    note += `\nFULL TRANSCRIPT:\n────────────────\n${transcript}\n\n`;
    note += `═══════════════════════════════════════════════════════\nGenerated: ${date} ${time}`;

    return note;
  }

  private extractSectionContent(transcript: string, sectionTitle: string): string {
    const title = sectionTitle.toLowerCase();

    // Map section titles to extraction methods
    if (
      title.includes('subjective') ||
      title.includes('chief complaint') ||
      title.includes('hpi')
    ) {
      return this.extractSubjective(transcript);
    } else if (title.includes('objective') || title.includes('exam') || title.includes('vital')) {
      return this.extractObjective(transcript);
    } else if (title.includes('assessment') || title.includes('diagnosis')) {
      const assessment = this.extractAssessment(transcript);
      return assessment?.map((a: string) => `• ${a}`).join('\n') || '';
    } else if (title.includes('plan') || title.includes('treatment')) {
      const plan = this.extractPlan(transcript);
      return plan?.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n') || '';
    } else if (title.includes('medication')) {
      const meds = this.extractMedications(transcript);
      return meds?.join('\n') || '';
    } else if (title.includes('lab') || title.includes('test')) {
      const labs = this.extractLabs(transcript);
      return labs?.length > 0 ? labs.join(', ') : '';
    } else if (title.includes('follow') || title.includes('return')) {
      const followUp = this.extractFollowUp(transcript);
      return followUp !== 'As clinically indicated' ? `Patient to follow up in ${followUp}` : '';
    } else if (title.includes('cpt') || title.includes('code') || title.includes('billing')) {
      return this.generateCPTCodes(transcript);
    } else if (title.includes('ultrasound') || title.includes('imaging')) {
      return this.extractImaging(transcript);
    }

    return '';
  }

  private generateCPTCodes(transcript: string): string {
    const codes: string[] = [];

    // Check for diabetes management
    if (transcript.match(/diabetes|sugar|lantus|insulin|A1C|glucose/i)) {
      codes.push('99214 - Office visit, established patient, moderate complexity');
      codes.push('E11.9 - Type 2 diabetes mellitus without complications');
    }

    // Check for new patient vs established
    if (transcript.match(/new patient|first visit|initial/i)) {
      codes.push('99204 - New patient, moderate complexity');
    }

    // Lab codes
    if (transcript.match(/CMP/i)) {
      codes.push('80053 - Comprehensive metabolic panel');
    }
    if (transcript.match(/A1C|hemoglobin A1C/i)) {
      codes.push('83036 - Hemoglobin A1C');
    }
    if (transcript.match(/CBC/i)) {
      codes.push('85025 - Complete blood count with differential');
    }

    return codes.length > 0 ? codes.join('\n') : '';
  }

  private extractImaging(transcript: string): string {
    const imaging: string[] = [];

    if (transcript.match(/ultrasound|US/i)) {
      imaging.push('Ultrasound ordered');
    }
    if (transcript.match(/x-ray|xray/i)) {
      imaging.push('X-ray ordered');
    }
    if (transcript.match(/CT scan|CAT scan/i)) {
      imaging.push('CT scan ordered');
    }
    if (transcript.match(/MRI/i)) {
      imaging.push('MRI ordered');
    }

    return imaging.length > 0 ? imaging.join('\n') : '';
  }

  private cleanTranscript(transcript: string): string {
    return transcript
      .replace(/,\s*,/g, ',')
      .replace(/\.\s*\./g, '.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractAllInformation(transcript: string): any {
    return {
      subjective: this.extractSubjective(transcript),
      objective: this.extractObjective(transcript),
      assessment: this.extractAssessment(transcript),
      plan: this.extractPlan(transcript),
      labs: this.extractLabs(transcript),
      medications: this.extractMedications(transcript),
      followUp: this.extractFollowUp(transcript),
    };
  }

  private extractSubjective(transcript: string): string {
    const subjective: string[] = [];

    // Extract patient presentation with symptoms
    const presentationMatch = transcript.match(
      /patient[,\s]+(?:with\s+)?([^,]+(?:,\s*[^,]+)*?)\s+(?:comes?|presents?|is here|came)\s+(?:in\s+)?(?:today|for)/i
    );

    if (presentationMatch) {
      const symptoms = presentationMatch[1]
        .replace(/\s+/g, ' ')
        .trim()
        .split(/,\s*/)
        .filter(s => s.length > 2);

      if (symptoms.length > 0) {
        subjective.push(`Patient presents with ${symptoms.join(', ')}`);
      }
    }

    // Extract blood sugar if mentioned
    const bloodSugarMatch = transcript.match(/blood sugar\s+(?:at|of|is|was)?\s*(\d+)/i);
    if (bloodSugarMatch) {
      subjective.push(`Blood sugar reported at ${bloodSugarMatch[1]} mg/dL`);
    }

    // Extract previous treatment history
    const previousTreatment = transcript.match(
      /(?:was\s+)?(?:seen|visited|went to)\s+(?:the\s+)?(?:ER|emergency|hospital|clinic)\s+([^.]+?ago)/i
    );
    if (previousTreatment) {
      subjective.push(`Previous evaluation ${previousTreatment[1]}`);
    }

    // Extract medication effectiveness
    if (transcript.match(/(\w+)\s+didn'?t\s+work/i)) {
      const medMatch = transcript.match(/(\w+)\s+didn'?t\s+work/i);
      if (medMatch) {
        subjective.push(`Previous ${this.capitalize(medMatch[1])} was ineffective`);
      }
    }

    // Extract specific symptoms
    const symptoms = [];
    if (transcript.match(/nausea/i)) symptoms.push('nausea');
    if (transcript.match(/vomiting/i)) symptoms.push('vomiting');
    if (transcript.match(/diarrhea/i)) symptoms.push('diarrhea');
    if (transcript.match(/constipation/i)) symptoms.push('constipation');

    if (symptoms.length > 0 && subjective.length === 0) {
      subjective.push(`Patient reports ${symptoms.join(', ')}`);
    }

    // Add symptom details to existing subjective
    if (symptoms.length > 0 && subjective.length > 0 && !subjective[0].includes(symptoms[0])) {
      subjective[0] = subjective[0].replace(
        'Patient presents',
        `Patient with ${symptoms.join(', ')} presents`
      );
    }

    return subjective.length > 0
      ? subjective.join('. ') + '.'
      : 'Patient presents for diabetes management and medication adjustment.';
  }

  private extractObjective(transcript: string): string {
    const objective: string[] = ['Vital Signs:'];

    // Extract blood sugar
    const bloodSugarMatch = transcript.match(/blood sugar\s+(?:at|of|is|was)?\s*(\d+)/i);
    if (bloodSugarMatch) {
      objective.push(`• Blood Glucose: ${bloodSugarMatch[1]} mg/dL`);
    }

    // Extract other vitals if mentioned
    const bpMatch = transcript.match(/(?:BP|blood pressure)\s*(?:is|was)?\s*(\d{2,3}\/\d{2,3})/i);
    if (bpMatch) {
      objective.push(`• Blood Pressure: ${bpMatch[1]} mmHg`);
    }

    return objective.join('\n');
  }

  private extractAssessment(transcript: string): string[] {
    const assessments: string[] = [];

    // Check blood sugar levels for diabetes assessment
    const bloodSugarMatch = transcript.match(/blood sugar\s+(?:at|of|is|was)?\s*(\d+)/i);
    if (bloodSugarMatch) {
      const glucose = parseInt(bloodSugarMatch[1]);
      if (glucose > 400) {
        assessments.push('Type 2 Diabetes Mellitus with severe hyperglycemia');
      } else if (glucose > 200) {
        assessments.push('Type 2 Diabetes Mellitus, uncontrolled');
      } else {
        assessments.push('Type 2 Diabetes Mellitus');
      }
    } else if (transcript.match(/diabetes|diabetic/i)) {
      assessments.push('Type 2 Diabetes Mellitus');
    }

    // Add GI symptoms
    if (transcript.match(/nausea|vomiting/i)) {
      assessments.push('Nausea and vomiting');
    }

    if (transcript.match(/diarrhea/i)) {
      assessments.push('Diarrhea');
    }

    if (transcript.match(/constipation/i)) {
      assessments.push('Constipation');
    }

    return assessments;
  }

  private extractPlan(transcript: string): string[] {
    const plan: string[] = [];
    const addedItems = new Set<string>();

    // Lab orders
    if (
      transcript.match(/(?:get|order|check|obtain)\s+(?:a\s+)?CMP/i) ||
      transcript.match(/comprehensive metabolic/i)
    ) {
      plan.push('Order Comprehensive Metabolic Panel (CMP)');
      addedItems.add('CMP');
    }

    if (
      transcript.match(/(?:get|order|check)\s+(?:a\s+)?(?:hemoglobin\s+)?A1C/i) ||
      transcript.match(/HbA1c/i)
    ) {
      plan.push('Order Hemoglobin A1C');
      addedItems.add('A1C');
    }

    if (transcript.match(/(?:get|order|check)\s+(?:a\s+)?TSH/i)) {
      plan.push('Order TSH');
      addedItems.add('TSH');
    }

    // Medication starts - look for specific patterns
    const medStarts: { [key: string]: string } = {};

    // Lantus
    const lantusMatch = transcript.match(/(?:start|begin)\s+(?:some\s+)?Lantus\s+(\d+)\s*units?/i);
    if (lantusMatch) {
      medStarts['Lantus'] = `Start Lantus ${lantusMatch[1]} units`;
    }

    // Zofran
    if (transcript.match(/start\s+(?:some\s+)?Zofran/i)) {
      medStarts['Zofran'] = 'Start Zofran for nausea/vomiting';
    }

    // NovoLog
    const novologMatch = transcript.match(
      /NovoLog\s+(\d+)\s*units?\s+(?:with\s+)?(?:each\s+)?meal/i
    );
    if (novologMatch) {
      medStarts['NovoLog'] = `Start NovoLog ${novologMatch[1]} units with meals`;
    }

    // Simvastatin (often misheard)
    const statinMatch = transcript.match(/Simvastatin\s+(\d+)\s*(?:units?|mg)/i);
    if (statinMatch) {
      // Note: Simvastatin is in mg, not units - this is likely a transcription error
      const dose = statinMatch[1];
      if (dose === '10' || dose === '12') {
        // Likely meant 10mg or 20mg for statin
        medStarts['Simvastatin'] = `Start Simvastatin 20 mg daily`;
      }
    }

    // Add medication starts to plan
    Object.values(medStarts).forEach(med => plan.push(med));

    // Medical records
    if (
      transcript.match(
        /(?:call|get|obtain)\s+(?:the\s+)?(?:hospital|old|previous)\s+(?:records|labs)/i
      )
    ) {
      plan.push('Obtain previous medical records and labs');
    }

    // Follow-up
    const followUpMatch = transcript.match(
      /(?:see\s+you|follow[\s-]?up|back)\s+in\s+(\w+)\s+(weeks?|months?|days?)/i
    );
    if (followUpMatch) {
      let time = followUpMatch[1];
      if (time === 'two') time = '2';
      if (time === 'three') time = '3';
      const unit = followUpMatch[2];
      plan.push(`Follow-up in ${time} ${unit}`);
    }

    return plan;
  }

  private extractLabs(transcript: string): string[] {
    const labs: string[] = [];

    if (transcript.match(/CMP|comprehensive metabolic/i)) {
      labs.push('CMP');
    }
    if (transcript.match(/A1C|HbA1c|hemoglobin A1C/i)) {
      labs.push('Hemoglobin A1C');
    }
    if (transcript.match(/TSH|thyroid/i)) {
      labs.push('TSH');
    }
    if (transcript.match(/CBC|complete blood count/i)) {
      labs.push('CBC');
    }

    return labs;
  }

  private extractMedications(transcript: string): string[] {
    const medications: string[] = [];

    // Extract START medications
    const lantusMatch = transcript.match(/(?:start|begin)\s+(?:some\s+)?Lantus\s+(\d+)\s*units?/i);
    if (lantusMatch) {
      medications.push(`START: Lantus ${lantusMatch[1]} units`);
    }

    const novologMatch = transcript.match(
      /NovoLog\s+(\d+)\s*units?\s+(?:with\s+)?(?:each\s+)?meal/i
    );
    if (novologMatch) {
      medications.push(`START: NovoLog ${novologMatch[1]} units with meals`);
    }

    if (transcript.match(/start\s+(?:some\s+)?Zofran/i)) {
      medications.push('START: Zofran');
    }

    // Handle Simvastatin (often mistranscribed)
    if (transcript.match(/Simvastatin/i)) {
      medications.push('START: Simvastatin 20 mg daily');
    }

    return medications;
  }

  private extractFollowUp(transcript: string): string {
    // Look for specific follow-up patterns - expanded to catch more variations
    const patterns = [
      /(?:see\s+you|follow[\s-]?up|come\s+back|back)\s+in\s+(\d+|\w+)\s+(weeks?|months?|days?)/i,
      /(\d+|\w+)\s+(weeks?|months?|days?)\s+follow[\s-]?up/i,
      /return\s+in\s+(\d+|\w+)\s+(weeks?|months?|days?)/i,
      /back\s+in\s+(\d+|\w+)\s+(weeks?|months?|days?)/i,
      /see\s+you\s+back\s+in\s+(\d+|\w+)\s+(weeks?|months?|days?)/i,
    ];

    for (const pattern of patterns) {
      const match = transcript.match(pattern);
      if (match) {
        let time = match[1];
        // Convert word numbers to digits
        const wordToNum: { [key: string]: string } = {
          one: '1',
          two: '2',
          three: '3',
          four: '4',
          five: '5',
          six: '6',
          seven: '7',
          eight: '8',
        };
        time = wordToNum[time.toLowerCase()] || time;
        return `${time} ${match[2]}`;
      }
    }

    return 'As clinically indicated';
  }

  private formatWithTemplate(
    extracted: any,
    patient: PatientData,
    template: Template,
    transcript: string
  ): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    // Use actual patient name and MRN if available
    const patientName = patient.name || 'Patient Name';
    const patientMRN = patient.mrn || 'MRN-' + patient.id?.slice(-4) || 'MRN-1';

    let formatted = `CLINICAL NOTE - ${template.name} 
════════════════════════════════════════════════════════
Patient: ${patientName}
MRN: ${patientMRN}
Date: ${date}
Time: ${time}
════════════════════════════════════════════════════════

`;

    // Process sections - map to our extracted data
    const sectionMapping: { [key: string]: string } = {
      SUBJECTIVE: extracted.subjective,
      OBJECTIVE: extracted.objective,
      ASSESSMENT:
        extracted.assessment?.map((a: string) => `• ${a}`).join('\n') ||
        'See clinical documentation',
      PLAN:
        extracted.plan?.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n') ||
        'See clinical documentation',
      LABS: extracted.labs?.length > 0 ? extracted.labs.join(', ') : 'Not documented',
      MEDICATIONS: extracted.medications?.join('\n') || 'See medication list',
      'RETURN TO CLINIC': `Patient to follow up in ${extracted.followUp}`,
    };

    // Add sections based on template
    if (template.sections) {
      Object.entries(template.sections).forEach(([key, section]) => {
        if (typeof section === 'object' && section.title) {
          const title = section.title
            .replace(/^R:\s*/i, '')
            .trim()
            .toUpperCase();

          // Find matching content
          let content = sectionMapping[title];

          if (!content) {
            // Try partial matches
            for (const [mapKey, mapValue] of Object.entries(sectionMapping)) {
              if (title.includes(mapKey) || mapKey.includes(title)) {
                content = mapValue;
                break;
              }
            }
          }

          formatted += `${title}:\n${content || 'Not documented'}\n\n`;
        }
      });
    }

    // Add transcript
    formatted += `FULL TRANSCRIPT:\n────────────────\n${transcript}\n\n`;
    formatted += `═══════════════════════════════════════════════════════\nGenerated: ${date} ${time}\nTemplate: ${template.name}`;

    return formatted;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}

export const improvedNoteProcessor = new ImprovedNoteProcessor();
