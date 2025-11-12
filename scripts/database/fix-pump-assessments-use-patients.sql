-- =====================================================
-- FIX: Update pump_assessments to use patients table
-- instead of deprecated pump_users table
-- Run in Supabase SQL Editor
-- Date: 2025-11-11
-- =====================================================

-- Step 1: Drop existing foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pump_assessments_user_id_fkey'
    AND table_name = 'pump_assessments'
  ) THEN
    ALTER TABLE public.pump_assessments
      DROP CONSTRAINT pump_assessments_user_id_fkey;
    RAISE NOTICE 'Dropped old foreign key constraint';
  END IF;
END $$;

-- Step 2: Add new foreign key to patients table
ALTER TABLE public.pump_assessments
  ADD CONSTRAINT pump_assessments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.patients(id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT pump_assessments_user_id_fkey
  ON public.pump_assessments
  IS 'Links pump assessments to unified patients table (includes PumpDrive users)';

-- Step 3: Drop old RLS policies that reference pump_users
DROP POLICY IF EXISTS "Users can view own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Users can create own assessments" ON public.pump_assessments;
DROP POLICY IF EXISTS "Admins can view all assessments" ON public.pump_assessments;

-- Step 4: Create new RLS policies using patients table
-- Users can view their own assessments
CREATE POLICY "Users can view own assessments"
  ON public.pump_assessments FOR SELECT
  USING (
    auth.uid() = (
      SELECT auth_user_id FROM public.patients
      WHERE id = pump_assessments.user_id
    )
  );

-- Users can insert their own assessments
CREATE POLICY "Users can create own assessments"
  ON public.pump_assessments FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT auth_user_id FROM public.patients
      WHERE id = pump_assessments.user_id
    )
  );

-- Admins can view all assessments (check medical_staff table for admin role)
CREATE POLICY "Admins can view all assessments"
  ON public.pump_assessments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Step 5: Verify the fix
DO $$
DECLARE
  fk_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Check foreign key
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE constraint_name = 'pump_assessments_user_id_fkey'
    AND table_name = 'pump_assessments';

  -- Check policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'pump_assessments';

  RAISE NOTICE '✅ Foreign key constraint exists: %', (fk_count > 0);
  RAISE NOTICE '✅ RLS policies created: % policies', policy_count;

  IF fk_count > 0 AND policy_count >= 3 THEN
    RAISE NOTICE '✅ SUCCESS: pump_assessments now correctly references patients table';
  ELSE
    RAISE WARNING '⚠️ WARNING: Migration may be incomplete. FK: %, Policies: %', fk_count, policy_count;
  END IF;
END $$;

-- =====================================================
-- Expected Output:
-- ✅ Foreign key constraint exists: true
-- ✅ RLS policies created: 4 policies (including service_role)
-- ✅ SUCCESS: pump_assessments now correctly references patients table
-- =====================================================
