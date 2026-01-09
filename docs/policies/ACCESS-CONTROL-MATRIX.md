# Access Control Matrix
## TSHLA Medical Application

**Document Version:** 1.0
**Last Updated:** January 9, 2026
**Owner:** Security Team
**Review Cycle:** Quarterly

---

## Overview

This document defines role-based access controls (RBAC) for the TSHLA Medical application in accordance with HIPAA requirements §164.308(a)(4) - Access Authorization.

All access is enforced through:
1. **Row-Level Security (RLS)** policies in Supabase
2. **Role-based authentication** in the application
3. **API-level authorization** checks
4. **Audit logging** of all PHI access

---

## Role Definitions

| Role | Level | Description |
|------|-------|-------------|
| **Super Admin** | 5 | Full system access, user management, system configuration |
| **Admin** | 4 | Patient data access, staff management, reports |
| **Physician (Doctor)** | 3 | Full clinical access to assigned patients |
| **Nurse** | 2 | Clinical access to assigned patients, limited editing |
| **Staff** | 1 | Scheduling, basic patient demographics |
| **Patient** | 0 | Own records only |

---

## Access Control Matrix

### Patient Data Access

| Resource | Super Admin | Admin | Physician | Nurse | Staff | Patient |
|----------|-------------|-------|-----------|-------|-------|---------|
| **View All Patient Records** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View Own Patients** | ✅ | ✅ | ✅ | ✅ | ✅ (demographics only) | ✅ (own only) |
| **Edit Patient Demographics** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Edit Clinical Notes** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Patient Records** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Export Patient Data** | ✅ | ✅ | ✅ (own patients) | ❌ | ❌ | ❌ |
| **View Sensitive Fields (SSN, etc.)** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Medical Records Access

| Resource | Super Admin | Admin | Physician | Nurse | Staff | Patient |
|----------|-------------|-------|-----------|-------|-------|---------|
| **View Medical Notes** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (own only) |
| **Create Medical Notes** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Edit Medical Notes** | ✅ | ✅ | ✅ (own notes) | ❌ | ❌ | ❌ |
| **Delete Medical Notes** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Share Notes** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Audit Trail** | ✅ | ✅ | ✅ (own access) | ❌ | ❌ | ❌ |

### Pump Reports Access

| Resource | Super Admin | Admin | Physician | Nurse | Staff | Patient |
|----------|-------------|-------|-----------|-------|-------|---------|
| **View Pump Reports** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (own only) |
| **Create Pump Reports** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (own only) |
| **Edit Pump Reports** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Pump Reports** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View Recommendations** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (own only) |

### Appointments & Scheduling

| Resource | Super Admin | Admin | Physician | Nurse | Staff | Patient |
|----------|-------------|-------|-----------|-------|-------|---------|
| **View All Appointments** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View Own Schedule** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Create Appointments** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Edit Appointments** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Cancel Appointments** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View Appointment History** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own only) |

### User Management

| Resource | Super Admin | Admin | Physician | Nurse | Staff | Patient |
|----------|-------------|-------|-----------|-------|-------|---------|
| **Create Accounts** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Edit User Accounts** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Delete Accounts** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reset Passwords** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manage Roles** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **View User List** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### System Administration

| Resource | Super Admin | Admin | Physician | Nurse | Staff | Patient |
|----------|-------------|-------|-----------|-------|-------|---------|
| **View Audit Logs** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View System Logs** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **System Configuration** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Database Access** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Security Settings** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Backup/Restore** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Technical Implementation

### Row-Level Security (RLS) Policies

All data access is enforced at the database level using Supabase RLS policies:

**Example: Patient Record Access**
```sql
CREATE POLICY "Staff can view assigned patients"
ON patients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM medical_staff
    WHERE medical_staff.auth_user_id = auth.uid()
    AND medical_staff.is_active = true
  )
);
```

### Role-Based Route Protection

Frontend routes are protected by role:

```typescript
// Example from ProtectedRoute.tsx
if (requiredRole === 'admin' && user.role !== 'admin') {
  return <Navigate to="/dashboard" />;
}
```

### API Authorization

All API endpoints verify user role before returning data:

```typescript
// Example API authorization
if (!user || !['admin', 'super_admin'].includes(user.role)) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

---

## Provider Assignment

Patients are assigned to specific providers. Providers can only access:
- Patients explicitly assigned to them
- Patients they have an active appointment with
- Patients in their clinic (if multi-clinic enabled)

**Provider Assignment Table:** `patient_provider_assignments`

---

## Minimum Necessary Rule

All access must comply with HIPAA's Minimum Necessary rule:
- Users can only access PHI necessary for their job function
- Access is logged and reviewed quarterly
- Excessive access triggers alerts (see `detect_suspicious_activity()` function)

---

## Break-Glass Access

Emergency access procedures:
1. Super Admin can grant temporary elevated access
2. All break-glass access is logged with justification
3. Break-glass access expires after 24 hours
4. Requires incident report within 24 hours

---

## Access Request Workflow

See [ACCESS-REQUEST-PROCEDURE.md](./ACCESS-REQUEST-PROCEDURE.md) for details on how users request additional access.

---

## Audit and Review

### Regular Reviews
- **Quarterly:** Review all user access levels
- **Annual:** Complete access control audit
- **On Departure:** Immediately revoke access when staff leaves

### Audit Queries

Review user access patterns:
```sql
SELECT
  user_email,
  COUNT(*) as access_count,
  COUNT(DISTINCT resource_id) as unique_records
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '30 days'
  AND contains_phi = true
GROUP BY user_email
ORDER BY access_count DESC;
```

---

## Exceptions

Requests for access beyond these matrices must:
1. Be submitted via [ACCESS-REQUEST-PROCEDURE.md](./ACCESS-REQUEST-PROCEDURE.md)
2. Include business justification
3. Be approved by Super Admin
4. Be reviewed quarterly

---

## Compliance

This access control matrix implements:
- **HIPAA §164.308(a)(3)** - Workforce Security
- **HIPAA §164.308(a)(4)** - Access Authorization
- **HIPAA §164.312(a)(1)** - Access Control
- **HIPAA §164.502(b)** - Minimum Necessary

---

**Document History:**
- 2026-01-09: Initial version created
- Next Review: 2026-04-09
