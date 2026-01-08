# RLS Security Fix - Quick Start Checklist

**🔴 CRITICAL SECURITY FIX - DO THIS NOW**

---

## ⚡ 30-Minute Quick Fix (Stops the Bleeding)

### Step 1: Open Supabase SQL Editor (2 min)
1. Go to: https://supabase.com/dashboard
2. Select your project: `minvvjdflezibmgkplqb`
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query**

### Step 2: Run the RLS Migration (10 min)
1. Open file: `database/migrations/URGENT-enable-rls-all-tables.sql`
2. Copy ALL contents (Cmd+A, Cmd+C)
3. Paste into SQL Editor
4. Click: **Run** button
5. Wait for: "✅ RLS ENABLEMENT COMPLETE"

### Step 3: Verify It Worked (3 min)
```sql
-- Run this query:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('dictated_notes', 'patients', 'appointments')
ORDER BY tablename;

-- All should show rowsecurity = TRUE
```

### Step 4: Test Your App (15 min)
- [ ] Try creating a dictation note (should work)
- [ ] Try viewing appointments (should work)
- [ ] Try saving pump assessment (should work)
- [ ] Open browser console, try: `supabase.from('dictated_notes').select('*')` without login (should FAIL with error)

---

## ✅ Success Criteria

You're done with the critical fix when:
- [x] SQL script ran without errors
- [x] All tables show `rowsecurity = true`
- [x] App still works for logged-in users
- [x] Unauthenticated access is blocked

**Congratulations! You've closed the critical security hole.**

---

## 📋 Follow-Up Tasks (Do Within 2 Weeks)

### Legal Requirements
- [ ] Sign BAA with Supabase
  - Email: sales@supabase.com
  - Cost: $350/month HIPAA add-on
  - Timeline: 1-2 weeks

- [ ] Sign BAA with Deepgram
  - Contact: https://deepgram.com/contact
  - Cost: $0 (included)
  - Timeline: 1-2 weeks

### Configuration
- [ ] Enable HIPAA add-on in Supabase (after BAA signed)
- [ ] Enable High Compliance mode
- [ ] Review compliance checklist

### Monitoring
- [ ] Set up audit logging
- [ ] Schedule monthly security reviews
- [ ] Add RLS tests to CI/CD

---

## 🆘 Emergency Contacts

**If something breaks after RLS migration:**

1. **Check Supabase Logs:**
   - Dashboard → Logs → Postgres Logs
   - Look for: "policy violation" errors

2. **Quick Rollback (ONLY IF CRITICAL):**
   ```sql
   -- EMERGENCY ONLY - This disables security!
   ALTER TABLE tablename DISABLE ROW LEVEL SECURITY;
   -- Replace 'tablename' with the problem table
   ```

3. **Get Help:**
   - Supabase Support: https://supabase.com/dashboard/support
   - Check: `RLS-REMEDIATION-GUIDE.md` (detailed troubleshooting)

---

## 📊 What Just Happened?

**Before RLS:**
- ❌ ANY user could read ALL patient data
- ❌ Anonymous users could see clinical notes
- ❌ HIPAA violation

**After RLS:**
- ✅ Users can only see their own data
- ✅ Providers isolated from each other
- ✅ Anonymous access blocked
- ✅ HIPAA-compliant (with BAA)

---

## 💰 Cost Impact

| Item | Cost |
|------|------|
| Enabling RLS | $0 |
| Supabase HIPAA Add-on | $350/month |
| Deepgram BAA | $0 |
| **Total** | **$350/month** |

**Note:** HIPAA add-on is legally required if storing PHI

---

## Next Steps

1. ✅ **Done:** Critical RLS fix
2. **This Week:** Contact Supabase/Deepgram for BAAs
3. **Next 2 Weeks:** Sign BAAs and enable HIPAA mode
4. **Ongoing:** Monitor and maintain

---

**Full Documentation:** See `RLS-REMEDIATION-GUIDE.md` for complete details

**Created:** January 8, 2026
**Status:** Ready to Execute
