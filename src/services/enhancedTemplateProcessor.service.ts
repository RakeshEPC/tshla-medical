/**
 * Enhanced Template Processor for Better Medical Note Extraction
 * Fixes issues with medication extraction, assessment, and plan formatting
 * NOW WITH AUTOMATIC CPT BILLING SUGGESTIONS!
 */

import type { Template } from '../types/template.types';
import type { PatientData } from './patientData.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';
import { cptBillingAnalyzer } from './cptBillingAnalyzer.service';

export class EnhancedTemplateProcessor {
  /**
   * Process transcript with enhanced extraction logic
   */
  async processTranscript(
    transcript: string,
    patient: PatientData,
    template: Template | null
  ): Promise<string> {
    try {
      logDebug('enhancedTemplateProcessor', 'Debug message', {});
      logDebug('enhancedTemplateProcessor', 'Debug message', {});
      logDebug('enhancedTemplateProcessor', 'Debug message', {});
      logDebug('enhancedTemplateProcessor', 'Debug message', {});
      
      // Clean the transcript first
      const cleanedTranscript = this.cleanTranscript(transcript);
      logDebug('enhancedTemplateProcessor', 'Debug message', {});
      
      // Extract all medical information with better logic
      const extracted = this.extractMedicalInfo(cleanedTranscript, patient);
      logDebug('enhancedTemplateProcessor', 'Debug message', {}); 
      
      // Format based on template
      let formatted: string;
      if (template?.sections) {
        logDebug('enhancedTemplateProcessor', 'Debug message', {});
        formatted = this.formatWithTemplate(extracted, patient, template, cleanedTranscript);
      } else {
        logDebug('enhancedTemplateProcessor', 'Debug message', {});
        formatted = this.formatAsSOAP(extracted, patient, cleanedTranscript);
      }
      
      logDebug('enhancedTemplateProcessor', 'Debug message', {});
      
      if (!formatted || formatted.trim() === '') {
        throw new Error('Formatting returned empty result');
      }
      
      return formatted;
    } catch (error) {
      logError('enhancedTemplateProcessor', 'Error message', {});
      // Return a basic formatted note as fallback
      const date = new Date().toLocaleDateString();
      const time = new Date().toLocaleTimeString();
      return `CLINICAL NOTE
════════════════════════════════════════
Patient: ${patient?.name || 'Unknown'}
MRN: ${patient?.mrn || 'N/A'}
Date: ${date}
Time: ${time}
════════════════════════════════════════

TRANSCRIPT:
${transcript}

[Note: Enhanced processing encountered an error. Showing raw transcript.]`;
    }
  }

  private extractMedicalInfo(transcript: string, patient: PatientData) {
    const info: any = {};
    
    // 1. CHIEF COMPLAINT - Better extraction
    info.chiefComplaint = this.extractChiefComplaint(transcript);
    
    // 2. CURRENT MEDICATIONS - Extract ALL medications mentioned
    info.currentMedications = this.extractAllMedications(transcript);
    
    // 3. MEDICATION CHANGES - Clear start/stop/adjust
    info.medicationChanges = this.extractMedicationChanges(transcript);
    
    // 4. VITAL SIGNS & LAB VALUES
    info.vitals = this.extractVitalsAndLabs(transcript);
    
    // 5. ASSESSMENT - Extract actual diagnoses
    info.assessment = this.extractAssessment(transcript, info);
    
    // 6. PLAN - Detailed action items
    info.plan = this.extractDetailedPlan(transcript);
    
    // 7. FOLLOW-UP
    info.followUp = this.extractFollowUp(transcript);
    
    return info;
  }

  private extractChiefComplaint(transcript: string): string {
    // Look for chief complaint patterns
    const patterns = [
      /patient (?:comes?|came|presents?) (?:in |to |)with\s+([^.]+)/i,
      /complain(?:s|ing)? (?:of|about)\s+([^.]+)/i,
      /here for\s+([^.]+)/i,
      /(?:chief complaint|cc)[:\s]*([^.]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = transcript.match(pattern);
      if (match) {
        return this.cleanText(match[1]);
      }
    }
    
    // Look for symptoms at the beginning
    const symptomMatch = transcript.match(/^[^.]{0,100}(nausea|vomiting|pain|fever|cough|fatigue|weakness|dizziness)[^.]*\./i);
    if (symptomMatch) {
      return this.cleanText(symptomMatch[0]);
    }
    
    return "See transcript";
  }

  private extractAllMedications(transcript: string): string[] {
    const medications = new Set<string>();
    
    // Common diabetes medications
    const medPatterns = [
      /Manjaro/gi,
      /Mounjaro/gi,
      /Lantus(?:\s+\d+\s*units?)?/gi,
      /Novolog(?:\s+\d+\s*units?)?/gi,
      /NovoLog(?:\s+\d+\s*units?)?/gi,
      /Metformin(?:\s+\d+\s*mg)?/gi,
      /Jardiance/gi,
      /Farxiga/gi,
      /Ozempic/gi,
      /Trulicity/gi,
      /insulin(?:\s+\w+)?/gi
    ];
    
    // Extract each medication with dosage
    for (const pattern of medPatterns) {
      const matches = transcript.matchAll(pattern);
      for (const match of matches) {
        const med = match[0].trim();
        // Normalize medication names
        const normalized = med
          .replace(/Manjaro/gi, 'Mounjaro')
          .replace(/Novolog/gi, 'NovoLog');
        medications.add(normalized);
      }
    }
    
    // Also look for pattern "on [medication]"
    const onMedPattern = /(?:on|taking|prescribed?)\s+(\w+(?:\s+\d+\s*(?:mg|units?))?)/gi;
    const matches = transcript.matchAll(onMedPattern);
    for (const match of matches) {
      const med = match[1].trim();
      if (med.length > 2 && !med.match(/^(the|some|any|his|her|with)$/i)) {
        medications.add(this.capitalize(med));
      }
    }
    
    return Array.from(medications);
  }

  private extractMedicationChanges(transcript: string): string[] {
    const changes: string[] = [];
    
    // Extract all medication mentions for changes
    const allMedications = this.extractAllMedications(transcript);
    
    // STOP medications
    const stopPatterns = [
      /stop(?:ping)?\s+(?:the\s+)?(\w+)/gi,
      /discontinue\s+(?:the\s+)?(\w+)/gi,
      /hold(?:ing)?\s+(?:the\s+)?(\w+)/gi,
      /(?:we'll|will)\s+(?:go ahead and\s+)?stop\s+(?:the\s+)?(\w+)/gi
    ];
    
    for (const pattern of stopPatterns) {
      const matches = transcript.matchAll(pattern);
      for (const match of matches) {
        const med = match[1].replace(/Manjaro/gi, 'Mounjaro').replace(/Wenjaro/gi, 'Mounjaro');
        changes.push(`STOP: ${this.capitalize(med)}`);
      }
    }
    
    // START medications with dosages - more comprehensive
    const startPatterns = [
      /(?:we'll|will)\s+(?:go ahead and\s+)?start\s+(?:the patient on\s+)?(\w+)\s+(\d+\s*(?:mg|milligrams?|units?))/gi,
      /start(?:ing)?\s+(\w+)\s+(\d+\s*(?:mg|milligrams?|units?))/gi,
      /begin(?:ning)?\s+(\w+)\s+(\d+\s*(?:mg|milligrams?|units?))/gi,
      /(?:put|place)\s+(?:him|her|them|patient)\s+on\s+(\w+)[\s,]+(\d+\s*(?:mg|units?))/gi,
      /(?:add|adding)\s+(\w+)\s+(\d+\s*(?:mg|units?))/gi
    ];
    
    for (const pattern of startPatterns) {
      const matches = transcript.matchAll(pattern);
      for (const match of matches) {
        const med = match[1].replace(/Novolog/gi, 'NovoLog');
        const dose = match[2];
        // Check for "with each meal" context
        const mealContext = transcript.substring(transcript.indexOf(match[0]), transcript.indexOf(match[0]) + 50);
        if (mealContext.match(/with\s+each\s+meal/i)) {
          changes.push(`START: ${this.capitalize(med)} ${dose} with each meal`);
        } else {
          changes.push(`START: ${this.capitalize(med)} ${dose}`);
        }
      }
    }
    
    // ADJUST medications
    const adjustPatterns = [
      /increase\s+(\w+)\s+to\s+(\d+\s*(?:mg|units?))/gi,
      /decrease\s+(\w+)\s+to\s+(\d+\s*(?:mg|units?))/gi,
      /change\s+(\w+)\s+to\s+(\d+\s*(?:mg|units?))/gi
    ];
    
    for (const pattern of adjustPatterns) {
      const matches = transcript.matchAll(pattern);
      for (const match of matches) {
        changes.push(`ADJUST: ${this.capitalize(match[1])} to ${match[2]}`);
      }
    }
    
    return changes;
  }

  private extractVitalsAndLabs(transcript: string): any {
    const vitals: any = {};
    
    // Blood sugar values
    const sugarPatterns = [
      /blood sugar(?:s)?\s+(?:have been|are|were|is)?\s*(?:elevated|running)?\s*(?:in the\s+)?(\d+)s?/i,
      /glucose\s+(?:is|was|of)?\s*(\d+)/i,
      /sugar(?:s)?\s+(?:in the\s+)?(\d+)s?/i,
      /blood sugar in the (\d+)s/i,
      /sugar (\d+)s/i
    ];
    
    for (const pattern of sugarPatterns) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        vitals.bloodSugar = match[1];
        break; // Stop after first match
      }
    }
    
    // A1C
    const a1cMatch = transcript.match(/A1C(?:\s+(?:is|was|of))?\s*(\d+(?:\.\d+)?%?)/i);
    if (a1cMatch) {
      vitals.a1c = a1cMatch[1];
    }
    
    // Blood pressure
    const bpMatch = transcript.match(/(?:BP|blood pressure)\s*(?:is|was)?\s*(\d{2,3}\/\d{2,3})/i);
    if (bpMatch) {
      vitals.bloodPressure = bpMatch[1];
    }
    
    // Weight
    const weightMatch = transcript.match(/weight\s+(?:is|was)?\s*(\d+)\s*(?:lbs?|pounds?)?/i);
    if (weightMatch) {
      vitals.weight = weightMatch[1] + ' lbs';
    }
    
    return vitals;
  }

  private extractAssessment(transcript: string, extractedInfo: any): string[] {
    const assessments: string[] = [];
    
    // Based on chief complaint and findings
    if (extractedInfo.chiefComplaint?.includes('nausea') || extractedInfo.chiefComplaint?.includes('vomiting')) {
      if (transcript.match(/Manjaro|Mounjaro/i) && transcript.match(/started.*two weeks ago/i)) {
        assessments.push('Medication intolerance - Mounjaro causing GI side effects');
      }
    }
    
    // Diabetes-related
    if (extractedInfo.vitals?.bloodSugar || transcript.match(/diabetes|DM|diabetic|blood sugar/i)) {
      const bloodSugar = extractedInfo.vitals?.bloodSugar;
      if (bloodSugar && parseInt(bloodSugar) > 200) {
        assessments.push('Uncontrolled Type 2 Diabetes Mellitus with hyperglycemia');
      } else if (bloodSugar && parseInt(bloodSugar) > 140) {
        assessments.push('Type 2 Diabetes Mellitus, poorly controlled');
      } else if (transcript.match(/blood sugar|glucose|diabetes/i)) {
        assessments.push('Type 2 Diabetes Mellitus');
      }
    }
    
    // Nausea/vomiting
    if (transcript.match(/nausea|nauseous|vomiting/i)) {
      assessments.push('Nausea and vomiting');
    }
    
    // Look for explicit diagnoses
    const diagnosisPatterns = [
      /(?:diagnosis|diagnoses|assessment)[:\s]*([^.]+)/i,
      /(?:this is|appears to be|consistent with)\s+([^.]+)/i,
      /(?:patient has|suffering from)\s+([^.]+)/i
    ];
    
    for (const pattern of diagnosisPatterns) {
      const match = transcript.match(pattern);
      if (match) {
        assessments.push(this.cleanText(match[1]));
      }
    }
    
    return assessments.length > 0 ? assessments : ['Clinical assessment pending labs'];
  }

  private extractDetailedPlan(transcript: string): string[] {
    const planItems: string[] = [];
    
    // Lab orders - more comprehensive extraction
    const labPatterns = [
      { pattern: /CMP/i, name: 'Comprehensive Metabolic Panel (CMP)' },
      { pattern: /A1C|hemoglobin A1C/i, name: 'Hemoglobin A1C' },
      { pattern: /TSH/i, name: 'TSH' },
      { pattern: /free T4/i, name: 'Free T4' },
      { pattern: /urine microalbumin/i, name: 'Urine Microalbumin' },
      { pattern: /lipid panel/i, name: 'Lipid Panel' },
      { pattern: /CBC/i, name: 'Complete Blood Count (CBC)' },
      { pattern: /basic metabolic/i, name: 'Basic Metabolic Panel' },
      { pattern: /liver function/i, name: 'Liver Function Tests' }
    ];
    
    for (const lab of labPatterns) {
      if (transcript.match(lab.pattern)) {
        planItems.push(`Order ${lab.name}`);
      }
    }
    
    // Extract medication starts
    const startMedPatterns = [
      /(?:we'll|will)\s+(?:go ahead and\s+)?start\s+(\w+)\s+(\d+\s*(?:mg|milligrams?|units?))/gi,
      /start(?:ing)?\s+(\w+)\s+(\d+\s*(?:mg|milligrams?|units?))/gi
    ];
    
    for (const pattern of startMedPatterns) {
      const matches = transcript.matchAll(pattern);
      for (const match of matches) {
        const med = match[1].replace(/Wenjaro/gi, 'Mounjaro');
        planItems.push(`Start ${med} ${match[2]}`);
      }
    }
    
    // Extract insulin specifically
    if (transcript.match(/Lantus|NovoLog|Humalog/i)) {
      const insulinPattern = /(Lantus|NovoLog|Humalog)\s+(\d+)\s+units?/gi;
      const matches = transcript.matchAll(insulinPattern);
      for (const match of matches) {
        const timing = transcript.includes('meal') && match[1].match(/NovoLog|Humalog/i) ? ' with meals' : '';
        planItems.push(`${match[1]} ${match[2]} units${timing}`);
      }
    }
    
    // Referrals
    if (transcript.match(/(?:call|contact|see)\s+(?:the\s+)?primary care/i)) {
      planItems.push('Contact primary care physician for records');
    }
    
    // Diet/Lifestyle
    if (transcript.match(/diet|exercise|lifestyle/i)) {
      planItems.push('Lifestyle modification counseling');
    }
    
    // Get old records
    if (transcript.match(/old (?:labs|records)/i)) {
      planItems.push('Obtain previous medical records and labs');
    }
    
    // Follow-up
    const followUp = this.extractFollowUp(transcript);
    if (followUp && followUp !== 'As clinically indicated') {
      planItems.push(`Follow-up in ${followUp}`);
    }
    
    return [...new Set(planItems)]; // Remove duplicates
  }

  private extractFollowUp(transcript: string): string {
    const patterns = [
      /see you back in\s+(\d+|a couple of|a few|next)\s+(days?|weeks?|months?)/i,
      /(?:follow[\s-]?up|return|come back|see you)\s+(?:back\s+)?(?:in\s+)?(\d+|a couple of|a few|next)\s+(days?|weeks?|months?)/i,
      /(?:return|follow[\s-]?up)\s+(?:visit\s+)?(?:in\s+)?(\d+|a couple of|a few)\s+(days?|weeks?|months?)/i,
      /(\d+)\s+(days?|weeks?|months?)\s+(?:for\s+)?follow[\s-]?up/i,
      /see\s+(?:me|you|us|them|patient)?\s*(?:back|again)?\s+(?:in\s+)?(\d+|three|two|four|six)\s+(days?|weeks?|months?)/i,
      /next\s+(?:visit|appointment|follow[\s-]?up)\s+(?:in\s+)?(\d+)\s+(days?|weeks?|months?)/i,
      /schedule\s+(?:a\s+)?follow[\s-]?up\s+(?:in\s+)?(\d+)\s+(days?|weeks?|months?)/i,
      /recheck\s+(?:in\s+)?(\d+)\s+(days?|weeks?|months?)/i,
      /will\s+see\s+(?:patient|you|them)?\s*(?:in\s+)?(\d+)\s+(days?|weeks?|months?)/i
    ];
    
    for (const pattern of patterns) {
      const match = transcript.match(pattern);
      if (match) {
        // Find the numeric value and time unit
        for (let i = 1; i < match.length - 1; i++) {
          if (match[i] && match[i + 1] && match[i + 1].match(/days?|weeks?|months?/)) {
            let time = match[i];
            if (time === 'a couple of') time = '2';
            if (time === 'a few') time = '3-4';
            if (time === 'next') time = '1';
            if (time === 'three') time = '3';
            if (time === 'two') time = '2';
            if (time === 'four') time = '4';
            if (time === 'six') time = '6';
            return `${time} ${match[i + 1]}`;
          }
        }
      }
    }
    
    // Check for specific follow-up instructions
    if (transcript.match(/urgent\s+follow[\s-]?up/i)) {
      return '1-2 days';
    }
    if (transcript.match(/routine\s+follow[\s-]?up/i)) {
      return '3-6 months';
    }
    if (transcript.match(/follow[\s-]?up\s+(?:as\s+needed|prn)/i)) {
      return 'as needed';
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
    
    let formatted = `CLINICAL NOTE - ${template.name}
════════════════════════════════════════════════════════
Patient: ${patient.name || 'N/A'}
MRN: ${patient.mrn || 'N/A'}
Date: ${date}
Time: ${time}
════════════════════════════════════════════════════════

`;
    
    // Apply general instructions if provided
    const generalInstructions = template.generalInstructions;
    
    // Process template sections with extracted data
    if (template.sections) {
      for (const [key, section] of Object.entries(template.sections)) {
        if (typeof section === 'object' && section.title) {
          const sectionTitle = section.title.toUpperCase();
          let content = '';
          
          // Map sections to extracted data
          if (sectionTitle.includes('CHIEF COMPLAINT')) {
            content = extracted.chiefComplaint || 'See transcript';
          } else if (sectionTitle.includes('CURRENT MEDICATION')) {
            content = extracted.currentMedications?.join('\n• ') || 'None documented';
            if (content !== 'None documented') content = '• ' + content;
          } else if (sectionTitle.includes('MEDICATION CHANGE')) {
            content = extracted.medicationChanges?.map((c: string) => `• ${c}`).join('\n') || 'No changes';
          } else if (sectionTitle.includes('VITAL') || sectionTitle.includes('LAB')) {
            if (extracted.vitals) {
              const vitalsList = [];
              if (extracted.vitals.bloodSugar) vitalsList.push(`Blood Sugar: ${extracted.vitals.bloodSugar}`);
              if (extracted.vitals.a1c) vitalsList.push(`A1C: ${extracted.vitals.a1c}`);
              if (extracted.vitals.bloodPressure) vitalsList.push(`BP: ${extracted.vitals.bloodPressure}`);
              if (extracted.vitals.weight) vitalsList.push(`Weight: ${extracted.vitals.weight}`);
              content = vitalsList.join('\n') || 'Not documented';
            } else {
              content = 'Not documented';
            }
          } else if (sectionTitle.includes('ASSESSMENT')) {
            content = extracted.assessment?.join('\n• ') || 'See transcript';
            if (content !== 'See transcript') content = '• ' + content;
          } else if (sectionTitle.includes('PLAN')) {
            if (extracted.plan && extracted.plan.length > 0) {
              content = extracted.plan.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n');
            } else {
              // Extract plan from transcript if not already extracted
              const planItems = this.extractDetailedPlan(transcript);
              if (planItems.length > 0) {
                content = planItems.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n');
              } else {
                content = 'See clinical documentation';
              }
            }
          } else if (sectionTitle.includes('FOLLOW')) {
            content = `Follow-up in ${extracted.followUp}`;
          } else {
            content = this.extractBasedOnInstructions(transcript, section.aiInstructions || '', extracted);
          }
          
          // Apply general instructions to content if provided
          if (generalInstructions && content && content !== 'See transcript' && content !== 'Not documented') {
            content = this.applyGeneralInstructions(content, generalInstructions);
          }
          
          formatted += `${sectionTitle}:\n${content}\n\n`;
        }
      }
    }
    
    // Add CPT Billing Section (if enabled in template or by default)
    const billingEnabled = template.billingConfig?.enabled !== false; // Default to enabled
    if (billingEnabled) {
      const billingSection = this.generateBillingSection(
        extracted,
        transcript,
        template.billingConfig?.includeICD10 !== false
      );
      formatted += billingSection;
    }

    // Add transcript
    formatted += `\nFULL TRANSCRIPT:\n────────────────\n${this.cleanTranscript(transcript)}\n\n`;
    formatted += `═══════════════════════════════════════════════════════\nGenerated: ${date} ${time}\nTemplate: ${template.name}`;

    return formatted;
  }

  private formatAsSOAP(extracted: any, patient: PatientData, transcript: string): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    
    return `SOAP NOTE
════════════════════════════════════════════════════════
Patient: ${patient.name}
MRN: ${patient.mrn}
Date: ${date}
Time: ${time}

SUBJECTIVE:
Chief Complaint: ${extracted.chiefComplaint}
${transcript.substring(0, 300)}...

OBJECTIVE:
${extracted.vitals ? this.formatVitals(extracted.vitals) : 'Vital signs not documented'}

ASSESSMENT:
${extracted.assessment?.join('\n') || 'Clinical assessment pending'}

PLAN:
${extracted.plan?.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n') || 'As discussed'}

MEDICATIONS:
Current: ${extracted.currentMedications?.join(', ') || 'None'}
Changes: ${extracted.medicationChanges?.join('; ') || 'None'}

FOLLOW-UP:
${extracted.followUp}

${this.generateBillingSection(extracted, transcript, true)}

════════════════════════════════════════════════════════
Generated: ${date} ${time}`;
  }

  private formatVitals(vitals: any): string {
    const items = [];
    if (vitals.bloodPressure) items.push(`BP: ${vitals.bloodPressure}`);
    if (vitals.bloodSugar) items.push(`Blood Glucose: ${vitals.bloodSugar}`);
    if (vitals.a1c) items.push(`HbA1c: ${vitals.a1c}`);
    if (vitals.weight) items.push(`Weight: ${vitals.weight}`);
    return items.join(' | ') || 'Not documented';
  }

  private extractBasedOnInstructions(transcript: string, instructions: string, extracted: any): string {
    const lowerInstructions = instructions.toLowerCase();
    const cleanedTranscript = this.cleanTranscript(transcript);
    
    // Extract based on specific instruction patterns
    if (lowerInstructions.includes('medication')) {
      if (lowerInstructions.includes('change')) {
        return extracted.medicationChanges?.join('\n') || 'No medication changes noted';
      }
      return extracted.currentMedications?.join('\n• ') || 'No medications documented';
    }
    
    if (lowerInstructions.includes('assessment')) {
      return extracted.assessment?.join('\n• ') || this.extractAssessment(cleanedTranscript, extracted).join('\n• ');
    }
    
    if (lowerInstructions.includes('plan')) {
      return extracted.plan?.join('\n') || this.extractDetailedPlan(cleanedTranscript).join('\n');
    }
    
    // For subjective sections - extract patient complaints and history
    if (lowerInstructions.includes('subjective') || lowerInstructions.includes('complaint') || lowerInstructions.includes('symptom')) {
      const subjective = [];
      
      // Extract chief complaint
      if (extracted.chiefComplaint && extracted.chiefComplaint !== 'See transcript') {
        subjective.push(`Chief Complaint: ${extracted.chiefComplaint}`);
      }
      
      // Extract symptoms and history from transcript
      const symptomPatterns = [
        /patient (?:reports?|states?|mentions?|describes?|has been experiencing)\s+([^.]+)/gi,
        /(?:complaining|complains?) (?:of|about)\s+([^.]+)/gi,
        /(?:symptoms? (?:include|are|of))\s+([^.]+)/gi,
        /(?:experiencing|having|feeling)\s+([^.]+)/gi,
        /(?:started|began|noticed)\s+([^.]+)/gi
      ];
      
      for (const pattern of symptomPatterns) {
        const matches = cleanedTranscript.matchAll(pattern);
        for (const match of matches) {
          const symptom = this.cleanText(match[1]);
          if (symptom.length > 10 && symptom.length < 200) {
            subjective.push(`• ${this.normalizeToThirdPerson(symptom)}`);
          }
        }
      }
      
      return subjective.length > 0 ? subjective.join('\n') : 'Patient presents for evaluation as documented';
    }
    
    // For objective sections - extract exam findings and vital signs
    if (lowerInstructions.includes('objective') || lowerInstructions.includes('exam') || lowerInstructions.includes('vital')) {
      const objective = [];
      
      // Add vitals if available
      if (extracted.vitals) {
        objective.push('Vital Signs:');
        if (extracted.vitals.bloodPressure) objective.push(`• BP: ${extracted.vitals.bloodPressure}`);
        if (extracted.vitals.bloodSugar) objective.push(`• Blood Sugar: ${extracted.vitals.bloodSugar}`);
        if (extracted.vitals.a1c) objective.push(`• A1C: ${extracted.vitals.a1c}`);
        if (extracted.vitals.weight) objective.push(`• Weight: ${extracted.vitals.weight}`);
      }
      
      // Extract physical exam findings
      const examPatterns = [
        /(?:exam(?:ination)?|physical exam) (?:shows?|reveals?|demonstrates?)\s+([^.]+)/gi,
        /(?:on exam(?:ination)?)\s+([^.]+)/gi,
        /patient (?:appears?|looks?|is)\s+([^.]+)/gi,
        /(?:normal|abnormal|unremarkable)\s+([^.]+)/gi
      ];
      
      const examFindings = [];
      for (const pattern of examPatterns) {
        const matches = cleanedTranscript.matchAll(pattern);
        for (const match of matches) {
          const finding = this.cleanText(match[1] || match[0]);
          if (finding.length > 10 && finding.length < 200) {
            examFindings.push(`• ${finding}`);
          }
        }
      }
      
      if (examFindings.length > 0) {
        objective.push('\nPhysical Examination:');
        objective.push(...examFindings);
      }
      
      return objective.length > 0 ? objective.join('\n') : 'Examination findings as per standard evaluation';
    }
    
    // For follow-up sections - extract timeline
    if (lowerInstructions.includes('follow') || lowerInstructions.includes('return')) {
      const followUp = this.extractFollowUp(cleanedTranscript);
      if (followUp && followUp !== 'As needed') {
        return `Patient to follow up in ${followUp}`;
      }
      
      // Try more patterns
      const followPatterns = [
        /follow[\s-]?up (?:in |after |within )?(\d+\s*(?:weeks?|months?|days?))/gi,
        /return (?:in |after |within )?(\d+\s*(?:weeks?|months?|days?))/gi,
        /see (?:you |me |us |patient )?(?:in |after )?(\d+\s*(?:weeks?|months?|days?))/gi,
        /next (?:visit|appointment) (?:in |after )?(\d+\s*(?:weeks?|months?|days?))/gi
      ];
      
      for (const pattern of followPatterns) {
        const match = cleanedTranscript.match(pattern);
        if (match) {
          return `Follow-up in ${match[1]}`;
        }
      }
      
      return 'Follow-up as clinically indicated';
    }
    
    // Generic extraction based on instructions
    const sentences = cleanedTranscript.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const relevant = [];
    
    // Find sentences that might be relevant to the instructions
    const instructionWords = instructions.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      let relevanceScore = 0;
      
      for (const word of instructionWords) {
        if (lowerSentence.includes(word)) {
          relevanceScore++;
        }
      }
      
      // Include sentences with high relevance
      if (relevanceScore >= 2 || (relevanceScore >= 1 && sentence.length < 100)) {
        relevant.push(`• ${this.normalizeToThirdPerson(this.cleanText(sentence))}`);
      }
    }
    
    if (relevant.length > 0) {
      return relevant.slice(0, 5).join('\n'); // Limit to 5 most relevant points
    }
    
    return 'Details per clinical documentation';
  }

  private normalizeToThirdPerson(text: string): string {
    return text
      .replace(/\b(I|i)\s+(am|was|have|had|will|would|can|could|should|must|may|might)\b/g, 'the patient $2')
      .replace(/\b(I|i)\s+/g, 'the patient ')
      .replace(/\b(my|My)\b/g, "the patient's")
      .replace(/\b(me|Me)\b/g, 'the patient')
      .replace(/\b(mine|Mine)\b/g, "the patient's")
      .replace(/\b(we|We)\b/g, 'the patient and family')
      .replace(/\b(our|Our)\b/g, "the patient's")
      .replace(/\b(us|Us)\b/g, 'the patient')
      .replace(/\byou\b/gi, 'the patient')
      .replace(/\byour\b/gi, "the patient's")
      .replace(/The patient (is|was|has|had|will) the patient/gi, 'The patient $1')
      .replace(/the patient's patient/gi, 'the patient');
  }
  
  private applyGeneralInstructions(content: string, instructions: string): string {
    // Apply general formatting rules based on instructions
    let processedContent = content;
    
    // Common instruction patterns
    if (instructions.toLowerCase().includes('third person')) {
      processedContent = this.normalizeToThirdPerson(processedContent);
    }
    
    if (instructions.toLowerCase().includes('concise')) {
      // Remove redundant phrases
      processedContent = processedContent
        .replace(/The patient reports that the patient/gi, 'The patient')
        .replace(/The patient states that the patient/gi, 'The patient')
        .replace(/It is noted that/gi, '')
        .replace(/It should be noted that/gi, '');
    }
    
    if (instructions.toLowerCase().includes('professional')) {
      // Ensure professional language
      processedContent = processedContent
        .replace(/\bkinda\b/gi, 'somewhat')
        .replace(/\bsorta\b/gi, 'somewhat')
        .replace(/\bgonna\b/gi, 'going to')
        .replace(/\bwanna\b/gi, 'want to');
    }
    
    if (instructions.toLowerCase().includes('no redundancy') || instructions.toLowerCase().includes('avoid redundancy')) {
      // Remove duplicate information that might appear in multiple sections
      const lines = processedContent.split('\n');
      const uniqueLines = Array.from(new Set(lines.map(l => l.trim()))).filter(l => l);
      processedContent = uniqueLines.join('\n');
    }
    
    return processedContent;
  }
  
  private cleanTranscript(transcript: string): string {
    return transcript
      .replace(/Recording started.*?clearly/gi, '')
      .replace(/NEW DICTATION:?/gi, '')
      .replace(/\b(um+|uh+|er+)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanText(text: string): string {
    return text
      .replace(/\b(um+|uh+|er+|ah+)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*,\s*/, '')
      .replace(/\s*,\s*$/, '')
      .trim();
  }

  private capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Generate billing section with CPT and ICD-10 suggestions
   */
  private generateBillingSection(
    extracted: any,
    transcript: string,
    includeICD10: boolean = true
  ): string {
    // Analyze complexity
    const complexityAnalysis = cptBillingAnalyzer.analyzeComplexity(transcript, extracted);

    // Get CPT recommendations
    const cptRecommendation = cptBillingAnalyzer.suggestCPTCodes(
      complexityAnalysis,
      extracted.chiefComplaint && extracted.chiefComplaint !== 'See transcript',
      extracted.assessment && extracted.assessment.length > 0,
      extracted.plan && extracted.plan.length > 0
    );

    // Get ICD-10 suggestions if enabled
    let icd10Suggestions: any[] = [];
    if (includeICD10 && extracted.assessment) {
      icd10Suggestions = cptBillingAnalyzer.suggestICD10Codes(extracted.assessment);
    }

    // Generate formatted section
    return cptBillingAnalyzer.generateBillingSection(cptRecommendation, icd10Suggestions);
  }
}

export const enhancedTemplateProcessor = new EnhancedTemplateProcessor();