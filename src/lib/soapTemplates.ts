/**
 * SOAP Templates - Now uses Supabase via doctorProfileService as the single source of truth
 * NOTE: This is a compatibility layer for legacy code. New code should use doctorProfileService directly.
 */

import { doctorProfileService } from '../services/doctorProfile.service';
import { supabaseAuthService } from '../services/supabaseAuth.service';

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

// Get all templates from Supabase
export async function getAllTemplates(): Promise<SOAPTemplate[]> {
  try {
    // Get current user
    const result = await supabaseAuthService.getCurrentUser();
    if (!result.success || !result.user) {
      console.warn('[soapTemplates] No authenticated user, returning empty templates');
      return [];
    }

    const doctorId = result.user.authUserId || result.user.id || result.user.email || 'doctor-default-001';
    doctorProfileService.initialize(doctorId);

    const studioTemplates = await doctorProfileService.getTemplates(doctorId);

    // Convert studio templates to SOAP format
    return studioTemplates.map(template => ({
      id: template.id,
      name: template.name,
      specialty: 'General',
      description: template.description || `${template.name} template`,
      subjective: template.sections?.subjective || {},
      objective: template.sections?.objective || {},
      assessment: template.sections?.assessment || {},
      plan: template.sections?.plan || {},
    }));
  } catch (error) {
    console.error('[soapTemplates] Error loading templates:', error);
    return [];
  }
}

// Get saved template preference
export async function getSavedTemplate(): Promise<string> {
  if (typeof window !== 'undefined') {
    const savedId = localStorage.getItem('preferred_soap_template');
    const templates = await getAllTemplates();

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

// Get custom templates (now returns empty since all templates are in Supabase)
export async function getCustomTemplates(): Promise<SOAPTemplate[]> {
  return [];
}

// Save custom template (saves to Supabase)
export async function saveCustomTemplate(template: SOAPTemplate): Promise<void> {
  try {
    const result = await supabaseAuthService.getCurrentUser();
    if (!result.success || !result.user) {
      throw new Error('No authenticated user');
    }

    const doctorId = result.user.authUserId || result.user.id || result.user.email || 'doctor-default-001';
    doctorProfileService.initialize(doctorId);

    // Convert to DoctorTemplate format and save to Supabase
    await doctorProfileService.createTemplate({
      name: template.name,
      description: template.description || `${template.name} template`,
      visitType: 'general',
      isDefault: false,
      sections: {
        subjective: template.subjective,
        objective: template.objective,
        assessment: template.assessment,
        plan: template.plan,
      }
    }, doctorId);
  } catch (error) {
    console.error('[soapTemplates] Error saving template:', error);
    throw error;
  }
}
