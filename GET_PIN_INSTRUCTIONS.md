# How to Get a PIN - You Need to Setup the Database First! ⚠️

## The Problem

The `unified_patients` table doesn't exist in your database yet!

You need to **run the database migration** before you can create patients or get PINs.

---

## ✅ Solution: Run the Database Migration (5 minutes)

### Step 1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project: `minvvjdflezibmgkplqb`
3. Click on **SQL Editor** in the left sidebar

### Step 2: Run the Migration

1. Click **New Query**
2. Open this file in a text editor:
   ```
   /Users/rakeshpatel/Desktop/tshla-medical/database/migrations/unified-patients-consolidation.sql
   ```
3. Copy **ALL** the contents (it's about 512 lines)
4. Paste into the Supabase SQL Editor
5. Click **Run** (or press Cmd+Enter)
6. Wait for "Success. No rows returned" message

### Step 3: Verify It Worked

Run this query in Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'unified_patients';
```

You should see:
```
table_name
unified_patients
```

### Step 4: Install bcrypt

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npm install bcrypt
```

### Step 5: Restart Your Server

```bash
# If using PM2:
pm2 restart unified-api

# OR if running manually, stop it (Ctrl+C) and restart:
npm run dev:unified-api
```

---

## ✅ Now Create a Patient and Get PIN

Once the database migration is complete, run this script:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
node create-test-patient-direct.cjs
```

You'll see output like:

```
🔧 Creating test patient...

✅ Patient created successfully!

==================================================
📋 PATIENT INFORMATION
==================================================
Patient ID: PT-2025-0001
Name: Test Patient
Phone: (555) 999-8888
Email: test@example.com
DOB: 1990-01-15
==================================================

🔑 LOGIN CREDENTIALS
==================================================
Phone: (555) 999-8888 (or 555-999-8888)
PIN: 847392  ← THIS IS YOUR PIN!
==================================================

🌐 LOGIN NOW:
   http://localhost:5173/patient-portal-login

   Enter the phone and PIN above!
```

---

## Alternative: Get PIN for Existing Patient

If a patient already exists in the database but you don't know their PIN, you can reset it:

```bash
curl -X POST http://localhost:3001/api/patient-chart/portal/reset-pin \
  -H "Content-Type: application/json" \
  -d '{"phone": "5551234567"}'
```

Response will give you the new PIN:
```json
{
  "success": true,
  "message": "PIN reset successful",
  "newPin": "491827"
}
```

---

## Quick Reference

### Files You Need:
- **Database Migration**: `/Users/rakeshpatel/Desktop/tshla-medical/database/migrations/unified-patients-consolidation.sql`
- **Create Patient Script**: `/Users/rakeshpatel/Desktop/tshla-medical/create-test-patient-direct.cjs`

### After Migration is Complete:
```bash
# Create test patient:
node create-test-patient-direct.cjs

# Login at:
open http://localhost:5173/patient-portal-login
```

### Test Phone Numbers:
- Use any phone number: `555-999-8888`, `555-123-4567`, etc.
- The script will create a patient with that phone
- The PIN will be displayed in the terminal output

---

## Summary

**The issue**: You tried to login but the database table doesn't exist yet.

**The fix**:
1. Run the SQL migration in Supabase (5 min)
2. Install bcrypt: `npm install bcrypt`
3. Run the create-test-patient script
4. Use the PIN it gives you to login

**Once done**: Every dictation, pre-visit call, schedule upload, and PDF import will automatically create patients with PINs (logged to console).

---

## Need Help?

See these guides:
- [PATIENT_PORTAL_SETUP_COMPLETE.md](PATIENT_PORTAL_SETUP_COMPLETE.md) - Full deployment guide
- [HOW_TO_LOGIN_AS_PATIENT.md](HOW_TO_LOGIN_AS_PATIENT.md) - Login instructions
- [FRONTEND_COMPLETE.md](FRONTEND_COMPLETE.md) - Complete system overview

The database migration is the **first and most important step** - everything else depends on it!
