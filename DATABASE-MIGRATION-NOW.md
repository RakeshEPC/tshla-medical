# 🚨 DATABASE MIGRATION - EXECUTE NOW

## ⚠️ MANUAL STEP REQUIRED

You need to run this in **Supabase SQL Editor** (I cannot execute SQL directly).

### **Step 1: Open Supabase Dashboard**
1. Go to https://supabase.com
2. Open your tshla-medical project
3. Click "SQL Editor" in left sidebar

### **Step 2: Run Migration Script**

Copy and paste the entire contents of this file:
```
scripts/database/reorganization/SIMPLE-START-FRESH.sql
```

Or run this SQL directly:

```sql
-- =====================================================
-- TSHLA Medical - Start Fresh (Drop pump_users)
-- =====================================================

-- Step 1: Clear old pump assessments
DELETE FROM pump_assessments WHERE user_id IS NOT NULL;

-- Step 2: Drop pump_users table
DROP TABLE IF EXISTS pump_users CASCADE;

-- Step 3: Update pump_assessments schema
ALTER TABLE pump_assessments DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE pump_assessments
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE;

-- Step 4: Add PumpDrive fields to patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS pumpdrive_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pumpdrive_signup_date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS pumpdrive_last_assessment TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessments_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

COMMENT ON COLUMN patients.pumpdrive_enabled IS 'Whether patient has access to PumpDrive';
COMMENT ON COLUMN patients.assessments_completed IS 'Total pump assessments completed';

-- Step 5: Update RLS policies
DROP POLICY IF EXISTS "Pump users can view own profile" ON pump_users;
DROP POLICY IF EXISTS "Users can view own assessments" ON pump_assessments;
DROP POLICY IF EXISTS "Users can create own assessments" ON pump_assessments;

CREATE POLICY "Patients can view own pump assessments"
  ON pump_assessments FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can create own pump assessments"
  ON pump_assessments FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can view own profile"
  ON patients FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Patients can update own profile"
  ON patients FOR UPDATE
  USING (auth_user_id = auth.uid());

CREATE POLICY "Staff can view all patients"
  ON patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- Step 6: Add indexes
CREATE INDEX IF NOT EXISTS idx_patients_auth_user ON patients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_patients_pumpdrive ON patients(pumpdrive_enabled) WHERE pumpdrive_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_pump_assessments_patient ON pump_assessments(patient_id);

-- Verification
SELECT 'Migration Complete!' as status;
```

### **Step 3: Verify Success**

After running, verify with:

```sql
-- Check 1: pump_users should NOT exist
SELECT table_name FROM information_schema.tables WHERE table_name = 'pump_users';
-- Expected: 0 rows

-- Check 2: patients has new fields
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patients' AND column_name LIKE '%pumpdrive%';
-- Expected: pumpdrive_enabled, pumpdrive_signup_date, etc.

-- Check 3: pump_assessments uses patient_id
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pump_assessments' AND column_name = 'patient_id';
-- Expected: patient_id

-- Check 4: user_id column should NOT exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pump_assessments' AND column_name = 'user_id';
-- Expected: 0 rows
```

### ✅ When Complete

Reply back "Database migration complete" and I'll continue with the code updates.

---

**⏰ This should take 2-3 minutes**
