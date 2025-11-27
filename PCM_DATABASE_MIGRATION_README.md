# PCM Database Migration Guide
## From localStorage to Supabase

**Created**: January 26, 2025
**Status**: ✅ Ready for Implementation
**Estimated Time**: 2-4 hours for deployment

---

## 📋 What This Migration Does

This migration moves all PCM (Principal Care Management) data from browser `localStorage` to a robust Supabase PostgreSQL database. This eliminates data loss, enables real-time updates, and provides proper data integrity.

### **Before Migration**
- ❌ Data stored in browser localStorage (cleared on logout/incognito)
- ❌ No real-time updates
- ❌ No data backup
- ❌ No HIPAA audit trail
- ❌ Can't query or aggregate data across patients

### **After Migration**
- ✅ Data stored in Supabase PostgreSQL (persistent, backed up)
- ✅ Real-time subscriptions for urgent alerts
- ✅ Automatic data backups
- ✅ Full HIPAA audit trail with RLS policies
- ✅ Advanced queries and analytics
- ✅ Risk scoring calculated automatically

---

## 📁 Files Created

### **1. Database Schema**
- **File**: `src/lib/db/migrations/004_pcm_tables.sql` (400 lines)
- **Creates**: 7 new database tables with indexes, RLS policies, and triggers
- **Tables**:
  - `pcm_enrollments` - Patient enrollment in PCM program
  - `pcm_contacts` - Staff-patient contact log
  - `pcm_vitals` - Patient vital signs tracking
  - `pcm_tasks` - Patient care tasks/action items
  - `pcm_time_entries` - Staff time tracking for billing
  - `pcm_lab_orders` - Lab order management
  - `pcm_goals` - Patient health goals

### **2. TypeScript Types**
- **File**: `src/types/pcm.database.types.ts` (600 lines)
- **Exports**: 40+ TypeScript interfaces
- **Includes**: Input types, filters, aggregates, realtime events

### **3. Database Service**
- **File**: `src/services/pcmDatabase.service.ts` (850 lines)
- **Replaces**: `src/services/pcm.service.ts` (localStorage-based)
- **Methods**: 60+ Supabase-backed CRUD operations
- **Features**: Real-time subscriptions, auto risk scoring, lab extraction

### **4. Migration Script**
- **File**: `src/scripts/migrate-pcm-data.ts` (300 lines)
- **Purpose**: One-time migration of existing localStorage data
- **Safety**: Creates backup before migrating

### **5. React Hooks**
- **Files**:
  - `src/hooks/usePCMEnrollment.ts` - Enrollment management
  - `src/hooks/usePCMVitals.ts` - Vitals tracking with trends
  - `src/hooks/usePCMRealtime.ts` - Real-time subscriptions
  - `src/hooks/usePCMLabs.ts` - Lab order management

---

## 🚀 Deployment Steps

### **STEP 1: Run Database Migration** (5 minutes)

1. **Open Supabase Dashboard**
   ```
   https://app.supabase.com/project/YOUR_PROJECT_ID/editor
   ```

2. **Go to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "+ New Query"

3. **Copy and Paste Migration SQL**
   ```bash
   cat src/lib/db/migrations/004_pcm_tables.sql
   ```
   - Copy entire contents
   - Paste into Supabase SQL editor
   - Click "Run" button

4. **Verify Tables Created**
   - Go to "Table Editor" in left sidebar
   - You should see 7 new tables starting with `pcm_`

---

### **STEP 2: Test Database Connection** (2 minutes)

```bash
# In your terminal, verify Supabase env vars are set
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# If empty, add to .env file:
# VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
# VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

### **STEP 3: Run Data Migration** (10-30 minutes depending on data)

**⚠️ IMPORTANT: This script runs in the BROWSER, not server!**

1. **Option A: Run via Browser Console (Recommended)**
   ```javascript
   // 1. Open your app in browser
   // 2. Open DevTools Console (F12)
   // 3. Navigate to a page that loads PCM data
   // 4. Paste this code:

   import('./src/scripts/migrate-pcm-data.ts').then(module => {
     const migration = new module.PCMDataMigration();
     migration.migrate().then(result => {
       console.log('Migration result:', result);
     });
   });
   ```

2. **Option B: Temporary Migration Page**
   - Create a temporary route `/migrate-pcm` in your app
   - Add a button that calls the migration script
   - Navigate to the page and click the button
   - Monitor console for progress

3. **Option C: Node.js Script** (Requires tsconfig changes)
   ```bash
   npx tsx src/scripts/migrate-pcm-data.ts
   ```

**What the Migration Does:**
1. Backs up all localStorage data with timestamp
2. Extracts patients, vitals, tasks, time entries
3. Transforms data to new database schema
4. Batch inserts into Supabase
5. Verifies migration completed
6. Shows summary table

**Expected Output:**
```
🚀 Starting PCM data migration from localStorage to Supabase...

📦 Step 1: Backing up localStorage data...
✅ Backup created: pcm_backup_1706234567890

📊 Step 2: Extracting data from localStorage...
   Found 15 patients
   Found 450 vital readings
   Found 75 tasks
   Found 128 time entries

🔗 Step 3: Verifying Supabase connection...
✅ Supabase connection verified

👥 Step 4: Migrating patient enrollments...
   ✅ 15/15 enrollments migrated

💓 Step 5: Migrating vital signs...
   ✅ 450/450 vitals migrated

📋 Step 6: Migrating tasks...
   ✅ 75/75 tasks migrated

⏱️  Step 7: Migrating time entries...
   ✅ 128/128 time entries migrated

🔍 Step 8: Verifying migration...
   Database enrollments: 15
   Database vitals: 450
   Database tasks: 75
   Database time entries: 128

✨ Migration Complete!
```

---

### **STEP 4: Verify Migration in Supabase** (5 minutes)

1. **Check Table Counts**
   ```sql
   SELECT COUNT(*) FROM pcm_enrollments;
   SELECT COUNT(*) FROM pcm_vitals;
   SELECT COUNT(*) FROM pcm_tasks;
   SELECT COUNT(*) FROM pcm_time_entries;
   ```

2. **Spot Check Data**
   ```sql
   -- View first enrollment
   SELECT * FROM pcm_enrollments LIMIT 1;

   -- Check risk scores were calculated
   SELECT patient_id, risk_level, risk_score
   FROM pcm_enrollments
   ORDER BY risk_score DESC;

   -- Verify vitals have abnormal flags
   SELECT COUNT(*) FROM pcm_vitals WHERE is_abnormal = true;
   ```

3. **Test RLS Policies**
   - Log in as a staff member
   - Verify you can see PCM data
   - Log out and verify you can't access without auth

---

### **STEP 5: Update Components** (30 minutes)

Now update your React components to use the new hooks:

#### **Example: Update PCMProviderDashboard.tsx**

**BEFORE:**
```typescript
import { pcmService } from '../services/pcm.service';

const [patients, setPatients] = useState([]);

useEffect(() => {
  const loadPatients = async () => {
    const data = await pcmService.getPCMPatients();
    setPatients(data);
  };
  loadPatients();
}, []);
```

**AFTER:**
```typescript
import { usePCMEnrollment } from '../hooks/usePCMEnrollment';

const { enrollments, isLoading, error } = usePCMEnrollment({
  filters: { is_active: true },
  autoLoad: true
});

// enrollments now auto-loads and updates!
```

#### **Example: Record Vitals**

**BEFORE:**
```typescript
import { pcmService } from '../services/pcm.service';

const handleSubmit = async () => {
  await pcmService.logVitals(patientId, {
    bloodSugar: 120,
    weight: 175
  });
};
```

**AFTER:**
```typescript
import { usePCMVitals } from '../hooks/usePCMVitals';

const { recordVitals, vitals, refresh } = usePCMVitals({
  patientId,
  autoLoad: true
});

const handleSubmit = async () => {
  await recordVitals({
    recorded_by: 'patient',
    blood_sugar: 120,
    weight: 175,
    weight_unit: 'lbs'
  });
  // vitals list automatically refreshes!
};
```

#### **Example: Real-time Alerts**

**NEW FEATURE:**
```typescript
import { usePCMRealtime } from '../hooks/usePCMRealtime';
import toast from 'react-hot-toast';

const { isConnected } = usePCMRealtime({
  onAbnormalVital: (vital) => {
    toast.error(`⚠️ Abnormal vital for ${vital.patient_id}`);
  },
  onUrgentLab: (lab) => {
    toast.error(`🚨 ${lab.priority.toUpperCase()} lab ordered`);
  },
  enabled: true
});
```

---

### **STEP 6: Testing** (30 minutes)

1. **Test Enrollment**
   - Navigate to PCM enrollment page
   - Enroll a test patient
   - Verify data appears in Supabase

2. **Test Vitals Recording**
   - Record some vitals for the test patient
   - Check abnormal detection works
   - View vital trends chart

3. **Test Lab Orders**
   - Create a lab order manually
   - Create labs via dictation (auto-extraction)
   - Verify AI-extracted orders require verification

4. **Test Real-time Updates**
   - Open app in two browser tabs
   - Create a STAT lab order in tab 1
   - Verify alert appears in tab 2

5. **Test Time Tracking**
   - Start a time entry
   - Stop it after a few minutes
   - Verify duration calculated correctly

---

## 🔄 Rollback Plan

If something goes wrong, you can rollback:

### **Option 1: Restore from Backup**
```javascript
// In browser console
const backupKey = 'pcm_backup_1706234567890'; // Your backup key
const backup = JSON.parse(localStorage.getItem(backupKey));

// Restore each key
Object.entries(backup).forEach(([key, value]) => {
  localStorage.setItem(key, value);
});

console.log('✅ Backup restored');
```

### **Option 2: Drop Tables and Revert Code**
```sql
-- In Supabase SQL editor
DROP TABLE IF EXISTS pcm_goals CASCADE;
DROP TABLE IF EXISTS pcm_lab_orders CASCADE;
DROP TABLE IF EXISTS pcm_time_entries CASCADE;
DROP TABLE IF EXISTS pcm_tasks CASCADE;
DROP TABLE IF EXISTS pcm_vitals CASCADE;
DROP TABLE IF EXISTS pcm_contacts CASCADE;
DROP TABLE IF EXISTS pcm_enrollments CASCADE;
```

Then revert your component changes to use the old `pcm.service.ts`.

---

## 📊 Key Improvements

| Feature | Before (localStorage) | After (Supabase) |
|---------|----------------------|------------------|
| **Data Persistence** | ❌ Cleared on logout | ✅ Permanent |
| **Real-time Updates** | ❌ None | ✅ Live subscriptions |
| **Risk Scoring** | ❌ Manual | ✅ Auto-calculated |
| **Data Backup** | ❌ None | ✅ Automatic |
| **Multi-device** | ❌ Single browser | ✅ Anywhere |
| **Audit Trail** | ❌ None | ✅ Full HIPAA compliance |
| **Query Performance** | ❌ Slow (client-side) | ✅ Fast (indexed DB) |
| **Abnormal Detection** | ❌ Manual | ✅ Automatic flags |
| **Lab Extraction** | ⚠️ Partially working | ✅ Fully integrated |

---

## 🐛 Troubleshooting

### **Migration Script Errors**

**Error: "Supabase connection failed"**
- Check `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Verify Supabase project is running
- Check network connection

**Error: "Patient not found"**
- Migration creates new patient records if needed
- This is normal, check Supabase `patients` table

**Error: "RLS policy violation"**
- Make sure you're logged in as a staff member
- Check RLS policies are created (step 1)
- Verify your auth user ID exists in `medical_staff` table

### **Component Not Loading Data**

**Symptoms**: Hook returns empty array
- Check browser console for errors
- Verify Supabase connection (check Network tab)
- Ensure RLS policies allow access
- Try: `localStorage.clear()` to clear old data

**Symptoms**: "Enrollment not found"
- Patient needs to be enrolled first
- Call `enrollPatient()` or manually insert enrollment

### **Real-time Not Working**

**Symptoms**: No alerts on urgent events
- Verify Supabase Realtime is enabled in project settings
- Check browser console for Realtime connection status
- Ensure callback functions are provided to hook

---

## 📝 Next Steps After Migration

1. **Remove Old Service** (Optional)
   - Mark `src/services/pcm.service.ts` as deprecated
   - Add migration note at top of file
   - Keep file for reference for 1 month, then delete

2. **Monitor Performance**
   - Check Supabase dashboard for query performance
   - Monitor RLS policy execution time
   - Add indexes if queries are slow

3. **Enable Scheduled Backups**
   - Configure Supabase automatic backups (Settings → Database → Backups)
   - Set to daily backups with 7-day retention

4. **Set Up Alerts**
   - Configure email alerts for abnormal vitals
   - Set up SMS for STAT lab orders
   - Create Slack integration for urgent tasks

5. **Clear Old localStorage** (After 1 week of testing)
   ```javascript
   // Only after confirming migration successful!
   Object.keys(localStorage).forEach(key => {
     if (key.startsWith('pcm_') && !key.startsWith('pcm_backup_')) {
       localStorage.removeItem(key);
     }
   });
   ```

---

## 💡 Pro Tips

1. **Batch Operations**: Use batch inserts for better performance
2. **Realtime Optimization**: Only subscribe to channels you need
3. **Query Optimization**: Use filters in hooks to reduce data fetched
4. **Error Handling**: All hooks include `error` state - display to users
5. **Loading States**: Use `isLoading` to show spinners during operations

---

## 📚 Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **RLS Policies**: https://supabase.com/docs/guides/auth/row-level-security
- **Realtime**: https://supabase.com/docs/guides/realtime
- **Database Triggers**: https://supabase.com/docs/guides/database/functions

---

## ✅ Success Criteria

Migration is successful when:
- [ ] All tables created in Supabase
- [ ] Migration script runs without errors
- [ ] Data counts match (localStorage vs Supabase)
- [ ] Components load data correctly
- [ ] Real-time alerts work
- [ ] No console errors
- [ ] Performance is equal or better than before

---

## 🎉 You're Done!

Your PCM system is now backed by a robust, HIPAA-compliant database with real-time capabilities. Data will never be lost again, and you have a full audit trail for compliance.

**Questions?** Check the troubleshooting section or review the code comments in:
- `src/services/pcmDatabase.service.ts` - Full method documentation
- `src/types/pcm.database.types.ts` - Type definitions
- `src/hooks/usePCM*.ts` - Hook usage examples
