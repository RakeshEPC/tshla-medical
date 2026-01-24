# Patient Portal TSH ID Login Fix

**Date:** 2026-01-23  
**Issue:** TSH ID not found during login  
**Status:** 🔄 Fix deployed, waiting for container update

---

## Problem

When attempting to log in to the patient portal with test credentials:
- **TSH ID:** TSH 123-001
- **Phone Last 4:** 1001

**Error:** "TSH ID not found. Please check your ID or contact our office."

---

## Root Cause

**Database format vs. Query format mismatch:**

- **Database stores:** `TSH 123-001` (with space and dash)
- **API query used:** `TSH123001` (normalized, no space/dash)

The login API was normalizing the user input by removing spaces and dashes:
```javascript
const normalizedTshId = tshlaId.replace(/[\s-]/g, '').toUpperCase();
// Result: "TSH123001"
```

Then querying:
```javascript
.eq('tshla_id', normalizedTshId)  // Looking for "TSH123001"
```

But the database has: `TSH 123-001` ❌

---

## Solution

Updated `/server/routes/patient-portal-api.js` to try BOTH formats:

```javascript
// Try normalized format first (TSH123001)
const result1 = await supabase
  .from('unified_patients')
  .select('...')
  .eq('tshla_id', normalizedTshId)
  .maybeSingle();

if (result1.data) {
  patient = result1.data;
} else {
  // Try formatted version (TSH 123-001)
  const formatted = normalizedTshId.replace(/^TSH(\d{3})(\d{3})$/, 'TSH $1-$2');
  const result2 = await supabase
    .from('unified_patients')
    .select('...')
    .eq('tshla_id', formatted)
    .maybeSingle();

  patient = result2.data;
}
```

---

## Deployment

**Commit:** c34ca417  
**Message:** fix: Handle TSH ID format mismatch in patient portal login

**Deployment Status:**
- ✅ Committed and pushed to main
- 🔄 GitHub Actions triggered
- ⏳ Waiting for Azure Container App deployment

**Expected completion:** ~5-10 minutes

---

## Testing After Deployment

Once deployed, test login with:

**URL:** https://mango-sky-0ba265c0f.1.azurestaticapps.net/patient-portal-unified

**Test Credentials:**
```
TSH ID: TSH 123-001 (or type: 123001)
Phone Last 4: 1001

TSH ID: TSH 123-002 (or type: 123002)
Phone Last 4: 1002

TSH ID: TSH 123-003 (or type: 123003)
Phone Last 4: 1003
```

---

## Verification

After deployment completes, verify:

```bash
# Check container revision timestamp
az containerapp revision list \
  --name tshla-unified-api \
  --resource-group tshla-backend-rg \
  --query "[0].{name:name,created:properties.createdTime}" \
  -o table

# Test the API endpoint directly
curl -X POST \
  https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/patient-portal/login \
  -H "Content-Type: application/json" \
  -d '{"tshlaId":"TSH 123-001","phoneLast4":"1001"}'
```

Expected response:
```json
{
  "success": true,
  "session": {
    "sessionId": "...",
    "patientPhone": "+18325551001",
    "tshlaId": "TSH 123-001",
    "patientName": "John Diabetes"
  }
}
```

---

## Related Files

- **Backend API:** `/server/routes/patient-portal-api.js` (fixed)
- **Frontend Login:** `/src/components/PatientPortalLogin.tsx`
- **Main Portal:** `/src/pages/PatientPortalUnified.tsx`

---

**Status:** Waiting for deployment to complete...
