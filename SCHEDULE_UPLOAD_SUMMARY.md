# Schedule Upload - Summary

**Date:** January 29, 2026
**File Uploaded:** `printcsvreports - 20260129_11-14.csv`

## ✅ What Was Completed

### 1. **Schedule Upload Script Created**
   - File: `upload-schedule.cjs`
   - Parses Athena Health CSV exports
   - Maps provider names to database IDs
   - Converts appointment data to database format
   - Handles cancelled appointments automatically
   - Batch uploads for performance

### 2. **Data Uploaded Successfully**
   - **20 appointments** for Dr. Rakesh Patel
   - **Date:** 01/29/2026
   - **Status breakdown:**
     - ✅ Scheduled: 15
     - ❌ Cancelled: 5

### 3. **Patient Data Included**
   - Patient names
   - Phone numbers
   - Email addresses
   - Date of birth
   - **MRN (Medical Record Numbers)** - Athena Patient IDs
   - Appointment types (New Patient, Established, etc.)

### 4. **Component Fix Applied**
   - Fixed: `ProviderScheduleViewLive.tsx`
   - Now displays MRN from schedule table
   - Fixed TSH_ID field mapping (patient_id)
   - Added patient_email to display data

## 📋 Data Schema

### Uploaded Fields:
```javascript
{
  provider_id: UUID,
  provider_name: string,
  patient_name: string,
  patient_phone: string,
  patient_email: string,
  patient_mrn: string,          // ← Athena Patient ID (MRN)
  patient_dob: date,
  appointment_type: string,
  appointment_title: string,
  scheduled_date: date,
  start_time: time,
  end_time: time,
  duration_minutes: integer,
  status: string,               // scheduled, cancelled, etc.
  is_telehealth: boolean,
  urgency_level: string,
}
```

## 🔧 Provider Mappings Added

The following providers are now mapped in the upload script:

- ✅ Dr. Adeleke A (GC_EPC_Adeleke_A)
- ✅ Dr. Radha Bernander (GC_EPC_Bernander_R)
- ✅ Dr. Tess Chamakkala (GC_EPC_Chamakkala_T)
- ✅ **Dr. Rakesh Patel (GC_EPC_Patel_R)** ← Used for this upload
- ✅ Dr. Neha Patel (GC_EPC_Patel_N)
- ✅ Dr. Shannon Gregorek (GC_EPC_Gregorek_S)
- ✅ Dr. Cindy Laverde (GC_EPC_Laverde_C)
- ✅ Dr. Elinia Shakya (GC_EPC_Shakya_E)
- ✅ Dr. Veena Watwe (GC_EPC_Watwe_V)
- ✅ Dr. Nadia Younus (GC_EPC_Younus_N)
- ✅ Dr. Kamili Wade-Reescano (GC_EPC_Wade-Reescano)
- ✅ Programs: Ideal Protein, Thrive, Patel-Konasag, etc.

## 📊 Sample Appointments Uploaded

| Time  | Patient Name | Status | Type | MRN |
|-------|-------------|--------|------|-----|
| 1:00 PM | DONNA FORSYTHE | Scheduled | Established | 27159842 |
| 1:15 PM | ASHLEY MICHELLE RODRIGUEZ | Scheduled | Established | 8628819 |
| 1:30 PM | CATHERINE LITTLE | Scheduled | Established | 8617212 |
| 1:30 PM | HANNAH TEELUCKSINGH | Cancelled | Established | 27449000 |
| 1:30 PM | ANSON SMITH | Cancelled | Established | 8610841 |
| 1:45 PM | MARGARET PITRE | Scheduled | Established | 27605119 |
| 2:00 PM | SERGIO PINA DE LA FUENTE | Scheduled | New Patient | 35326575 |
| ... | (13 more appointments) | ... | ... | ... |

## 🎯 What Shows on Schedule Now

After the fix, the schedule page displays:

✅ **Patient Names** - Full names from CSV
✅ **Phone Numbers** - All phone numbers imported
✅ **Email Addresses** - Email contacts
✅ **DOB** - Date of birth
✅ **MRN** - Athena Patient IDs (Medical Record Numbers)
✅ **Appointment Type** - New Patient, Established, etc.
✅ **Status** - Scheduled, Cancelled, etc.
⚠️ **TSH_ID** - Not yet showing (requires linking to unified_patients table)

## ⚠️ Known Limitations

### TSH_ID Not Displaying
**Reason:** Appointments are not linked to `unified_patients` table
**Impact:** TSH_ID field shows empty
**Why:** The appointments have patient data in the schedule table but aren't linked to master patient records

**To Fix:**
1. Create/update patient records in `unified_patients` table
2. Link appointments via `unified_patient_id` foreign key
3. Match by phone number or MRN

### MRN Now Shows!
✅ **Fixed** - The MRN (Athena Patient ID) now displays correctly from the schedule table

## 🔄 How to Upload Future Schedules

### Method 1: Using the Script (Recommended)

1. Export CSV from Athena Health (use saved report "Tshla schedule")
2. Save to Downloads folder
3. Update the file path in `upload-schedule.cjs`:
   ```javascript
   const csvPath = '/Users/rakeshpatel/Downloads/YOUR_FILE_NAME.csv';
   const scheduleDate = 'YYYY-MM-DD';  // Date of schedule
   ```
4. Run: `node upload-schedule.cjs`

### Method 2: Using the UI

1. Navigate to `/schedule-upload` in the app
2. Drag & drop the CSV file
3. Click "Parse Schedule File"
4. Review and click "Import to Database"

## 📁 Files Created/Modified

**Created:**
- `upload-schedule.cjs` - Main upload script
- `verify-upload.cjs` - Verification script
- `check-patients.cjs` - Patient data checker
- `link-patients.cjs` - Patient linking utility
- `SCHEDULE_UPLOAD_SUMMARY.md` - This file

**Modified:**
- `src/components/ProviderScheduleViewLive.tsx` - Fixed MRN display

## ✅ Verification

Run verification script to check the upload:

```bash
node verify-upload.cjs
```

Expected output:
```
✅ Found 20 appointments for 2026-01-29

📊 By Provider:
   Dr. Rakesh Patel: 20

📊 By Status:
   scheduled: 15
   cancelled: 5
```

## 🎉 Success!

The schedule upload is complete and working! The appointments are now visible in the TSHLA Medical schedule view with all patient details except TSH_ID (which requires patient record linking).

---

**Next Steps (Optional):**
1. Link appointments to unified_patients table for TSH_ID display
2. Set up automated daily schedule imports
3. Create patient records for new patients
