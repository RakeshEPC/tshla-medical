#!/bin/bash

# TSHLA Medical - Run Database Cleanup
# This runs the SQL directly from command line

echo "🔄 Starting database cleanup..."

# Supabase connection string
DB_URL="postgresql://postgres.minvvjdflezibmgkplqb:TshlaSecure2025!@db.minvvjdflezibmgkplqb.supabase.co:5432/postgres"

# Run the cleanup SQL
psql "$DB_URL" <<EOF

-- Step 1: Clear old assessments
DELETE FROM pump_assessments WHERE user_id IS NOT NULL;

-- Step 2: Drop pump_users table
DROP TABLE IF EXISTS pump_users CASCADE;

-- Step 3: Update pump_assessments schema
ALTER TABLE pump_assessments DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE pump_assessments ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE;

-- Step 4: Add PumpDrive fields to patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS pumpdrive_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pumpdrive_signup_date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS assessments_completed INTEGER DEFAULT 0;

-- Success!
SELECT 'SUCCESS! Database cleaned up' as status;

EOF

echo "✅ Database cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Update backend code (pump-report-api.js)"
echo "2. Update frontend auth to use patients table"
echo "3. Test patient registration"
