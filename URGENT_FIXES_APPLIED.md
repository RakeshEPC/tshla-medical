# Urgent Fixes Applied - Patient Portal Issues

**Date:** 2026-01-26
**Status:** ✅ Fixed, Ready for Testing

---

## Issues Found

### Issue 1: Diagnoses Not Displaying in Patient Portal
**Problem:** Daniel Daues has 7 diagnoses in database (including diabetes) but they weren't showing in patient portal.

**Root Cause:** Field name mismatch between database and frontend
- Database field: `diagnosis`
- Frontend expected: `condition`

**Fix:** Updated [src/pages/PatientHPView.tsx:54](src/pages/PatientHPView.tsx#L54) and [line 568](src/pages/PatientHPView.tsx#L568) to use correct field name `diagnosis`

**Result:** ✅ All 7 diagnoses will now display properly

---

### Issue 2: Dictations Not Showing in Audio Section
**Problem:** "No Summaries Yet" message showing even though Daniel Daues has 1 dictation

**Root Cause:** Phone number format mismatch
- `unified_patients.phone_primary`: `2813847779` (no formatting)
- `dictated_notes.patient_phone`: `(281) 384-7779` (with parentheses and dashes)
- API query only checked exact match

**Fix:** Updated [server/routes/patient-portal-api.js:1923-1942](server/routes/patient-portal-api.js#L1923) to check multiple phone format variations:
- Original format
- Display format
- Digits only
- Formatted: `(281) 384-7779`
- E.164 format: `+12813847779`

**Result:** ✅ Dictations will now load regardless of phone format variation

---

## What Was Changed

### File 1: `server/routes/patient-portal-api.js`

**Before:**
```javascript
const { data: dictations, error: dictError } = await supabase
  .from('dictated_notes')
  .select('...')
  .eq('patient_phone', patient.phone_primary)  // ❌ Only exact match
  .order('created_at', { ascending: false });
```

**After:**
```javascript
// Handle phone format variations: "2813847779" vs "(281) 384-7779" vs "+12813847779"
const phoneVariations = [
  patient.phone_primary, // Original format
  patient.phone_display, // Display format
  patient.phone_primary?.replace(/\D/g, ''), // Digits only
  `(${patient.phone_primary?.substring(0,3)}) ${patient.phone_primary?.substring(3,6)}-${patient.phone_primary?.substring(6)}`, // Formatted
  `+1${patient.phone_primary?.replace(/\D/g, '')}` // E.164 format
].filter(Boolean);

// Query with OR condition for all phone variations
let query = supabase
  .from('dictated_notes')
  .select('...');

const phoneConditions = phoneVariations.map(phone => `patient_phone.eq.${phone}`).join(',');
query = query.or(phoneConditions);

const { data: dictations, error: dictError } = await query.order('created_at', { ascending: false });
```

---

### File 2: `src/pages/PatientHPView.tsx`

**Before:**
```typescript
diagnoses: Array<{
  condition: string;  // ❌ Wrong field name
  icd10: string;
  status: string;
  diagnosed?: string;
}>;

// Later in render:
<h4 className="font-semibold text-gray-900">{dx.condition}</h4>  // ❌ Wrong field
```

**After:**
```typescript
diagnoses: Array<{
  diagnosis: string;  // ✅ Correct field name from database
  icd10: string;
  status: string;
  diagnosed?: string;
}>;

// Later in render:
<h4 className="font-semibold text-gray-900">{dx.diagnosis}</h4>  // ✅ Correct field
```

---

## Testing Daniel Daues Patient Portal

### Expected Results After Deploy:

**1. Login:**
- URL: https://www.tshla.ai/patient-portal-login
- TSH ID: TSH 785-121 or TSH785121 (both work)
- Last 4 digits: 7779

**2. My Medical Chart Section:**

**Active Diagnoses** (should show 7):
1. Type 2 diabetes mellitus (E11.9)
2. Hypertension (I10)
3. Hyperlipidemia (E78.5)
4. Chronic kidney disease, unspecified stage (N18.9)
5. Obesity (E66.9)
6. Hypogonadism (E29.1)
7. Cardiovascular disease (I25.10)

**Medications** (already working - 10 medications):
- Amlodipine
- Entresto
- Humalog insulin
- Lisinopril 40mg
- Mounjaro 15mg weekly
- Phentermine
- Pioglitazone 30mg
- Rosuvastatin 40mg
- Tresiba 24 units daily
- Xyosted 75mg weekly

**3. Audio Summaries Section:**

Should show **1 dictation** instead of "No Summaries Yet"
- Provider name
- Visit date
- Expandable text summary
- Audio playback (if TTS has been generated)
- Delete button

---

## Deployment Steps

1. **Deploy backend changes:**
```bash
git add server/routes/patient-portal-api.js
git commit -m "Fix: Phone number normalization for dictations API"
git push
```

2. **Deploy frontend changes:**
```bash
git add src/pages/PatientHPView.tsx
git commit -m "Fix: Use correct 'diagnosis' field name for H&P display"
git push
```

3. **Wait for deployment** (Azure Container App auto-deploys from GitHub)

4. **Test immediately:**
   - Login as Daniel Daues
   - Check diagnoses display
   - Check audio section shows dictation

---

## Database Verification

Run this to confirm Daniel Daues data is correct:

```bash
VITE_SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
node scripts/check-daniel-daues-full.cjs
```

Expected output:
```
✅ Patient found: DANIEL DAUES
📋 H&P Chart:
   Diagnoses: 7
   Medications: 10
📝 Dictations: 1  # ✅ After phone fix
```

---

## Additional Notes

### Phone Number Formats in System

The system has 3 different phone formats across tables:
1. **unified_patients:** Digits only (`2813847779`)
2. **dictated_notes:** Formatted with parentheses (`(281) 384-7779`)
3. **Some tables:** E.164 format (`+12813847779`)

**Future recommendation:** Normalize all phone numbers to E.164 format on insert/update to avoid these issues.

### Other Patients Affected

This fix applies to ALL patients, not just Daniel Daues. Any patient with:
- Dictations in database
- Phone number format mismatch

Will now see their dictations correctly.

---

## Rollback Plan

If issues occur after deployment:

```bash
# Revert backend
git revert HEAD~1  # Revert phone number fix
git push

# Revert frontend
git revert HEAD~1  # Revert diagnosis field fix
git push
```

---

**Status:** ✅ Ready to deploy and test

**Next Steps:**
1. Deploy both files
2. Test Daniel Daues patient portal
3. Verify diagnoses show (7 items)
4. Verify dictation shows in audio section
5. Run audio generation script to add TTS audio
