-- ============================================
-- Add Extracted Orders Support to Dictated Notes
-- ============================================
-- Created: 2025-11-20
-- Purpose: Store and track extracted orders (labs, medications, etc.) from dictated notes
-- Database: Supabase PostgreSQL
-- ============================================

-- ============================================
-- 1. ADD EXTRACTED_ORDERS COLUMN TO DICTATED_NOTES
-- Store the raw extracted orders JSON from AI processing
-- ============================================
ALTER TABLE dictated_notes
ADD COLUMN IF NOT EXISTS extracted_orders JSONB;

-- Add comment to document the column
COMMENT ON COLUMN dictated_notes.extracted_orders IS
'JSONB structure containing extracted orders from dictation: {medications: [], labs: [], imaging: [], priorAuths: [], referrals: [], rawOrders: ""}';

-- ============================================
-- 2. CREATE EXTRACTED_ORDERS TABLE
-- Normalized table for tracking individual orders
-- ============================================
CREATE TABLE IF NOT EXISTS extracted_orders (
  id BIGSERIAL PRIMARY KEY,

  -- Link to source note
  note_id BIGINT NOT NULL REFERENCES dictated_notes(id) ON DELETE CASCADE,

  -- Order Details
  order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('medication', 'lab', 'imaging', 'prior_auth', 'referral', 'other')),
  order_text TEXT NOT NULL,
  action VARCHAR(50) CHECK (action IN ('start', 'stop', 'continue', 'increase', 'decrease', 'order', 'check')),
  details TEXT,
  urgency VARCHAR(20) DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'stat')),

  -- Extraction Quality
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  requires_verification BOOLEAN DEFAULT false,

  -- Order Status & Workflow
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'verified')),

  -- Assignment & Completion
  assigned_to_ma_id VARCHAR(100),
  assigned_to_ma_name VARCHAR(255),
  assigned_at TIMESTAMPTZ,

  started_at TIMESTAMPTZ,

  completed_at TIMESTAMPTZ,
  completed_by_ma_id VARCHAR(100),
  completed_by_ma_name VARCHAR(255),
  completion_notes TEXT,

  verified_at TIMESTAMPTZ,
  verified_by_provider_id VARCHAR(100),
  verified_by_provider_name VARCHAR(255),

  -- Patient & Provider Context (denormalized for performance)
  patient_name VARCHAR(255),
  patient_mrn VARCHAR(50),
  provider_id VARCHAR(100) NOT NULL,
  provider_name VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Priority for MA workflow
  priority_score INTEGER DEFAULT 5 CHECK (priority_score >= 1 AND priority_score <= 10),
  estimated_time_minutes INTEGER
);

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Extracted Orders in Dictated Notes
CREATE INDEX IF NOT EXISTS idx_dictated_notes_extracted_orders
  ON dictated_notes USING GIN (extracted_orders)
  WHERE extracted_orders IS NOT NULL;

-- Extracted Orders Table Indexes
CREATE INDEX IF NOT EXISTS idx_extracted_orders_note_id
  ON extracted_orders(note_id);

CREATE INDEX IF NOT EXISTS idx_extracted_orders_status
  ON extracted_orders(status);

CREATE INDEX IF NOT EXISTS idx_extracted_orders_order_type
  ON extracted_orders(order_type);

CREATE INDEX IF NOT EXISTS idx_extracted_orders_urgency
  ON extracted_orders(urgency);

CREATE INDEX IF NOT EXISTS idx_extracted_orders_assigned_ma
  ON extracted_orders(assigned_to_ma_id)
  WHERE assigned_to_ma_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_extracted_orders_provider
  ON extracted_orders(provider_id);

CREATE INDEX IF NOT EXISTS idx_extracted_orders_patient
  ON extracted_orders(patient_mrn)
  WHERE patient_mrn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_extracted_orders_created_at
  ON extracted_orders(created_at DESC);

-- Composite index for MA dashboard queries
CREATE INDEX IF NOT EXISTS idx_extracted_orders_ma_workflow
  ON extracted_orders(status, urgency, priority_score DESC, created_at DESC);

-- ============================================
-- 4. CREATE TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_extracted_orders_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_extracted_orders_timestamp
BEFORE UPDATE ON extracted_orders
FOR EACH ROW
EXECUTE FUNCTION update_extracted_orders_timestamp();

-- Auto-set timestamps based on status changes
CREATE OR REPLACE FUNCTION update_extracted_orders_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set started_at when status changes to in_progress
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at = NOW();
  END IF;

  -- Set completed_at when status changes to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;

  -- Set verified_at when status changes to verified
  IF NEW.status = 'verified' AND OLD.status != 'verified' AND NEW.verified_at IS NULL THEN
    NEW.verified_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_extracted_orders_status_timestamps
BEFORE UPDATE ON extracted_orders
FOR EACH ROW
EXECUTE FUNCTION update_extracted_orders_status_timestamps();

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- HIPAA Compliance
-- ============================================

ALTER TABLE extracted_orders ENABLE ROW LEVEL SECURITY;

-- Providers can view orders from their notes
CREATE POLICY "Providers can view their own orders" ON extracted_orders
  FOR SELECT USING (
    provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_admin', true)::boolean = true
    OR current_setting('app.is_ma', true)::boolean = true
  );

-- Providers can create orders
CREATE POLICY "Providers can create orders" ON extracted_orders
  FOR INSERT WITH CHECK (
    provider_id = current_setting('app.current_provider_id', true)
  );

-- Providers and MAs can update orders
CREATE POLICY "Providers and MAs can update orders" ON extracted_orders
  FOR UPDATE USING (
    provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_ma', true)::boolean = true
  );

-- Only providers can delete orders
CREATE POLICY "Providers can delete orders" ON extracted_orders
  FOR DELETE USING (
    provider_id = current_setting('app.current_provider_id', true)
  );

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to get pending orders for MA dashboard
CREATE OR REPLACE FUNCTION get_pending_orders_for_ma(
  p_ma_id VARCHAR DEFAULT NULL,
  p_status VARCHAR DEFAULT 'pending',
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  order_type VARCHAR,
  order_text TEXT,
  urgency VARCHAR,
  priority_score INTEGER,
  patient_name VARCHAR,
  patient_mrn VARCHAR,
  provider_name VARCHAR,
  created_at TIMESTAMPTZ,
  assigned_to_ma_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    eo.id,
    eo.order_type,
    eo.order_text,
    eo.urgency,
    eo.priority_score,
    eo.patient_name,
    eo.patient_mrn,
    eo.provider_name,
    eo.created_at,
    eo.assigned_to_ma_name
  FROM extracted_orders eo
  WHERE
    (p_status IS NULL OR eo.status = p_status)
    AND (p_ma_id IS NULL OR eo.assigned_to_ma_id = p_ma_id)
  ORDER BY
    CASE eo.urgency
      WHEN 'stat' THEN 1
      WHEN 'urgent' THEN 2
      ELSE 3
    END,
    eo.priority_score DESC,
    eo.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get order statistics
CREATE OR REPLACE FUNCTION get_order_statistics(
  p_provider_id VARCHAR DEFAULT NULL,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_orders BIGINT,
  pending_orders BIGINT,
  in_progress_orders BIGINT,
  completed_orders BIGINT,
  urgent_orders BIGINT,
  stat_orders BIGINT,
  medication_orders BIGINT,
  lab_orders BIGINT,
  imaging_orders BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_orders,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_orders,
    COUNT(*) FILTER (WHERE status = 'in_progress')::BIGINT as in_progress_orders,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_orders,
    COUNT(*) FILTER (WHERE urgency = 'urgent')::BIGINT as urgent_orders,
    COUNT(*) FILTER (WHERE urgency = 'stat')::BIGINT as stat_orders,
    COUNT(*) FILTER (WHERE order_type = 'medication')::BIGINT as medication_orders,
    COUNT(*) FILTER (WHERE order_type = 'lab')::BIGINT as lab_orders,
    COUNT(*) FILTER (WHERE order_type = 'imaging')::BIGINT as imaging_orders
  FROM extracted_orders
  WHERE
    (p_provider_id IS NULL OR provider_id = p_provider_id)
    AND created_at >= p_start_date
    AND created_at <= p_end_date + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Pending orders with note details
CREATE OR REPLACE VIEW v_pending_orders_with_notes AS
SELECT
  eo.id,
  eo.order_type,
  eo.order_text,
  eo.action,
  eo.urgency,
  eo.priority_score,
  eo.confidence_score,
  eo.patient_name,
  eo.patient_mrn,
  eo.provider_name,
  eo.assigned_to_ma_name,
  eo.created_at,
  dn.visit_date,
  dn.note_title,
  dn.patient_phone,
  dn.patient_email
FROM extracted_orders eo
JOIN dictated_notes dn ON eo.note_id = dn.id
WHERE eo.status = 'pending'
ORDER BY
  CASE eo.urgency
    WHEN 'stat' THEN 1
    WHEN 'urgent' THEN 2
    ELSE 3
  END,
  eo.priority_score DESC,
  eo.created_at ASC;

-- View: MA workload summary
CREATE OR REPLACE VIEW v_ma_workload_summary AS
SELECT
  assigned_to_ma_id,
  assigned_to_ma_name,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
  COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today,
  COUNT(*) FILTER (WHERE urgency = 'stat') as stat_orders,
  COUNT(*) FILTER (WHERE urgency = 'urgent') as urgent_orders,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) as avg_completion_time_minutes
FROM extracted_orders
WHERE assigned_to_ma_id IS NOT NULL
GROUP BY assigned_to_ma_id, assigned_to_ma_name;

-- ============================================
-- 8. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment to insert test data
/*
-- Sample: Add extracted orders to a note
UPDATE dictated_notes
SET extracted_orders = '{
  "medications": [
    {"type": "medication", "text": "Start Metformin 500mg twice daily", "action": "start", "confidence": 0.95, "urgency": "routine"}
  ],
  "labs": [
    {"type": "lab", "text": "Order A1C and CMP", "action": "order", "confidence": 0.90, "urgency": "routine"},
    {"type": "lab", "text": "STAT CBC", "action": "order", "confidence": 0.85, "urgency": "stat"}
  ],
  "imaging": [],
  "priorAuths": [],
  "referrals": [],
  "rawOrders": "Start Metformin 500mg twice daily. Order A1C and CMP. STAT CBC."
}'::jsonb
WHERE id = 1; -- Replace with actual note ID

-- Sample: Create individual extracted orders
INSERT INTO extracted_orders (
  note_id, order_type, order_text, action, urgency, confidence_score,
  patient_name, patient_mrn, provider_id, provider_name, priority_score
) VALUES
(1, 'medication', 'Start Metformin 500mg twice daily', 'start', 'routine', 0.95,
 'John Doe', 'MRN-12345', 'doc-001', 'Dr. Jane Smith', 7),
(1, 'lab', 'Order A1C and CMP', 'order', 'routine', 0.90,
 'John Doe', 'MRN-12345', 'doc-001', 'Dr. Jane Smith', 7),
(1, 'lab', 'STAT CBC', 'order', 'stat', 0.85,
 'John Doe', 'MRN-12345', 'doc-001', 'Dr. Jane Smith', 10);
*/

-- ============================================
-- 9. VERIFICATION QUERIES
-- ============================================

-- Check if extracted_orders column was added
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'dictated_notes' AND column_name = 'extracted_orders';

-- Check if extracted_orders table was created
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'extracted_orders';

-- Count orders by type
-- SELECT order_type, COUNT(*) as count FROM extracted_orders GROUP BY order_type;

-- Count orders by status
-- SELECT status, COUNT(*) as count FROM extracted_orders GROUP BY status;

-- Test pending orders view
-- SELECT * FROM v_pending_orders_with_notes LIMIT 10;

-- Test MA workload view
-- SELECT * FROM v_ma_workload_summary;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Extracted orders support is ready!
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Update application code to save extracted orders
-- 3. Build MA dashboard to display pending orders
-- 4. Test order extraction and workflow
-- ============================================
