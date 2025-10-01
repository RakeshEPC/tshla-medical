export interface PriorAuthMedication {
  brandName: string;
  genericName?: string;
  category: 'diabetes' | 'thyroid' | 'pain' | 'injectable' | 'other';
  commonICD10: string[];
  typicalRequirements: string[];
  alternatives: AlternativeMed[];
  labsRequired?: string[];
  clinicalCriteria: string[];
  averageApprovalTime: string;
  successRate: number; // percentage
  forms?: string[]; // Form IDs or names
}

export interface AlternativeMed {
  name: string;
  generic?: string;
  priorAuthRequired: boolean;
  tier: number;
  notes?: string;
}

export interface PriorAuthRequest {
  id: string;
  patientId: string;
  medication: string;
  diagnosis: string[];
  icd10Codes: string[];
  clinicalJustification: string;
  triedAlternatives?: string[];
  labResults?: LabResult[];
  attachments?: Attachment[];
  status: 'pending' | 'submitted' | 'approved' | 'denied' | 'appeal';
  missingInfo?: string[];
  createdAt: string;
  submittedAt?: string;
  urgency: 'routine' | 'urgent' | 'stat';
}

export interface LabResult {
  testName: string;
  value: string;
  date: string;
  unit?: string;
  referenceRange?: string;
}

export interface Attachment {
  type: 'lab' | 'note' | 'imaging' | 'other';
  fileName: string;
  content?: string;
  url?: string;
}

export interface PAValidation {
  isComplete: boolean;
  missingFields: MissingField[];
  suggestions: string[];
}

export interface MissingField {
  field: string;
  required: boolean;
  description: string;
  prompt: string;
}
