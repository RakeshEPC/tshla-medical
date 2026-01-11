# Quick Start Testing Guide

## Prerequisites

✅ **Database migration must be run first!**
See: [RUN_MIGRATION_INSTRUCTIONS.md](RUN_MIGRATION_INSTRUCTIONS.md)

---

## Start Development Server

```bash
npm run dev
```

The app will open at: **http://localhost:5173/**

---

## Test Scenarios

### 🆕 Scenario 1: New User - Clinic Patient (Free Access)

1. **Homepage** (`/`)
   - ✅ Should see "Make a pump decision you can stand behind."
   - Click **"Start Pump Decision"**

2. **Register** (`/patient-register`)
   - Create new account with email like: `clinic-test-1@example.com`
   - Fill in DOB, name, phone

3. **Assessment** (`/pumpdrive/assessment`)
   - Complete the slider questions
   - Select pump features
   - Complete text responses
   - Click through any clarifying questions

4. **Access Gate** (`/pumpdrive/access`) ⭐ **NEW**
   - Should see two options
   - Select: **"( ) I'm a patient at Endocrine & Psychiatry Center (EPC)"**
   - Click **"Continue to Results"**

5. **Results** (`/pumpdrive/results`)
   - ✅ Should see pump recommendations immediately
   - ✅ No payment required

**Expected Database State:**
```sql
SELECT id, access_type, clinic_name, payment_status, access_granted_at
FROM pump_assessments
WHERE patient_id = '[user-id]'
ORDER BY created_at DESC
LIMIT 1;
```
Should show:
- `access_type` = `'clinic'`
- `clinic_name` = `'Endocrine & Psychiatry Center'`
- `payment_status` = `'free'`
- `access_granted_at` = timestamp

---

### 💳 Scenario 2: New User - Independent User (Paid Access)

1. **Homepage** → Click **"Start Pump Decision"**

2. **Register** with new email: `independent-test-1@example.com`

3. **Complete Assessment**

4. **Access Gate** ⭐
   - Select: **"( ) I'm using this independently"**
   - Click **"Continue to Payment ($9.99)"**

5. **Stripe Checkout**
   - Should redirect to Stripe checkout page
   - **Test Card:** `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - Click **"Pay"**

6. **Results**
   - Should redirect back with URL: `?paid=true&session_id=cs_test_xxx`
   - Should show "Verifying Access..." spinner briefly
   - ✅ Should see pump recommendations after payment verified

**Expected Database State:**
- `access_type` = `'independent'`
- `clinic_name` = `NULL`
- `payment_status` = `'paid'`
- `access_granted_at` = timestamp

---

### 🔄 Scenario 3: Returning User (Direct to Results)

1. **Log out** (if logged in)

2. **Homepage** → Click **"Login"** (top right)

3. **Login** with previous user (e.g., `clinic-test-1@example.com`)

4. **Expected Behavior:**
   - ✅ Should go DIRECTLY to `/pumpdrive/results`
   - ✅ Should NOT show assessment or access gate
   - ✅ Should see saved recommendations

---

### 🚫 Scenario 4: Access Protection (Security Test)

1. **Create new user** (or use existing unpaid user)

2. **Complete assessment but DON'T select access option**

3. **Try to access results directly:**
   - Type in browser: `http://localhost:5173/pumpdrive/results`

4. **Expected Behavior:**
   - ✅ Should show "Verifying Access..." spinner
   - ✅ Should redirect to `/pumpdrive/access`
   - ✅ Should NOT show recommendations

---

### 🎭 Scenario 5: Stripe Payment Failure

1. **New user → Complete assessment**

2. **Access Gate:** Select independent user

3. **Stripe Checkout:** Use declining card: `4000 0000 0000 0002`

4. **Expected Behavior:**
   - ✅ Payment should fail
   - ✅ Should stay on Stripe page with error
   - ✅ User should NOT get access to results
   - ✅ Database should show `payment_status` = `'pending'` or `'failed'`

---

### 🏥 Scenario 6: Staff Login (No Change)

1. **Homepage:** Click **"Staff Login"** (footer)

2. **Should redirect to:** `/login` (staff/doctor interface)

3. **Login with staff credentials**

4. **Should see:** Staff dashboard (not patient flow)

---

## Visual Checkpoints

### Homepage (`/`)
- [ ] Marketing headline visible
- [ ] "Start Pump Decision" button prominent
- [ ] "Login" in top right
- [ ] "Staff Login" in footer
- [ ] Clean, professional design

### Access Gate (`/pumpdrive/access`)
- [ ] Two clear radio button options
- [ ] Clinic option mentions "EPC"
- [ ] Independent option shows "$9.99"
- [ ] Continue button changes based on selection
- [ ] Dev mode indicator shows Stripe test mode

### Results Page (`/pumpdrive/results`)
- [ ] Shows top 3 pump recommendations
- [ ] Each pump has pros/cons
- [ ] Print button works (HTML print)
- [ ] Can't retake assessment (no button visible)

---

## Common Issues & Solutions

### Issue: "Cannot access results"
**Solution:** Make sure database migration was run. Check [RUN_MIGRATION_INSTRUCTIONS.md](RUN_MIGRATION_INSTRUCTIONS.md)

### Issue: Stripe redirect fails
**Solution:** Check `.env` has valid `VITE_STRIPE_PUBLISHABLE_KEY` (starts with `pk_test_`)

### Issue: "Assessment not found"
**Solution:** Make sure user completed assessment before reaching access gate

### Issue: Access gate doesn't show after assessment
**Solution:** Check PumpDriveUnified.tsx navigates to `/pumpdrive/access` (not `/pumpdrive/results`)

---

## Browser Console Checks

Open DevTools (F12) and check for:

### Expected Console Logs:
- ✅ `✅ No clarifying questions needed, going to access gate`
- ✅ `Clinic access granted` (if clinic selected)
- ✅ `Payment initiated` (if independent selected)
- ✅ `Payment verification successful` (after Stripe return)

### Should NOT See:
- ❌ Any red error messages
- ❌ `Unauthorized` errors
- ❌ Supabase RLS policy violations

---

## After Testing

### If All Tests Pass:
1. Document any issues found
2. Commit changes: `git add . && git commit -m "feat: Add access gate (clinic vs independent)"`
3. Push to deploy: `git push origin main`

### If Tests Fail:
1. Check browser console for errors
2. Check database migration completed successfully
3. Verify `.env` configuration
4. Review [PUMPDRIVE_ACCESS_GATE_IMPLEMENTATION.md](PUMPDRIVE_ACCESS_GATE_IMPLEMENTATION.md)

---

## Quick Database Queries

### See all assessments with access status:
```sql
SELECT
  pa.id,
  pa.patient_id,
  pa.access_type,
  pa.clinic_name,
  pa.payment_status,
  pa.access_granted_at,
  pa.created_at
FROM pump_assessments pa
ORDER BY pa.created_at DESC
LIMIT 10;
```

### Get access statistics:
```sql
SELECT * FROM get_access_statistics('2026-01-01', '2026-12-31');
```

---

**Ready to start?** Run `npm run dev` and visit http://localhost:5173/
