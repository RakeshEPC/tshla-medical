# Quick Fix: Pump Assessments Not Saving

## 🚀 3-Minute Fix

### Step 1: Fix Database (2 minutes)

1. Open Supabase: https://supabase.com/dashboard
2. Go to **SQL Editor**
3. Copy entire contents of: `scripts/database/fix-pump-assessments-save.sql`
4. Paste into SQL Editor
5. Click **RUN** ▶️
6. Wait for "SUCCESS!" message

### Step 2: Verify Fix (30 seconds)

In same SQL Editor:

```sql
-- Quick check
SELECT COUNT(*) FROM pump_assessments;

-- Check RLS policies
SELECT policyname FROM pg_policies WHERE tablename = 'pump_assessments';
```

You should see at least 3 policies:
- ✅ `Patients can insert own assessments`
- ✅ `Patients can view own assessments`
- ✅ `Staff can view all assessments`

### Step 3: Test (30 seconds)

1. Open your app in **incognito/private window**
2. Create new test account
3. Complete pump assessment
4. Open browser console (F12)
5. Look for: **✅ Assessment saved successfully!**

---

## 🔍 If It Still Doesn't Work

Run this in Supabase SQL Editor:

```sql
-- Verify current user has patient record
SELECT id, email, pumpdrive_enabled
FROM patients
WHERE email = 'YOUR_TEST_EMAIL@example.com';
```

If no results: User registration didn't complete properly.
**Fix:** Create account again.

---

## 📊 Check Browser Console

**Good (Working):**
```
✅ [PumpAssessment] Assessment saved successfully!
```

**Bad (Broken):**
```
❌ [PumpAssessment] Database insert failed!
```

---

## 🎯 What This Fixes

- ✅ Creates proper database table structure
- ✅ Sets up Row Level Security (RLS) policies
- ✅ Grants permissions to save assessments
- ✅ Adds detailed error logging

---

## 📁 Files Changed

1. **src/services/pumpAssessment.service.ts** - Better error handling
2. **scripts/database/fix-pump-assessments-save.sql** - Database fix (RUN THIS!)
3. **scripts/database/verify-pump-assessments.sql** - Verification script

---

## 🆘 Still Having Issues?

See detailed guide: `PUMP-ASSESSMENTS-FIX-GUIDE.md`

## ✅ Success Checklist

- [ ] SQL script ran without errors
- [ ] At least 3 RLS policies exist
- [ ] Browser console shows "Assessment saved successfully"
- [ ] Data appears in Supabase `pump_assessments` table
