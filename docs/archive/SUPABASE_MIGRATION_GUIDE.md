# Supabase Migration Guide
## Migrating from Azure MySQL to Supabase

**Date**: October 6, 2025
**Status**: 🚀 Ready to Begin
**Estimated Time**: 4-8 hours
**Priority**: HIGH (Security Fix)

---

## Why Migrate to Supabase?

### Critical Security Issues Fixed:
- ❌ **BEFORE**: Database password `TshlaSecure2025!` exposed in code
- ❌ **BEFORE**: Admin credentials displayed in frontend (`LoginHIPAA.tsx`)
- ❌ **BEFORE**: Manual password hashing and session management
- ❌ **BEFORE**: IP firewall restrictions causing connection issues

- ✅ **AFTER**: No database passwords needed (uses API keys)
- ✅ **AFTER**: Built-in authentication system
- ✅ **AFTER**: Automatic JWT token management
- ✅ **AFTER**: No firewall issues, works from anywhere

---

## Step 1: Create Supabase Project (15 min)

### A. Sign up for Supabase
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub/Google/Email

### B. Create New Project
1. Click "New Project"
2. **Project Name**: `tshla-medical-prod`
3. **Database Password**: Generate a strong password (you'll barely use this)
4. **Region**: Choose closest to your users (East US recommended)
5. **Pricing Plan**: Free tier (sufficient for now)
6. Click "Create new project" (takes ~2 minutes)

### C. Get Your Credentials
Once project is created:

1. Go to **Settings** → **API**
2. Copy these values:

```bash
Project URL: https://xxxxx.supabase.co
anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (KEEP SECRET)
```

3. Add to your `.env` file:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (server only)
```

⚠️ **IMPORTANT**:
- The `anon` key is PUBLIC (safe to expose in frontend)
- The `service_role` key is PRIVATE (never expose, server-side only)

---

## Step 2: Create Database Schema (30 min)

### A. Open SQL Editor
1. In Supabase dashboard, click **SQL Editor**
2. Click "New query"
3. Name it: `01-create-auth-tables`

### B. Run This SQL:

```sql
-- =============================================
-- TSHLA Medical Authentication Tables
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

  -- Auth (Supabase Auth handles passwords, but keep this for reference)
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

-- Index for performance
CREATE INDEX idx_medical_staff_email ON public.medical_staff(email);
CREATE INDEX idx_medical_staff_auth_user ON public.medical_staff(auth_user_id);
CREATE INDEX idx_medical_staff_role ON public.medical_staff(role);

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
CREATE INDEX idx_pump_users_email ON public.pump_users(email);
CREATE INDEX idx_pump_users_auth_user ON public.pump_users(auth_user_id);
CREATE INDEX idx_pump_users_admin ON public.pump_users(is_admin) WHERE is_admin = true;

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
CREATE INDEX idx_access_logs_user ON public.access_logs(user_id, created_at DESC);
CREATE INDEX idx_access_logs_action ON public.access_logs(action, created_at DESC);
CREATE INDEX idx_access_logs_created ON public.access_logs(created_at DESC);

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
```

4. Click "Run" to execute
5. Verify tables created: Go to **Table Editor**, you should see:
   - `medical_staff`
   - `pump_users`
   - `access_logs`

---

## Step 3: Export Existing Users from Azure MySQL (1 hour)

### Option A: Manual Export (if database accessible)

Run this on your local machine:

```bash
# Export medical_staff users
mysql -h tshla-mysql-prod.mysql.database.azure.com \
  -u tshlaadmin \
  -p'TshlaSecure2025!' \
  -D tshla_medical \
  -e "SELECT * FROM medical_staff" > medical_staff_export.csv

# Export pump_users
mysql -h tshla-mysql-prod.mysql.database.azure.com \
  -u tshlaadmin \
  -p'TshlaSecure2025!' \
  -D tshla_medical \
  -e "SELECT * FROM pump_users" > pump_users_export.csv
```

### Option B: Use Azure Cloud Shell (if firewall blocks you)

See the script: `scripts/export-azure-users.sh` (will create next)

---

## Step 4: Create Admin Accounts in Supabase (30 min)

Since Supabase Auth handles passwords differently, we need to create new accounts.

### A. Create Admin via Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Click "Add user"
3. **Email**: `admin@tshla.ai`
4. **Password**: Choose a NEW secure password (not the old one!)
5. **Auto Confirm Email**: ✅ (check this)
6. Click "Create user"
7. **Copy the User ID** (looks like: `a1b2c3d4-1234-...`)

### B. Link to medical_staff table

Go to **SQL Editor**, run:

```sql
INSERT INTO public.medical_staff (
  email,
  username,
  first_name,
  last_name,
  role,
  auth_user_id,
  is_active,
  is_verified
) VALUES (
  'admin@tshla.ai',
  'admin',
  'System',
  'Administrator',
  'admin',
  'PASTE-USER-ID-HERE', -- Replace with actual UUID from step A
  true,
  true
);
```

### C. Repeat for rakesh@tshla.ai

1. Create user in **Authentication** → **Users**
2. Email: `rakesh@tshla.ai`
3. Password: Choose new secure password
4. Copy User ID
5. Run SQL:

```sql
INSERT INTO public.medical_staff (
  email,
  username,
  first_name,
  last_name,
  role,
  auth_user_id,
  is_active,
  is_verified
) VALUES (
  'rakesh@tshla.ai',
  'rakesh',
  'Rakesh',
  'Patel',
  'admin',
  'PASTE-USER-ID-HERE',
  true,
  true
);
```

---

## Step 5: Update Application Code (2-3 hours)

I'll create updated service files in the next steps.

---

## Step 6: Testing Checklist

After code changes, test:

- [ ] Medical staff login with email/password
- [ ] PumpDrive user login
- [ ] Access code login (DOCTOR-2025, etc.)
- [ ] Patient login (AVA ID)
- [ ] Password reset flow
- [ ] Session expiration
- [ ] Admin-only features work
- [ ] Audit logs are created

---

## Step 7: Cleanup After Migration

Once everything works:

1. Remove Azure MySQL credentials from all files
2. Update `.env.example` with Supabase vars only
3. Remove hardcoded passwords from documentation
4. Decommission Azure MySQL (save $$$)

---

## Security Best Practices

### ✅ DO:
- Use environment variables for Supabase keys
- Enable Row Level Security on all tables
- Log all authentication attempts
- Use Supabase Auth for password management
- Enable email verification for new users

### ❌ DON'T:
- Hardcode Supabase service_role key in frontend
- Disable Row Level Security
- Store passwords in plain text
- Expose user data without proper policies

---

## Rollback Plan

If something goes wrong:

1. Keep Azure MySQL running during migration
2. Test Supabase auth in dev environment first
3. Have a feature flag to switch between backends
4. Keep database export backups

---

## Cost Comparison

**Azure MySQL Flexible Server:**
- ~$50-100/month minimum
- Additional costs for backups, firewall rules, etc.

**Supabase Free Tier:**
- $0/month for:
  - 500MB database
  - 50,000 monthly active users
  - Unlimited API requests
  - Built-in auth, storage, real-time

**Supabase Pro** (if you outgrow free):
- $25/month for:
  - 8GB database
  - 100,000 monthly active users
  - Daily backups
  - Email support

💰 **Savings**: ~$50-75/month minimum

---

## Next Steps

1. ✅ Create Supabase project
2. ✅ Run schema SQL
3. ✅ Create admin accounts
4. 📝 Update application code (next section)
5. 🧪 Test thoroughly
6. 🚀 Deploy
7. 🗑️ Cleanup old Azure resources

---

**Questions? Issues?**
- Supabase Docs: https://supabase.com/docs
- Support: https://supabase.com/dashboard/support

**Created**: October 6, 2025
**Last Updated**: October 6, 2025
