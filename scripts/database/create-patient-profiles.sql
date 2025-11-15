-- Patient Profiles Table
-- Stores patient information extracted from progress note PDFs
-- Used to drive condition-adaptive pre-visit questioning

CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient Demographics
  patient_name TEXT NOT NULL,
  patient_dob DATE,
  patient_phone TEXT UNIQUE,
  patient_mrn TEXT,
  patient_email TEXT,

  -- Clinical Information
  conditions JSONB DEFAULT '[]'::jsonb, -- Array of condition names
  medications JSONB DEFAULT '[]'::jsonb, -- Array of medication objects
  allergies JSONB DEFAULT '[]'::jsonb,

  -- Source Document Tracking
  last_note_date DATE,
  last_note_provider TEXT,
  pdf_source_filename TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,

  -- Search indexes
  CONSTRAINT patient_phone_format CHECK (patient_phone IS NULL OR patient_phone ~ '^\+?[0-9]{10,15}$')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_profiles_phone ON public.patient_profiles(patient_phone);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_mrn ON public.patient_profiles(patient_mrn);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_name ON public.patient_profiles(patient_name);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_conditions ON public.patient_profiles USING GIN (conditions);

-- Add patient_profile_id to appointments table
-- This links appointments to patient profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_schedule_appointments'
    AND column_name = 'patient_profile_id'
  ) THEN
    ALTER TABLE public.provider_schedule_appointments
    ADD COLUMN patient_profile_id UUID REFERENCES public.patient_profiles(id);

    CREATE INDEX IF NOT EXISTS idx_appointments_patient_profile
    ON public.provider_schedule_appointments(patient_profile_id);
  END IF;
END $$;

-- Update previsit_call_data to link to appointments and patient profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'previsit_call_data'
    AND column_name = 'appointment_id'
  ) THEN
    ALTER TABLE public.previsit_call_data
    ADD COLUMN appointment_id TEXT,
    ADD COLUMN patient_profile_id UUID REFERENCES public.patient_profiles(id),
    ADD COLUMN conditions_addressed JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN structured_data JSONB DEFAULT '{}'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_previsit_appointment
    ON public.previsit_call_data(appointment_id);

    CREATE INDEX IF NOT EXISTS idx_previsit_patient_profile
    ON public.previsit_call_data(patient_profile_id);
  END IF;
END $$;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_patient_profiles_updated_at ON public.patient_profiles;
CREATE TRIGGER update_patient_profiles_updated_at
  BEFORE UPDATE ON public.patient_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Sample data structure for conditions JSON:
-- [
--   "Type 2 Diabetes",
--   "Hypothyroidism",
--   "Osteoporosis"
-- ]

-- Sample data structure for medications JSON:
-- [
--   {
--     "name": "Metformin",
--     "dose": "500mg",
--     "frequency": "twice daily",
--     "route": "oral"
--   }
-- ]

-- Sample data structure for structured_data in previsit_call_data:
-- {
--   "diabetes": {
--     "medications_compliant": true,
--     "glucose_control": "TIR 94%",
--     "last_a1c": "3 months ago"
--   },
--   "thyroid": {
--     "medication": "Levothyroxine 50mcg daily",
--     "symptoms": "None",
--     "last_tsh": "6 months ago"
--   }
-- }

COMMENT ON TABLE public.patient_profiles IS 'Patient profiles extracted from progress notes, used for condition-adaptive pre-visit questioning';
COMMENT ON COLUMN public.patient_profiles.conditions IS 'Array of condition names (e.g., ["Type 2 Diabetes", "Hypothyroidism"])';
COMMENT ON COLUMN public.patient_profiles.medications IS 'Array of medication objects with name, dose, frequency';
COMMENT ON COLUMN public.previsit_call_data.structured_data IS 'Condition-specific pre-visit responses organized by disease state';
COMMENT ON COLUMN public.previsit_call_data.conditions_addressed IS 'Array of conditions that were asked about during this call';
