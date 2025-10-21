/**
 * Template Store - Compatibility layer for Supabase templates
 * NOTE: This is a legacy compatibility layer. New code should use doctorProfileService directly.
 */

import { getAllTemplates } from './soapTemplates';
import { doctorProfileService } from '../services/doctorProfile.service';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

class TemplateStore {
  private static instance: TemplateStore;
  private doctorId: string = '';

  private constructor() {
    this.initializeDoctorId();
  }

  private async initializeDoctorId() {
    try {
      const result = await supabaseAuthService.getCurrentUser();
      if (result.success && result.user) {
        this.doctorId = result.user.authUserId || result.user.id || result.user.email || 'doctor-default-001';
        doctorProfileService.initialize(this.doctorId);
      }
    } catch (error) {
      console.error('[templateStore] Error initializing doctor ID:', error);
    }
  }

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

  // Get all templates from Supabase (async)
  async getAllTemplates() {
    return await getAllTemplates();
  }

  // Refresh templates
  async refreshTemplates() {
    // Templates are always fresh from Supabase
    logDebug('TemplateStore', 'Refreshing templates from Supabase', {});
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
  async getTemplateById(templateId: string) {
    const templates = await this.getAllTemplates();
    return templates.find(t => t.id === templateId) || null;
  }

  // Get default template
  async getDefaultTemplate() {
    const defaultId = this.getDefaultTemplateId();
    if (defaultId) {
      return await this.getTemplateById(defaultId);
    }
    const all = await this.getAllTemplates();
    return all[0] || null;
  }

  // Save custom template (saves to Supabase)
  async saveCustomTemplate(template: any) {
    try {
      if (!this.doctorId) {
        await this.initializeDoctorId();
      }

      await doctorProfileService.createTemplate({
        name: template.name,
        description: `${template.specialty || 'General'} template`,
        visitType: 'general',
        isDefault: false,
        sections: {
          subjective: template.subjective || {},
          objective: template.objective || {},
          assessment: template.assessment || {},
          plan: template.plan || {},
        }
      }, this.doctorId);
    } catch (error) {
      logError('TemplateStore', 'Error saving template', { error });
      throw error;
    }
  }

  // Delete custom template
  async deleteCustomTemplate(templateId: string) {
    try {
      if (!this.doctorId) {
        await this.initializeDoctorId();
      }
      await doctorProfileService.deleteTemplate(templateId, this.doctorId);
    } catch (error) {
      logError('TemplateStore', 'Error deleting template', { error });
      throw error;
    }
  }

  // Export settings
  async exportSettings() {
    const templates = await doctorProfileService.getTemplates(this.doctorId);
    return {
      templates,
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
