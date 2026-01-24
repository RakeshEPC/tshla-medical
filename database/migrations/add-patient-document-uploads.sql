-- Add patient_document_uploads table
-- Stores documents uploaded by patients through the patient portal

CREATE TABLE IF NOT EXISTS patient_document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES unified_patients(id) ON DELETE CASCADE,
  tshla_id TEXT NOT NULL,
  upload_method TEXT NOT NULL CHECK (upload_method IN ('file', 'text', 'voice')),

  -- Raw content
  raw_content TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size_bytes INTEGER,
  file_url TEXT,

  -- Extracted medical information
  extracted_data JSONB DEFAULT '{}'::jsonb,

  -- AI processing
  ai_processing_status TEXT DEFAULT 'pending' CHECK (ai_processing_status IN ('pending', 'processing', 'completed', 'failed')),
  ai_processing_error TEXT,
  processed_at TIMESTAMPTZ,

  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,

  -- Staff review
  reviewed_by UUID REFERENCES medical_staff(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  added_to_chart BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_document_uploads_patient_id ON patient_document_uploads(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_document_uploads_tshla_id ON patient_document_uploads(tshla_id);
CREATE INDEX IF NOT EXISTS idx_patient_document_uploads_uploaded_at ON patient_document_uploads(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_document_uploads_ai_status ON patient_document_uploads(ai_processing_status);
CREATE INDEX IF NOT EXISTS idx_patient_document_uploads_reviewed ON patient_document_uploads(reviewed_by, reviewed_at);

-- RLS Policies
ALTER TABLE patient_document_uploads ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (medical staff) to view all uploads
CREATE POLICY "Medical staff can view all uploads"
  ON patient_document_uploads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.id = auth.uid()
    )
  );

-- Allow authenticated users (medical staff) to update uploads (review)
CREATE POLICY "Medical staff can update uploads"
  ON patient_document_uploads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.id = auth.uid()
    )
  );

-- Service role can do everything (for API)
CREATE POLICY "Service role has full access"
  ON patient_document_uploads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_patient_document_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_document_uploads_updated_at
  BEFORE UPDATE ON patient_document_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_document_uploads_updated_at();

-- Comment
COMMENT ON TABLE patient_document_uploads IS 'Stores medical documents uploaded by patients through the patient portal';
COMMENT ON COLUMN patient_document_uploads.upload_method IS 'How the document was uploaded: file, text, or voice';
COMMENT ON COLUMN patient_document_uploads.extracted_data IS 'Medical information extracted by AI (diagnoses, meds, allergies, labs, etc)';
COMMENT ON COLUMN patient_document_uploads.ai_processing_status IS 'Status of AI processing: pending, processing, completed, or failed';
