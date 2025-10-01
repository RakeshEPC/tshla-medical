export interface TemplateSection {
  id: string;
  title: string;
  aiPrompt: string;
  placeholder?: string;
  required?: boolean;
  order: number;
  rows?: number;
  value?: string;
}

export interface MedicalTemplate {
  id: string;
  name: string;
  specialty: 'endocrine' | 'sports_medicine' | 'general' | 'custom';
  description?: string;
  sections: TemplateSection[];
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
  author?: string;
}

export interface TemplateLibrary {
  templates: MedicalTemplate[];
  activeTemplateId: string | null;
}
