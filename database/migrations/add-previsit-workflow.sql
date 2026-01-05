-- Pre-Visit Workflow Database Schema
-- This enables staff to prepare visit information before the provider sees the patient

-- Pre-visit data storage table
CREATE TABLE IF NOT EXISTS previsit_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES provider_schedules(id) ON DELETE CASCADE,
  uploaded_by_staff_id UUID,

  -- Raw uploaded data from old EMR
  previous_notes TEXT,
  medications_list TEXT,
  lab_results TEXT,
  vitals JSONB,
  patient_questionnaire TEXT,
  insurance_notes TEXT,
  other_documents TEXT,

  -- AI-generated summary
  ai_summary TEXT,
  ai_summary_generated_at TIMESTAMP WITH TIME ZONE,

  -- Key highlights extracted by AI
  chief_complaint TEXT,
  medication_changes JSONB,
  abnormal_labs JSONB,
  follow_up_items TEXT[],

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Version tracking
  version INTEGER DEFAULT 1,

  UNIQUE(appointment_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_previsit_appointment ON previsit_data(appointment_id);
CREATE INDEX IF NOT EXISTS idx_previsit_completed ON previsit_data(completed);
CREATE INDEX IF NOT EXISTS idx_previsit_staff ON previsit_data(uploaded_by_staff_id);

-- Add pre-visit columns to provider_schedules if not exists
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS pre_visit_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_visit_completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pre_visit_staff_id UUID;

-- Add dictation tracking columns to provider_schedules
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS dictation_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dictation_id UUID,
  ADD COLUMN IF NOT EXISTS dictation_completed_at TIMESTAMP WITH TIME ZONE;

-- Add post-visit columns to provider_schedules
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS post_visit_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_visit_completed_at TIMESTAMP WITH TIME ZONE;

-- Add summary sent tracking
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS summary_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS summary_sent_at TIMESTAMP WITH TIME ZONE;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_previsit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.completed = true AND OLD.completed = false THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating timestamps
DROP TRIGGER IF EXISTS previsit_data_timestamp ON previsit_data;
CREATE TRIGGER previsit_data_timestamp
  BEFORE UPDATE ON previsit_data
  FOR EACH ROW
  EXECUTE FUNCTION update_previsit_timestamp();

-- Enable RLS (Row Level Security)
ALTER TABLE previsit_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Staff can create/update, providers can read
CREATE POLICY "Staff can insert previsit data"
  ON previsit_data FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can update their previsit data"
  ON previsit_data FOR UPDATE
  USING (true);

CREATE POLICY "Everyone can read previsit data"
  ON previsit_data FOR SELECT
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE previsit_data IS 'Stores pre-visit preparation data uploaded by staff before provider sees patient';
COMMENT ON COLUMN previsit_data.ai_summary IS 'AI-generated summary of all uploaded data for provider quick review';
COMMENT ON COLUMN previsit_data.chief_complaint IS 'AI-extracted chief complaint from previous notes';
COMMENT ON COLUMN previsit_data.medication_changes IS 'JSON array of medication additions/changes since last visit';
COMMENT ON COLUMN previsit_data.abnormal_labs IS 'JSON array of lab results flagged as abnormal';
