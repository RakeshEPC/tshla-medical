-- ============================================
-- APPLY THIS SQL IN SUPABASE DASHBOARD
-- Replaces temporary RLS policy with permanent one
-- ============================================
-- CORRECTED: Uses auth_user_id (not supabase_auth_user_id)
-- ============================================

-- Step 1: Remove temporary and old policies
DROP POLICY IF EXISTS "Authenticated users can view all dictated notes" ON dictated_notes;
DROP POLICY IF EXISTS "Providers can view their own notes" ON dictated_notes;
DROP POLICY IF EXISTS "Providers can create their own notes" ON dictated_notes;
DROP POLICY IF EXISTS "Providers can update their own notes" ON dictated_notes;

-- Step 2: Create proper SELECT policy
CREATE POLICY "Providers can view dictated notes based on medical_staff"
ON dictated_notes
FOR SELECT
TO authenticated
USING (
  provider_id IN (
    SELECT id::text
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Step 3: Create proper INSERT policy
CREATE POLICY "Providers can insert dictated notes"
ON dictated_notes
FOR INSERT
TO authenticated
WITH CHECK (
  provider_id IN (
    SELECT id::text
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
);

-- Step 4: Create proper UPDATE policy
CREATE POLICY "Providers can update their dictated notes"
ON dictated_notes
FOR UPDATE
TO authenticated
USING (
  provider_id IN (
    SELECT id::text
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
  AND status NOT IN ('signed', 'final')
)
WITH CHECK (
  provider_id IN (
    SELECT id::text
    FROM medical_staff
    WHERE auth_user_id = auth.uid()
  )
);

-- Step 5: Verify policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'dictated_notes'
ORDER BY policyname;

-- ============================================
-- EXPECTED OUTPUT:
-- Should show 3 policies:
-- 1. "Providers can insert dictated notes" (INSERT)
-- 2. "Providers can update their dictated notes" (UPDATE)
-- 3. "Providers can view dictated notes based on medical_staff" (SELECT)
-- ============================================
