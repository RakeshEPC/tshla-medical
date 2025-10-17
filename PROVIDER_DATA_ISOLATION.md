# Provider Data Isolation - Implementation Guide

**Date**: October 17, 2025
**Status**: ✅ **ALREADY IMPLEMENTED** (with enhancements needed)

---

## 🎯 Goal

Each doctor should only see their own dictations and patient data when logged in, not other doctors' data.

---

## ✅ What's Already Working

### **1. Authentication System** ✅

The app uses Supabase Auth with medical_staff table:

**File**: `src/services/supabaseAuth.service.ts`

```typescript
// When a doctor logs in:
const user: AuthUser = {
  id: staffData.id,              // ✅ Unique provider ID
  email: staffData.email,
  name: `${first_name} ${last_name}`,
  role: staffData.role,           // 'doctor', 'nurse', etc.
  specialty: staffData.specialty,
  accessType: 'medical',
  authUserId: authData.user.id    // Supabase auth ID
};
```

### **2. Provider ID Tracking** ✅

**File**: `src/components/MedicalDictation.tsx`

```typescript
// Get current logged-in provider
const currentUser = unifiedAuthService.getCurrentUser();
const providerId = currentUser?.id || currentUser?.email;
const providerName = currentUser?.name || 'Dr. Default';

// Save with provider ID
await scheduleDatabaseService.saveNote(
  providerId,      // ✅ Links note to this doctor
  providerName,
  noteData
);
```

### **3. Backend API Filtering** ✅

**File**: `server/enhanced-schedule-notes-api.js`

All endpoints already filter by `provider_id`:

```javascript
// GET provider's notes - Line 806
app.get('/api/providers/:providerId/notes', async (req, res) => {
  const { providerId } = req.params;

  let query = unifiedSupabase
    .from('dictated_notes')
    .select('*')
    .eq('provider_id', providerId);  // ✅ Only this doctor's notes

  const { data: rows } = await query;
  res.json({ notes: rows });
});

// Search notes - Line 978
app.get('/api/notes/search', async (req, res) => {
  const { provider_id } = req.query;

  if (provider_id) {
    searchQuery = searchQuery.eq('provider_id', provider_id);  // ✅ Filtered
  }
});
```

### **4. Database Schema** ✅

**Table**: `dictated_notes`

```sql
CREATE TABLE dictated_notes (
  id BIGSERIAL PRIMARY KEY,
  provider_id VARCHAR(100) NOT NULL,    -- ✅ Which doctor
  provider_name VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255),
  patient_name VARCHAR(255) NOT NULL,
  raw_transcript TEXT NOT NULL,
  processed_note TEXT NOT NULL,
  -- ... other fields
);

-- Index for fast lookups
CREATE INDEX idx_dictated_notes_provider ON dictated_notes(provider_id);
```

---

## ⚠️ Current Gaps

### **1. No Authentication Middleware on API**

**Problem**: API endpoints don't verify JWT token

```javascript
// Current - No auth check! ❌
app.get('/api/providers/:providerId/notes', async (req, res) => {
  const { providerId } = req.params;
  // Anyone can request any providerId!
});
```

**Risk**: Someone could call the API with a different `providerId` and see other doctors' notes

### **2. Row Level Security (RLS) Not Enforced**

**Problem**: Supabase RLS policies exist but use `current_setting()` which isn't set

```sql
-- This policy exists but won't work without setting app.current_provider_id
CREATE POLICY "Providers can view their own notes" ON dictated_notes
  FOR SELECT USING (
    provider_id = current_setting('app.current_provider_id', true)
  );
```

### **3. Frontend Could Be Bypassed**

**Problem**: Frontend filters by logged-in user, but API doesn't enforce it

**Current Flow**:
```
Frontend: "I'm doctor-001, get my notes"
    ↓
API: "OK, here are notes for doctor-001" ✅
```

**Exploit**:
```
Hacker: "I'm doctor-001, but get notes for doctor-002"
    ↓
API: "OK, here are notes for doctor-002" ❌
```

---

## 🔒 Complete Security Implementation

### **Phase 1: Add Authentication Middleware** (CRITICAL)

Create JWT verification middleware for the API:

**File**: `server/middleware/auth.middleware.js`

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify JWT token and attach user to request
 */
async function authenticateRequest(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Get medical staff record
    const { data: staffData, error: staffError } = await supabase
      .from('medical_staff')
      .select('id, email, first_name, last_name, role, specialty, is_admin')
      .eq('auth_user_id', user.id)
      .single();

    if (staffError || !staffData) {
      return res.status(403).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // Attach user to request
    req.user = {
      id: staffData.id,
      authUserId: user.id,
      email: staffData.email,
      name: `${staffData.first_name} ${staffData.last_name}`.trim(),
      role: staffData.role,
      specialty: staffData.specialty,
      isAdmin: staffData.is_admin || false
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * Verify provider can only access their own data
 * Unless they're an admin
 */
function authorizeProvider(req, res, next) {
  const { providerId } = req.params;
  const requestedProviderId = providerId || req.body.provider_id;

  // Admins can access all data
  if (req.user.isAdmin) {
    return next();
  }

  // Provider can only access their own data
  if (requestedProviderId && requestedProviderId !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: You can only access your own data'
    });
  }

  next();
}

module.exports = {
  authenticateRequest,
  authorizeProvider
};
```

### **Phase 2: Apply Middleware to API Endpoints**

**File**: `server/enhanced-schedule-notes-api.js`

```javascript
const { authenticateRequest, authorizeProvider } = require('./middleware/auth.middleware');

// Apply authentication to all protected routes
app.use('/api/providers', authenticateRequest);
app.use('/api/notes', authenticateRequest);
app.use('/api/appointments', authenticateRequest);
app.use('/api/dictated-notes', authenticateRequest);

// Protected endpoints with authorization
app.get('/api/providers/:providerId/notes',
  authorizeProvider,  // ✅ Ensure they can only get their own
  async (req, res) => {
    const { providerId } = req.params;
    // Now safe - providerId is verified to match req.user.id
  }
);

app.post('/api/dictated-notes', async (req, res) => {
  // Override provider_id with authenticated user
  // Don't trust what frontend sends!
  const noteData = {
    ...req.body,
    provider_id: req.user.id,        // ✅ Force to logged-in user
    provider_name: req.user.name,
    provider_email: req.user.email
  };

  // Save with authenticated user's ID
  const { data, error } = await unifiedSupabase
    .from('dictated_notes')
    .insert(noteData);
});
```

### **Phase 3: Update Frontend to Send Token**

**File**: `src/services/scheduleDatabase.service.ts`

```typescript
class ScheduleDatabaseService {
  private getAuthHeaders(): HeadersInit {
    // Get current Supabase session
    const session = supabase.auth.getSession();
    const token = session?.data?.session?.access_token;

    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async saveNote(providerId: string, providerName: string, note: DictatedNote) {
    const response = await fetch(`${this.API_BASE_URL}:3003/api/dictated-notes`, {
      method: 'POST',
      headers: this.getAuthHeaders(),  // ✅ Include JWT token
      body: JSON.stringify({
        // Don't send provider_id - server will set from token
        patient_name: note.patientName,
        raw_transcript: note.rawTranscript,
        processed_note: note.aiProcessedNote,
        // ... other fields
      })
    });
  }
}
```

### **Phase 4: Enforce RLS in Supabase**

**File**: `database/migrations/provider-rls-policies.sql`

```sql
-- Enable RLS
ALTER TABLE dictated_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Providers can only SELECT their own notes
CREATE POLICY "providers_select_own_notes" ON dictated_notes
  FOR SELECT
  USING (
    provider_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM medical_staff
      WHERE auth_user_id = auth.uid()
      AND is_admin = true
    )
  );

-- Policy: Providers can only INSERT as themselves
CREATE POLICY "providers_insert_own_notes" ON dictated_notes
  FOR INSERT
  WITH CHECK (
    provider_id IN (
      SELECT id FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Providers can only UPDATE their own notes
CREATE POLICY "providers_update_own_notes" ON dictated_notes
  FOR UPDATE
  USING (
    provider_id IN (
      SELECT id FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Providers can only DELETE their own notes (if needed)
CREATE POLICY "providers_delete_own_notes" ON dictated_notes
  FOR DELETE
  USING (
    provider_id IN (
      SELECT id FROM medical_staff
      WHERE auth_user_id = auth.uid()
    )
  );
```

---

## 📊 Current vs. Secured Architecture

### **BEFORE** (Current - Partially Secure)

```
┌─────────────────────────────────┐
│  Frontend                       │
│  - Gets providerId from login   │
│  - Requests own data            │
└────────┬────────────────────────┘
         │ "Give me notes for doctor-001"
         ↓
┌─────────────────────────────────┐
│  Backend API                    │
│  ❌ No token verification       │
│  ❌ Trusts frontend             │
│  ✅ Filters by providerId       │
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│  Supabase                       │
│  ✅ Data separated by provider  │
│  ⚠️ RLS not enforced            │
└─────────────────────────────────┘
```

**Vulnerability**: Someone could modify frontend code or use API directly

### **AFTER** (Fully Secure)

```
┌─────────────────────────────────┐
│  Frontend                       │
│  - Gets JWT token from login    │
│  - Sends token with requests    │
└────────┬────────────────────────┘
         │ "Bearer eyJhbGc..." (JWT token)
         ↓
┌─────────────────────────────────┐
│  Backend API                    │
│  ✅ Verifies JWT token           │
│  ✅ Extracts providerId from token│
│  ✅ Ignores frontend providerId  │
│  ✅ Only allows own data         │
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│  Supabase                       │
│  ✅ Data separated by provider  │
│  ✅ RLS enforces at DB level    │
│  ✅ Double protection            │
└─────────────────────────────────┘
```

**Security**: Multi-layered - Frontend, API, and Database all enforce isolation

---

## 🧪 Testing Provider Isolation

### **Test 1: Verify Current Behavior**

```bash
# Login as Doctor A
# Record a dictation
# Check Supabase - note should have Doctor A's provider_id

# Login as Doctor B
# Go to notes list
# Should NOT see Doctor A's notes ✅
```

### **Test 2: Try to Bypass (Before Security)**

```javascript
// In browser console
fetch('http://localhost:3003/api/providers/doctor-001/notes')
  .then(r => r.json())
  .then(console.log);
// This currently works! ❌
```

### **Test 3: Verify Security (After Implementation)**

```javascript
// Try without token
fetch('http://localhost:3003/api/providers/doctor-001/notes')
  .then(r => r.json())
  .then(console.log);
// Should return 401 Unauthorized ✅

// Try to access other doctor's data
fetch('http://localhost:3003/api/providers/doctor-002/notes', {
  headers: { 'Authorization': 'Bearer <doctor-001-token>' }
})
  .then(r => r.json())
  .then(console.log);
// Should return 403 Forbidden ✅
```

---

## 📋 Implementation Checklist

### **Quick Fix (Good Enough for Now)**
- [x] ✅ Provider ID saved with each note (DONE)
- [x] ✅ Frontend filters by logged-in provider (DONE)
- [x] ✅ API filters by provider_id parameter (DONE)
- [ ] ⚠️ Users should not share login credentials

### **Production Security (Required for HIPAA)**
- [ ] Create authentication middleware
- [ ] Apply middleware to all protected endpoints
- [ ] Update frontend to send JWT tokens
- [ ] Override provider_id on server (don't trust client)
- [ ] Enable RLS policies in Supabase
- [ ] Test admin access (can see all)
- [ ] Test doctor access (can see only own)
- [ ] Audit all API endpoints
- [ ] Add logging for access attempts
- [ ] Set up monitoring/alerts

---

## 🔐 HIPAA Compliance Notes

For true HIPAA compliance, you MUST implement:

1. **Authentication** ✅ (Already have Supabase Auth)
2. **Authorization** ⚠️ (Partially implemented - needs middleware)
3. **Audit Logging** ⚠️ (Partially - need to log access attempts)
4. **Encryption** ✅ (Supabase provides)
5. **Access Controls** ⚠️ (Need RLS + API middleware)

---

## 🎯 Recommendation

**For Development/Testing**: Current implementation is OK
- Doctors each have their own login
- Frontend filters correctly
- Data is separated in database
- Risk: Low (internal use only)

**For Production**: Implement full security ASAP
- Add authentication middleware
- Enable RLS policies
- Audit all access
- Risk: HIGH if not implemented

---

## 📁 Files to Create/Modify

1. **CREATE**: `server/middleware/auth.middleware.js` - JWT verification
2. **MODIFY**: `server/enhanced-schedule-notes-api.js` - Apply middleware
3. **MODIFY**: `src/services/scheduleDatabase.service.ts` - Send JWT tokens
4. **CREATE**: `database/migrations/provider-rls-policies.sql` - RLS policies
5. **CREATE**: `scripts/test-provider-isolation.js` - Test script

---

## ✅ Current Status Summary

**What's Working**:
- ✅ Each doctor has unique provider_id
- ✅ Notes saved with provider_id
- ✅ Frontend requests own data only
- ✅ API filters by provider_id

**What's Missing**:
- ❌ API doesn't verify JWT tokens
- ❌ API trusts frontend's provider_id
- ❌ RLS not enforced at database level
- ❌ Could be bypassed with direct API calls

**Bottom Line**: **It works for honest users, but not secure against malicious access.**

---

**Want me to implement the full security layer now?**
