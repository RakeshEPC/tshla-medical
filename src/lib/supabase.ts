/**
 * Supabase Client Configuration
 * HIPAA-compliant database and authentication for TSHLA Medical
 *
 * SECURITY NOTE:
 * - Uses environment variables (no hardcoded keys)
 * - anon key is safe to expose in frontend
 * - service_role key must NEVER be exposed (server-side only)
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/environment';
import type { Template } from '../types/template.types';

// Validate Supabase configuration
if (!env.supabase.url || !env.supabase.anonKey) {
  throw new Error(
    'Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

// Create Supabase client
export const supabase = createClient(env.supabase.url, env.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // PKCE flow for enhanced security
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-HIPAA-Compliant': 'true',
      'X-Client-Info': 'tshla-medical@1.0.0',
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
