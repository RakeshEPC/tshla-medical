# Backend API Update Guide - pump_users → patients Migration

## Files to Update

### **Primary File:** `server/pump-report-api.js`

Found **12 locations** where `pump_users` table is referenced.

---

## 🔧 REQUIRED CHANGES

### **Change 1: Auth Middleware (Line 149-154)**

**BEFORE:**
```javascript
// Try pump_users table if not in medical_staff
const { data: pumpData, error: pumpError } = await supabase
  .from('pump_users')
  .select('*')
  .eq('auth_user_id', user.id)
  .single();
```

**AFTER:**
```javascript
// Try patients table if not in medical_staff
const { data: patientData, error: patientError } = await supabase
  .from('patients')
  .select('*')
  .eq('auth_user_id', user.id)
  .eq('pumpdrive_enabled', true)
  .single();
```

---

### **Change 2: User Registration - Check Existing (Line 424-427)**

**BEFORE:**
```javascript
const { data: existingUsers, error: searchError } = await supabase
  .from('pump_users')
  .select('email')
  .eq('email', email);
```

**AFTER:**
```javascript
const { data: existingUsers, error: searchError } = await supabase
  .from('patients')
  .select('email')
  .eq('email', email)
  .eq('pumpdrive_enabled', true);
```

---

### **Change 3: User Registration - Create User (Line 438-442)**

**BEFORE:**
```javascript
const { data: newUser, error: insertError } = await supabase
  .from('pump_users')
  .insert({
    email,
    username,
    // ... other fields
  })
```

**AFTER:**
```javascript
const { data: newUser, error: insertError } = await supabase
  .from('patients')
  .insert({
    email,
    first_name: firstName || username,
    last_name: lastName || '',
    pumpdrive_enabled: true,
    pumpdrive_signup_date: new Date().toISOString(),
    subscription_tier: 'free',
    // ... other fields
  })
```

---

### **Change 4: Login - Get User (Line 536-539)**

**BEFORE:**
```javascript
const { data: users, error: searchError } = await supabase
  .from('pump_users')
  .select('id, email, username, password_hash, first_name, last_name, phone_number, current_payment_status, is_active, login_count')
  .eq('email', email);
```

**AFTER:**
```javascript
const { data: users, error: searchError } = await supabase
  .from('patients')
  .select('id, email, first_name, last_name, phone, pumpdrive_enabled, is_active')
  .eq('email', email)
  .eq('pumpdrive_enabled', true);
```

**NOTE:** `patients` table uses `phone` not `phone_number`

---

### **Change 5: Login - Update Tracking (Line 563-567)**

**BEFORE:**
```javascript
const { error: updateError } = await supabase
  .from('pump_users')
  .update({
    current_payment_status: 'active',
    last_login: new Date().toISOString(),
    login_count: (user.login_count || 0) + 1,
  })
  .eq('id', user.id);
```

**AFTER:**
```javascript
const { error: updateError } = await supabase
  .from('patients')
  .update({
    pumpdrive_last_assessment: new Date().toISOString(), // Track last activity
    updated_at: new Date().toISOString(),
  })
  .eq('id', user.id);
```

**NOTE:** `patients` table doesn't have `login_count` field

---

### **Change 6: Extend Access (Line 685-689)**

**BEFORE:**
```javascript
const { error: updateError } = await supabase
  .from('pump_users')
  .update({
    access_expires_at: newExpiryTime.toISOString(),
    current_payment_status: 'active',
  })
  .eq('id', userId);
```

**AFTER:**
```javascript
const { error: updateError } = await supabase
  .from('patients')
  .update({
    trial_end_date: newExpiryTime.toISOString(),
    subscription_tier: 'active',
  })
  .eq('id', userId);
```

---

### **Change 7: Get All Users Endpoint (Line 2031-2034)**

**BEFORE:**
```javascript
const { data: users, error } = await supabase
  .from('pump_users')
  .select('*')
  .order('created_at', { ascending: false });
```

**AFTER:**
```javascript
const { data: users, error } = await supabase
  .from('patients')
  .select('*')
  .eq('pumpdrive_enabled', true)
  .order('created_at', { ascending: false });
```

---

### **Change 8: Get Users for Export (Line 2076-2078)**

**BEFORE:**
```javascript
const { data: users, error } = await supabase
  .from('pump_users')
  .select('*');
```

**AFTER:**
```javascript
const { data: users, error } = await supabase
  .from('patients')
  .select('*')
  .eq('pumpdrive_enabled', true);
```

---

### **Change 9: Admin Dashboard Users (Line 2118-2121)**

**BEFORE:**
```javascript
const { data: users, error: usersError } = await supabase
  .from('pump_users')
  .select('id, username, email, first_name, last_name, phone_number, current_payment_status, created_at, last_login, login_count')
  .order('created_at', { ascending: false });
```

**AFTER:**
```javascript
const { data: users, error: usersError } = await supabase
  .from('patients')
  .select('id, email, first_name, last_name, phone, subscription_tier, pumpdrive_enabled, created_at, updated_at')
  .eq('pumpdrive_enabled', true)
  .order('created_at', { ascending: false });
```

---

### **Change 10: Get All User IDs (Line 2212-2214)**

**BEFORE:**
```javascript
const { data: allUsers, error: usersError } = await supabase
  .from('pump_users')
  .select('id');
```

**AFTER:**
```javascript
const { data: allUsers, error: usersError } = await supabase
  .from('patients')
  .select('id')
  .eq('pumpdrive_enabled', true);
```

---

### **Change 11: Connection Test (Line 4633)**

**BEFORE:**
```javascript
const { error } = await supabase.from('pump_users').select('count', { count: 'exact', head: true });
```

**AFTER:**
```javascript
const { error } = await supabase.from('patients').select('count', { count: 'exact', head: true });
```

---

## 📊 FIELD MAPPING REFERENCE

| Old (`pump_users`) | New (`patients`) | Notes |
|-------------------|------------------|-------|
| `username` | `first_name` | Use first_name instead |
| `phone_number` | `phone` | Different field name |
| `current_payment_status` | `subscription_tier` | Renamed |
| `access_expires_at` | `trial_end_date` | Renamed |
| `last_login` | `updated_at` | Track last activity |
| `login_count` | N/A | Removed (not in patients table) |
| `is_admin` | N/A | Use `medical_staff` table for admins |
| `password_hash` | N/A | Managed by Supabase Auth |

---

## ✅ TESTING CHECKLIST

After updating backend:

### **Test 1: Patient Registration**
```bash
curl -X POST http://localhost:9001/api/pump-drive/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","firstName":"Test","lastName":"User"}'
```

Expected: User created in `patients` table with `pumpdrive_enabled=true`

### **Test 2: Patient Login**
```bash
curl -X POST http://localhost:9001/api/pump-drive/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Expected: Token returned, login tracked

### **Test 3: Save Assessment**
```bash
curl -X POST http://localhost:9001/api/pump-drive/save-assessment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"answers":{...},"results":{...}}'
```

Expected: Assessment saved with `patient_id` (not `user_id`)

### **Test 4: Get User Assessments**
```bash
curl http://localhost:9001/api/pump-drive/assessments \
  -H "Authorization: Bearer <token>"
```

Expected: Returns assessments for patient

---

## 🔍 ADDITIONAL FILES TO CHECK

### **Other Backend Files:**
```bash
server/medical-api.js      # Check for pump_users references
server/admin-api.js        # Check for pump_users references
server/auth-middleware.js  # Check authentication logic
```

### **Frontend Services:**
```bash
src/services/patient.service.ts
src/services/pumpDrive.service.ts
src/services/api.service.ts
```

---

## 🚨 COMMON ERRORS & FIXES

### **Error: "column user_id does not exist"**
**Cause:** Still using old `user_id` field in pump_assessments
**Fix:** Use `patient_id` instead:
```javascript
// OLD
.insert({ user_id: userId, ... })

// NEW
.insert({ patient_id: patientId, ... })
```

### **Error: "column username does not exist"**
**Cause:** `patients` table doesn't have `username` field
**Fix:** Use `first_name` and `last_name`:
```javascript
// OLD
username: data.username

// NEW
first_name: data.firstName,
last_name: data.lastName
```

### **Error: "relation pump_users does not exist"**
**Cause:** Forgot to update a query
**Fix:** Search entire file for `pump_users` and replace with `patients`

---

## 📝 NOTES

1. **Auth User ID:** All authentication still uses `auth_user_id` linked to Supabase auth.users
2. **PumpDrive Flag:** All queries must filter by `pumpdrive_enabled = true`
3. **No Password Hash:** Passwords now managed entirely by Supabase Auth
4. **Admin Access:** Admins are in `medical_staff` table, not `patients`

---

## ✅ VERIFICATION QUERIES

After all changes, run these to verify:

```sql
-- Check: No pump_users table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'pump_users';
-- Expected: 0 rows

-- Check: All PumpDrive patients
SELECT COUNT(*)
FROM patients
WHERE pumpdrive_enabled = true;
-- Expected: Count of migrated users

-- Check: All assessments have patient_id
SELECT COUNT(*)
FROM pump_assessments
WHERE patient_id IS NOT NULL;
-- Expected: Count of all assessments

-- Check: No orphaned assessments
SELECT COUNT(*)
FROM pump_assessments
WHERE patient_id IS NULL;
-- Expected: 0
```

---

**Created:** October 8, 2025
**Author:** Claude Code
**Status:** Ready for implementation
