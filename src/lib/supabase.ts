/**
 * Supabase Client Configuration
 * HIPAA-compliant database for TSHLA Medical
 */

import { createClient } from '@supabase/supabase-js';
import type { Template } from '../types/template.types';

// Supabase configuration from environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-HIPAA-Compliant': 'true',
    },
  },
});

// Database types
export interface Doctor {
  id: string;
  email: string;
  name: string;
  specialty?: string;
  verification_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  insurance_provider?: string;
  insurance_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  doctor_id: string;
  visit_date: string;
  chief_complaint?: string;
  visit_type?: string;
  notes?: string;
  diagnosis?: string[];
  medications?: any[];
  vitals?: any;
  processed_note?: string;
  template_used?: string;
  transcription_method?: string;
  created_at?: string;
  updated_at?: string;
}

// Re-export Template type from central location
export type { Template };

export interface Dictation {
  id: string;
  visit_id: string;
  doctor_id: string;
  patient_id: string;
  transcript: string;
  processed_note?: string;
  audio_url?: string;
  duration?: number;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  phi_accessed?: boolean;
  created_at?: string;
}
