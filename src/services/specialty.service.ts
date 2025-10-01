/**
 * Specialty Service
 * Manages doctor specialties and template selection
 */

import {
  ENDOCRINOLOGY_TEMPLATE,
  PSYCHIATRY_TEMPLATE,
  NUTRITION_TEMPLATE,
  type SpecialtyTemplate,
  getTemplateBySpecialty,
} from '../config/specialtyTemplates';

export type DoctorSpecialty = 'endocrinology' | 'psychiatry' | 'nutrition';

export interface Doctor {
  id: string;
  name: string;
  specialty: DoctorSpecialty;
  code?: string;
  customSettings?: {
    additionalCorrections?: Record<string, string>;
    additionalHighlightTerms?: string[];
    customPromptAdditions?: string;
  };
}

class SpecialtyService {
  private currentDoctor: Doctor | null = null;
  private currentTemplate: SpecialtyTemplate | null = null;

  /**
   * Set the current doctor and load their template
   */
  setCurrentDoctor(doctor: Doctor): void {
    this.currentDoctor = doctor;
    this.currentTemplate = getTemplateBySpecialty(doctor.specialty);

    // Apply any custom doctor-specific settings
    if (doctor.customSettings && this.currentTemplate) {
      this.applyCustomSettings(doctor.customSettings);
    }
  }

  /**
   * Get the current doctor
   */
  getCurrentDoctor(): Doctor | null {
    return this.currentDoctor;
  }

  /**
   * Get the current template
   */
  getCurrentTemplate(): SpecialtyTemplate {
    // Default to endocrinology if no template is set
    if (!this.currentTemplate) {
      return ENDOCRINOLOGY_TEMPLATE;
    }
    return this.currentTemplate;
  }

  /**
   * Apply custom doctor-specific settings to the template
   */
  private applyCustomSettings(customSettings: Doctor['customSettings']): void {
    if (!this.currentTemplate || !customSettings) return;

    // Create a deep copy of the template to avoid modifying the original
    const template = JSON.parse(JSON.stringify(this.currentTemplate));

    // Add custom corrections
    if (customSettings.additionalCorrections) {
      Object.assign(template.corrections.medications, customSettings.additionalCorrections);
    }

    // Add custom highlight terms
    if (customSettings.additionalHighlightTerms) {
      template.highlightTerms.push(...customSettings.additionalHighlightTerms);
    }

    // Add custom prompt additions
    if (customSettings.customPromptAdditions) {
      template.aiPrompt.additionalInstructions =
        (template.aiPrompt.additionalInstructions || '') +
        '\n' +
        customSettings.customPromptAdditions;
    }

    this.currentTemplate = template;
  }

  /**
   * Get medication corrections for the current specialty
   */
  getMedicationCorrections(): Record<string, string> {
    const template = this.getCurrentTemplate();
    return template.corrections?.medications || {};
  }

  /**
   * Get medical term corrections for the current specialty
   */
  getMedicalTermCorrections(): Record<string, string> {
    const template = this.getCurrentTemplate();
    return template.corrections?.terms || {};
  }

  /**
   * Get phrase corrections for the current specialty
   */
  getPhraseCorrections(): Record<string, string> {
    const template = this.getCurrentTemplate();
    return template.corrections?.phrases || {};
  }

  /**
   * Get all corrections combined
   */
  getAllCorrections(): {
    medications: Record<string, string>;
    medicalTerms: Record<string, string>;
    phrases: Record<string, string>;
  } {
    const template = this.getCurrentTemplate();
    // Ensure we always return a valid object with all properties
    // Note: template uses 'terms' but we return as 'medicalTerms' for consistency
    return {
      medications: template.corrections?.medications || {},
      medicalTerms: template.corrections?.terms || {},
      phrases: template.corrections?.phrases || {},
    };
  }

  /**
   * Get highlight terms for the current specialty
   */
  getHighlightTerms(): string[] {
    const template = this.getCurrentTemplate();
    return template.highlightTerms;
  }

  /**
   * Get AI prompt for the current specialty
   */
  getAIPrompt(): SpecialtyTemplate['aiPrompt'] {
    const template = this.getCurrentTemplate();
    return template.aiPrompt;
  }

  /**
   * Get note sections for the current specialty
   */
  getNoteSections(): SpecialtyTemplate['noteSections'] {
    const template = this.getCurrentTemplate();
    return template.noteSections;
  }

  /**
   * Check if a term should be highlighted
   */
  shouldHighlight(term: string): boolean {
    const highlightTerms = this.getHighlightTerms();
    const lowerTerm = term.toLowerCase();
    return highlightTerms.some(highlightTerm => lowerTerm.includes(highlightTerm.toLowerCase()));
  }

  /**
   * Apply corrections to text based on current specialty
   */
  applyCorrections(text: string): string {
    if (!text) return '';

    const corrections = this.getAllCorrections();
    if (!corrections) return text;

    let corrected = text;

    // Apply medication corrections
    if (corrections.medications && typeof corrections.medications === 'object') {
      Object.entries(corrections.medications).forEach(([error, correction]) => {
        const regex = new RegExp(`\\b${error}\\b`, 'gi');
        corrected = corrected.replace(regex, correction);
      });
    }

    // Apply medical term corrections
    if (corrections.medicalTerms && typeof corrections.medicalTerms === 'object') {
      Object.entries(corrections.medicalTerms).forEach(([error, correction]) => {
        const regex = new RegExp(`\\b${error}\\b`, 'gi');
        corrected = corrected.replace(regex, correction);
      });
    }

    // Apply phrase corrections
    if (corrections.phrases && typeof corrections.phrases === 'object') {
      Object.entries(corrections.phrases).forEach(([error, correction]) => {
        const regex = new RegExp(error, 'gi');
        corrected = corrected.replace(regex, correction);
      });
    }

    return corrected;
  }

  /**
   * Format the AI prompt with patient and transcript data
   */
  formatAIPrompt(transcript: string, patientData?: any): string {
    const prompt = this.getAIPrompt();
    const sections = this.getNoteSections();
    const template = this.getCurrentTemplate();

    // Ensure focusAreas is an array
    const focusAreas = Array.isArray(prompt.focusAreas) ? prompt.focusAreas : [];

    // Convert sections object to array of section titles
    const sectionTitles = Object.values(sections)
      .sort((a, b) => a.order - b.order)
      .map(section => section.title);

    let formattedPrompt = `You are an experienced medical scribe working for a ${prompt.role}.

${template.specialty ? `Specialty: ${template.specialty}` : ''}

Pay special attention to:
${focusAreas.map(area => `- ${area}`).join('\n')}

${prompt.specialInstructions || ''}

Please format the clinical note with these sections:
${sectionTitles.map(title => `- ${title}`).join('\n')}

Patient Information:
${patientData ? JSON.stringify(patientData, null, 2) : 'No patient data provided'}

Transcript to process:
${transcript}

Important formatting requirements:
1. Use markdown headers (##) for each section
2. Be comprehensive but concise
3. Include all relevant medical information
4. Flag any concerning findings
5. Suggest appropriate follow-up
`;

    return formattedPrompt;
  }

  /**
   * Get a list of all available specialties
   */
  getAvailableSpecialties(): DoctorSpecialty[] {
    return ['endocrinology', 'psychiatry', 'nutrition'];
  }

  /**
   * Reset the service (for logout or doctor switch)
   */
  reset(): void {
    this.currentDoctor = null;
    this.currentTemplate = null;
  }
}

// Export singleton instance
export const specialtyService = new SpecialtyService();

// Export convenience functions
export const setDoctorSpecialty = (doctor: Doctor) => specialtyService.setCurrentDoctor(doctor);
export const getCurrentSpecialty = () => specialtyService.getCurrentDoctor()?.specialty;
export const getSpecialtyTemplate = () => specialtyService.getCurrentTemplate();
export const applySpecialtyCorrections = (text: string) => specialtyService.applyCorrections(text);
export const getSpecialtyHighlightTerms = () => specialtyService.getHighlightTerms();
export const formatSpecialtyPrompt = (transcript: string, patientData?: any) =>
  specialtyService.formatAIPrompt(transcript, patientData);
