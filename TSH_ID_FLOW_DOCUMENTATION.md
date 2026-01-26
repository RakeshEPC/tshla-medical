# TSH ID Flow: Schedule → Dictation → Patient Portal

## Overview
This document explains how TSH IDs are generated and flow through the system from schedule uploads to patient portal access.

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    1. SCHEDULE UPLOAD (CSV)                         │
│  Staff uploads Athena CSV → scheduleService.importAthenaSchedule() │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│              2. PATIENT CREATION (Auto-Generated)                   │
│  • Checks if patient exists by phone/MRN                            │
│  • If NOT found → Creates unified_patients record                   │
│  • Auto-generates TSH ID (e.g., "TSH 123-456")                     │
│  • Links to provider_schedules.unified_patient_id                   │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│             3. SCHEDULE VIEW (Staff Dashboard)                      │
│  URL: /schedule                                                     │
│  • Displays appointments with TSH ID                                │
│  • Shows: TSH 123-456, MRN, Patient ID                             │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│               4. DICTATION (From Schedule)                          │
│  Staff clicks appointment → /quick-note?appointmentId=123           │
│  • Loads unified_patient_id from appointment                        │
│  • Dictation saved to dictations table                              │
│  • Links: dictations.patient_id → unified_patients.id              │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│          5. H&P GENERATION (Automatic on Completion)                │
│  When dictation status = 'completed':                               │
│  • dictationStorageService triggers H&P generation                  │
│  • comprehensiveHPGenerator extracts meds/labs via AI               │
│  • Saves to patient_comprehensive_chart table                       │
│  • Indexes by: patient_phone & tshla_id                            │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│              6. PATIENT PORTAL (Patient Access)                     │
│  URL: /patient-portal-unified                                       │
│  Login with:                                                        │
│  • TSH ID: "TSH 123-456" (from unified_patients.tshla_id)         │
│  • Phone last 4: "1234"                                             │
│                                                                     │
│  Dashboard shows:                                                   │
│  • Medications (from H&P)                                           │
│  • Lab results (from H&P)                                           │
│  • Audio visit summaries                                            │
│  • Payment requests                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Files Modified (2026-01-25)

### 1. Frontend: Schedule Import Service
**File:** `src/services/scheduleService.ts`

**Changes:**
- Added patient lookup by phone/MRN before inserting appointments
- Calls `/api/patients/find-or-create` to create unified_patients
- Links `unified_patient_id` to `provider_schedules`
- Auto-generates TSH ID via `patientMatching.service.js`

**Code Location:** Lines 373-448

### 2. Backend: Patient API Endpoint
**File:** `server/unified-api.js`

**Changes:**
- Added `POST /api/patients/find-or-create` endpoint
- Uses `patientMatchingService.findOrCreatePatient()`
- Returns patient with TSH ID

**Code Location:** Lines 2181-2222

### 3. Backend: Patient Matching Service (Already Existed)
**File:** `server/services/patientMatching.service.js`

**Features:**
- Auto-generates 6-digit TSH ID (format: `TSH XXX-XXX`)
- Auto-generates 8-digit Patient ID
- Uses `patientIdGenerator.service.js` for unique IDs
- Creates unified_patients record with all demographics

**Code Location:** Lines 415-531

## TSH ID Format

**Format:** `TSH XXX-XXX`
- Example: `TSH 123-456`
- Database stores both formats:
  - With space: `TSH 123-456`
  - Without space: `TSH123456`
- APIs handle both formats automatically

## Database Tables

### unified_patients
```sql
- id (UUID) - Primary key
- patient_id (VARCHAR) - 8-digit random ID
- tshla_id (VARCHAR) - TSH ID (TSH XXX-XXX)
- phone_primary (VARCHAR) - Normalized phone (digits only)
- phone_display (VARCHAR) - Formatted phone (555) 123-4567
- first_name, last_name, dob, etc.
```

### provider_schedules
```sql
- id (BIGINT) - Primary key
- unified_patient_id (UUID) - Foreign key to unified_patients
- patient_name, patient_phone, patient_mrn, etc.
```

### dictations
```sql
- id (UUID) - Primary key
- patient_id (UUID) - Foreign key to unified_patients
- appointment_id (BIGINT) - Foreign key to provider_schedules
- transcription_text, final_note, etc.
```

### patient_comprehensive_chart
```sql
- patient_phone (VARCHAR) - Primary identifier
- tshla_id (VARCHAR) - TSH ID for portal access
- medications (JSONB) - Extracted from dictations
- labs (JSONB) - Extracted from dictations
- diagnoses, vitals, goals, etc.
```

## How Data Flows

### 1. Schedule Upload Creates Patient
```javascript
// scheduleService.ts (lines 373-448)
if (apt.patientPhone) {
  // Find existing patient
  const existingPatient = await supabase
    .from('unified_patients')
    .select('id, tshla_id')
    .eq('phone_primary', normalizedPhone)
    .maybeSingle();

  if (!existingPatient) {
    // Create new patient via API
    const response = await fetch(`${apiUrl}/api/patients/find-or-create`, {
      method: 'POST',
      body: JSON.stringify({
        phone: apt.patientPhone,
        patientData: { ... },
        source: 'schedule'
      })
    });

    // Returns patient with TSH ID auto-generated
    const result = await response.json();
    unifiedPatientId = result.patient.id;
  }
}
```

### 2. Dictation Links to Patient
```javascript
// QuickNote.tsx loads unified_patient_id from appointment
// MedicalDictation saves dictation with patient_id
// dictationStorageService.ts triggers H&P generation
```

### 3. H&P Extracts Meds/Labs
```javascript
// comprehensiveHPGenerator.service.js (lines 1-300)
// AI extracts structured data from dictation text
// Merges into patient_comprehensive_chart
// Indexed by patient_phone and tshla_id
```

### 4. Patient Portal Displays Data
```javascript
// PatientPortalUnified.tsx - Login with TSH ID
// PatientHPView.tsx - Fetches from /api/hp/patient/:tshlaId
// Shows medications, labs, vitals from H&P
```

## API Endpoints

### Patient Creation
```
POST /api/patients/find-or-create
Body: {
  "phone": "5551234567",
  "patientData": {
    "firstName": "John",
    "lastName": "Doe",
    "dob": "1980-01-15",
    "mrn": "MRN123456"
  },
  "source": "schedule"
}

Response: {
  "success": true,
  "patient": {
    "id": "uuid",
    "patient_id": "12345678",
    "tshla_id": "TSH 123-456",
    "phone_primary": "5551234567"
  }
}
```

### Patient Portal Login
```
POST /api/patient-portal/login
Body: {
  "tshlaId": "TSH 123-456",
  "phoneLast4": "4567"
}

Response: {
  "success": true,
  "sessionId": "uuid",
  "patientPhone": "5551234567",
  "tshlaId": "TSH123456",
  "patientName": "John Doe"
}
```

### Get Patient H&P
```
GET /api/hp/patient/TSH123456
Headers: {
  "x-session-id": "session-uuid"
}

Response: {
  "success": true,
  "hp": {
    "patient_phone": "5551234567",
    "tshla_id": "TSH 123-456",
    "medications": [...],
    "labs": {...},
    "vitals": {...}
  }
}
```

## Testing the Flow

### Step 1: Upload Schedule
1. Go to `/schedule-upload`
2. Upload Athena CSV with patient data
3. Verify patients created in `unified_patients` table
4. Check `tshla_id` field is populated

### Step 2: View Schedule
1. Go to `/schedule`
2. Select date from CSV
3. Verify TSH ID displays next to patient name
4. Click appointment

### Step 3: Dictate Note
1. Opens `/quick-note?appointmentId=123`
2. Dictate visit note mentioning medications and labs
3. Complete dictation
4. Verify H&P updated in database

### Step 4: Patient Portal Login
1. Go to `/patient-portal-unified`
2. Enter TSH ID from schedule
3. Enter last 4 of phone
4. Login successful

### Step 5: View H&P in Portal
1. Click "View Full Medical Chart"
2. Verify medications from dictation appear
3. Verify labs from dictation appear
4. Data matches what was dictated

## Troubleshooting

### TSH ID Not Showing in Schedule
- Check `unified_patients` table has `tshla_id` populated
- Check `provider_schedules.unified_patient_id` is linked
- Run migration to backfill existing patients

### Patient Can't Login
- Verify TSH ID format (with/without space both work)
- Check phone number matches exactly
- Check `unified_patients.tshla_id` is set

### Medications Not Showing in Portal
- Check dictation status is 'completed'
- Verify H&P generation triggered
- Check `patient_comprehensive_chart` table
- Check AI extraction logs

## Summary

✅ **What Works Now:**
1. Schedule upload auto-creates patients with TSH IDs
2. Schedule displays TSH ID for each patient
3. Dictation from schedule links to patient automatically
4. H&P generation extracts meds/labs from dictation
5. Patient portal login uses TSH ID
6. Patient sees their meds/labs in portal

✅ **TSH ID is consistently used across:**
- Schedule view
- Patient records
- Portal authentication
- H&P retrieval

🎯 **Result:** Complete end-to-end flow from schedule → dictation → patient portal!
