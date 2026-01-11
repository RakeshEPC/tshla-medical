# RLS Policy Safeguards - Complete Guide

## Executive Summary

**Problem**: Auth system changes (MFA, password policies, session changes) can delete all RLS policies from Supabase tables, causing features to break silently.

**Impact**: Templates page shows 0 results, users cannot access data despite records existing in database.

**Solution**: 4-layer prevention system with automated detection, version-controlled policies, and instant restoration.

---

## Table of Contents

1. [Why This Matters](#why-this-matters)
2. [The 4-Layer Prevention System](#the-4-layer-prevention-system)
3. [Quick Start Guide](#quick-start-guide)
4. [Tool Reference](#tool-reference)
5. [Incident Response](#incident-response)
6. [Best Practices](#best-practices)

---

## Why This Matters

### The Problem

**Jan 8, 2026**: MFA implementation deployed to Supabase auth system
**Jan 11, 2026**: Users report "templates page is empty"
**Root cause**: MFA deployment **deleted all RLS policies** on templates table

**Timeline**:
- Jan 8, 2:20 PM: MFA deployed
- Jan 8-11: RLS policies missing (3 days)
- Jan 11: Issue discovered, policies manually recreated

**Impact**:
- 16 templates existed in database
- RLS was **enabled** but policies **deleted**
- Users saw 0 templates (silent failure)
- 3-day outage before detection

### Why Auth Changes Delete Policies

Supabase auth system changes (MFA, session hardening, password policies) can trigger:
1. Auth schema migrations
2. Security policy resets as a safety measure
3. RLS policy deletions to prevent orphaned access rules

This is **by design** for security, but means we must:
- Version control policies like code
- Validate after every auth change
- Automate restoration

---

## The 4-Layer Prevention System

### Layer 1: Version Control (Source of Truth)

**File**: `supabase/policies/templates.sql`

This is the **single source of truth** for all RLS policies. Stored in git, reviewed in PRs, deployed like code.

**Contents**:
- All 6 RLS policies for templates table
- Documentation for each policy
- Test queries to verify policies work
- Troubleshooting guide

**Usage**:
```bash
# View current policies
cat supabase/policies/templates.sql

# Edit policies (then commit to git)
git add supabase/policies/templates.sql
git commit -m "Update RLS policies"
```

### Layer 2: Automated Validation (CI/CD)

**File**: `.github/workflows/rls-validation.yml`

Runs automatically:
- ✅ On every push to main
- ✅ On every pull request
- ✅ Daily at 8 AM UTC (catches drift)

**What it does**:
1. Connects to Supabase with SERVICE_ROLE_KEY
2. Queries templates table (should return 16 records)
3. Tests ANON access (simulates user browser)
4. Fails build if policies missing
5. Creates GitHub issue if daily check fails
6. Comments on PR with fix instructions

**Result**: Cannot deploy broken RLS policies to production.

### Layer 3: Instant Diagnostics

**Script**: `scripts/check-rls-policies.cjs`

Run anytime templates or data stops loading:

```bash
node scripts/check-rls-policies.cjs
```

**Output**:
```
🔍 Checking RLS policies on templates table...

✅ Total templates in database: 16
✅ System templates: 13

🧪 Testing with ANON key (simulates user browser)...
❌ ANON client query FAILED: RLS blocking

📋 SUMMARY:
Templates in database: 16
Accessible via SERVICE_ROLE: ✅ Yes
Accessible via ANON (user): ❌ NO - RLS BLOCKING

🔧 ACTION REQUIRED:
   1. Restore policies: node scripts/restore-rls-policies.cjs
```

**Exit codes**:
- `0` = Policies working correctly
- `1` = Policies missing or broken

### Layer 4: One-Command Restoration

**Script**: `scripts/restore-rls-policies.cjs`

Restores policies from source of truth in 30 seconds:

```bash
node scripts/restore-rls-policies.cjs
```

**What it does**:
1. Reads `supabase/policies/templates.sql`
2. Opens Supabase SQL Editor in your browser
3. Shows SQL to copy-paste
4. Guides you through restoration

**Result**: Policies restored in <1 minute, templates load again.

---

## Quick Start Guide

### Daily Operations

**Nothing to do!** GitHub Actions validates policies automatically every day.

### When Auth Changes Deployed

**Before deploying MFA, password changes, or session updates**:

```bash
# 1. Backup current state
node scripts/backup-rls-policies.cjs

# 2. Verify source of truth is up-to-date
cat supabase/policies/templates.sql

# 3. Test restore script works (dry run)
node scripts/restore-rls-policies.cjs --dry-run
```

**After deploying auth changes**:

```bash
# 1. Validate policies still exist
node scripts/validate-rls-policies.cjs

# 2. If validation fails, restore immediately
node scripts/restore-rls-policies.cjs

# 3. Verify templates load
# Go to: https://www.tshla.ai/templates
```

### When Users Report "No Templates"

```bash
# Step 1: Diagnose
node scripts/check-rls-policies.cjs

# Step 2: Restore policies
node scripts/restore-rls-policies.cjs

# Step 3: Verify fix
node scripts/validate-rls-policies.cjs
```

---

## Tool Reference

### 1. Source of Truth File

**File**: `supabase/policies/templates.sql`

**Purpose**: Single source of truth for all RLS policies

**When to update**:
- Adding new template features
- Changing permission model
- Adding role-based access control

**After updating**:
```bash
node scripts/restore-rls-policies.cjs
git add supabase/policies/templates.sql
git commit -m "Update RLS policies: [describe change]"
```

### 2. Backup Script

**Script**: `scripts/backup-rls-policies.cjs`

**Purpose**: Export current policies from Supabase to a file

**Usage**:
```bash
# Backup templates policies
node scripts/backup-rls-policies.cjs

# Backup other table
node scripts/backup-rls-policies.cjs --table=medical_staff

# Custom output location
node scripts/backup-rls-policies.cjs --output=backup-2026-01-11.sql
```

**Output**: Creates `supabase/policies/templates-backup.sql`

**When to use**:
- Before making policy changes
- Before auth system updates
- Monthly backups (good practice)

### 3. Restore Script

**Script**: `scripts/restore-rls-policies.cjs`

**Purpose**: Apply policies from source file to Supabase database

**Usage**:
```bash
# Restore templates policies
node scripts/restore-rls-policies.cjs

# Restore other table
node scripts/restore-rls-policies.cjs --table=medical_staff

# Dry run (see SQL without executing)
node scripts/restore-rls-policies.cjs --dry-run
```

**What it does**:
1. Reads `supabase/policies/{table}.sql`
2. Opens Supabase SQL Editor in browser
3. Displays SQL to copy-paste
4. Guides through execution

**When to use**:
- After auth changes delete policies
- When validation fails
- After manual policy deletions

### 4. Validation Script

**Script**: `scripts/validate-rls-policies.cjs`

**Purpose**: Check if required RLS policies exist and work correctly

**Usage**:
```bash
# Validate templates policies
node scripts/validate-rls-policies.cjs

# Validate other table
node scripts/validate-rls-policies.cjs --table=medical_staff

# CI mode (machine-readable output)
node scripts/validate-rls-policies.cjs --ci

# Strict mode (fail if ANY policy missing)
node scripts/validate-rls-policies.cjs --strict
```

**Exit codes**:
- `0` = All policies exist and working
- `1` = Policies missing or broken
- `2` = Cannot connect to Supabase

**When to use**:
- In CI/CD pipelines
- After auth deployments
- When debugging access issues

### 5. Diagnostic Script

**Script**: `scripts/check-rls-policies.cjs`

**Purpose**: Detailed diagnostics with human-readable output

**Usage**:
```bash
node scripts/check-rls-policies.cjs
```

**Output**:
- Total records in database
- Accessible records via SERVICE_ROLE
- Accessible records via ANON (simulates user)
- Detailed error messages
- Fix instructions

**When to use**:
- When users report empty data
- When debugging template issues
- During incident response

### 6. GitHub Actions Workflow

**File**: `.github/workflows/rls-validation.yml`

**Purpose**: Automated validation on every deployment

**Triggers**:
- Push to main branch
- Pull requests
- Daily at 8 AM UTC
- Manual trigger (workflow_dispatch)

**Actions**:
- Validates policies exist
- Comments on PR if validation fails
- Creates GitHub issue if daily check fails
- Auto-closes issues when policies restored

**Notifications**:
- GitHub notifications when validation fails
- Issue created with fix instructions
- PR comments with policy status

---

## Incident Response

### Scenario 1: Templates Page Empty

**Symptoms**:
- Users see 0 templates
- Database has 16 templates
- No errors in browser console

**Diagnosis**:
```bash
node scripts/check-rls-policies.cjs
```

**Expected output**:
```
❌ ANON client query FAILED: RLS blocking
```

**Fix**:
```bash
node scripts/restore-rls-policies.cjs
```

**Verification**:
1. Go to https://www.tshla.ai/templates
2. Login as admin@tshla.ai / TshlaAdmin2025!
3. Should see 16 templates

**Time to fix**: <5 minutes

### Scenario 2: GitHub Actions RLS Validation Failed

**Symptoms**:
- PR shows "RLS Policy Validation" check failed
- Cannot merge PR

**Diagnosis**:
Check the GitHub Actions log for details

**Fix**:
```bash
# Local validation
node scripts/validate-rls-policies.cjs

# If failed, restore policies
node scripts/restore-rls-policies.cjs

# Verify
node scripts/validate-rls-policies.cjs
```

**Then**: Re-run GitHub Actions workflow

### Scenario 3: Daily RLS Check Created Issue

**Symptoms**:
- GitHub issue: "🚨 RLS Policies Missing or Misconfigured"
- Label: `rls-policy-drift`

**This means**: Policies were deleted outside of version control (likely auth change)

**Fix**:
```bash
node scripts/restore-rls-policies.cjs
```

**After fix**: GitHub Actions will automatically close the issue on next run

### Scenario 4: After MFA/Auth Deployment

**Symptoms**:
- Just deployed MFA or password policy change
- Want to verify policies still exist

**Check**:
```bash
node scripts/validate-rls-policies.cjs
```

**If passed**: No action needed

**If failed**:
```bash
node scripts/restore-rls-policies.cjs
```

---

## Best Practices

### Before Auth Changes

1. **Document in PR**: "This change may affect RLS policies"
2. **Backup policies**: `node scripts/backup-rls-policies.cjs`
3. **Test restore**: `node scripts/restore-rls-policies.cjs --dry-run`
4. **Notify team**: Post in Slack about potential impact
5. **Schedule deployment**: During maintenance window

### After Auth Changes

1. **Immediate validation**: `node scripts/validate-rls-policies.cjs`
2. **Test user access**: Login and verify templates load
3. **Monitor logs**: Check for RLS errors
4. **Document incident**: If policies deleted, note in incident log
5. **Review automation**: Ensure GitHub Actions passed

### Regular Maintenance

1. **Monthly backups**: Run backup script first week of month
2. **Review policies**: Ensure source of truth is accurate
3. **Update documentation**: Keep policy descriptions current
4. **Test restoration**: Quarterly test restore script works
5. **Monitor GitHub issues**: Subscribe to `rls-policy-drift` label

### Code Review Checklist

When reviewing PRs that touch Supabase or auth:

- [ ] Does this change authentication system?
- [ ] Have RLS policies been backed up?
- [ ] Is `supabase/policies/templates.sql` up-to-date?
- [ ] Has restore script been tested?
- [ ] Is validation passing in CI/CD?
- [ ] Are fix instructions documented?

---

## Troubleshooting

### Validation Script Returns False Positive

**Problem**: Script says policies missing but templates load fine

**Cause**: ANON key might be expired or test query incorrect

**Fix**:
1. Check ANON key in script: `scripts/validate-rls-policies.cjs`
2. Verify Supabase project URL is correct
3. Test manually in browser console:
   ```javascript
   const { data } = await supabase.from('templates').select('*');
   console.log('Templates:', data?.length);
   ```

### Restore Script Doesn't Open Browser

**Problem**: `restore-rls-policies.cjs` doesn't auto-open SQL Editor

**Cause**: `open` command not available on Linux

**Fix**:
1. Manually open: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new
2. Copy SQL from terminal output
3. Paste into SQL Editor
4. Click "Run"

### Policies Restored But Templates Still Empty

**Problem**: Ran restore script but users still see 0 templates

**Possible causes**:

1. **Browser cache**: Clear browser cache and reload
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **SQL typos**: Verify policies were created
   ```sql
   SELECT COUNT(*) FROM pg_policies
   WHERE tablename = 'templates' AND schemaname = 'public';
   -- Expected: 6
   ```

3. **Auth not linked**: Check medical_staff.auth_user_id matches
   ```bash
   node scripts/diagnose-login.ts
   ```

4. **Different issue**: Not RLS-related, check browser console for errors

### GitHub Actions Can't Connect to Supabase

**Problem**: RLS validation workflow fails with "Cannot connect"

**Cause**: Missing secrets or wrong URLs

**Fix**:
1. Check GitHub Secrets:
   - `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Verify secrets are not expired
3. Test locally with same credentials

---

## Metrics & Monitoring

### Success Metrics

**Before safeguards (Jan 2026)**:
- Policy detection time: 3 days
- Manual restoration time: 2 hours
- Recurrence: Every auth change

**After safeguards (Goal)**:
- Policy detection time: <1 minute (automated)
- Restoration time: <5 minutes
- Prevention: Caught in CI before production

### Monitoring Checklist

- [ ] GitHub Actions RLS validation passing
- [ ] No open issues with `rls-policy-drift` label
- [ ] Daily validation emails not failing
- [ ] Templates page loading for all users
- [ ] No RLS errors in browser console

---

## Related Documentation

- [Quick Fix Guide](QUICK_FIX_TEMPLATES_RLS.md) - 5-minute emergency fix
- [Supabase RLS Policies](SUPABASE_RLS_POLICIES.md) - Policy details and SQL
- [Infrastructure Checklist](INFRASTRUCTURE_CHANGE_CHECKLIST.md) - Deployment checklist
- [MFA Impact](MFA_IMPLEMENTATION_IMPACT.md) - Jan 8 incident post-mortem
- [Password Reset Protocol](PASSWORD_RESET_PROTOCOL.md) - Auth change procedures

---

## FAQ

### Q: Why can't we just disable RLS?

**A**: HIPAA compliance requires row-level security. Disabling RLS would allow:
- Any user to see all templates (including private ones)
- Potential data breaches
- Violation of medical privacy regulations

### Q: Can we prevent auth changes from deleting policies?

**A**: No, this is Supabase's security behavior. Instead, we:
- Version control policies in git
- Automate validation after every deployment
- Enable instant restoration with one command

### Q: What happens if policies deleted on a Friday night?

**A**:
- GitHub Actions detects within minutes
- Creates high-priority issue automatically
- Fix takes <5 minutes with restore script
- No need to wait for Monday

### Q: Do we need policies for other tables?

**A**: Yes! Follow same pattern:
1. Create `supabase/policies/{table}.sql`
2. Update validation script with table requirements
3. Add to CI/CD workflow
4. Document in INFRASTRUCTURE_CHANGE_CHECKLIST.md

### Q: How often should we backup policies?

**A**:
- **Automatically**: Before every auth change
- **Manually**: Monthly (first week)
- **Emergency**: Before risky deployments

---

## Contact

**Questions**: rakesh@tshla.ai

**Emergency**: Run diagnostic script and follow output
```bash
node scripts/check-rls-policies.cjs
```

**Feedback**: Create GitHub issue with label `rls-safeguards`

---

**Last Updated**: 2026-01-11
**Version**: 1.0
**Reviewed By**: Rakesh Patel
