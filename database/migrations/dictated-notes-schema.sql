-- ============================================
-- TSHLA Medical - Dictated Notes Schema
-- Complete schema for dictation and notes management
-- ============================================
-- Created: 2025-10-17
-- Database: Supabase PostgreSQL
-- Purpose: Store medical dictations with full audit trail
-- ============================================

-- ============================================
-- MAIN DICTATED NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dictated_notes (
  id BIGSERIAL PRIMARY KEY,

  -- Provider Information
  provider_id VARCHAR(100) NOT NULL,
  provider_name VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255),
  provider_specialty VARCHAR(100),

  -- Patient Information
  patient_name VARCHAR(255) NOT NULL,
  patient_phone VARCHAR(50),
  patient_email VARCHAR(255),
  patient_mrn VARCHAR(50),
  patient_dob DATE,

  -- Visit Details
  appointment_id BIGINT,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visit_type VARCHAR(50) DEFAULT 'follow-up',
  note_title VARCHAR(500),
  chief_complaint TEXT,

  -- DICTATION DATA (Core Content)
  raw_transcript TEXT NOT NULL,           -- Original spoken/typed dictation
  processed_note TEXT NOT NULL,           -- AI-processed SOAP note
  ai_summary TEXT,                        -- Brief AI-generated summary
  clinical_impression TEXT,               -- Clinical assessment

  -- Template Information
  template_id VARCHAR(100),
  template_name VARCHAR(255),
  template_sections JSONB,                -- Template structure used

  -- Recording Metadata
  recording_mode VARCHAR(20) DEFAULT 'dictation' CHECK (recording_mode IN ('dictation', 'conversation')),
  recording_duration_seconds INTEGER DEFAULT 0,
  ai_model_used VARCHAR(100),             -- e.g., 'gpt-4o', 'claude-3-5-sonnet'
  processing_confidence_score DECIMAL(5,2),
  medical_terms_detected JSONB,          -- Detected medical terminology

  -- Workflow Status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending-review', 'reviewed', 'final', 'signed', 'amended', 'cancelled')),
  is_locked BOOLEAN DEFAULT false,
  requires_review BOOLEAN DEFAULT false,
  review_priority VARCHAR(20) DEFAULT 'medium' CHECK (review_priority IN ('low', 'medium', 'high', 'urgent')),
  quality_score DECIMAL(3,2),             -- 0.00 to 1.00

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  dictated_at TIMESTAMPTZ DEFAULT NOW(),
  last_edited_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signed_by_provider_name VARCHAR(255),

  -- Audit Fields
  last_modified_by_provider_id VARCHAR(100),
  last_modified_by_provider_name VARCHAR(255)
);

-- ============================================
-- NOTE VERSIONS TABLE
-- Tracks all changes to dictated notes
-- ============================================
CREATE TABLE IF NOT EXISTS note_versions (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT NOT NULL REFERENCES dictated_notes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Change Metadata
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('created', 'updated', 'reviewed', 'signed', 'amended', 'restored')),
  change_description TEXT,

  -- Version Content Snapshots
  raw_transcript_version TEXT,
  processed_note_version TEXT,
  ai_summary_version TEXT,
  clinical_impression_version TEXT,

  -- Who Made the Change
  changed_by_provider_id VARCHAR(100),
  changed_by_provider_name VARCHAR(255),

  -- When
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique version numbers per note
  UNIQUE(note_id, version_number)
);

-- ============================================
-- NOTE COMMENTS TABLE
-- Provider comments and feedback on notes
-- ============================================
CREATE TABLE IF NOT EXISTS note_comments (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT NOT NULL REFERENCES dictated_notes(id) ON DELETE CASCADE,

  -- Comment Content
  comment_text TEXT NOT NULL,
  comment_type VARCHAR(50) DEFAULT 'general' CHECK (comment_type IN ('general', 'question', 'concern', 'suggestion', 'approval', 'correction')),
  comment_priority VARCHAR(20) DEFAULT 'normal' CHECK (comment_priority IN ('low', 'normal', 'high', 'urgent')),

  -- Who Commented
  commented_by_provider_id VARCHAR(100),
  commented_by_provider_name VARCHAR(255),

  -- Resolution Status
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by_provider_name VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCHEDULE-NOTE LINKS TABLE
-- Links dictated notes to appointments
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_note_links (
  id BIGSERIAL PRIMARY KEY,

  -- Link Details
  appointment_id BIGINT NOT NULL,
  note_id BIGINT NOT NULL REFERENCES dictated_notes(id) ON DELETE CASCADE,

  -- Link Metadata
  link_type VARCHAR(50) DEFAULT 'primary-note' CHECK (link_type IN ('primary-note', 'addendum', 'follow-up', 'reference')),
  is_primary_link BOOLEAN DEFAULT true,

  -- Who Created Link
  linked_by_provider_id VARCHAR(100),
  linked_by_provider_name VARCHAR(255),

  -- When
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate links
  UNIQUE(appointment_id, note_id)
);

-- ============================================
-- NOTE TEMPLATES USED TABLE
-- Track which templates were used for dictations
-- ============================================
CREATE TABLE IF NOT EXISTS note_templates_used (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT NOT NULL REFERENCES dictated_notes(id) ON DELETE CASCADE,

  -- Template Details
  template_id VARCHAR(100) NOT NULL,
  template_name VARCHAR(255),
  template_version VARCHAR(50),

  -- Usage Context
  used_by_provider_id VARCHAR(100),
  used_by_provider_name VARCHAR(255),

  -- When
  used_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate template links
  UNIQUE(note_id, template_id)
);

-- ============================================
-- PROVIDER SCHEDULES TABLE (if not exists)
-- Needed for appointment management
-- ============================================
CREATE TABLE IF NOT EXISTS provider_schedules (
  id BIGSERIAL PRIMARY KEY,

  -- Provider Info
  provider_id VARCHAR(100) NOT NULL,
  provider_name VARCHAR(255) NOT NULL,

  -- Patient Info
  patient_name VARCHAR(255) NOT NULL,
  patient_phone VARCHAR(50),
  patient_mrn VARCHAR(50),
  patient_email VARCHAR(255),
  patient_dob DATE,

  -- Appointment Details
  appointment_type VARCHAR(50) DEFAULT 'office-visit',
  appointment_title VARCHAR(255),
  scheduled_date DATE NOT NULL,
  start_time VARCHAR(10) NOT NULL,        -- e.g., '09:00 AM'
  end_time VARCHAR(10),
  duration_minutes INTEGER DEFAULT 30,

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show')),

  -- Clinical Info
  chief_complaint TEXT,
  urgency_level VARCHAR(20) DEFAULT 'routine' CHECK (urgency_level IN ('routine', 'urgent', 'emergency')),

  -- Additional Details
  is_telehealth BOOLEAN DEFAULT false,
  provider_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Dictated Notes Indexes
CREATE INDEX IF NOT EXISTS idx_dictated_notes_provider ON dictated_notes(provider_id);
CREATE INDEX IF NOT EXISTS idx_dictated_notes_patient_name ON dictated_notes(patient_name);
CREATE INDEX IF NOT EXISTS idx_dictated_notes_patient_mrn ON dictated_notes(patient_mrn);
CREATE INDEX IF NOT EXISTS idx_dictated_notes_visit_date ON dictated_notes(visit_date);
CREATE INDEX IF NOT EXISTS idx_dictated_notes_status ON dictated_notes(status);
CREATE INDEX IF NOT EXISTS idx_dictated_notes_created_at ON dictated_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dictated_notes_dictated_at ON dictated_notes(dictated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dictated_notes_appointment ON dictated_notes(appointment_id) WHERE appointment_id IS NOT NULL;

-- Note Versions Indexes
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_created_at ON note_versions(created_at DESC);

-- Note Comments Indexes
CREATE INDEX IF NOT EXISTS idx_note_comments_note_id ON note_comments(note_id);
CREATE INDEX IF NOT EXISTS idx_note_comments_unresolved ON note_comments(note_id) WHERE is_resolved = false;

-- Schedule-Note Links Indexes
CREATE INDEX IF NOT EXISTS idx_schedule_links_appointment ON schedule_note_links(appointment_id);
CREATE INDEX IF NOT EXISTS idx_schedule_links_note ON schedule_note_links(note_id);

-- Template Usage Indexes
CREATE INDEX IF NOT EXISTS idx_templates_used_note_id ON note_templates_used(note_id);
CREATE INDEX IF NOT EXISTS idx_templates_used_template_id ON note_templates_used(template_id);

-- Provider Schedules Indexes
CREATE INDEX IF NOT EXISTS idx_provider_schedules_provider ON provider_schedules(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_date ON provider_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_status ON provider_schedules(status);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_patient_name ON provider_schedules(patient_name);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp for dictated_notes
CREATE OR REPLACE FUNCTION update_dictated_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_edited_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dictated_notes_timestamp
BEFORE UPDATE ON dictated_notes
FOR EACH ROW
EXECUTE FUNCTION update_dictated_notes_updated_at();

-- Auto-update updated_at timestamp for provider_schedules
CREATE OR REPLACE FUNCTION update_provider_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_provider_schedules_timestamp
BEFORE UPDATE ON provider_schedules
FOR EACH ROW
EXECUTE FUNCTION update_provider_schedules_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- HIPAA Compliance - Providers can only see their own data
-- ============================================

-- Enable RLS on all tables
ALTER TABLE dictated_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_note_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_templates_used ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_schedules ENABLE ROW LEVEL SECURITY;

-- Dictated Notes Policies
CREATE POLICY "Providers can view their own notes" ON dictated_notes
  FOR SELECT USING (
    provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_admin', true)::boolean = true
  );

CREATE POLICY "Providers can create their own notes" ON dictated_notes
  FOR INSERT WITH CHECK (
    provider_id = current_setting('app.current_provider_id', true)
  );

CREATE POLICY "Providers can update their own notes" ON dictated_notes
  FOR UPDATE USING (
    provider_id = current_setting('app.current_provider_id', true)
    AND status NOT IN ('signed', 'final')  -- Cannot edit signed notes
  );

-- Note Versions Policies (read-only audit trail)
CREATE POLICY "Providers can view versions of their notes" ON note_versions
  FOR SELECT USING (
    note_id IN (
      SELECT id FROM dictated_notes
      WHERE provider_id = current_setting('app.current_provider_id', true)
    )
  );

-- Note Comments Policies
CREATE POLICY "Providers can view comments on their notes" ON note_comments
  FOR SELECT USING (
    note_id IN (
      SELECT id FROM dictated_notes
      WHERE provider_id = current_setting('app.current_provider_id', true)
    )
  );

CREATE POLICY "Providers can add comments to their notes" ON note_comments
  FOR INSERT WITH CHECK (
    note_id IN (
      SELECT id FROM dictated_notes
      WHERE provider_id = current_setting('app.current_provider_id', true)
    )
  );

-- Provider Schedules Policies
CREATE POLICY "Providers can view their own schedule" ON provider_schedules
  FOR SELECT USING (
    provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_admin', true)::boolean = true
  );

CREATE POLICY "Providers can manage their own schedule" ON provider_schedules
  FOR ALL USING (
    provider_id = current_setting('app.current_provider_id', true)
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get latest note version number
CREATE OR REPLACE FUNCTION get_latest_note_version(p_note_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
  latest_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO latest_version
  FROM note_versions
  WHERE note_id = p_note_id;

  RETURN latest_version;
END;
$$ LANGUAGE plpgsql;

-- Function to check if note is editable
CREATE OR REPLACE FUNCTION is_note_editable(p_note_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  note_status VARCHAR(50);
  note_locked BOOLEAN;
BEGIN
  SELECT status, is_locked INTO note_status, note_locked
  FROM dictated_notes
  WHERE id = p_note_id;

  -- Note is editable if not locked and not in final/signed status
  RETURN (NOT note_locked) AND (note_status NOT IN ('signed', 'final'));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Recent notes with version count
CREATE OR REPLACE VIEW recent_notes_with_versions AS
SELECT
  dn.id,
  dn.provider_id,
  dn.provider_name,
  dn.patient_name,
  dn.patient_mrn,
  dn.visit_date,
  dn.note_title,
  dn.status,
  dn.dictated_at,
  dn.created_at,
  COUNT(DISTINCT nv.id) as version_count,
  COUNT(DISTINCT nc.id) as comment_count
FROM dictated_notes dn
LEFT JOIN note_versions nv ON dn.id = nv.note_id
LEFT JOIN note_comments nc ON dn.id = nc.note_id AND nc.is_resolved = false
GROUP BY dn.id
ORDER BY dn.dictated_at DESC;

-- View: Notes requiring review
CREATE OR REPLACE VIEW notes_requiring_review AS
SELECT
  dn.*,
  COUNT(DISTINCT nc.id) as unresolved_comments
FROM dictated_notes dn
LEFT JOIN note_comments nc ON dn.id = nc.note_id AND nc.is_resolved = false
WHERE dn.requires_review = true
  OR dn.status = 'pending-review'
  OR EXISTS (
    SELECT 1 FROM note_comments
    WHERE note_id = dn.id
      AND is_resolved = false
      AND comment_priority IN ('high', 'urgent')
  )
GROUP BY dn.id
ORDER BY
  CASE dn.review_priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  dn.created_at DESC;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment to insert test data
/*
INSERT INTO dictated_notes (
  provider_id, provider_name, provider_email, provider_specialty,
  patient_name, patient_phone, patient_mrn,
  visit_date, visit_type, note_title,
  raw_transcript, processed_note,
  recording_mode, status
) VALUES (
  'doc-001', 'Dr. Jane Smith', 'jane.smith@tshla.ai', 'Family Medicine',
  'John Doe', '555-1234', 'MRN-12345',
  CURRENT_DATE, 'follow-up', 'Follow-up Visit for Hypertension',
  'Patient reports feeling well. Blood pressure under control with current medication.',
  'S: Patient reports feeling well, BP controlled\nO: BP 120/80, HR 72\nA: HTN well controlled\nP: Continue current regimen',
  'dictation', 'draft'
);
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify schema was created correctly:

-- Check all tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('dictated_notes', 'note_versions', 'note_comments', 'schedule_note_links', 'note_templates_used', 'provider_schedules')
-- ORDER BY table_name;

-- Check table row counts
-- SELECT
--   'dictated_notes' as table_name, COUNT(*) as row_count FROM dictated_notes
-- UNION ALL
-- SELECT 'note_versions', COUNT(*) FROM note_versions
-- UNION ALL
-- SELECT 'note_comments', COUNT(*) FROM note_comments
-- UNION ALL
-- SELECT 'schedule_note_links', COUNT(*) FROM schedule_note_links
-- UNION ALL
-- SELECT 'provider_schedules', COUNT(*) FROM provider_schedules;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Database schema for dictated notes is ready!
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Verify tables created successfully
-- 3. Test dictation save flow from application
-- 4. Monitor Supabase logs for any errors
-- ============================================
