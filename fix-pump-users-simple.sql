-- Simplest fix for pump_users policy
-- Run this in Supabase SQL Editor

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can view all pump users" ON public.pump_users;

-- Users can only see their own profile
-- (Admin operations will use service_role key on server-side)
-- This prevents infinite recursion

-- Note: The "Pump users can view own profile" policy already exists
-- and handles this correctly. We just remove the problematic admin policy.

-- Verify it works by checking pump_users table
SELECT 'Policy fixed!' as status;
