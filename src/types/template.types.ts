// Template type definitions
export interface TemplateSection {
  title: string;
  aiInstructions: string;
  order?: number;
}

export interface BillingConfiguration {
  enabled: boolean; // Whether to include billing section
  includeICD10: boolean; // Include ICD-10 suggestions
  includeTimeTracking: boolean; // Encourage time documentation
  customInstructions?: string; // Additional billing-specific instructions
}

export interface Template {
  id: string;
  name: string;
  specialty: string;
  template_type: string;
  sections: {
    chief_complaint?: string | TemplateSection;
    history_present_illness?: string | TemplateSection;
    review_of_systems?: string | TemplateSection;
    past_medical_history?: string | TemplateSection;
    medications?: string | TemplateSection;
    allergies?: string | TemplateSection;
    social_history?: string | TemplateSection;
    family_history?: string | TemplateSection;
    physical_exam?: string | TemplateSection;
    assessment?: string | TemplateSection;
    plan?: string | TemplateSection;
    [key: string]: string | TemplateSection | undefined;
  };
  generalInstructions?: string;
  billingConfig?: BillingConfiguration; // Billing configuration for this template
  is_shared?: boolean;
  is_system_template?: boolean;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
  macros?: Record<string, string>;
  quick_phrases?: string[];
}
