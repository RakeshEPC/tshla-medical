# 🚀 Athena Schedule Import - Quick Start Guide

## Copy-Paste Commands

### STEP 1: Run Database Migration

**Open Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" → "New Query"

**Copy this SQL file contents:**
```bash
# Open this file in your text editor:
/Users/rakeshpatel/Desktop/tshla-medical/database/migrations/athena-schedule-enhancement.sql

# Copy ALL the contents (entire file)
# Paste into Supabase SQL Editor
# Click "RUN"
```

**Or run this to see the SQL:**
```bash
cat /Users/rakeshpatel/Desktop/tshla-medical/database/migrations/athena-schedule-enhancement.sql
```

---

### STEP 2: Add Providers to Database

**Option A: Use SQL (Fastest)**

```sql
-- Copy-paste this into Supabase SQL Editor:

INSERT INTO medical_staff (email, first_name, last_name, role, specialty, practice, is_active)
VALUES
  ('rakesh.patel@tshla.ai', 'Rakesh', 'Patel', 'doctor', 'Endocrinology', 'TSHLA Medical', true),
  ('veena.watwe@tshla.ai', 'Veena', 'Watwe', 'doctor', 'Pediatrics', 'TSHLA Medical', true),
  ('tess.chamakkala@tshla.ai', 'Tess', 'Chamakkala', 'doctor', 'Family Medicine', 'TSHLA Medical', true),
  ('radha.bernander@tshla.ai', 'Radha', 'Bernander', 'doctor', 'Internal Medicine', 'TSHLA Medical', true),
  ('shannon.gregroek@tshla.ai', 'Shannon', 'Gregroek', 'doctor', 'Pediatrics', 'TSHLA Medical', true),
  ('elinia.shakya@tshla.ai', 'Elinia', 'Shakya', 'doctor', 'Family Medicine', 'TSHLA Medical', true),
  ('nadia.younus@tshla.ai', 'Nadia', 'Younus', 'doctor', 'Internal Medicine', 'TSHLA Medical', true),
  ('ghislaine.tonye@tshla.ai', 'Ghislaine', 'Tonye', 'doctor', 'Family Medicine', 'TSHLA Medical', true),
  ('cindy.laverde@tshla.ai', 'Cindy', 'Laverde', 'doctor', 'Pediatrics', 'TSHLA Medical', true),
  ('vanessa.laverde@tshla.ai', 'Vanessa', 'Laverde', 'doctor', 'Pediatrics', 'TSHLA Medical', true),
  ('kamili.wade@tshla.ai', 'Kamili', 'Wade-Reescano', 'therapist', 'Mental Health', 'TSHLA Medical', true)
ON CONFLICT (email) DO NOTHING;

-- Verify providers were added:
SELECT id, first_name, last_name, email, specialty FROM medical_staff ORDER BY last_name;
```

**Option B: Use Admin UI**
1. Start dev server: `cd /Users/rakeshpatel/Desktop/tshla-medical && npm run dev`
2. Go to: `http://localhost:5173/admin/create-accounts`
3. Click "Medical Staff" tab
4. Add each provider manually

---

### STEP 3: Update Provider Mapping

**Run this command:**

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
node scripts/update-provider-mapping.cjs
```

**Expected output:**
```
🚀 Starting provider mapping update...
🔍 Fetching providers from Supabase...
✅ Found X active providers
📝 Reading parser file...
💾 Updating parser file...
✅ Provider mapping updated successfully!
```

---

### STEP 4: Verify Everything Works

**Test database:**
```sql
-- Run in Supabase SQL Editor:

-- Check provider_schedules has new columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'provider_schedules'
AND column_name IN ('patient_age', 'chief_diagnosis', 'athena_appointment_id');

-- Should return 3 rows with those column names

-- Check schedule_imports table exists
SELECT * FROM schedule_imports LIMIT 1;

-- Should return "no rows" (empty table is fine)

-- Check providers
SELECT id, first_name, last_name, specialty FROM medical_staff WHERE is_active = true;

-- Should list all your providers
```

---

### STEP 5: Test Schedule Upload

**Start the app:**
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npm run dev
```

**Test the upload:**
1. Open: `http://localhost:5173/admin/create-accounts`
2. Click the **"📅 Upload Schedule"** tab
3. You should see a file uploader

**Create a test CSV file:**

Save this as `test-schedule.csv`:

```csv
Date,Time,Provider,Patient First Name,Patient Last Name,Age,Gender,Diagnosis,Visit Type,Duration
01/30/2025,9:00 AM,PATEL RAKESH,John,Doe,45,M,Type 2 Diabetes follow-up,Follow-up,30
01/30/2025,9:30 AM,PATEL RAKESH,Jane,Smith,52,F,Hypertension management,Follow-up,15
01/30/2025,10:00 AM,WATWE VEENA,Emma,Wilson,8,F,Well child visit,Wellness,30
01/30/2025,10:30 AM,WATWE VEENA,Oliver,Brown,5,M,Asthma follow-up,Follow-up,20
```

**Upload the test file:**
1. Drag the CSV file to the upload area
2. Select date: 01/30/2025
3. Click "Parse Schedule File"
4. Review the preview
5. Click "Import to Database"

**Verify in Supabase:**
```sql
SELECT
  provider_name,
  patient_name,
  patient_age,
  chief_diagnosis,
  start_time,
  scheduled_date
FROM provider_schedules
WHERE scheduled_date = '2025-01-30'
ORDER BY provider_name, start_time;
```

You should see your 4 test appointments!

---

## 📁 Files Created/Modified

✅ **Created:**
- `/database/migrations/athena-schedule-enhancement.sql` - Database schema
- `/src/types/schedule.types.ts` - TypeScript types
- `/src/services/athenaScheduleParser.service.ts` - Parser service
- `/src/components/AthenaScheduleUploader.tsx` - Upload component
- `/src/components/ProviderScheduleView.tsx` - Schedule display
- `/scripts/update-provider-mapping.cjs` - Auto-update script
- `/ATHENA_SCHEDULE_IMPLEMENTATION.md` - Full documentation
- `/SETUP_PROVIDERS.md` - Provider setup guide
- `/ATHENA_QUICK_START.md` - This file

✅ **Modified:**
- `/src/pages/AdminAccountCreation.tsx` - Added Upload Schedule tab

---

## 🎯 What Works Now

✅ Upload Athena CSV/TSV schedules via admin page
✅ Automatic provider name recognition
✅ Flexible column detection
✅ Drag-and-drop file upload
✅ Preview before import
✅ Duplicate detection
✅ Import tracking and logging
✅ Patient demographics (age, gender, DOB)
✅ Diagnosis/chief complaint
✅ Visit types

---

## 🚧 Still TODO (Coming Next)

⏳ Complete scheduleService.ts with Supabase methods
⏳ Update SchedulePage.tsx to show imported schedules
⏳ Update DictationPage.tsx for appointment integration
⏳ Add real-time schedule updates
⏳ Add schedule editing/cancellation
⏳ Add provider filtering on schedule view
⏳ Add export to PDF/Excel

---

## 📞 Support

**If you get stuck:**

1. Check Supabase logs (Dashboard → Logs)
2. Check browser console (F12)
3. Check terminal for errors
4. Verify .env file has correct Supabase credentials

**Common Issues:**

**"No providers found"**
- Run: `SELECT * FROM medical_staff;` in Supabase
- If empty, add providers using Step 2

**"Provider mapping not updated"**
- Re-run: `node scripts/update-provider-mapping.cjs`
- Check file: `src/services/athenaScheduleParser.service.ts`

**"Database migration failed"**
- Check Supabase SQL Editor for errors
- Run migrations one section at a time
- Ensure you have correct permissions

**"Upload tab not showing"**
- Clear browser cache (Ctrl+Shift+R)
- Restart dev server
- Check AdminAccountCreation.tsx imports

---

## ✅ Checklist

- [ ] Database migration run successfully
- [ ] Providers added to medical_staff table
- [ ] Provider mapping script run successfully
- [ ] Dev server started
- [ ] Upload Schedule tab visible
- [ ] Test CSV file uploaded successfully
- [ ] Appointments visible in Supabase database

---

## 🎉 Next Steps After Testing

Once the basic upload works:

1. Upload your actual Athena schedule file
2. Verify all providers are recognized
3. Check data looks correct in database
4. View schedule on SchedulePage (coming soon)
5. Test dictation workflow (coming soon)

---

**Ready to go! Start with STEP 1 above.** 🚀
