-- Add patient_medications table for medication management
-- Tracks active/prior status, refill needs, and pharmacy orders

CREATE TABLE IF NOT EXISTS patient_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES unified_patients(id) ON DELETE CASCADE,
  tshla_id TEXT NOT NULL,

  -- Medication details
  medication_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  route TEXT,
  sig TEXT,

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'prior', 'discontinued')),

  -- Patient flags
  need_refill BOOLEAN DEFAULT FALSE,
  refill_requested_at TIMESTAMPTZ,

  -- Staff/pharmacy flags
  send_to_pharmacy BOOLEAN DEFAULT FALSE,
  sent_to_pharmacy_at TIMESTAMPTZ,
  sent_to_pharmacy_by UUID REFERENCES medical_staff(id),
  pharmacy_name TEXT,

  -- Tracking
  prescribed_by UUID REFERENCES medical_staff(id),
  prescribed_at TIMESTAMPTZ,
  discontinued_by UUID REFERENCES medical_staff(id),
  discontinued_at TIMESTAMPTZ,
  discontinue_reason TEXT,

  -- Source
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ccd_upload', 'hp_import')),
  source_upload_id UUID REFERENCES patient_document_uploads(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id ON patient_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_tshla_id ON patient_medications(tshla_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_status ON patient_medications(status);
CREATE INDEX IF NOT EXISTS idx_patient_medications_need_refill ON patient_medications(need_refill) WHERE need_refill = TRUE;
CREATE INDEX IF NOT EXISTS idx_patient_medications_send_to_pharmacy ON patient_medications(send_to_pharmacy) WHERE send_to_pharmacy = TRUE;

-- RLS Policies
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (medical staff) to view all medications
CREATE POLICY "Medical staff can view all medications"
  ON patient_medications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.id = auth.uid()
    )
  );

-- Allow authenticated users (medical staff) to manage medications
CREATE POLICY "Medical staff can manage medications"
  ON patient_medications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.id = auth.uid()
    )
  );

-- Service role can do everything (for API)
CREATE POLICY "Service role has full access"
  ON patient_medications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_patient_medications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_medications_updated_at
  BEFORE UPDATE ON patient_medications
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_medications_updated_at();

-- Comment
COMMENT ON TABLE patient_medications IS 'Stores patient medications with status tracking, refill requests, and pharmacy order management';
COMMENT ON COLUMN patient_medications.status IS 'Current status: active, prior, or discontinued';
COMMENT ON COLUMN patient_medications.need_refill IS 'Patient-flagged: medication needs refill';
COMMENT ON COLUMN patient_medications.send_to_pharmacy IS 'Staff-flagged: ready to send to pharmacy';
