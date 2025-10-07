-- Nuclear option: Recreate pump_users table completely
-- Run this in Supabase SQL Editor

-- Step 1: Drop the problematic table (this will also drop all policies)
DROP TABLE IF EXISTS public.pump_users CASCADE;

-- Step 2: Recreate the table
CREATE TABLE public.pump_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100),

  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  date_of_birth DATE,

  -- Auth
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Payment & Access
  current_payment_status VARCHAR(50) DEFAULT 'trial',
  subscription_tier VARCHAR(50) DEFAULT 'basic',
  trial_end_date TIMESTAMPTZ,
  is_admin BOOLEAN DEFAULT false,

  -- Usage tracking
  assessments_completed INTEGER DEFAULT 0,
  last_assessment_date TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0
);

-- Step 3: Create indexes
CREATE INDEX idx_pump_users_email ON public.pump_users(email);
CREATE INDEX idx_pump_users_auth_user ON public.pump_users(auth_user_id);
CREATE INDEX idx_pump_users_admin ON public.pump_users(is_admin) WHERE is_admin = true;

-- Step 4: Create trigger for updated_at
CREATE TRIGGER update_pump_users_updated_at BEFORE UPDATE ON public.pump_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Enable RLS
ALTER TABLE public.pump_users ENABLE ROW LEVEL SECURITY;

-- Step 6: Create SIMPLE policies (no recursion)

-- Users can see their own profile ONLY
CREATE POLICY "pump_users_own_select"
  ON public.pump_users FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Users can update their own profile ONLY
CREATE POLICY "pump_users_own_update"
  ON public.pump_users FOR UPDATE
  USING (auth.uid() = auth_user_id);

-- Service role (server-side) has full access
CREATE POLICY "pump_users_service_all"
  ON public.pump_users FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Step 7: Grant permissions
GRANT ALL ON public.pump_users TO anon, authenticated;

-- Done!
SELECT 'Pump users table recreated successfully!' as status;
