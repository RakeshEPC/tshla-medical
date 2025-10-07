-- =====================================================
-- TSHLA Medical - Complete Patient Data Migration to Supabase
-- =====================================================
-- This script creates all patient-related tables in Supabase (PostgreSQL)
-- with proper Row Level Security policies for HIPAA compliance
--
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PATIENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legacy_id TEXT UNIQUE,              -- For migration from old pt-xxxxxx format
  ava_id TEXT UNIQUE,                 -- AVA-xxx-xxx format for patient portal
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  insurance_info JSONB,               -- Changed to JSONB for better querying
  emergency_contact JSONB,            -- Changed to JSONB
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE
);

-- RLS Policies for patients
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can view all patients" ON public.patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

CREATE POLICY "Medical staff can insert patients" ON public.patients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

CREATE POLICY "Medical staff can update patients" ON public.patients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 2. PATIENT CONDITIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.patient_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  condition_name TEXT NOT NULL,
  icd10_code TEXT,
  diagnosis_date DATE,
  resolved_date DATE,
  status TEXT DEFAULT 'active',     -- active, resolved, chronic
  severity TEXT,                     -- mild, moderate, severe
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.patient_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can manage patient conditions" ON public.patient_conditions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 3. PATIENT MEDICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.patient_medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  route TEXT DEFAULT 'oral',
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',      -- active, discontinued, hold
  discontinue_reason TEXT,            -- ineffective, side_effects, resolved, switched
  effectiveness TEXT,                 -- excellent, good, partial, poor, none
  side_effects TEXT,
  prescriber TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can manage medications" ON public.patient_medications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 4. PATIENT LABS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.patient_labs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  lab_name TEXT NOT NULL,
  result_value TEXT,
  unit TEXT,
  normal_range TEXT,
  abnormal_flag TEXT,                -- H, L, HH, LL, Critical
  lab_date DATE,
  ordering_provider TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.patient_labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can manage labs" ON public.patient_labs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 5. PATIENT VISITS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.patient_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  visit_type TEXT,                   -- follow_up, new_patient, urgent, annual
  chief_complaint TEXT,
  provider_id UUID REFERENCES public.medical_staff(id),
  template_used TEXT,
  note_content TEXT,                 -- Full SOAP note
  assessment TEXT,
  plan TEXT,
  medications_reviewed BOOLEAN DEFAULT FALSE,
  vitals JSONB,                      -- JSON: BP, HR, Weight, etc.
  follow_up_date DATE,
  follow_up_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can manage visits" ON public.patient_visits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 6. SCHEDULE SLOTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_date DATE NOT NULL,
  slot_number INTEGER NOT NULL,      -- 1-20
  slot_time TEXT,                    -- "9:00 AM"
  patient_id UUID REFERENCES public.patients(id),
  patient_name TEXT,                 -- Denormalized for quick display
  visit_type TEXT,
  status TEXT DEFAULT 'empty',       -- empty, scheduled, in_progress, completed
  temp_note TEXT,                    -- Working dictation
  provider_id UUID REFERENCES public.medical_staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(slot_date, slot_number, provider_id)
);

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can manage their own schedule" ON public.schedule_slots
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Medical staff can view all schedules" ON public.schedule_slots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 7. DISEASE PROGRESSION
-- =====================================================
CREATE TABLE IF NOT EXISTS public.disease_progression (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  condition_name TEXT NOT NULL,
  measurement_date DATE,
  metric_name TEXT,                  -- A1C, TSH, T-Score, LDL, etc.
  metric_value TEXT,
  trend TEXT,                        -- improving, stable, worsening
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.disease_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can manage disease progression" ON public.disease_progression
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 8. EMR IMPORTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.emr_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_system TEXT,                -- Epic, Cerner, etc.
  import_type TEXT,                  -- full, medications, labs, notes
  raw_data JSONB,                    -- Original data
  processed_data JSONB,              -- Parsed data
  status TEXT DEFAULT 'pending',     -- pending, processed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.emr_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can manage emr imports" ON public.emr_imports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 9. TEMPLATES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES public.medical_staff(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100),
  template_type VARCHAR(50),         -- soap, progress, consultation, procedure
  is_shared BOOLEAN DEFAULT FALSE,
  is_system_template BOOLEAN DEFAULT FALSE,
  sections JSONB NOT NULL,
  macros JSONB DEFAULT '{}'::jsonb,
  quick_phrases JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can view their own and shared templates" ON public.templates
  FOR SELECT
  USING (
    is_shared = TRUE
    OR is_system_template = TRUE
    OR staff_id IN (
      SELECT id FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Medical staff can create templates" ON public.templates
  FOR INSERT
  WITH CHECK (
    staff_id IN (
      SELECT id FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Medical staff can update their own templates" ON public.templates
  FOR UPDATE
  USING (
    staff_id IN (
      SELECT id FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Medical staff can delete their own templates" ON public.templates
  FOR DELETE
  USING (
    staff_id IN (
      SELECT id FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_patients_ava_id ON public.patients(ava_id);
CREATE INDEX IF NOT EXISTS idx_patients_created_by ON public.patients(created_by);
CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient ON public.patient_conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_conditions_status ON public.patient_conditions(status);
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON public.patient_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_status ON public.patient_medications(status);
CREATE INDEX IF NOT EXISTS idx_patient_labs_patient ON public.patient_labs(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_labs_date ON public.patient_labs(lab_date);
CREATE INDEX IF NOT EXISTS idx_patient_visits_patient ON public.patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_date ON public.patient_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_patient_visits_provider ON public.patient_visits(provider_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_date ON public.schedule_slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_provider ON public.schedule_slots(provider_id);
CREATE INDEX IF NOT EXISTS idx_disease_progression_patient ON public.disease_progression(patient_id);
CREATE INDEX IF NOT EXISTS idx_templates_staff ON public.templates(staff_id);
CREATE INDEX IF NOT EXISTS idx_templates_shared ON public.templates(is_shared) WHERE is_shared = TRUE;

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_conditions_updated_at BEFORE UPDATE ON public.patient_conditions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_medications_updated_at BEFORE UPDATE ON public.patient_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_labs_updated_at BEFORE UPDATE ON public.patient_labs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_visits_updated_at BEFORE UPDATE ON public.patient_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_slots_updated_at BEFORE UPDATE ON public.schedule_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disease_progression_updated_at BEFORE UPDATE ON public.disease_progression
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Patient data migration schema created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - patients';
  RAISE NOTICE '  - patient_conditions';
  RAISE NOTICE '  - patient_medications';
  RAISE NOTICE '  - patient_labs';
  RAISE NOTICE '  - patient_visits';
  RAISE NOTICE '  - schedule_slots';
  RAISE NOTICE '  - disease_progression';
  RAISE NOTICE '  - emr_imports';
  RAISE NOTICE '  - templates';
  RAISE NOTICE '';
  RAISE NOTICE 'All tables have Row Level Security (RLS) enabled';
  RAISE NOTICE 'Next step: Run data migration script to copy existing data';
END $$;
