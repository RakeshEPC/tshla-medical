# 🗂️ Deprecated Files - TSHLA Medical

**Last Updated**: October 5, 2025
**Status**: Phase 1 - Documentation Only (No Breaking Changes)

---

## 📖 Overview

This document lists all deprecated files in the TSHLA Medical codebase. These files are **still functional** but are marked for future removal or consolidation. They should **not be used** for new development.

### Deprecation Strategy

**Phase 1** (Current): Mark files as deprecated, add console warnings, update documentation
**Phase 2** (Future): Move to `src/legacy/` folder, update all imports
**Phase 3** (Future): Remove from codebase after thorough testing

---

## 🚨 DEPRECATED FILES

### PumpDrive Assessment Flow Components

These files represent old assessment flow implementations that have been superseded by `PumpDriveUnified.tsx`.

#### ❌ PumpDriveSliders.tsx
**Location**: `src/pages/PumpDriveSliders.tsx`
**Size**: 14K
**Status**: DEPRECATED
**Reason**: Old slider-based assessment flow, replaced by PumpDriveUnified
**Canonical Alternative**: Use `PumpDriveUnified.tsx` instead
**Migration Path**:
- Replace all references to `PumpDriveSliders` with `PumpDriveUnified`
- Update routes pointing to slider flow
- PumpDriveUnified includes slider functionality plus additional features
**Breaking Change**: YES (Phase 2)
**Safe to Delete**: After Phase 2 migration complete

#### ❌ PumpDriveFreeText.tsx
**Location**: `src/pages/PumpDriveFreeText.tsx`
**Size**: 7.5K
**Status**: DEPRECATED
**Reason**: Old free-text assessment flow, replaced by PumpDriveUnified
**Canonical Alternative**: Use `PumpDriveUnified.tsx` instead
**Migration Path**:
- Replace all references to `PumpDriveFreeText` with `PumpDriveUnified`
- PumpDriveUnified includes conversational AI flow
**Breaking Change**: YES (Phase 2)
**Safe to Delete**: After Phase 2 migration complete

#### ❌ PumpDriveAssessmentResults.tsx
**Location**: `src/pages/PumpDriveAssessmentResults.tsx`
**Size**: 13K
**Status**: DEPRECATED
**Reason**: Old results page, replaced by PumpDriveResults.tsx (enhanced)
**Canonical Alternative**: Use `PumpDriveResults.tsx` instead
**Migration Path**:
- Replace all references to `PumpDriveAssessmentResults` with `PumpDriveResults`
- PumpDriveResults includes database integration and email functionality
**Breaking Change**: YES (Phase 2)
**Safe to Delete**: After Phase 2 migration complete

#### ⚠️ PumpDriveProviderSent.tsx
**Location**: `src/pages/PumpDriveProviderSent.tsx`
**Size**: 7.7K
**Status**: DEPRECATED (Commented out in routes)
**Reason**: Confirmation page for provider email, functionality moved to results page
**Canonical Alternative**: Email modal in `PumpDriveResults.tsx`
**Migration Path**:
- Remove route (already commented out)
- Delete file in Phase 2
**Breaking Change**: NO (already not in use)
**Safe to Delete**: YES (Phase 2)

---

### Login Pages

Multiple login implementations exist. The canonical version is `UnifiedLogin.tsx`.

#### ❌ Login.tsx
**Location**: `src/pages/Login.tsx`
**Status**: DEPRECATED (if exists)
**Reason**: Old basic login, replaced by UnifiedLogin
**Canonical Alternative**: Use `UnifiedLogin.tsx` instead
**Migration Path**:
- Update all routes pointing to `/login` to use UnifiedLogin
- UnifiedLogin supports all authentication methods
**Breaking Change**: YES (Phase 2)
**Safe to Delete**: After Phase 2 migration complete

#### ❌ LoginHIPAA.tsx
**Location**: `src/pages/LoginHIPAA.tsx`
**Status**: DEPRECATED (if exists)
**Reason**: HIPAA-compliant login merged into UnifiedLogin
**Canonical Alternative**: Use `UnifiedLogin.tsx` (has HIPAA mode)
**Migration Path**:
- UnifiedLogin includes all HIPAA compliance features
- No functionality lost
**Breaking Change**: YES (Phase 2)
**Safe to Delete**: After Phase 2 migration complete

#### ❌ SimplifiedLogin.tsx
**Location**: `src/pages/SimplifiedLogin.tsx`
**Status**: DEPRECATED (if exists)
**Reason**: Simplified version merged into UnifiedLogin
**Canonical Alternative**: Use `UnifiedLogin.tsx` instead
**Migration Path**:
- UnifiedLogin can be configured for simple or complex flows
**Breaking Change**: YES (Phase 2)
**Safe to Delete**: After Phase 2 migration complete

#### ⚠️ PatientLogin.tsx
**Location**: `src/pages/PatientLogin.tsx`
**Status**: POTENTIALLY DEPRECATED
**Reason**: May be specific to patient portal (needs review)
**Canonical Alternative**: `UnifiedLogin.tsx` or keep if patient-specific
**Migration Path**: REVIEW REQUIRED
**Breaking Change**: TBD
**Safe to Delete**: TBD (needs analysis)

---

### Dashboard Pages

Old dashboard implementations superseded by `DoctorDashboardUnified.tsx`.

#### ❌ DoctorDashboard.tsx
**Location**: `src/pages/DoctorDashboard.tsx` (if exists)
**Status**: DEPRECATED
**Reason**: Old dashboard implementation
**Canonical Alternative**: Use `DoctorDashboardUnified.tsx` instead
**Migration Path**:
- All routes in App.tsx already point to DoctorDashboardUnified
- Safe to remove old file
**Breaking Change**: NO (already migrated in App.tsx)
**Safe to Delete**: YES

#### ❌ DoctorDashboardDB.tsx
**Location**: `src/pages/DoctorDashboardDB.tsx` (if exists)
**Status**: DEPRECATED
**Reason**: Database-connected dashboard merged into Unified
**Canonical Alternative**: Use `DoctorDashboardUnified.tsx` instead
**Migration Path**:
- DoctorDashboardUnified includes all database features
**Breaking Change**: NO (already migrated in App.tsx)
**Safe to Delete**: YES

#### ❌ DoctorDashboardModern.tsx
**Location**: `src/pages/DoctorDashboardModern.tsx` (if exists)
**Status**: DEPRECATED
**Reason**: Modern UI merged into Unified
**Canonical Alternative**: Use `DoctorDashboardUnified.tsx` instead
**Migration Path**:
- DoctorDashboardUnified has modern UI
**Breaking Change**: NO (already migrated in App.tsx)
**Safe to Delete**: YES

---

### Dictation Pages

Multiple dictation implementations may exist.

#### ⚠️ DictationPage.tsx
**Location**: `src/pages/DictationPage.tsx`
**Status**: REVIEW REQUIRED
**Reason**: May be superseded by DictationPageEnhanced
**Canonical Alternative**: `DictationPageEnhanced.tsx` (if superior)
**Migration Path**: TBD - requires feature comparison
**Breaking Change**: TBD
**Safe to Delete**: TBD

#### ⚠️ QuickNote.tsx
**Location**: `src/pages/QuickNote.tsx`
**Status**: REVIEW REQUIRED
**Reason**: May be superseded by QuickNoteModern
**Canonical Alternative**: `QuickNoteModern.tsx` (if superior)
**Migration Path**: TBD - requires feature comparison
**Breaking Change**: TBD
**Safe to Delete**: TBD

---

### Admin Pages

Admin features may have duplicates.

#### ⚠️ AdminAccountCreation.tsx vs AdminAccountManagement.tsx
**Status**: REVIEW REQUIRED
**Reason**: May have overlapping functionality
**Action**: Determine if both are needed or can be consolidated

---

### Services & Utilities

Old service implementations that may be deprecated.

#### ⚠️ pumpDriveFeatureBased.service.ts
**Location**: `src/services/pumpDriveFeatureBased.service.ts`
**Status**: REVIEW REQUIRED
**Reason**: May be superseded by pumpDriveAI.service.ts
**Canonical Alternative**: TBD
**Migration Path**: Needs analysis of which service is canonical

#### ⚠️ pumpDrivePureAI.service.ts
**Location**: `src/services/pumpDrivePureAI.service.ts`
**Status**: REVIEW REQUIRED
**Reason**: May be merged into pumpDriveAI.service.ts
**Canonical Alternative**: TBD
**Migration Path**: Needs analysis

---

## 📋 CANONICAL VERSIONS (Keep These!)

### PumpDrive System

✅ **PumpDriveUnified.tsx** - Main assessment flow (ALL assessment types)
✅ **PumpDriveResults.tsx** - Results page with database integration
✅ **PumpDriveHTMLReport.tsx** - Report generation and display
✅ **PumpDriveBilling.tsx** - Payment processing
✅ **PumpDriveCreateAccount.tsx** - User registration
✅ **PumpDriveLogin.tsx** - PumpDrive-specific login
✅ **AssessmentHistory.tsx** - Assessment history with comparison (NEW)
✅ **PumpDriveAnalytics.tsx** - Admin analytics dashboard (NEW)

### Authentication

✅ **UnifiedLogin.tsx** - Canonical login page (all modes)
✅ **CreateAccount.tsx** - Main account creation
✅ **AccountVerification.tsx** - Email verification

### Dashboards

✅ **DoctorDashboardUnified.tsx** - Main doctor dashboard
✅ **StaffDashboard.tsx** - Staff workflow management
✅ **MADashboard.tsx** - Medical Assistant dashboard
✅ **CaseManagementDashboard.tsx** - Case management
✅ **StaffWorkflowDashboard.tsx** - Workflow tracking

### Admin

✅ **AdminAccountManagement.tsx** - User account management
✅ **PumpDriveUserDashboard.tsx** - PumpDrive user admin
✅ **PumpDriveAnalytics.tsx** - Analytics dashboard
✅ **PumpComparisonManager.tsx** - 23 dimension management

### Services

✅ **assessmentHistory.service.ts** - Assessment data retrieval (NEW)
✅ **pumpAnalytics.service.ts** - Analytics data (NEW)
✅ **pumpAssessment.service.ts** - Assessment persistence
✅ **pumpAuth.service.ts** - PumpDrive authentication
✅ **pumpDriveAI.service.ts** - AI recommendation engine
✅ **logger.service.ts** - Centralized logging

---

## 🔄 Migration Guide

### Step 1: Identify Usage

For each deprecated file, search the codebase:

```bash
# Example: Find all usages of PumpDriveSliders
grep -r "PumpDriveSliders" src/

# Find all imports
grep -r "import.*PumpDriveSliders" src/
```

### Step 2: Update Imports

Replace deprecated imports:

```typescript
// OLD (deprecated)
import PumpDriveSliders from './pages/PumpDriveSliders';

// NEW (canonical)
import PumpDriveUnified from './pages/PumpDriveUnified';
```

### Step 3: Update Routes

Replace deprecated routes:

```typescript
// OLD (deprecated)
<Route path="/pumpdrive/sliders" element={<PumpDriveSliders />} />

// NEW (canonical)
<Route path="/pumpdrive/assessment" element={<PumpDriveUnified />} />
```

### Step 4: Test Thoroughly

- Test all flows that used deprecated components
- Verify no functionality is lost
- Check for console errors
- Validate user experience

### Step 5: Move to Legacy (Phase 2)

```bash
# Create legacy folder
mkdir -p src/legacy/pages

# Move deprecated files
mv src/pages/PumpDriveSliders.tsx src/legacy/pages/
```

### Step 6: Delete (Phase 3)

Only after:
- All imports updated
- All routes updated
- All tests passing
- No console warnings
- User acceptance testing complete

---

## ⚠️ Warnings & Notices

### Console Warnings (Implemented)

Deprecated files will show warnings in the browser console:

```
⚠️ WARNING: PumpDriveSliders is DEPRECATED
Please use PumpDriveUnified instead
This component will be removed in a future release
See DEPRECATED.md for migration guide
```

### JSDoc Comments (To Be Added)

All deprecated files will have JSDoc comments:

```typescript
/**
 * @deprecated Use PumpDriveUnified instead
 * This file is deprecated and will be removed in a future release
 * See DEPRECATED.md for migration guide
 */
```

---

## 📊 Deprecation Statistics

### Summary

- **Total Deprecated Files**: 10+ (exact count TBD)
- **PumpDrive Assessment Flows**: 3 deprecated (Sliders, FreeText, AssessmentResults)
- **Login Pages**: 3-4 deprecated (Login, LoginHIPAA, SimplifiedLogin)
- **Dashboard Pages**: 2-3 deprecated (DoctorDashboard variants)
- **Other Pages**: 1-2 deprecated (ProviderSent, etc.)

### Cleanup Impact

**Code Reduction Estimate**:
- Lines to remove: ~50,000+ (based on 214 deprecated files mentioned)
- Files to remove: 200+ files
- Folders to consolidate: 10+

**Maintenance Benefits**:
- Easier navigation
- Clearer architecture
- Reduced confusion
- Faster onboarding
- Less technical debt

---

## 🗓️ Timeline

### Phase 1: Documentation (CURRENT)
**Status**: ✅ In Progress
**Tasks**:
- [x] Create DEPRECATED.md
- [ ] Add JSDoc comments to deprecated files
- [ ] Add console warnings to deprecated components
- [ ] Update README with deprecation info

**ETA**: 1-2 days

### Phase 2: Migration
**Status**: ⏳ Not Started
**Tasks**:
- [ ] Create `src/legacy/` folder structure
- [ ] Move deprecated files to legacy
- [ ] Update all imports
- [ ] Update all routes
- [ ] Test all affected features

**ETA**: 1-2 weeks
**Breaking Changes**: YES

### Phase 3: Removal
**Status**: ⏳ Not Started
**Tasks**:
- [ ] Delete legacy folder
- [ ] Remove all legacy imports
- [ ] Clean up unused dependencies
- [ ] Final testing

**ETA**: TBD (after Phase 2 complete and stable)
**Breaking Changes**: NO (if Phase 2 done correctly)

---

## 📞 Questions or Issues?

If you encounter any issues with deprecated files:

1. **Check this document** for migration path
2. **Search the codebase** for canonical alternative
3. **Review commit history** to understand why file was deprecated
4. **Ask the team** if migration path is unclear
5. **Update this document** if you find new deprecations

---

## 🔗 Related Documentation

- [SESSION_CONTINUATION_GUIDE.md](SESSION_CONTINUATION_GUIDE.md) - Complete task roadmap
- [DISCOVERY_SUMMARY.md](DISCOVERY_SUMMARY.md) - Code organization findings
- [SESSION_FINAL_SUMMARY.md](SESSION_FINAL_SUMMARY.md) - Recent work summary
- [QUICK_START_GUIDE.md](QUICK_START_GUIDE.md) - Developer quick reference

---

**Last Updated**: October 5, 2025
**Next Review**: After Phase 1 complete
**Maintained By**: Development Team
