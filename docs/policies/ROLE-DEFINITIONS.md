# Role Definitions
## TSHLA Medical Application

**Last Updated:** January 9, 2026
**HIPAA Reference:** §164.308(a)(3) - Workforce Security

---

## Overview

This document defines each role's responsibilities, access privileges, and training requirements for HIPAA compliance.

---

## Super Admin

**Level:** 5 (Highest)
**HIPAA Classification:** Covered Entity Administrator

###

 Responsibilities
- System configuration and maintenance
- User account management
- Security policy enforcement
- Breach response coordination
- Backup and disaster recovery
- Vendor management and BAAs

### Access Rights
- Full database access
- All patient records
- System logs and audit trails
- Security configuration
- User management console

### Training Requirements
- Annual HIPAA Security Rule training
- Annual Privacy Rule training
- Incident response training
- Technical security training

### Typical Job Titles
- IT Director
- Security Officer
- System Administrator

---

## Admin

**Level:** 4
**HIPAA Classification:** Privacy Officer / Clinic Administrator

### Responsibilities
- Daily operational management
- Staff account creation
- Patient record oversight
- Audit log review
- Staff training coordination

### Access Rights
- All patient records
- User management (except Super Admin)
- Audit logs
- Reports and analytics

### Training Requirements
- Annual HIPAA training
- PHI handling procedures
- Audit review procedures

### Typical Job Titles
- Clinic Manager
- Privacy Officer
- Practice Administrator

---

## Physician (Doctor)

**Level:** 3
**HIPAA Classification:** Healthcare Provider

### Responsibilities
- Patient diagnosis and treatment
- Medical record documentation
- Treatment plan creation
- Prescription management
- Patient education

### Access Rights
- Assigned patients' complete records
- Medical notes (create, edit own)
- Pump reports and recommendations
- Lab results and imaging
- Appointment history

### Limitations
- Cannot access unassigned patients
- Cannot delete records
- Cannot access admin functions
- Cannot view system logs

### Training Requirements
- Annual HIPAA training
- Clinical documentation standards
- EHR system training

### Typical Job Titles
- Physician
- Doctor
- Medical Provider

---

## Nurse

**Level:** 2
**HIPAA Classification:** Healthcare Provider

### Responsibilities
- Patient care coordination
- Vital signs documentation
- Medication administration
- Patient education
- Care plan implementation

### Access Rights
- Assigned patients' records
- Medical notes (view and create)
- Pump reports (view and create)
- Appointment information
- Lab results (view only)

### Limitations
- Cannot edit physicians' notes
- Cannot delete records
- Cannot access sensitive fields (SSN)
- Cannot export data

### Training Requirements
- Annual HIPAA training
- Clinical documentation
- Scope of practice training

### Typical Job Titles
- Registered Nurse (RN)
- Licensed Practical Nurse (LPN)
- Clinical Nurse

---

## Staff

**Level:** 1
**HIPAA Classification:** Administrative Support

### Responsibilities
- Appointment scheduling
- Patient check-in/check-out
- Demographics updates
- Insurance verification
- Non-clinical communication

### Access Rights
- Patient demographics (name, DOB, contact)
- Appointment schedule
- Insurance information
- Basic contact history

### Limitations
- Cannot view clinical notes
- Cannot view lab results
- Cannot view pump reports
- Cannot export data
- Cannot access medical history

### Training Requirements
- Annual HIPAA training
- Front desk procedures
- Patient privacy protocols

### Typical Job Titles
- Medical Receptionist
- Scheduling Coordinator
- Front Desk Staff

---

## Patient

**Level:** 0
**HIPAA Classification:** Individual / Consumer

### Responsibilities
- Maintain accurate contact information
- Review own medical records
- Communicate with care team
- Follow treatment plans

### Access Rights
- Own medical records (view only)
- Own appointments (view only)
- Own pump reports
- Own test results
- Care team messages

### Limitations
- Cannot view other patients' data
- Cannot edit medical records
- Cannot create appointments
- Cannot access admin functions

### Training Requirements
- Patient portal orientation
- Privacy notice acknowledgment

---

## Role Assignment Process

1. **New Hire**
   - HR determines appropriate role based on job function
   - Minimum necessary access principle applied
   - Admin creates account with assigned role

2. **Role Change**
   - Requires written request with justification
   - Must be approved by Super Admin
   - All changes logged in audit trail
   - Previous access reviewed and revoked if unnecessary

3. **Termination**
   - Access immediately revoked
   - Account deactivated (not deleted for audit purposes)
   - Final access report generated

---

## Role-Based Security Controls

| Security Control | Implementation |
|-----------------|----------------|
| **Password Requirements** | 12+ characters, complexity rules, MFA for Admin+ |
| **Session Timeout** | 30 minutes inactivity, 2 hours maximum |
| **MFA Requirement** | Required for Admin and Super Admin |
| **Concurrent Sessions** | Maximum 3 active sessions per user |
| **Failed Login Lockout** | 5 attempts, 15-minute lockout |

---

## Compliance Mapping

| HIPAA Requirement | Role Control |
|-------------------|--------------|
| §164.308(a)(3)(i) - Workforce Security | Roles define access levels |
| §164.308(a)(3)(ii)(A) - Authorization | Documented role assignments |
| §164.308(a)(3)(ii)(B) - Workforce Clearance | Background checks for clinical roles |
| §164.308(a)(3)(ii)(C) - Termination Procedures | Immediate access revocation |
| §164.308(a)(4)(i) - Access Authorization | Role-based permissions matrix |

---

**Next Review:** April 9, 2026
