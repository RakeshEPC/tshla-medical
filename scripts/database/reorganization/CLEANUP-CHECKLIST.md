# 🗑️ TSHLA Medical - Cleanup Checklist

## Files to Delete After Migration

### ✅ Phase 1: Database Scripts (Safe to delete immediately)

These are old MySQL/one-time migration scripts that are no longer needed:

```bash
# Old MySQL pump tables (not used in Supabase)
rm scripts/database/create-pump-tables.sql

# Old pump_users recreation scripts (table will be deleted)
rm scripts/database/recreate-pump-users.sql
rm scripts/database/fix-pump-users-policy.sql
rm scripts/database/fix-pump-users-simple.sql
rm scripts/database/fix-pump-users-complete.sql

# One-time setup scripts (already run)
rm scripts/database/create-medical-staff-table.cjs
rm scripts/database/create-access-logs-now.cjs
rm scripts/database/create-rakesh-admin.cjs
rm scripts/database/create-production-admin.cjs
```

**Impact:** ✅ None - these are old setup scripts

---

### ⚠️ Phase 2: Auth Services (Delete after updating code)

**WAIT until you've updated all references!**

#### Delete these auth service files:

```bash
# Old separate auth services
rm src/services/pumpAuth.service.ts
rm src/services/medicalAuth.service.ts
rm src/services/unifiedAuth.service.ts  # Will create simpler replacement
```

#### Before deleting, find all usages:

```bash
# Find files using pumpAuth
grep -r "pumpAuthService" src/

# Find files using medicalAuth
grep -r "medicalAuthService" src/
```

**Update each file to use new unified auth service instead.**

---

### ⚠️ Phase 3: Login Pages (Consolidate)

#### Current login pages (redundant):

```
src/pages/PumpDriveLogin.tsx       ❌ Delete (merge into PatientLogin)
src/pages/PumpDriveCreateAccount.tsx  ❌ Delete (merge into PatientSignup)
```

#### Create unified patient pages:

```
src/pages/patient/PatientLogin.tsx     ✅ Create (handles EMR + PumpDrive)
src/pages/patient/PatientSignup.tsx    ✅ Create (unified registration)
src/pages/patient/PatientDashboard.tsx ✅ Create (shows both EMR + PumpDrive)
```

**Keep separate:**
```
src/pages/staff/StaffLogin.tsx     ✅ Keep (for doctors/nurses/admins)
```

---

### ⚠️ Phase 4: Components (Consolidate)

#### Redundant components to merge:

```bash
# PumpDrive auth components (merge into patient auth)
src/components/PumpDriveAuthGuard.tsx  ❌ Delete
src/components/pumpdrive/LoginForm.tsx ❌ Delete

# Create unified components instead:
src/components/patient/PatientAuthGuard.tsx  ✅ Create
src/components/patient/LoginForm.tsx         ✅ Create
```

---

## 📝 File Reorganization Plan

### Suggested new folder structure:

```
src/
├── services/
│   ├── auth/
│   │   ├── auth.service.ts         ✅ NEW - Unified auth
│   │   └── session.service.ts      ✅ Keep
│   ├── staff/
│   │   ├── dictation.service.ts    ✅ Keep
│   │   └── schedule.service.ts     ✅ Keep
│   ├── patient/
│   │   ├── emr.service.ts          ✅ Keep
│   │   ├── pumpdrive.service.ts    ✅ Keep (business logic)
│   │   └── records.service.ts      ✅ Keep
│   └── shared/
│       ├── supabaseClient.ts       ✅ Keep
│       └── logger.service.ts       ✅ Keep
│
├── pages/
│   ├── staff/
│   │   ├── StaffLogin.tsx          ✅ Keep
│   │   ├── Dictation.tsx           ✅ Keep
│   │   └── AdminDashboard.tsx      ✅ Keep
│   ├── patient/
│   │   ├── PatientLogin.tsx        ✅ Create
│   │   ├── PatientDashboard.tsx    ✅ Create
│   │   ├── PumpDrive.tsx           ✅ Keep (embed in dashboard)
│   │   └── MedicalRecords.tsx      ✅ Keep
│   └── public/
│       └── Home.tsx                 ✅ Keep
│
├── components/
│   ├── staff/
│   │   └── ...                     ✅ Keep all
│   ├── patient/
│   │   ├── PatientAuthGuard.tsx    ✅ Create
│   │   ├── EMRSection.tsx          ✅ Create
│   │   └── PumpDriveSection.tsx    ✅ Create
│   └── pumpdrive/
│       └── ...                     ✅ Keep (business components)
```

---

## 🔍 Finding Obsolete Code

### Search for references to deleted tables:

```bash
# Find references to pump_users table
grep -r "pump_users" src/ server/

# Find references to old auth services
grep -r "pumpAuthService" src/
grep -r "medicalAuthService" src/
```

### Search for duplicate auth logic:

```bash
# Find multiple login implementations
find src/ -name "*Login*.tsx" -o -name "*login*.tsx"

# Find multiple signup implementations
find src/ -name "*Signup*.tsx" -o -name "*CreateAccount*.tsx"
```

---

## ✅ Safe Deletion Order

Follow this order to avoid breaking the app:

### **1. Database migration** (do first)
- ✅ Run reorganization SQL scripts
- ✅ Verify data migrated correctly
- ✅ Drop `pump_users` table

### **2. Create new unified auth service** (before deleting old)
- ✅ Create `src/services/auth/auth.service.ts`
- ✅ Test it works
- ✅ Update 1-2 pages to use it
- ✅ Verify login works

### **3. Update all auth references** (one file at a time)
- ✅ Replace `pumpAuthService` with unified auth
- ✅ Replace `medicalAuthService` with unified auth
- ✅ Test after each file update

### **4. Delete old auth services** (after all references removed)
- ✅ Delete `pumpAuth.service.ts`
- ✅ Delete `medicalAuth.service.ts`
- ✅ Delete `unifiedAuth.service.ts`

### **5. Consolidate login pages**
- ✅ Create `PatientLogin.tsx` (combines PumpDrive + EMR)
- ✅ Update routes
- ✅ Delete `PumpDriveLogin.tsx`
- ✅ Delete `PumpDriveCreateAccount.tsx`

### **6. Delete obsolete database scripts**
- ✅ Delete old MySQL scripts
- ✅ Delete one-time setup scripts
- ✅ Keep only active migration scripts

---

## 🧪 Testing After Each Deletion

After deleting files, run:

```bash
# Check for broken imports
npm run build

# Check TypeScript errors
npx tsc --noEmit

# Search for references to deleted files
grep -r "pumpAuth" src/
grep -r "PumpDriveLogin" src/
```

---

## 📊 Verification Checklist

Before declaring cleanup complete:

- [ ] `npm run build` succeeds with no errors
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Patient login works
- [ ] Staff login works
- [ ] Admin login works
- [ ] PumpDrive assessment works (saves to patients)
- [ ] Dictation works
- [ ] No references to `pump_users` in code
- [ ] No references to deleted auth services
- [ ] All tests pass (if you have tests)

---

## 🚨 Backup Plan

Before deleting anything:

```bash
# Create backup branch
git checkout -b backup-before-cleanup
git add .
git commit -m "Backup before cleanup"
git push origin backup-before-cleanup

# Create main cleanup branch
git checkout -b feature/system-reorganization
```

If something breaks:
```bash
# Revert to backup
git checkout backup-before-cleanup
```

---

## 📅 Suggested Timeline

**Day 1:** Database migration
- Run SQL scripts
- Verify data
- Test database queries

**Day 2-3:** Create unified auth
- Build new auth service
- Update 1-2 pages to test
- Verify it works

**Day 4-5:** Update all references
- Replace old auth services
- Update all login pages
- Update all components

**Day 6:** Delete old files
- Remove old auth services
- Remove old login pages
- Remove obsolete scripts

**Day 7:** Testing & verification
- Full end-to-end testing
- Fix any issues
- Deploy

---

## 🎉 Success Criteria

Cleanup is complete when:

✅ Database has only 2 user tables: `medical_staff` and `patients`
✅ Only 1 auth service: `src/services/auth/auth.service.ts`
✅ Only 2 login pages: `StaffLogin.tsx` and `PatientLogin.tsx`
✅ No references to `pump_users` anywhere
✅ No duplicate auth logic
✅ Build succeeds with no errors
✅ All features work correctly
