# TSHLA Medical App - Authentication System Analysis
**Date:** October 5, 2025
**Status:** Stable Production System
**Purpose:** Comprehensive documentation of authentication architecture and design decisions

---

## Executive Summary

The TSHLA Medical App implements a **unified multi-tier authentication system** supporting four distinct user types (medical staff, PumpDrive users, patients, and demo accounts) with centralized management, JWT-based security, and HIPAA-compliant features.

**Key Metrics:**
- 🔐 **Security:** bcrypt hashing (12 rounds) + JWT tokens
- 👥 **User Types:** 4 separate authentication flows
- ⏱️ **Session Duration:** 1-24 hours (role-dependent)
- 🏥 **Compliance:** HIPAA-ready with audit logging, MFA, account lockout
- 📊 **Database:** MySQL on Azure with separate medical_staff and pump_users tables

---

## Architecture Overview

### 1. Unified Authentication Flow

The system uses a **cascading authentication approach** managed by the central service:

**File:** `src/services/unifiedAuth.service.ts` (462 lines)

**Login Priority Order:**
```
User Login Attempt
    ↓
1. Medical Staff Database Check
   - doctors, nurses, admins, medical assistants
   - JWT token, 8-hour session
   ↓ (if fails)
2. PumpDrive Database Check
   - pump comparison tool users
   - JWT token, 24-hour session with payment-based renewal
   ↓ (if fails)
3. Demo/Access Code Accounts
   - test accounts (DOCTOR-2025, DIET-2025, etc.)
   - stored in medical_staff with access code as password
   ↓ (if fails)
4. Patient Accounts
   - AVA ID format login (AVA 123-456)
   - 1-hour limited session
   ↓
Authentication Result
```

### 2. Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Unified Auth Service (Master)                 │
│  src/services/unifiedAuth.service.ts                    │
└───────────┬─────────────┬──────────────┬────────────────┘
            │             │              │
            ↓             ↓              ↓
┌───────────────┐ ┌──────────────┐ ┌──────────────┐
│ Medical Auth  │ │  Pump Auth   │ │ Patient Auth │
│   Service     │ │   Service    │ │   Service    │
└───────┬───────┘ └──────┬───────┘ └──────┬───────┘
        │                │                 │
        ↓                ↓                 ↓
┌───────────────────────────────────────────────────────┐
│              Backend API Servers                       │
│  - medical-auth-api.js (Port 3003)                    │
│  - pump-report-api.js (includes pump auth)            │
└───────────────────────────────────────────────────────┘
        │                │                 │
        ↓                ↓                 ↓
┌───────────────────────────────────────────────────────┐
│           MySQL Database (Azure)                       │
│  - medical_staff table                                 │
│  - pump_users table                                    │
│  - patients table                                      │
└───────────────────────────────────────────────────────┘
```

---

## User Types & Authentication Details

### 1. Medical Staff (Primary System)

**Roles:** `doctor`, `nurse`, `staff`, `medical_assistant`, `admin`

**Authentication Service:** `src/services/medicalAuth.service.ts` (345 lines)

**Backend API:** `server/medical-auth-api.js` (Port 3003)

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- bcrypt hashing with 12 salt rounds

**Session Management:**
- Duration: 8 hours
- Storage: localStorage (auth_token, user_data, session_expires)
- Auto-refresh: When < 30 minutes remaining
- Token: JWT with Bearer authentication

**Database Schema (medical_staff):**
```sql
- id (PRIMARY KEY)
- email (UNIQUE)
- username
- password_hash
- first_name
- last_name
- role
- practice
- specialty
- created_at
- updated_at
```

**API Endpoints:**
- `POST /api/medical/register` - Register new medical professional
- `POST /api/medical/login` - Login with email/password
- `GET /api/medical/verify` - Verify current JWT token

**Permissions by Role:**

| Permission | Admin | Doctor | Staff/MA/Nurse |
|------------|-------|--------|----------------|
| Create Patients | ✅ | ❌ | ✅ |
| Edit Patients | ✅ | ❌ | ✅ |
| Create Charts | ✅ | ❌ | ✅ |
| View Notes | ✅ | ✅ | ✅ |
| Edit Notes | ✅ | ✅ | ❌ |
| Manage Calendar | ✅ | ❌ | ✅ |
| Process Action Items | ✅ | ❌ | ✅ |
| View Audit Logs | ✅ | ❌ | ❌ |

### 2. PumpDrive Users

**Authentication Service:** `src/services/pumpAuth.service.ts` (424 lines)

**Backend API:** `server/pump-report-api.js` (includes auth endpoints)

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 special character (!@#$%^&*)
- bcrypt hashing with 12 salt rounds

**Session Management:**
- Duration: 24 hours (time-limited access)
- Payment-based renewal system
- Access expiration tracking
- Storage: localStorage (pump_auth_token, pump_user_data)

**Database Schema (pump_users):**
```sql
- id (PRIMARY KEY)
- email (UNIQUE)
- username
- password_hash
- first_name
- last_name
- phone_number
- access_expires_at (TIMESTAMP for 24-hour window)
- is_research_participant (BOOLEAN)
- created_at
- updated_at
```

**API Endpoints:**
- `POST /api/auth/register` - Register pump user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/check-access` - Verify 24-hour access status
- `POST /api/auth/renew-access` - Renew access after payment

**Special Features:**
- Time-limited access (24 hours from payment)
- Research participant tracking
- Admin role for pump management (`role: admin` in JWT)
- Automatic access expiration checks

### 3. Patient Access

**Authentication:** AVA ID-based (format: `AVA 123-456`)

**Session Management:**
- Duration: 1 hour
- Limited permissions (view-only)
- No patient management capabilities

**Purpose:** Allow patients to view their own medical information

### 4. Demo/Access Code Accounts

**Purpose:** Testing and demonstration accounts

**Implementation:** Stored in medical_staff table with access code as password

**Example Codes:**
- `DOCTOR-2025` - Doctor role
- `DIET-2025` - Dietician role
- `DEMO` - Generic demo access

**Pattern Validation:** `/^[A-Z]+-\d{4}$|^DEMO$/`

---

## Security Implementation

### 1. Password Hashing

**Algorithm:** bcrypt with 12 salt rounds

**Server-side Implementation:**
```javascript
// server/medical-auth-api.js:172-173
const saltRounds = 12;
const passwordHash = await bcrypt.hash(password, saltRounds);
```

**Verification:**
```javascript
const isValid = await bcrypt.compare(password, user.passwordHash);
```

**Why bcrypt?**
- Industry standard for password hashing
- Automatically salted
- Computationally expensive (prevents brute force)
- Adaptive (can increase rounds as hardware improves)

### 2. JWT Token Management

**Secret Key:** Environment variable `JWT_SECRET` or fallback `'tshla-unified-jwt-secret-2025'`

**Token Structure:**
```
Authorization: Bearer <token>
```

**JWT Payload (Medical Staff):**
```json
{
  "userId": 123,
  "email": "doctor@example.com",
  "role": "doctor",
  "permissions": ["read:patient_data", "write:patient_data"],
  "iat": 1696512000,
  "exp": 1696540800
}
```

**Token Verification (server/medical-auth-api.js:72-88):**
```javascript
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
```

### 3. Session Management

**Client-side Storage (localStorage):**
```javascript
// Keys used
- auth_token: JWT token string
- user_data: Serialized user object (JSON)
- session_expires: ISO timestamp
```

**Session Validation:**
```javascript
isAuthenticated() {
  const token = localStorage.getItem('auth_token');
  const expires = localStorage.getItem('session_expires');

  if (!token || !expires) return false;

  const expiresAt = new Date(expires);
  return expiresAt > new Date();
}
```

**Auto-refresh Logic (Medical Auth):**
- Check remaining time on API calls
- If < 30 minutes remaining, verify token to refresh
- Updates session_expires on successful verification

### 4. HIPAA Compliance Features

**File:** `src/lib/security/authentication.ts` (326 lines)

**Implemented Security Measures:**

#### Account Lockout
- Max failed attempts: 5
- Lockout duration: 30 minutes
- Tracked per user account
- Prevents brute force attacks

```javascript
private static MAX_FAILED_ATTEMPTS = 5;
private static LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

// On failed login:
user.failedAttempts++;
if (user.failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
  user.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION);
}
```

#### Password Expiry
- Maximum password age: 90 days
- Forces password change after expiry
- Prevents long-term credential compromise

```javascript
private static PASSWORD_EXPIRY_DAYS = 90;

const passwordAge = Date.now() - new Date(user.passwordChangedAt).getTime();
const maxPasswordAge = this.PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

if (passwordAge > maxPasswordAge) {
  user.requirePasswordChange = true;
}
```

#### Multi-Factor Authentication (MFA)
- TOTP-based (Time-based One-Time Password)
- Library: Speakeasy
- QR code generation for mobile authenticator apps
- 2-step verification window for clock skew

```javascript
// Generate MFA secret
const mfaSecret = speakeasy.generateSecret({
  name: `TSHLA (${email})`,
  length: 32,
});

// Verify MFA token
const verified = speakeasy.totp.verify({
  secret: user.mfaSecret,
  encoding: 'base32',
  token,
  window: 2, // Allow 2 time steps for clock skew
});
```

#### Audit Logging
- All authentication events logged
- Tracks: userId, action, timestamp, IP address, success/failure
- Supports compliance reporting and security incident investigation

```javascript
await auditLogger.log({
  userId: user.id,
  action: AuditAction.LOGIN,
  resourceType: ResourceType.PATIENT,
  resourceId: 'login',
  ipAddress,
  success: true,
});
```

#### Password History
- Prevents reuse of last 5 passwords
- Protects against password cycling

#### Session Timeout
- Auto-logout after inactivity
- Default: 30 minutes for HIPAA compliance
- Prevents unauthorized access to unattended sessions

---

## Role-Based Access Control (RBAC)

**Implementation:** `src/services/unifiedAuth.service.ts:347-432`

### Permission Structure

```typescript
interface StaffPermissions {
  canCreatePatients: boolean;
  canEditPatients: boolean;
  canCreateCharts: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
  canManageCalendar: boolean;
  canProcessActionItems: boolean;
  canViewAuditLogs: boolean;
}
```

### Permission Checking

```javascript
// Check specific permission
hasPermission(permission) {
  const user = this.getCurrentUser();
  if (!user || !user.permissions) return false;
  return user.permissions[permission] || false;
}

// Check access type
hasAccess(accessType) {
  const user = this.getCurrentUser();
  if (!user) return false;

  if (accessType === 'admin') return user.role === 'admin';
  return user.accessType === accessType || user.role === 'admin';
}
```

---

## React Integration

### AuthContext Provider

**File:** `src/contexts/AuthContext.tsx` (95 lines)

**Context Structure:**
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}
```

**Usage in Components:**
```tsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <Dashboard user={user} />;
}
```

**App Wrapper:**
```tsx
// src/main.tsx
<AuthProvider>
  <App />
</AuthProvider>
```

### Protected Routes

Routes are protected using authentication checks:

```tsx
function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && !unifiedAuthService.hasAccess(requiredRole)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
}
```

---

## Database Configuration

### Connection Management

**File:** `server/services/unified-database.service.js`

**Connection Pooling:**
```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

**Environment Variables:**
- `DB_HOST` - Azure MySQL hostname
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_DATABASE` - Database name (tshla_medical)

### SQL Injection Prevention

All queries use **parameterized statements**:

```javascript
// ✅ SAFE - Parameterized query
const [users] = await connection.execute(
  'SELECT * FROM medical_staff WHERE email = ?',
  [email.toLowerCase()]
);

// ❌ UNSAFE - String concatenation (NOT USED)
// const query = `SELECT * FROM users WHERE email = '${email}'`;
```

---

## API Architecture

### CORS Configuration

```javascript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://www.tshla.ai',
    'https://mango-sky-0ba265c0f.1.azurestaticapps.net'
  ],
  credentials: true,
}));
```

### Error Handling

**Database Connection Errors:**
- 3 retry attempts with 3-second delays
- Graceful degradation (503 Service Unavailable)
- Health check endpoint for monitoring

**Authentication Errors:**
- 400 Bad Request - Invalid input
- 401 Unauthorized - Missing/invalid token
- 403 Forbidden - Insufficient permissions
- 409 Conflict - Email already exists
- 503 Service Unavailable - Database down

---

## Comparison: Current System vs Supabase

### Current System Strengths

✅ **Full Control**
- Complete control over authentication logic
- Custom multi-tier auth (medical, pump, patient, demo)
- Flexible to business requirements

✅ **MySQL Compatibility**
- Already using Azure MySQL
- No migration required
- Existing schema and data intact

✅ **HIPAA Compliance**
- Direct control over PHI storage
- Custom audit logging
- No third-party data sharing concerns

✅ **Cost Effective**
- No additional subscription fees
- Uses existing Azure infrastructure
- One-time development cost (already paid)

✅ **Working System**
- Battle-tested in production
- All features implemented
- Team understands codebase

### Supabase Advantages

✅ **Reduced Maintenance**
- Automatic security updates
- No auth server to maintain
- Pre-built password reset flows

✅ **Enhanced Features**
- Social login (Google, Microsoft OAuth)
- Magic links (passwordless)
- Phone/SMS authentication
- Better MFA implementation

✅ **Better Developer Experience**
- Auto-generated TypeScript types
- Built-in admin UI
- Excellent documentation
- Real-time subscriptions

✅ **Scalability**
- Auto-scaling infrastructure
- Built-in connection pooling
- Edge caching

### Migration Challenges

❌ **Database Incompatibility**
- Supabase uses PostgreSQL (current system: MySQL)
- Requires full schema migration
- SQL dialect differences

❌ **Custom Auth Complexity**
- Current 4-tier auth system is custom
- Supabase's opinionated approach may not fit
- Would need workarounds for:
  - Separate pump user database
  - Access code demo accounts
  - AVA ID patient login
  - 24-hour payment-based access

❌ **HIPAA Compliance Costs**
- Requires Supabase Pro plan ($25/month minimum)
- Must sign Business Associate Agreement (BAA)
- Additional enterprise features for full compliance

❌ **Migration Effort**
- Estimated 2-3 weeks development
- ~15 auth service files to refactor
- Update 50+ components
- Comprehensive testing required
- Risk of introducing bugs

❌ **Vendor Lock-in**
- Tied to Supabase infrastructure
- Harder to migrate away later
- Pricing changes could impact budget

### Cost Analysis

**Current System:**
- Development: One-time (already paid)
- Infrastructure: Azure MySQL (existing)
- Maintenance: Developer time only
- **Total: $0/month additional**

**Supabase:**
- Free tier: 500MB database, 50MB storage (insufficient)
- Pro tier: $25/month (8GB database, 100GB storage)
- HIPAA BAA: Enterprise add-on (pricing varies)
- Migration: 2-3 weeks developer time
- **Total: $300-500+/year + migration costs**

### Recommendation

**Stick with Current System** for the following reasons:

1. ✅ Working system meets all requirements
2. ✅ HIPAA compliant with full control
3. ✅ MySQL already in production
4. ✅ Custom multi-tier auth works well
5. ✅ Zero additional recurring costs
6. ✅ Team understands codebase

**Consider Supabase only if:**
- Planning major redesign/v2.0
- Need real-time collaboration features
- Want social login for medical staff
- Scaling to hundreds of practices
- Migrating from MySQL to PostgreSQL anyway

---

## Future Enhancement Roadmap

### Phase 1: Quick Wins (1 week)

1. **Email Verification**
   - Use nodemailer (already in package.json)
   - Send verification email on registration
   - Verify email before allowing login

2. **Password Reset Flow**
   - Forgot password link
   - Email reset token
   - Secure password reset page

3. **Rate Limiting**
   - Install express-rate-limit
   - Limit login attempts per IP
   - Prevent DDoS attacks

4. **Enhanced Audit Logging**
   - Expand existing auditLog.service.ts
   - Log all data access
   - Create audit report endpoints

### Phase 2: Security Enhancements (2 weeks)

1. **Refresh Tokens**
   - Implement refresh token rotation
   - Short-lived access tokens (15 min)
   - Long-lived refresh tokens (7 days)
   - Invalidate refresh tokens on logout

2. **Device Tracking**
   - Track login devices/browsers
   - Email alerts for new device logins
   - Ability to revoke device sessions

3. **IP Whitelisting** (Optional)
   - Allow practices to whitelist office IPs
   - Extra security layer for sensitive data

4. **Enhanced MFA**
   - Fully enable existing MFA code
   - Backup codes for account recovery
   - Remember trusted devices

### Phase 3: Advanced Features (3-4 weeks)

1. **OAuth Integration**
   - Google OAuth for medical staff
   - Microsoft Azure AD integration
   - Single Sign-On (SSO) support

2. **Magic Links**
   - Passwordless login option
   - Email-based authentication
   - Better UX for mobile users

3. **Biometric Support**
   - WebAuthn for fingerprint/face ID
   - Hardware security key support
   - Enhanced security for admin users

4. **Session Analytics**
   - Track active sessions
   - Session duration metrics
   - User activity heatmaps
   - Security anomaly detection

---

## Testing & Validation

### Authentication Test Cases

**Implemented Tests:**
1. ✅ Medical staff registration with valid data
2. ✅ Medical staff login with correct credentials
3. ✅ Login failure with incorrect password
4. ✅ Email uniqueness validation
5. ✅ Password strength validation
6. ✅ JWT token generation and verification
7. ✅ Session expiration handling
8. ✅ Role-based access control
9. ✅ PumpDrive user registration and login
10. ✅ 24-hour access expiration

**Recommended Additional Tests:**
- Account lockout after 5 failed attempts
- Password reset flow end-to-end
- MFA setup and verification
- Cross-site request forgery (CSRF) protection
- Token refresh mechanism
- Concurrent session handling

---

## Deployment & Operations

### Environment Configuration

**Required Environment Variables:**
```bash
# Database
DB_HOST=tshla-mysql-prod.mysql.database.azure.com
DB_USER=tshlaadmin
DB_PASSWORD=<secret>
DB_DATABASE=tshla_medical

# JWT
JWT_SECRET=<random-secure-string>
MEDICAL_JWT_SECRET=<random-secure-string>

# API Ports
PORT=3001
MEDICAL_AUTH_PORT=3003
```

### Health Checks

**Medical Auth API:**
```bash
GET /api/medical/health
Response: { status: "healthy", database: "connected" }
```

**Unified Database:**
```javascript
await unifiedDatabase.healthCheck();
```

### Monitoring

**Key Metrics to Track:**
- Authentication success/failure rate
- Average session duration
- Failed login attempts per hour
- Account lockout events
- Token verification failures
- Database connection pool usage

---

## Security Checklist

- [x] Passwords hashed with bcrypt (12 rounds)
- [x] JWT tokens with expiration
- [x] HTTPS-only in production
- [x] CORS configured with allowed origins
- [x] SQL injection prevention (parameterized queries)
- [x] Account lockout on failed attempts
- [x] Audit logging for compliance
- [x] Session timeout and auto-logout
- [x] Password strength validation
- [x] Role-based access control
- [x] MFA support (partially implemented)
- [ ] Email verification (planned)
- [ ] Password reset flow (planned)
- [ ] Rate limiting (planned)
- [ ] Refresh token rotation (planned)
- [ ] Device tracking (planned)

---

## Key Files Reference

### Frontend Services
- `src/services/unifiedAuth.service.ts` - Master authentication orchestrator
- `src/services/medicalAuth.service.ts` - Medical staff authentication
- `src/services/pumpAuth.service.ts` - PumpDrive user authentication
- `src/contexts/AuthContext.tsx` - React authentication context
- `src/lib/security/authentication.ts` - HIPAA compliance layer
- `src/lib/auth/jwtSession.ts` - JWT session management
- `src/lib/security/sessionManager.ts` - Session lifecycle management
- `src/lib/security/auditLog.ts` - Audit logging service

### Backend APIs
- `server/medical-auth-api.js` - Medical staff authentication API
- `server/pump-report-api.js` - PumpDrive authentication & features
- `server/services/unified-database.service.js` - Database connection pool

### UI Components
- `src/pages/Login.tsx` - Main login page
- `src/pages/UnifiedLogin.tsx` - Unified login interface
- `src/pages/PumpDriveLogin.tsx` - PumpDrive-specific login
- `src/components/ProtectedRoute.tsx` - Route authentication guard
- `src/components/AdminRoute.tsx` - Admin-only route guard

---

## Conclusion

The TSHLA Medical App authentication system is a **production-ready, HIPAA-compliant, multi-tier authentication solution** that successfully handles diverse user types with appropriate security measures.

**Key Achievements:**
- ✅ Unified authentication for 4 user types
- ✅ JWT-based secure token management
- ✅ bcrypt password hashing (industry standard)
- ✅ Role-based access control with granular permissions
- ✅ HIPAA compliance features (MFA, audit logging, account lockout)
- ✅ Scalable architecture with connection pooling
- ✅ Clean separation of concerns

**System Status:** **STABLE** - No migration to Supabase recommended at this time

**Next Steps:** Implement Phase 1 enhancements (email verification, password reset, rate limiting)

---

**Document Version:** 1.0
**Last Updated:** October 5, 2025
**Maintainer:** TSHLA Development Team
**Repository:** https://github.com/RakeshEPC/tshla-medical.git
