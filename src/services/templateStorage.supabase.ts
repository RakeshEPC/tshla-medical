import { supabaseService } from './supabase.service';
import { doctorProfileService, type DoctorTemplate } from './doctorProfile.service';
import { supabaseAuthService } from './supabaseAuth.service';
import type { Template as SupabaseTemplate } from '../lib/supabase';
import type { Template } from '../types/template.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

/**
 * Convert local template format to Supabase format
 */
const convertToSupabaseTemplate = (
  template: Template
): Omit<SupabaseTemplate, 'id' | 'created_at' | 'updated_at'> => {
  return {
    name: template.name,
    specialty: template.specialty,
    template_type: template.template_type,
    sections: template.sections,
    macros: template.macros || {},
    quick_phrases: template.quick_phrases || [],
    is_system_template: template.is_system_template || false,
    is_shared: false,
    created_by: null,
    usage_count: template.usage_count || 0,
  };
};

/**
 * Convert Supabase template to local format
 */
const convertFromSupabaseTemplate = (template: SupabaseTemplate): Template => {
  return {
    id: template.id,
    name: template.name,
    specialty: template.specialty,
    template_type: template.template_type,
    sections: template.sections,
    macros: template.macros || {},
    quick_phrases: template.quick_phrases || [],
    is_system_template: template.is_system_template || false,
    usage_count: template.usage_count || 0,
  };
};

/**
 * Template storage service that syncs with Supabase via doctorProfileService
 * NOTE: This is a compatibility layer for legacy code. New code should use doctorProfileService directly.
 */
class SupabaseTemplateStorage {
  private cache: Map<string, Template> = new Map();
  private initialized = false;
  private doctorId: string = '';

  /**
   * Initialize doctor ID and templates from Supabase
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Get current user
      const result = await supabaseAuthService.getCurrentUser();
      if (result.success && result.user) {
        this.doctorId = result.user.authUserId || result.user.id || result.user.email || 'doctor-default-001';
        doctorProfileService.initialize(this.doctorId);

        // Load templates from Supabase
        const templates = await doctorProfileService.getTemplates(this.doctorId);

        // Clear cache and populate
        this.cache.clear();
        templates.forEach(template => {
          const converted = this.convertDoctorTemplateToTemplate(template);
          this.cache.set(template.id, converted);
        });
        this.initialized = true;
      } else {
        logError('templateStorage.supabase', 'No authenticated user found', {});
      }
    } catch (error) {
      logError('templateStorage.supabase', 'Error initializing templates', { error });
    }
  }

  /**
   * Convert DoctorTemplate to Template format
   */
  private convertDoctorTemplateToTemplate(dt: DoctorTemplate): Template {
    return {
      id: dt.id,
      name: dt.name,
      description: dt.description || '',
      specialty: 'General',
      template_type: 'custom',
      sections: dt.sections || {},
      created_at: dt.createdAt,
      usage_count: dt.usageCount || 0,
      macros: {},
      quick_phrases: [],
      is_system_template: false
    };
  }

  /**
   * Get all templates
   */
  async getTemplates(): Promise<Template[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return Array.from(this.cache.values());
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<Template | undefined> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.cache.get(id);
  }

  /**
   * Add a new template
   */
  async addTemplate(template: Omit<Template, 'id'>): Promise<Template> {
    try {
      if (!this.doctorId) {
        await this.initialize();
      }

      const newTemplate = await doctorProfileService.createTemplate({
        name: template.name,
        description: template.description || '',
        visitType: 'general',
        isDefault: false,
        sections: template.sections || {}
      }, this.doctorId);

      const converted = this.convertDoctorTemplateToTemplate(newTemplate);
      this.cache.set(newTemplate.id, converted);
      return converted;
    } catch (error) {
      logError('templateStorage.supabase', 'Error adding template', { error });
      throw error;
    }
  }

  /**
   * Update template usage count
   */
  async trackUsage(templateId: string): Promise<void> {
    try {
      if (!this.doctorId) {
        await this.initialize();
      }

      await doctorProfileService.trackTemplateUsage(templateId, this.doctorId);

      // Also update local cache
      const template = this.cache.get(templateId);
      if (template) {
        template.usage_count = (template.usage_count || 0) + 1;
        this.cache.set(templateId, template);
      }
    } catch (error) {
      logError('templateStorage.supabase', 'Error tracking usage', { error });
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      if (!this.doctorId) {
        await this.initialize();
      }

      await doctorProfileService.deleteTemplate(id, this.doctorId);
      this.cache.delete(id);
    } catch (error) {
      logError('templateStorage.supabase', 'Error deleting template', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const supabaseTemplateStorage = new SupabaseTemplateStorage();
