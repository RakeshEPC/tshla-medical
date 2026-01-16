# Understanding "Linking" Auth Accounts to Medical Staff Records

## The Two-Table System

Your TSHLA Medical app uses **two separate tables** that must work together:

```
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│   SUPABASE AUTH TABLE           │         │   MEDICAL_STAFF TABLE            │
│   (auth.users)                  │         │   (public.medical_staff)         │
│                                 │         │                                  │
│  Stores login credentials       │◄────────┤  Stores provider profiles        │
└─────────────────────────────────┘  LINKED └──────────────────────────────────┘
         VIA auth_user_id field
```

---

## Current Situation for Elizabeth

### ✅ HAS: Auth Account (Can Enter Password)
```javascript
// In auth.users table:
{
  id: "424bce54-24aa-4a63-91f4-f72b63f0363f",  // ← This is the key
  email: "elizabeth@tshla.ai",
  encrypted_password: "...",  // Password hash
  email_confirmed_at: "2026-01-12T20:47:15Z",
  last_sign_in_at: "2026-01-15T21:58:08Z"
}
```

### ❌ MISSING: Medical Staff Record (No Profile)
```javascript
// In medical_staff table:
// Nothing! Empty! Zilch!
```

---

## What Happens When Elizabeth Tries to Login

```
Step 1: User enters credentials
┌───────────────────────────────┐
│ Email: elizabeth@tshla.ai     │
│ Password: ••••••••••          │
│         [Login Button]        │
└───────────────────────────────┘

Step 2: Supabase authenticates ✅
┌───────────────────────────────────────┐
│ ✅ Password correct!                  │
│ ✅ Email confirmed!                   │
│ → Session created                     │
│ → User ID: 424bce54-24aa-...          │
└───────────────────────────────────────┘

Step 3: App looks for medical_staff record ❌
┌───────────────────────────────────────────────────┐
│ SELECT * FROM medical_staff                       │
│ WHERE auth_user_id = '424bce54-24aa-...'          │
│                                                   │
│ Result: NO ROWS FOUND ❌                          │
└───────────────────────────────────────────────────┘

Step 4: App kicks user out ❌
┌────────────────────────────────────────┐
│ ❌ No medical staff record found!      │
│ → Logout user                          │
│ → Redirect to login page               │
└────────────────────────────────────────┘
```

---

## The Fix: Create a Linked Medical Staff Record

We need to CREATE this record:

```sql
INSERT INTO medical_staff (
  id,                   -- New UUID for this record
  email,                -- Same email as auth account
  auth_user_id,         -- 👈 THE LINK! Points to auth.users.id
  first_name,
  last_name,
  role,
  specialty,
  is_active
) VALUES (
  uuid_generate_v4(),
  'elizabeth@tshla.ai',
  '424bce54-24aa-4a63-91f4-f72b63f0363f',  -- 👈 Links to auth.users
  'Elizabeth',
  'Leal',
  'doctor',             -- or 'admin', 'nurse', etc.
  'Endocrinology',
  true
);
```

---

## After Linking: Login Works!

```
Step 1: User enters credentials ✅
Step 2: Supabase authenticates ✅
Step 3: App finds medical_staff record ✅
┌───────────────────────────────────────────────────┐
│ SELECT * FROM medical_staff                       │
│ WHERE auth_user_id = '424bce54-24aa-...'          │
│                                                   │
│ Result:                                           │
│ {                                                 │
│   email: 'elizabeth@tshla.ai',                    │
│   first_name: 'Elizabeth',                        │
│   last_name: 'Leal',                              │
│   role: 'doctor',                                 │
│   auth_user_id: '424bce54-24aa-...',  ← MATCHED! │
│   is_active: true                                 │
│ }                                                 │
└───────────────────────────────────────────────────┘

Step 4: Redirect to dashboard ✅
┌────────────────────────────────────────┐
│ ✅ Welcome, Dr. Elizabeth Leal!        │
│ → Redirect to /dashboard               │
└────────────────────────────────────────┘
```

---

## Summary

**"Linking"** means:
- Setting the `auth_user_id` field in `medical_staff` table
- To point to the `id` field in `auth.users` table
- So the app can find the provider profile after authentication

**For Elizabeth:**
- Auth ID: `424bce54-24aa-4a63-91f4-f72b63f0363f`
- We need to create a `medical_staff` record with `auth_user_id = '424bce54-24aa-4a63-91f4-f72b63f0363f'`
- Then login will work!

---

## The Other Two Accounts

**rakesh@tshla.ai:**
- Has medical_staff record but NO auth account
- Need to create auth account, then link existing staff record

**shannon@tshla.ai:**
- Has NOTHING
- Need to create both auth account AND medical_staff record
