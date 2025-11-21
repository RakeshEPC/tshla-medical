-- ============================================
-- Link Extracted Orders to PCM System
-- ============================================
-- Created: 2025-11-20
-- Purpose: Connect dictation-extracted orders to PCM patient management
-- Database: Supabase PostgreSQL
-- ============================================

-- ============================================
-- 1. ADD PCM PATIENT LINK TO EXTRACTED_ORDERS
-- ============================================
ALTER TABLE extracted_orders
ADD COLUMN IF NOT EXISTS pcm_patient_id VARCHAR(100);

-- Add comment
COMMENT ON COLUMN extracted_orders.pcm_patient_id IS
'Links extracted order to PCM (Principal Care Management) patient if enrolled';

-- Create index for fast PCM patient lookups
CREATE INDEX IF NOT EXISTS idx_extracted_orders_pcm_patient
ON extracted_orders(pcm_patient_id)
WHERE pcm_patient_id IS NOT NULL;

-- ============================================
-- 2. CREATE PCM LAB ORDERS TABLE
-- Separate table for PCM-specific lab order tracking
-- ============================================
CREATE TABLE IF NOT EXISTS pcm_lab_orders (
  id BIGSERIAL PRIMARY KEY,

  -- Link to PCM patient
  pcm_patient_id VARCHAR(100) NOT NULL,
  pcm_patient_name VARCHAR(255),

  -- Order Details
  order_text TEXT NOT NULL,
  order_type VARCHAR(50) CHECK (order_type IN ('lab', 'imaging', 'medication', 'other')),
  urgency VARCHAR(20) DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'stat')),

  -- Status Tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

  -- Source Tracking
  source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'dictation', 'ai_extraction', 'other')),
  extracted_order_id BIGINT, -- FK to extracted_orders table

  -- Provider Context
  ordered_by_provider_id VARCHAR(100),
  ordered_by_provider_name VARCHAR(255),

  -- Dates
  ordered_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  completed_date DATE,

  -- Assignment
  assigned_to_staff_id VARCHAR(100),
  assigned_to_staff_name VARCHAR(255),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. ADD FOREIGN KEY CONSTRAINT
-- ============================================
ALTER TABLE pcm_lab_orders
ADD CONSTRAINT fk_pcm_lab_orders_extracted_order
FOREIGN KEY (extracted_order_id)
REFERENCES extracted_orders(id)
ON DELETE SET NULL;

-- ============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- PCM patient lookup
CREATE INDEX IF NOT EXISTS idx_pcm_lab_orders_patient
ON pcm_lab_orders(pcm_patient_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_pcm_lab_orders_status
ON pcm_lab_orders(status);

-- Source tracking
CREATE INDEX IF NOT EXISTS idx_pcm_lab_orders_source
ON pcm_lab_orders(source);

-- Date filtering
CREATE INDEX IF NOT EXISTS idx_pcm_lab_orders_ordered_date
ON pcm_lab_orders(ordered_date DESC);

-- Staff assignment
CREATE INDEX IF NOT EXISTS idx_pcm_lab_orders_assigned_staff
ON pcm_lab_orders(assigned_to_staff_id)
WHERE assigned_to_staff_id IS NOT NULL;

-- Provider filtering
CREATE INDEX IF NOT EXISTS idx_pcm_lab_orders_provider
ON pcm_lab_orders(ordered_by_provider_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_pcm_lab_orders_workflow
ON pcm_lab_orders(pcm_patient_id, status, ordered_date DESC);

-- ============================================
-- 5. CREATE TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pcm_lab_orders_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Auto-set completed_date when status changes to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.completed_date IS NULL THEN
    NEW.completed_date = CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pcm_lab_orders_timestamp
BEFORE UPDATE ON pcm_lab_orders
FOR EACH ROW
EXECUTE FUNCTION update_pcm_lab_orders_timestamp();

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- HIPAA Compliance
-- ============================================

ALTER TABLE pcm_lab_orders ENABLE ROW LEVEL SECURITY;

-- Providers can view their own orders
CREATE POLICY "Providers can view their PCM lab orders" ON pcm_lab_orders
  FOR SELECT USING (
    ordered_by_provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_admin', true)::boolean = true
    OR current_setting('app.is_staff', true)::boolean = true
  );

-- Providers can create orders
CREATE POLICY "Providers can create PCM lab orders" ON pcm_lab_orders
  FOR INSERT WITH CHECK (
    ordered_by_provider_id = current_setting('app.current_provider_id', true)
  );

-- Providers and staff can update orders
CREATE POLICY "Providers and staff can update PCM lab orders" ON pcm_lab_orders
  FOR UPDATE USING (
    ordered_by_provider_id = current_setting('app.current_provider_id', true)
    OR current_setting('app.is_staff', true)::boolean = true
  );

-- Only providers can delete orders
CREATE POLICY "Providers can delete PCM lab orders" ON pcm_lab_orders
  FOR DELETE USING (
    ordered_by_provider_id = current_setting('app.current_provider_id', true)
  );

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to create PCM lab order from extracted order
CREATE OR REPLACE FUNCTION create_pcm_order_from_extraction(
  p_extracted_order_id BIGINT,
  p_pcm_patient_id VARCHAR,
  p_pcm_patient_name VARCHAR
)
RETURNS BIGINT AS $$
DECLARE
  v_order_id BIGINT;
  v_extracted extracted_orders%ROWTYPE;
BEGIN
  -- Get extracted order details
  SELECT * INTO v_extracted
  FROM extracted_orders
  WHERE id = p_extracted_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extracted order not found: %', p_extracted_order_id;
  END IF;

  -- Create PCM lab order
  INSERT INTO pcm_lab_orders (
    pcm_patient_id,
    pcm_patient_name,
    order_text,
    order_type,
    urgency,
    source,
    extracted_order_id,
    ordered_by_provider_id,
    ordered_by_provider_name,
    notes
  ) VALUES (
    p_pcm_patient_id,
    p_pcm_patient_name,
    v_extracted.order_text,
    v_extracted.order_type,
    v_extracted.urgency,
    'ai_extraction',
    p_extracted_order_id,
    v_extracted.provider_id,
    v_extracted.provider_name,
    'Automatically created from dictation. Confidence: ' || ROUND(v_extracted.confidence_score * 100) || '%'
  ) RETURNING id INTO v_order_id;

  -- Update extracted_orders with PCM patient link
  UPDATE extracted_orders
  SET pcm_patient_id = p_pcm_patient_id
  WHERE id = p_extracted_order_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending PCM orders for a patient
CREATE OR REPLACE FUNCTION get_pcm_patient_pending_orders(
  p_pcm_patient_id VARCHAR
)
RETURNS TABLE (
  id BIGINT,
  order_text TEXT,
  order_type VARCHAR,
  urgency VARCHAR,
  source VARCHAR,
  ordered_date DATE,
  confidence_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    plo.id,
    plo.order_text,
    plo.order_type,
    plo.urgency,
    plo.source,
    plo.ordered_date,
    CASE
      WHEN plo.extracted_order_id IS NOT NULL
      THEN (SELECT confidence_score FROM extracted_orders WHERE id = plo.extracted_order_id)
      ELSE NULL
    END as confidence_score
  FROM pcm_lab_orders plo
  WHERE plo.pcm_patient_id = p_pcm_patient_id
    AND plo.status = 'pending'
  ORDER BY
    CASE plo.urgency
      WHEN 'stat' THEN 1
      WHEN 'urgent' THEN 2
      ELSE 3
    END,
    plo.ordered_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get order statistics for PCM dashboard
CREATE OR REPLACE FUNCTION get_pcm_order_statistics()
RETURNS TABLE (
  total_orders BIGINT,
  pending_orders BIGINT,
  in_progress_orders BIGINT,
  completed_orders BIGINT,
  urgent_orders BIGINT,
  from_dictation_count BIGINT,
  manual_orders_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_orders,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_orders,
    COUNT(*) FILTER (WHERE status = 'in_progress')::BIGINT as in_progress_orders,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_orders,
    COUNT(*) FILTER (WHERE urgency IN ('urgent', 'stat'))::BIGINT as urgent_orders,
    COUNT(*) FILTER (WHERE source IN ('dictation', 'ai_extraction'))::BIGINT as from_dictation_count,
    COUNT(*) FILTER (WHERE source = 'manual')::BIGINT as manual_orders_count
  FROM pcm_lab_orders;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. VIEWS FOR COMMON QUERIES
-- ============================================

-- View: PCM orders with extracted order details
CREATE OR REPLACE VIEW v_pcm_orders_with_extraction AS
SELECT
  plo.id,
  plo.pcm_patient_id,
  plo.pcm_patient_name,
  plo.order_text,
  plo.order_type,
  plo.urgency,
  plo.status,
  plo.source,
  plo.ordered_date,
  plo.due_date,
  plo.completed_date,
  plo.assigned_to_staff_name,
  plo.ordered_by_provider_name,
  -- Extracted order details
  eo.confidence_score,
  eo.action,
  eo.requires_verification,
  dn.raw_transcript,
  dn.processed_note
FROM pcm_lab_orders plo
LEFT JOIN extracted_orders eo ON plo.extracted_order_id = eo.id
LEFT JOIN dictated_notes dn ON eo.note_id = dn.id
ORDER BY
  CASE plo.urgency
    WHEN 'stat' THEN 1
    WHEN 'urgent' THEN 2
    ELSE 3
  END,
  plo.ordered_date ASC;

-- View: Pending PCM orders for staff dashboard
CREATE OR REPLACE VIEW v_pcm_pending_orders_dashboard AS
SELECT
  plo.id,
  plo.pcm_patient_id,
  plo.pcm_patient_name,
  plo.order_text,
  plo.order_type,
  plo.urgency,
  plo.source,
  plo.ordered_date,
  plo.assigned_to_staff_name,
  plo.ordered_by_provider_name,
  eo.confidence_score,
  CASE
    WHEN eo.confidence_score < 0.8 THEN true
    ELSE false
  END as needs_verification
FROM pcm_lab_orders plo
LEFT JOIN extracted_orders eo ON plo.extracted_order_id = eo.id
WHERE plo.status = 'pending'
ORDER BY
  CASE plo.urgency
    WHEN 'stat' THEN 1
    WHEN 'urgent' THEN 2
    ELSE 3
  END,
  plo.ordered_date ASC;

-- ============================================
-- 9. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment to insert test data
/*
-- Sample: Link existing extracted order to PCM patient
UPDATE extracted_orders
SET pcm_patient_id = 'pcm-patient-001'
WHERE id = 1; -- Replace with actual extracted_order id

-- Sample: Create PCM lab order from extracted order
SELECT create_pcm_order_from_extraction(
  1,                    -- extracted_order_id
  'pcm-patient-001',    -- pcm_patient_id
  'John Doe'            -- pcm_patient_name
);

-- Sample: Get pending orders for a patient
SELECT * FROM get_pcm_patient_pending_orders('pcm-patient-001');

-- Sample: Get PCM order statistics
SELECT * FROM get_pcm_order_statistics();
*/

-- ============================================
-- 10. VERIFICATION QUERIES
-- ============================================

-- Check if pcm_patient_id column was added to extracted_orders
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'extracted_orders' AND column_name = 'pcm_patient_id';

-- Check if pcm_lab_orders table was created
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'pcm_lab_orders';

-- Count PCM orders by source
-- SELECT source, COUNT(*) FROM pcm_lab_orders GROUP BY source;

-- Check pending orders view
-- SELECT * FROM v_pcm_pending_orders_dashboard LIMIT 10;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- PCM order integration is ready!
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Update application code to use new functions
-- 3. Test order creation from dictation
-- 4. Verify orders appear in PCM Lab Orders dashboard
-- ============================================
