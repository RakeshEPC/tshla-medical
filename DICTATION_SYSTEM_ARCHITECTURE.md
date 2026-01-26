# TSHLA Medical EMR - Dictation System Architecture
## Enterprise-Grade Documentation

**Created:** 2026-01-25
**Status:** CRITICAL - System Split Detected
**Priority:** P0 - Data Integrity Issue

---

## Executive Summary

**CRITICAL ISSUE IDENTIFIED:**
The dictation system is currently split between two incompatible storage layers, causing:
- ❌ Lost patient data (dictations not appearing in H&P)
- ❌ HIPAA compliance risk (duplicated patient data across tables)
- ❌ Data integrity violations (orphaned records)
- ❌ Inconsistent patient portal experience

**IMPACT:**
- **20+ dictations from last 7 days** stored in legacy table
- **0 dictations** in new unified table
- **ALL patients** missing medications/labs in portal

---

## Current Architecture (BROKEN)

```
┌─────────────────────────────────────────────────────────────┐
│                     DICTATION FLOW                          │
└─────────────────────────────────────────────────────────────┘

Provider dictates in UI
         ↓
    MedicalDictation.tsx
         ↓
    dictatedNotesService (OLD) ← CURRENTLY USED
         ↓
    dictated_notes table (LEGACY)
         ↓
    ❌ H&P Generator CAN'T READ THIS TABLE
         ↓
    ❌ Patient Portal shows NO DATA


CORRECT FLOW (NOT BEING USED):
         ↓
    dictationStorageService (NEW) ← SHOULD BE USED
         ↓
    dictations table (UNIFIED)
         ↓
    ✅ H&P Generator READS THIS
         ↓
    ✅ Patient Portal shows medications/labs
```

---

## Database Schema Analysis

### Table: `dictated_notes` (LEGACY - DEPRECATED)
**Status:** ⚠️ STILL RECEIVING NEW DATA
**Created:** 2024-2025
**Records:** 500+ dictations
**Issues:**
- Not linked to unified_patients properly
- Missing H&P integration
- Inconsistent column naming
- No automated H&P trigger

**Columns:**
```sql
- id (INTEGER)
- provider_id, provider_name, provider_email
- patient_name, patient_phone, patient_email
- patient_mrn, patient_dob
- raw_transcript (TEXT) ← Actual dictation
- processed_note (TEXT) ← AI formatted
- ai_summary (TEXT)
- status, created_at, updated_at
- unified_patient_id (UUID) ← Added later, not always populated
```

### Table: `dictations` (NEW - UNIFIED SYSTEM)
**Status:** ✅ CORRECT ARCHITECTURE, ❌ NOT BEING USED
**Created:** 2026-01
**Records:** 0 (EMPTY!)
**Features:**
- Proper FK to unified_patients
- Integrated with H&P generation
- Auto-triggers on completion
- HIPAA-compliant logging

**Columns:**
```sql
- id (UUID PRIMARY KEY)
- patient_id (UUID FK → unified_patients.id) ← Proper referential integrity
- appointment_id (BIGINT FK → provider_schedules.id)
- provider_id (UUID)
- patient_name, patient_dob, patient_mrn
- visit_date, visit_type
- transcription_text (TEXT) ← Maps to raw_transcript
- final_note (TEXT) ← Maps to processed_note
- status (completed triggers H&P)
- created_at, updated_at, completed_at
```

### Table: `patient_comprehensive_chart` (H&P SYSTEM)
**Status:** ✅ CORRECT, ❌ NO DATA BECAUSE NO DICTATIONS
**Indexed by:** patient_phone, tshla_id
**Generated from:** dictations table (NOT dictated_notes)

---

## Code Analysis

### Frontend: `src/components/MedicalDictation.tsx`
**Lines:** 1997
**Issue:** Imports BOTH services, uses OLD one

```typescript
// Line 13: OLD service (CURRENTLY USED)
import { dictatedNotesService } from '../services/dictatedNotesService';

// Line 26: NEW service (IMPORTED BUT NEVER CALLED)
import { dictationStorageService } from '../services/dictationStorage.service';
```

**Calls to OLD service:** ~15 locations
**Calls to NEW service:** 0

### Services:

#### `src/services/dictatedNotesService.ts`
- Saves to `dictated_notes` table
- No H&P integration
- No unified_patients validation
- LEGACY API endpoints

#### `src/services/dictationStorage.service.ts`
- Saves to `dictations` table
- ✅ Auto-triggers H&P on completion (line 99-100)
- ✅ Validates unified_patients FK
- ✅ HIPAA-compliant logging

### Backend: `server/services/comprehensiveHPGenerator.service.js`
**H&P Data Source:** `dictated_notes` table (Line 245)
**Issue:** Uses old table name!

```javascript
// Line 245: WRONG TABLE
const { data, error } = await supabase
  .from('dictated_notes')  // ❌ Should be 'dictations'
  .select('*')
  .eq('id', dictationId)
  .single();
```

---

## HIPAA Compliance Issues

### Current Violations:
1. **Data Duplication:** Patient PHI stored in two tables
2. **Inconsistent Access Control:** Different RLS policies
3. **Audit Trail Gaps:** Old table lacks proper logging
4. **Data Retention:** No clear retention policy between tables

### Required Fixes:
1. ✅ Single source of truth for dictations
2. ✅ Consistent FK constraints
3. ✅ Unified audit logging
4. ✅ Automated data lifecycle management

---

## Migration Strategy

### Phase 1: Data Migration (Option A)
**Timeline:** Immediate
**Priority:** P0

1. Create comprehensive migration script
2. Migrate all `dictated_notes` → `dictations`
3. Link to unified_patients via phone/name matching
4. Trigger H&P generation for ALL patients
5. Verify data integrity

### Phase 2: Code Refactor (Option B)
**Timeline:** Same deployment
**Priority:** P0

1. Update `MedicalDictation.tsx` to use `dictationStorageService`
2. Fix `comprehensiveHPGenerator.service.js` to read from `dictations`
3. Update all API endpoints
4. Remove deprecated `dictatedNotesService`
5. Add migration notice to old table

### Phase 3: Deprecation
**Timeline:** After 30-day verification

1. Archive `dictated_notes` table
2. Remove old service files
3. Update documentation
4. Add database constraints

---

## Verification Checklist

### Pre-Migration:
- [ ] Count records in dictated_notes
- [ ] Count records in dictations
- [ ] List all patients with dictations
- [ ] Verify unified_patients links

### Post-Migration:
- [ ] All dictations migrated (count match)
- [ ] All patients have unified_patient_id
- [ ] H&P generated for all completed dictations
- [ ] Patient portal shows medications/labs
- [ ] No orphaned records

### Post-Deployment:
- [ ] New dictations save to correct table
- [ ] H&P auto-generates on completion
- [ ] Patient portal displays real-time data
- [ ] Audit logs capture all changes

---

## Technical Debt Summary

| Issue | Impact | Priority | Effort |
|-------|--------|----------|--------|
| Split dictation tables | Critical | P0 | High |
| Missing H&P data | Critical | P0 | Medium |
| Inconsistent data models | High | P1 | High |
| Deprecated service still used | High | P0 | Medium |
| No referential integrity | Medium | P1 | Low |

**Total Estimated Effort:** 8-12 hours
**Business Impact:** High - Patient care data missing
**Risk if not fixed:** HIPAA violation, data loss, patient safety

---

## Success Criteria

1. ✅ ALL dictations in single `dictations` table
2. ✅ ALL patients have complete H&P with medications
3. ✅ Patient portal shows accurate real-time data
4. ✅ New dictations automatically generate H&P
5. ✅ Zero data loss during migration
6. ✅ Full audit trail maintained
7. ✅ HIPAA compliance verified

---

## Next Steps

1. **Immediate:** Run migration script (20+ dictations)
2. **Same Day:** Deploy code refactor
3. **Verification:** Test with 3 patients
4. **Production:** Deploy to Azure
5. **Monitoring:** 48-hour observation period
6. **Cleanup:** Deprecate old table after 30 days

---

**Document Owner:** TSHLA Development Team
**Last Updated:** 2026-01-25
**Next Review:** 2026-02-01
