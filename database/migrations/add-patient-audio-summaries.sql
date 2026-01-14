-- =====================================================
-- Patient Audio Summaries System
-- =====================================================
-- Created: 2026-01-13
-- Purpose: Store patient-friendly visit summaries with
--          shareable links for web-based audio playback
--          (replacing Twilio phone calls with portal)
-- =====================================================

-- =====================================================
-- 1. CREATE PATIENT AUDIO SUMMARIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_audio_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ========================================
  -- LINK TO DICTATION (Loose coupling - no FK)
  -- ========================================
  dictation_id INTEGER,  -- Optional reference to dictated_notes table

  -- ========================================
  -- PATIENT IDENTIFICATION
  -- ========================================
  -- Using phone as master identifier (matches unified_patients.phone_primary)
  patient_phone VARCHAR(20) NOT NULL,
  patient_name VARCHAR(200),
  patient_mrn VARCHAR(50),

  -- ========================================
  -- CONTENT
  -- ========================================
  soap_note_text TEXT,  -- Original SOAP note (for regeneration if needed)
  summary_script TEXT NOT NULL,  -- Patient-friendly conversational summary (from Azure OpenAI)

  -- ========================================
  -- AUDIO FILES (Azure Blob Storage)
  -- ========================================
  audio_blob_url TEXT,  -- Azure Blob Storage URL (generated on-demand on first patient access)
  audio_generated_at TIMESTAMPTZ,  -- When audio was first generated
  audio_file_size_kb INTEGER,  -- Size in KB for tracking

  -- ========================================
  -- SHAREABLE LINK
  -- ========================================
  share_link_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  -- Patient accesses via: https://app.tshla.ai/patient-summary/{share_link_id}

  -- ========================================
  -- ACCESS TRACKING
  -- ========================================
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),  -- Auto-expire after 7 days

  access_count INTEGER DEFAULT 0,  -- How many times patient accessed
  last_accessed_at TIMESTAMPTZ,  -- Last time patient viewed

  staff_sent_at TIMESTAMPTZ,  -- When staff sent link to patient
  staff_sent_by UUID REFERENCES medical_staff(id),  -- Which staff member sent it

  -- ========================================
  -- PROVIDER METADATA
  -- ========================================
  provider_id TEXT,  -- Provider who created the dictation
  provider_name TEXT,

  -- ========================================
  -- AUDIO SETTINGS
  -- ========================================
  voice_id TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL',  -- ElevenLabs voice used (Bella - professional female)

  -- ========================================
  -- STATUS
  -- ========================================
  status VARCHAR(20) DEFAULT 'pending',  -- pending, sent, accessed, expired

  -- ========================================
  -- TIMESTAMPS
  -- ========================================
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_patient_audio_summaries_share_link
  ON patient_audio_summaries(share_link_id);

CREATE INDEX IF NOT EXISTS idx_patient_audio_summaries_patient_phone
  ON patient_audio_summaries(patient_phone);

CREATE INDEX IF NOT EXISTS idx_patient_audio_summaries_expires_at
  ON patient_audio_summaries(expires_at);

CREATE INDEX IF NOT EXISTS idx_patient_audio_summaries_created_at
  ON patient_audio_summaries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_audio_summaries_status
  ON patient_audio_summaries(status);

CREATE INDEX IF NOT EXISTS idx_patient_audio_summaries_provider
  ON patient_audio_summaries(provider_id);

-- =====================================================
-- 3. CREATE AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_summary_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ========================================
  -- LINK TO SUMMARY
  -- ========================================
  summary_id UUID REFERENCES patient_audio_summaries(id) ON DELETE CASCADE,

  -- ========================================
  -- ACCESS DETAILS
  -- ========================================
  access_type VARCHAR(50) NOT NULL,  -- 'view_summary', 'play_audio', 'failed_tshla_verification', 'link_copied'

  -- ========================================
  -- SECURITY TRACKING
  -- ========================================
  ip_address INET,
  user_agent TEXT,
  tshla_id_attempted VARCHAR(20),  -- TSHLA ID entered (for failed attempts)
  success BOOLEAN NOT NULL DEFAULT false,

  -- ========================================
  -- TIMESTAMPS
  -- ========================================
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. CREATE INDEXES FOR AUDIT LOG
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_patient_summary_access_log_summary_id
  ON patient_summary_access_log(summary_id);

CREATE INDEX IF NOT EXISTS idx_patient_summary_access_log_accessed_at
  ON patient_summary_access_log(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_summary_access_log_ip_address
  ON patient_summary_access_log(ip_address, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_summary_access_log_failed_attempts
  ON patient_summary_access_log(ip_address, accessed_at DESC)
  WHERE success = false;

-- =====================================================
-- 5. CREATE TRIGGER TO AUTO-UPDATE updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_patient_audio_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_patient_audio_summaries_updated_at
  BEFORE UPDATE ON patient_audio_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_audio_summaries_updated_at();

-- =====================================================
-- 6. CREATE TRIGGER TO AUTO-UPDATE STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION update_patient_audio_summaries_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-expire summaries after 7 days
  IF NEW.expires_at < NOW() AND NEW.status != 'expired' THEN
    NEW.status = 'expired';
  END IF;

  -- Mark as 'sent' when staff_sent_at is set
  IF NEW.staff_sent_at IS NOT NULL AND OLD.staff_sent_at IS NULL THEN
    NEW.status = 'sent';
  END IF;

  -- Mark as 'accessed' when patient first accesses
  IF NEW.access_count > 0 AND NEW.status = 'sent' THEN
    NEW.status = 'accessed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_patient_audio_summaries_status
  BEFORE UPDATE ON patient_audio_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_audio_summaries_status();

-- =====================================================
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE patient_audio_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_summary_access_log ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all summaries
CREATE POLICY "Staff can view all patient audio summaries"
  ON patient_audio_summaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- Policy: Staff can create summaries
CREATE POLICY "Staff can create patient audio summaries"
  ON patient_audio_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- Policy: Staff can update summaries
CREATE POLICY "Staff can update patient audio summaries"
  ON patient_audio_summaries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- Policy: Public can view summaries via share_link_id (handled by API validation)
-- No RLS policy needed - API will handle TSHLA ID verification

-- Policy: Staff can view access logs
CREATE POLICY "Staff can view access logs"
  ON patient_summary_access_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE medical_staff.auth_user_id = auth.uid()
    )
  );

-- Policy: Service role can insert access logs (for API audit logging)
CREATE POLICY "Service role can insert access logs"
  ON patient_summary_access_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE patient_audio_summaries IS
'Stores patient-friendly visit summaries with shareable web links (replaces Twilio phone calls)';

COMMENT ON COLUMN patient_audio_summaries.share_link_id IS
'UUID used in shareable URL: https://app.tshla.ai/patient-summary/{share_link_id}';

COMMENT ON COLUMN patient_audio_summaries.patient_phone IS
'Master patient identifier - matches unified_patients.phone_primary';

COMMENT ON COLUMN patient_audio_summaries.audio_blob_url IS
'Azure Blob Storage URL - generated on-demand on first patient access to save costs';

COMMENT ON COLUMN patient_audio_summaries.expires_at IS
'Auto-expires 7 days after creation - patient can access multiple times until expiration';

COMMENT ON TABLE patient_summary_access_log IS
'HIPAA audit log tracking all access attempts to patient summaries';

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

-- Grant authenticated users access to tables
GRANT SELECT, INSERT, UPDATE ON patient_audio_summaries TO authenticated;
GRANT SELECT ON patient_summary_access_log TO authenticated;

-- Grant service role full access (for backend API operations)
GRANT ALL ON patient_audio_summaries TO service_role;
GRANT ALL ON patient_summary_access_log TO service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- To verify:
-- SELECT COUNT(*) FROM patient_audio_summaries;
-- SELECT COUNT(*) FROM patient_summary_access_log;
