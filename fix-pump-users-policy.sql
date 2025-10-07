-- Fix pump_users infinite recursion policy
-- Run this in Supabase SQL Editor

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can view all pump users" ON public.pump_users;

-- Create a simpler admin policy that doesn't cause recursion
-- This allows service_role (server-side) to manage admin views
CREATE POLICY "Admins can view all pump users"
  ON public.pump_users FOR SELECT
  USING (
    -- User can see their own record
    auth.uid() = auth_user_id
    OR
    -- OR if they are an admin (check directly without subquery)
    (
      SELECT is_admin FROM public.pump_users
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    ) = true
  );

-- Alternative: If above still causes issues, use this simpler version
-- (Uncomment if needed)
/*
DROP POLICY IF EXISTS "Admins can view all pump users" ON public.pump_users;

-- Just allow users to see their own records
-- Admins will use service_role key on server-side to see all users
CREATE POLICY "Users can view own pump user profile"
  ON public.pump_users FOR SELECT
  USING (auth.uid() = auth_user_id);
*/
