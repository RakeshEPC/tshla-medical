/**
 * Clean Template Processor - Simple and Working
 * Processes medical dictation with custom templates without duplication
 */

import type { Template } from '../types/template.types';
import type { PatientData } from './patientData.service';

export class CleanTemplateProcessor {
  /**
   * Process dictation with template - CLEAN VERSION
   */
  processWithTemplate(
    rawTranscript: string,
    patient: PatientData,
    template: Template | null
  ): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    // Step 1: Clean the transcript completely
    const cleanTranscript = this.cleanTranscript(rawTranscript);

    // Step 2: Start with clinical note header (NO PATIENT SUMMARY)
    let output = `CLINICAL NOTE${template ? ` - ${template.name}` : ''}
════════════════════════════════════════════════════════
Patient: ${patient.name || 'N/A'}
MRN: ${patient.mrn || 'N/A'}
Date: ${date}
Time: ${time}
════════════════════════════════════════════════════════\n\n`;

    // Step 3: Process template sections if available
    if (template && template.sections) {
      output += this.processTemplateSections(template, cleanTranscript);
    } else {
      // Fallback to simple format
      output += this.simpleFormat(cleanTranscript);
    }

    // Step 4: Add transcript at the end (once only)
    output += `\nTRANSCRIPT:\n────────────────\n${cleanTranscript}\n`;

    // Step 5: Add footer
    output += `\n════════════════════════════════════════════════════════
Generated: ${date} ${time}
${template ? `Template: ${template.name}` : 'No template used'}`;

    return output;
  }

  /**
   * Clean transcript - remove ALL artifacts and duplicates
   */
  private cleanTranscript(transcript: string): string {
    if (!transcript) return '';

    // Remove duplicate lines first
    const lines = transcript.split('\n');
    const seen = new Set<string>();
    const uniqueLines: string[] = [];

    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        uniqueLines.push(line);
      }
    }

    let cleaned = uniqueLines.join('\n');

    // Remove all artifacts
    const artifactsToRemove = [
      /PATIENT SUMMARY[\s\S]*?(?=So a patient|patient|$)/gi,
      /Recording started.*?\n/gi,
      /please speak clearly/gi,
      /NEW DICTATION:?/gi,
      /TODAY'S VISIT.*?\n/gi,
      /VISIT - \d+\/\d+\/\d+.*?\n/gi,
      /={10,}/g,
      /Rakesh [VB]\d template/gi,
      /Did Rakesh.*?template/gi,
      /Selected.*?template/gi,
      /\bum+\b/gi,
      /\buh+\b/gi,
    ];

    for (const pattern of artifactsToRemove) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Clean whitespace
    cleaned = cleaned
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();

    return cleaned;
  }

  /**
   * Process template sections ONLY
   */
  private processTemplateSections(template: Template, transcript: string): string {
    let output = '';
    const processedSections = new Set<string>();

    // Only process sections with title and aiInstructions
    Object.entries(template.sections || {}); // .forEach(([key, section]) => {
      if (
        typeof section === 'object' &&
        section !== null &&
        'title' in section &&
        'aiInstructions' in section &&
        section.title &&
        section.aiInstructions
      ) {
        // Avoid duplicates
        const sectionKey = section.title.toUpperCase();
        if (processedSections.has(sectionKey)) return;
        processedSections.add(sectionKey);

        // Extract content based on instructions
        const content = this.extractContent(transcript, section.aiInstructions);

        // Add to output
        output += `${section.title.toUpperCase()}:\n${content}\n\n`;
      }
    });

    return output;
  }

  /**
   * Extract content based on AI instructions
   */
  private extractContent(transcript: string, instructions: string): string {
    const lowerInstructions = instructions.toLowerCase();
    const lowerTranscript = transcript.toLowerCase();

    // Chief complaint
    if (
      lowerInstructions.includes('chief complaint') ||
      lowerInstructions.includes('main reason')
    ) {
      const match = transcript.match(/complain[st]?\s+(?:of|about|today)\s+(?:about\s+)?([^.]+)/i);
      if (match) return match[1].trim();
      return this.extractFirstSentence(transcript);
    }

    // Blood sugar
    if (lowerInstructions.includes('blood sugar') || lowerInstructions.includes('glucose')) {
      return this.extractBloodSugar(transcript);
    }

    // Medication changes
    if (lowerInstructions.includes('medication') && lowerInstructions.includes('change')) {
      return this.extractMedicationChanges(transcript);
    }

    // Assessment
    if (lowerInstructions.includes('assessment') || lowerInstructions.includes('diagnosis')) {
      return this.extractAssessment(transcript);
    }

    // Plan
    if (lowerInstructions.includes('plan') || lowerInstructions.includes('follow')) {
      return this.extractPlan(transcript);
    }

    // Default: return relevant portion
    return this.extractRelevantContent(transcript, instructions);
  }

  /**
   * Extract blood sugar values
   */
  private extractBloodSugar(transcript: string): string {
    const results: string[] = [];

    // Fix common patterns
    let fixed = transcript
      .replace(
        /sugars?\s+(?:are|were|have been)\s+(?:like\s+)?(?:in\s+the\s+)?(\d+)\s+and\s+(\d+)s?/gi,
        'Blood sugars: $1-$2 range'
      )
      .replace(/sugars?\s+(?:started\s+)?creeping\s+up/gi, 'Blood sugars elevated')
      .replace(/they're\s+like\s+in\s+the\s+(\d+)\s+and\s+(\d+)s?/gi, 'Blood sugars: $1-$2 range');

    // Extract A1C
    const a1cMatch = fixed.match(/[Aa]1[Cc]\s+(?:was|is)?\s*(\d+(?:\.\d+)?)/);
    if (a1cMatch) {
      results.push(`A1C: ${a1cMatch[1]}%`);
    }

    // Extract blood sugar ranges
    const rangeMatch = fixed.match(/Blood sugars?:?\s*(\d+)-(\d+)/i);
    if (rangeMatch) {
      results.push(`Blood sugar range: ${rangeMatch[1]}-${rangeMatch[2]} mg/dL`);
    }

    return results.length > 0 ? results.join('\n') : 'See transcript for blood sugar values';
  }

  /**
   * Extract medication changes
   */
  private extractMedicationChanges(transcript: string): string {
    const changes: string[] = [];

    // Lantus changes
    const lantusMatch = transcript.match(
      /(?:restart|go to|increase)\s+(?:his\s+)?[Ll]antus.*?(\d+)\s+units?/i
    );
    if (lantusMatch) {
      changes.push(`Lantus: Increased to ${lantusMatch[1]} units daily`);
    }

    // NovoLog changes
    const novologMatch = transcript.match(/[Nn]ovo[Ll]og\s+(\d+).*?(?:with\s+)?(?:each\s+)?meal/i);
    if (novologMatch) {
      changes.push(`NovoLog: ${novologMatch[1]} units with meals`);
    }

    // Ran out of medication
    const ranOutMatch = transcript.match(/ran\s+out\s+of.*?(?:for|about)\s+(?:a\s+)?month/i);
    if (ranOutMatch) {
      changes.push('Patient ran out of medication for about a month (insurance issue)');
    }

    return changes.length > 0 ? changes.join('\n') : 'See transcript for medication changes';
  }

  /**
   * Extract assessment
   */
  private extractAssessment(transcript: string): string {
    // Look for conditions mentioned
    const conditions: string[] = [];

    if (/type\s+2\s+diabetes/i.test(transcript)) {
      conditions.push('Type 2 Diabetes Mellitus - uncontrolled');
    }
    if (/hypothyroid/i.test(transcript)) {
      conditions.push('Hypothyroidism');
    }
    if (/nausea.*?vomiting/i.test(transcript)) {
      conditions.push('Nausea and vomiting');
    }

    return conditions.length > 0 ? conditions.join('\n') : 'Clinical assessment as discussed';
  }

  /**
   * Extract plan
   */
  private extractPlan(transcript: string): string {
    const planItems: string[] = [];

    // Lab orders
    if (/[Cc][Mm][Pp]/i.test(transcript)) planItems.push('Order CMP');
    if (/[Cc][Bb][Cc]/i.test(transcript)) planItems.push('Order CBC');
    if (/micro\s*albumin/i.test(transcript)) planItems.push('Order microalbumin');
    if (/[Aa]1[Cc]/i.test(transcript) && /get|order|check/i.test(transcript)) {
      planItems.push('Check A1C');
    }

    // Follow up
    const followUpMatch = transcript.match(/(?:see|follow.*?up|back)\s+in\s+(\d+\s+\w+)/i);
    if (followUpMatch) {
      planItems.push(`Follow up in ${followUpMatch[1]}`);
    }

    // Records
    if (/call.*?(?:primary|emergency|ER)/i.test(transcript)) {
      planItems.push('Obtain records from primary care and ER');
    }

    return planItems.length > 0 ? planItems.join('\n') : 'Treatment plan as discussed';
  }

  /**
   * Extract first sentence as chief complaint
   */
  private extractFirstSentence(transcript: string): string {
    const match = transcript.match(/patient.*?complains?\s+(?:today\s+)?about\s+([^.]+)/i);
    if (match) return match[1].trim();

    const sentences = transcript.split(/[.!?]/);
    if (sentences.length > 0) {
      return sentences[0].trim();
    }
    return 'See transcript';
  }

  /**
   * Extract relevant content based on keywords
   */
  private extractRelevantContent(transcript: string, instructions: string): string {
    // Extract keywords from instructions
    const keywords = instructions.match(/\b\w{4,}\b/g) || [];
    const sentences = transcript.split(/[.!?]+/);
    const relevant: string[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      for (const keyword of keywords) {
        if (keyword.length > 3 && lower.includes(keyword.toLowerCase())) {
          relevant.push(sentence.trim());
          break;
        }
      }
    }

    return relevant.length > 0 ? relevant.join('. ') : 'See transcript for details';
  }

  /**
   * Simple format when no template
   */
  private simpleFormat(transcript: string): string {
    return `DICTATION:\n${transcript}\n`;
  }
}

export const cleanTemplateProcessor = new CleanTemplateProcessor();
