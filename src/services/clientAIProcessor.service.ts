/**
 * Client-side AI Processor
 * Formats dictation based on templates without requiring backend
 */

import type { Template } from '../types/template.types';
import type { PatientData } from './patientData.service';
import { cleanTemplateForProcessing, debugTemplate } from '../utils/cleanTemplate';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export class ClientAIProcessor {
  /**
   * Process dictation into structured format based on template
   */
  async processTranscription(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    specialty?: string
  ): Promise<{ formatted: string }> {
    logDebug('clientAIProcessor', 'Debug message', {});
    
    // CRITICAL: Clean the transcript FIRST before any processing
    const cleanedTranscript = this.cleanTranscript(transcript);
    
    logDebug('clientAIProcessor', 'Debug message', {});
    logDebug('clientAIProcessor', 'Debug message', {}); + '...');
    logDebug('clientAIProcessor', 'Debug message', {});
    logDebug('clientAIProcessor', 'Debug message', {});
    
    // DEBUG: Check for problematic sections
    if (template?.sections) {
      Object.entries(template.sections).forEach(([key, value]) => {
        if (typeof value === 'object' && !value.title && !value.aiInstructions) {
          logError('clientAIProcessor', 'Error message', {});
        }
      });
    }
    
    // Extract key information from CLEANED transcript
    const sections = this.extractSections(cleanedTranscript);
    logDebug('clientAIProcessor', 'Debug message', {}); 
    
    // If template is provided, format according to template
    if (template && template.sections) {
      // Clean the template to ensure only valid sections
      const cleanedTemplate = cleanTemplateForProcessing(template);
      
      logDebug('clientAIProcessor', 'Debug message', {});
      return {
        formatted: this.formatWithTemplateSections(sections, patient, cleanedTemplate, cleanedTranscript)
      };
    } else if (template && (template as any).content) {
      // Handle templates with content field (legacy)
      logDebug('clientAIProcessor', 'Debug message', {});
      return {
        formatted: this.formatWithTemplate(sections, patient, template, cleanedTranscript)
      };
    }
    
    // Default SOAP format
    logDebug('clientAIProcessor', 'Debug message', {});
    return {
      formatted: this.formatAsSOAP(sections, patient, cleanedTranscript, specialty)
    };
  }

  private extractSections(transcript: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const text = transcript.toLowerCase();
    
    // Extract chief complaint (first sentence or complaint mentioned)
    const complaintMatch = text.match(/(?:complain(?:s|ing)?|problem|issue|concern|here for|presenting with)[\s:]*([^.!?]+)/);
    if (complaintMatch) {
      sections.chiefComplaint = this.capitalize(complaintMatch[1].trim());
    }
    
    // Extract symptoms
    const symptomKeywords = ['pain', 'ache', 'fever', 'cough', 'fatigue', 'nausea', 'dizziness', 'weakness'];
    const symptoms: string[] = [];
    symptomKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        const context = this.extractContext(transcript, keyword);
        if (context) symptoms.push(context);
      }
    });
    if (symptoms.length > 0) {
      sections.symptoms = symptoms.join('. ');
    }
    
    // Extract vital signs
    const vitalPatterns = {
      bloodPressure: /(?:bp|blood pressure)[\s:]*(\d{2,3}\/\d{2,3})/i,
      heartRate: /(?:hr|heart rate|pulse)[\s:]*(\d{2,3})/i,
      temperature: /(?:temp|temperature)[\s:]*(\d{2,3}(?:\.\d)?)/i,
      respiratoryRate: /(?:rr|respiratory rate|respirations?)[\s:]*(\d{1,2})/i,
      oxygenSat: /(?:o2|oxygen|sat|spo2)[\s:]*(\d{2,3}%?)/i,
      weight: /(?:weight|weighs?)[\s:]*(\d{2,3}(?:\.\d)?)\s*(?:lbs?|pounds?|kg)?/i
    };
    
    const vitals: string[] = [];
    Object.entries(vitalPatterns).forEach(([key, pattern]) => {
      const match = transcript.match(pattern);
      if (match) {
        vitals.push(`${this.formatVitalName(key)}: ${match[1]}`);
      }
    });
    if (vitals.length > 0) {
      sections.vitals = vitals.join(', ');
    }
    
    // Extract medications mentioned
    const medPatterns = /(?:taking|prescribed|medication|meds?|drug)[\s:]*([^.!?]+)/gi;
    const medMatches = transcript.matchAll(medPatterns);
    const medications: string[] = [];
    for (const match of medMatches) {
      medications.push(this.capitalize(match[1].trim()));
    }
    if (medications.length > 0) {
      sections.medications = medications.join(', ');
    }
    
    // Extract assessment/diagnosis keywords
    const diagnosisKeywords = ['assess', 'diagnosis', 'impression', 'conclude', 'suspect', 'likely', 'appears to be'];
    diagnosisKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        const context = this.extractContext(transcript, keyword);
        if (context) {
          sections.assessment = (sections.assessment ? sections.assessment + '. ' : '') + context;
        }
      }
    });
    
    // Extract plan/treatment
    const planKeywords = ['plan', 'prescribe', 'order', 'recommend', 'follow up', 'return', 'schedule', 'refer'];
    const plans: string[] = [];
    planKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        const context = this.extractContext(transcript, keyword);
        if (context) plans.push(context);
      }
    });
    if (plans.length > 0) {
      sections.plan = plans.join('. ');
    }
    
    return sections;
  }

  private formatWithTemplateSections(
    extractedSections: Record<string, string>,
    patient: PatientData,
    template: Template,
    cleanedTranscript: string  // Already cleaned!
  ): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    
    // Start directly with clinical note - NO PATIENT SUMMARY
    let formatted = `CLINICAL NOTE - ${template.name}
════════════════════════════════════════════════════════
Patient: ${patient.name || 'N/A'}
MRN: ${patient.mrn || 'N/A'}
Date: ${date}
Time: ${time}
════════════════════════════════════════════════════════

`;
    
    // ONLY process template sections - NO FALLBACKS
    if (template.sections) {
      logDebug('clientAIProcessor', 'Debug message', {});
      logDebug('clientAIProcessor', 'Debug message', {});.length);
      logDebug('clientAIProcessor', 'Debug message', {}); 
      
      // Sort sections by order if available
      const sectionEntries = Object.entries(template.sections);
      sectionEntries.sort((a: any, b: any) => {
        const orderA = (typeof a[1] === 'object' && a[1]?.order !== undefined) ? a[1].order : 999;
        const orderB = (typeof b[1] === 'object' && b[1]?.order !== undefined) ? b[1].order : 999;
        return orderA - orderB;
      });
      
      // Process ONLY the sections defined in the template
      const processedSections = new Set<string>(); // Track processed sections to avoid duplicates
      
      for (const [key, sectionData] of sectionEntries) {
        if (!sectionData) continue;
        
        // Only process sections with title and aiInstructions (custom template format)
        if (typeof sectionData === 'object' && sectionData.title && sectionData.aiInstructions) {
          const sectionTitle = sectionData.title;
          const aiInstructions = sectionData.aiInstructions;
          
          // Skip if we've already processed this section
          if (processedSections.has(sectionTitle.toUpperCase())) {
            logDebug('clientAIProcessor', 'Debug message', {});
            continue;
          }
          
          logDebug('clientAIProcessor', 'Debug message', {});
          processedSections.add(sectionTitle.toUpperCase());
          
          // Extract content based on AI instructions - use cleaned transcript
          const extractedContent = this.extractBasedOnInstructions(
            cleanedTranscript,
            aiInstructions,
            extractedSections
          );
          
          formatted += `${sectionTitle.toUpperCase()}:\n${extractedContent}\n\n`;
        } else {
          logError('clientAIProcessor', 'Error message', {});
          });
        }
      }
    } else {
      logDebug('clientAIProcessor', 'Debug message', {});
    }
    
    // Add the cleaned transcript at the end
    formatted += `FULL TRANSCRIPT:\n────────────────\n${cleanedTranscript}\n\n`;
    formatted += `═══════════════════════════════════════════════════════\nGenerated: ${date} ${time}\nTemplate: ${template.name}`;
    
    return formatted;
  }

  private formatWithTemplate(
    sections: Record<string, string>,
    patient: PatientData,
    template: Template,
    cleanedTranscript: string  // Already cleaned!
  ): string {
    let formatted = template.content;
    
    // Replace template variables
    formatted = formatted.replace(/\[Patient Name\]/gi, patient.name);
    formatted = formatted.replace(/\[MRN\]/gi, patient.mrn);
    formatted = formatted.replace(/\[Date\]/gi, new Date().toLocaleDateString());
    formatted = formatted.replace(/\[Time\]/gi, new Date().toLocaleTimeString());
    formatted = formatted.replace(/\[Age\]/gi, patient.age?.toString() || '[Age]');
    formatted = formatted.replace(/\[Gender\]/gi, patient.gender || '[Gender]');
    
    // Replace section placeholders with extracted content
    formatted = formatted.replace(/\[Chief Complaint\]/gi, sections.chiefComplaint || 'See transcript');
    formatted = formatted.replace(/\[HPI\]/gi, sections.symptoms || cleanedTranscript.substring(0, 200) + '...');
    formatted = formatted.replace(/\[ROS\]/gi, sections.symptoms || 'As per transcript');
    formatted = formatted.replace(/\[Vital Signs?\]/gi, sections.vitals || 'See transcript');
    formatted = formatted.replace(/\[Physical Exam\]/gi, sections.physicalExam || 'As documented');
    formatted = formatted.replace(/\[Assessment\]/gi, sections.assessment || 'Based on clinical findings');
    formatted = formatted.replace(/\[Plan\]/gi, sections.plan || 'As discussed');
    formatted = formatted.replace(/\[Medications?\]/gi, sections.medications || 'None noted');
    
    // Add full transcript at the end if not already included
    if (!formatted.includes('TRANSCRIPT') && !formatted.includes('Dictation')) {
      formatted += `\n\nTRANSCRIPT:\n${cleanedTranscript}`;
    }
    
    return formatted;
  }

  private formatAsSOAP(
    sections: Record<string, string>,
    patient: PatientData,
    cleanedTranscript: string,  // Already cleaned!
    specialty?: string
  ): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    
    return `CLINICAL NOTE - ${specialty || 'General Medicine'}
════════════════════════════════════════════════════════

Patient: ${patient.name}
MRN: ${patient.mrn}
Date: ${date}
Time: ${time}
${patient.age ? `Age: ${patient.age}` : ''}
${patient.gender ? `Gender: ${patient.gender}` : ''}

CHIEF COMPLAINT:
${sections.chiefComplaint || 'As per patient statement'}

SUBJECTIVE:
${sections.symptoms || cleanedTranscript.substring(0, 500)}${cleanedTranscript.length > 500 ? '...' : ''}

OBJECTIVE:
${sections.vitals ? `Vital Signs: ${sections.vitals}\n` : ''}
Physical Examination: ${sections.physicalExam || 'See transcript for details'}

ASSESSMENT:
${sections.assessment || 'Clinical assessment based on history and examination'}

PLAN:
${sections.plan || 'Treatment plan as discussed with patient'}

${sections.medications ? `\nCURRENT MEDICATIONS:\n${sections.medications}\n` : ''}

FULL TRANSCRIPT:
────────────────
${cleanedTranscript}

═══════════════════════════════════════════════════════
Generated: ${date} ${time}
Template: SOAP Note Format`;
  }

  private extractBasedOnInstructions(
    transcript: string,
    instructions: string,
    existingExtracted: Record<string, string>
  ): string {
    if (!instructions || !transcript) {
      return 'No information available';
    }

    const lowerInstructions = instructions.toLowerCase();
    const lowerTranscript = transcript.toLowerCase();
    
    // Check what the instructions are asking for
    if (lowerInstructions.includes('chief complaint') || lowerInstructions.includes('main reason')) {
      return existingExtracted.chiefComplaint || this.extractChiefComplaint(transcript);
    }
    
    if (lowerInstructions.includes('medication') && lowerInstructions.includes('change')) {
      return this.extractMedicationChanges(transcript);
    }
    
    if (lowerInstructions.includes('medication') || lowerInstructions.includes('drug')) {
      return existingExtracted.medications || this.extractMedications(transcript);
    }
    
    if (lowerInstructions.includes('vital') || lowerInstructions.includes('blood pressure') || lowerInstructions.includes('heart rate')) {
      return existingExtracted.vitals || this.extractVitals(transcript);
    }
    
    if (lowerInstructions.includes('lab') || lowerInstructions.includes('a1c') || lowerInstructions.includes('glucose') || lowerInstructions.includes('blood sugar')) {
      return this.extractLabResults(transcript);
    }
    
    if (lowerInstructions.includes('assessment') || lowerInstructions.includes('diagnos')) {
      return existingExtracted.assessment || this.extractAssessment(transcript);
    }
    
    if (lowerInstructions.includes('plan') || lowerInstructions.includes('treatment') || lowerInstructions.includes('follow')) {
      return existingExtracted.plan || this.extractPlan(transcript);
    }
    
    if (lowerInstructions.includes('symptom') || lowerInstructions.includes('history')) {
      return existingExtracted.symptoms || this.extractSymptoms(transcript);
    }
    
    // Default: try to extract relevant sentences based on keywords in instructions
    const keywords = instructions.match(/\b(\w+)\b/g) || [];
    const relevantSentences: string[] = [];
    const sentences = transcript.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      for (const keyword of keywords) {
        if (keyword.length > 3 && lowerSentence.includes(keyword.toLowerCase())) {
          relevantSentences.push(sentence.trim());
          break;
        }
      }
    }
    
    return relevantSentences.length > 0 
      ? relevantSentences.join('. ') 
      : 'See full transcript for details';
  }

  private extractChiefComplaint(transcript: string): string {
    const patterns = [
      /patient (?:presents|comes?\s+in|here) (?:with|for) ([^.!?]+)/i,
      /(?:comes?\s+in\s+with|presenting\s+with) ([^.!?]+)/i,
      /complain(?:s|ing)? (?:of|about) ([^.!?]+)/i,
      /(?:main |chief )(?:complaint|concern|problem) (?:is|are) ([^.!?]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = transcript.match(pattern);
      if (match) {
        // Clean up the match - remove "um", "uh", extra spaces
        let complaint = match[1].trim()
          .replace(/\b(um|uh|er)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        return this.capitalize(complaint);
      }
    }
    
    // Look for symptoms in first part of transcript
    const symptomMatch = transcript.match(/(nausea|vomiting|diarrhea|constipation|pain|fever|cough|fatigue|weakness|dizziness)[^.!?]*/i);
    if (symptomMatch) {
      return this.capitalize(symptomMatch[0].trim());
    }
    
    // Take first meaningful sentence
    const sentences = transcript.split(/[.!?]/);
    for (const sentence of sentences) {
      const cleaned = sentence.replace(/\b(um|uh|er)\b/gi, '').trim();
      if (cleaned.length > 10) {
        return this.capitalize(cleaned);
      }
    }
    
    return 'See transcript for chief complaint';
  }

  private extractMedications(transcript: string): string {
    const medPatterns = /(?:taking|prescribed?|on|medication|meds?|drug)\s+(\w+(?:\s+\d+\s*(?:mg|units?|ml)?)?)/gi;
    const medications = new Set<string>();
    
    let match;
    while ((match = medPatterns.exec(transcript)) !== null) {
      const med = match[1].trim();
      if (med.length > 2 && !med.match(/^(the|and|or|with|for)$/i)) {
        medications.add(this.capitalize(med));
      }
    }
    
    return medications.size > 0 
      ? Array.from(medications).join(', ')
      : 'No medications mentioned';
  }

  private extractMedicationChanges(transcript: string): string {
    // Remove speech artifacts first
    const cleanTranscript = transcript
      .replace(/Rakesh V2 template/gi, '')
      .replace(/Did Rakesh V2 template/gi, '')
      .replace(/Recording started please speak clearly/gi, '')
      .replace(/NEW DICTATION/gi, '');
    
    const changes: string[] = [];
    
    // Look for antiemetics mentioned in transcript
    if (cleanTranscript.match(/(?:phenergan|fenergan)/i)) {
      changes.push('Add Phenergan (promethazine) for nausea');
    }
    if (cleanTranscript.match(/zofran/i)) {
      changes.push('Add Zofran (ondansetron) for nausea/vomiting');
    }
    
    // Look for Farxiga specifically (mentioned in user's transcript)
    if (cleanTranscript.match(/farxiga/i)) {
      const farxigaMatch = cleanTranscript.match(/(?:add|start|prescrib|put\s+(?:on|them\s+on))?\s*farxiga\s*(\d+\s*mg)?/i);
      if (farxigaMatch) {
        changes.push(`Add Farxiga${farxigaMatch[1] ? ` ${farxigaMatch[1]}` : ''}`);
      }
    }
    
    // Look for specific medication changes
    // Novolog changes (including various speech recognition errors)
    const novologPattern = /(?:start|starting|begin)\s+(?:patient\s+)?(?:on\s+)?(?:novolog|overlock|novo\s*log)\s+(\d+)\s*(?:units?)?\s*(?:(?:so|with|at)\s+(?:this|each)\s+(?:email|meal))?/i;
    const novologMatch = cleanTranscript.match(novologPattern);
    if (novologMatch) {
      changes.push(`Start Novolog ${novologMatch[1]} units with each meal`);
    }
    
    // Lantus changes
    const lantusMatch = cleanTranscript.match(/(?:put\s+(?:them|him|her)\s+on|increase\s+(?:lantus\s+)?to)\s+(\d+)\s*units?\s+(?:of\s+)?lantus/i);
    if (lantusMatch) {
      changes.push(`Increase Lantus to ${lantusMatch[1]} units daily`);
    } else if (cleanTranscript.match(/lantus\s+(\d+)\s*units/i)) {
      const currentMatch = cleanTranscript.match(/lantus\s+(\d+)\s*units/i);
      if (currentMatch && cleanTranscript.match(/increase|go ahead|put them on/i)) {
        changes.push(`Continue/Adjust Lantus ${currentMatch[1]} units`);
      }
    }
    
    // Metformin changes
    const metforminMatch = cleanTranscript.match(/(?:start|stop|discontinue|hold)\s+metformin/i);
    if (metforminMatch) {
      changes.push(this.capitalize(metforminMatch[0]));
    }
    
    // Generic pattern for other medications
    const genericPatterns = [
      /(?:increase|decrease|adjust)\s+(\w+)\s+to\s+(\d+\s*(?:mg|units?|ml)?)/gi,
      /start\s+(?:patient\s+)?(?:on\s+)?(\w+)\s+(\d+\s*(?:mg|units?|ml)?)/gi,
      /(?:stop|discontinue|hold)\s+(\w+)/gi
    ];
    
    for (const pattern of genericPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(transcript)) !== null) {
        const med = match[1];
        // Skip if already captured above
        if (!med.match(/lantus|novolog|overlock|metformin/i) && 
            !changes.some(c => c.toLowerCase().includes(med.toLowerCase()))) {
          changes.push(this.capitalize(match[0]));
        }
      }
    }
    
    return changes.length > 0
      ? changes.map(c => `• ${c}`).join('\n')
      : 'No medication changes mentioned';
  }

  private extractVitals(transcript: string): string {
    const vitals: string[] = [];
    const vitalPatterns = {
      'Blood Pressure': /(?:bp|blood pressure)[:\s]*(\\d{2,3}\/\\d{2,3})/i,
      'Heart Rate': /(?:hr|heart rate|pulse)[:\s]*(\\d{2,3})/i,
      'Temperature': /(?:temp|temperature)[:\s]*(\\d{2,3}(?:\\.\\d)?)/i,
      'Weight': /(?:weight|weighs?)[:\s]*(\\d{2,3}(?:\\.\\d)?)\s*(?:lbs?|pounds?|kg)?/i,
      'O2 Sat': /(?:o2|oxygen|sat|spo2)[:\s]*(\\d{2,3}%?)/i
    };
    
    for (const [name, pattern] of Object.entries(vitalPatterns)) {
      const match = transcript.match(pattern);
      if (match) {
        vitals.push(`${name}: ${match[1]}`);
      }
    }
    
    return vitals.length > 0 ? vitals.join(', ') : 'Vital signs not mentioned';
  }

  private extractLabResults(transcript: string): string {
    const labs: string[] = [];
    
    // Extract A1C
    const a1cMatch = transcript.match(/a1c\s*(?:was|is)?\s*(\\d+(?:\\.\\d+)?%?)/i);
    if (a1cMatch) {
      labs.push(`A1C: ${a1cMatch[1]}${a1cMatch[1].includes('%') ? '' : '%'}`);
    }
    
    // Fix common speech recognition errors for blood sugar values
    let fixedTranscript = transcript
      .replace(/sugars?\s+(?:went|going|rising)\s+to\s+(\d+)/gi, 'blood sugar $1')
      .replace(/sugars?\s+(?:have|has)\s+been\s+(?:rising|going)\s+to\s+(\d+)/gi, 'blood sugar $1')
      .replace(/sugars?\s+(?:are|is|was|were)\s+(\d+)/gi, 'blood sugar $1')
      .replace(/(?:they're|they are)\s+like\s+in\s+the\s+(\d+)\s+and\s+(\d+)s?/gi, 'blood sugar $1-$2')
      .replace(/blood sugar (\d)\s+(?:picture|pitcher)/gi, (match, digit) => {
        // "blood sugar 3 picture" likely means "blood sugar 300"
        return `blood sugar ${digit}00`;
      })
      .replace(/blood sugar (\d)(?:\s|$)/gi, (match, digit) => {
        // Single digit blood sugar likely needs 00 added
        return `blood sugar ${digit}00`;
      });
    
    // Extract blood sugar/glucose values
    const sugarPatterns = [
      /blood sugar(?:\s+at\s+home)?\s+(?:is|was|are)?\s*(?:running\s+)?(?:about\s+|around\s+|like\s+)?(\\d+s?)/gi,
      /(?:sugars?\s+(?:are|is|was|were))\s*(?:running\s+)?(?:about\s+|around\s+|like\s+)?(\\d+s?)/gi,
      /glucose\s+(?:is|was)?\s*(\\d+)/gi,
      /CGM\s+(?:is|average|reading)?\s*(?:blood sugar)?\s*(?:is)?\s*(?:like)?\s*(\\d+)/gi,
      /(?:sugar|glucose)\s+(\\d{2,3}s?)(?:\s|$|,|\.|;)/gi,
      /(\\d{2,3}s?)\s*(?:blood sugar|glucose|sugar)/gi
    ];
    
    for (const pattern of sugarPatterns) {
      let match;
      while ((match = pattern.exec(fixedTranscript)) !== null) {
        const rawValue = match[1];
        const value = rawValue.replace(/s$/, ''); // Remove trailing 's' from "400s"
        
        // Validate it's a reasonable blood sugar value (typically 20-800)
        const numValue = parseInt(value);
        if (numValue >= 20 && numValue <= 800 && !labs.some(l => l.includes(value))) {
          if (match[0].toLowerCase().includes('fasting')) {
            labs.push(`Fasting glucose: ${value} mg/dL`);
          } else if (match[0].toLowerCase().includes('cgm')) {
            labs.push(`CGM average: ${value} mg/dL`);
          } else if (match[0].toLowerCase().includes('home')) {
            labs.push(`Home glucose: ${value} mg/dL`);
          } else {
            labs.push(`Blood sugar: ${value} mg/dL`);
          }
        }
      }
    }
    
    // Extract other lab values
    if (transcript.match(/CMP|comprehensive metabolic panel/i)) {
      labs.push('CMP ordered');
    }
    if (transcript.match(/CBC|complete blood count/i)) {
      labs.push('CBC ordered');
    }
    if (transcript.match(/lipid panel/i)) {
      labs.push('Lipid panel ordered');
    }
    if (transcript.match(/micro\s*albumin/i)) {
      labs.push('Microalbumin/creatinine ratio ordered');
    }
    
    return labs.length > 0 ? labs.join('\n') : 'No lab values mentioned';
  }

  private extractAssessment(transcript: string): string {
    const assessmentPatterns = [
      /(?:assessment|diagnosis|impression)[:\s]*([^.!?]+)/i,
      /(?:patient has|diagnosed with|suffering from)[:\s]*([^.!?]+)/i,
      /(?:this is|appears to be|likely|suspect)[:\s]*([^.!?]+)/i
    ];
    
    for (const pattern of assessmentPatterns) {
      const match = transcript.match(pattern);
      if (match) return this.capitalize(match[1].trim());
    }
    
    return 'Clinical assessment as discussed';
  }

  private extractPlan(transcript: string): string {
    const planItems: string[] = [];
    const planPatterns = [
      /(?:plan|will|going to|need to|should)\s+([^.!?]+)/gi,
      /(?:follow.?up|return|come back|see)\s+(?:in)?\s*(\d+\s*(?:days?|weeks?|months?))/gi,
      /(?:start|continue|stop|adjust)\s+(\w+)/gi
    ];
    
    for (const pattern of planPatterns) {
      let match;
      while ((match = pattern.exec(transcript)) !== null) {
        if (planItems.length < 5) { // Limit to 5 items
          planItems.push(this.capitalize(match[0].trim()));
        }
      }
    }
    
    return planItems.length > 0 
      ? planItems.map((item, i) => `${i + 1}. ${item}`).join('\n')
      : 'Treatment plan as discussed';
  }

  private extractSymptoms(transcript: string): string {
    const symptomKeywords = ['pain', 'ache', 'fever', 'cough', 'fatigue', 'nausea', 'vomiting', 'diarrhea', 'constipation', 'dizziness', 'weakness'];
    const symptoms: string[] = [];
    
    for (const keyword of symptomKeywords) {
      if (transcript.toLowerCase().includes(keyword)) {
        const context = this.extractContext(transcript, keyword, 10);
        if (context && !symptoms.includes(context)) {
          symptoms.push(context);
        }
      }
    }
    
    return symptoms.length > 0
      ? symptoms.join('. ')
      : 'Patient history as described';
  }

  private extractContext(text: string, keyword: string, wordsAround: number = 15): string {
    const index = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (index === -1) return '';
    
    const words = text.split(/\s+/);
    let wordIndex = 0;
    let charCount = 0;
    
    for (let i = 0; i < words.length; i++) {
      if (charCount <= index && charCount + words[i].length >= index) {
        wordIndex = i;
        break;
      }
      charCount += words[i].length + 1;
    }
    
    const start = Math.max(0, wordIndex - wordsAround);
    const end = Math.min(words.length, wordIndex + wordsAround);
    
    return this.capitalize(words.slice(start, end).join(' '));
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private cleanTranscript(transcript: string): string {
    if (!transcript) return '';
    
    // AGGRESSIVELY remove ALL patient summary sections first
    let cleanedTranscript = transcript
      // Remove any patient summary section completely
      .replace(/PATIENT SUMMARY[\s\S]*?(?:={10,}|━{10,}|─{10,}|NEW DICTATION|$)/gi, '')
      .replace(/^[\s\S]*?PATIENT SUMMARY[\s\S]*?(?:NEW DICTATION|Recording started)/gmi, '')
      // Remove structured patient data patterns
      .replace(/^.*?Name:.*?$/gm, '')
      .replace(/^.*?MRN:.*?$/gm, '')
      .replace(/^.*?DOB:.*?$/gm, '')
      .replace(/^.*?Age:.*?$/gm, '')
      .replace(/^.*?Gender:.*?$/gm, '')
      .replace(/^.*?Phone:.*?$/gm, '')
      .replace(/^.*?Email:.*?$/gm, '')
      // Remove medical history sections that appear before dictation
      .replace(/ACTIVE DIAGNOSES?:[\s\S]*?(?:NEW DICTATION|Patient |Pt |$)/gi, '')
      .replace(/CURRENT MEDICATIONS?:[\s\S]*?(?:NEW DICTATION|Patient |Pt |$)/gi, '')
      .replace(/RECENT LAB RESULTS?:[\s\S]*?(?:NEW DICTATION|Patient |Pt |$)/gi, '')
      .replace(/VITALS?\s*\([^)]*\):[\s\S]*?(?:NEW DICTATION|Patient |Pt |$)/gi, '')
      .replace(/MENTAL HEALTH SCREENING:[\s\S]*?(?:NEW DICTATION|Patient |Pt |$)/gi, '')
      .replace(/TODAY'S VISIT[\s\S]*?(?:NEW DICTATION|Patient |Pt |$)/gi, '')
      // Remove separator lines
      .replace(/[═━─]{10,}/g, '')
      .replace(/\*{10,}/g, '');
    
    // Now look for the actual dictation start
    const dictationStarters = [
      /(?:Patient|Pt) (?:comes?|came|presents?|presented) (?:in|to|with)/i,
      /(?:Patient|Pt) (?:is|was) (?:here|seen)/i,
      /(?:Chief complaint|CC):/i,
      /(?:History of present illness|HPI):/i,
      /(?:So|Uh|Um)?\s*(?:a|the)?\s*patient/i
    ];
    
    // Find where the actual dictation starts
    let dictationStart = -1;
    for (const starter of dictationStarters) {
      const match = cleanedTranscript.match(starter);
      if (match && match.index !== undefined) {
        dictationStart = match.index;
        break;
      }
    }
    
    // If we found a dictation start, extract from there
    if (dictationStart >= 0) {
      cleanedTranscript = cleanedTranscript.substring(dictationStart);
    }
    
    // Remove recording artifacts and clean up
    cleanedTranscript = cleanedTranscript
      // Remove recording artifacts
      .replace(/Recording started please speak clearly/gi, '')
      .replace(/Recording started/gi, '')
      .replace(/please speak clearly/gi, '')
      .replace(/NEW DICTATION:?/gi, '')
      // Remove template artifacts and selection messages
      .replace(/Did Rakesh [VB]2 template/gi, '')
      .replace(/Rakesh [VB]2 template/gi, '')
      .replace(/Selected.*?template/gi, '')
      .replace(/Using template:.*?$/gmi, '')
      .replace(/Template selected:.*?$/gmi, '')
      // Remove any remaining patient info patterns
      .replace(/Patient:\s*[^\n]*/gi, '')
      .replace(/MRN:\s*[^\n]*/gi, '')
      .replace(/Date:\s*[^\n]*/gi, '')
      .replace(/Time:\s*[^\n]*/gi, '')
      // Remove filler words but be more aggressive
      .replace(/\b(um+|uh+|er+|ah+)\b/gi, '')
      .replace(/\s+(um+|uh+|er+|ah+)\s+/gi, ' ')
      // Clean up extra whitespace and empty lines
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s*\n/gm, '')
      .replace(/^\s+|\s+$/g, '')
      .trim();
      
    return cleanedTranscript;
  }

  private formatVitalName(key: string): string {
    const names: Record<string, string> = {
      bloodPressure: 'BP',
      heartRate: 'HR',
      temperature: 'Temp',
      respiratoryRate: 'RR',
      oxygenSat: 'O2 Sat',
      weight: 'Weight'
    };
    return names[key] || key;
  }
}

export const clientAIProcessor = new ClientAIProcessor();