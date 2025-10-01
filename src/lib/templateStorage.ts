// Client-side template storage service
// Uses localStorage for persistent template storage without database

import type { Template } from '../types/template.types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
export type { Template } from '../types/template.types';

class TemplateStorageService {
  private readonly STORAGE_KEY = 'medical_templates_v2';
  private readonly MAX_TEMPLATES = 50;

  // Get all templates
  getTemplates(): Template[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return this.getDefaultTemplates();

      const templates = JSON.parse(stored);
      return Array.isArray(templates) ? templates : this.getDefaultTemplates();
    } catch (error) {
      logError('App', 'Error message', {});
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
      usage_count: 0,
    };

    // Add new template (limit total number)
    const updatedTemplates = [...templates, newTemplate].slice(-this.MAX_TEMPLATES);
    this.saveTemplates(updatedTemplates);

    return newTemplate;
  }

  // Update existing template
  updateTemplate(id: string, updates: Partial<Template>): boolean {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === id);

    if (index === -1) return false;

    templates[index] = {
      ...templates[index],
      ...updates,
      id: templates[index].id, // Prevent ID change
      updated_at: new Date().toISOString(),
    };

    this.saveTemplates(templates);
    return true;
  }

  // Delete template
  deleteTemplate(id: string): boolean {
    const templates = this.getTemplates();
    const filtered = templates.filter(t => t.id !== id);

    if (filtered.length === templates.length) return false;

    this.saveTemplates(filtered);
    return true;
  }

  // Increment usage count
  incrementUsage(id: string): void {
    const templates = this.getTemplates();
    const template = templates.find(t => t.id === id);

    if (template) {
      template.usage_count = (template.usage_count || 0) + 1;
      template.last_used = new Date().toISOString();
      this.saveTemplates(templates);
    }
  }

  // Alias for backward compatibility
  trackUsage(id: string): void {
    this.incrementUsage(id);
  }

  // Save templates to localStorage
  private saveTemplates(templates: Template[]): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      logError('App', 'Error message', {});
      // If localStorage is full, remove oldest templates
      if (error.name === 'QuotaExceededError') {
        const reduced = templates.slice(-Math.floor(this.MAX_TEMPLATES / 2));
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reduced));
      }
    }
  }

  // Get default templates - YOUR 4 TEMPLATES ONLY
  private getDefaultTemplates(): Template[] {
    return [
      {
        id: 'diabetes_followup',
        name: 'Diabetes Follow Up',
        specialty: 'Endocrinology',
        template_type: 'soap',
        is_system_template: true,
        sections: {
          subjective: {
            prompts: [
              'Current blood sugar levels',
              'Medication compliance',
              'Diet and exercise habits',
              'Hypoglycemic episodes',
              'Symptoms: polyuria, polydipsia, polyphagia',
            ],
            aiInstructions:
              'Focus on diabetes-specific symptoms, blood sugar patterns, medication adherence, and lifestyle factors. Document any episodes of hypoglycemia or hyperglycemia with timing and triggers.',
          },
          objective: {
            prompts: [
              'Vital signs',
              'Weight/BMI',
              'Foot examination',
              'A1C level',
              'Glucose readings review',
            ],
            aiInstructions:
              'Include specific A1C values, glucose ranges, BMI calculations, and detailed foot exam findings including sensation, pulses, and skin integrity.',
          },
          assessment: {
            prompts: [
              'Diabetes control status',
              'Complications assessment',
              'Medication effectiveness',
            ],
            aiInstructions:
              'Assess diabetes control based on A1C and glucose patterns. Evaluate for microvascular and macrovascular complications. Comment on medication efficacy and side effects.',
          },
          plan: {
            prompts: [
              'Medication adjustments',
              'Lab orders: A1C, lipids, kidney function',
              'Referrals: ophthalmology, podiatry',
              'Lifestyle counseling',
              'Follow-up interval',
            ],
            aiInstructions:
              'Provide specific medication dosing changes, target A1C goals, preventive care recommendations, and clear follow-up timeline. Include patient education points.',
          },
        },
        usage_count: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: 'hypertension_management',
        name: 'Hypertension Management',
        specialty: 'Cardiology',
        template_type: 'soap',
        is_system_template: true,
        sections: {
          subjective: {
            prompts: [
              'Home blood pressure readings',
              'Medication compliance',
              'Side effects',
              'Symptoms: headaches, dizziness, chest pain',
              'Salt intake and lifestyle',
            ],
            aiInstructions:
              'Document blood pressure patterns, medication adherence, and any cardiovascular symptoms. Note lifestyle factors affecting BP control.',
          },
          objective: {
            prompts: [
              'Blood pressure readings',
              'Heart rate and rhythm',
              'Cardiac examination',
              'Peripheral edema',
              'Weight changes',
            ],
            aiInstructions:
              'Record multiple BP readings if available, cardiac exam findings, and signs of end-organ damage.',
          },
          assessment: {
            prompts: [
              'Blood pressure control status',
              'Target organ damage',
              'Cardiovascular risk assessment',
            ],
            aiInstructions:
              'Evaluate BP control, assess for target organ damage, and calculate cardiovascular risk.',
          },
          plan: {
            prompts: [
              'Medication titration',
              'Lifestyle modifications',
              'Lab work: BMP, lipids',
              'ECG if indicated',
              'Follow-up schedule',
            ],
            aiInstructions:
              'Provide specific medication adjustments, lifestyle recommendations, and follow-up plan.',
          },
        },
        usage_count: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: 'general_soap',
        name: 'General SOAP Note',
        specialty: 'General Medicine',
        template_type: 'soap',
        is_system_template: true,
        sections: {
          subjective: {
            prompts: [
              'Chief complaint',
              'History of present illness',
              'Review of systems',
              'Past medical history',
              'Current medications',
              'Allergies',
            ],
            aiInstructions:
              "Document the patient's chief complaint and relevant history. Include pertinent positives and negatives from review of systems.",
          },
          objective: {
            prompts: [
              'Vital signs',
              'Physical examination',
              'Laboratory results',
              'Imaging results if available',
            ],
            aiInstructions:
              'Record objective findings including vital signs and physical exam findings.',
          },
          assessment: {
            prompts: ['Primary diagnosis', 'Differential diagnoses', 'Clinical impression'],
            aiInstructions: 'Provide assessment with primary diagnosis and relevant differentials.',
          },
          plan: {
            prompts: [
              'Medications prescribed',
              'Tests ordered',
              'Referrals',
              'Follow-up instructions',
              'Patient education',
            ],
            aiInstructions:
              'Detail the treatment plan including medications, tests, and follow-up.',
          },
        },
        usage_count: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: 'rakesh_template',
        name: 'Rakesh',
        specialty: 'Endocrinology',
        template_type: 'soap',
        is_system_template: true,
        sections: {
          subjective: {
            prompts: [
              'Chief complaint',
              'Current symptoms',
              'Blood sugar patterns',
              'Medication adherence',
              'Diet and exercise',
            ],
            aiInstructions:
              "Document patient's current concerns and diabetes management status using Dr. Rakesh's preferred format.",
          },
          objective: {
            prompts: [
              'Vital signs including BP and weight',
              'Physical exam with focus on diabetic complications',
              'Latest A1C and glucose values',
              'Other relevant labs',
            ],
            aiInstructions:
              'Record objective findings with emphasis on endocrine-related parameters.',
          },
          assessment: {
            prompts: [
              'Diabetes control assessment',
              'Complications status',
              'Other endocrine issues',
            ],
            aiInstructions: 'Assess overall endocrine status and diabetes control.',
          },
          plan: {
            prompts: [
              'Medication adjustments',
              'Lab orders',
              'Lifestyle recommendations',
              'Follow-up plan',
            ],
            aiInstructions: 'Provide comprehensive endocrine management plan.',
          },
        },
        usage_count: 0,
        created_at: new Date().toISOString(),
      },
    ];
  }

  // Clear all templates (except system templates)
  clearUserTemplates(): void {
    const templates = this.getTemplates();
    const systemTemplates = templates.filter(t => t.is_system_template);
    this.saveTemplates(systemTemplates);
  }

  // Export templates as JSON
  exportTemplates(): string {
    const templates = this.getTemplates();
    return JSON.stringify(templates, null, 2);
  }

  // Import templates from JSON
  importTemplates(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      if (!Array.isArray(imported)) return false;

      const templates = this.getTemplates();
      const merged = [...templates, ...imported].slice(-this.MAX_TEMPLATES);
      this.saveTemplates(merged);
      return true;
    } catch (error) {
      logError('App', 'Error message', {});
      return false;
    }
  }
}

// Export singleton instance
export const templateStorage = new TemplateStorageService();
