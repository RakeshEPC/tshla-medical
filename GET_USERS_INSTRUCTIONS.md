# How to Get All PumpDrive Users Data

**Problem**: Your local machine's IP is not whitelisted in Azure MySQL firewall, so we can't query directly.

**Solution**: Use one of these 3 methods below.

---

## Method 1: Azure Portal Query Editor (EASIEST) ✅

### Steps:

1. **Go to Azure Portal**: https://portal.azure.com

2. **Navigate to your MySQL database**:
   - Search for "tshla-mysql-prod" in the top search bar
   - OR: Resource Groups → `tshla-data-rg` → `tshla-mysql-prod`

3. **Open Query Editor**:
   - Left sidebar → Click **"Query editor (preview)"**
   - If you don't see it: Click "..." (More) → "Networking" → Enable "Allow public access"

4. **Login**:
   - Server: `tshla-mysql-prod.mysql.database.azure.com`
   - Username: `tshlaadmin`
   - Password: `TshlaSecure2025!`
   - Database: `tshla_medical`
   - Click **OK**

5. **Run this SQL query**:

```sql
-- Get all users with their pump selections
SELECT
  u.id,
  u.username,
  u.email,
  u.first_name,
  u.last_name,
  u.phone_number,
  u.created_at,
  u.has_paid,
  u.payment_amount_cents,
  a.pump_name as primary_pump,
  a.pump_manufacturer as primary_manufacturer,
  ROUND(a.confidence_score, 0) as primary_confidence,
  a.secondary_recommendation as secondary_pump,
  a.secondary_manufacturer,
  ROUND(a.secondary_confidence, 0) as secondary_confidence,
  a.created_at as assessment_date
FROM pump_users u
LEFT JOIN pump_assessments a ON u.id = a.user_id
ORDER BY u.created_at DESC;
```

6. **Export Results**:
   - Click the **Download** button (top right of results)
   - Choose CSV or JSON format

---

## Method 2: Get CSV Format (For Excel/Sheets)

Run this query in Azure Portal Query Editor:

```sql
-- CSV-friendly format
SELECT
  u.email as 'Email',
  u.username as 'Username',
  CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as 'Full Name',
  u.phone_number as 'Phone',
  CONCAT(COALESCE(a.pump_manufacturer, ''), ' ', COALESCE(a.pump_name, '')) as 'Primary Pump',
  CONCAT(ROUND(COALESCE(a.confidence_score, 0)), '%') as 'Primary Confidence',
  CONCAT(COALESCE(a.secondary_manufacturer, ''), ' ', COALESCE(a.secondary_recommendation, '')) as 'Secondary Pump',
  CONCAT(ROUND(COALESCE(a.secondary_confidence, 0)), '%') as 'Secondary Confidence',
  IF(u.has_paid, 'YES', 'NO') as 'Paid Status',
  DATE_FORMAT(u.created_at, '%Y-%m-%d') as 'Created Date'
FROM pump_users u
LEFT JOIN pump_assessments a ON u.id = a.user_id
ORDER BY u.created_at DESC;
```

---

## Method 3: Azure Cloud Shell (Alternative)

If Query Editor doesn't work:

1. **Open Cloud Shell** in Azure Portal (click `>_` icon at top)

2. **Choose Bash**

3. **Run**:

```bash
mysql -h tshla-mysql-prod.mysql.database.azure.com \
      -u tshlaadmin \
      -p'TshlaSecure2025!' \
      -D tshla_medical \
      --ssl-mode=REQUIRED \
      -e "SELECT u.id, u.username, u.email, u.first_name, u.last_name, a.pump_name as primary_pump, a.secondary_recommendation as secondary_pump FROM pump_users u LEFT JOIN pump_assessments a ON u.id = a.user_id ORDER BY u.created_at DESC;"
```

---

## Method 4: Add Your IP to Firewall (For Future Access)

To connect from your local machine:

1. **Azure Portal** → `tshla-mysql-prod` → **Networking**

2. **Firewall Rules** section:
   - Click **"Add current client IP address"**
   - Rule name: `YourName-LocalMachine`
   - Click **Save**

3. **Wait 30 seconds**, then retry the local scripts:

```bash
cd ~/Desktop/tshla-medical
node server/get-all-users-admin.cjs
```

---

## About Passwords ⚠️

**Important**:
- Passwords are stored as **bcrypt hashes** and **CANNOT be reversed**
- You cannot see the original passwords
- Password hashes look like: `$2a$10$xyz...` (60 characters)

**To access an account**:
1. Have the user use "Forgot Password" to reset
2. OR: Create a new admin account with known credentials

**Sample query to see password hashes** (for debugging):
```sql
SELECT email, username, SUBSTRING(password_hash, 1, 30) as hash_sample
FROM pump_users
LIMIT 5;
```

---

## Expected Data Structure

### Users Table Columns:
- `id` - User ID
- `username` - Username
- `email` - Email address
- `first_name` - First name
- `last_name` - Last name
- `phone_number` - Phone number
- `password_hash` - Bcrypt hashed password (unreadable)
- `has_paid` - Whether user has paid (1 = Yes, 0 = No)
- `payment_amount_cents` - Amount paid in cents (999 = $9.99)
- `created_at` - Account creation date

### Pump Assessments Table Columns:
- `pump_name` - Primary pump recommendation (e.g., "t:slim X2")
- `pump_manufacturer` - Manufacturer (e.g., "Tandem")
- `confidence_score` - AI confidence % (e.g., 85)
- `secondary_recommendation` - Secondary pump choice
- `secondary_manufacturer` - Secondary manufacturer
- `secondary_confidence` - Secondary confidence %

---

## Quick Check: How Many Users?

Run this simple query first:

```sql
SELECT COUNT(*) as total_users FROM pump_users;
```

---

## Troubleshooting

### "Can't connect to MySQL server"
→ Your IP needs to be whitelisted (Method 4 above)

### "Query editor not available"
→ Use Azure Cloud Shell (Method 3)

### "Access denied"
→ Check username/password are correct

### "Table doesn't exist"
→ Make sure you selected database `tshla_medical`

---

## Files Created

I've created these helper scripts for you:

1. **`get-users-api.js`** - Instructions and queries
2. **`server/get-all-users-admin.cjs`** - Node.js script (requires whitelisted IP)
3. **`GET_USERS_INSTRUCTIONS.md`** - This file

---

**Recommended**: Use **Method 1 (Azure Portal Query Editor)** - it's the fastest and doesn't require any setup!

Let me know if you need help with any of these methods.
