# Patient ID System Redesign

## Overview

The patient ID system has been redesigned to use random IDs instead of sequential year-based IDs for improved privacy and flexibility.

## Changes

### ID Formats

#### TSH ID (Portal Access Code)
- **Old Format**: `TSH-2025-0001` (sequential, year-based)
- **New Format**: `TSH 123-456` (6-digit random)
- **Purpose**: Patient portal access
- **Properties**:
  - Can be reset by staff if patient loses it
  - Random generation (no sequential numbers)
  - Format: `TSH XXX-XXX` where X is a digit (0-9)
  - Example: `TSH 384-927`

#### Patient ID (Primary Internal Identifier)
- **Old Format**: `PT-2025-0001` (sequential, year-based)
- **New Format**: `12345678` (8-digit random)
- **Purpose**: Primary internal identifier
- **Properties**:
  - **PERMANENT** - never changes, tied to patient forever
  - Random generation (no sequential numbers)
  - Format: 8 digits, no prefix
  - Example: `42891073`

#### MRN (Medical Record Number)
- **Source**: External EMR systems (e.g., Athena)
- **Format**: Usually numbers from old EMR
- **Properties**: Can be changed by staff, used for lookup

### Search Capabilities

Patients can now be searched by ALL demographics:
- **Patient ID** (8-digit) - PRIMARY identifier
- **TSH ID** (6-digit)
- **First Name** (separate field)
- **Last Name** (separate field)
- **Phone Number**
- **MRN**
- **Date of Birth**
- **Email**

## Implementation Details

### 1. Database Migration

**File**: `database/migrations/update-patient-ids-random.sql`

Key changes:
- Modified `tshla_id` column to VARCHAR(11) for `TSH XXX-XXX` format
- Modified `patient_id` column to VARCHAR(8) for 8-digit format
- Added validation triggers for new ID formats
- Added indexes for improved search performance
- Added database comments for documentation

**How to run**:
```bash
# Connect to Supabase and run the migration SQL
psql "postgresql://..." < database/migrations/update-patient-ids-random.sql
```

### 2. ID Generator Service

**File**: `server/services/patientIdGenerator.service.js`

Completely rewritten with:
- `generateNextTshId()` - Generates random 6-digit TSH ID
- `generateNextPatientId()` - Generates random 8-digit Patient ID
- Collision detection and retry logic (up to 10 attempts)
- `resetTshId(patientUuid)` - Staff function to reset TSH ID
- Validation methods for both ID formats
- Legacy compatibility methods (deprecated but functional)

**Key features**:
- Random number generation between ranges:
  - TSH: 100000-999999 (6 digits)
  - Patient ID: 10000000-99999999 (8 digits)
- Database uniqueness check before returning
- Automatic retry if collision detected
- Clear logging for debugging

### 3. Patient Matching Service

**File**: `server/services/patientMatching.service.js`

New search methods added:
- `findPatientByPatientId(patientId)` - Search by 8-digit ID
- `findPatientByTshId(tshId)` - Search by TSH ID
- `findPatientByEmail(email)` - Search by email
- `searchPatientsByName(firstName, lastName)` - Search by name (separate fields)
- `searchPatientsByDOB(dob)` - Search by date of birth
- `searchPatients(searchParams)` - Comprehensive search across all fields

Updated patient creation:
- Now generates both TSH ID and Patient ID on creation
- Both IDs are stored in database immediately
- Removed old sequential ID generation logic

### 4. API Endpoint Updates

**File**: `server/api/patient-chart-api.js`

Updated `/api/patient-chart/search/query` endpoint:

**Old behavior**:
```
GET /api/patient-chart/search/query?q=searchterm
```

**New behavior**:
```
GET /api/patient-chart/search/query?q=searchterm
GET /api/patient-chart/search/query?patientId=12345678
GET /api/patient-chart/search/query?tshId=TSH 123-456
GET /api/patient-chart/search/query?firstName=John&lastName=Smith
GET /api/patient-chart/search/query?phone=555-1234
GET /api/patient-chart/search/query?email=patient@example.com
GET /api/patient-chart/search/query?mrn=MRN12345
GET /api/patient-chart/search/query?dob=1980-01-15
```

All parameters can be combined for more specific searches.

### 5. Frontend Updates

**File**: `src/components/PatientSelector.tsx`

The component now supports:
- Search by TSH ID
- Search by Patient ID (8-digit)
- Separate first name and last name fields
- All existing search capabilities maintained

**Note**: The frontend already uses the API endpoint, so it automatically benefits from the enhanced search without requiring code changes.

### 6. Migration Script

**File**: `scripts/migrate-patient-ids.js`

Script to migrate existing patients from old ID formats to new random formats.

**Usage**:
```bash
# Dry run (preview changes without updating)
node scripts/migrate-patient-ids.js --dry-run

# Actual migration
node scripts/migrate-patient-ids.js
```

**Features**:
- Fetches all active patients
- Generates new random IDs for each patient
- Backs up old IDs to audit table (patient_id_migration_history)
- Updates patients one by one with small delays
- Detailed logging and error reporting
- Summary statistics at the end

**IMPORTANT**: Run the database migration SQL first!

## Migration Steps

Follow these steps in order:

### Step 1: Database Migration
```bash
# Run the database migration to update schema
psql "postgresql://..." < database/migrations/update-patient-ids-random.sql
```

### Step 2: Deploy Code Changes
```bash
# Deploy the updated backend code
git add .
git commit -m "Redesign patient ID system with random IDs"
git push

# Deploy will happen automatically via GitHub Actions
```

### Step 3: Migrate Existing Patients
```bash
# First do a dry run to see what will change
node scripts/migrate-patient-ids.js --dry-run

# Review the output, then run actual migration
node scripts/migrate-patient-ids.js
```

### Step 4: Verify
```bash
# Check a few patients in the database
# Verify they have new random IDs
# Test search functionality in the UI
```

## Testing

### 1. Test ID Generation
```bash
# You can test the ID generator directly
node -e "
const gen = require('./server/services/patientIdGenerator.service.js');
(async () => {
  console.log('TSH ID:', await gen.generateNextTshId());
  console.log('Patient ID:', await gen.generateNextPatientId());
})();
"
```

### 2. Test Search API
```bash
# Test search by patient ID
curl "http://localhost:3000/api/patient-chart/search/query?patientId=12345678"

# Test search by TSH ID
curl "http://localhost:3000/api/patient-chart/search/query?tshId=TSH%20123-456"

# Test search by name
curl "http://localhost:3000/api/patient-chart/search/query?firstName=John&lastName=Smith"

# Test generic search
curl "http://localhost:3000/api/patient-chart/search/query?q=John"
```

### 3. Test Patient Creation
```bash
# Create a new patient via API
curl -X POST "http://localhost:3000/api/patient-chart" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "555-1234",
    "firstName": "Test",
    "lastName": "Patient",
    "source": "manual"
  }'

# Verify the new patient has random IDs
```

## Key Design Decisions

### Why Random IDs?

1. **Privacy**: Sequential IDs reveal information about patient count and when they joined
2. **Security**: Harder to guess valid patient IDs
3. **Flexibility**: No need to track sequences or handle year rollover
4. **Portability**: No year prefix makes IDs more portable across systems

### Why Separate TSH ID and Patient ID?

1. **TSH ID**: User-facing, can be reset if lost, used for portal access
2. **Patient ID**: Internal, permanent, never changes, used for system operations

### Why Different Lengths?

1. **TSH ID (6 digits)**: Easier for patients to remember/type
2. **Patient ID (8 digits)**: More unique combinations for large patient base

## API Reference

### Search Patients
```
GET /api/patient-chart/search/query
```

**Parameters** (at least one required):
- `q` - Generic text search across all fields
- `patientId` - Patient ID (8-digit)
- `tshId` - TSH ID (format: "TSH XXX-XXX")
- `firstName` - First name (partial match)
- `lastName` - Last name (partial match)
- `phone` - Phone number (any format)
- `mrn` - Medical record number
- `email` - Email address
- `dob` - Date of birth (YYYY-MM-DD)

**Response**:
```json
{
  "success": true,
  "patients": [
    {
      "id": "uuid",
      "patient_id": "12345678",
      "tshla_id": "TSH 123-456",
      "first_name": "John",
      "last_name": "Smith",
      "phone_primary": "5551234567",
      "phone_display": "(555) 123-4567",
      "email": "john@example.com",
      "date_of_birth": "1980-01-15",
      "mrn": "MRN12345"
    }
  ],
  "count": 1
}
```

### Reset TSH ID (Staff Only)
```javascript
const patientIdGenerator = require('./server/services/patientIdGenerator.service.js');

// Reset TSH ID for a patient
const newTshId = await patientIdGenerator.resetTshId(patientUuid);
console.log(`New TSH ID: ${newTshId}`);
```

## Troubleshooting

### Issue: Migration script fails with collision errors

**Solution**: The script has retry logic built in. If you see multiple collisions:
1. Check that the database migration ran successfully
2. Verify uniqueness constraints are in place
3. The script will retry up to 10 times per ID

### Issue: Search not finding patients by TSH ID

**Solution**:
1. Verify the TSH ID format includes spaces: `TSH 123-456` not `TSH123-456`
2. Check that the database migration added the index: `idx_unified_patients_tshla_id`
3. Verify the patient has a TSH ID: `SELECT tshla_id FROM unified_patients WHERE id = '...'`

### Issue: Old ID format still appearing

**Solution**:
1. Run the migration script: `node scripts/migrate-patient-ids.js`
2. Check migration history: `SELECT * FROM patient_id_migration_history`
3. Verify database constraints are enforcing new format

## Support

For issues or questions:
1. Check this documentation first
2. Review migration logs
3. Check database for validation errors
4. Review server logs for ID generation issues

## Future Enhancements

Potential future improvements:
1. Add TSH ID reset API endpoint for staff
2. Add patient ID format validation to frontend forms
3. Add TSH ID to patient portal login
4. Add patient ID to printed documents
5. Add analytics on ID collision rates
