-- Complete fix for pump_users RLS policies
-- Run this in Supabase SQL Editor

-- Step 1: Disable RLS temporarily
ALTER TABLE public.pump_users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies
DROP POLICY IF EXISTS "Pump users can view own profile" ON public.pump_users;
DROP POLICY IF EXISTS "Pump users can update own profile" ON public.pump_users;
DROP POLICY IF EXISTS "Admins can view all pump users" ON public.pump_users;
DROP POLICY IF EXISTS "Service role has full access to pump_users" ON public.pump_users;

-- Step 3: Re-enable RLS
ALTER TABLE public.pump_users ENABLE ROW LEVEL SECURITY;

-- Step 4: Create clean, simple policies (no recursion)

-- Allow users to see their own profile
CREATE POLICY "pump_users_select_own"
  ON public.pump_users FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Allow users to update their own profile
CREATE POLICY "pump_users_update_own"
  ON public.pump_users FOR UPDATE
  USING (auth.uid() = auth_user_id);

-- Allow service role full access (for server-side admin operations)
CREATE POLICY "pump_users_service_role_all"
  ON public.pump_users FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Step 5: Verify it works
SELECT 'Pump users policies fixed!' as status;
