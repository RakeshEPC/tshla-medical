# 🔄 TSHLA Medical - System Reorganization Guide

## Overview

This reorganization consolidates your authentication and user management into a clean, unified system:

**Before:**
- ❌ 3 separate auth systems (`pumpAuth`, `medicalAuth`, `supabaseAuth`)
- ❌ Duplicate user tables (`pump_users` AND `patients`)
- ❌ Confusing: Where is my data?

**After:**
- ✅ 1 unified auth system (Supabase Auth)
- ✅ 2 clear user tables: `medical_staff` (staff/doctors/admins) and `patients` (EMR + PumpDrive)
- ✅ Clear separation: Staff vs. Patients

---

## 🎯 Target Architecture

```
┌─────────────────────────────────────────────┐
│         SUPABASE AUTH (auth.users)          │
│     All passwords managed by Supabase       │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│medical_staff │        │   patients   │
│              │        │              │
│ • Doctors    │        │ • EMR data   │
│ • Nurses     │        │ • PumpDrive  │
│ • Admins     │        │   results    │
└──────────────┘        └──────────────┘
```

### User Access Matrix

| User Type | Login Page | Access To |
|-----------|-----------|-----------|
| **Patient** | `/patient/login` | ✅ EMR records<br>✅ PumpDrive assessments<br>✅ Download reports |
| **Doctor/Nurse** | `/staff/login` | ✅ Dictation<br>✅ View all patients |
| **Admin (You)** | `/staff/login` | ✅ Everything above<br>✅ PumpDrive analytics<br>✅ System management |

---

## 📋 Migration Steps

### **Step 1: Check Current Data** ⚠️ REQUIRED

**Run this in Supabase SQL Editor:**

```sql
-- Copy contents of: 01-check-current-data.sql
```

**Expected Output:**
- Row counts for each table
- Number of pump_users vs. patients
- Check for duplicate emails
- Orphaned assessments check

**Decision Tree:**
- If `pump_users` has **0 rows** → Skip Step 2, go to Step 3 (just drop the table)
- If `pump_users` has **<5 rows** → Continue to Step 2 (easy migration)
- If `pump_users` has **>5 rows** → Continue to Step 2 (full migration)

---

### **Step 2: Merge pump_users into patients**

**⚠️ IMPORTANT: Only run this if pump_users has data!**

**Run this in Supabase SQL Editor:**

```sql
-- Copy contents of: 02-merge-pump-users-into-patients.sql
```

**What this does:**
1. ✅ Adds PumpDrive fields to `patients` table
2. ✅ Migrates all `pump_users` → `patients`
3. ✅ Updates `pump_assessments` to link to `patients`
4. ✅ Creates temporary mapping table
5. ✅ Verifies all data migrated correctly

**Expected Output:**
```
✓ PumpDrive fields added
✓ Pump users migrated (X rows)
✓ Updated X pump assessments
✓ All assessments linked to patients
```

**⚠️ DO NOT CONTINUE TO STEP 3 UNTIL YOU VERIFY THE OUTPUT!**

---

### **Step 3: Finalize Migration** ⚠️ POINT OF NO RETURN

**Run this in Supabase SQL Editor:**

```sql
-- Copy contents of: 03-finalize-migration.sql
```

**What this does:**
1. ⚠️ Drops `pump_users` table (can't undo!)
2. ✅ Removes old `user_id` column from `pump_assessments`
3. ✅ Updates Row Level Security policies
4. ✅ Adds performance indexes

**⚠️ WARNING:**
- This **permanently deletes** the `pump_users` table
- Make sure Step 2 completed successfully
- The DROP TABLE line is **commented by default** - you must manually uncomment it

---

### **Step 4: Update Frontend Code**

**Files to update:**

#### A. **Remove old auth services**

Delete these files:
```bash
rm src/services/pumpAuth.service.ts
rm src/services/medicalAuth.service.ts
rm src/services/unifiedAuth.service.ts  # Will create new one
```

#### B. **Update backend API**

In `server/pump-report-api.js`:
```javascript
// OLD (line ~1546):
const { data: pumpData } = await supabase
  .from('pump_users')
  .select('*')
  .eq('auth_user_id', authData.user.id);

// NEW:
const { data: patientData } = await supabase
  .from('patients')
  .select('*')
  .eq('auth_user_id', authData.user.id)
  .eq('pumpdrive_enabled', true);
```

In `pump_assessments` inserts (line ~1556):
```javascript
// OLD:
user_id: userId,

// NEW:
patient_id: patientId,
```

#### C. **Update login pages**

Create unified patient login:
- Rename `PumpDriveLogin.tsx` → `PatientLogin.tsx`
- Update to query `patients` table instead of `pump_users`
- After login, redirect to unified patient dashboard

#### D. **Update patient dashboard**

Create new `PatientDashboard.tsx`:
```typescript
// Shows both EMR and PumpDrive in one place
<PatientDashboard>
  <MedicalRecordsSection />  // EMR data
  <PumpDriveSection />        // Pump assessments
  <ReportsSection />          // Download reports
</PatientDashboard>
```

---

## 🗑️ Files to Delete After Migration

### **Database Scripts (Obsolete):**
```bash
rm scripts/database/create-pump-tables.sql
rm scripts/database/recreate-pump-users.sql
rm scripts/database/fix-pump-users-*.sql
```

### **Auth Services (Duplicate):**
```bash
rm src/services/pumpAuth.service.ts
rm src/services/medicalAuth.service.ts
```

### **Login Pages (Consolidate):**
```bash
rm src/pages/PumpDriveLogin.tsx
rm src/pages/PumpDriveCreateAccount.tsx
# Replace with: PatientLogin.tsx and PatientSignup.tsx
```

---

## 🧪 Testing Checklist

After migration, test these scenarios:

### **Patient Login:**
- [ ] Patient can log in at `/patient/login`
- [ ] Can see their medical records (if they have any)
- [ ] Can access PumpDrive assessments
- [ ] Can complete new pump assessment
- [ ] Assessment saves correctly to `pump_assessments` table
- [ ] Can view past assessments

### **Staff Login:**
- [ ] Doctor/nurse can log in at `/staff/login`
- [ ] Can access dictation feature
- [ ] Can view patient list
- [ ] Cannot access patient's pump data (unless admin)

### **Admin Login:**
- [ ] Admin can log in at `/staff/login`
- [ ] Can see PumpDrive analytics dashboard
- [ ] Can view all patients (both EMR and PumpDrive)
- [ ] Can manage system settings

---

## 🆘 Troubleshooting

### "Cannot find pump_users table"
**Solution:** You already ran the migration. Update your code to use `patients` table.

### "pump_assessments has orphaned records"
**Solution:** Run this query to find them:
```sql
SELECT * FROM pump_assessments WHERE patient_id IS NULL;
```
Manually link them or delete if they're test data.

### "Patient can't log in after migration"
**Check:**
1. Does patient have `auth_user_id` set? (`SELECT * FROM patients WHERE email='...'`)
2. Does patient exist in `auth.users`?
3. Is `pumpdrive_enabled = TRUE` if they need PumpDrive access?

### "Staff can see patient pump data (shouldn't)"
**Solution:** Check Row Level Security policies:
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'pump_assessments';

-- List all policies
SELECT * FROM pg_policies WHERE tablename = 'pump_assessments';
```

---

## 📊 Expected Results

After successful migration:

```sql
-- Check patients table
SELECT
  COUNT(*) as total_patients,
  COUNT(CASE WHEN pumpdrive_enabled = TRUE THEN 1 END) as pumpdrive_users,
  COUNT(CASE WHEN pumpdrive_enabled = FALSE THEN 1 END) as emr_only
FROM patients;
```

**Expected:**
- `total_patients` = (old `patients` count) + (old `pump_users` count)
- `pumpdrive_users` = old `pump_users` count
- `emr_only` = old `patients` count

```sql
-- Check pump_assessments linked correctly
SELECT
  COUNT(*) as total_assessments,
  COUNT(patient_id) as linked_to_patients,
  COUNT(*) - COUNT(patient_id) as orphaned
FROM pump_assessments;
```

**Expected:**
- `orphaned` = 0

---

## 📞 Support

If you run into issues:
1. Check the troubleshooting section above
2. Run `01-check-current-data.sql` to verify state
3. Reach out with the output of that query

---

## 🎉 Success Criteria

Migration is complete when:
- ✅ `pump_users` table dropped
- ✅ All assessments linked to `patients.id`
- ✅ Patients can log in and see PumpDrive
- ✅ Staff can log in and use dictation
- ✅ Admin can see both systems
- ✅ No duplicate users
- ✅ RLS policies working correctly
