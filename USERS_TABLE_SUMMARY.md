# PumpDrive Users Database - Access Summary

**Date**: October 2, 2025
**Database**: tshla-mysql-prod.mysql.database.azure.com
**Status**: ✅ Running and Healthy

---

## Current Situation

I've successfully:
- ✅ Whitelisted your IP (73.206.37.209) in Azure MySQL firewall
- ✅ Confirmed database is running and healthy
- ✅ Confirmed the Pump API is connected to the database

However, there's an **authentication issue** with the password or user permissions.

---

## FASTEST WAY TO GET YOUR DATA (2 minutes)

### Option 1: Azure Portal (RECOMMENDED - NO PASSWORD NEEDED)

1. **Go to**: https://portal.azure.com
2. **Search**: "tshla-mysql-prod"
3. **Click**: "Query editor (preview)" in left sidebar
4. **Login** with Azure AD (no password needed if you're logged into portal)
5. **Paste this query**:

\`\`\`sql
SELECT
  u.id,
  u.username,
  u.email,
  CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as full_name,
  u.phone_number,
  CONCAT(COALESCE(a.pump_manufacturer, ''), ' ', COALESCE(a.pump_name, '')) as primary_pump,
  CONCAT(ROUND(COALESCE(a.confidence_score, 0)), '%') as confidence,
  CONCAT(COALESCE(a.secondary_manufacturer, ''), ' ', COALESCE(a.secondary_recommendation, '')) as secondary_pump,
  IF(u.has_paid, 'YES', 'NO') as paid,
  DATE_FORMAT(u.created_at, '%Y-%m-%d') as created_date
FROM pump_users u
LEFT JOIN pump_assessments a ON u.id = a.user_id
ORDER BY u.created_at DESC;
\`\`\`

6. **Click Download** → Choose **CSV** or **JSON**

---

## Option 2: Azure Cloud Shell

1. In Azure Portal, click the **Cloud Shell** icon (>_) at the top
2. Choose **Bash**
3. **Paste and run**:

\`\`\`bash
mysql -h tshla-mysql-prod.mysql.database.azure.com \\
      -u tshlaadmin \\
      -D tshla_medical \\
      --ssl-mode=REQUIRED \\
      --password \\
      -e "SELECT u.id, u.username, u.email, CONCAT(u.first_name, ' ', u.last_name) as name, CONCAT(a.pump_manufacturer, ' ', a.pump_name) as primary_pump, a.secondary_recommendation as secondary_pump, IF(u.has_paid, 'YES', 'NO') as paid FROM pump_users u LEFT JOIN pump_assessments a ON u.id = a.user_id ORDER BY u.created_at DESC;"
\`\`\`

4. When prompted for password, enter: `TshlaSecure2025!`

---

## What I've Prepared For You

### Files Created:
1. **GET_USERS_INSTRUCTIONS.md** - Full step-by-step guide
2. **server/get-all-users-admin.cjs** - Node.js script (for local use after fixing auth)
3. **query-via-api.sh** - Cloud Shell command generator
4. **/tmp/query_users.sql** - Ready-to-use SQL query

### Network Access:
- ✅ Your IP (73.206.37.209) is now whitelisted
- ✅ Firewall rule created: "TempAccess-20251002"

---

## Troubleshooting Authentication

The password `TshlaSecure2025!` might need to be reset or updated. To fix:

### Reset MySQL Admin Password:
\`\`\`bash
az mysql flexible-server update \\
  --resource-group tshla-data-rg \\
  --name tshla-mysql-prod \\
  --admin-password "NewSecurePassword2025!"
\`\`\`

Then update in:
- `server/.env`: AZURE_MYSQL_PASSWORD=NewSecurePassword2025!
- Container App environment variables

---

## Database Schema

### Tables:
1. **pump_users** - User accounts
   - id, username, email, first_name, last_name
   - phone_number, password_hash (bcrypt)
   - has_paid, payment_amount_cents
   - created_at, updated_at

2. **pump_assessments** - Pump recommendations
   - id, user_id (FK to pump_users)
   - pump_name, pump_manufacturer, confidence_score
   - secondary_recommendation, secondary_manufacturer, secondary_confidence
   - created_at

---

## Expected Data Format

| Column | Example | Description |
|--------|---------|-------------|
| id | 1 | User ID |
| username | johndoe | Username |
| email | john@example.com | Email address |
| full_name | John Doe | First + Last name |
| phone_number | 555-0100 | Phone number |
| primary_pump | Tandem t:slim X2 | Primary recommendation |
| confidence | 85% | AI confidence score |
| secondary_pump | Medtronic 780G | Secondary choice |
| paid | YES/NO | Payment status |
| created_date | 2025-10-01 | Account creation |

---

## Security Notes

⚠️ **Passwords**:
- Stored as bcrypt hashes (cannot be reversed)
- To access accounts, users must reset via "Forgot Password"
- Sample hash: `$2a$10$xyz...abc123` (60 chars)

⚠️ **Access Logs**:
- The `access_logs` table tracks user purchases and access events
- Query: `SELECT * FROM access_logs ORDER BY created_at DESC;`

---

## Quick Status Check

Run this to see how many users you have:

\`\`\`sql
SELECT
  COUNT(*) as total_users,
  SUM(IF(has_paid, 1, 0)) as paid_users,
  SUM(IF(has_paid, 0, 1)) as free_users
FROM pump_users;
\`\`\`

---

## Next Steps

**RIGHT NOW**:
1. Open Azure Portal
2. Use Query Editor (Option 1 above)
3. Download CSV of all users

**AFTER YOU GET THE DATA**:
If you want local access working:
1. Reset the MySQL password (command above)
2. Update `.env` files
3. Restart the container apps
4. Test with `node server/get-all-users-admin.cjs`

---

**Bottom Line**: The Azure Portal Query Editor is your fastest path to seeing the data - it uses your Azure AD credentials instead of the database password, so you'll bypass the authentication issue entirely.

Let me know once you've accessed the data, or if you'd like me to help reset the MySQL password!
