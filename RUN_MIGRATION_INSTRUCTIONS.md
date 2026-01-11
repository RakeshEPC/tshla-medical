# Database Migration Instructions

## Step 1: Open Supabase SQL Editor

1. Go to: **https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new**
2. Make sure you're logged in to your Supabase account

## Step 2: Copy and Paste the Migration SQL

Copy the **ENTIRE contents** of the file:
```
database/migrations/013_access_gate_tracking.sql
```

Or use the command below to view it:
```bash
cat database/migrations/013_access_gate_tracking.sql
```

## Step 3: Run the Migration

1. Paste the SQL into the Supabase SQL Editor
2. Click the **"Run"** button (or press Cmd/Ctrl + Enter)
3. Wait for confirmation message: **"Success. No rows returned"**

## Step 4: Verify Migration Success

Run this query in the SQL Editor to verify the new columns exist:

```sql
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'pump_assessments'
  AND column_name IN ('access_type', 'clinic_name', 'access_granted_at')
ORDER BY column_name;
```

**Expected result:** You should see 3 rows showing the new columns.

## Step 5: Test the Helper Functions

Test that the functions were created successfully:

```sql
-- Test the analytics function (should return 0 results if no data yet)
SELECT * FROM get_access_statistics('2026-01-01', '2026-12-31');
```

**Expected result:** A single row with all counts showing 0 (if no assessments exist yet).

---

## Quick Copy-Paste Version

If you prefer, here's the migration in a single copy-paste block:

<details>
<summary>Click to expand full SQL</summary>

```sql
-- =====================================================
-- Access Gate Tracking for Pump Selector
-- =====================================================

-- Add access tracking columns
ALTER TABLE public.pump_assessments
ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS clinic_name TEXT,
ADD COLUMN IF NOT EXISTS access_granted_at TIMESTAMPTZ;

-- Add constraint
ALTER TABLE public.pump_assessments
DROP CONSTRAINT IF EXISTS valid_access_type;

ALTER TABLE public.pump_assessments
ADD CONSTRAINT valid_access_type
CHECK (access_type IN ('pending', 'clinic', 'independent'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pump_assessments_access_type
  ON public.pump_assessments(access_type);

CREATE INDEX IF NOT EXISTS idx_pump_assessments_clinic_name
  ON public.pump_assessments(clinic_name)
  WHERE clinic_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pump_assessments_access_granted
  ON public.pump_assessments(access_granted_at DESC)
  WHERE access_granted_at IS NOT NULL;

-- Create grant access function
CREATE OR REPLACE FUNCTION public.grant_assessment_access(
  p_assessment_id UUID,
  p_access_type TEXT,
  p_clinic_name TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_access_type NOT IN ('clinic', 'independent') THEN
    RAISE EXCEPTION 'Invalid access type: %', p_access_type;
  END IF;

  UPDATE public.pump_assessments
  SET
    access_type = p_access_type,
    clinic_name = p_clinic_name,
    access_granted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_assessment_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create access check function
CREATE OR REPLACE FUNCTION public.has_assessment_access(p_assessment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_access_type TEXT;
  v_payment_status TEXT;
BEGIN
  SELECT access_type, payment_status
  INTO v_access_type, v_payment_status
  FROM public.pump_assessments
  WHERE id = p_assessment_id;

  IF v_access_type = 'clinic' THEN
    RETURN TRUE;
  END IF;

  IF v_access_type = 'independent' AND v_payment_status = 'paid' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create analytics function
CREATE OR REPLACE FUNCTION public.get_access_statistics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_assessments BIGINT,
  clinic_access BIGINT,
  paid_access BIGINT,
  pending_access BIGINT,
  clinic_percentage NUMERIC,
  paid_percentage NUMERIC,
  epc_clinic_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_assessments,
    COUNT(*) FILTER (WHERE access_type = 'clinic')::BIGINT as clinic_access,
    COUNT(*) FILTER (WHERE access_type = 'independent' AND payment_status = 'paid')::BIGINT as paid_access,
    COUNT(*) FILTER (WHERE access_type = 'pending')::BIGINT as pending_access,
    ROUND(
      (COUNT(*) FILTER (WHERE access_type = 'clinic')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as clinic_percentage,
    ROUND(
      (COUNT(*) FILTER (WHERE access_type = 'independent' AND payment_status = 'paid')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as paid_percentage,
    COUNT(*) FILTER (WHERE clinic_name = 'Endocrine & Psychiatry Center')::BIGINT as epc_clinic_count
  FROM public.pump_assessments
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.grant_assessment_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_assessment_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_access_statistics TO authenticated;

-- Add comments
COMMENT ON COLUMN public.pump_assessments.access_type IS 'How user accessed tool: pending (not selected), clinic (free via EPC), independent (paid)';
COMMENT ON COLUMN public.pump_assessments.clinic_name IS 'Name of participating clinic if access_type = clinic';
COMMENT ON COLUMN public.pump_assessments.access_granted_at IS 'Timestamp when access was granted (clinic selected or payment completed)';
```

</details>

---

## Troubleshooting

### Error: "permission denied for table pump_assessments"
- Make sure you're logged in as the Supabase project owner
- Try running from the Supabase dashboard SQL Editor (not psql)

### Error: "column already exists"
- This is OK! The migration uses `IF NOT EXISTS` to be idempotent
- You can safely ignore this error

### Error: "function already exists"
- This is OK! The migration uses `CREATE OR REPLACE FUNCTION`
- The functions will be updated to the latest version

---

## After Migration is Complete

You can proceed with testing the new access gate flow:

1. Start the dev server: `npm run dev`
2. Visit `http://localhost:5173/`
3. Follow the testing checklist in `PUMPDRIVE_ACCESS_GATE_IMPLEMENTATION.md`

---

**Need Help?** Check the full implementation guide: `PUMPDRIVE_ACCESS_GATE_IMPLEMENTATION.md`
