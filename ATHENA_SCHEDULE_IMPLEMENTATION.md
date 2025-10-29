# Athena Schedule Feature - Implementation Progress

## 🎉 Completed Components

### 1. Database Migration ✅
**File:** `database/migrations/athena-schedule-enhancement.sql`

**What it does:**
- Adds new columns to `provider_schedules` table:
  - `patient_age`, `patient_gender` (demographics)
  - `chief_diagnosis`, `visit_reason` (clinical info)
  - `athena_appointment_id`, `external_patient_id` (Athena integration)
  - `imported_by`, `imported_at`, `import_batch_id` (tracking)
  - `provider_specialty`, `color_code` (display)
- Creates `schedule_imports` table to log all imports
- Creates useful views:
  - `v_today_schedule` - Today's appointments across all providers
  - `v_provider_schedule_summary` - Stats by provider and date
- Creates helper functions:
  - `check_duplicate_appointment()` - Prevent duplicates
  - `get_provider_schedule()` - Get specific provider's day
  - `get_providers_with_schedule()` - List providers for a date
  - `calculate_age_from_dob()` - Calculate age from DOB
- Updates RLS policies for admin access

**To run:** Copy SQL to Supabase Dashboard → SQL Editor → Execute

---

### 2. TypeScript Types ✅
**File:** `src/types/schedule.types.ts`

**What it provides:**
- `ProviderScheduleAppointment` - Main appointment interface
- `AthenaScheduleRow` - Raw Athena CSV row
- `ParsedAthenaAppointment` - Normalized appointment from Athena
- `ScheduleImportResult` - Import results with success/error counts
- `GroupedSchedule` - Providers with their appointments
- `AppointmentStatus`, `AppointmentType`, `UrgencyLevel` - Enums
- Type guards for validation

---

### 3. Athena Schedule Parser ✅
**File:** `src/services/athenaScheduleParser.service.ts`

**What it does:**
- Parses CSV/TSV files from Athena Health
- Auto-detects delimiter (comma or tab)
- Intelligently maps column headers (flexible with variations)
- Handles quoted CSV fields
- Extracts:
  - Date, Time, Duration
  - Provider name → Maps to internal provider ID
  - Patient demographics (first/last name, age, DOB, gender)
  - Diagnosis, Visit type
  - Contact info (phone, email, MRN)
- Validates required fields
- Calculates confidence score for each row
- Returns structured data ready for import

**Provider mapping:** Update `PROVIDER_NAME_MAPPING` in the file with your provider names

---

### 4. Schedule Uploader Component ✅
**File:** `src/components/AthenaScheduleUploader.tsx`

**Features:**
- Drag-and-drop file upload
- Accepts CSV, TSV, Excel (.xls, .xlsx)
- Date selector for schedule date
- Parses file and shows preview:
  - Total appointments found
  - Breakdown by provider
  - Sample appointments
  - Errors (if any)
- Review before import
- "Import to Database" button

**UI Flow:**
1. Select/drop Athena schedule file
2. Choose schedule date
3. Click "Parse Schedule File"
4. Review parsed data
5. Click "Import to Database"
6. Success message shown

---

### 5. Admin Page Enhancement ✅
**File:** `src/pages/AdminAccountCreation.tsx`

**What changed:**
- Added 3rd tab: "📅 Upload Schedule"
- Tab types: `Staff`, `Patient`, `Upload Schedule`
- When "Upload Schedule" selected:
  - Shows `AthenaScheduleUploader` component
  - Import status indicator with spinner
  - Success/error messages
- Only admin users can access this page

**Access:** Navigate to `/admin/create-accounts` → Click "Upload Schedule" tab

---

### 6. Provider Schedule View ✅
**File:** `src/components/ProviderScheduleView.tsx`

**Design:** Vertical scrolling layout (one provider per section)

**Features:**
- Date navigation (Prev Day, Today, Next Day, Refresh)
- Provider sections with:
  - Provider name, specialty, photo
  - Total patients, completed/pending counts
  - Total minutes scheduled
- Each appointment card shows:
  - Time range with duration
  - Patient name, age, gender
  - Chief diagnosis (DX)
  - Visit type, appointment type
  - Status badge (Scheduled, In-Progress, Completed, etc.)
  - Telehealth indicator
  - Phone, DOB
- Action buttons:
  - "✍️ Start Dictation" - Opens dictation page with pre-filled data
  - "✓ Mark Complete" - Updates status to completed
  - "View Chart" - Opens patient chart
- Color coding:
  - New patient: Purple
  - Follow-up: Blue
  - Wellness: Green
  - Emergency: Red
- Responsive design

**Props:**
```typescript
<ProviderScheduleView
  date="2025-01-28"
  providerIds={["doc1", "doc2"]} // Optional: filter specific providers
  onRefresh={() => loadData()}
/>
```

---

## 🚧 Next Steps (TODO)

### 7. Enhance Schedule Service
**File:** `src/services/scheduleService.ts`

**Need to add:**
```typescript
// Import parsed appointments to Supabase
async importAthenaSchedule(
  appointments: ParsedAthenaAppointment[],
  importedBy: string
): Promise<ScheduleImportResult>

// Get all providers' schedule for a date
async getAllProvidersSchedule(date: string): Promise<GroupedSchedule>

// Get specific provider's schedule
async getProviderSchedule(providerId: string, date: string): Promise<ProviderScheduleAppointment[]>

// Update appointment status
async updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void>

// Link appointment to dictation note
async linkAppointmentToNote(appointmentId: string, noteId: string): Promise<void>
```

**Supabase integration:**
- Use `supabase.from('provider_schedules').insert()`
- Handle duplicate checking
- Create batch ID for import tracking
- Log to `schedule_imports` table

---

### 8. Update SchedulePage
**File:** `src/pages/SchedulePage.tsx`

**Changes needed:**
- Replace mock data with real Supabase queries
- Import `ProviderScheduleView` component
- Add provider filter (multi-select dropdown)
- Add search by patient name
- Add quick stats cards:
  - Total appointments today
  - Completed count
  - Pending count
  - Average appointment time
- Add "Import Schedule" button (admin only) → opens modal with uploader

---

### 9. Dictation Integration
**File:** `src/pages/DictationPage.tsx`

**When launched from schedule:**
- Accept `appointmentId` in URL params
- Read appointment data from route state
- Pre-populate form fields:
  - Patient name
  - Patient age, DOB, gender
  - Chief complaint from schedule
- Auto-link created note to appointment:
  - Save to `dictated_notes` with `appointment_id`
  - Create entry in `schedule_note_links` table
- Update appointment status:
  - `in-progress` when recording starts
  - `completed` when note is saved
- Add "Back to Schedule" button
- Show appointment context at top of page

---

### 10. Testing
**Test workflow:**
1. **Database Setup:**
   - Run migration SQL in Supabase
   - Verify tables created
   - Check RLS policies

2. **Import Test:**
   - Get sample Athena schedule file (you need to provide)
   - Go to Admin → Create Accounts → Upload Schedule
   - Upload file
   - Verify parsing works
   - Import to database
   - Check data in Supabase

3. **Schedule View Test:**
   - Navigate to Schedule page
   - Verify appointments display
   - Test date navigation
   - Test provider filter
   - Click "Start Dictation"

4. **Dictation Test:**
   - Verify patient info pre-filled
   - Create dictation note
   - Save
   - Verify appointment status updated
   - Verify note linked in database

---

## 📋 Database Schema Summary

### `provider_schedules` (Enhanced)
```sql
- id (BIGSERIAL)
- provider_id, provider_name, provider_specialty
- patient_name, patient_age, patient_gender, patient_dob
- patient_phone, patient_email, patient_mrn
- chief_diagnosis, visit_reason, chief_complaint
- appointment_type, appointment_title
- scheduled_date, start_time, end_time, duration_minutes
- status (scheduled, in-progress, completed, cancelled, no-show)
- is_telehealth
- athena_appointment_id, external_patient_id
- imported_by, imported_at, import_batch_id
- color_code
- provider_notes
- created_at, updated_at
```

### `schedule_imports` (New)
```sql
- id (UUID)
- batch_id (UUID)
- file_name, file_size
- schedule_date
- total_rows, successful_imports, duplicate_skips, failed_imports
- error_details (JSONB)
- imported_by_email, imported_by_name, imported_by_user_id
- started_at, completed_at
- status (processing, completed, failed)
```

### `dictated_notes` (Existing - link via appointment_id)
```sql
- appointment_id (links to provider_schedules.id)
```

### `schedule_note_links` (Existing)
```sql
- appointment_id (links to provider_schedules.id)
- note_id (links to dictated_notes.id)
```

---

## 🎨 File Structure

```
tshla-medical/
├── database/
│   └── migrations/
│       └── athena-schedule-enhancement.sql ✅ NEW
├── src/
│   ├── types/
│   │   └── schedule.types.ts ✅ NEW
│   ├── services/
│   │   ├── athenaScheduleParser.service.ts ✅ NEW
│   │   └── scheduleService.ts (needs enhancement)
│   ├── components/
│   │   ├── AthenaScheduleUploader.tsx ✅ NEW
│   │   └── ProviderScheduleView.tsx ✅ NEW
│   └── pages/
│       ├── AdminAccountCreation.tsx ✅ UPDATED
│       ├── SchedulePage.tsx (needs update)
│       └── DictationPage.tsx (needs update)
└── ATHENA_SCHEDULE_IMPLEMENTATION.md ✅ NEW
```

---

## 🚀 How to Use (When Complete)

### For Admins:
1. Go to `/admin/create-accounts`
2. Click "📅 Upload Schedule" tab
3. Select schedule date
4. Drag & drop Athena CSV file
5. Click "Parse Schedule File"
6. Review parsed appointments
7. Click "Import to Database"
8. Success! Appointments now available in schedule

### For Providers:
1. Go to `/schedule` page
2. See your appointments for today (or select date)
3. Each appointment shows patient info, time, diagnosis
4. Click "✍️ Start Dictation" on any appointment
5. System pre-fills patient data
6. Dictate your note
7. Save → Appointment marked complete
8. Note automatically linked to appointment

---

## 📧 Sample Athena File Needed

**Please provide a sample** of your Athena schedule export with:
- At least 5-10 rows
- All column headers
- Example of your provider names format
- Example patient data

This will help finalize the parser to match your exact format!

---

## ⚡ Quick Start Checklist

- [ ] Run database migration SQL in Supabase
- [ ] Update provider name mapping in `athenaScheduleParser.service.ts`
- [ ] Provide sample Athena schedule file
- [ ] Complete scheduleService enhancements
- [ ] Test import workflow
- [ ] Update SchedulePage with ProviderScheduleView
- [ ] Update DictationPage for appointment context
- [ ] Full end-to-end testing

---

## 🎯 Benefits

✅ **No more manual schedule entry** - Upload CSV directly from Athena
✅ **Organized daily view** - See all providers in one scrollable page
✅ **One-click dictation** - Patient info auto-populated
✅ **Real-time status tracking** - Know what's completed vs pending
✅ **HIPAA compliant** - All data in Supabase with RLS
✅ **Audit trail** - Track who imported what and when
✅ **Duplicate prevention** - Smart duplicate detection
✅ **Athena integration** - Seamless workflow with existing EMR

---

**Questions or issues?** Check the code comments or test with sample data first!
