-- =====================================================
-- FIX PUMP_ASSESSMENTS SCHEMA
-- Resolves: Pump assessment data not saving issue
-- =====================================================
-- Created: 2025-12-16
-- Priority: CRITICAL (Part of RLS fix)
-- =====================================================
--
-- PROBLEM:
-- - Frontend uses "patient_id" but some schemas use "user_id"
-- - Schema confusion between "patients" and "pump_users" tables
-- - RLS policies reference wrong tables
--
-- SOLUTION:
-- - Standardize on "patient_id" referencing "patients" table
-- - Update RLS policies accordingly
-- - This aligns with frontend code (already uses patient_id)
--
-- =====================================================

BEGIN;

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FIXING PUMP_ASSESSMENTS SCHEMA';
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- STEP 1: CHECK CURRENT SCHEMA
-- =====================================================

DO $$
DECLARE
    has_patient_id BOOLEAN;
    has_user_id BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 1: Checking current column names...';

    -- Check if patient_id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pump_assessments'
          AND column_name = 'patient_id'
    ) INTO has_patient_id;

    -- Check if user_id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pump_assessments'
          AND column_name = 'user_id'
    ) INTO has_user_id;

    IF has_patient_id THEN
        RAISE NOTICE '✓ Table already has patient_id column';
    END IF;

    IF has_user_id THEN
        RAISE NOTICE '⚠ Table has user_id column - will rename to patient_id';
    END IF;

    IF NOT has_patient_id AND NOT has_user_id THEN
        RAISE WARNING '✗ Table has NEITHER patient_id nor user_id - manual intervention required!';
    END IF;
END $$;

-- =====================================================
-- STEP 2: RENAME COLUMN (if needed)
-- =====================================================

DO $$
DECLARE
    has_user_id BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pump_assessments'
          AND column_name = 'user_id'
    ) INTO has_user_id;

    IF has_user_id THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Step 2: Renaming user_id to patient_id...';

        -- Rename column
        ALTER TABLE pump_assessments
            RENAME COLUMN user_id TO patient_id;

        RAISE NOTICE '✓ Column renamed: user_id → patient_id';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE 'Step 2: No rename needed (patient_id already exists)';
    END IF;
END $$;

-- =====================================================
-- STEP 3: UPDATE FOREIGN KEY CONSTRAINT
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 3: Updating foreign key constraint...';

    -- Drop old foreign key if it exists
    ALTER TABLE pump_assessments
        DROP CONSTRAINT IF EXISTS pump_assessments_user_id_fkey;

    ALTER TABLE pump_assessments
        DROP CONSTRAINT IF EXISTS pump_assessments_patient_id_fkey;

    -- Create new foreign key to patients table
    ALTER TABLE pump_assessments
        ADD CONSTRAINT pump_assessments_patient_id_fkey
        FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE;

    RAISE NOTICE '✓ Foreign key updated: patient_id → patients(id)';
END $$;

-- =====================================================
-- STEP 4: ENSURE REQUIRED COLUMNS EXIST
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 4: Ensuring all required columns exist...';
END $$;

-- Add columns if they don't exist (from create-pump-assessments-table.sql)
ALTER TABLE pump_assessments
    ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS slider_values JSONB,
    ADD COLUMN IF NOT EXISTS selected_features JSONB,
    ADD COLUMN IF NOT EXISTS lifestyle_text TEXT,
    ADD COLUMN IF NOT EXISTS challenges_text TEXT,
    ADD COLUMN IF NOT EXISTS priorities_text TEXT,
    ADD COLUMN IF NOT EXISTS clarification_responses JSONB,
    ADD COLUMN IF NOT EXISTS final_recommendation JSONB,
    ADD COLUMN IF NOT EXISTS first_choice_pump VARCHAR(255),
    ADD COLUMN IF NOT EXISTS second_choice_pump VARCHAR(255),
    ADD COLUMN IF NOT EXISTS third_choice_pump VARCHAR(255),
    ADD COLUMN IF NOT EXISTS recommendation_date TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS assessment_version INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS dtsqs_baseline JSONB,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_sent_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
    RAISE NOTICE '✓ All required columns ensured';
END $$;

-- =====================================================
-- STEP 5: ADD INDEXES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 5: Creating performance indexes...';
END $$;

CREATE INDEX IF NOT EXISTS idx_pump_assessments_patient_id
    ON pump_assessments(patient_id);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_first_choice
    ON pump_assessments(first_choice_pump);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_recommendation_date
    ON pump_assessments(recommendation_date DESC);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_user_date
    ON pump_assessments(patient_id, recommendation_date DESC);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_payment_status
    ON pump_assessments(payment_status);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_created
    ON pump_assessments(created_at DESC);

DO $$
BEGIN
    RAISE NOTICE '✓ Indexes created';
END $$;

-- =====================================================
-- STEP 6: CREATE AUTO-UPDATE TRIGGER
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 6: Creating update timestamp trigger...';
END $$;

-- Create or replace the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_pump_assessments_updated_at ON pump_assessments;

-- Create trigger
CREATE TRIGGER update_pump_assessments_updated_at
    BEFORE UPDATE ON pump_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
    RAISE NOTICE '✓ Trigger created';
END $$;

-- =====================================================
-- STEP 7: VERIFICATION
-- =====================================================

DO $$
DECLARE
    column_count INTEGER;
    index_count INTEGER;
    fk_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION';
    RAISE NOTICE '========================================';

    -- Count columns
    SELECT count(*) INTO column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pump_assessments';

    RAISE NOTICE 'Total columns: %', column_count;

    -- Count indexes
    SELECT count(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'pump_assessments';

    RAISE NOTICE 'Total indexes: %', index_count;

    -- Count foreign keys
    SELECT count(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'pump_assessments'
      AND constraint_type = 'FOREIGN KEY';

    RAISE NOTICE 'Foreign key constraints: %', fk_count;

    IF column_count >= 20 AND index_count >= 5 AND fk_count >= 1 THEN
        RAISE NOTICE '';
        RAISE NOTICE '✓ Schema verification PASSED';
    ELSE
        RAISE WARNING '⚠ Schema verification has warnings - please review';
    END IF;
END $$;

-- Display final schema
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pump_assessments'
ORDER BY ordinal_position;

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PUMP_ASSESSMENTS SCHEMA FIX COMPLETED';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Changes Applied:';
    RAISE NOTICE '1. Column: user_id → patient_id (if needed)';
    RAISE NOTICE '2. Foreign Key: references patients(id)';
    RAISE NOTICE '3. All required columns added';
    RAISE NOTICE '4. Performance indexes created';
    RAISE NOTICE '5. Auto-update trigger installed';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Step: Apply RLS policies';
    RAISE NOTICE '========================================';
END $$;
