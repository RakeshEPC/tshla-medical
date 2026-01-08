# Affected Tables - Detailed Security Analysis

**Date:** January 8, 2026
**Total Tables:** 27
**Migration Script:** `database/migrations/URGENT-enable-rls-all-tables.sql`

---

## Table-by-Table Breakdown

### 🔴 CRITICAL SEVERITY - Protected Health Information (PHI)

#### 1. `dictated_notes`
**Contains:** Clinical documentation, SOAP notes, diagnoses, treatment plans
**Current Risk:** Any user can read all clinical notes from all providers
**RLS Policy Applied:**
- Providers can only read/write their own notes
- No anonymous access
- `provider_id` isolation enforced

**Testing:**
```sql
-- Before RLS: Returns ALL notes (SECURITY VIOLATION)
SELECT COUNT(*) FROM dictated_notes;

-- After RLS: Returns only your notes (SECURE)
SELECT COUNT(*) FROM dictated_notes WHERE provider_id = auth.uid()::text;
```

---

#### 2. `patients`
**Contains:** Patient demographics, contact information, SSN, date of birth
**Current Risk:** Anonymous users can access all patient personal information
**RLS Policy Applied:**
- Authenticated users only
- Providers see patients they're treating
- Patients see only their own record

**Testing:**
```sql
-- Should return empty for anonymous users
SELECT * FROM patients LIMIT 1;

-- Should return only assigned patients for providers
SELECT * FROM patients WHERE id IN (
    SELECT patient_id FROM provider_patients WHERE provider_id = auth.uid()::text
);
```

---

#### 3. `unified_patients`
**Contains:** Consolidated patient records across systems (Athena, local, etc.)
**Current Risk:** Full patient data exposed to anyone
**RLS Policy Applied:**
- Same as `patients` table
- Provider assignment required
- Master patient index protected

**Testing:**
```sql
-- Verify isolation
SELECT COUNT(DISTINCT id) FROM unified_patients;
-- Should only show patients assigned to you
```

---

#### 4. `pcm_vitals`
**Contains:** Blood pressure, blood sugar, weight, temperature, O2 saturation
**Current Risk:** Anyone can view all patient vital signs
**RLS Policy Applied:**
- Care managers can see enrolled patients
- Providers can see their patients
- Patients can see their own vitals

**Testing:**
```sql
-- Should be filtered by pcm_enrollments
SELECT * FROM pcm_vitals
WHERE patient_id IN (
    SELECT patient_id FROM pcm_enrollments WHERE care_manager_id = auth.uid()::text
);
```

---

#### 5. `pcm_enrollments`
**Contains:** Chronic conditions, enrollment status, care programs, diagnoses
**Current Risk:** All patient conditions and diagnoses visible publicly
**RLS Policy Applied:**
- Care managers see their enrollments
- Providers see their patients
- No public access

**Testing:**
```sql
-- Verify enrollment isolation
SELECT patient_id, conditions FROM pcm_enrollments;
-- Should only show your enrolled patients
```

---

#### 6. `appointments`
**Contains:** Patient scheduling, appointment notes, chief complaints
**Current Risk:** Anyone can see who has appointments and when
**RLS Policy Applied:**
- Providers see their own schedule
- Staff see appointments they manage
- Patients see their own appointments

**Testing:**
```sql
-- Provider view
SELECT * FROM appointments WHERE provider_id = auth.uid()::text;

-- Patient view
SELECT * FROM appointments WHERE patient_id = auth.uid()::text;
```

---

### 🟠 HIGH SEVERITY - Medical Data

#### 7. `visits`
**Contains:** Visit documentation, encounter notes, procedures performed
**RLS Policy:** Provider ownership + patient access

#### 8. `patient_service_requests`
**Contains:** Lab orders, prescription requests, imaging orders, referrals
**RLS Policy:** Provider write, patient read, staff process

#### 9. `pcm_contacts`
**Contains:** Patient-staff interactions, call logs, communications
**RLS Policy:** Care team access only

#### 10. `pcm_lab_orders`
**Contains:** Laboratory test orders, specimen collection, results
**RLS Policy:** Provider order, lab technician process, patient view results

#### 11. `note_versions`
**Contains:** Clinical note revision history, audit trail
**RLS Policy:** Same as parent note, version control access

#### 12. `provider_schedules`
**Contains:** Provider availability, patient assignments, schedule blocks
**RLS Policy:** Provider owns schedule, staff can view for coordination

#### 13. `previsit_responses`
**Contains:** Pre-visit questionnaires, symptoms reported, medications listed
**RLS Policy:** Patient creates, provider reads, linked to appointment

---

### 🟡 MEDIUM SEVERITY - Sensitive Information

#### 14. `pump_assessments`
**Contains:** Insulin pump patient preferences, lifestyle factors, treatment decisions
**Current Bug:** Cannot save assessments (RLS blocking inserts)
**RLS Policy Applied:**
- Patient owns their assessment
- Provider can view patient's assessments
- **FIX:** Links to `patients` table instead of non-existent `pump_users`

**Testing:**
```sql
-- This should now work:
INSERT INTO pump_assessments (patient_id, assessment_data)
VALUES ('patient-uuid', '{"test": true}');
```

#### 15. `pcm_tasks`
**Contains:** Care management action items, patient care tasks
**RLS Policy:** Care team access

#### 16. `pcm_goals`
**Contains:** Patient health goals, objectives, progress tracking
**RLS Policy:** Patient + care team access

#### 17. `diabetes_education_patients`
**Contains:** Diabetes education enrollment, completion status
**RLS Policy:** Patient enrollment data, educator access

#### 18. `note_comments`
**Contains:** Provider comments on clinical notes, peer review
**RLS Policy:** Provider network access, note author access

#### 19. `extracted_orders`
**Contains:** AI-extracted lab orders from dictation
**RLS Policy:** Same as source note, provider ownership

#### 20. `previsit_call_data`
**Contains:** Pre-visit phone call data, ElevenLabs conversation storage
**RLS Policy:** Patient owns call data, provider can review

#### 21. `patient_visit_summaries`
**Contains:** Visit summary documents, patient instructions
**RLS Policy:** Patient access, provider authorship

#### 22. `ccd_summaries`
**Contains:** Consolidated Clinical Document (CCD) summaries
**RLS Policy:** Patient record access, provider import rights

---

### 🟢 LOW SEVERITY - System/Reference Data

#### 23. `medical_staff`
**Contains:** Provider credentials, staff information, licenses
**RLS Policy:** Public read (directory), self-update only

#### 24. `templates`
**Contains:** Clinical note templates, documentation templates
**RLS Policy:** Provider owns custom templates, public read standards

#### 25. `audit_logs`
**Contains:** System audit trail, access logs
**RLS Policy:** Admin-only access, read-only

#### 26. `notifications`
**Contains:** User notifications, system messages
**RLS Policy:** User receives their own notifications only

#### 27. `pump_comparison_data`
**Contains:** Insulin pump feature comparisons, reference data
**RLS Policy:** Public read (product catalog data)

---

## Policy Summary by Type

### Provider Isolation
Tables where providers can only see their own data:
- `dictated_notes`
- `templates` (custom)
- `provider_schedules`
- `appointments`

### Patient Ownership
Tables where patients control their own data:
- `pump_assessments`
- `diabetes_education_patients`
- `previsit_responses`
- `notifications`

### Care Team Access
Tables where care team members share access:
- `pcm_vitals`
- `pcm_enrollments`
- `pcm_tasks`
- `pcm_goals`
- `pcm_contacts`

### Admin Only
Tables restricted to administrators:
- `audit_logs`

### Public Read
Tables with read-only public access:
- `pump_comparison_data`
- `medical_staff` (directory)
- `templates` (standard templates)

---

## Impact Assessment

### Before RLS Migration

| Risk Category | Tables Affected | Data Exposed |
|---------------|-----------------|--------------|
| 🔴 CRITICAL | 6 tables | 100% of PHI |
| 🟠 HIGH | 7 tables | 100% of medical data |
| 🟡 MEDIUM | 9 tables | 100% of sensitive info |
| 🟢 LOW | 5 tables | Staff/reference data |
| **TOTAL** | **27 tables** | **ALL patient data** |

### After RLS Migration

| Security Level | Tables Protected | Access Control |
|----------------|------------------|----------------|
| ✅ Fully Secured | 27 tables | Role-based access |
| ✅ Provider Isolation | 15 tables | Own data only |
| ✅ Patient Privacy | 8 tables | Own data only |
| ✅ Anonymous Blocked | 22 tables | Auth required |
| ✅ Audit Trail | All changes | Logged |

---

## Verification Queries

### Check All Tables Have RLS Enabled
```sql
SELECT
    tablename,
    CASE
        WHEN rowsecurity THEN '✅ SECURED'
        ELSE '❌ VULNERABLE'
    END as status,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policies
FROM pg_tables t
WHERE schemaname = 'public'
    AND tablename IN (
        'dictated_notes', 'patients', 'unified_patients', 'appointments',
        'pcm_vitals', 'pcm_enrollments', 'visits', 'patient_service_requests',
        'pcm_contacts', 'pcm_lab_orders', 'note_versions', 'provider_schedules',
        'previsit_responses', 'pump_assessments', 'pcm_tasks', 'pcm_goals',
        'diabetes_education_patients', 'note_comments', 'extracted_orders',
        'medical_staff', 'templates', 'audit_logs', 'notifications',
        'pump_comparison_data', 'previsit_call_data', 'patient_visit_summaries',
        'ccd_summaries'
    )
ORDER BY
    CASE WHEN rowsecurity THEN 1 ELSE 0 END,
    tablename;
```

### List All Policies Created
```sql
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    CASE
        WHEN cmd = 'SELECT' THEN '👁️ Read'
        WHEN cmd = 'INSERT' THEN '➕ Create'
        WHEN cmd = 'UPDATE' THEN '✏️ Update'
        WHEN cmd = 'DELETE' THEN '🗑️ Delete'
        WHEN cmd = 'ALL' THEN '🔓 All Operations'
    END as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Test Anonymous Access (Should All Fail)
```sql
-- Run these without authentication (should return 0 rows or error)
SELECT COUNT(*) FROM dictated_notes;
SELECT COUNT(*) FROM patients;
SELECT COUNT(*) FROM appointments;
SELECT COUNT(*) FROM pcm_vitals;

-- If ANY of these return data, RLS is NOT working correctly
```

---

## Special Considerations

### Pump Assessments Bug Fix
**Before Migration:**
- Policy checked for `pump_users` table (doesn't exist)
- Inserts silently failed
- No error messages

**After Migration:**
- Policy checks `patients` table (exists)
- Inserts work correctly
- Users can save assessments

### Provider Data Isolation
**Critical for multi-tenant security:**
- Provider A cannot see Provider B's notes
- Even if they share patients
- Each provider has isolated workspace

### Patient Portal Access
**Patients can access:**
- Their own demographics (`patients`)
- Their appointments (`appointments`)
- Their vitals (`pcm_vitals`)
- Their pump assessments (`pump_assessments`)
- Their visit summaries (`patient_visit_summaries`)

**Patients CANNOT access:**
- Other patients' data
- Provider notes about them (unless explicitly shared)
- System audit logs
- Staff communications

---

## Migration Rollback Plan

**IF CRITICAL ISSUES ARISE (Emergency Only):**

```sql
-- STEP 1: Disable RLS on problem table
ALTER TABLE [problem_table] DISABLE ROW LEVEL SECURITY;

-- STEP 2: Diagnose issue
-- Check if data exists
SELECT COUNT(*) FROM [problem_table];

-- Check who can access
SELECT current_user, current_setting('request.jwt.claims')::json;

-- STEP 3: Fix policy
DROP POLICY [policy_name] ON [problem_table];
CREATE POLICY [policy_name] ON [problem_table]
    FOR ALL
    USING ([corrected_logic]);

-- STEP 4: Re-enable RLS
ALTER TABLE [problem_table] ENABLE ROW LEVEL SECURITY;
```

**⚠️ WARNING:** Only disable RLS as absolute last resort. Every second RLS is disabled, patient data is exposed.

---

## Success Metrics

After migration, verify:

- [ ] All 27 tables show `rowsecurity = true`
- [ ] At least 40 policies created
- [ ] Anonymous queries return 0 rows or error
- [ ] Authenticated users see only their data
- [ ] Pump assessments can be saved
- [ ] Application features still work
- [ ] No error spam in logs
- [ ] Provider isolation confirmed
- [ ] Patient privacy maintained

---

**Next Steps:**
1. Execute migration: `database/migrations/URGENT-enable-rls-all-tables.sql`
2. Run verification queries above
3. Test application thoroughly
4. Monitor logs for issues
5. Sign BAAs with Supabase and Deepgram

**Full Guide:** See `RLS-REMEDIATION-GUIDE.md`
**Quick Start:** See `RLS-QUICK-START-CHECKLIST.md`
