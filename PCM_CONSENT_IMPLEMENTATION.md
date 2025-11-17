# PCM (Principal Care Management) Consent Implementation

## Overview
Implemented a comprehensive PCM consent and enrollment system specifically designed for diabetes patients. This system ensures HIPAA compliance, proper billing consent, and clinical goal tracking.

## Features Implemented

### 1. PCM Consent Form Component
**File**: `src/components/PCMConsentForm.tsx`

A multi-section consent form with the following tabs:

#### **Overview Tab**
- Explains what PCM is
- Lists program benefits:
  - Dedicated care coordination
  - 24/7 access to care team
  - Goal tracking & support
  - Medication management
- Voluntary program disclaimer

#### **Services Tab**
- Details all included services:
  - Care coordination (monthly check-ins, specialist coordination)
  - Clinical monitoring (A1C, BP, weight, glucose)
  - Education & support (self-management, nutrition, exercise)
  - 24/7 access (after-hours support, portal messaging)
- 30-minute monthly time commitment explanation

#### **Diabetes Goals Tab**
- Patient-specific goal setting for:
  - **A1C**: Current and target (default 7.0%)
  - **Blood Pressure**: Current and target (default 130/80)
  - **Weight**: Current and target in pounds
- All goals are editable and tracked over time

#### **Billing Tab**
- Complete billing transparency:
  - CPT codes (99424, 99425, 99426, 99427)
  - Medicare rates for each service tier
  - Cost-sharing responsibility (deductible + 20% coinsurance)
  - Monthly billing cycle explanation
  - Financial hardship information

#### **Consent & Signature Tab**
- Three required acknowledgments:
  - Understood program services
  - Agreed to billing terms
  - Consented to HIPAA-compliant data usage
- Electronic signature (must match patient name)
- Patient rights explanation (revocation, care continuity)

### 2. Database Schema
**File**: `database/migrations/add-pcm-consent-fields.sql`

Added the following fields to `unified_patients` table:

#### **Enrollment Fields**
- `pcm_enrolled` (boolean) - Whether enrolled in PCM
- `pcm_consent_date` (timestamp) - When consent was signed
- `pcm_consent_signature` (text) - Electronic signature
- `pcm_consent_version` (varchar) - Consent form version
- `pcm_start_date` (date) - Program start date
- `pcm_end_date` (date) - Program end date (if revoked)
- `pcm_status` (varchar) - active, inactive, paused, revoked
- `pcm_revoked_date` (timestamp) - When consent was revoked
- `pcm_revocation_reason` (text) - Why patient left program

#### **A1C Tracking**
- `pcm_initial_a1c` (decimal) - A1C at enrollment
- `pcm_target_a1c` (decimal) - Target A1C (default 7.0%)
- `pcm_current_a1c` (decimal) - Most recent A1C
- `pcm_last_a1c_date` (date) - Date of last A1C test

#### **Blood Pressure Tracking**
- `pcm_initial_bp` (varchar) - BP at enrollment
- `pcm_target_bp` (varchar) - Target BP (default 130/80)
- `pcm_current_bp` (varchar) - Most recent BP
- `pcm_last_bp_date` (date) - Date of last BP reading

#### **Weight Tracking**
- `pcm_initial_weight` (decimal) - Weight at enrollment (lbs)
- `pcm_target_weight` (decimal) - Target weight (lbs)
- `pcm_current_weight` (decimal) - Most recent weight (lbs)
- `pcm_last_weight_date` (date) - Date of last weight measurement

#### **Billing Fields**
- `pcm_last_billed_date` (date) - Last billing date
- `pcm_billing_notes` (text) - Billing notes/history

### 3. Backend API
**File**: `server/api/patient-chart-api.js`

#### **Endpoint**: `POST /api/patient-chart/portal/pcm-consent`
Saves PCM consent and enrollment data.

**Request Body**:
```json
{
  "patientId": "uuid",
  "signature": "Patient Full Name",
  "agreedToTerms": true,
  "agreedToBilling": true,
  "agreedToPrivacy": true,
  "consentDate": "2025-01-16T12:00:00Z",
  "initialA1C": 8.5,
  "targetA1C": 7.0,
  "initialBloodPressure": "145/90",
  "targetBloodPressure": "130/80",
  "initialWeight": 185,
  "targetWeight": 170
}
```

**Response**:
```json
{
  "success": true,
  "message": "PCM consent saved successfully",
  "patient": {
    "id": "uuid",
    "patient_id": "PT-2025-0002",
    "pcm_enrolled": true,
    "pcm_status": "active",
    "pcm_start_date": "2025-01-16"
  }
}
```

#### **Updated Login Endpoint**
Modified `POST /api/patient-chart/portal/login` to include PCM enrollment status in response.

### 4. Patient Portal Integration
**File**: `src/pages/PatientPortalDashboard.tsx`

#### **Login Flow**
1. Patient logs in with phone + PIN
2. Dashboard checks if `pcm_enrolled` is false
3. If not enrolled, automatically shows PCM consent modal
4. Patient must either:
   - Complete and sign consent form
   - Click "Decline" to access dashboard without PCM

#### **PCM Status Card** (Overview Tab)
For enrolled patients (`pcm_enrolled: true, pcm_status: 'active'`), displays:

- **Enrollment Status**: Active since [date]
- **A1C Goal Progress**:
  - Current value vs target
  - Visual progress bar
  - Color-coded (green if at/below target, yellow if above)
- **Blood Pressure Goal**: Current vs target
- **Weight Goal**:
  - Current vs target
  - Shows "X lbs to goal" or "Goal achieved!"
- **Monthly Care Coordination**: Explains 30-minute commitment

## User Flow

### First-Time Login
1. Patient enters phone number and PIN
2. Backend validates credentials
3. Frontend receives patient data with `pcm_enrolled: false`
4. PCM consent modal automatically appears
5. Patient reviews all 5 tabs:
   - Overview → Services → Diabetes Goals → Billing → Consent
6. Patient sets initial diabetes goals:
   - Enters current A1C, BP, weight (if known)
   - Sets target goals (or uses defaults)
7. Patient reads and checks 3 consent boxes
8. Patient types full name as electronic signature
9. Clicks "Sign & Enroll"
10. Backend saves consent with timestamp
11. Modal closes, dashboard shows PCM status card

### Returning Login (Enrolled)
1. Patient logs in
2. Backend returns `pcm_enrolled: true`
3. No consent modal shown
4. Dashboard displays PCM status card with goals
5. Patient can track progress toward diabetes goals

### Declining PCM
1. Patient can click "Decline" on consent modal
2. Modal closes
3. Dashboard shows without PCM status card
4. Patient can access modal later if they change their mind

## Compliance Features

### HIPAA Compliance
- ✅ Clear privacy consent checkbox
- ✅ Explains data usage for care coordination
- ✅ Patient rights to revoke consent
- ✅ Timestamped consent records
- ✅ Version tracking for consent forms

### Billing Compliance
- ✅ Clear CPT code disclosure (99424-99427)
- ✅ Medicare rate transparency
- ✅ Cost-sharing responsibility explained
- ✅ Monthly billing cycle documented
- ✅ Financial hardship resources
- ✅ Voluntary program disclaimer

### Clinical Documentation
- ✅ Baseline measurements recorded
- ✅ Goal targets documented
- ✅ Progress tracking enabled
- ✅ Date-stamped clinical data
- ✅ Provider-reviewable consent

## Next Steps

### To Test:
1. Run database migration:
   ```sql
   -- In Supabase SQL Editor
   \i database/migrations/add-pcm-consent-fields.sql
   ```

2. Login to patient portal:
   ```
   URL: http://localhost:5173/patient-portal-login
   Phone: 555-999-8888
   PIN: 247700
   ```

3. You should see the PCM consent modal automatically

4. Complete the form and sign

5. Verify PCM status card appears on dashboard

### Future Enhancements:
1. **Provider Dashboard**:
   - View all PCM-enrolled patients
   - Update clinical goals (A1C, BP, weight)
   - Track time spent on care coordination
   - Generate monthly billing reports

2. **Patient Progress Tracking**:
   - Chart A1C trends over time
   - Blood pressure history graph
   - Weight loss progress visualization
   - Goal achievement badges

3. **Automated Reminders**:
   - Monthly check-in scheduling
   - Lab test reminders (quarterly A1C)
   - Medication refill alerts
   - Appointment notifications

4. **Billing Integration**:
   - Automatic CPT code selection based on time spent
   - Monthly billing statement generation
   - Insurance claim submission
   - Patient billing portal

5. **Revocation Workflow**:
   - "Leave PCM Program" button
   - Revocation reason collection
   - End date documentation
   - Final billing reconciliation

## Files Modified/Created

### Created:
1. `src/components/PCMConsentForm.tsx` (680 lines)
2. `database/migrations/add-pcm-consent-fields.sql` (80 lines)
3. `PCM_CONSENT_IMPLEMENTATION.md` (this file)

### Modified:
1. `server/api/patient-chart-api.js`:
   - Added `/portal/pcm-consent` endpoint (80 lines)
   - Updated login endpoint to return PCM fields (9 lines)

2. `src/pages/PatientPortalDashboard.tsx`:
   - Added PCM imports (2 lines)
   - Extended PatientData interface (9 lines)
   - Added PCM consent state and handler (40 lines)
   - Added PCM status card to overview (90 lines)
   - Added PCM consent modal (7 lines)

## Testing Checklist

- [ ] Database migration runs without errors
- [ ] PCM consent modal appears on first login
- [ ] All 5 tabs display correctly
- [ ] Diabetes goals can be entered and saved
- [ ] All 3 checkboxes are required
- [ ] Signature validation works (must match name)
- [ ] Consent saves to database successfully
- [ ] Modal closes after successful enrollment
- [ ] PCM status card appears on dashboard
- [ ] Goals display with correct values
- [ ] Progress bars show correctly
- [ ] "Decline" button works
- [ ] Returning logins don't show modal again
- [ ] PCM data persists across logins

## Support

For questions or issues:
- Email: dev@tshla.ai
- Billing questions: billing@tshla.ai
- Patient support: (555) 123-4567

---

**Implementation Date**: January 16, 2025
**Version**: 1.0
**Status**: ✅ Complete and ready for testing
