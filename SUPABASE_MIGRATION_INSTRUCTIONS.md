# Supabase Migration Instructions

## 🎯 Goal
Migrate all data from MySQL to Supabase and remove MySQL dependency entirely.

---

## Step 1: Run SQL Scripts in Supabase (5 minutes)

### 1.1 Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: `minvvjdflezibmgkplqb`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### 1.2 Run Pump Comparison Migration
1. Copy **ALL contents** from: `supabase-pump-comparison-migration.sql`
2. Paste into the SQL Editor
3. Click **Run** (or press Cmd/Ctrl + Enter)
4. ✅ You should see: "Pump comparison tables created successfully!"

### 1.3 Run Patient Data Migration
1. Click **New Query** again
2. Copy **ALL contents** from: `supabase-patient-data-migration.sql`
3. Paste into the SQL Editor
4. Click **Run**
5. ✅ You should see: "Patient data migration schema created successfully!"

---

## Step 2: Import 23 Dimensions Data (Next)

After running the SQL scripts, we'll import the actual 23 dimensions pump comparison data from the import script.

---

## What Gets Created

### Pump Comparison Tables
- ✅ `pump_comparison_data` - 23 dimensions for AI recommendations
- ✅ `pump_manufacturers` - 6 pump manufacturers with rep contacts
- ✅ `pump_comparison_changelog` - Audit trail for changes

### Patient Data Tables
- ✅ `patients` - Core patient records
- ✅ `patient_conditions` - Diagnoses and conditions
- ✅ `patient_medications` - Medication history
- ✅ `patient_labs` - Lab results
- ✅ `patient_visits` - Visit notes and SOAP notes
- ✅ `schedule_slots` - Daily appointment schedules
- ✅ `disease_progression` - Trend tracking (A1C, etc.)
- ✅ `emr_imports` - EMR data imports
- ✅ `templates` - SOAP note templates

### Security Features
- ✅ **Row Level Security (RLS)** enabled on ALL tables
- ✅ Medical staff can only access authorized data
- ✅ Admins have full access
- ✅ Public can view pump comparison data (non-PHI)
- ✅ All changes auto-logged with timestamps

---

## After Migration

### ✅ Benefits
- **No more database passwords**
- **$0/month** (vs $50-100/month for Azure MySQL)
- **Better security** - JWT tokens only
- **HIPAA compliant** - Built-in audit logs
- **Easier deployment** - No database server to manage

### ❌ MySQL Can Be Removed
After this migration:
- Backend API will use Supabase
- Frontend will use Supabase
- MySQL database can be deleted
- Azure MySQL service can be cancelled

---

## 🚀 Ready?

**Run the two SQL scripts in Supabase, then let me know when done!**

I'll help import the 23 dimensions data next.
