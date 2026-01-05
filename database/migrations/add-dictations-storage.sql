-- Dictation Storage System
-- Stores all provider dictations with auto-save and version history

CREATE TABLE IF NOT EXISTS dictations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to appointment and patient
  appointment_id BIGINT REFERENCES provider_schedules(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES unified_patients(id) ON DELETE CASCADE,
  provider_id UUID, -- References medical_staff or auth user

  -- Patient information (captured at time of dictation)
  patient_name VARCHAR(200),
  patient_dob DATE,
  patient_mrn VARCHAR(50),
  visit_date DATE,
  visit_type VARCHAR(100),

  -- Dictation content
  transcription_text TEXT,
  final_note TEXT, -- After AI processing/formatting
  audio_url TEXT, -- If audio is stored

  -- Metadata
  status VARCHAR(50) DEFAULT 'draft', -- draft, in_progress, completed, signed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,

  -- Auto-save tracking
  last_autosave_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1,

  -- Additional data
  diagnosis_codes TEXT[],
  procedure_codes TEXT[],
  medications_prescribed JSONB,
  orders_placed JSONB,

  -- Search
  search_vector TSVECTOR
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dictations_appointment ON dictations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_dictations_patient ON dictations(patient_id);
CREATE INDEX IF NOT EXISTS idx_dictations_provider ON dictations(provider_id);
CREATE INDEX IF NOT EXISTS idx_dictations_status ON dictations(status);
CREATE INDEX IF NOT EXISTS idx_dictations_visit_date ON dictations(visit_date);
CREATE INDEX IF NOT EXISTS idx_dictations_created ON dictations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dictations_search ON dictations USING GIN(search_vector);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_dictation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Update completion timestamp
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;

  -- Update signed timestamp
  IF NEW.status = 'signed' AND OLD.status != 'signed' THEN
    NEW.signed_at = NOW();
  END IF;

  -- Increment version on content change
  IF NEW.transcription_text != OLD.transcription_text OR NEW.final_note != OLD.final_note THEN
    NEW.version = OLD.version + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dictation_timestamp_trigger ON dictations;
CREATE TRIGGER dictation_timestamp_trigger
  BEFORE UPDATE ON dictations
  FOR EACH ROW
  EXECUTE FUNCTION update_dictation_timestamp();

-- Auto-update search vector
CREATE OR REPLACE FUNCTION update_dictation_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector =
    setweight(to_tsvector('english', COALESCE(NEW.patient_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.transcription_text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.final_note, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dictation_search_trigger ON dictations;
CREATE TRIGGER dictation_search_trigger
  BEFORE INSERT OR UPDATE ON dictations
  FOR EACH ROW
  EXECUTE FUNCTION update_dictation_search_vector();

-- Link dictations to provider_schedules workflow
ALTER TABLE provider_schedules
  ADD COLUMN IF NOT EXISTS dictation_id UUID REFERENCES dictations(id) ON DELETE SET NULL;

-- RLS Policies
ALTER TABLE dictations ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write dictations
CREATE POLICY "Authenticated users can manage dictations"
  ON dictations FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE dictations IS 'Stores all provider dictations with auto-save functionality';
COMMENT ON COLUMN dictations.transcription_text IS 'Raw transcription from speech-to-text';
COMMENT ON COLUMN dictations.final_note IS 'Final formatted note after AI processing';
COMMENT ON COLUMN dictations.last_autosave_at IS 'Timestamp of last auto-save for recovery';
COMMENT ON COLUMN dictations.version IS 'Incremented on each content change for version history';
