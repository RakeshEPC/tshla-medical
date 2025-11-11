# Migration Protocol

**Purpose:** Standardized process for system-wide migrations to prevent incomplete changes

**Version:** 1.0
**Created:** November 11, 2024
**Status:** Active

---

## Table of Contents

1. [When to Use This Protocol](#when-to-use-this-protocol)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Process](#migration-process)
4. [Post-Migration Verification](#post-migration-verification)
5. [Rollback Plan](#rollback-plan)
6. [Example: Auth Service Migration](#example-auth-service-migration)

---

## When to Use This Protocol

Use this protocol for ANY of the following changes:

- ✅ Authentication system changes
- ✅ Database schema modifications
- ✅ API endpoint changes
- ✅ Service refactoring (replacing old services with new ones)
- ✅ Table renames or consolidations
- ✅ Breaking changes to shared utilities
- ✅ Major dependency upgrades (React, TypeScript, etc.)

**Rule of Thumb:** If the change affects more than 3 files or requires coordination between frontend and backend, use this protocol.

---

## Pre-Migration Checklist

### 1. Document Current State

Create a `MIGRATION_PLAN_[NAME].md` file with:

```markdown
# Migration Plan: [NAME]

## Current State
- What exists today
- Which files use the old system
- Database schema (if applicable)

## Target State
- What we're migrating to
- Why we're making this change
- Benefits of new system

## Affected Files
List ALL files that need changes:
- [ ] File 1
- [ ] File 2
- [ ] File 3

## Dependencies
- Backend changes required?
- Database migrations required?
- Environment variable changes?

## Estimated Timeline
- Research: X hours
- Implementation: X hours
- Testing: X hours
- Deployment: X hours
```

### 2. Search for All References

**CRITICAL:** Find EVERY place the old system is used

```bash
# Search for old service imports
grep -r "oldServiceName" src/

# Search for old database tables
grep -r "old_table_name" src/ server/

# Search for old API endpoints
grep -r "/old-endpoint" src/

# Search for old function calls
grep -r "oldFunction(" src/
```

**Create a spreadsheet or checklist of ALL findings**

### 3. Create Migration Branch

```bash
git checkout -b migration/[descriptive-name]

# Create backup branch
git checkout -b backup/[descriptive-name]-$(date +%Y%m%d)
git push origin backup/[descriptive-name]-$(date +%Y%m%d)
```

### 4. Set Up Automated Checks

**Before starting migration:**

1. Add TypeScript `@deprecated` tags to old code
2. Add ESLint rule to warn about old patterns
3. Document the migration in `ARCHITECTURE.md`

---

## Migration Process

### Phase 1: Implement New System (No Breaking Changes)

**Goal:** New system works alongside old system

1. **Create new service/table/API**
   ```typescript
   // Create new service but don't delete old one yet
   export class NewService {
     // ... implementation
   }
   ```

2. **Add tests for new system**
   - Unit tests
   - Integration tests
   - End-to-end tests

3. **Deploy new system**
   - Backend first (if applicable)
   - Then frontend

4. **Verify new system works**
   - Test in staging
   - Monitor logs
   - Check metrics

**Checkpoint:** New system is deployed and working, old system still functional

---

### Phase 2: Migrate Consumers (One by One)

**Goal:** Update all code to use new system

**CRITICAL RULE:** Update files ONE AT A TIME, not all at once

#### For Each File:

```bash
# 1. Update the file
# - Change imports
# - Change function calls
# - Update types/interfaces

# 2. Test the file
npm run typecheck
npm run lint
npm test

# 3. Manual testing
# - Does the page load?
# - Does the feature work?
# - Check browser console for errors

# 4. Commit immediately
git add [file]
git commit -m "migrate: Update [file] to use [new system]"

# 5. Deploy and verify
# - Push to staging
# - Test in staging
# - Monitor for errors
# - If OK, push to production
```

**Track Progress:**

Create `MIGRATION_STATUS.md`:

```markdown
## Migration Status: [NAME]

### Completed ✅
- [x] File1.tsx - Committed in abc123
- [x] File2.tsx - Committed in def456

### In Progress 🔄
- [ ] File3.tsx - Currently testing

### Not Started ⏸️
- [ ] File4.tsx
- [ ] File5.tsx

### Blocked ⛔
- [ ] File6.tsx - Waiting for backend deployment
```

**Update this file after EVERY change**

---

### Phase 3: Deprecate Old System

**Goal:** Prevent new code from using old system

1. **Mark as deprecated**
   ```typescript
   /**
    * @deprecated Since [DATE] - Use NewService instead
    * Will be removed in v[VERSION]
    *
    * Migration guide: See ARCHITECTURE.md
    */
   export class OldService { ... }
   ```

2. **Add ESLint rule**
   ```javascript
   // eslint.config.js
   'no-restricted-imports': [
     'error',
     {
       patterns: [{
         group: ['**/oldService'],
         message: '⚠️ oldService is deprecated! Use newService'
       }]
     }
   ]
   ```

3. **Add pre-commit hook**
   ```bash
   # .husky/pre-commit
   if git diff --cached | grep -q "oldService"; then
     echo "❌ Cannot commit code using deprecated oldService"
     exit 1
   fi
   ```

4. **Add console warning**
   ```typescript
   export class OldService {
     constructor() {
       console.warn(
         '⚠️ DEPRECATED: OldService will be removed.\n' +
         'Use NewService instead. See ARCHITECTURE.md'
       );
     }
   }
   ```

**Checkpoint:** Old system still works but developers get warnings

---

### Phase 4: Remove Old System

**WAIT AT LEAST 1 WEEK** after Phase 3 before proceeding

**Verification before deletion:**

```bash
# 1. Verify NO files use old system
grep -r "OldService" src/
grep -r "OldService" server/

# Expected: Only deprecated file itself

# 2. Check production logs
# - No errors related to old system
# - No API calls to old endpoints
# - No database queries to old tables

# 3. Verify in staging
# - Test all critical flows
# - Check browser console
# - Monitor backend logs

# 4. Get approval
# - Team lead review
# - QA testing complete
# - Documentation updated
```

**Only if ALL checks pass:**

```bash
# Delete old files
git rm src/services/oldService.ts
git commit -m "cleanup: Remove deprecated oldService"

# Drop old database tables (if applicable)
# - Create backup first!
# - Schedule during maintenance window
# - Have rollback plan ready

# Remove from documentation
# - Update ARCHITECTURE.md
# - Archive old docs to docs/archive/
```

---

## Post-Migration Verification

### Automated Checks

```bash
# 1. Build succeeds
npm run build

# 2. No TypeScript errors
npm run typecheck

# 3. Linting passes
npm run lint

# 4. Tests pass
npm test

# 5. No references to old system
grep -r "OldService" src/ && echo "❌ Found references!" || echo "✅ Clean"
```

### Manual Checks

- [ ] All pages load without errors
- [ ] All features work correctly
- [ ] No console errors in browser
- [ ] No errors in backend logs
- [ ] Database queries work
- [ ] Authentication works
- [ ] User permissions work
- [ ] Mobile view works
- [ ] Production smoke test passed

### Monitoring (First 24 Hours)

After deploying to production:

- [ ] Monitor error rates (should not increase)
- [ ] Monitor API response times (should not degrade)
- [ ] Monitor database query performance
- [ ] Check customer support tickets (no new issues)
- [ ] Review user feedback channels

**If ANY issues found:** Activate rollback plan immediately

---

## Rollback Plan

### Preparation (Before Migration)

1. **Create rollback branch**
   ```bash
   git checkout -b rollback/[name]-$(date +%Y%m%d)
   git push origin rollback/[name]-$(date +%Y%m%d)
   ```

2. **Backup database** (if schema changes)
   ```bash
   # Create snapshot in Supabase dashboard
   # Or export full database
   pg_dump database_url > backup_$(date +%Y%m%d).sql
   ```

3. **Document rollback steps**
   ```markdown
   # Rollback Plan: [NAME]

   ## Frontend Rollback
   1. git checkout rollback/[name]
   2. npm run build
   3. Deploy to production

   ## Backend Rollback
   1. Revert to previous container revision
   2. Re-enable old API endpoints

   ## Database Rollback
   1. Restore from backup
   2. Re-apply old RLS policies
   ```

### When to Rollback

Rollback IMMEDIATELY if:

- ❌ Critical feature is broken
- ❌ Users cannot log in
- ❌ Data loss or corruption detected
- ❌ Error rate >5% increase
- ❌ API response time >2x slower
- ❌ Database queries failing

**DO NOT wait to fix forward** - Rollback first, then fix in development

### Rollback Procedure

```bash
# 1. Stop deployment
gh workflow cancel [run-id]

# 2. Revert frontend
git checkout rollback/[name]
npm run build
# Deploy via GitHub Actions or manual

# 3. Revert backend (if applicable)
az containerapp revision activate --revision [previous-revision]

# 4. Restore database (if applicable)
psql database_url < backup_file.sql

# 5. Notify team
# - Post in Slack/Discord
# - Update status page
# - Inform stakeholders

# 6. Create incident report
# - What went wrong
# - Why it wasn't caught
# - How to prevent in future
```

---

## Example: Auth Service Migration

### Real-World Example from November 2024

**What Went Wrong:**

October 9, 2024:
- ✅ Updated `PatientLogin.tsx` to use `supabaseAuthService`
- ❌ Forgot to update `PumpDriveAuthGuard.tsx`

November 11, 2024:
- Bug discovered: Users could log in but got redirected back to login
- Root cause: Auth guard still checked for old `pump_auth_token`
- **30+ days of broken logins** before discovery

**What Should Have Been Done:**

1. **Pre-Migration Search**
   ```bash
   grep -r "pumpAuthService" src/
   # Would have found PumpDriveAuthGuard.tsx
   ```

2. **Created Checklist**
   ```markdown
   ## Files Using pumpAuthService
   - [ ] PatientLogin.tsx
   - [ ] PumpDriveAuthGuard.tsx  ← MISSED THIS
   - [ ] PumpDriveResults.tsx
   - [ ] AssessmentHistory.tsx
   ```

3. **Updated All Files** before marking migration complete

4. **Added Automated Checks**
   - ESLint rule
   - Pre-commit hook
   - TypeScript @deprecated tags

**Lesson Learned:**

> Never assume you found all references. Always search the entire codebase and create an exhaustive checklist.

---

## Migration Checklist Template

Use this for every migration:

```markdown
# Migration Checklist: [NAME]

## Pre-Migration
- [ ] Created migration plan document
- [ ] Searched for ALL references
- [ ] Created migration branch
- [ ] Created backup branch
- [ ] Set up automated checks
- [ ] Documented current state
- [ ] Got team approval

## Phase 1: New System
- [ ] Implemented new system
- [ ] Added tests
- [ ] Deployed to staging
- [ ] Verified working
- [ ] Deployed to production
- [ ] Monitored for 24 hours

## Phase 2: Migration
- [ ] Updated file 1
- [ ] Updated file 2
- [ ] Updated file 3
... (one checkbox per file)
- [ ] All files migrated
- [ ] All tests passing
- [ ] Deployed to staging
- [ ] QA testing complete
- [ ] Deployed to production
- [ ] Monitored for 24 hours

## Phase 3: Deprecation
- [ ] Added @deprecated tags
- [ ] Added ESLint rule
- [ ] Added pre-commit hook
- [ ] Added console warnings
- [ ] Updated ARCHITECTURE.md
- [ ] Waited 1+ week

## Phase 4: Cleanup
- [ ] Verified no references
- [ ] Checked production logs
- [ ] Team review approved
- [ ] Deleted old files
- [ ] Dropped old tables (if applicable)
- [ ] Updated documentation
- [ ] Archived old docs

## Verification
- [ ] Build succeeds
- [ ] TypeScript passes
- [ ] Linting passes
- [ ] Tests pass
- [ ] Manual testing complete
- [ ] Production smoke test
- [ ] 24-hour monitoring complete
- [ ] No issues reported
```

---

## Success Criteria

A migration is considered **successfully complete** when:

✅ All automated checks pass
✅ All manual tests pass
✅ Zero production incidents for 7 days
✅ No references to old system found
✅ Documentation updated
✅ Team trained on new system
✅ Old system removed (if applicable)
✅ Rollback plan documented and tested

---

## Additional Resources

- **ARCHITECTURE.md** - Current system architecture
- **CLEANUP-CHECKLIST.md** - List of deprecated code to remove
- **.husky/pre-commit** - Automated pre-commit checks
- **eslint.config.js** - Linting rules including deprecated patterns

---

**Remember:** Taking an extra day to do a migration carefully is better than spending 30 days debugging production issues.

**Last Updated:** November 11, 2024
