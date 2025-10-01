/**
 * Template Store - Redirects to Template Studio Enhanced
 */

import { getAllTemplates } from './soapTemplates';
import { templateStorage } from './templateStorage';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

class TemplateStore {
  private static instance: TemplateStore;

  private constructor() {}

  static getInstance(): TemplateStore {
    if (!TemplateStore.instance) {
      TemplateStore.instance = new TemplateStore();
    }
    return TemplateStore.instance;
  }

  // Subscribe to changes (no-op for now)
  subscribe(callback: () => void) {
    return () => {};
  }

  // Get all templates from Template Studio
  getAllTemplates() {
    return getAllTemplates();
  }

  // Refresh templates
  refreshTemplates() {
    // Templates are always fresh from templateStorage
    logDebug('App', 'Debug message', {});
  }

  // Check authentication status
  async checkAuthStatus() {
    // No-op for now
    return 'guest';
  }

  // Get current user
  getCurrentUser(): string {
    return 'guest';
  }

  // Get default template ID
  getDefaultTemplateId(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('default_template_id');
    }
    return null;
  }

  // Set default template
  setDefaultTemplate(templateId: string | null) {
    if (typeof window !== 'undefined' && templateId) {
      localStorage.setItem('default_template_id', templateId);
    }
  }

  // Get template by ID
  getTemplateById(templateId: string) {
    const templates = this.getAllTemplates();
    return templates.find(t => t.id === templateId) || null;
  }

  // Get default template
  getDefaultTemplate() {
    const defaultId = this.getDefaultTemplateId();
    if (defaultId) {
      return this.getTemplateById(defaultId);
    }
    const all = this.getAllTemplates();
    return all[0] || null;
  }

  // Save custom template (redirects to Template Studio)
  saveCustomTemplate(template: any) {
    templateStorage.createTemplate({
      name: template.name,
      specialty: template.specialty || 'General',
      template_type: 'soap',
      sections: {
        subjective: template.subjective || {},
        objective: template.objective || {},
        assessment: template.assessment || {},
        plan: template.plan || {},
      },
      is_shared: false,
      macros: {},
      quick_phrases: [],
    });
  }

  // Delete custom template
  deleteCustomTemplate(templateId: string) {
    templateStorage.deleteTemplate(templateId);
  }

  // Export settings
  exportSettings() {
    return {
      templates: templateStorage.getTemplates(),
      defaultTemplateId: this.getDefaultTemplateId(),
      timestamp: new Date().toISOString(),
    };
  }

  // Import settings (no-op for now)
  importSettings(data: any) {
    logDebug('App', 'Debug message', {});
  }
}

export default TemplateStore.getInstance();
