# TSHLA Medical - System Architecture

**Last Updated:** November 11, 2024
**Status:** Active Production System

---

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Database Schema](#database-schema)
3. [API Architecture](#api-architecture)
4. [Frontend Structure](#frontend-structure)
5. [Key Services](#key-services)
6. [Migration History](#migration-history)

---

## Authentication System

### Current State (November 2024)

**✅ Active Authentication:** Supabase Auth + PostgreSQL

The application uses **Supabase Authentication** as the unified auth system for all user types.

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   TSHLA Medical Authentication               │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Browser    │────▶│ Supabase Auth    │────▶│  PostgreSQL  │
│              │     │  (JWT Tokens)     │     │   Database   │
└──────────────┘     └──────────────────┘     └──────────────┘
       │                      │                        │
       │                      ▼                        │
       │         ┌─────────────────────────┐          │
       │         │  Session Management     │          │
       │         │  (localStorage)         │          │
       │         └─────────────────────────┘          │
       │                                               │
       └──────────── User Profile & Roles ────────────┘
```

### User Types

| User Type        | Access Level | Table             | Auth Method            |
|------------------|-------------|-------------------|------------------------|
| Medical Staff    | Full        | `medical_staff`   | Email + Password       |
| Patients         | Limited     | `patients`        | Email + Password       |
| PumpDrive Users  | PumpDrive   | `patients`        | Email + Password       |
| Admins           | Admin       | `medical_staff`   | Email + Password + 2FA |

### Authentication Services

#### ✅ Current (Active)

**File:** `src/services/supabaseAuth.service.ts`

```typescript
// ✅ Use this for ALL authentication
import { supabaseAuthService } from '../services/supabaseAuth.service';

// Medical staff login
await supabaseAuthService.loginMedicalStaff(email, password);

// Patient login (includes PumpDrive users)
await supabaseAuthService.loginPatient(email, password);

// Register new patient
await supabaseAuthService.registerPatient({
  email,
  password,
  firstName,
  lastName,
  enablePumpDrive: true
});
```

**Key Methods:**
- `loginMedicalStaff()` - Authenticate doctors/nurses/admins
- `loginPatient()` - Authenticate regular patients and PumpDrive users
- `registerPatient()` - Create new patient account
- `getCurrentUser()` - Get logged-in user details
- `isAuthenticated()` - Check if session is valid
- `logout()` - End session

#### ⚠️ Deprecated (Do Not Use)

**File:** `src/services/pumpAuth.service.ts`

```typescript
// ❌ DEPRECATED - Will be removed
import { pumpAuthService } from '../services/pumpAuth.service';
```

**Status:**
- Deprecated: November 11, 2024
- Will be deleted: Next major cleanup
- ESLint Rule: Blocks new imports
- Pre-commit Hook: Prevents commits with this import

**Migration Path:**
```typescript
// ❌ Old (deprecated)
const result = await pumpAuthService.registerUser(data);
const user = pumpAuthService.getUser();
const token = pumpAuthService.getToken();

// ✅ New (correct)
const result = await supabaseAuthService.registerPatient(data);
const result = await supabaseAuthService.getCurrentUser();
const isAuth = await supabaseAuthService.isAuthenticated();
```

### Auth Guards

#### Medical Staff Pages

**File:** `src/components/MedicalAuthGuard.tsx`

Protects routes like `/doctor/*`, `/admin/*`

```tsx
<MedicalAuthGuard>
  <DoctorDashboard />
</MedicalAuthGuard>
```

#### Patient Pages

**File:** `src/components/PatientAuthGuard.tsx`

Protects routes like `/patient/*`

```tsx
<PatientAuthGuard>
  <PatientDashboard />
</PatientAuthGuard>
```

#### PumpDrive Pages

**File:** `src/components/PumpDriveAuthGuard.tsx`

Protects routes like `/pumpdrive/*`

**Fixed:** November 11, 2024 - Now uses Supabase auth

```tsx
<PumpDriveAuthGuard>
  <PumpDriveAssessment />
</PumpDriveAuthGuard>
```

---

## Database Schema

### Supabase PostgreSQL (Current)

```
┌─────────────────┐     ┌────────────────┐     ┌──────────────────┐
│  auth.users     │     │ medical_staff  │     │    patients      │
│  (Supabase)     │────▶│                │     │                  │
│                 │     │  - doctor_id   │     │  - patient_id    │
│  - user_id      │     │  - role        │     │  - pumpdrive_    │
│  - email        │     │  - specialty   │     │    enabled       │
└─────────────────┘     └────────────────┘     │  - access_type   │
                                               └──────────────────┘
```

### Key Tables

#### `auth.users` (Supabase Managed)
- Managed by Supabase Auth
- Stores credentials and email verification
- Never accessed directly - use `supabaseAuthService`

#### `medical_staff`
- Doctors, nurses, administrators
- Links to `auth.users` via `auth_user_id`
- Has `role` field: 'doctor', 'nurse', 'admin'

#### `patients`
- All patient types (regular + PumpDrive)
- Links to `auth.users` via `auth_user_id`
- Has `pumpdrive_enabled` boolean flag
- Has computed `access_type` field: 'patient' or 'pumpdrive'

#### `pump_assessments`
- PumpDrive assessment results
- Foreign key: `user_id` → `patients.id`
- Fixed: November 11, 2024 (was pointing to deleted `pump_users`)

#### `access_logs`
- Audit trail for all authentication events
- Records login attempts, password changes, etc.

---

## API Architecture

### Unified Backend API

**URL:** `https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io`

**Structure:**
```
/api/
  ├── /auth/              # Authentication endpoints
  ├── /medical/           # Medical staff operations
  ├── /pumpdrive/         # PumpDrive assessments
  ├── /schedule/          # Appointment scheduling
  └── /admin/             # Admin operations
```

### Authentication Middleware

All API routes use `optionalAuth` or `requireAuth` middleware that:
1. Extracts JWT token from `Authorization: Bearer <token>` header
2. Validates token with Supabase
3. Attaches user info to `req.user`
4. Checks user permissions based on role

---

## Frontend Structure

### Pages by User Type

```
src/pages/
├── staff/
│   ├── Login.tsx               # Medical staff login
│   ├── DoctorDashboardUnified.tsx
│   └── AdminDashboard.tsx
│
├── patient/
│   ├── PatientLogin.tsx        # Patient login (unified)
│   ├── PatientRegister.tsx     # Patient registration
│   └── PatientDashboard.tsx
│
└── pumpdrive/
    ├── PumpDriveUnified.tsx    # Assessment flow
    ├── PumpDriveResults.tsx    # Recommendations
    └── AssessmentHistory.tsx   # Past assessments
```

### Routing

```tsx
<Routes>
  {/* Public */}
  <Route path="/" element={<Home />} />
  <Route path="/patient-login" element={<PatientLogin />} />

  {/* Medical Staff (Protected) */}
  <Route path="/doctor/*" element={
    <MedicalAuthGuard>
      <DoctorRoutes />
    </MedicalAuthGuard>
  } />

  {/* Patients (Protected) */}
  <Route path="/patient/*" element={
    <PatientAuthGuard>
      <PatientRoutes />
    </PatientAuthGuard>
  } />

  {/* PumpDrive (Protected) */}
  <Route path="/pumpdrive/*" element={
    <PumpDriveAuthGuard>
      <PumpDriveRoutes />
    </PumpDriveAuthGuard>
  } />
</Routes>
```

---

## Key Services

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| **Auth** | `supabaseAuth.service.ts` | Authentication (current) |
| ~~Pump Auth~~ | ~~`pumpAuth.service.ts`~~ | ~~Legacy auth (deprecated)~~ |
| **Supabase** | `lib/supabase.ts` | Database client |
| **Logger** | `logger.service.ts` | Centralized logging |
| **Assessment** | `pumpAssessment.service.ts` | PumpDrive assessments |

### Service Architecture

```
┌────────────────────────────────────────────────────┐
│              Application Layer                      │
│   (Components, Pages, Hooks)                       │
└────────────────┬───────────────────────────────────┘
                 │
┌────────────────┴───────────────────────────────────┐
│           Service Layer                             │
│  ┌──────────────────────────────────────────────┐ │
│  │  supabaseAuthService (CURRENT)               │ │
│  │  - loginMedicalStaff()                       │ │
│  │  - loginPatient()                            │ │
│  │  - registerPatient()                         │ │
│  └──────────────────────────────────────────────┘ │
└────────────────┬───────────────────────────────────┘
                 │
┌────────────────┴───────────────────────────────────┐
│         Data Layer                                  │
│  ┌──────────────────┐    ┌─────────────────────┐  │
│  │  Supabase Client │    │  PostgreSQL         │  │
│  │  (lib/supabase)  │────│  (Hosted by         │  │
│  │                  │    │   Supabase)         │  │
│  └──────────────────┘    └─────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Migration History

### October 7-9, 2024: MySQL → Supabase Migration

**What Changed:**
- Migrated from self-hosted MySQL to Supabase PostgreSQL
- Consolidated `pump_users` table into `patients` table
- Updated backend APIs to use Supabase client
- Updated `PatientLogin.tsx` to use Supabase auth

**Files Changed:**
- All backend APIs (`server/*.js`)
- Database schema migration scripts
- Patient login page

**Status:** ✅ Completed

### November 11, 2024: PumpDrive Auth Guard Fix

**What Changed:**
- Fixed `PumpDriveAuthGuard.tsx` to use Supabase auth
- Updated `AssessmentHistory.tsx` to use Supabase auth
- Updated `PumpDriveBilling.tsx` to use Supabase auth
- Removed unused import from `PumpDriveResults.tsx`
- Deprecated `pumpAuth.service.ts` with TypeScript annotations
- Added ESLint rule to prevent future use
- Added pre-commit hook to block deprecated imports

**Problem:**
PumpDriveAuthGuard was still checking for old `pump_auth_token` in localStorage, but Supabase stores sessions in `sb-{project}-auth-token`. This caused users to successfully log in but immediately get redirected back to login.

**Root Cause:**
Incomplete migration - PatientLogin was updated in October, but auth guard was overlooked.

**Solution:**
- Auth guard now uses `supabaseAuthService.isAuthenticated()`
- Wildcard route redirects to `/patient-login` instead of create-account
- Added automated checks to prevent similar issues

**Status:** ✅ Completed

### Future Cleanup (Planned)

**When:** Next major version

**Tasks:**
- Delete `src/services/pumpAuth.service.ts`
- Delete `src/services/medicalAuth.service.ts`
- Delete `src/services/unifiedAuth.service.ts`
- Clean up deprecated database scripts
- Archive old documentation

---

## Prevention Measures

To avoid incomplete migrations in the future:

### 1. Automated Checks

**ESLint Rule:**
```javascript
'no-restricted-imports': [
  'error',
  {
    patterns: [{
      group: ['**/pumpAuth.service'],
      message: '⚠️ Use supabaseAuth.service instead'
    }]
  }
]
```

**Pre-commit Hook:**
Blocks commits that import deprecated services

### 2. TypeScript Deprecation

All deprecated code is marked with `@deprecated` tags for IDE warnings

### 3. Documentation

- This ARCHITECTURE.md is the single source of truth
- MIGRATION_PROTOCOL.md defines the process for future migrations
- All major changes are logged here

### 4. Migration Checklist

See `MIGRATION_PROTOCOL.md` for the standardized migration process

---

## Contact & Support

**For Questions:**
- Architecture: See this document
- Migrations: See `MIGRATION_PROTOCOL.md`
- Deployment: See `.github/workflows/`
- Database: See `scripts/database/`

**Last Reviewed:** November 11, 2024
