# TSHLA Medical Infrastructure Status
**Last Updated:** October 5, 2025
**Status:** ✅ Development Environment Running

---

## 🖥️ Current Running Services

### Local Development Servers

| Service | Port | Status | Purpose | Process ID |
|---------|------|--------|---------|------------|
| **Vite Dev Server** | 5173 | ✅ Running | Frontend React app | 49500 |
| **Pump API Server** | 3002 | ✅ Running | PumpDrive assessments & reports | 49777 |
| **Medical Auth API** | 3003 | ✅ Running | User authentication & authorization | 50032 |
| **Local MySQL** | 3306 | ✅ Running | Development database | 50785 |

### Azure Production Services (Container Apps)

| Service | URL | Purpose | Status |
|---------|-----|---------|--------|
| **Schedule API** | `https://tshla-schedule-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io` | Appointment scheduling | ✅ Deployed |
| **Pump API** | `https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io` | Production pump assessments | ⚠️ **Missing `access_logs` table** |
| **Auth API** | `https://tshla-auth-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io` | Production authentication | ✅ Deployed |
| **Frontend** | `https://www.tshla.ai` | Main application | ✅ Deployed |

---

## 🗄️ Database Infrastructure

### Local Development (Currently Active)

**MySQL v8.x**
- **Host:** `localhost` (127.0.0.1)
- **Port:** 3306
- **Database:** `tshla_medical_local`
- **User:** `root`
- **Password:** *(empty)*
- **Tables:** 18 tables including:
  - ✅ `access_logs` - User access tracking
  - ✅ `pump_users` - PumpDrive registered users
  - ✅ `pump_assessments` - User assessment data
  - ✅ `pump_comparison_data` - 23-dimension pump data
  - ✅ `pump_manufacturers` - Pump manufacturer contacts
  - ✅ `payment_records` - Stripe payment tracking
  - ✅ `provider_deliveries` - Email delivery tracking

**Status:** ✅ **ALL TABLES EXIST** in local database

---

### Azure Production Databases

#### **Primary: Azure Database for MySQL - Production**
- **Host:** `tshla-mysql-prod.mysql.database.azure.com`
- **Database:** `tshla_medical`
- **User:** `tshlaadmin`
- **Password:** `TshlaSecure2025!`
- **Region:** Unknown (needs verification)
- **Status:** ⚠️ **MISSING `access_logs` table** (blocking user registration)

#### **Staging: Azure Database for MySQL - Staging**
- **Host:** `tshla-mysql-staging.mysql.database.azure.com`
- **Database:** `tshla_medical_staging`
- **User:** `tshlaadmin`
- **Password:** `TshlaSecure2025!`
- **Status:** Unknown (needs verification)

#### **Legacy: AWS RDS MySQL** *(Deprecated)*
- **Host:** `tshla-medical.cchoceqmctb1.us-east-1.rds.amazonaws.com`
- **Region:** us-east-1
- **Status:** ⚠️ Migrated to Azure, but referenced in some files

---

## 🔑 Environment Configuration

### Current Active Environment
**Local Development** (based on running processes)

- Frontend connects to: **Local APIs** (ports 3002, 3003)
- APIs connect to: **Local MySQL** (localhost:3306)
- AI Services: **Azure OpenAI** (tshla-medical-openai.openai.azure.com)

### Environment Files Found

| File | Purpose | Database |
|------|---------|----------|
| `.env` | Local development | Local MySQL |
| `.env.production` | Production build | Azure MySQL Production |
| `server/.env` | Server config | Azure MySQL Staging |
| `.env.development` | Dev overrides | Local MySQL |

---

## 🚨 Critical Issues

### **Issue #1: Missing `access_logs` Table in Azure Production**
**Impact:** 🔴 BLOCKING - Users cannot register or login on production
**Location:** Azure MySQL Production (`tshla-mysql-prod.mysql.database.azure.com`)
**Solution:** Execute SQL from `FINAL_ACTION_PLAN.md`

**SQL to Execute:**
```sql
CREATE TABLE IF NOT EXISTS access_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  access_type VARCHAR(50) NOT NULL COMMENT 'initial_purchase, renewal, research_access, etc.',
  payment_amount_cents INT DEFAULT 0 COMMENT 'Payment amount in cents (999 = $9.99)',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IPv4 or IPv6 address',
  user_agent TEXT DEFAULT NULL COMMENT 'Browser user agent string',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_access_type (access_type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES pump_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks user access events and payment history for PumpDrive';
```

---

## 📊 Port Mapping

| Port | Service | Protocol | Bound To |
|------|---------|----------|----------|
| 3000 | (Reserved) | HTTP | - |
| 3002 | Pump Report API | HTTP | localhost |
| 3003 | Medical Auth API | HTTP | localhost |
| 3306 | MySQL | TCP | 127.0.0.1 |
| 5173 | Vite Dev Server | HTTP | * (all interfaces) |
| 33060 | MySQL X Protocol | TCP | 127.0.0.1 |

---

## 🔧 How to Connect to Each Database

### Local Development (Current)
```bash
mysql -u root -D tshla_medical_local
```

### Azure Production (via CLI)
```bash
mysql -h tshla-mysql-prod.mysql.database.azure.com \
      -u tshlaadmin \
      -p'TshlaSecure2025!' \
      -D tshla_medical \
      --ssl-mode=REQUIRED
```

### Azure Staging (via CLI)
```bash
mysql -h tshla-mysql-staging.mysql.database.azure.com \
      -u tshlaadmin \
      -p'TshlaSecure2025!' \
      -D tshla_medical_staging \
      --ssl-mode=REQUIRED
```

### Via Azure Portal Query Editor
1. Go to: https://portal.azure.com
2. Search: "tshla-mysql-prod"
3. Click: "Query editor (preview)"
4. Login with credentials above

---

## 🔄 Data Flow: Local vs Production

### Local Development Flow
```
User → localhost:5173 (Frontend)
     → localhost:3002 (Pump API)
     → localhost:3306 (MySQL)
     ← Results returned
```

### Production Flow
```
User → www.tshla.ai (Azure Static Web Apps)
     → tshla-pump-api-container (Azure Container App)
     → tshla-mysql-prod (Azure MySQL) ⚠️ MISSING TABLE
     ← Should return results (currently failing)
```

---

## ✅ Next Actions

### **Immediate (5 minutes)**
1. ✅ Connect to Azure MySQL Production
2. ✅ Execute `CREATE TABLE access_logs` SQL
3. ✅ Verify table created: `SHOW TABLES LIKE 'access_logs';`
4. ✅ Test user registration via production API

### **This Week**
- Verify Azure Staging database has all tables
- Document which tables exist in each environment
- Create automated table sync script
- Set up database migration tracking

### **This Month**
- Move Azure MySQL to same region as Container Apps (cost optimization)
- Implement proper database schema versioning
- Create automated backup verification

---

## 📝 Notes

- Local development is fully functional (all 18 tables present)
- Production is blocked only by missing `access_logs` table
- All other infrastructure appears healthy
- Consider adding health check endpoints for all services

---

**Infrastructure Owner:** TSHLA Medical
**Contact:** support@tshla.ai
**Documentation:** This file, FINAL_ACTION_PLAN.md, FIX_INSTRUCTIONS_COMPLETE.md
