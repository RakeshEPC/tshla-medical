// Template storage service - manages medical dictation templates

import type { Template, TemplateSection } from '../types/template.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

// Re-export for backward compatibility
export type { Template, TemplateSection };

class TemplateStorageService {
  private readonly STORAGE_KEY = 'medical_templates_v2';
  private readonly MAX_TEMPLATES = 50;

  // Get all templates
  getTemplates(): Template[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      let userTemplates: Template[] = [];

      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          userTemplates = parsed;
        }
      }

      // If no user templates exist, include default templates
      if (userTemplates.length === 0) {
        const defaultTemplates = this.getDefaultTemplates();
        return defaultTemplates;
      }

      logDebug('templateStorage', 'Loaded templates', { count: userTemplates.length });
      return userTemplates;
    } catch (error) {
      logError('templateStorage', 'Failed to load templates', { error });
      // Return default templates as fallback
      return this.getDefaultTemplates();
    }
  }

  // Get single template by ID
  getTemplate(id: string): Template | null {
    const templates = this.getTemplates();
    return templates.find(t => t.id === id) || null;
  }

  // Create new template
  createTemplate(template: Omit<Template, 'id' | 'created_at' | 'usage_count'>): Template {
    const templates = this.getTemplates();
    
    const newTemplate: Template = {
      ...template,
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      usage_count: 0
    };

    // Check storage limit
    if (templates.length >= this.MAX_TEMPLATES) {
      // Remove least used non-system template
      const sortedTemplates = templates
        .filter(t => !t.is_system_template)
        .sort((a, b) => (a.usage_count || 0) - (b.usage_count || 0));
      
      if (sortedTemplates.length > 0) {
        const toRemove = sortedTemplates[0];
        const index = templates.findIndex(t => t.id === toRemove.id);
        templates.splice(index, 1);
      }
    }

    templates.push(newTemplate);
    this.saveTemplates(templates);
    return newTemplate;
  }

  // Update template
  updateTemplate(id: string, updates: Partial<Template>): Template | null {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    
    if (index === -1) return null;
    
    templates[index] = {
      ...templates[index],
      ...updates,
      id: templates[index].id, // Preserve ID
      created_at: templates[index].created_at, // Preserve creation date
      updated_at: new Date().toISOString()
    };
    
    this.saveTemplates(templates);
    return templates[index];
  }

  // Delete template
  deleteTemplate(id: string): boolean {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    
    if (index === -1) return false;
    
    // Don't delete system templates
    if (templates[index].is_system_template) return false;
    
    templates.splice(index, 1);
    this.saveTemplates(templates);
    return true;
  }

  // Track template usage
  trackUsage(id: string): void {
    const templates = this.getTemplates();
    const template = templates.find(t => t.id === id);
    
    if (template) {
      template.usage_count = (template.usage_count || 0) + 1;
      this.saveTemplates(templates);
    }
  }

  // Save templates to localStorage
  private saveTemplates(templates: Template[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      logError('templateStorage', 'Error message', {});
    }
  }

  // Get default templates
  private getDefaultTemplates(): Template[] {
    // Import standard templates and convert to Template format
    try {
      const { standardTemplates } = require('../data/standardTemplates');
      return standardTemplates.map((template: any, index: number) => ({
        id: `default_${index + 1}`,
        name: template.name,
        template_type: template.visitType || 'general',
        specialty: 'General Medicine',
        sections: Object.keys(template.sections || {}).map((key, sectionIndex) => ({
          id: `section_${sectionIndex + 1}`,
          title: template.sections[key].title || key,
          content: template.sections[key].aiInstructions || '',
          order: template.sections[key].order || sectionIndex + 1
        })),
        is_system_template: true,
        created_at: new Date().toISOString(),
        usage_count: 0
      }));
    } catch (error) {
      logError('templateStorage', 'Failed to load default templates', { error });
      return [];
    }
  }

  // Search templates
  searchTemplates(query: string): Template[] {
    const templates = this.getTemplates();
    const lowercaseQuery = query.toLowerCase();
    
    return templates.filter(template => 
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.specialty.toLowerCase().includes(lowercaseQuery) ||
      template.template_type.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Get templates by specialty
  getTemplatesBySpecialty(specialty: string): Template[] {
    const templates = this.getTemplates();
    return templates.filter(t => t.specialty === specialty);
  }

  // Export templates
  exportTemplates(): string {
    const templates = this.getTemplates();
    return JSON.stringify(templates, null, 2);
  }

  // Import templates
  importTemplates(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      if (!Array.isArray(imported)) return false;
      
      const templates = this.getTemplates();
      const merged = [...templates];
      
      for (const template of imported) {
        if (!merged.find(t => t.id === template.id)) {
          merged.push(template);
        }
      }
      
      this.saveTemplates(merged);
      return true;
    } catch (error) {
      logError('templateStorage', 'Error message', {});
      return false;
    }
  }
}

export const templateStorage = new TemplateStorageService();