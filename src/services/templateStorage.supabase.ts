import { supabaseService } from './supabase.service';
import type { Template as SupabaseTemplate } from '../lib/supabase';
import { templateStorage } from './templateStorage';
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
 * Template storage service that syncs with Supabase
 */
class SupabaseTemplateStorage {
  private cache: Map<string, Template> = new Map();
  private initialized = false;

  /**
   * Initialize templates from Supabase
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (supabaseService.isConfigured()) {
      try {
        const result = await supabaseService.getTemplates();
        if (result.success && result.templates) {
          // Clear cache and load from Supabase
          this.cache.clear();
          result.templates.forEach(template => {
            const converted = convertFromSupabaseTemplate(template);
            this.cache.set(template.id, converted);
          });
          this.initialized = true;
        }
      } catch (error) {
        logError('templateStorage.supabase', 'Error message', {});
        // Fallback to local templates
        this.loadLocalTemplates();
      }
    } else {
      // Load local templates if Supabase not configured
      this.loadLocalTemplates();
    }
  }

  /**
   * Load templates from localStorage
   */
  private loadLocalTemplates(): void {
    const localTemplates = templateStorage.getTemplates();
    this.cache.clear();
    localTemplates.forEach(template => {
      this.cache.set(template.id, template);
    });
    this.initialized = true;
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
    if (supabaseService.isConfigured()) {
      try {
        const result = await supabaseService.createTemplate(
          convertToSupabaseTemplate(template as Template)
        );
        if (result.success && result.template) {
          const converted = convertFromSupabaseTemplate(result.template);
          this.cache.set(result.template.id, converted);
          return converted;
        }
      } catch (error) {
        logError('templateStorage.supabase', 'Error message', {});
      }
    }

    // Fallback to local storage
    const newTemplate = templateStorage.addTemplate(template);
    this.cache.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  /**
   * Update template usage count
   */
  async trackUsage(templateId: string): Promise<void> {
    // Update in Supabase if configured
    if (supabaseService.isConfigured()) {
      await supabaseService.updateTemplateUsage(templateId);
    }

    // Also update local cache
    const template = this.cache.get(templateId);
    if (template) {
      template.usage_count = (template.usage_count || 0) + 1;
      this.cache.set(templateId, template);
    }

    // Update localStorage as well
    templateStorage.trackUsage(templateId);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    // For now, only delete from local storage
    // Supabase deletion would need additional API method
    templateStorage.deleteTemplate(id);
    this.cache.delete(id);
  }
}

// Export singleton instance
export const supabaseTemplateStorage = new SupabaseTemplateStorage();
