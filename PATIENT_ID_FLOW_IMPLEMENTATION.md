# Patient ID Flow Implementation - Complete Guide

## Overview
This document describes the comprehensive patient identification and selection system implemented for TSHLA Medical. The system provides a smooth workflow for staff to select, search, and create patients before starting dictation, with built-in duplicate prevention and phone-first identification.

---

## ✅ Completed Implementation

### 1. **Patient ID Generation Service**
**File**: `server/services/patientIdGenerator.service.js`

**Features**:
- Generates unique TSHLA IDs in format: `TSH-YYYY-NNNN` (e.g., `TSH-2025-0001`)
- Auto-increments within each year
- Resets to 0001 on January 1st
- Thread-safe generation using database queries
- Validates ID uniqueness before returning
- Migration tool for existing patients without IDs

**API**:
```javascript
const patientIdGenerator = require('./server/services/patientIdGenerator.service.js');

// Generate next ID
const id = await patientIdGenerator.generateNextId();
// Returns: "TSH-2025-0001"

// Validate format
const isValid = patientIdGenerator.isValidFormat('TSH-2025-0001');
// Returns: true

// Check if ID exists
const exists = await patientIdGenerator.exists('TSH-2025-0001');
// Returns: boolean

// Get statistics
const stats = await patientIdGenerator.getStats();
// Returns: { totalPatients, currentYearPatients, currentYear, nextId }

// Migrate legacy patients
const result = await patientIdGenerator.migrateLegacyPatients();
// Returns: { migrated, errors }
```

---

### 2. **Database Migration**
**File**: `database/migrations/add-tshla-id-column.sql`

**Changes**:
- Adds `tshla_id VARCHAR(13) UNIQUE` column to `unified_patients` table
- Creates index for fast lookups: `idx_unified_patients_tshla_id`
- Adds validation trigger to ensure proper TSH-YYYY-NNNN format
- Includes comments for documentation

**Manual Setup Required**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to SQL Editor
3. Copy and paste the contents of `database/migrations/add-tshla-id-column.sql`
4. Click "Run"

**Verification Query**:
```sql
SELECT COUNT(*) as total_patients,
       COUNT(tshla_id) as patients_with_tshla_id,
       COUNT(*) - COUNT(tshla_id) as patients_without_tshla_id
FROM unified_patients;
```

---

### 3. **PatientSelector Component**
**File**: `src/components/PatientSelector.tsx`

**Features**:
- **Three-tab interface**:
  1. **Search Tab**: Search by phone, name, MRN, or TSHLA ID
  2. **Schedule Tab**: Quick selection from today's appointments
  3. **Create Tab**: Create new patient on-the-fly

- **Duplicate Prevention**:
  - Real-time duplicate detection as phone is typed
  - Yellow warning banner if patient exists
  - "Use Existing Patient" button to prevent duplicates

- **Smart Search**:
  - Auto-detects if query is phone, name, or MRN
  - Uses existing `patientMatching.service.js` through API
  - Fallback to direct Supabase search if API unavailable

- **Validation**:
  - Required fields: First name, last name, phone
  - Optional fields: DOB, email
  - Phone format validation
  - Real-time error feedback

**Usage**:
```tsx
import PatientSelector from '../components/PatientSelector';

<PatientSelector
  onPatientSelected={(patient) => console.log('Selected:', patient)}
  onCancel={() => console.log('Cancelled')}
  preloadSchedule={true}
/>
```

---

### 4. **Enhanced Dictation Page**
**File**: `src/pages/DictationPageEnhanced.tsx`

**Features**:
- Shows PatientSelector modal when no patient ID in URL
- Loads patient automatically if ID provided in URL
- Displays patient info bar at top with:
  - Patient name
  - TSHLA ID
  - Phone number
  - Date of birth
  - "Change Patient" button
- Seamless integration with existing MedicalDictation component

**URL Structure**:
- `/dictation` - Shows patient selector
- `/dictation/:patientId` - Loads specific patient and starts dictation

---

### 5. **Patient Chart API Endpoints**
**File**: `server/api/patient-chart-api.js`

**New Endpoints**:

#### `GET /api/patient-chart/search/query?q=<query>`
Search patients by phone, name, MRN, or TSHLA ID.

**Request**:
```bash
GET /api/patient-chart/search/query?q=555-1234
```

**Response**:
```json
{
  "success": true,
  "patients": [
    {
      "id": "uuid",
      "tshla_id": "TSH-2025-0001",
      "first_name": "John",
      "last_name": "Doe",
      "phone_primary": "5551234567",
      "phone_display": "(555) 123-4567",
      "date_of_birth": "1980-01-01",
      "mrn": "MRN12345"
    }
  ]
}
```

#### `POST /api/patient-chart/create`
Create new patient (uses `patientMatching.service.js`).

**Request**:
```bash
POST /api/patient-chart/create
Content-Type: application/json

{
  "phone": "555-123-4567",
  "patientData": {
    "first_name": "Jane",
    "last_name": "Smith",
    "date_of_birth": "1990-05-15",
    "email": "jane@example.com"
  },
  "source": "dictation"
}
```

**Response**:
```json
{
  "success": true,
  "patient": {
    "id": "uuid",
    "tshla_id": "TSH-2025-0002",
    "patient_id": "PT-2025-0002",
    "phone_primary": "5551234567",
    "phone_display": "(555) 123-4567",
    "first_name": "Jane",
    "last_name": "Smith",
    "portal_pin": "******" // Hashed, not shown
  },
  "message": "Patient created successfully"
}
```

#### `POST /api/patient-chart/find-or-create`
Idempotent endpoint - finds existing or creates new.

**Request**: Same as `/create`

**Response**:
```json
{
  "success": true,
  "patient": { ... },
  "wasCreated": false,
  "message": "Found existing patient"
}
```

---

## 🔧 Existing Services Leveraged

### **patientMatching.service.js**
**File**: `server/services/patientMatching.service.js`

Already implements:
- ✅ Phone-first patient identification
- ✅ Phone normalization (removes formatting, handles US format)
- ✅ Find by phone: `findPatientByPhone(phone)`
- ✅ Find by MRN: `findPatientByMRN(mrn)`
- ✅ Find or create: `findOrCreatePatient(phone, patientData, source)`
- ✅ Smart data merging: `mergePatientData(patientId, newData, source)`
- ✅ PIN generation and hashing for patient portal
- ✅ Complete patient chart: `getPatientChart(identifier)`

**Data Sources Tracked**:
- `previsit` - Pre-visit phone call
- `dictation` - Staff dictation
- `schedule` - Schedule import
- `pdf` - PDF upload
- `manual` - Manual entry

---

## 🎯 User Workflow

### Scenario 1: Staff Dictates for Scheduled Patient

1. Staff clicks "Start Dictation"
2. PatientSelector modal appears
3. Staff clicks "Today's Schedule" tab
4. Staff sees list of today's appointments with times
5. Staff clicks on patient "John Doe - 2:00 PM"
6. Patient info bar appears at top
7. Dictation interface ready to record
8. Dictation saves with correct `unified_patient_id`

### Scenario 2: Walk-in Patient (Not in Schedule)

1. Staff clicks "Start Dictation"
2. PatientSelector modal appears
3. Staff types patient phone: "555-1234"
4. Search shows "Jane Smith - (555) 123-4567"
5. Staff clicks on Jane Smith
6. Patient loaded, ready to dictate

### Scenario 3: Brand New Patient

1. Staff clicks "Start Dictation"
2. PatientSelector modal appears
3. Staff clicks "Create New Patient" tab
4. Staff fills in:
   - First Name: Sarah
   - Last Name: Johnson
   - Phone: (555) 987-6543
   - DOB: 01/15/1985
   - Email: sarah@example.com
5. Staff clicks "Create Patient"
6. System:
   - Generates TSHLA ID: `TSH-2025-0003`
   - Normalizes phone: `5559876543`
   - Generates patient portal PIN
   - Creates record in `unified_patients`
7. Patient selected, ready to dictate

### Scenario 4: Duplicate Prevention

1. Staff clicks "Create New Patient"
2. Staff types phone: "555-123-4567"
3. System detects existing patient: John Doe
4. Yellow warning banner appears:
   > ⚠️ **Possible Duplicate Patient**
   > A patient with phone number (555) 123-4567 already exists: **John Doe**
   > [Use Existing Patient]
5. Staff clicks "Use Existing Patient"
6. John Doe selected (duplicate prevented!)

---

## 📊 Database Schema

### `unified_patients` Table

**New Column**:
```sql
tshla_id VARCHAR(13) UNIQUE  -- TSH-YYYY-NNNN format
```

**Existing Key Columns**:
```sql
id UUID PRIMARY KEY
patient_id VARCHAR(20)           -- PT-YYYY-NNNN (legacy)
phone_primary VARCHAR(20) UNIQUE -- Master identifier
phone_display VARCHAR(20)        -- Formatted display
mrn VARCHAR(50)                  -- Legacy EMR MRN
first_name VARCHAR(100)
last_name VARCHAR(100)
date_of_birth DATE
email VARCHAR(255)
portal_pin VARCHAR(255)          -- Hashed PIN
created_from VARCHAR(50)         -- Data source
data_sources TEXT[]              -- All sources
```

---

## 🚀 Testing Guide

### 1. Test Search Functionality

**Via Browser (http://localhost:5174)**:
1. Navigate to `/dictation`
2. PatientSelector modal appears
3. Type in search box:
   - Phone: `555-1234`
   - Name: `John Doe`
   - MRN: `MRN12345`
4. Verify results appear

**Via API**:
```bash
curl http://localhost:3000/api/patient-chart/search/query?q=555-1234
```

### 2. Test Create Patient

**Via Browser**:
1. Navigate to `/dictation`
2. Click "Create New Patient" tab
3. Fill in:
   - First Name: Test
   - Last Name: Patient
   - Phone: (555) 000-0001
4. Click "Create Patient"
5. Verify success

**Via API**:
```bash
curl -X POST http://localhost:3000/api/patient-chart/create \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "555-000-0001",
    "patientData": {
      "first_name": "Test",
      "last_name": "Patient",
      "date_of_birth": "1990-01-01"
    },
    "source": "dictation"
  }'
```

### 3. Test Duplicate Prevention

1. Create patient with phone: (555) 111-1111
2. Try to create another patient with same phone
3. Verify duplicate warning appears
4. Click "Use Existing Patient"
5. Verify existing patient loaded (no duplicate created)

### 4. Test TSHLA ID Generation

**Via Node.js**:
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
node -e "const gen = require('./server/services/patientIdGenerator.service.js'); gen.generateNextId().then(id => console.log('Generated:', id));"
```

Expected output:
```
Generated: TSH-2025-0001
```

---

## 🔨 Next Steps (Optional Enhancements)

### 1. **Fuzzy Name Matching**
Add Levenshtein distance algorithm to catch typos:
- "John Smith" vs "Jon Smith" (similarity: 95%)
- "Sarah Johnson" vs "Sara Jonson" (similarity: 87%)

**File to modify**: `server/services/patientMatching.service.js`

**Library to add**:
```bash
npm install string-similarity
```

**Implementation**:
```javascript
const stringSimilarity = require('string-similarity');

async findSimilarPatients(name, threshold = 0.8) {
  const { data: allPatients } = await supabase
    .from('unified_patients')
    .select('*');

  const matches = allPatients.filter(patient => {
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    const similarity = stringSimilarity.compareTwoStrings(name.toLowerCase(), fullName);
    return similarity >= threshold;
  });

  return matches;
}
```

### 2. **Admin Patient Merge Interface**
Create UI for resolving duplicates:
- **File**: `src/pages/admin/PatientMerge.tsx`
- **Route**: `/admin/patient-merge`
- **Features**:
  - List potential duplicates (same name, similar phone, etc.)
  - Side-by-side comparison
  - Select master record
  - Merge data with audit trail
  - Update all foreign keys

### 3. **EMR Import Tool**
Bulk import from old EMR with MRN mapping:
- **File**: `scripts/import-emr-patients.js`
- **Features**:
  - Read CSV/Excel from old EMR
  - Map columns: MRN, Name, Phone, DOB
  - Generate TSHLA IDs
  - Prevent duplicates (check phone first)
  - Import report (success/errors)

### 4. **Patient Portal Login**
Already partially implemented at line 46 in `patient-chart-api.js`:
- Endpoint: `POST /api/patient-chart/portal/login`
- Login with phone + PIN
- Returns patient chart data

---

## 📝 Configuration Checklist

### Required Manual Steps

- [ ] **Run Database Migration**
  - Go to Supabase Dashboard → SQL Editor
  - Run `database/migrations/add-tshla-id-column.sql`
  - Verify: Check `unified_patients` table has `tshla_id` column

- [ ] **Test Patient Creation**
  - Create test patient via UI
  - Verify TSHLA ID generated
  - Check phone normalization works

- [ ] **Test Schedule Integration**
  - Add test appointment to today's schedule
  - Open dictation page
  - Verify patient appears in "Today's Schedule" tab

- [ ] **Production Deployment**
  - Frontend already built (`npm run build` completed)
  - Backend running on port 3000
  - Deploy to Azure Container Apps (existing workflow)

---

## 🐛 Troubleshooting

### Issue: PatientSelector doesn't appear
**Solution**: Check browser console for errors. Ensure:
- Frontend rebuilt: `npm run build`
- Dev server running: `npm run dev`
- Patient chart API mounted in `unified-api.js`

### Issue: Search returns no results
**Solution**: Check:
1. Is unified API running on port 3000?
   ```bash
   lsof -i :3000
   ```
2. Is Supabase connection working?
   ```bash
   curl http://localhost:3000/api/patient-chart/search/query?q=test
   ```
3. Are there patients in `unified_patients` table?

### Issue: Create patient fails
**Solution**: Check:
1. Is `tshla_id` column added? (Run migration)
2. Check server logs for errors
3. Verify phone format (must be provided)

### Issue: TSHLA ID not generated
**Solution**:
1. Ensure migration ran successfully
2. Check `patientIdGenerator.service.js` has database access
3. Verify Supabase service role key in `.env`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## 📚 Related Documentation

- [API_SECURITY_FIX_COMPLETE.md](./API_SECURITY_FIX_COMPLETE.md) - Security fixes
- [SUPABASE_BACKUP_SETUP.md](./SUPABASE_BACKUP_SETUP.md) - Backup configuration
- [server/services/patientMatching.service.js](./server/services/patientMatching.service.js) - Patient matching logic
- [server/services/patientIdGenerator.service.js](./server/services/patientIdGenerator.service.js) - ID generation
- [src/components/PatientSelector.tsx](./src/components/PatientSelector.tsx) - Patient selection UI

---

## ✅ Summary

You now have a complete patient ID flow system with:

1. ✅ **TSHLA ID Generation** - Unique IDs in TSH-YYYY-NNNN format
2. ✅ **Patient Search** - By phone, name, MRN, or TSHLA ID
3. ✅ **Schedule Integration** - Quick selection from today's appointments
4. ✅ **Create New Patients** - With duplicate prevention
5. ✅ **Phone-First Matching** - Existing `patientMatching.service.js`
6. ✅ **Smooth Dictation Flow** - Patient selector before recording
7. ✅ **API Endpoints** - Search, create, find-or-create
8. ✅ **Database Migration** - Ready to run in Supabase

**Next Action**: Run the database migration in Supabase, then test the patient selection workflow at http://localhost:5174/dictation
