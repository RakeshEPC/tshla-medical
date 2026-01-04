# Supabase Backup Setup - Step-by-Step Guide

**Date:** January 4, 2026
**Project:** TSHLA Medical
**Database:** minvvjdflezibmgkplqb
**Retention:** 7 days (per budget constraints)

---

## 📋 Quick Setup Instructions

### **Step 1: Access Supabase Dashboard**

1. Open browser and go to: https://supabase.com/dashboard
2. Login with your credentials
3. Select project: **minvvjdflezibmgkplqb**

---

### **Step 2: Navigate to Backup Settings**

1. Click **Settings** in the left sidebar (gear icon)
2. Click **Database** tab
3. Scroll down to **Backups** section

---

### **Step 3: Enable Automated Backups**

You have two options:

#### **Option A: Point-in-Time Recovery (PITR) - Recommended**
- **Cost:** ~$0.125/GB/month
- **Retention:** 7 days
- **Benefits:**
  - Restore to ANY point in time within 7 days
  - Continuous backup (not just daily snapshots)
  - Better for HIPAA compliance

**To Enable:**
1. Click "Enable Point-in-Time Recovery"
2. Confirm the upgrade
3. Wait 2-5 minutes for activation

#### **Option B: Daily Snapshots - Budget Option**
- **Cost:** Free on Pro plan
- **Retention:** 7 days
- **Benefits:**
  - Daily automatic backups
  - Good enough for basic disaster recovery

**To Enable:**
1. Toggle "Enable Daily Backups"
2. Set retention to 7 days
3. Set backup time to 2:00 AM (clinic closed)

---

### **Step 4: Verify Backup Is Working**

**After 24 hours:**
1. Go back to Settings → Database → Backups
2. You should see at least 1 backup listed
3. Click "Restore" on any backup to test (DON'T actually restore, just verify the option exists)

---

## 🚨 Why This Matters for HIPAA

**HIPAA requires:**
- ✅ Regular backups of ePHI (electronic Protected Health Information)
- ✅ Ability to restore data in case of system failure
- ✅ Documented backup procedures
- ✅ Testing of restore capability

**With 7-day retention:**
- You can recover from accidental deletions
- You can restore if database gets corrupted
- You have a recovery point for ransomware attacks
- You meet minimum HIPAA backup requirements

---

## 💰 Cost Breakdown

### **Current Plan: Free Tier**
- ❌ No automated backups
- ❌ No BAA available
- ❌ Not HIPAA compliant

### **Recommended: Pro Plan ($25/month)**
- ✅ Daily automated backups (included)
- ✅ Point-in-Time Recovery available (~$0.125/GB extra)
- ✅ BAA eligible
- ✅ 7-day retention
- ✅ 8GB database included
- ✅ Priority support

**Your estimated database size:** ~500MB
**PITR cost:** $0.125/GB × 0.5GB = ~$0.06/month (negligible)

**Total estimated monthly cost:** $25.06/month

---

## 📝 Backup Testing Procedure

**Do this quarterly (every 3 months):**

1. **Create Test Database:**
   - Settings → Database → Create database clone

2. **Restore from Backup:**
   - Select a recent backup
   - Restore to the test database
   - Verify data integrity

3. **Test Critical Queries:**
   ```sql
   -- Count patients
   SELECT COUNT(*) FROM patients;

   -- Verify recent dictations
   SELECT * FROM dictations ORDER BY created_at DESC LIMIT 10;

   -- Check appointments
   SELECT * FROM appointments WHERE scheduled_date >= CURRENT_DATE;
   ```

4. **Document Test:**
   - Date of test
   - Backup used
   - Result (pass/fail)
   - Any issues found

5. **Delete Test Database:**
   - Don't leave clones around (they count toward storage)

---

## 🔧 Backup Restoration (Emergency Procedure)

**IF YOU NEED TO RESTORE:**

1. **STOP ALL SERVICES IMMEDIATELY:**
   ```bash
   # Stop unified API
   pm2 stop all

   # Stop frontend
   # (shut down Vite dev server or Azure deployment)
   ```

2. **Go to Supabase Dashboard:**
   - Settings → Database → Backups
   - Select the backup point BEFORE the problem occurred
   - Click "Restore"

3. **Choose Restore Method:**
   - **Full Restore:** Replaces entire database (use for corruption)
   - **Clone & Switch:** Creates new database (safer, can compare)

4. **Wait for Restore to Complete:**
   - Usually takes 5-15 minutes
   - You'll get email notification when done

5. **Verify Data:**
   - Check critical tables
   - Verify recent data is present
   - Test login and basic functions

6. **Restart Services:**
   ```bash
   pm2 restart all
   ```

7. **Document Incident:**
   - What caused the restore?
   - What backup point was used?
   - What data was lost (time between backup and restore)?
   - How to prevent in future?

---

## ⚠️ Important Notes

### **Data Between Backups:**
- **Daily backups:** Up to 24 hours of data could be lost
- **PITR:** Only minutes of data lost (recommended!)

### **Backup Size:**
As your database grows:
- More patients = larger backups
- More dictations = larger backups
- Monitor storage usage in dashboard

### **Retention Policy:**
With 7-day retention:
- You can recover data from last week
- Older data is permanently deleted after 7 days
- If you need longer retention, upgrade later

---

## ✅ Completion Checklist

- [ ] Logged into Supabase dashboard
- [ ] Upgraded to Pro plan ($25/month)
- [ ] Enabled 7-day backups
- [ ] Verified backup schedule is set
- [ ] Tested restore procedure (optional but recommended)
- [ ] Documented backup configuration
- [ ] Set calendar reminder for quarterly backup testing

---

## 📞 Support

**If you have issues:**

1. **Supabase Support:**
   - Email: support@supabase.io
   - Dashboard: Click "Support" in bottom-left corner
   - Response time: Usually within 24 hours on Pro plan

2. **Your DBA (if applicable):**
   - Forward this document to them
   - They should handle testing and monitoring

3. **Emergency Contact:**
   - Keep Supabase support email handy
   - Have this document accessible offline (print or save PDF)

---

**Remember:** Backups are only useful if you test them regularly!

Set a quarterly reminder to test your restore procedure.
