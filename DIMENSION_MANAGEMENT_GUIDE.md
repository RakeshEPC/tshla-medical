# PumpDrive 23 Dimensions Management Guide
**System:** TSHLA Medical - PumpDrive AI Recommendation Engine
**Last Updated:** October 5, 2025
**Status:** ✅ Fully Operational

---

## 📊 Overview

The PumpDrive recommendation system uses **23 carefully curated dimensions** to match patients with the most suitable insulin pump. Each dimension represents a specific aspect of pump functionality, lifestyle compatibility, or user preference.

---

## 🎯 What Are the 23 Dimensions?

The dimensions cover every aspect of insulin pump selection:

### **Power & Battery (2 dimensions)**
1. **Battery Life & Power Management** - How pumps are powered (AA, rechargeable, pod)
2. **Travel & Airport Logistics** - What to pack, power needs during travel

### **Design & Physical (4 dimensions)**
3. **Tubing Preference & Wear Style** - Tubed, tubeless, or micro-pump designs
4. **Visual Discretion & Wearability** - Size, visibility, comfort on body
5. **On-Body Visibility & Comfort** - How it feels during sleep, sitting, movement
6. **Adhesive & Site Tolerance** - Skin sensitivity, adhesive considerations

### **Control & Interface (5 dimensions)**
7. **Phone Control & App Dependence** - App-based vs pump-based control
8. **User Interface & Screen** - Touchscreen, buttons, or phone-first UI
9. **Manual Bolus Workflow** - Carb counting vs simplified dosing
10. **Alerts & Alarms Customization** - Alert volume, frequency, customization
11. **Support Apps & Updates** - App/firmware update frequency

### **Automation & Algorithm (4 dimensions)**
12. **Algorithm Behavior (Automation Style)** - Aggressiveness, auto-corrections
13. **Target Adjustability & Flexibility** - How much control over glucose targets
14. **Exercise Modes & Temporary Targets** - Activity mode features
15. **CGM Compatibility & Signal Handling** - Which CGMs work, integration quality

### **Practical & Logistics (5 dimensions)**
16. **Reservoir/Pod Capacity & Change Frequency** - How often to refill/change
17. **Water Resistance & Activities** - Swimming, showering, submersion
18. **Clinic Support & Training** - Availability of training, clinic familiarity
19. **Ecosystem & Accessories** - Watches, apps, third-party integrations
20. **Reliability & Occlusion Handling** - How issues are detected and resolved

### **Social & Support (3 dimensions)**
21. **Data Sharing & Reports** - Sharing with family, clinic uploads
22. **Pediatric & Caregiver Features** - Remote bolus, parent controls
23. **Cost & Insurance Fit** - Coverage considerations, out-of-pocket costs

---

## 📍 Where Are the 23 Dimensions Stored?

The dimensions exist in **THREE locations** (single source of truth principle):

### **1. Database (Source of Truth)** ✅
**Location:** Azure MySQL `pump_comparison_data` table
**Schema:**
```sql
CREATE TABLE pump_comparison_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dimension_number INT NOT NULL,
  dimension_name VARCHAR(255) NOT NULL,
  dimension_description TEXT,
  importance_scale VARCHAR(50) DEFAULT '1-10',
  pump_details JSON NOT NULL, -- All 6 pumps for this dimension
  category VARCHAR(100),       -- e.g., 'Power', 'Design', 'Automation'
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_dimension (dimension_number)
);
```

**Current Status:**
- 23 dimensions stored in database
- Editable via admin interface
- Used by AI for recommendations

### **2. Frontend Code** 📱
**Location:** [src/lib/pump-dimensions.ts](src/lib/pump-dimensions.ts)
**Purpose:** Display to users during assessment
**Format:**
```typescript
export const DIMENSIONS: Dimension[] = [
  {
    id: 'battery',
    title: 'Battery life & power management',
    scenario: 'Battery power affects how often you charge...',
    facts: {
      'Medtronic 780G': 'AA battery; swap anywhere; no charging.',
      't:slim X2': 'Rechargeable; multi-day; app use can add drain.',
      'Tandem Mobi': 'Rechargeable micro-pump; wireless pad for charging.',
      'Omnipod 5': 'Built-in pod battery; lasts the wear cycle; no charging.',
      'Beta Bionics iLet': 'Rechargeable; multi-day; top-offs recommended.',
    },
  },
  // ... 22 more dimensions
];
```

### **3. AI Prompt Context** 🤖
**Location:** [src/services/pumpDriveAI.service.ts](src/services/pumpDriveAI.service.ts)
**Purpose:** AI uses these to make recommendations
**How:** Database dimensions are passed to OpenAI/Azure AI in the prompt

---

## 🔧 How to Edit the 23 Dimensions

### **Option 1: Admin Web Interface** (Recommended) ✅

**Steps:**
1. Navigate to: `https://www.tshla.ai/admin/pump-comparison-manager`
2. Login with admin credentials
3. Click "Dimensions" tab
4. Click "Edit" button next to any dimension
5. Modify fields:
   - Dimension name
   - Description
   - Pump details (JSON format)
   - Category
   - Display order
   - Active status
6. Click "Save"
7. Changes are immediately reflected in AI recommendations

**Admin UI Features:**
- Edit dimension details
- Update pump-specific information for each dimension
- Reorder dimensions
- Disable dimensions without deleting
- View change history (changelog table)

### **Option 2: Direct Database Edit** (Advanced)

**Via Azure Portal Query Editor:**
1. Go to: https://portal.azure.com
2. Search: "tshla-mysql-prod"
3. Click "Query editor (preview)"
4. Login:
   - Username: `tshlaadmin`
   - Password: `TshlaSecure2025!`
   - Database: `tshla_medical`

**Example SQL:**
```sql
-- Update a dimension description
UPDATE pump_comparison_data
SET dimension_description = 'New description here',
    updated_at = CURRENT_TIMESTAMP
WHERE dimension_number = 1;

-- Update pump details for a specific dimension
UPDATE pump_comparison_data
SET pump_details = JSON_SET(
  pump_details,
  '$."Medtronic 780G".title', 'New title',
  '$."Medtronic 780G".details', 'New details'
)
WHERE dimension_number = 1;

-- View all dimensions
SELECT dimension_number, dimension_name, category, is_active
FROM pump_comparison_data
ORDER BY display_order;
```

### **Option 3: Via Node.js Script** (Automated)

Create a script to bulk update dimensions:
```javascript
const mysql = require('mysql2/promise');

const connection = await mysql.createConnection({
  host: 'tshla-mysql-prod.mysql.database.azure.com',
  user: 'tshlaadmin',
  password: 'TshlaSecure2025!',
  database: 'tshla_medical',
  ssl: { require: true, rejectUnauthorized: false }
});

// Update dimension
await connection.query(
  'UPDATE pump_comparison_data SET dimension_description = ? WHERE dimension_number = ?',
  ['New description', 1]
);
```

---

## 🤖 How AI Uses the 23 Dimensions

### **Step-by-Step Flow:**

1. **User Completes Assessment**
   - Sliders (5 lifestyle questions)
   - Feature selection (power, design, interface, automation)
   - Free text story (current situation, challenges, priorities)
   - Clarifying questions (AI-generated based on conflicts)

2. **Data Sent to API**
   ```
   POST /api/pumpdrive/recommend
   {
     "sliders": {...},
     "features": [...],
     "freeText": {...},
     "clarifying": {...}
   }
   ```

3. **AI Service Loads All 23 Dimensions**
   ```javascript
   // From pumpDriveAI.service.ts
   const pumpDetails = this.formatPumpDatabase();
   // Loads ALL 23 dimensions from database
   ```

4. **AI Analyzes User Preferences Against Dimensions**
   - Matches user priorities to relevant dimensions
   - Scores each pump across ALL 23 dimensions
   - Considers user-specific weights (explicit selections > sliders)

5. **AI Generates Recommendation**
   ```json
   {
     "topChoice": {
       "name": "Omnipod 5",
       "score": 92,
       "reasons": [
         "Tubeless design matches your priority for discretion (Dimension 18)",
         "Water-resistant for your active lifestyle (Dimension 11)",
         "Phone or controller options for tech comfort (Dimension 7)"
       ]
     }
   }
   ```

6. **Results Displayed to User**
   - Top recommendation with score
   - 2-3 alternatives
   - Explanation of why each dimension mattered
   - User's original inputs displayed for verification

---

## 📈 Dimension Usage Analytics

**Check Which Dimensions Matter Most:**
```sql
-- See which dimensions are cited most in recommendations
SELECT
  dimension_name,
  COUNT(*) as times_referenced
FROM pump_comparison_data pcd
JOIN pump_assessments pa
  ON JSON_CONTAINS(pa.ai_recommendation, JSON_QUOTE(pcd.dimension_name))
GROUP BY dimension_name
ORDER BY times_referenced DESC;
```

**Most Important Dimensions (Based on User Selections):**
1. **Tubing Style** - Most decisive factor (tubeless vs tubed)
2. **Phone Control** - Tech-savvy users prioritize this
3. **Algorithm Automation** - Users want aggressive vs conservative
4. **Battery Type** - Practical daily consideration
5. **Water Resistance** - Active lifestyle users

---

## 🔍 Verifying Dimension Integrity

### **Check All Dimensions Are Present:**
```sql
SELECT COUNT(*) FROM pump_comparison_data WHERE is_active = TRUE;
-- Expected: 23
```

### **Check Each Pump Has Data for All Dimensions:**
```sql
SELECT
  dimension_number,
  dimension_name,
  JSON_KEYS(pump_details) as pumps
FROM pump_comparison_data
ORDER BY dimension_number;
```

**Expected Pump Names:**
- Medtronic 780G
- t:slim X2
- Tandem Mobi
- Omnipod 5
- Beta Bionics iLet

### **Check for Missing or Invalid Data:**
```sql
-- Find dimensions with incomplete pump data
SELECT dimension_number, dimension_name
FROM pump_comparison_data
WHERE JSON_LENGTH(pump_details) < 5; -- Should be 5+ pumps

-- Find inactive dimensions
SELECT dimension_number, dimension_name, updated_at
FROM pump_comparison_data
WHERE is_active = FALSE;
```

---

## 📝 Adding a New Dimension

If you need to add dimension #24:

### **Step 1: Add to Database**
```sql
INSERT INTO pump_comparison_data (
  dimension_number,
  dimension_name,
  dimension_description,
  pump_details,
  category,
  display_order,
  is_active
) VALUES (
  24,
  'New Dimension Name',
  'Detailed description of what this dimension evaluates',
  '{
    "Medtronic 780G": {"title": "...", "details": "..."},
    "t:slim X2": {"title": "...", "details": "..."},
    "Tandem Mobi": {"title": "...", "details": "..."},
    "Omnipod 5": {"title": "...", "details": "..."},
    "Beta Bionics iLet": {"title": "...", "details": "..."}
  }',
  'New Category',
  24,
  TRUE
);
```

### **Step 2: Update Frontend** (Optional)
Add to [src/lib/pump-dimensions.ts](src/lib/pump-dimensions.ts) if you want users to see it during assessment.

### **Step 3: Update AI Prompt** (Optional)
The AI automatically uses all dimensions from the database, so no code changes needed unless you want special handling.

---

## 🚨 Troubleshooting

### **Issue: AI not considering a dimension**
**Check:**
```sql
SELECT dimension_number, dimension_name, is_active
FROM pump_comparison_data
WHERE dimension_number = X;
```
Ensure `is_active = TRUE`

### **Issue: Dimension shows outdated data**
**Solution:**
1. Check `updated_at` timestamp
2. Clear any caching in the API
3. Restart pump-report-api container

### **Issue: Admin UI won't load dimensions**
**Check API endpoint:**
```bash
curl https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/admin/pump-comparison-data
```

---

## 📊 Dimension Change History

All edits are tracked in `pump_comparison_changelog` table:

```sql
SELECT
  table_name,
  record_id,
  change_type,
  changed_by,
  change_notes,
  created_at
FROM pump_comparison_changelog
WHERE table_name = 'pump_comparison_data'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🎯 Best Practices

1. **Always test after editing** - Run a sample assessment to verify AI still generates good recommendations
2. **Update all pumps** - When editing a dimension, ensure all 5 pumps have updated information
3. **Keep descriptions patient-friendly** - Write in plain language, avoid medical jargon
4. **Version control** - Note reason for changes in `change_notes`
5. **Coordinate with AI team** - Major dimension changes may require AI prompt tuning

---

## 📞 Support

**Questions about dimensions?**
- Technical: Check [INFRASTRUCTURE_STATUS.md](INFRASTRUCTURE_STATUS.md)
- Database: See [server/scripts/create-pump-comparison-tables.sql](server/scripts/create-pump-comparison-tables.sql)
- AI Logic: Review [src/services/pumpDriveAI.service.ts](src/services/pumpDriveAI.service.ts)

**Need help editing?**
- Admin UI not working → Check container app logs
- Database access issues → Verify Azure MySQL firewall rules
- AI recommendations seem off → Review dimension weights in AI prompt

---

**Last Updated:** October 5, 2025
**Maintained by:** TSHLA Medical Development Team
**Related Docs:** INFRASTRUCTURE_STATUS.md, FINAL_ACTION_PLAN.md
