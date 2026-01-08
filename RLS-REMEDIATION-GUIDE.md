# RLS Security Remediation - Implementation Guide

**Created:** January 8, 2026
**Priority:** 🔴 CRITICAL - HIPAA Compliance
**Status:** Ready to Execute
**Estimated Time:** 1 day (critical fix) + 2-3 weeks (full compliance)

---

## Executive Summary

27 database tables containing Protected Health Information (PHI) currently have Row Level Security (RLS) **DISABLED**, creating a severe HIPAA compliance violation. This guide provides step-by-step instructions to remediate this security gap.

**Critical Risk:** ANY user with the Supabase anonymous key can currently access ALL patient data, clinical notes, appointments, and medical information.

---

## Phase 1: IMMEDIATE - Enable RLS (Critical Security Fix)

### Prerequisites
- [x] Supabase project access (admin)
- [x] SQL script already created: `database/migrations/URGENT-enable-rls-all-tables.sql`
- [ ] 30 minutes of focused time
- [ ] Maintenance window scheduled (optional but recommended)

### Step 1: Backup Verification (5 minutes)

1. Go to Supabase Dashboard → Settings → Backups
2. Verify automatic backups are enabled (should be on by default)
3. **Optional:** Create manual backup:
   ```bash
   # If you want an extra backup before migration
   pg_dump --host=db.minvvjdflezibmgkplqb.supabase.co \
           --port=5432 \
           --username=postgres \
           --dbname=postgres \
           --no-owner --no-acl \
           --file=backup_before_rls_$(date +%Y%m%d).sql
   ```

### Step 2: Review Current State (5 minutes)

Run this query in Supabase SQL Editor to see which tables need RLS:

```sql
-- Check current RLS status
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
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
ORDER BY tablename;
```

**Expected Result:** Most/all tables show `rls_enabled = false` and `policy_count = 0`

### Step 3: Execute RLS Migration (10 minutes)

1. Open Supabase Dashboard
2. Navigate to: **SQL Editor** (left sidebar)
3. Click: **New Query**
4. Open the file: `database/migrations/URGENT-enable-rls-all-tables.sql`
5. Copy the entire contents
6. Paste into SQL Editor
7. Click: **Run** (or press Cmd+Enter / Ctrl+Enter)

**Expected Output:**
```
NOTICE: ========================================
NOTICE: STEP 1: Enabling RLS on all tables...
NOTICE: ========================================
...
NOTICE: ✅ RLS ENABLEMENT COMPLETE
NOTICE: Total tables secured: 27
NOTICE: Total policies created: 40+
```

**Execution Time:** 5-10 minutes

### Step 4: Verify RLS Enabled (5 minutes)

Run this verification query:

```sql
-- Verify RLS is now enabled
SELECT
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
    AND tablename LIKE ANY(ARRAY['dictated%', 'patient%', 'pcm%', 'pump%', 'appointments', 'visits'])
ORDER BY tablename;
```

**Expected Result:** ALL tables should now show:
- `rls_enabled = true` ✅
- `policy_count > 0` ✅

### Step 5: Test Access Controls (15 minutes)

Test each scenario to ensure policies work correctly:

#### Test 1: Unauthenticated Access (Should Fail)
```javascript
// In browser console on your app
const { data, error } = await supabase
  .from('dictated_notes')
  .select('*')
  .limit(1);

console.log('Error:', error);
// Should show: "Row-level security policy violated"
```

#### Test 2: Authenticated Provider Access (Should Work)
```javascript
// Login as a provider first
const { data: user } = await supabase.auth.signInWithPassword({
  email: 'your-provider@example.com',
  password: 'your-password'
});

// Then try to access notes
const { data, error } = await supabase
  .from('dictated_notes')
  .select('*')
  .eq('provider_id', user.user.id)
  .limit(1);

console.log('Data:', data); // Should return provider's own notes
console.log('Error:', error); // Should be null
```

#### Test 3: Pump Assessment Saving (Should Work)
```javascript
// Test saving a pump assessment
const { data, error } = await supabase
  .from('pump_assessments')
  .insert({
    patient_id: 'test-patient-id',
    assessment_data: { test: true }
  });

console.log('Saved:', data);
console.log('Error:', error); // Should be null
```

#### Test 4: Provider Data Isolation (Should Block)
```javascript
// Login as Provider A
// Try to access Provider B's notes (should fail)
const { data, error } = await supabase
  .from('dictated_notes')
  .select('*')
  .eq('provider_id', 'different-provider-id'); // Not your ID

console.log('Data:', data); // Should be empty []
console.log('Error:', error); // May be null, but data should be empty
```

### Step 6: Monitor Application (30 minutes)

After enabling RLS, monitor your application for any access issues:

1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Look for: `permission denied` or `policy violation` errors
3. Test all major features:
   - [ ] Dictation note creation
   - [ ] Patient search
   - [ ] Appointment viewing
   - [ ] Pump assessment submission
   - [ ] Template access
   - [ ] Schedule viewing

**If any feature breaks:**
- Check the RLS policy for that table
- Verify the user is properly authenticated
- Confirm the `provider_id` or `user_id` matches

---

## Phase 2: Legal Compliance (1-2 Weeks)

### Action 1: Sign Business Associate Agreement with Supabase

**Why:** Required by HIPAA when storing PHI with a third-party service

**Steps:**
1. Upgrade to Team Plan (minimum requirement)
2. Purchase HIPAA Add-on ($350/month)
3. Contact Supabase: https://supabase.com/contact/sales
4. Request BAA signing
5. Legal review (1-2 weeks)
6. Execute BAA

**Email Template:**
```
Subject: HIPAA BAA Request for Healthcare Application

Hi Supabase Team,

We are building a healthcare application (TSHLA Medical) that stores
Protected Health Information (PHI) and need to sign a Business Associate
Agreement (BAA) with Supabase.

Our project details:
- Organization: [Your Organization Name]
- Project URL: minvvjdflezibmgkplqb.supabase.co
- Current Plan: [Your current plan]
- Ready to upgrade to: Team Plan + HIPAA Add-on

Please send us the BAA documentation for review.

Thank you,
[Your Name]
[Your Title]
[Your Email]
```

### Action 2: Verify Deepgram BAA

**Check if already signed:**
- Review your Deepgram account settings
- Check email for BAA documents
- Contact Deepgram support if unsure

**If not signed:**
1. Contact Deepgram: https://deepgram.com/contact
2. Request HIPAA BAA
3. Review and sign

**Email Template:**
```
Subject: HIPAA BAA Request for Medical Transcription

Hi Deepgram Team,

We are using Deepgram for medical transcription in our healthcare
application (TSHLA Medical) and need to sign a Business Associate
Agreement (BAA).

Our account: [Your Deepgram account email]
Model used: nova-3-medical
Use case: Real-time medical dictation and clinical note transcription

Please send us the BAA documentation.

Thank you,
[Your Name]
```

### Action 3: Enable HIPAA Mode in Supabase

**After BAA is signed:**

1. Go to Supabase Dashboard
2. Click: Organization Settings
3. Navigate to: Compliance
4. Enable: "HIPAA Compliance" toggle
5. Enable: "High Compliance Mode" for your project
6. Review compliance checklist

**Configuration checks:**
- [ ] Row Level Security enabled on all PHI tables
- [ ] Database backups configured
- [ ] Encryption at rest enabled (automatic)
- [ ] Audit logging enabled
- [ ] SSL/TLS for all connections (automatic)
- [ ] No anonymous writes to PHI tables

---

## Phase 3: Ongoing Monitoring & Compliance

### Set Up Audit Logging

Enable detailed logging for PHI access:

```sql
-- Create audit log trigger (if not exists)
CREATE OR REPLACE FUNCTION audit_phi_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name,
        action,
        user_id,
        row_id,
        timestamp,
        ip_address
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        current_user,
        NEW.id,
        NOW(),
        inet_client_addr()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables
CREATE TRIGGER audit_dictated_notes
    AFTER INSERT OR UPDATE OR DELETE ON dictated_notes
    FOR EACH ROW EXECUTE FUNCTION audit_phi_access();

CREATE TRIGGER audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION audit_phi_access();

-- Repeat for other PHI tables...
```

### Monthly Security Checklist

- [ ] Review RLS policies (any changes needed?)
- [ ] Check audit logs for suspicious access
- [ ] Verify BAAs are still active
- [ ] Test access controls with new users
- [ ] Review Supabase security alerts
- [ ] Update security documentation
- [ ] Staff HIPAA training review

### Automated RLS Testing

Add to your CI/CD pipeline:

```javascript
// tests/security/rls-policies.test.js
describe('RLS Security Tests', () => {
  test('Unauthenticated users cannot access PHI', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase
      .from('dictated_notes')
      .select('*')
      .limit(1);

    expect(data).toEqual([]);
    expect(error).toBeTruthy();
  });

  test('Providers can only see their own notes', async () => {
    const supabase = await loginAsProvider('provider1@test.com');

    const { data } = await supabase
      .from('dictated_notes')
      .select('*');

    // All notes should belong to this provider
    data.forEach(note => {
      expect(note.provider_id).toBe(provider1.id);
    });
  });

  // Add more tests...
});
```

---

## Troubleshooting Common Issues

### Issue 1: "Permission denied for table"

**Symptom:** Users get permission errors when trying to access data

**Causes:**
- RLS policy too restrictive
- User not properly authenticated
- Missing provider_id in query

**Fix:**
```sql
-- Check if user exists in auth.users
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Check if user is in medical_staff
SELECT id, email FROM medical_staff WHERE email = 'user@example.com';

-- If missing, add user:
INSERT INTO medical_staff (id, email, first_name, last_name, role)
VALUES ('user-uuid-here', 'user@example.com', 'First', 'Last', 'Doctor');
```

### Issue 2: Pump assessments still won't save

**Symptom:** Insert fails silently or with policy violation

**Causes:**
- Patient doesn't exist in patients table
- RLS policy checking wrong table

**Fix:**
```sql
-- Verify patient exists
SELECT id FROM patients WHERE id = 'patient-id-here';

-- Check RLS policy
SELECT * FROM pg_policies
WHERE tablename = 'pump_assessments';

-- If policy references pump_users, update it:
DROP POLICY IF EXISTS pump_user_access ON pump_assessments;

CREATE POLICY pump_user_access ON pump_assessments
    FOR ALL
    USING (
        auth.uid()::text = patient_id
        OR EXISTS (
            SELECT 1 FROM patients
            WHERE id = pump_assessments.patient_id
        )
    );
```

### Issue 3: Providers can't see patient data

**Symptom:** Empty results when querying patient tables

**Causes:**
- Missing relationship in RLS policy
- Provider not linked to patients

**Fix:**
```sql
-- Create provider-patient relationship if needed
CREATE TABLE IF NOT EXISTS provider_patients (
    provider_id TEXT REFERENCES medical_staff(id),
    patient_id TEXT REFERENCES patients(id),
    PRIMARY KEY (provider_id, patient_id)
);

-- Update RLS policy to check relationship
CREATE POLICY provider_patient_access ON patients
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM provider_patients
            WHERE provider_id = auth.uid()::text
              AND patient_id = patients.id
        )
    );
```

---

## Success Criteria

### ✅ Phase 1 Complete When:
- [ ] All 27 tables have RLS enabled
- [ ] RLS policies exist for each table
- [ ] Unauthenticated access is blocked
- [ ] Providers can access their own data
- [ ] Pump assessments can be saved
- [ ] No critical application features broken

### ✅ Phase 2 Complete When:
- [ ] Supabase BAA signed and active
- [ ] Deepgram BAA signed and active
- [ ] HIPAA add-on enabled ($350/month)
- [ ] High Compliance mode activated
- [ ] Legal team has reviewed setup

### ✅ Phase 3 Complete When:
- [ ] Audit logging implemented
- [ ] Monthly security reviews scheduled
- [ ] Automated RLS tests in CI/CD
- [ ] Incident response plan documented
- [ ] Staff HIPAA training completed

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Supabase Team Plan | ~$25/month | Monthly |
| Supabase HIPAA Add-on | $350/month | Monthly |
| Deepgram BAA | $0 (included) | One-time |
| Legal Review (optional) | $500-2000 | One-time |
| Penetration Testing (recommended) | $2000-5000 | Annually |
| **Total Monthly** | **$375/month** | Ongoing |
| **Initial Setup** | **$500-2000** | One-time |

---

## Timeline

| Phase | Duration | Start |
|-------|----------|-------|
| Phase 1: Enable RLS | 1-2 hours | Today |
| Phase 1: Testing | 4-8 hours | Today |
| Phase 2: Sign BAAs | 1-2 weeks | This week |
| Phase 2: Enable HIPAA | 1 day | After BAA |
| Phase 3: Monitoring Setup | 1 week | After BAA |
| **Total to Full Compliance** | **2-3 weeks** | - |

---

## Next Steps

1. **RIGHT NOW:** Execute Phase 1 (Enable RLS)
   - File: `database/migrations/URGENT-enable-rls-all-tables.sql`
   - Location: Supabase SQL Editor
   - Time: 30 minutes

2. **TODAY:** Test and validate
   - Run verification queries
   - Test application features
   - Monitor for errors

3. **THIS WEEK:** Start BAA process
   - Contact Supabase sales
   - Contact Deepgram support
   - Prepare legal documents

4. **ONGOING:** Maintain compliance
   - Monthly security reviews
   - Audit log monitoring
   - Policy updates as needed

---

## Questions?

If you encounter any issues:

1. Check Troubleshooting section above
2. Review Supabase docs: https://supabase.com/docs/guides/security/hipaa-compliance
3. Check Deepgram docs: https://developers.deepgram.com/trust-security/data-privacy-compliance
4. Create an issue in the project repo

---

**Document Status:** Ready to Execute
**Last Updated:** January 8, 2026
**Next Review:** After Phase 1 completion
