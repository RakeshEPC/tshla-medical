# ⚠️ DEPRECATED APPOINTMENT SERVICES

## 🚫 DO NOT USE THESE SERVICES - THEY ARE DEPRECATED

The following appointment services have been **deprecated** and should **NEVER** be used:

### ❌ Deprecated Services:

1. **`simpleAppointment.service.ts`** - Legacy simple appointment system
2. **`appointment.service.ts`** - Old appointment service
3. **`appointmentBrowser.service.ts`** - Browser-based appointment system
4. **`scheduleDatabase.service.ts`** - Database schedule service (fallback issues)
5. **`schedule-storage.ts`** - Schedule storage utility

### ❌ Deprecated Components:

1. **`DoctorDashboard.tsx`** - Old dashboard with multiple storage systems
2. **`DoctorDashboardDB.tsx`** - Database-dependent dashboard
3. **`DoctorSchedule.tsx`** - Legacy schedule component

### ❌ Deprecated localStorage Keys:

- `tshla_simple_appointments`
- `doctor_schedule_data`
- `doctor_schedule_backup`
- Any keys starting with `schedule_`

---

## ✅ ONLY USE THE UNIFIED SYSTEM

### 🎯 Single Source of Truth:

**`unifiedAppointment.service.ts`** - This is the ONLY appointment service to use

### 🎯 Single Component:

**`DoctorDashboardUnified.tsx`** - This is the ONLY dashboard component to use

### 🎯 Single Storage Key:

**`tshla_unified_appointments`** - This is the ONLY localStorage key for appointments

---

## 🔧 How to Prevent Future Fragmentation

### 1. Code Review Checklist:

- [ ] Does this create a new appointment storage system? **❌ REJECT**
- [ ] Does this use deprecated services? **❌ REJECT**
- [ ] Does this use `unifiedAppointmentService`? **✅ APPROVE**

### 2. Development Rules:

- **NEVER** create new appointment services
- **NEVER** create new storage keys for appointments
- **ALWAYS** use `unifiedAppointmentService`
- **ALWAYS** use `DoctorDashboardUnified`

### 3. File Naming Convention:

- Any new appointment-related files MUST include "Unified" in the name
- Any new files without "Unified" in appointment context should be rejected

---

## 🚨 Emergency Recovery

If you accidentally create fragmentation again:

1. **Stop immediately**
2. **Use the recovery tool**: `/Users/rakeshpatel/Desktop/tshla-medical/recover-appointments.html`
3. **Migrate to unified system**: Use `unifiedAppointmentService`
4. **Delete the new fragmented code**

---

## 📞 Contact

If you need to modify appointment functionality:

1. **Modify ONLY** `unifiedAppointment.service.ts`
2. **Modify ONLY** `DoctorDashboardUnified.tsx`
3. **Test thoroughly** before deploying
4. **Never** create parallel systems

---

**Last Updated**: September 16, 2025
**Status**: ACTIVE DEPRECATION NOTICE
**Enforcement**: MANDATORY
