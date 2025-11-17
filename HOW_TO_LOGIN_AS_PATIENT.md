# How to Login as a Patient - Complete Guide

## Quick Start (2 Minutes)

### Step 1: Create a Test Patient

Run this script to create a test patient:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
./test-create-patient.sh
```

**OR manually:**

```bash
curl -X POST http://localhost:3000/api/dictated-notes \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "test-001",
    "provider_name": "Dr. Smith",
    "patient_name": "Test Patient",
    "patient_phone": "555-999-8888",
    "patient_email": "test@example.com",
    "patient_dob": "1990-01-15",
    "visit_date": "2025-01-16",
    "chief_complaint": "Annual checkup",
    "raw_transcript": "Patient presents for annual physical",
    "processed_note": "Annual physical examination completed.",
    "status": "completed"
  }'
```

### Step 2: Get the PIN from Console Logs

**Check your server console** (where you ran `npm run dev:unified-api` or `pm2 logs unified-api`)

Look for output like:
```
🆕 Creating new patient from dictation
✅ Created new patient: PT-2025-0001
📱 New PIN: 847392  ← COPY THIS!
✅ Linked dictation to patient
```

**SAVE THAT PIN!** You'll need it to log in.

### Step 3: Login

1. Open browser: `http://localhost:5173/patient-portal-login`
2. Enter phone: `555-999-8888` (or `(555) 999-8888` - formatting is automatic)
3. Enter PIN: `847392` (whatever was in console)
4. Click **Login**
5. You'll be redirected to the patient dashboard! 🎉

---

## How Patients Get PINs

Patients automatically receive a 6-digit PIN when they're created from any of these sources:

| Source | How PIN is Generated | When Patient Gets PIN |
|--------|---------------------|----------------------|
| **Dictation** | Auto-generated when doctor saves note with phone number | Immediately (logged to console) |
| **Pre-Visit Call** | Auto-generated when call completes | Immediately (logged to console) |
| **Schedule Upload** | Auto-generated when CSV is uploaded | Immediately (logged to console) |
| **PDF Upload** | Auto-generated when progress note is imported | Immediately (logged to console) |

**Current Setup**: PINs are logged to the server console

**Future Enhancement**: PINs will be sent via SMS using Twilio

---

## Finding Existing Patient PINs

If a patient was already created but you don't know their PIN, you have 3 options:

### Option 1: Check Server Logs (If Recent)

```bash
# If using PM2:
pm2 logs unified-api | grep "New PIN"

# If running manually:
# Check the terminal where you ran npm run dev:unified-api
```

Look for:
```
📱 New PIN: 123456
```

### Option 2: Reset the PIN via API

```bash
# Replace with actual patient phone number
curl -X POST http://localhost:3000/api/patient-chart/portal/reset-pin \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5559998888"
  }'
```

Response:
```json
{
  "success": true,
  "message": "PIN reset successful",
  "newPin": "491827"
}
```

### Option 3: Query Database Directly (Advanced)

⚠️ **NOT RECOMMENDED** - PINs are hashed with bcrypt, so you can't read them directly.

Instead, use Option 2 to reset the PIN.

---

## Testing Different Scenarios

### Scenario 1: Create Patient via Pre-Visit Call

If you have ElevenLabs configured:

1. Run a pre-visit call with phone number `555-777-6666`
2. Complete the call
3. Check console for PIN
4. Login with that phone + PIN

### Scenario 2: Create Patient via Schedule Upload

1. Upload a CSV schedule with patient info including phone
2. Check console for PIN
3. Login with that phone + PIN

### Scenario 3: Create Patient via PDF Upload

1. Upload a progress note PDF with patient phone
2. Check console for PIN
3. Login with that phone + PIN

---

## Common Issues & Solutions

### Issue: "Invalid credentials"

**Possible causes:**
1. Wrong phone number format
   - ✅ Try: `5559998888` (digits only)
   - ✅ Try: `555-999-8888`
   - ✅ Try: `(555) 999-8888`
   - All formats are auto-normalized!

2. Wrong PIN
   - Check console logs again
   - Reset PIN using API (see Option 2 above)

3. Patient doesn't exist
   - Create patient first (see Step 1)

### Issue: "Patient not found"

**Solution:** The patient hasn't been created yet.

Create one via:
- Dictation save (easiest - see Step 1)
- Pre-visit call completion
- Schedule upload
- PDF upload

### Issue: Server console doesn't show PIN

**Check:**
1. Is the server running?
   ```bash
   # Check if server is running:
   curl http://localhost:3000/api/health
   ```

2. Is the database migration applied?
   - Go to Supabase Dashboard
   - SQL Editor → Run the migration SQL

3. Is bcrypt installed?
   ```bash
   npm install bcrypt
   pm2 restart unified-api
   ```

### Issue: Phone number format confusion

**All these formats work:**
- `5559998888` ← Normalized format (stored)
- `555-999-8888` ← Hyphenated
- `(555) 999-8888` ← Display format (shown in UI)
- `+15559998888` ← International format

The system automatically normalizes all formats!

---

## Complete Test Flow

Here's a complete end-to-end test:

```bash
# 1. Create test patient
./test-create-patient.sh

# 2. Copy the PIN from console output
# (e.g., "New PIN: 847392")

# 3. Open browser
open http://localhost:5173/patient-portal-login

# 4. Login with:
#    Phone: 555-999-8888
#    PIN: 847392

# 5. You should see:
#    - Patient name: Test Patient
#    - Provider: Dr. Smith
#    - 1 medical visit
#    - Visit note about annual checkup
```

---

## What You'll See After Login

Once logged in, the patient portal dashboard shows:

### Header
- Patient full name
- Phone number
- Primary provider name
- Logout button

### Stats Cards (Overview Tab)
- Total visits count
- Total medications count
- Recent visits summary

### Medical Visits Section
- List of all dictated notes
- Visit date
- Provider name
- Chief complaint
- Full processed note

### Medications Section
- Current medications list
- Dosage information
- Frequency

### Appointments Section
- Upcoming appointments
- Date and time
- Provider name

---

## For Production Use

In production, you'll want to implement **SMS delivery** for PINs:

```javascript
// Example using Twilio (not yet implemented)
await twilioService.sendSMS(
  patient.phone_primary,
  `Welcome to TSHLA Medical! Your patient portal PIN is: ${pin}.
   Login at https://tshla.ai/patient-portal-login`
);
```

**Until then**: Manually provide PINs to patients via:
- Phone call
- Email
- In-person at visit

---

## Quick Reference

### Patient Portal URLs
- **Login**: `http://localhost:5173/patient-portal-login`
- **Dashboard**: `http://localhost:5173/patient-portal-dashboard` (auto-redirect after login)

### Test Patient Credentials
After running `./test-create-patient.sh`:
- **Phone**: `555-999-8888`
- **PIN**: Check console logs

### Reset PIN API
```bash
curl -X POST http://localhost:3000/api/patient-chart/portal/reset-pin \
  -H "Content-Type: application/json" \
  -d '{"phone": "5559998888"}'
```

### Create Patient API
```bash
curl -X POST http://localhost:3000/api/dictated-notes \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "test-001",
    "provider_name": "Dr. Test",
    "patient_name": "Your Name",
    "patient_phone": "YOUR-PHONE-NUMBER",
    "visit_date": "2025-01-16",
    "processed_note": "Test note",
    "status": "completed"
  }'
```

---

## Security Notes

- PINs are **6 digits** (100,000 - 999,999)
- PINs are **hashed with bcrypt** (never stored in plain text)
- PINs are **automatically generated** (cryptographically random)
- PIN login is **rate-limited** in production (prevents brute force)
- Sessions are stored in **sessionStorage** (cleared on tab close)

---

## Need Help?

1. **Check server logs**: `pm2 logs unified-api` or check your terminal
2. **Test the API**: `curl http://localhost:3000/api/health`
3. **Verify database**: Check Supabase for `unified_patients` table
4. **Read docs**: See `FRONTEND_COMPLETE.md` for comprehensive guide

---

## Summary

**To login as a patient:**

1. ✅ Create a patient (via dictation/pre-visit/schedule/PDF)
2. ✅ Get the PIN from console logs
3. ✅ Go to `/patient-portal-login`
4. ✅ Enter phone + PIN
5. ✅ You're in!

**That's it!** 🎉
