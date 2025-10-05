# Pump Comparison Database - Setup & Usage Guide

**Created:** October 3, 2025
**Purpose:** Manage and utilize 23-dimension pump comparison data for AI-powered recommendations

---

## 📋 Overview

This system stores comprehensive pump comparison data (23 dimensions from "Pump data.pdf") in a MySQL database, making it:
- ✅ **Editable** through admin UI
- ✅ **AI-powered** - Claude analyzes structured data for recommendations
- ✅ **Non-hardcoded** - all pump data is database-driven
- ✅ **Scalable** - easy to add pumps, dimensions, or update contacts

---

## 🗄️ Database Tables

### 1. `pump_comparison_data`
Stores 23 dimensions with pump details for all 6 pumps.

**Columns:**
- `id` - Primary key
- `dimension_number` - 1-23
- `dimension_name` - e.g., "Battery life & power"
- `dimension_description` - Full explanation
- `importance_scale` - e.g., "1-10"
- `pump_details` - JSON with all 6 pumps' details
- `category` - e.g., "Power & Charging", "Controls & Interface"
- `display_order` - Sort order in UI
- `is_active` - Soft delete flag
- `created_at`, `updated_at` - Timestamps

### 2. `pump_manufacturers`
Stores manufacturer details and representative contacts.

**Columns:**
- `id` - Primary key
- `pump_name` - e.g., "Medtronic 780G"
- `manufacturer` - Company name
- `website` - URL
- `rep_name` - Sales rep name (e.g., "Bobby/Laura")
- `rep_contact` - Phone number
- `rep_email` - Email address
- `support_phone` - Customer support number
- `support_email` - Support email
- `notes` - Additional information
- `is_active` - Soft delete flag
- `created_at`, `updated_at` - Timestamps

### 3. `pump_comparison_changelog`
Audit trail for changes (future enhancement).

---

## 🚀 Setup Instructions

### Step 1: Create Database Tables

Run the SQL schema file:

```bash
# Navigate to server scripts
cd /Users/rakeshpatel/Desktop/tshla-medical/server/scripts

# Run SQL script on your database
mysql -u root -p tshla_medical_local < create-pump-comparison-tables.sql

# Or for production (Azure):
mysql -h tshla-mysql-prod.mysql.database.azure.com \
  -u tshlaadmin \
  -p'TshlaSecure2025!' \
  tshla_medical < create-pump-comparison-tables.sql
```

**What this creates:**
- 3 new tables
- Initial 6 pump manufacturers with contact info

### Step 2: Import 23 Dimensions Data

Run the Node.js migration script:

```bash
# Make sure you're in the server directory
cd /Users/rakeshpatel/Desktop/tshla-medical/server

# Set environment variables (local)
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=
export DB_DATABASE=tshla_medical_local

# Run the import script
node scripts/import-pump-comparison-data.js
```

**For Production:**

```bash
export DB_HOST=tshla-mysql-prod.mysql.database.azure.com
export DB_PORT=3306
export DB_USER=tshlaadmin
export DB_PASSWORD='TshlaSecure2025!'
export DB_DATABASE=tshla_medical
export DB_SSL=true

node scripts/import-pump-comparison-data.js
```

**Expected Output:**
```
Connecting to database...
✓ Connected to database
✓ Imported dimension #1: Battery life & power
✓ Imported dimension #2: Phone control & app
✓ Imported dimension #3: Tubing preference & wear style
...
✓ Imported dimension #23: Support apps & updates
✓ All 23 dimensions imported successfully!
Total dimensions: 23
✓ Database connection closed
```

### Step 3: Verify Data

Check that tables have data:

```bash
# Connect to MySQL
mysql -u root -p tshla_medical_local

# Check dimensions
SELECT dimension_number, dimension_name, category FROM pump_comparison_data ORDER BY dimension_number;

# Check manufacturers
SELECT pump_name, manufacturer, rep_name FROM pump_manufacturers;

# Exit
exit
```

---

## 🎨 Admin UI Access

### Accessing the Pump Comparison Manager

1. **Login as Admin:**
   - Go to: `https://www.tshla.ai/login`
   - Username: `rakesh`
   - Password: Your admin password

2. **Navigate to PumpDrive Dashboard:**
   - Go to: `https://www.tshla.ai/admin/pumpdrive-dashboard`
   - OR: `https://www.tshla.ai/admin/pumpdrive-users`

3. **Open Pump Comparison Database:**
   - Click the purple button: **"Pump Database (23 Dimensions)"**
   - OR: Go directly to: `https://www.tshla.ai/admin/pump-comparison`

### Admin UI Features

#### Tab 1: 23 Dimensions
- **View** all dimensions in a table
- **Expand** each dimension to see pump details for all 6 pumps
- **Edit** dimension name, description, category
- **Update** pump details (pros, cons, specifications)
- **Add** new dimensions
- **Delete** dimensions (soft delete)

#### Tab 2: Pump Details & Reps
- **View** all 6 pump manufacturers
- **Edit** pump names, manufacturer details
- **Update** representative contacts (name, phone, email)
- **Add** websites, support phone numbers
- **Copy** phone numbers and websites with one click

#### Tab 3: AI Prompt Settings
- View AI integration status
- See data statistics
- Configure AI prompt behavior (coming soon)

---

## 🤖 AI Integration

### How AI Uses This Data

The AI recommendation engine (`generatePumpRecommendations()` in `pump-report-api.js`) now:

1. **Fetches** all 23 dimensions from database
2. **Fetches** manufacturer contact information
3. **Formats** data into a comprehensive prompt
4. **Sends** to AWS Bedrock (Claude 3 Sonnet)
5. **Analyzes** patient preferences against ALL 23 dimensions
6. **Returns** evidence-based recommendations citing specific dimensions

### AI Prompt Structure

```
PATIENT PROFILE:
[User's sliders, free text, feature selections]

23-DIMENSION PUMP COMPARISON DATABASE:
Dimension #1: Battery life & power (Power & Charging)
Description: Battery strategy changes daily life...
  - Medtronic 780G: AA battery; swap anywhere
    Pros: No charging needed, Easy to find replacement batteries
    Cons: Need to carry spare batteries, Environmental waste
  - Tandem t:slim X2: Rechargeable; multi-day
    ...
[All 23 dimensions with details for all 6 pumps]

MANUFACTURER CONTACT INFORMATION:
Medtronic 780G (Medtronic)
  Website: https://www.medtronicdiabetes.com
  Representative: Bobby/Laura
  Support Phone: 1-800-646-4633
...

INSTRUCTIONS:
1. Analyze patient's preferences against ALL 23 dimensions
2. Consider which dimensions are most important
3. Weigh pros and cons for each pump
4. Provide evidence-based recommendations citing specific dimensions
```

### Fallback Behavior

If database fetch fails:
- ✅ AI still works - uses hardcoded pump database
- ⚠️ Log warning: "Database fetch failed - using fallback pump database"

If AWS Bedrock unavailable:
- ✅ System falls back to rule-based recommendations
- ⚠️ Only uses 4 pumps (no iLet, no Twiist)

---

## 📡 API Endpoints

### Pump Comparison Data

```bash
# Get all dimensions
GET /api/admin/pump-comparison-data
Headers: Authorization: Bearer <token>

# Get single dimension
GET /api/admin/pump-comparison-data/:id

# Create new dimension
POST /api/admin/pump-comparison-data
Body: {
  "dimension_number": 24,
  "dimension_name": "New Dimension",
  "dimension_description": "Description...",
  "pump_details": { "Medtronic 780G": {...}, ... },
  "category": "Category Name"
}

# Update dimension
PUT /api/admin/pump-comparison-data/:id
Body: { "dimension_name": "Updated Name", ... }

# Delete dimension (soft delete)
DELETE /api/admin/pump-comparison-data/:id
```

### Pump Manufacturers

```bash
# Get all manufacturers
GET /api/admin/pump-manufacturers

# Create new pump
POST /api/admin/pump-manufacturers
Body: {
  "pump_name": "New Pump",
  "manufacturer": "Company Name",
  "website": "https://...",
  "rep_name": "Rep Name",
  "rep_contact": "123-456-7890"
}

# Update pump/rep info
PUT /api/admin/pump-manufacturers/:id
Body: { "rep_contact": "Updated phone", ... }
```

---

## 🔧 Maintenance Tasks

### Adding a New Pump

1. **Add to `pump_manufacturers` table:**
   ```sql
   INSERT INTO pump_manufacturers (pump_name, manufacturer, website, rep_name, support_phone)
   VALUES ('New Pump', 'Company', 'https://...', 'Rep Name', '1-800-...');
   ```

2. **Update all 23 dimensions:**
   - Go to Admin UI → Pump Database → 23 Dimensions
   - Click each dimension → Edit
   - Add pump details for the new pump in `pump_details` JSON

3. **Test AI Recommendations:**
   - Run a test recommendation request
   - Verify new pump appears in results

### Updating Pump Details

**Option 1: Via Admin UI (Recommended)**
1. Login as admin
2. Go to Pump Comparison Database
3. Click on dimension to expand
4. Edit pump details
5. Save changes

**Option 2: Via SQL**
```sql
UPDATE pump_comparison_data
SET pump_details = JSON_SET(
  pump_details,
  '$.\"Medtronic 780G\".title',
  'Updated title'
)
WHERE dimension_number = 1;
```

### Updating Representative Contacts

**Option 1: Via Admin UI (Recommended)**
1. Login as admin
2. Go to Pump Comparison Database → Pump Details & Reps tab
3. Click edit icon next to pump
4. Update rep name, contact, email
5. Save changes

**Option 2: Via SQL**
```sql
UPDATE pump_manufacturers
SET rep_name = 'New Rep Name',
    rep_contact = '1-800-NEW-NUMBER'
WHERE pump_name = 'Medtronic 780G';
```

### Adding a New Dimension

**Via Admin UI:**
1. Go to Pump Comparison Database → 23 Dimensions tab
2. Click "Add New Dimension" button
3. Fill in:
   - Dimension number (e.g., 24)
   - Dimension name
   - Description
   - Category
   - Pump details for all 6 pumps
4. Save

**Via API:**
```bash
curl -X POST https://api.tshla.ai/api/admin/pump-comparison-data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dimension_number": 24,
    "dimension_name": "New Dimension",
    "dimension_description": "Description of new dimension",
    "category": "New Category",
    "pump_details": {
      "Medtronic 780G": {
        "title": "Feature title",
        "details": "Feature details",
        "pros": ["Pro 1", "Pro 2"],
        "cons": ["Con 1"]
      },
      ...
    }
  }'
```

---

## 🧪 Testing

### Test Database Setup

```bash
# Test table creation
mysql -u root -p tshla_medical_local -e "SHOW TABLES LIKE 'pump_%';"

# Expected output:
# pump_comparison_data
# pump_comparison_changelog
# pump_manufacturers
# pump_reports
# pump_users

# Test data import
mysql -u root -p tshla_medical_local -e "SELECT COUNT(*) FROM pump_comparison_data;"
# Expected: 23

mysql -u root -p tshla_medical_local -e "SELECT COUNT(*) FROM pump_manufacturers;"
# Expected: 6
```

### Test Admin UI

1. Navigate to `/admin/pump-comparison`
2. Verify **23 Dimensions** tab shows all dimensions
3. Click on a dimension → Should expand showing 6 pumps
4. Click **Pump Details & Reps** tab
5. Verify 6 manufacturers with contact info
6. Click edit icon → Make a change → Save
7. Refresh page → Verify change persisted

### Test AI Integration

1. **Check server logs** when making recommendation request:
   ```
   Using structured pump comparison data from database (23 dimensions)
   ```

2. **Verify recommendation** includes dimension citations:
   - Should reference specific dimensions (e.g., "Dimension #1: Battery life")
   - Should include manufacturer contact info

3. **Test fallback:**
   - Temporarily rename table: `RENAME TABLE pump_comparison_data TO pump_comparison_data_backup;`
   - Make recommendation request
   - Should see: "Database fetch failed - using fallback pump database"
   - Rename back: `RENAME TABLE pump_comparison_data_backup TO pump_comparison_data;`

---

## 📊 Data Structure Examples

### `pump_details` JSON Structure

```json
{
  "Medtronic 780G": {
    "title": "AA battery; swap anywhere",
    "details": "Lithium preferred. Easy to swap anytime, anywhere.",
    "pros": [
      "No charging needed",
      "Easy to find replacement batteries",
      "Great for travel"
    ],
    "cons": [
      "Need to carry spare batteries",
      "Environmental waste"
    ]
  },
  "Tandem t:slim X2": {
    "title": "Rechargeable; multi-day",
    "details": "Can last up to 3 weeks. Charges 1% per minute...",
    "pros": [...],
    "cons": [...]
  },
  ...
}
```

---

## 🔐 Security Notes

- ✅ All admin endpoints require JWT authentication
- ✅ Only users with `role: 'admin'` can access
- ✅ Soft deletes preserve data (set `is_active = false`)
- ✅ Audit trail table ready for future implementation

---

## 🚨 Troubleshooting

### Issue: "Failed to fetch pump comparison data"

**Check:**
1. Database connection: `mysql -u root -p tshla_medical_local`
2. Tables exist: `SHOW TABLES LIKE 'pump_%';`
3. Data exists: `SELECT COUNT(*) FROM pump_comparison_data;`

**Solution:**
```bash
# Re-run setup scripts
mysql -u root -p tshla_medical_local < server/scripts/create-pump-comparison-tables.sql
node server/scripts/import-pump-comparison-data.js
```

### Issue: "Dimension not found"

**Check:**
- Is `is_active = true`?
  ```sql
  SELECT id, dimension_number, dimension_name, is_active FROM pump_comparison_data;
  ```

**Solution:**
```sql
UPDATE pump_comparison_data SET is_active = true WHERE dimension_number = X;
```

### Issue: "Authentication required" when accessing admin endpoints

**Check:**
1. Token in localStorage: `localStorage.getItem('auth_token')`
2. Token not expired
3. User has admin role

**Solution:**
- Re-login at `/login`
- Ensure user in `pump_users` table has `role = 'admin'`

---

## 📈 Future Enhancements

### Planned Features
- [ ] Dimension importance weighting (user-configurable)
- [ ] A/B testing different dimension sets
- [ ] Audit trail UI (who changed what, when)
- [ ] Bulk import/export for dimensions
- [ ] Version control for pump data
- [ ] AI prompt customization interface

### Database Schema Improvements
- [ ] Add `dimension_weight` column for importance scoring
- [ ] Add `pump_comparison_versions` table for versioning
- [ ] Implement full audit trail in `pump_comparison_changelog`

---

## 📞 Support

For questions or issues:
- **Backend:** Check `server/pump-report-api.js` lines 2675-2850
- **Frontend:** Check `src/pages/admin/PumpComparisonManager.tsx`
- **Database:** Check `server/scripts/create-pump-comparison-tables.sql`

---

**Last Updated:** October 3, 2025
**Version:** 1.0
