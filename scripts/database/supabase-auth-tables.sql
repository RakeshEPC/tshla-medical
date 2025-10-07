-- =============================================
-- TSHLA Medical Authentication Tables for Supabase
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 1. MEDICAL STAFF TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.medical_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,

  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL DEFAULT 'doctor',
  specialty VARCHAR(100),
  practice VARCHAR(255),
  phone VARCHAR(20),

  -- Auth (Supabase Auth handles passwords)
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  require_password_change BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,

  -- Audit
  created_by VARCHAR(100),
  updated_by VARCHAR(100)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_medical_staff_email ON public.medical_staff(email);
CREATE INDEX IF NOT EXISTS idx_medical_staff_auth_user ON public.medical_staff(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_medical_staff_role ON public.medical_staff(role);

-- =============================================
-- 2. PUMP USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.pump_users (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pump_users_email ON public.pump_users(email);
CREATE INDEX IF NOT EXISTS idx_pump_users_auth_user ON public.pump_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_pump_users_admin ON public.pump_users(is_admin) WHERE is_admin = true;

-- =============================================
-- 3. ACCESS LOGS TABLE (HIPAA Audit)
-- =============================================
CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_email VARCHAR(255),
  user_type VARCHAR(50), -- 'medical_staff', 'pump_user', 'patient'

  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),

  ip_address INET,
  user_agent TEXT,

  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON public.access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON public.access_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON public.access_logs(created_at DESC);

-- =============================================
-- 4. AUTO-UPDATE TIMESTAMPS
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_medical_staff_updated_at ON public.medical_staff;
DROP TRIGGER IF EXISTS update_pump_users_updated_at ON public.pump_users;

-- Create triggers
CREATE TRIGGER update_medical_staff_updated_at BEFORE UPDATE ON public.medical_staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pump_users_updated_at BEFORE UPDATE ON public.pump_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE public.medical_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pump_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Medical staff can view own profile" ON public.medical_staff;
DROP POLICY IF EXISTS "Medical staff can update own profile" ON public.medical_staff;
DROP POLICY IF EXISTS "Service role has full access to medical_staff" ON public.medical_staff;

DROP POLICY IF EXISTS "Pump users can view own profile" ON public.pump_users;
DROP POLICY IF EXISTS "Pump users can update own profile" ON public.pump_users;
DROP POLICY IF EXISTS "Admins can view all pump users" ON public.pump_users;
DROP POLICY IF EXISTS "Service role has full access to pump_users" ON public.pump_users;

DROP POLICY IF EXISTS "Users can view own access logs" ON public.access_logs;
DROP POLICY IF EXISTS "Service role has full access to access_logs" ON public.access_logs;

-- Medical Staff Policies
CREATE POLICY "Medical staff can view own profile"
  ON public.medical_staff FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Medical staff can update own profile"
  ON public.medical_staff FOR UPDATE
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Service role has full access to medical_staff"
  ON public.medical_staff FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Pump Users Policies
CREATE POLICY "Pump users can view own profile"
  ON public.pump_users FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Pump users can update own profile"
  ON public.pump_users FOR UPDATE
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all pump users"
  ON public.pump_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pump_users
      WHERE auth_user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Service role has full access to pump_users"
  ON public.pump_users FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Access Logs Policies
CREATE POLICY "Users can view own access logs"
  ON public.access_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role has full access to access_logs"
  ON public.access_logs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.medical_staff TO anon, authenticated;
GRANT ALL ON public.pump_users TO anon, authenticated;
GRANT ALL ON public.access_logs TO anon, authenticated;

-- =============================================
-- SUCCESS!
-- =============================================
-- Tables created successfully!
-- Next steps:
-- 1. Go to Authentication → Users in Supabase Dashboard
-- 2. Create your first admin user
-- 3. Link the user to medical_staff table
-- =============================================
