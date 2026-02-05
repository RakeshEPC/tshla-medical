-- =====================================================
-- TSHLA Medical - Full-Text Search for Patients
-- =====================================================
-- Created: 2026-02-05
-- Purpose: Add PostgreSQL full-text search to unified_patients
--          for fast searching across 10K+ patients
--
-- Performance: ILIKE queries scan entire table O(n)
--              Full-text search uses GIN index O(log n)
--              Expected improvement: 200-500ms -> 10-50ms
-- =====================================================

-- =====================================================
-- 1. ADD SEARCH VECTOR COLUMN
-- =====================================================

-- Add tsvector column for full-text search
ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add comment for documentation
COMMENT ON COLUMN unified_patients.search_vector IS
  'Full-text search vector combining name, phone, MRN, patient_id, tshla_id. Auto-maintained by trigger.';

-- =====================================================
-- 2. CREATE GIN INDEX FOR FAST TEXT SEARCH
-- =====================================================

-- GIN (Generalized Inverted Index) is optimized for full-text search
-- This index makes searches O(log n) instead of O(n)
CREATE INDEX IF NOT EXISTS idx_unified_patients_search_vector
ON unified_patients USING GIN(search_vector);

-- =====================================================
-- 3. CREATE FUNCTION TO BUILD SEARCH VECTOR
-- =====================================================

-- This function combines multiple fields into a weighted search vector
-- Weight 'A' = highest priority (names)
-- Weight 'B' = high priority (phone, IDs)
-- Weight 'C' = medium priority (other fields)

CREATE OR REPLACE FUNCTION build_patient_search_vector(
  p_first_name TEXT,
  p_last_name TEXT,
  p_full_name TEXT,
  p_phone_primary TEXT,
  p_phone_display TEXT,
  p_mrn TEXT,
  p_patient_id TEXT,
  p_tshla_id TEXT,
  p_email TEXT
) RETURNS tsvector AS $$
DECLARE
  -- Clean phone numbers for searchability (remove formatting)
  clean_phone TEXT;
  clean_phone_display TEXT;
  -- Clean TSH ID (remove "TSH " prefix and hyphens for flexible matching)
  clean_tshla TEXT;
BEGIN
  -- Normalize phone numbers
  clean_phone := COALESCE(REGEXP_REPLACE(p_phone_primary, '[^0-9]', '', 'g'), '');
  clean_phone_display := COALESCE(REGEXP_REPLACE(p_phone_display, '[^0-9]', '', 'g'), '');

  -- Normalize TSH ID (e.g., "TSH 972-918" -> "TSH 972918 972918 972-918")
  clean_tshla := COALESCE(REGEXP_REPLACE(p_tshla_id, '[^0-9]', '', 'g'), '');

  RETURN (
    -- Names get highest weight (A) - most common search
    setweight(to_tsvector('simple', COALESCE(p_first_name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_last_name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_full_name, '')), 'A') ||

    -- Phone numbers get weight B - common search
    -- Include both normalized and display formats
    setweight(to_tsvector('simple', clean_phone), 'B') ||
    setweight(to_tsvector('simple', clean_phone_display), 'B') ||
    setweight(to_tsvector('simple', COALESCE(p_phone_display, '')), 'B') ||

    -- IDs get weight B - common search
    setweight(to_tsvector('simple', COALESCE(p_mrn, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(p_patient_id, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(p_tshla_id, '')), 'B') ||
    setweight(to_tsvector('simple', clean_tshla), 'B') ||

    -- Email gets weight C - less common search
    setweight(to_tsvector('simple', COALESCE(p_email, '')), 'C')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 4. CREATE TRIGGER TO AUTO-UPDATE SEARCH VECTOR
-- =====================================================

CREATE OR REPLACE FUNCTION update_patient_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := build_patient_search_vector(
    NEW.first_name,
    NEW.last_name,
    NEW.full_name,
    NEW.phone_primary,
    NEW.phone_display,
    NEW.mrn,
    NEW.patient_id,
    NEW.tshla_id,
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_update_patient_search_vector ON unified_patients;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER trigger_update_patient_search_vector
  BEFORE INSERT OR UPDATE OF first_name, last_name, full_name, phone_primary, phone_display, mrn, patient_id, tshla_id, email
  ON unified_patients
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_search_vector_trigger();

-- =====================================================
-- 5. BACKFILL EXISTING RECORDS
-- =====================================================

-- Update all existing patients with search vectors
-- This may take a few seconds for 10K+ records
UPDATE unified_patients
SET search_vector = build_patient_search_vector(
  first_name,
  last_name,
  full_name,
  phone_primary,
  phone_display,
  mrn,
  patient_id,
  tshla_id,
  email
)
WHERE search_vector IS NULL
   OR search_vector = '';

-- =====================================================
-- 6. CREATE SEARCH FUNCTION (RPC)
-- =====================================================

-- This RPC function can be called from Supabase client for optimized searching
CREATE OR REPLACE FUNCTION search_patients_fts(
  search_query TEXT,
  result_limit INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  patient_id VARCHAR,
  tshla_id VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  full_name VARCHAR,
  phone_primary VARCHAR,
  phone_display VARCHAR,
  email VARCHAR,
  date_of_birth DATE,
  age INTEGER,
  gender VARCHAR,
  mrn VARCHAR,
  last_visit_date DATE,
  total_visits INTEGER,
  primary_provider_name VARCHAR,
  is_active BOOLEAN,
  rank REAL
) AS $$
DECLARE
  tsquery_text TEXT;
BEGIN
  -- Handle empty or short queries
  IF search_query IS NULL OR LENGTH(TRIM(search_query)) < 2 THEN
    RETURN;
  END IF;

  -- Convert search query to tsquery format
  -- Support partial matching with :* prefix
  tsquery_text := (
    SELECT string_agg(word || ':*', ' & ')
    FROM unnest(string_to_array(TRIM(search_query), ' ')) AS word
    WHERE LENGTH(word) > 0
  );

  -- Return matching patients ordered by relevance
  RETURN QUERY
  SELECT
    up.id,
    up.patient_id,
    up.tshla_id,
    up.first_name,
    up.last_name,
    up.full_name,
    up.phone_primary,
    up.phone_display,
    up.email,
    up.date_of_birth,
    up.age,
    up.gender,
    up.mrn,
    up.last_visit_date,
    up.total_visits,
    up.primary_provider_name,
    up.is_active,
    ts_rank(up.search_vector, to_tsquery('simple', tsquery_text)) AS rank
  FROM unified_patients up
  WHERE up.is_active = true
    AND up.search_vector @@ to_tsquery('simple', tsquery_text)
  ORDER BY rank DESC, up.last_visit_date DESC NULLS LAST
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_patients_fts TO authenticated;
GRANT EXECUTE ON FUNCTION search_patients_fts TO service_role;

-- =====================================================
-- 7. VERIFICATION QUERIES
-- =====================================================

-- Run these queries to verify the migration:

-- Check search vector was populated
-- SELECT COUNT(*) as total,
--        COUNT(search_vector) as with_vector,
--        COUNT(*) - COUNT(search_vector) as missing_vector
-- FROM unified_patients;

-- Test search performance (should use index)
-- EXPLAIN ANALYZE
-- SELECT * FROM search_patients_fts('PATEL', 20, 0);

-- Test partial phone search
-- EXPLAIN ANALYZE
-- SELECT * FROM search_patients_fts('832', 20, 0);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
--
-- To use in application:
--
-- Option 1: Use RPC function (recommended)
--   const { data } = await supabase.rpc('search_patients_fts', {
--     search_query: 'PATEL',
--     result_limit: 20,
--     result_offset: 0
--   });
--
-- Option 2: Use textSearch filter
--   const { data } = await supabase
--     .from('unified_patients')
--     .select('*')
--     .textSearch('search_vector', 'PATEL:*', { type: 'plain' })
--     .limit(20);
-- =====================================================
