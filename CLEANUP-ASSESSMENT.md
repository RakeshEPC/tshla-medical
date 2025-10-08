# TSHLA Medical - Cleanup Assessment Report

**Date:** October 8, 2025
**Status:** Ready for migration
**Risk Level:** Medium

---

## 🔴 CRITICAL ISSUES FOUND

### 1. **Multiple User Tables (Data Fragmentation)**
- `pump_users` - PumpDrive users
- `patients` - EMR patients
- `doctors` - Legacy doctor table (from old MySQL schema)
- `medical_staff` - Current staff table (Supabase)

**Problem:** Patients can exist in BOTH `pump_users` AND `patients`, causing duplicates and confusion.

### 2. **Authentication System Duplication**
**Auth Services Found:**
- `src/services/unifiedAuth.service.ts` (450 lines)
- `src/services/supabaseAuth.service.ts` (476 lines)
- `src/services/supabase.service.ts`

**Login Pages Found (7 total):**
- `src/pages/Login.tsx`
- `src/pages/LoginHIPAA.tsx`
- `src/pages/SimplifiedLogin.tsx`
- `src/pages/UnifiedLogin.tsx`
- `src/pages/PumpDriveLogin.tsx`
- `src/pages/PatientLogin.tsx`
- `src/pages/AdminAccountManagement.tsx`

**Needed:** 2 login pages only (staff + patient)

### 3. **Patient Service Explosion (14+ Services)**
```
src/services/patient.service.ts
src/services/patientData.supabase.service.ts
src/services/patientManagement.service.ts
src/services/patientMaster.service.ts
src/services/securePatient.service.ts
src/services/pumpPersonaEngine.service.ts
src/services/pumpDrivePureAI.service.ts
src/services/centralizedSchedule.service.ts
... (6 more)
```

**Problem:** No clear "single source of truth" for patient operations.

### 4. **Database Schema Duplication**
- `src/lib/database-schema.sql` - Uses `doctors` table (old MySQL)
- `src/lib/supabase/schema.sql` - Uses `patients` table (new)
- `src/lib/db/schema.sql` - Another `doctors` table schema
- Multiple migration scripts in conflict

---

## ✅ WHAT'S WORKING WELL

1. **Supabase Auth** - Already integrated with `auth.users`
2. **RLS Policies** - Row Level Security properly configured
3. **Migration Scripts Ready** - `scripts/database/reorganization/` contains prepared migrations
4. **Backend API** - `server/pump-report-api.js` is working (just needs table updates)

---

## 🎯 TARGET ARCHITECTURE

### **Simplified User Model:**

```
Supabase Auth (auth.users)
         |
    ┌────┴────┐
    ▼         ▼
medical_staff  patients
(Providers)   (Patients)
    |              |
    ▼              ▼
Dictation     EMR + PumpDrive
Admin Panel   Patient Portal
```

### **Two User Types Only:**

| Type | Table | Login URL | Access |
|------|-------|-----------|--------|
| **Staff** | `medical_staff` | `/login` | Dictation, Charts, Admin (if admin role) |
| **Patient** | `patients` | `/patient-login` | EMR records, PumpDrive assessments |

### **Key Changes:**

1. **Delete `pump_users` table** → Merge into `patients` with `pumpdrive_enabled` flag
2. **Keep 2 login pages** → Delete 5 duplicate login pages
3. **Single auth service** → `supabaseAuth.service.ts` only
4. **Unified patient service** → Consolidate 14 services into 1-2
5. **Role-based dashboards** → Admin sees everything, doctors see dictation, patients see their portal

---

## 📋 MIGRATION PLAN

### **Phase 1: Database (CRITICAL - Do First)**

**Step 1.1** - Check current data state:
```sql
-- Run: scripts/database/reorganization/01-check-current-data.sql
-- This shows row counts and duplicates
```

**Step 1.2** - Execute migration:
```sql
-- Run: scripts/database/reorganization/SIMPLE-START-FRESH.sql
-- This will:
-- - Drop pump_users table
-- - Add pumpdrive fields to patients
-- - Update pump_assessments to use patient_id
-- - Update RLS policies
```

**Step 1.3** - Verify:
```sql
-- Check: All assessments linked to patients
SELECT COUNT(*) FROM pump_assessments WHERE patient_id IS NULL;
-- Should return: 0
```

### **Phase 2: Authentication Cleanup**

**Files to DELETE:**
```bash
src/pages/LoginHIPAA.tsx
src/pages/SimplifiedLogin.tsx
src/pages/UnifiedLogin.tsx
src/pages/PumpDriveLogin.tsx
src/pages/PumpDriveCreateAccount.tsx
```

**Files to KEEP & UPDATE:**
```bash
src/pages/Login.tsx              → Staff login (doctors, nurses, admin)
src/pages/PatientLogin.tsx       → Patient login (EMR + PumpDrive)
src/services/supabaseAuth.service.ts → Single auth service
```

**Files to DELETE:**
```bash
src/services/unifiedAuth.service.ts
src/services/supabase.service.ts (merge into supabaseAuth)
```

### **Phase 3: Service Consolidation**

**Patient Services - BEFORE (14 files):**
```
patient.service.ts
patientData.supabase.service.ts
patientManagement.service.ts
patientMaster.service.ts
securePatient.service.ts
... (9 more)
```

**Patient Services - AFTER (2 files):**
```
patient.service.ts       → Patient CRUD operations
pumpDrive.service.ts     → Pump assessment operations
```

**Delete these services:**
- `patientData.supabase.service.ts` (merge into patient.service.ts)
- `patientManagement.service.ts` (merge into patient.service.ts)
- `patientMaster.service.ts` (redundant)
- `securePatient.service.ts` (redundant)

### **Phase 4: Backend API Updates**

**File:** `server/pump-report-api.js`

**Changes needed:**
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

// OLD (line ~1556):
user_id: userId,

// NEW:
patient_id: patientId,
```

### **Phase 5: Frontend Unification**

**Create:** `src/pages/PatientDashboard.tsx`
```typescript
// Unified dashboard showing:
// - EMR medical records
// - PumpDrive assessments
// - Download reports
// - Appointment scheduling
```

**Update:** `src/pages/DoctorDashboard.tsx`
```typescript
// Role-based access:
// - Admin: See everything + PumpDrive analytics
// - Doctor: Dictation + Patient charts
// - Nurse/MA: Scheduling + limited EMR
```

---

## 🧪 TESTING CHECKLIST

After migration, verify:

### **Patient Login & Access:**
- [ ] Patient can register new account
- [ ] Patient can log in at `/patient-login`
- [ ] Patient can see EMR records (if any)
- [ ] Patient can access PumpDrive assessments
- [ ] Patient can complete new pump assessment
- [ ] Assessment saves to `pump_assessments` with `patient_id`
- [ ] Patient can view assessment history
- [ ] Patient can download reports

### **Staff Login & Access:**
- [ ] Doctor can log in at `/login`
- [ ] Doctor can access dictation
- [ ] Doctor can view patient charts
- [ ] Doctor cannot see patient PumpDrive data (unless admin)

### **Admin Access:**
- [ ] Admin can log in at `/login`
- [ ] Admin can see PumpDrive analytics
- [ ] Admin can view all patients
- [ ] Admin can manage system settings
- [ ] Admin can create new staff accounts

### **Data Integrity:**
- [ ] No duplicate patients
- [ ] All assessments linked to valid patient
- [ ] RLS policies enforcing proper access
- [ ] Audit logs capturing all PHI access

---

## 🗑️ FILES TO DELETE (After Migration)

### **Database Scripts (Obsolete):**
```
scripts/database/create-pump-tables.sql
scripts/database/recreate-pump-users.sql
scripts/database/fix-pump-users-simple.sql
scripts/database/fix-pump-users-complete.sql
scripts/database/fix-pump-users-policy.sql
```

### **Schema Files (Duplicates):**
```
src/lib/database-schema.sql (use Supabase schema only)
src/lib/db/schema.sql (old MySQL schema)
```

### **Auth Services (Consolidate):**
```
src/services/unifiedAuth.service.ts
src/services/supabase.service.ts
```

### **Login Pages (Duplicates):**
```
src/pages/LoginHIPAA.tsx
src/pages/SimplifiedLogin.tsx
src/pages/UnifiedLogin.tsx
src/pages/PumpDriveLogin.tsx
src/pages/PumpDriveCreateAccount.tsx
src/pages/CreateAccount.tsx (merge into PatientSignup.tsx)
```

### **Patient Services (Redundant):**
```
src/services/patientData.supabase.service.ts
src/services/patientManagement.service.ts
src/services/patientMaster.service.ts
src/services/securePatient.service.ts
src/services/pumpPersonaEngine.service.ts (if not used)
```

**Total Files to Delete: ~30-40**

---

## ⚠️ ROLLBACK PLAN

**Before running migrations:**

1. **Backup Supabase database:**
   ```bash
   # In Supabase Dashboard → Database → Backups
   # Create manual backup
   ```

2. **Export current data:**
   ```sql
   -- Export pump_users
   COPY (SELECT * FROM pump_users) TO '/tmp/pump_users_backup.csv' CSV HEADER;

   -- Export pump_assessments
   COPY (SELECT * FROM pump_assessments) TO '/tmp/assessments_backup.csv' CSV HEADER;
   ```

3. **Tag current code:**
   ```bash
   git tag pre-cleanup-migration
   git push origin pre-cleanup-migration
   ```

**If migration fails:**
1. Restore Supabase backup from dashboard
2. Revert code: `git reset --hard pre-cleanup-migration`
3. Review error logs and try again

---

## 📊 EXPECTED RESULTS

### **Before Migration:**
```sql
-- pump_users: 5-10 test users
-- patients: 10-20 EMR patients
-- Total tables: 15+
-- Total auth services: 3
-- Total login pages: 7
```

### **After Migration:**
```sql
-- pump_users: DROPPED ✓
-- patients: 15-30 (merged)
-- Total tables: 10 (cleaned up)
-- Total auth services: 1
-- Total login pages: 2
```

### **Database Query to Verify:**
```sql
-- Check consolidated patients
SELECT
  COUNT(*) as total_patients,
  COUNT(CASE WHEN pumpdrive_enabled THEN 1 END) as pumpdrive_users,
  COUNT(CASE WHEN NOT pumpdrive_enabled THEN 1 END) as emr_only
FROM patients;

-- Should show all users in one table
```

---

## 🎉 SUCCESS CRITERIA

Migration complete when:
- ✅ `pump_users` table dropped
- ✅ All patients in single `patients` table
- ✅ All assessments linked to `patients.id`
- ✅ Only 2 login pages exist
- ✅ Only 1 auth service (`supabaseAuth.service.ts`)
- ✅ Patient can login and use PumpDrive
- ✅ Staff can login and use dictation
- ✅ Admin can see everything
- ✅ No duplicate users
- ✅ RLS policies working correctly
- ✅ All tests passing

---

## 📞 NOTES

**Estimated Time:** 9-13 hours total
**Risk Level:** Medium (database changes)
**Recommended Approach:** Do in phases, test after each phase
**Best Time:** Off-hours when no users are active

**Created by:** Claude Code
**Date:** October 8, 2025
