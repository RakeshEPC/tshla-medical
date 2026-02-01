# TSH ID Bug Prevention Measures

**Created:** February 1, 2026
**Purpose:** Prevent patient_id/tshla_id confusion from happening again
**Status:** ✅ All safeguards implemented

---

## The Problem (What We're Preventing)

**Bug:** Schedule was displaying raw 8-digit `patient_id` (e.g., "99364924") instead of formatted `tshla_id` (e.g., "TSH 972-918") in purple.

**Root Cause:** Developer confusion between two similar-looking fields:
- `patient.patient_id` → 8-digit internal ID
- `patient.tshla_id` → Formatted TSH ID for display

---

## 6 Layers of Protection Implemented

### 1. TypeScript Interface with Warnings ✅

**File:** [src/types/unified-patient.types.ts](src/types/unified-patient.types.ts)

**What it does:**
- Provides strict TypeScript types for UnifiedPatient
- Includes extensive JSDoc comments explaining each field
- Warns developers which field to use for what purpose

**How it helps:**
- IDE autocomplete shows the right field names
- Inline documentation explains the difference
- TypeScript catches type mismatches

**Example:**
```typescript
export interface UnifiedPatient {
  /**
   * 8-digit internal patient ID (PERMANENT - never changes)
   * ⚠️ DO NOT use this for UI display!
   * For display, use tshla_id instead!
   */
  patient_id: string;

  /**
   * Formatted TSH ID for display
   * ✅ USE THIS for schedule display (purple number)
   */
  tshla_id: string;
}
```

---

### 2. Helper Function with Validation ✅

**File:** [src/utils/patient-id-formatter.ts](src/utils/patient-id-formatter.ts)

**What it does:**
- Provides safe helper functions to extract patient IDs
- Validates TSH ID format automatically
- Logs errors if wrong field is used
- Makes it impossible to mess up

**Key functions:**
```typescript
// Use this instead of accessing fields directly
getDisplayTshId(patient)         // Returns "TSH 972-918"
getDisplayMrn(patient, fallback) // Returns MRN
getSchedulePatientIds(patient)   // Returns all IDs safely
```

**How it helps:**
- Developer doesn't have to remember which field to use
- Automatic validation catches mistakes
- Errors logged in development mode
- Single source of truth for ID formatting

---

### 3. Automated Tests ✅

**File:** [src/__tests__/schedule-tsh-id.test.ts](src/__tests__/schedule-tsh-id.test.ts)

**What it does:**
- Tests that TSH ID is formatted correctly
- Tests that patient_id is NOT being used for display
- Regression tests specifically for this bug
- Runs automatically before deployment

**Example test:**
```typescript
it('CRITICAL: Schedule must NEVER show 8-digit patient_id', () => {
  const displayValue = getDisplayTshId(mockPatient);

  // FAIL if showing 8-digit number
  expect(displayValue).not.toMatch(/^\d{8}$/);

  // PASS only if showing formatted tshla_id
  expect(displayValue).toBe('TSH 972-918');
});
```

**How it helps:**
- Catches bugs before they reach production
- Runs on every build
- Fails deployment if bug is detected
- Documents expected behavior

---

### 4. Pre-Commit Hook Validation ✅

**File:** [.husky/pre-commit](../.husky/pre-commit#L82-L119)

**What it does:**
- Scans schedule files for patient_id misuse before commit
- Blocks commits that use wrong field
- Provides helpful error messages with fix instructions

**How it works:**
```bash
# Searches for this pattern (the bug):
tsh.*patient.patient_id
tshId.*patient.patient_id

# If found, shows error:
❌ Found patient_id being used for TSH ID display!
   Fix: Use patient.tshla_id instead
```

**How it helps:**
- Stops bad code from being committed
- Developer sees error immediately
- Can't push broken code to repository
- Provides fix instructions on the spot

---

### 5. Inline Code Comments ✅

**Files:**
- [src/components/ProviderScheduleViewLive.tsx](src/components/ProviderScheduleViewLive.tsx#L105-L123)
- [src/pages/SchedulePageV2.tsx](src/pages/SchedulePageV2.tsx#L602-L620)

**What they do:**
- Warn developers right at the point of use
- Explain which field is which
- Link to documentation

**Example:**
```typescript
// ========================================
// PATIENT IDENTIFIERS - CRITICAL!
// ========================================
// ⚠️ DO NOT CONFUSE patient_id with tshla_id!
//
// patient_id  = 8-digit internal ID (e.g., "99364924")
//               → ONLY for internal_id field
//               → NEVER use for display!
//
// tshla_id    = Formatted TSH ID (e.g., "TSH 972-918")
//               → USE for tsh_id field
//               → THIS is what shows in purple!
//
// See: src/types/unified-patient.types.ts
// See: TSH_ID_FORMAT_FIX.md
// ========================================
internal_id: patient?.patient_id,      // 8-digit (not displayed)
tsh_id: patient?.tshla_id,             // Formatted "TSH XXX-XXX" (purple)
```

**How they help:**
- Developer sees warnings while coding
- Can't miss the explanation
- Links to more documentation
- Reminder every time they touch the code

---

### 6. Step-by-Step Checklist ✅

**File:** [SCHEDULE_UPLOAD_CHECKLIST.md](SCHEDULE_UPLOAD_CHECKLIST.md)

**What it does:**
- Provides complete checklist for schedule uploads
- Includes verification steps for TSH ID format
- Step-by-step instructions with screenshots
- Common issues and solutions

**Key sections:**
1. Upload schedule CSV
2. Link appointments to patients
3. **Verify TSH ID display format** (critical!)
4. Code changes review
5. Deployment
6. Post-deployment verification

**How it helps:**
- Process is documented and repeatable
- Can't forget to verify TSH ID format
- New team members can follow checklist
- Catches issues before deployment

---

## How These Work Together

```
Developer makes changes to schedule code
              ↓
1. IDE shows TypeScript types with warnings
   "Use tshla_id, not patient_id"
              ↓
2. Developer uses helper function (optional but recommended)
   getDisplayTshId(patient)
              ↓
3. Developer runs tests locally
   npm test → TSH ID tests pass
              ↓
4. Developer tries to commit
   Pre-commit hook scans files
              ↓
5. If using patient_id incorrectly:
   ❌ Commit blocked with error message
   Developer fixes it
              ↓
6. Commit succeeds
   Code review shows inline warnings
              ↓
7. CI/CD runs automated tests
   Tests verify TSH ID format
              ↓
8. Deployment succeeds
   Follow checklist to verify production
              ↓
9. Post-deployment: Check actual schedule
   Verify TSH IDs show as "TSH XXX-XXX"
```

---

## What Each Layer Catches

| Layer | Catches | When | Severity |
|-------|---------|------|----------|
| **TypeScript Types** | Type mismatches | Development | Medium |
| **Helper Functions** | Invalid formats | Development | High |
| **Automated Tests** | Logic errors | Pre-commit / CI | Critical |
| **Pre-commit Hook** | Direct field access | Pre-commit | Critical |
| **Code Comments** | Developer confusion | Development | Medium |
| **Checklist** | Manual verification | Deployment | High |

---

## How to Use These Safeguards

### For Regular Schedule Uploads:

1. **Follow the checklist:** [SCHEDULE_UPLOAD_CHECKLIST.md](SCHEDULE_UPLOAD_CHECKLIST.md)
2. **Verify TSH ID format** in browser after upload
3. **No code changes needed** if just uploading CSV

### For Code Changes to Schedule Components:

1. **Read the inline comments** in schedule files
2. **Use helper functions:**
   ```typescript
   import { getDisplayTshId } from '@/utils/patient-id-formatter';
   tsh_id: getDisplayTshId(patient)
   ```
3. **Run tests** before committing:
   ```bash
   npm test schedule-tsh-id.test
   ```
4. **Pre-commit hook will catch** any mistakes
5. **Follow deployment checklist** to verify in production

---

## Red Flags to Watch For

### ❌ WRONG - Will Trigger Warnings:

```typescript
// Shows 8-digit number (99364924)
tsh_id: patient?.patient_id

// Same mistake, different variable name
tshId: patient.patient_id
```

### ✅ CORRECT - Safe:

```typescript
// Shows formatted ID (TSH 972-918)
tsh_id: patient?.tshla_id

// Or use helper (even better)
tsh_id: getDisplayTshId(patient)
```

---

## Maintenance

### Keep These Updated:

1. **Tests:** Add new test cases as edge cases are discovered
2. **Checklist:** Update process as workflow changes
3. **Types:** Update TypeScript interfaces if database schema changes
4. **Hook:** Adjust patterns if new files are added

### Review Quarterly:

- Are the safeguards still working?
- Have there been any related bugs?
- Do new team members understand the system?
- Are the docs still accurate?

---

## Success Metrics

**How to know this is working:**

✅ No TSH ID bugs in last 3 months
✅ Pre-commit hook catches attempts to use patient_id
✅ Tests pass on every build
✅ New developers understand the difference
✅ Schedule uploads follow checklist
✅ Production schedule shows correct format

---

## Summary

### 6 Safeguards Implemented:

1. ✅ **TypeScript types** with warnings
2. ✅ **Helper functions** with validation
3. ✅ **Automated tests** for TSH ID display
4. ✅ **Pre-commit hook** to block bad code
5. ✅ **Inline code comments** with explanations
6. ✅ **Deployment checklist** with verification steps

### Files Created:

- `src/types/unified-patient.types.ts`
- `src/utils/patient-id-formatter.ts`
- `src/__tests__/schedule-tsh-id.test.ts`
- `SCHEDULE_UPLOAD_CHECKLIST.md`
- `PREVENTION_MEASURES_TSH_ID.md` (this file)

### Files Modified:

- `.husky/pre-commit` - Added patient_id misuse check
- `src/components/ProviderScheduleViewLive.tsx` - Added warnings
- `src/pages/SchedulePageV2.tsx` - Added warnings

---

## Questions?

**Why did this happen?**
Field names were too similar and easy to confuse. No safeguards existed.

**Will it happen again?**
Very unlikely with 6 layers of protection!

**What if I'm not sure which field to use?**
Read `src/types/unified-patient.types.ts` or use `getDisplayTshId()` helper.

**I triggered the pre-commit hook, what do I do?**
Fix the line it points to: change `patient_id` to `tshla_id`.

**Can I bypass the checks?**
Technically yes, but don't! They're there to protect production.

---

**Last Updated:** February 1, 2026
**Version:** 1.0
**Maintainer:** Development Team
