# PumpDrive User Management Guide

## 🎯 Quick Start

### Check What Users Exist
```bash
node list-pump-users.cjs
```

### Create a New User
```bash
node create-pump-user.cjs
```

### Test Login
```bash
node test-pump-login.cjs
```

---

## 📋 Understanding PumpDrive Users

### What Gets Stored When You Create a User?

#### 1. **Supabase Auth (Password Management)**
- Email
- Password (encrypted by Supabase)
- Email confirmation status
- Auth User ID (UUID)

#### 2. **pump_users Table (Profile Data)**
```sql
{
  id: UUID (auto-generated)
  email: "user@example.com"
  username: "user" (from email)
  first_name: "John"
  last_name: "Doe"
  phone_number: "555-1234" (optional)
  auth_user_id: UUID (links to Supabase Auth)

  -- Status
  is_active: true
  is_verified: true
  is_admin: false

  -- Payment
  current_payment_status: "trial"
  subscription_tier: "basic"

  -- Usage tracking
  assessments_completed: 0
  last_assessment_date: null

  -- Login tracking
  last_login: timestamp
  login_count: 0

  -- Timestamps
  created_at: timestamp
  updated_at: timestamp
}
```

#### 3. **Assessment Data (Stored in pump_users.assessment_data JSONB)**
When user completes PumpDrive assessment:
```json
{
  "sliders": {
    "activity": 7,
    "techComfort": 8,
    "simplicity": 5,
    "discreteness": 3,
    "timeDedication": 6
  },
  "features": [
    "tubeless",
    "phone_control",
    "waterproof"
  ],
  "freeText": "I'm a competitive swimmer and love tech...",
  "recommendations": [
    {
      "pump": "Omnipod 5",
      "score": 95,
      "reasoning": "..."
    }
  ]
}
```

---

## 🔐 Login Methods

### Method 1: Via App Login Page
```
1. Go to: http://localhost:5173/login
2. Enter email and password
3. Click "Sign In"
4. Redirected to dashboard or pumpdrive
```

### Method 2: Direct PumpDrive Access
```
1. Go to: http://localhost:5173/pumpdrive
2. No login required for public access
3. Results saved if logged in, anonymous if not
```

---

## ✅ User Creation Workflow

### Step-by-Step Process

1. **Run create script:**
   ```bash
   node create-pump-user.cjs
   ```

2. **Enter details when prompted:**
   ```
   📧 Email address: john@example.com
   🔑 Password: SecurePass123
   👤 First Name: John
   👤 Last Name: Doe
   📱 Phone Number: 555-1234
   ```

3. **Confirm creation:**
   ```
   ✅ Create this user? (y/n): y
   ```

4. **Script performs:**
   - ✅ Checks email not already taken
   - ✅ Creates Supabase Auth user
   - ✅ Creates pump_users record
   - ✅ Links them together via auth_user_id
   - ✅ Returns credentials

5. **Test immediately:**
   ```bash
   node test-pump-login.cjs
   ```

---

## 📊 What Data is Saved During Assessment?

### Stage 1: Demographics (Optional)
- Name, age, diabetes type
- Current pump (if any)
- Insurance info

### Stage 2: Slider Preferences
```javascript
{
  activity: 7,          // How active (1-10)
  techComfort: 8,       // Tech savviness (1-10)
  simplicity: 5,        // Simple vs advanced (1-10)
  discreteness: 3,      // Discretion importance (1-10)
  timeDedication: 6     // Time for device care (1-10)
}
```

### Stage 3: Must-Have Features
```javascript
[
  "tubeless",
  "phone_control",
  "waterproof",
  "cgm_dexcom_g6"
]
```

### Stage 4: Free Text (AI Analysis)
```javascript
{
  currentSituation: "I'm a competitive swimmer and need...",
  concerns: "Worried about alarms during meetings...",
  goals: "Want tight control without constant attention..."
}
```

### Stage 5: Context 7 Questions (Coming Soon)
Smart follow-up questions based on AI analysis

### Stage 6: Final Recommendations
```javascript
{
  recommendations: [
    {
      pump: "Omnipod 5",
      score: 95,
      reasoning: "Perfect for swimming, tubeless...",
      pros: ["Waterproof", "No tubing", "Simple"],
      cons: ["No touchscreen"],
      features_matched: 8
    }
  ],
  processingTime: 14.2,
  aiCost: 0.004
}
```

---

## 🔍 Checking Existing Users

### List All Users
```bash
node list-pump-users.cjs
```

**Output:**
```
✅ Found 2 pump user(s):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User #1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Email:        john@example.com
👤 Name:         John Doe
🆔 Username:     john
📱 Phone:        555-1234
✅ Active:       Yes
✅ Verified:     Yes
👑 Admin:        No
💳 Payment:      trial
📊 Assessments:  3
📅 Created:      Oct 7, 2025
🔑 Last Login:   Oct 7, 2025 10:30 AM
```

---

## 🧪 Testing Login

### Test Specific User
```bash
node test-pump-login.cjs
```

**Prompts:**
```
📧 Email: john@example.com
🔑 Password: SecurePass123
```

**Success Output:**
```
🎉 LOGIN SUCCESSFUL!

User Profile:
  📧 Email:           john@example.com
  👤 Name:            John Doe
  ✅ Active:          Yes
  💳 Payment Status:  trial

✅ VERIFICATION COMPLETE
This user can:
  ✅ Log in to the app
  ✅ Access PumpDrive assessment
  ✅ Save assessment data
  ✅ View results
```

---

## 🔧 Troubleshooting

### Error: "Email already exists"
**Solution:** Use a different email or check existing users:
```bash
node list-pump-users.cjs
```

### Error: "Pump user profile not found"
**Problem:** User exists in Supabase Auth but not in pump_users table

**Solution:** The user was created manually in Supabase Dashboard. Either:
1. Delete from Supabase Auth and recreate with script
2. Or manually add to pump_users table

### Error: "Missing Supabase credentials"
**Solution:** Check your `.env` file has:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Error: "Authentication failed"
**Possible reasons:**
1. Wrong password
2. Email not confirmed (check Supabase Dashboard)
3. User is inactive (`is_active = false`)

---

## 💡 Recommendations

### For Testing
Create test users with obvious naming:
```
Email:    test1@pumpdrive.test
Password: Test123!
Name:     Test User 1
```

### For Production
Use real email addresses:
```
Email:    patient@domain.com
Password: [Strong password]
Name:     [Real name]
```

### Avoid Duplicates
Always check existing users first:
```bash
node list-pump-users.cjs
```

---

## 📝 Common Emails to Avoid (May Already Exist)

Based on documentation, these MAY already be in your database:
- ❌ admin@tshla.ai (admin account)
- ❌ test@pumpdrive.com (old test user)

**Safe to use:**
- ✅ yourname@pumpdrive.test
- ✅ patient1@pumpdrive.test
- ✅ john.doe@example.com
- ✅ Any unique email not in the list

---

## 🎯 Next Steps After Creating User

1. **Test Login:**
   ```bash
   node test-pump-login.cjs
   ```

2. **Login to App:**
   ```
   http://localhost:5173/login
   ```

3. **Start Assessment:**
   ```
   http://localhost:5173/pumpdrive
   ```

4. **View Results:**
   - Complete all assessment stages
   - View AI recommendations
   - Get personalized pump suggestion

---

## 📚 Additional Resources

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Check Auth Users:** Dashboard → Authentication → Users
- **Check pump_users:** Dashboard → Table Editor → pump_users
- **View Logs:** Dashboard → Logs → API Logs

---

**Last Updated:** October 7, 2025
**Scripts Location:** Root directory
**Database:** Supabase PostgreSQL
