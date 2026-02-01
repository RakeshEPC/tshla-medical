# Schedule Upload Checklist

**Use this checklist every time you upload a new schedule CSV to prevent errors and ensure data quality.**

---

## Before You Start

- [ ] **Have the CSV file** exported from Athena Health
- [ ] **Know the date range** covered by the CSV (e.g., Jan-Mar 2026)
- [ ] **Backup existing schedule data** (optional but recommended)

---

## Part 1: Upload Schedule Appointments

### Step 1: Update the Upload Script

1. [ ] Open `upload-schedule.cjs` in your editor
2. [ ] Update the CSV file path on line ~214:
   ```javascript
   const csvPath = '/Users/rakeshpatel/Downloads/YOUR_NEW_FILE.csv';
   ```
3. [ ] Verify the file exists at that path

### Step 2: Run the Upload

4. [ ] Open terminal and navigate to project:
   ```bash
   cd /Users/rakeshpatel/Desktop/tshla-medical
   ```

5. [ ] Run the upload script:
   ```bash
   node upload-schedule.cjs
   ```

6. [ ] **Verify the output:**
   - [ ] CSV rows parsed (should match CSV line count minus 1)
   - [ ] Appointments converted (valid data extracted)
   - [ ] Provider breakdown shows correct doctors
   - [ ] Status breakdown looks reasonable
   - [ ] Date range matches expected dates
   - [ ] Upload completed successfully
   - [ ] Check for any duplicate skips (normal)

### Step 3: Verify Upload in Database

7. [ ] Check appointment count matches:
   ```bash
   node -e "
   const { createClient } = require('@supabase/supabase-js');
   require('dotenv').config();
   const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
   (async () => {
     const { count } = await supabase
       .from('provider_schedules')
       .select('*', { count: 'exact', head: true })
       .gte('scheduled_date', 'START_DATE')
       .lte('scheduled_date', 'END_DATE');
     console.log('Appointments in range:', count);
   })();
   "
   ```

---

## Part 2: Link Appointments to Patients

### Step 4: Update Linking Script

8. [ ] Open `link-schedule-to-patients.cjs`
9. [ ] Verify date range matches your upload (lines ~28-29)
10. [ ] Save the file

### Step 5: Run Patient Linking

11. [ ] Run the linking script:
    ```bash
    node link-schedule-to-patients.cjs
    ```

12. [ ] **Monitor the linking process:**
    - [ ] Progress updates show processing
    - [ ] Linking rate appears (target: >60%)
    - [ ] Check "not found" count (blocked time + new patients)

13. [ ] **Review linking summary:**
    - [ ] Linked count (should be ~60-70%)
    - [ ] Not found count (blocked time slots + new patients)
    - [ ] Any suspicious patterns in not-found list?

---

## Part 3: Verification (CRITICAL!)

### Step 6: Verify TSH ID Display Format

14. [ ] Open https://www.tshla.ai/schedule in browser
15. [ ] Pick a date with appointments
16. [ ] Click on a linked appointment (should show patient details)

17. [ ] **Verify IDs are displayed correctly:**

    **✅ CORRECT Display:**
    ```
    MRN: 26996854          ← Blue label with number
    TSH ID: TSH 972-918    ← Purple label with formatted ID
    ```

    **❌ WRONG Display (BUG!):**
    ```
    Internal ID: 99364924  ← Missing labels
    99364924               ← 8-digit number instead of TSH format
    ```

18. [ ] If you see 8-digit numbers in purple, **STOP and fix immediately!**
    - See: [TSH_ID_FORMAT_FIX.md](TSH_ID_FORMAT_FIX.md)
    - Verify code uses `patient.tshla_id` NOT `patient.patient_id`

### Step 7: Spot Check Appointments

19. [ ] Verify at least 5 appointments show:
    - [ ] Patient name
    - [ ] Appointment time
    - [ ] MRN (blue)
    - [ ] TSH ID in format "TSH XXX-XXX" (purple) - if linked
    - [ ] Appointment type
    - [ ] Status (scheduled/cancelled/etc)

20. [ ] Check a few different dates in the range
21. [ ] Verify cancelled appointments show as cancelled
22. [ ] Verify completed appointments show as completed

---

## Part 4: Code Changes (If Any)

### Step 8: Review Code Changes

**Only applicable if you made changes to schedule display code**

23. [ ] Review any code changes made:
    ```bash
    git diff
    ```

24. [ ] **CRITICAL: Check TSH ID field usage in schedule files:**
    - [ ] Search for `patient?.patient_id` in schedule components
    - [ ] Verify it's ONLY used for `internal_id`, NOT `tsh_id`
    - [ ] Confirm `tsh_id` uses `patient?.tshla_id`

25. [ ] **Use helper function (recommended):**
    ```typescript
    import { getDisplayTshId } from '@/utils/patient-id-formatter';

    // Instead of:
    tsh_id: patient?.tshla_id

    // Use:
    tsh_id: getDisplayTshId(patient)
    ```

### Step 9: Run Tests

26. [ ] Run TypeScript check:
    ```bash
    npm run typecheck
    ```

27. [ ] Run TSH ID tests (if available):
    ```bash
    npm test schedule-tsh-id.test
    ```

28. [ ] Pre-commit hook should catch patient_id misuse automatically

---

## Part 5: Deployment

### Step 10: Commit Changes

29. [ ] Stage only the necessary files:
    ```bash
    git add upload-schedule.cjs
    git add link-schedule-to-patients.cjs
    # Add any verification scripts you created
    ```

30. [ ] **Do NOT commit** if you modified schedule component code without verification!

31. [ ] Commit with descriptive message:
    ```bash
    git commit -m "Upload schedule: DATE_RANGE - COUNT appointments

    - Uploaded COUNT appointments from START_DATE to END_DATE
    - Linked XX% to patient records
    - Verified TSH ID display format is correct

    🤖 Generated with Claude Code
    Co-Authored-By: Claude <noreply@anthropic.com>"
    ```

### Step 11: Deploy

32. [ ] Push to trigger deployment:
    ```bash
    git push origin main
    ```

33. [ ] Monitor deployment:
    ```bash
    gh run list --workflow=deploy-frontend.yml --limit 1
    gh run watch <RUN_ID>
    ```

34. [ ] Wait for deployment to complete (~2-3 minutes)

---

## Part 6: Post-Deployment Verification

### Step 12: Verify Production

35. [ ] Visit https://www.tshla.ai/schedule
36. [ ] Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
37. [ ] **Re-verify TSH ID format** (same as Step 17)
38. [ ] Check multiple appointments
39. [ ] Verify linking is working
40. [ ] Test different dates in the range

---

## Common Issues & Solutions

### Issue: TSH IDs show as 8-digit numbers (99364924)

**Cause:** Code is using `patient.patient_id` instead of `patient.tshla_id`

**Solution:**
1. Check schedule component files
2. Find lines with `tsh_id:` or `tshId:`
3. Change `patient?.patient_id` to `patient?.tshla_id`
4. Or use `getDisplayTshId(patient)` helper
5. Re-deploy

**See:** [TSH_ID_FORMAT_FIX.md](TSH_ID_FORMAT_FIX.md)

---

### Issue: Low linking rate (<50%)

**Possible causes:**
- Many blocked time slots (normal)
- New patients not in unified_patients yet
- Phone numbers missing or different
- MRNs don't match

**Solution:**
- Review "not found" list
- Blocked time slots can be ignored
- Create patient records for real patients
- Re-run linking script after creating patients

---

### Issue: Duplicate entries

**Cause:** CSV has duplicate rows for same time slot

**Solution:**
- Upload script automatically skips duplicates
- Check "Skipped duplicates" count in output
- Normal behavior, no action needed

---

### Issue: Build fails during deployment

**Possible causes:**
- TypeScript errors
- Missing dependencies
- Invalid code syntax

**Solution:**
1. Check build output for errors
2. Fix TypeScript errors locally first
3. Run `npm run build` locally to test
4. Don't push until local build succeeds

---

## Success Criteria

You've successfully uploaded the schedule if:

- ✅ Appointments show in schedule for the date range
- ✅ MRN displays in blue with "MRN:" label
- ✅ TSH ID displays in purple with "TSH ID:" label
- ✅ TSH IDs are in format "TSH XXX-XXX", NOT 8-digit numbers
- ✅ Linking rate is 60%+ (excluding blocked time)
- ✅ Patient names, times, statuses all display correctly
- ✅ Deployment succeeded without errors
- ✅ Production site shows updated schedule

---

## Quick Reference

### File Locations
- Upload script: `upload-schedule.cjs`
- Linking script: `link-schedule-to-patients.cjs`
- Schedule components: `src/components/ProviderScheduleViewLive.tsx`, `src/pages/SchedulePageV2.tsx`
- Helper utilities: `src/utils/patient-id-formatter.ts`
- Type definitions: `src/types/unified-patient.types.ts`

### Key Field Names (Don't Confuse!)
- `patient_id` = 8-digit internal ID (99364924) - **NOT for display**
- `tshla_id` = Formatted TSH ID (TSH 972-918) - **USE for display**
- `mrn` = Medical Record Number (26996854) - **USE for display**

### Commands
```bash
# Upload schedule
node upload-schedule.cjs

# Link to patients
node link-schedule-to-patients.cjs

# Verify (customize dates)
node verify-schedule-feb2026.cjs

# Deploy
git add [files]
git commit -m "message"
git push origin main

# Monitor deployment
gh run list --workflow=deploy-frontend.yml --limit 1
```

---

## Documentation

- **TSH ID Format Fix:** [TSH_ID_FORMAT_FIX.md](TSH_ID_FORMAT_FIX.md)
- **Schedule Upload Summary:** [SCHEDULE_UPLOAD_FEB_2026.md](SCHEDULE_UPLOAD_FEB_2026.md)
- **Patient ID Types:** [src/types/unified-patient.types.ts](src/types/unified-patient.types.ts)

---

**Last Updated:** February 1, 2026
**Version:** 1.0
**Maintain this checklist** and update it as the process evolves!
