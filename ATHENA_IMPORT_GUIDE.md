# Athena Patient Import Guide

## Patient ID System Overview

The TSHLA medical system uses three types of patient identifiers:

| ID Type | Database Column | Format | Can Change? | Purpose |
|---------|-----------------|--------|-------------|---------|
| **Internal ID** | `patient_id` | `12345678` (8-digit random) | ❌ **NEVER** | Primary permanent identifier for all internal operations |
| **TSH ID** | `tshla_id` | `TSH 123-456` (6-digit random) | ✅ Yes (staff can reset) | Patient portal access code |
| **Athena ID** | `mrn` | Varies (from Athena EMR) | ✅ Yes (staff can update) | External EMR identifier from Athena Health |

### Important Notes:
- **Internal ID** is auto-generated and **PERMANENT** - it never changes and uniquely identifies a patient forever
- **TSH ID** is auto-generated but can be reset by staff if a patient loses it
- **Athena ID** (stored in `mrn` field) is imported from your Athena Health system and can be updated

## CSV File Format

### Required Columns

Your CSV file should contain the following columns (case-insensitive, various formats accepted):

#### Patient Demographics
- **Patient ID** (patientid) - Athena Patient ID → saved to `mrn` field
- **Patient First Name** (patient firstname)
- **Patient Last Name** (patient lastname)
- **Patient Middle Initial** (patient middleinitial) - Optional
- **Patient Date of Birth** (patientdob) - Format: MM/DD/YYYY or YYYY-MM-DD
- **Patient Sex** (patientsex) - M/F or Male/Female

#### Contact Information (At least one phone required)
- **Patient Mobile Phone Number** (patient mobile no) - **REQUIRED**
- **Patient Work Phone** (patient workphone) - Optional
- **Patient Email** (patient email) - Optional

#### Address
- **Patient Address1** (patient address1)
- **Patient Address2** (patient address2) - Optional
- **Patient City** (patient city)
- **Patient State** (patient state)
- **Patient Zip Code** (patient zip)

#### Additional Demographics (Optional)
- **Patient Driver License Number** (license number)
- **Patient Employer** (employer)
- **Patient Ethnicity** (ethnicity)
- **Patient Race** (race)

#### Appointment Information (Optional, but recommended)
- **Appointment Scheduling Provider** (appt schdlng prvdr)
- **Appointment Date** (apptdate) - Format: MM/DD/YYYY
- **Appointment Starttime** (apptstarttime) - Format: HH:MM or HH:MM AM/PM

### Example CSV Format

```csv
patientid,patient firstname,patient lastname,patient middleinitial,patientdob,patientsex,patient mobile no,patient email,patient address1,patient city,patient state,patient zip,appt schdlng prvdr,apptdate,apptstarttime
ATH12345,John,Smith,A,01/15/1980,M,555-123-4567,john@email.com,123 Main St,Houston,TX,77001,Dr. Johnson,01/10/2026,09:00 AM
ATH12346,Jane,Doe,,03/22/1975,F,555-987-6543,jane@email.com,456 Oak Ave,Houston,TX,77002,Dr. Smith,01/10/2026,10:30 AM
```

## Prerequisites

### 1. Database Migration

Run the database migration to add missing patient fields:

```bash
# Connect to Supabase and run the migration
# Option A: Via Supabase Dashboard
# - Go to SQL Editor: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql/new
# - Copy/paste contents of database/migrations/add-athena-patient-fields.sql
# - Click "Run"

# Option B: Via psql
psql "postgresql://..." < database/migrations/add-athena-patient-fields.sql
```

### 2. Install Dependencies

```bash
# Install csv-parser if not already installed
npm install csv-parser
```

## Import Process

### Step 1: Prepare Your CSV File

1. Export patient data from Athena Health
2. Ensure the CSV has the required columns (see format above)
3. Save the file locally (e.g., `athena-patients-2026-01-10.csv`)

### Step 2: Run Dry Run First

Always run a dry run first to preview what will be imported:

```bash
node scripts/import-athena-patients.js path/to/your-file.csv --dry-run
```

This will:
- ✅ Show you how many rows will be processed
- ✅ Display sample data for each patient
- ✅ Show any validation errors
- ❌ NOT make any changes to the database

Example output:
```
🏥 Athena Patient Import
========================

📄 File: athena-patients-2026-01-10.csv
⚠️  DRY RUN MODE - No changes will be made

📊 Found 150 rows in CSV file

[Row 1] Processing patient: John Smith
   Athena ID: ATH12345
   Phone: 555-123-4567
   DOB: 1980-01-15
   [DRY RUN] Would create/update patient and appointment

[Row 2] Processing patient: Jane Doe
   Athena ID: ATH12346
   Phone: 555-987-6543
   DOB: 1975-03-22
   [DRY RUN] Would create/update patient and appointment

...

========================
📊 Import Summary
========================
Total rows: 150
✅ Successful: 148
❌ Failed: 2
⏭️  Skipped: 0
```

### Step 3: Review and Fix Errors

If the dry run shows errors:
1. Review the error messages
2. Fix issues in your CSV file
3. Run dry run again until all rows process successfully

### Step 4: Run Actual Import

Once the dry run looks good, run the actual import:

```bash
node scripts/import-athena-patients.js path/to/your-file.csv
```

This will:
- ✅ Create or update patients in `unified_patients` table
- ✅ Auto-generate **Internal ID** (8-digit) and **TSH ID** (6-digit) for new patients
- ✅ Store Athena Patient ID in `mrn` field
- ✅ Create appointments in `provider_schedules` table
- ✅ Link patients to their appointments

## How the Import Works

### Duplicate Detection (Phone-First Matching)

The import uses **phone-first matching** to prevent duplicates:

1. **Search by phone number** - If a patient with the same phone exists:
   - ✅ Updates existing patient with new data
   - ✅ Merges data intelligently (fills in missing fields, doesn't overwrite existing)
   - ✅ Adds appointment to existing patient

2. **Search by Athena ID (mrn)** - If phone doesn't match but Athena ID does:
   - ✅ Updates existing patient
   - ✅ Merges data

3. **Create new patient** - If no match found:
   - ✅ Creates new patient
   - ✅ Auto-generates Internal ID (e.g., `42891073`)
   - ✅ Auto-generates TSH ID (e.g., `TSH 384-927`)
   - ✅ Stores Athena ID in `mrn` field
   - ✅ Creates appointment if provided

### Data Merging Strategy

When updating existing patients, the import:
- ✅ **Fills in missing fields** - If a field is empty, it fills it in
- ❌ **Doesn't overwrite existing data** - If a field already has data, it keeps it
- ✅ **Appends clinical data** - Conditions, medications, allergies are appended
- ✅ **Tracks data sources** - Records that data came from "athena-import"

## Searching for Patients

After import, you can search for patients using:

1. **Internal ID** (8-digit):
   ```
   GET /api/patient-chart/search/query?patientId=12345678
   ```

2. **TSH ID** (6-digit):
   ```
   GET /api/patient-chart/search/query?tshId=TSH 384-927
   ```

3. **Athena ID** (mrn):
   ```
   GET /api/patient-chart/search/query?mrn=ATH12345
   ```

4. **Phone number**:
   ```
   GET /api/patient-chart/search/query?phone=555-123-4567
   ```

5. **Name** (separate first/last):
   ```
   GET /api/patient-chart/search/query?firstName=John&lastName=Smith
   ```

6. **Email**:
   ```
   GET /api/patient-chart/search/query?email=john@email.com
   ```

7. **Date of birth**:
   ```
   GET /api/patient-chart/search/query?dob=1980-01-15
   ```

8. **Generic search** (searches across all fields):
   ```
   GET /api/patient-chart/search/query?q=John
   ```

## Troubleshooting

### Problem: "Missing mobile phone"

**Cause**: The patient row doesn't have a mobile phone number

**Solution**:
- Mobile phone is required for all patients
- Add phone numbers to your CSV file
- Or manually add them in Athena before exporting

### Problem: "Missing first or last name"

**Cause**: Name fields are empty in CSV

**Solution**:
- Ensure all patients have both first and last names
- Fix missing names in Athena before exporting

### Problem: "Could not parse date"

**Cause**: Date format is not recognized

**Solution**:
- Use MM/DD/YYYY or YYYY-MM-DD format
- Ensure dates are valid (e.g., not 13/45/2026)

### Problem: "Could not create appointment"

**Cause**: Appointment data is incomplete or appointment already exists

**Solution**:
- This is usually non-critical - patient is still created
- Check that provider, date, and time are all provided
- Duplicate appointments are automatically prevented

### Problem: Import seems slow

**Explanation**: The import adds a 100ms delay between each patient to avoid overwhelming the database

**Solution**:
- This is normal and intentional
- For 1000 patients, expect ~2-3 minutes
- Don't interrupt the import - let it complete

## Post-Import Verification

After importing, verify the data:

```sql
-- Check total patients imported
SELECT COUNT(*) FROM unified_patients WHERE created_from = 'athena-import';

-- Check patients with Athena IDs
SELECT COUNT(*) FROM unified_patients WHERE mrn IS NOT NULL;

-- Check appointments created
SELECT COUNT(*) FROM provider_schedules WHERE imported_from = 'athena-csv';

-- View sample imported patients
SELECT
  patient_id as internal_id,
  tshla_id as tsh_id,
  mrn as athena_id,
  first_name,
  last_name,
  phone_primary,
  created_from
FROM unified_patients
WHERE created_from = 'athena-import'
LIMIT 10;
```

## Field Mapping Reference

Complete mapping of CSV columns to database fields:

| CSV Column | Database Table | Database Column | Notes |
|------------|----------------|-----------------|-------|
| patientid | unified_patients | mrn | Athena Patient ID |
| patient firstname | unified_patients | first_name | Required |
| patient lastname | unified_patients | last_name | Required |
| patient middleinitial | unified_patients | middle_initial | Optional |
| patientdob | unified_patients | date_of_birth | Date format |
| patientsex | unified_patients | gender | M/F or Male/Female |
| patient mobile no | unified_patients | phone_primary | **REQUIRED** - Master identifier |
| patient workphone | unified_patients | phone_secondary | Optional |
| patient email | unified_patients | email | Optional |
| patient address1 | unified_patients | address_line1 | Optional |
| patient address2 | unified_patients | address_line2 | Optional |
| patient city | unified_patients | city | Optional |
| patient state | unified_patients | state | Optional |
| patient zip | unified_patients | zip_code | Optional |
| license number | unified_patients | drivers_license | Optional |
| employer | unified_patients | employer | Optional |
| ethnicity | unified_patients | ethnicity | Optional |
| race | unified_patients | race | Optional |
| N/A (auto-generated) | unified_patients | patient_id | Internal ID (8-digit) |
| N/A (auto-generated) | unified_patients | tshla_id | TSH ID (6-digit) |
| appt schdlng prvdr | provider_schedules | provider_name | Optional |
| apptdate | provider_schedules | scheduled_date | Optional |
| apptstarttime | provider_schedules | start_time | Optional |

## Support

For issues or questions:
1. Check this documentation
2. Review import error messages
3. Run dry run mode to diagnose issues
4. Check database logs in Supabase dashboard
