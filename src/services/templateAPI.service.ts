/**
 * Template API Service
 * Handles server-side storage of doctor templates
 */

import type { DoctorTemplate, DoctorSettings, DoctorProfile } from './doctorProfile.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.tshla.ai/api';

class TemplateAPIService {
  private authToken: string | null = null;

  constructor() {
    // Get auth token from localStorage
    this.authToken = localStorage.getItem('auth_token');
  }

  /**
   * Get headers with authentication
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Save doctor profile to server with timeout and retry
   */
  async saveProfile(profile: DoctorProfile): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(`${API_BASE}/api/doctor-profiles`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          doctorId: profile.doctorId,
          settings: profile.settings,
          templates: profile.templates,
          recentTemplates: profile.recentTemplates,
          favoriteTemplates: profile.favoriteTemplates,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to save profile: ${response.statusText}`);
      }

      logInfo('templateAPI', 'Info message', {});
      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        logWarn('templateAPI', 'Warning message', {});
      } else {
        logError('templateAPI', 'Error message', {});
      }

      // Fallback: Save to localStorage on API failure
      try {
        localStorage.setItem(`doctor_profile_${profile.doctorId}`, JSON.stringify(profile));
        logDebug('templateAPI', 'Debug message', {});
      } catch (localError) {
        logError('templateAPI', 'Error message', {});
      }

      return false;
    }
  }

  /**
   * Load doctor profile from server
   */
  async loadProfile(doctorId: string): Promise<DoctorProfile | null> {
    try {
      const response = await fetch(`${API_BASE}/api/doctor-profiles/${doctorId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Profile doesn't exist yet
          return null;
        }
        throw new Error(`Failed to load profile: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logError('templateAPI', 'Error message', {});
      return null;
    }
  }

  /**
   * Save individual template to server with timeout and fallback
   */
  async saveTemplate(template: DoctorTemplate, doctorId: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${API_BASE}/api/templates`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          id: template.id,
          doctorId: doctorId,
          name: template.name,
          description: template.description,
          visitType: template.visitType,
          isDefault: template.isDefault,
          sections: template.sections,
          generalInstructions: template.generalInstructions,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          usageCount: template.usageCount,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to save template: ${response.statusText}`);
      }

      logInfo('templateAPI', 'Info message', {});
      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        logWarn('templateAPI', 'Warning message', {});
      } else {
        logError('templateAPI', 'Error message', {});
      }

      // Fallback: Save to localStorage
      try {
        const localTemplates = JSON.parse(
          localStorage.getItem(`doctor_templates_${doctorId}`) || '[]'
        );
        const existingIndex = localTemplates.findIndex((t: any) => t.id === template.id);

        if (existingIndex >= 0) {
          localTemplates[existingIndex] = template;
        } else {
          localTemplates.push(template);
        }

        localStorage.setItem(`doctor_templates_${doctorId}`, JSON.stringify(localTemplates));
        logDebug('templateAPI', 'Debug message', {});
        return true;
      } catch (localError) {
        logError('templateAPI', 'Error message', {});
        return false;
      }
    }
  }

  /**
   * Update existing template
   */
  async updateTemplate(templateId: string, template: DoctorTemplate): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/api/templates/${templateId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(template),
      });

      if (!response.ok) {
        throw new Error(`Failed to update template: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      logError('templateAPI', 'Error message', {});
      return false;
    }
  }

  /**
   * Delete template from server
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/api/templates/${templateId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete template: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      logError('templateAPI', 'Error message', {});
      return false;
    }
  }

  /**
   * Get all templates for a doctor
   */
  async getTemplates(doctorId: string): Promise<DoctorTemplate[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_BASE}/api/templates?doctorId=${doctorId}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const templates = await response.json();
        logInfo('templateAPI', 'Successfully retrieved templates from server', {});
        return templates;
      } else {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      logWarn('templateAPI', 'Failed to load templates from server, using defaults', { error: error.message });

      // Fallback: Check localStorage for cached templates
      try {
        const localTemplates = JSON.parse(
          localStorage.getItem(`doctor_templates_${doctorId}`) || '[]'
        );
        if (localTemplates.length > 0) {
          logDebug('templateAPI', 'Using cached templates from localStorage', {});
          return localTemplates;
        }
      } catch (storageError) {
        logWarn('templateAPI', 'Failed to read cached templates', {});
      }

      // Ultimate fallback: Default templates
      logInfo('templateAPI', 'Using default templates', {});
      return this.getDefaultTemplates();
    }
  }

  /**
   * Save settings to server
   */
  async saveSettings(settings: DoctorSettings, doctorId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/api/doctor-settings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          doctorId,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      logError('templateAPI', 'Error message', {});
      return false;
    }
  }

  /**
   * Load settings from server
   */
  async loadSettings(doctorId: string): Promise<DoctorSettings | null> {
    try {
      const response = await fetch(`${API_BASE}/api/doctor-settings/${doctorId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }

      const data = await response.json();
      return data.settings;
    } catch (error) {
      logError('templateAPI', 'Error message', {});
      return null;
    }
  }

  /**
   * Toggle favorite template
   */
  async toggleFavorite(templateId: string, doctorId: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE}/api/templates/${templateId}/toggle-favorite`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ doctorId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to toggle favorite: ${response.statusText}`);
      }

      const result = await response.json();
      logInfo('templateAPI', 'Successfully toggled favorite template', {});
      return result.isFavorite;
    } catch (error) {
      logError('templateAPI', 'Failed to toggle favorite template', { error: error.message });
      throw error;
    }
  }

  /**
   * Set default template
   */
  async setDefaultTemplate(
    templateId: string,
    doctorId: string,
    visitType?: string
  ): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE}/api/templates/${templateId}/set-default`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ doctorId, visitType }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to set default template: ${response.statusText}`);
      }

      logInfo('templateAPI', 'Successfully set default template', {});
      return true;
    } catch (error) {
      logError('templateAPI', 'Failed to set default template', { error: error.message });
      throw error;
    }
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(templateId: string, newName: string, doctorId: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE}/api/templates/${templateId}/duplicate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ newName, doctorId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to duplicate template: ${response.statusText}`);
      }

      const result = await response.json();
      logInfo('templateAPI', 'Successfully duplicated template', {});
      return result.newTemplateId;
    } catch (error) {
      logError('templateAPI', 'Failed to duplicate template', { error: error.message });
      throw error;
    }
  }

  /**
   * Get default templates when API is unavailable
   */
  private getDefaultTemplates(): DoctorTemplate[] {
    return [
      {
        id: 'default-soap-note',
        name: 'Comprehensive SOAP Note',
        description: 'Complete SOAP note template for general medical visits',
        visitType: 'comprehensive',
        isDefault: true,
        sections: {
          chiefComplaint: {
            order: 1,
            title: 'Chief Complaint',
            format: 'paragraph',
            keywords: ['presents with', 'complains of', 'here for', 'follow-up'],
            required: true,
            exampleText: 'Patient presents with 3-day history of progressive shortness of breath and chest tightness.',
            aiInstructions: 'Extract the primary reason for the visit. Be concise - typically 1-2 sentences describing the main problem or symptom that brought the patient in today.'
          },
          historyOfPresentIllness: {
            order: 2,
            title: 'History of Present Illness',
            format: 'paragraph',
            keywords: ['started', 'began', 'noticed', 'worse', 'better', 'tried'],
            required: true,
            exampleText: 'The patient reports symptoms began 3 days ago with mild dyspnea on exertion...',
            aiInstructions: 'Provide a detailed narrative of the current illness including: onset, location, duration, character, aggravating/relieving factors, associated symptoms, and treatments tried. Use chronological order.'
          },
          reviewOfSystems: {
            order: 3,
            title: 'Review of Systems',
            format: 'bullets',
            keywords: ['denies', 'reports', 'positive for', 'negative for'],
            required: false,
            exampleText: '• Constitutional: Denies fever, chills, weight loss\n• Cardiovascular: Positive for chest tightness, denies palpitations',
            aiInstructions: 'Document pertinent positives and negatives for each system reviewed. Group by system (Constitutional, HEENT, Cardiovascular, Respiratory, etc.). Use "Denies" for negative findings.'
          },
          pastMedicalHistory: {
            order: 4,
            title: 'Past Medical History',
            format: 'bullets',
            keywords: ['history of', 'diagnosed', 'surgery', 'hospitalization'],
            required: true,
            exampleText: '• Type 2 Diabetes Mellitus (2018)\n• Hypertension (2015)\n• Appendectomy (2010)',
            aiInstructions: 'List all chronic medical conditions, past surgeries, and significant past illnesses. Include year of diagnosis when mentioned. List each condition on a separate line.'
          },
          medications: {
            order: 5,
            title: 'Medications',
            format: 'bullets',
            keywords: ['taking', 'mg', 'daily', 'twice', 'PRN'],
            required: true,
            exampleText: '• Metformin 1000mg, twice daily, PO\n• Lisinopril 10mg, daily, PO\n• Aspirin 81mg, daily, PO',
            aiInstructions: 'List all current medications with dosages, frequency, and route. Include both prescription and OTC medications. Format: Drug name dose, frequency, route.'
          },
          allergies: {
            order: 6,
            title: 'Allergies',
            format: 'paragraph',
            keywords: ['allergic', 'reaction', 'NKDA', 'intolerance'],
            required: true,
            exampleText: 'Penicillin (rash), Sulfa drugs (anaphylaxis)',
            aiInstructions: 'List drug allergies and reactions. If no known allergies, state "NKDA". Include reaction type if mentioned.'
          },
          physicalExam: {
            order: 7,
            title: 'Physical Examination',
            format: 'paragraph',
            keywords: ['BP', 'HR', 'temp', 'appears', 'examination', 'palpation', 'auscultation'],
            required: true,
            exampleText: 'Vitals: BP 142/88, HR 92, Temp 98.6°F, RR 18, SpO2 96% on RA\nGeneral: Alert, oriented, in mild distress...',
            aiInstructions: 'Document vital signs first, then examination findings by system. Include pertinent positives and negatives. Be specific with measurements and descriptions.'
          },
          assessment: {
            order: 8,
            title: 'Assessment',
            format: 'numbered',
            keywords: ['diagnosis', 'ICD', 'differential', 'impression'],
            required: true,
            exampleText: '1. Acute exacerbation of asthma (J45.9)\n2. Hypertension, uncontrolled (I10)',
            aiInstructions: 'List diagnoses being addressed today with ICD-10 codes if available. Number each diagnosis. Include differential diagnoses for new problems.'
          },
          plan: {
            order: 9,
            title: 'Plan',
            format: 'numbered',
            keywords: ['continue', 'start', 'discontinue', 'follow-up', 'refer', 'order'],
            required: true,
            exampleText: '1. Acute asthma exacerbation:\n   - Start albuterol nebulizer treatments\n   - Prescribe prednisone 40mg daily x 5 days',
            aiInstructions: 'Outline the treatment plan for each diagnosis. Include medications, procedures, follow-up instructions, and patient education. Number each item to correspond with assessment.'
          }
        },
        generalInstructions: 'Create a comprehensive, professional medical note that captures all relevant clinical information.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      },
      {
        id: 'default-diabetes-followup',
        name: 'Diabetes Follow-up',
        description: 'Specialized template for diabetes management visits',
        visitType: 'follow-up',
        isDefault: false,
        sections: {
          chiefComplaint: {
            order: 1,
            title: 'Chief Complaint',
            format: 'paragraph',
            keywords: ['diabetes', 'blood sugar', 'glucose', 'A1C', 'follow-up'],
            required: true,
            aiInstructions: 'Focus on diabetes-related concerns, glucose control issues, or diabetes complications.'
          },
          bloodGlucoseHistory: {
            order: 2,
            title: 'Blood Glucose History',
            format: 'paragraph',
            keywords: ['glucose', 'blood sugar', 'readings', 'hypoglycemia', 'fasting', 'post-meal'],
            required: true,
            aiInstructions: 'Document recent glucose readings, patterns, frequency of monitoring, and any hypoglycemic episodes. Include timing (fasting, post-meal, bedtime).'
          },
          medicationCompliance: {
            order: 3,
            title: 'Medication Compliance',
            format: 'paragraph',
            keywords: ['compliance', 'adherence', 'missed doses', 'side effects'],
            required: true,
            aiInstructions: 'Assess compliance with diabetes medications, insulin dosing, timing, and any side effects or concerns.'
          },
          diabeticComplications: {
            order: 4,
            title: 'Diabetic Complications Screening',
            format: 'bullets',
            keywords: ['neuropathy', 'nephropathy', 'retinopathy', 'complications'],
            required: true,
            aiInstructions: 'Document screening for diabetic complications: neuropathy, nephropathy, retinopathy, cardiovascular disease.'
          },
          lifestyleFactors: {
            order: 5,
            title: 'Lifestyle Factors',
            format: 'paragraph',
            keywords: ['diet', 'exercise', 'weight', 'carbohydrates'],
            required: false,
            aiInstructions: 'Document diet, exercise, weight management, and diabetes self-care activities.'
          },
          physicalExam: {
            order: 6,
            title: 'Physical Examination',
            format: 'paragraph',
            keywords: ['feet', 'neuropathy', 'BP', 'weight', 'BMI'],
            required: true,
            aiInstructions: 'Focus on diabetic-specific exam: feet inspection, neurological assessment, blood pressure, weight, BMI.'
          },
          laboratoryResults: {
            order: 7,
            title: 'Laboratory Results',
            format: 'bullets',
            keywords: ['A1C', 'HbA1c', 'creatinine', 'eGFR', 'cholesterol'],
            required: true,
            aiInstructions: 'Document A1C, lipid panel, kidney function (creatinine, eGFR, microalbumin), and other relevant labs.'
          },
          assessment: {
            order: 8,
            title: 'Assessment',
            format: 'numbered',
            keywords: ['controlled', 'uncontrolled', 'target', 'goal'],
            required: true,
            aiInstructions: 'Assess diabetes control status, complications present, and medication effectiveness. Include goal A1C and current status.'
          },
          plan: {
            order: 9,
            title: 'Plan',
            format: 'numbered',
            keywords: ['adjust', 'continue', 'increase', 'follow-up', 'refer'],
            required: true,
            aiInstructions: 'Include medication adjustments, lifestyle counseling, follow-up timing, lab orders, and referrals if needed.'
          }
        },
        generalInstructions: 'Focus on diabetes management, glucose control, and complication prevention.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      },
      {
        id: 'default-quick-progress',
        name: 'Quick Progress Note',
        description: 'Brief template for follow-up visits and routine checks',
        visitType: 'progress',
        isDefault: false,
        sections: {
          chiefComplaint: {
            order: 1,
            title: 'Reason for Visit',
            format: 'paragraph',
            keywords: ['follow-up', 'routine', 'check', 'medication'],
            required: true,
            aiInstructions: 'Brief description of why the patient is here today.'
          },
          intervalHistory: {
            order: 2,
            title: 'Interval History',
            format: 'paragraph',
            keywords: ['since last visit', 'new symptoms', 'changes', 'concerns'],
            required: true,
            aiInstructions: 'Document what has happened since the last visit, any new symptoms or concerns.'
          },
          currentMedications: {
            order: 3,
            title: 'Current Medications',
            format: 'bullets',
            keywords: ['continuing', 'stopped', 'changed', 'compliance'],
            required: true,
            aiInstructions: 'List current medications and any changes since last visit.'
          },
          briefExam: {
            order: 4,
            title: 'Focused Physical Exam',
            format: 'paragraph',
            keywords: ['vitals', 'appears', 'focused', 'pertinent'],
            required: true,
            aiInstructions: 'Document vital signs and focused physical examination relevant to the visit.'
          },
          assessment: {
            order: 5,
            title: 'Assessment',
            format: 'bullets',
            keywords: ['stable', 'improved', 'unchanged', 'concerning'],
            required: true,
            aiInstructions: 'Brief assessment of current conditions and their status.'
          },
          plan: {
            order: 6,
            title: 'Plan',
            format: 'bullets',
            keywords: ['continue', 'follow-up', 'return', 'contact'],
            required: true,
            aiInstructions: 'Simple plan including medication continuations, follow-up timing, and patient instructions.'
          }
        },
        generalInstructions: 'Keep this note concise and focused on the specific reason for today\'s visit.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      }
    ];
  }
}

// Export singleton instance
export const templateAPIService = new TemplateAPIService();
