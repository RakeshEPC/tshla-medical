-- ============================================
-- Migration 034: Create Patient Messages Table
-- ============================================
-- Purpose: Store messages between patients and care team
--          Used by MESSAGES screen in patient portal
-- Created: 2026-02-06
-- ============================================

-- ============================================
-- 1. Create patient_messages table
-- ============================================

CREATE TABLE IF NOT EXISTS patient_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_patient_id UUID NOT NULL REFERENCES unified_patients(id) ON DELETE CASCADE,

  -- Message sender
  sender VARCHAR(20) NOT NULL CHECK (sender IN ('patient', 'staff', 'system')),
  staff_id UUID REFERENCES medical_staff(id), -- If sender is staff

  -- Message content
  category VARCHAR(50), -- 'refill', 'side_effect', 'clarification', 'new_symptom', 'response', 'system'
  content TEXT NOT NULL,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved', 'pending')),
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES medical_staff(id),

  -- AI processing
  ai_summary TEXT, -- AI-generated summary for staff
  ai_priority VARCHAR(20), -- 'urgent', 'normal', 'low'
  ai_suggested_action TEXT, -- AI suggestion for staff response

  -- Threading
  parent_message_id UUID REFERENCES patient_messages(id), -- For reply chains
  thread_id UUID, -- Groups related messages

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Create indexes
-- ============================================

-- Primary lookup: Get messages for a patient
CREATE INDEX idx_patient_messages_patient
  ON patient_messages(unified_patient_id, created_at DESC);

-- Find unread messages for staff dashboard
CREATE INDEX idx_patient_messages_unread
  ON patient_messages(status, created_at DESC)
  WHERE status = 'unread' AND sender = 'patient';

-- Find messages by category
CREATE INDEX idx_patient_messages_category
  ON patient_messages(category, created_at DESC);

-- Thread lookup
CREATE INDEX idx_patient_messages_thread
  ON patient_messages(thread_id, created_at ASC)
  WHERE thread_id IS NOT NULL;

-- ============================================
-- 3. Create trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_patient_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_patient_messages_updated_at ON patient_messages;
CREATE TRIGGER trigger_patient_messages_updated_at
  BEFORE UPDATE ON patient_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_messages_updated_at();

-- ============================================
-- 4. Create function to set thread_id for new threads
-- ============================================

CREATE OR REPLACE FUNCTION set_patient_message_thread_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a reply, inherit the thread_id from parent
  IF NEW.parent_message_id IS NOT NULL THEN
    SELECT COALESCE(thread_id, id) INTO NEW.thread_id
    FROM patient_messages
    WHERE id = NEW.parent_message_id;
  ELSE
    -- New thread starts with its own ID
    NEW.thread_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_message_thread ON patient_messages;
CREATE TRIGGER trigger_set_message_thread
  BEFORE INSERT ON patient_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_patient_message_thread_id();

-- ============================================
-- 5. Create view for message threads
-- ============================================

CREATE OR REPLACE VIEW v_patient_message_threads AS
SELECT
  pm.thread_id,
  pm.unified_patient_id,
  up.tshla_id,
  up.full_name as patient_name,
  pm.category,
  COUNT(*) as message_count,
  MAX(pm.created_at) as last_message_at,
  MIN(pm.created_at) as started_at,
  (SELECT content FROM patient_messages WHERE thread_id = pm.thread_id ORDER BY created_at LIMIT 1) as first_message,
  BOOL_OR(pm.status = 'unread' AND pm.sender = 'patient') as has_unread,
  BOOL_OR(pm.status = 'pending') as has_pending
FROM patient_messages pm
JOIN unified_patients up ON up.id = pm.unified_patient_id
GROUP BY pm.thread_id, pm.unified_patient_id, up.tshla_id, up.full_name, pm.category
ORDER BY last_message_at DESC;

COMMENT ON VIEW v_patient_message_threads IS 'Aggregated view of patient message threads for staff dashboard';

-- ============================================
-- 6. RLS Policies
-- ============================================

ALTER TABLE patient_messages ENABLE ROW LEVEL SECURITY;

-- Patients can see their own messages
CREATE POLICY "Patients see their own messages" ON patient_messages
  FOR SELECT USING (
    unified_patient_id IN (
      SELECT id FROM unified_patients
      WHERE auth_user_id = auth.uid()
    )
  );

-- Patients can insert messages (as sender=patient)
CREATE POLICY "Patients can send messages" ON patient_messages
  FOR INSERT WITH CHECK (
    sender = 'patient'
    AND unified_patient_id IN (
      SELECT id FROM unified_patients
      WHERE auth_user_id = auth.uid()
    )
  );

-- Medical staff can see all messages
CREATE POLICY "Staff can view all messages" ON patient_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Medical staff can insert/update messages
CREATE POLICY "Staff can manage messages" ON patient_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY "Service role full access" ON patient_messages
  FOR ALL USING (
    auth.jwt()->>'role' = 'service_role'
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- patient_messages table is ready for patient-staff communication
-- Messages are threaded and track read/resolved status
-- AI fields available for smart routing and prioritization
-- ============================================
