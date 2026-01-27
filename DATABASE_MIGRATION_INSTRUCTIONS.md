# 🔧 Database Migration Required - Medication Refill System

## ⚠️ IMPORTANT: Run This Migration Now

The medication refill system requires new database fields. The system is deployed but **won't work until you run this migration**.

---

## 📋 Quick Start (5 minutes)

### **Step 1: Open Supabase SQL Editor**

Go to: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new

### **Step 2: Copy the SQL**

Open this file on your computer:
```
/Users/rakeshpatel/Desktop/tshla-medical/database/migrations/add-pharmacy-and-refill-fields.sql
```

Or copy from here:

```sql
-- Add pharmacy information and refill duration fields to patient_medications
-- This enables staff to track refill requests, durations, and pharmacy details
-- Created: 2026-01-26

-- Add pharmacy information fields to unified_patients table (patient's preferred pharmacy)
ALTER TABLE unified_patients
ADD COLUMN IF NOT EXISTS preferred_pharmacy_name TEXT,
ADD COLUMN IF NOT EXISTS preferred_pharmacy_phone TEXT,
ADD COLUMN IF NOT EXISTS preferred_pharmacy_address TEXT,
ADD COLUMN IF NOT EXISTS preferred_pharmacy_fax TEXT;

-- Add refill duration and tracking fields to patient_medications table
ALTER TABLE patient_medications
ADD COLUMN IF NOT EXISTS refill_duration_days INTEGER, -- 30, 60, or 90 days
ADD COLUMN IF NOT EXISTS refill_quantity TEXT, -- e.g., "30 tablets", "90 day supply"
ADD COLUMN IF NOT EXISTS last_refill_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_refill_due_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refill_count INTEGER DEFAULT 0, -- Track number of refills processed
ADD COLUMN IF NOT EXISTS refill_notes TEXT, -- Staff notes about refill processing
ADD COLUMN IF NOT EXISTS sent_to_pharmacy_confirmation TEXT; -- Confirmation number/reference

-- Create index for refill due date queries
CREATE INDEX IF NOT EXISTS idx_patient_medications_refill_due
  ON patient_medications(next_refill_due_date)
  WHERE send_to_pharmacy = TRUE;

-- Create index for pending pharmacy requests
CREATE INDEX IF NOT EXISTS idx_patient_medications_pharmacy_pending
  ON patient_medications(send_to_pharmacy, sent_to_pharmacy_at)
  WHERE send_to_pharmacy = TRUE;

-- Comment on new columns
COMMENT ON COLUMN patient_medications.refill_duration_days IS 'Duration of refill in days: 30, 60, or 90';
COMMENT ON COLUMN patient_medications.refill_quantity IS 'Quantity description like "30 tablets" or "90 day supply"';
COMMENT ON COLUMN patient_medications.last_refill_date IS 'Date when medication was last refilled';
COMMENT ON COLUMN patient_medications.next_refill_due_date IS 'Calculated date when next refill is due';
COMMENT ON COLUMN patient_medications.refill_count IS 'Total number of times this medication has been refilled';
COMMENT ON COLUMN patient_medications.refill_notes IS 'Staff notes about refill processing and history';
COMMENT ON COLUMN patient_medications.sent_to_pharmacy_confirmation IS 'Pharmacy confirmation number or reference';

COMMENT ON COLUMN unified_patients.preferred_pharmacy_name IS 'Patient preferred pharmacy name';
COMMENT ON COLUMN unified_patients.preferred_pharmacy_phone IS 'Patient preferred pharmacy phone number';
COMMENT ON COLUMN unified_patients.preferred_pharmacy_address IS 'Patient preferred pharmacy address';
COMMENT ON COLUMN unified_patients.preferred_pharmacy_fax IS 'Patient preferred pharmacy fax number';

-- Function to automatically calculate next refill due date
CREATE OR REPLACE FUNCTION calculate_next_refill_date()
RETURNS TRIGGER AS $$
BEGIN
  -- When last_refill_date or refill_duration_days is set, calculate next due date
  IF NEW.last_refill_date IS NOT NULL AND NEW.refill_duration_days IS NOT NULL THEN
    NEW.next_refill_due_date := NEW.last_refill_date + (NEW.refill_duration_days || ' days')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate next refill date
DROP TRIGGER IF EXISTS calculate_refill_date_trigger ON patient_medications;
CREATE TRIGGER calculate_refill_date_trigger
  BEFORE INSERT OR UPDATE OF last_refill_date, refill_duration_days
  ON patient_medications
  FOR EACH ROW
  EXECUTE FUNCTION calculate_next_refill_date();
```

### **Step 3: Paste and Run**

1. Paste the entire SQL into the Supabase SQL Editor
2. Click the green "Run" button
3. Wait for "Success. No rows returned"

### **Step 4: Verify**

Run this query to confirm fields were added:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'patient_medications'
  AND column_name LIKE '%refill%';
```

You should see:
- refill_duration_days
- refill_quantity
- last_refill_date
- next_refill_due_date
- refill_count
- refill_notes

---

## ✅ After Migration

Once completed:

1. **Refresh the Med Refills page** - https://www.tshla.ai/staff/medication-refills
2. **Should show** "No Pending Refills" message (instead of error)
3. **Test**: Have a patient add pharmacy info in their portal
4. **Test**: Have a patient mark a medication for refill
5. **Verify**: Staff can see and process the refill

---

## 🔍 Troubleshooting

### "Permission denied" error
You need admin access to the Supabase project. Contact the project owner.

### "Column already exists" warning
That's OK! The migration uses `IF NOT EXISTS` so it's safe to run multiple times.

### Migration runs but page still errors
1. Check browser console for errors
2. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)
3. Check if the refill queue API endpoint returns data:
   ```
   curl https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/patient-portal/medications/refill-queue
   ```

---

## 📊 What This Adds

### To `unified_patients` table:
- `preferred_pharmacy_name` - CVS Pharmacy
- `preferred_pharmacy_phone` - (555) 123-4567
- `preferred_pharmacy_address` - 123 Main St, Houston, TX
- `preferred_pharmacy_fax` - (555) 123-4568

### To `patient_medications` table:
- `refill_duration_days` - 30, 60, or 90
- `refill_quantity` - "30 tablets", "90 day supply"
- `last_refill_date` - When last refilled
- `next_refill_due_date` - Auto-calculated
- `refill_count` - Running total
- `refill_notes` - Staff notes
- `sent_to_pharmacy_confirmation` - Confirmation #

### Indexes for Performance:
- `idx_patient_medications_refill_due` - Query upcoming refills
- `idx_patient_medications_pharmacy_pending` - Query pending requests

### Automatic Trigger:
- Calculates `next_refill_due_date` when `last_refill_date` + `refill_duration_days` are set

---

## 📞 Need Help?

If you encounter issues:
1. Check the error message carefully
2. Verify you have Supabase admin access
3. Try running each ALTER TABLE statement individually
4. Check the Supabase logs for detailed errors

---

**Status:** ⚠️ Migration Required - System Won't Work Until Complete
**Priority:** High - Required for Med Refills feature to function
**Time Required:** ~5 minutes
