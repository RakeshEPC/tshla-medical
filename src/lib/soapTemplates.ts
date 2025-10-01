/**
 * SOAP Templates - Now uses Template Studio Enhanced as the single source of truth
 */

import { templateStorage } from './templateStorage';

export interface SOAPTemplate {
  id: string;
  name: string;
  specialty: string;
  description?: string;
  subjective: any;
  objective: any;
  assessment: any;
  plan: any;
}

// Get all templates from Template Studio Enhanced
export function getAllTemplates(): SOAPTemplate[] {
  const studioTemplates = templateStorage.getTemplates();

  // Convert studio templates to SOAP format
  return studioTemplates.map(template => ({
    id: template.id,
    name: template.name,
    specialty: template.specialty || 'General',
    description: `${template.name} template`,
    subjective: template.sections?.subjective || {},
    objective: template.sections?.objective || {},
    assessment: template.sections?.assessment || {},
    plan: template.sections?.plan || {},
  }));
}

// Get saved template preference
export function getSavedTemplate(): string {
  if (typeof window !== 'undefined') {
    const savedId = localStorage.getItem('preferred_soap_template');
    const templates = getAllTemplates();

    // Verify the saved template still exists
    if (savedId && templates.find(t => t.id === savedId)) {
      return savedId;
    }

    // Return first template if saved doesn't exist
    return templates[0]?.id || '';
  }
  return '';
}

// Save template preference
export function saveTemplatePreference(templateId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('preferred_soap_template', templateId);
  }
}

// Get custom templates (now returns empty since all templates are in Template Studio)
export function getCustomTemplates(): SOAPTemplate[] {
  return [];
}

// Save custom template (redirects to Template Studio)
export function saveCustomTemplate(template: SOAPTemplate): void {
  // Convert to studio format and save
  templateStorage.createTemplate({
    name: template.name,
    specialty: template.specialty || 'General',
    template_type: 'soap',
    sections: {
      subjective: template.subjective,
      objective: template.objective,
      assessment: template.assessment,
      plan: template.plan,
    },
    is_shared: false,
    macros: {},
    quick_phrases: [],
  });
}
