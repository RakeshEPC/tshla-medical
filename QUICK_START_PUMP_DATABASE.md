# Quick Start: Pump Comparison Database

**⏱️ Time to deploy: 10-15 minutes**

---

## 🚀 Step 1: Create Database Tables (3 min)

### Local Development

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
mysql -u root -p tshla_medical_local < server/scripts/create-pump-comparison-tables.sql
```

### Production (Azure)

```bash
mysql -h tshla-mysql-prod.mysql.database.azure.com \
  -u tshlaadmin \
  -p'TshlaSecure2025!' \
  tshla_medical < server/scripts/create-pump-comparison-tables.sql
```

**Expected:** 3 tables created (`pump_comparison_data`, `pump_manufacturers`, `pump_comparison_changelog`)

---

## 📥 Step 2: Import 23 Dimensions (2 min)

### Local

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical/server

DB_HOST=localhost \
DB_USER=root \
DB_PASSWORD= \
DB_DATABASE=tshla_medical_local \
node scripts/import-pump-comparison-data.js
```

### Production

```bash
DB_HOST=tshla-mysql-prod.mysql.database.azure.com \
DB_USER=tshlaadmin \
DB_PASSWORD='TshlaSecure2025!' \
DB_DATABASE=tshla_medical \
DB_SSL=true \
node scripts/import-pump-comparison-data.js
```

**Expected:** `✓ All 23 dimensions imported successfully!`

---

## ✅ Step 3: Verify Data (1 min)

```bash
# Connect to database
mysql -u root -p tshla_medical_local

# Check data
SELECT COUNT(*) FROM pump_comparison_data;    # Should be 23
SELECT COUNT(*) FROM pump_manufacturers;       # Should be 6

# View dimensions
SELECT dimension_number, dimension_name, category FROM pump_comparison_data;

# Exit
exit
```

---

## 🔄 Step 4: Restart API Server (1 min)

```bash
# Using PM2
pm2 restart pump-report-api

# Or manually (local)
cd /Users/rakeshpatel/Desktop/tshla-medical/server
PORT=3002 node pump-report-api.js

# Production
./start-pump-api.sh
```

---

## 🏗️ Step 5: Build & Deploy Frontend (5 min)

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Build
npm run build

# Deploy (Azure)
./deploy-frontend.sh
```

---

## ✨ Step 6: Test Admin UI (2 min)

1. **Login:** `https://www.tshla.ai/login`
2. **Navigate:** `https://www.tshla.ai/admin/pumpdrive-dashboard`
3. **Click:** "Pump Database (23 Dimensions)" button
4. **Verify:**
   - ✅ See 23 dimensions
   - ✅ Click one → expands showing 6 pumps
   - ✅ Click "Pump Details & Reps" tab → see 6 manufacturers
   - ✅ Edit a rep's phone → saves successfully

---

## 🤖 Step 7: Test AI Integration (1 min)

1. Make a pump recommendation request (as logged-in user)
2. Check server logs for:
   ```
   Using structured pump comparison data from database (23 dimensions)
   ```
3. Verify recommendation cites specific dimensions

---

## 🎉 Done!

You now have:
- ✅ 23 dimensions stored in database
- ✅ 6 pump manufacturers with rep contacts
- ✅ Admin UI to edit everything
- ✅ AI using structured data for recommendations

---

## 📍 Important URLs

- **Admin Dashboard:** `https://www.tshla.ai/admin/pumpdrive-dashboard`
- **Pump Database:** `https://www.tshla.ai/admin/pump-comparison`
- **API Docs:** `https://api.tshla.ai/api/info`

---

## 🆘 Troubleshooting

**If tables don't create:**
```bash
# Check if you're in the right database
mysql -u root -p -e "SHOW DATABASES;"
```

**If import fails:**
```bash
# Check environment variables
echo $DB_HOST
echo $DB_DATABASE

# Re-export and try again
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=
export DB_DATABASE=tshla_medical_local
```

**If admin UI shows no data:**
- Check browser console for errors
- Verify you're logged in as admin
- Check API endpoint: `https://api.tshla.ai/api/admin/pump-comparison-data`

---

## 📚 Full Documentation

For detailed instructions, see:
- **Setup Guide:** [PUMP_COMPARISON_DATABASE_SETUP.md](PUMP_COMPARISON_DATABASE_SETUP.md)
- **Implementation Summary:** [PUMP_DATABASE_IMPLEMENTATION_SUMMARY.md](PUMP_DATABASE_IMPLEMENTATION_SUMMARY.md)

---

**Last Updated:** October 3, 2025
