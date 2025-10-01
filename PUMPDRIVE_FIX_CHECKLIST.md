# 🎯 PUMPDRIVE FIX - PROGRESS CHECKLIST

**Project:** TSHLA Medical - PumpDrive Insulin Pump Selector
**Goal:** Fix PumpDrive to work with MySQL + OpenAI API
**Started:** [Add date when you start]
**Last Updated:** [Update as you go]

---

## 📍 QUICK STATUS

**Current Phase:** [ ] Not Started | [ ] Phase 1 | [ ] Phase 2 | [ ] Phase 3 | [ ] Phase 4 | [ ] Phase 5 | [ ] Phase 6
**MySQL Running:** [ ] Yes | [ ] No
**Backend APIs Running:** [ ] Yes | [ ] No
**Frontend Running:** [ ] Yes | [ ] No
**PumpDrive Working:** [ ] Yes | [ ] No

---

## 📋 PHASE 1: MySQL Database Setup (30-45 min)

### 1.1 Start MySQL Service
- [ ] Run: `brew services start mysql`
- [ ] Verify: `brew services list | grep mysql` shows "started"
- [ ] **Notes:**

### 1.2 Set MySQL Root Password
- [ ] **Decision:** Using password? [ ] Yes [ ] No
- [ ] If yes, password set to: `____________`
- [ ] Test connection: `mysql -u root -p`
- [ ] **Notes:**

### 1.3 Create Database
- [ ] Run command:
```bash
mysql -u root -e "CREATE DATABASE tshla_medical_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```
- [ ] Database created successfully
- [ ] **Notes:**

### 1.4 Load Database Schemas
- [ ] Run: `mysql -u root tshla_medical_local < server/database/pump-users-schema.sql`
- [ ] Run: `mysql -u root tshla_medical_local < server/database/medical-staff-schema.sql`
- [ ] Run: `mysql -u root tshla_medical_local < server/database/pump-report-schema.sql`
- [ ] Verify tables: `mysql -u root tshla_medical_local -e "SHOW TABLES;"`
- [ ] **Tables created:** `____________`
- [ ] **Notes:**

### 1.5 Test Database Connection
- [ ] Connect: `mysql -u root tshla_medical_local`
- [ ] Run: `SELECT COUNT(*) FROM pump_users;`
- [ ] Connection successful
- [ ] **Notes:**

**Phase 1 Complete:** [ ] Yes | [ ] No
**Time Taken:** `____` minutes
**Issues Encountered:**

---

## 📋 PHASE 2: Update Environment Configuration (5 min)

### 2.1 Update .env File
- [ ] Open file: `/Users/rakeshpatel/Desktop/tshla-medical/.env`
- [ ] Add OpenAI key:
```bash
VITE_OPENAI_API_KEY=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
```
- [ ] Update MySQL password: `DB_PASSWORD=____________`
- [ ] Verify all DB settings:
  - [ ] DB_HOST=localhost
  - [ ] DB_PORT=3306
  - [ ] DB_DATABASE=tshla_medical_local
  - [ ] DB_USER=root
  - [ ] USE_MYSQL=true
- [ ] Save file
- [ ] **Notes:**

**Phase 2 Complete:** [ ] Yes | [ ] No
**Time Taken:** `____` minutes

---

## 📋 PHASE 3: Fix PumpDrive AI Service (15-30 min)

### 3.1 Update pumpDriveAI.service.ts
- [ ] Open file: `src/services/pumpDriveAI.service.ts`
- [ ] **Line 1:** Change import from `azureAI.service` to `openai.service`
  - [ ] Old: `import { azureAIService } from './azureAI.service';`
  - [ ] New: `import { openaiService } from './openai.service';`
- [ ] **Find AI call** (around line 120-150)
  - [ ] Old: `azureAIService.processPrompt(prompt)`
  - [ ] New: `openaiService.processText(prompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 })`
- [ ] Save file
- [ ] **Notes:**

### 3.2 Verify openai.service.ts
- [ ] Check if `processText()` method exists
- [ ] Run: `grep -n "processText" src/services/openai.service.ts`
- [ ] **Method exists:** [ ] Yes [ ] No
- [ ] If No, add method to openai.service.ts (see comprehensive plan)
- [ ] **Notes:**

### 3.3 Test Build
- [ ] Run: `npm run build`
- [ ] Build successful: [ ] Yes [ ] No
- [ ] **Errors:** `____________`
- [ ] **Notes:**

**Phase 3 Complete:** [ ] Yes | [ ] No
**Time Taken:** `____` minutes
**Issues Encountered:**

---

## 📋 PHASE 4: Clean Up Unused Files (10 min - OPTIONAL)

### 4.1 Delete Unused Pump Services
- [ ] Navigate to: `src/services/`
- [ ] Delete these 17 files:
  - [ ] pumpDriveValidated.service.ts
  - [ ] pumpDriveCached.service.ts
  - [ ] pumpDriveCachedBrowser.service.ts
  - [ ] pumpDriveFeatureBased.service.ts
  - [ ] pumpDriveEnhanced.service.ts
  - [ ] pumpDriveEnhancedV2.service.ts
  - [ ] pumpDriveLightweight.service.ts
  - [ ] pumpDrivePureAI.service.ts
  - [ ] pumpDriveValidation.service.ts
  - [ ] pumpDriveCategoryRecommendation.service.ts
  - [ ] pumpRecommendationEngine.ts
  - [ ] pumpRecommendationUnified.service.ts
  - [ ] aiScheduleParser.service.ts
  - [ ] sliderMCP.service.ts
  - [ ] aiRequestQueue.service.ts
  - [ ] pumpAnalysis.service.ts
  - [ ] localFallback.service.ts
- [ ] **Notes:**

**Phase 4 Complete:** [ ] Yes | [ ] No | [ ] Skipped
**Time Taken:** `____` minutes

---

## 📋 PHASE 5: Test Locally (30-45 min)

### 5.1 Start Backend API (Terminal 1)
- [ ] Open Terminal 1
- [ ] Run: `cd /Users/rakeshpatel/Desktop/tshla-medical`
- [ ] Run: `PORT=3002 node server/pump-report-api.js`
- [ ] **Status:** [ ] Running [ ] Error
- [ ] See: "Connected to MySQL database: tshla_medical_local"
- [ ] See: "Pump Report API server running on port 3002"
- [ ] **Keep terminal open!**
- [ ] **Notes:**

### 5.2 Start Medical Auth API (Terminal 2 - OPTIONAL)
- [ ] Open Terminal 2
- [ ] Run: `cd /Users/rakeshpatel/Desktop/tshla-medical`
- [ ] Run: `PORT=3003 node server/medical-auth-api.js`
- [ ] **Status:** [ ] Running [ ] Error [ ] Skipped
- [ ] **Keep terminal open!**
- [ ] **Notes:**

### 5.3 Start Frontend Dev Server (Terminal 3)
- [ ] Open Terminal 3
- [ ] Run: `cd /Users/rakeshpatel/Desktop/tshla-medical`
- [ ] Run: `npm run dev`
- [ ] **Status:** [ ] Running [ ] Error
- [ ] See: "Local: http://localhost:5173/"
- [ ] **URL:** `____________`
- [ ] **Keep terminal open!**
- [ ] **Notes:**

### 5.4 Test PumpDrive Flow
- [ ] Open browser to: `http://localhost:5173/pumpdrive`
- [ ] **Landing page loads:** [ ] Yes [ ] No
- [ ] **No console errors:** [ ] Yes [ ] No (F12 to check)
- [ ] Click "Start Your Journey"
- [ ] **Categories page shows:** [ ] Yes [ ] No
- [ ] See 6 categories with emojis
- [ ] Click category: "💰 Budget & Insurance"
- [ ] **Category detail page loads:** [ ] Yes [ ] No
- [ ] Record or type a response
- [ ] **Recording works:** [ ] Yes [ ] No
- [ ] Complete at least 2-3 categories
- [ ] Click "View Your Recommendations"
- [ ] **Results page loads:** [ ] Yes [ ] No
- [ ] **AI recommendations appear:** [ ] Yes [ ] No
- [ ] **Recommendations make sense:** [ ] Yes [ ] No
- [ ] **Response time:** `____` seconds
- [ ] **Notes:**

### 5.5 Verify Database Storage
- [ ] Run: `mysql -u root tshla_medical_local -e "SELECT id, created_at FROM pump_assessments ORDER BY created_at DESC LIMIT 5;"`
- [ ] **Data saved:** [ ] Yes [ ] No
- [ ] **Number of records:** `____`
- [ ] **Notes:**

### 5.6 Test Error Handling
- [ ] Try submitting with empty responses
- [ ] Try with very long text
- [ ] Test back button navigation
- [ ] Test browser refresh during assessment
- [ ] **All errors handled gracefully:** [ ] Yes [ ] No
- [ ] **Notes:**

**Phase 5 Complete:** [ ] Yes | [ ] No
**Time Taken:** `____` minutes
**Issues Encountered:**

---

## 📋 PHASE 6: Deploy to Production (30-60 min)

### 6.1 Build Production Bundle
- [ ] Run: `npm run build`
- [ ] **Build successful:** [ ] Yes [ ] No
- [ ] **Bundle size:** `____` KB
- [ ] `dist/` folder created
- [ ] **Notes:**

### 6.2 Commit Changes to Git
- [ ] Run: `git status` (review changes)
- [ ] Run: `git add .`
- [ ] Run: `git commit -m "Fix PumpDrive with OpenAI + MySQL integration"`
- [ ] Run: `git push origin main`
- [ ] **Pushed successfully:** [ ] Yes [ ] No
- [ ] **Notes:**

### 6.3 Deploy Frontend
**Current hosting:** Azure Static Web Apps at https://www.tshla.ai

- [ ] **Method chosen:** [ ] Azure CLI [ ] Azure Portal [ ] GitHub Actions [ ] Other: `____`

**If using Azure CLI:**
- [ ] Run: `swa deploy --app-location dist --env production`
- [ ] **Deployment successful:** [ ] Yes [ ] No

**If using GitHub Actions:**
- [ ] Check GitHub Actions tab
- [ ] Workflow triggered automatically
- [ ] **Deployment successful:** [ ] Yes [ ] No

**If using Azure Portal:**
- [ ] Log in to https://portal.azure.com
- [ ] Navigate to Static Web App resource
- [ ] Upload `dist/` contents
- [ ] **Upload successful:** [ ] Yes [ ] No

- [ ] **Production URL:** `____________`
- [ ] **Notes:**

### 6.4 Deploy Backend APIs
**Backend deployment method:** [ ] Azure App Service [ ] PM2 on VPS [ ] Keep current [ ] Other: `____`

- [ ] Deploy pump-report-api.js
- [ ] **Backend URL:** `____________`
- [ ] Update CORS settings to allow production domain
- [ ] **Notes:**

### 6.5 Update Production Environment Variables
- [ ] Add `VITE_OPENAI_API_KEY` to production
- [ ] Update `DB_HOST` (production MySQL host)
- [ ] Update `DB_USER` (production MySQL user)
- [ ] Update `DB_PASSWORD` (production MySQL password)
- [ ] Update `DB_DATABASE` (production database name)
- [ ] Update `VITE_API_URL` to production backend
- [ ] **All variables updated:** [ ] Yes [ ] No
- [ ] **Notes:**

### 6.6 Test Production Deployment
- [ ] Visit: `https://www.tshla.ai/pumpdrive`
- [ ] **Production site loads:** [ ] Yes [ ] No
- [ ] Complete full PumpDrive flow on production
- [ ] **AI recommendations work:** [ ] Yes [ ] No
- [ ] Check production database for saved data
- [ ] **Data saved to production DB:** [ ] Yes [ ] No
- [ ] Test on mobile device
- [ ] **Mobile works:** [ ] Yes [ ] No
- [ ] **Notes:**

**Phase 6 Complete:** [ ] Yes | [ ] No
**Time Taken:** `____` minutes
**Issues Encountered:**

---

## ✅ FINAL CHECKLIST

- [ ] MySQL running locally
- [ ] Database created with all tables
- [ ] .env file updated with API keys
- [ ] pumpDriveAI.service.ts fixed
- [ ] Backend API running on port 3002
- [ ] Frontend running on localhost:5173
- [ ] PumpDrive works end-to-end locally
- [ ] AI recommendations are relevant
- [ ] Data saves to MySQL
- [ ] Production build successful
- [ ] Deployed to production
- [ ] Production URL working
- [ ] Mobile-friendly

---

## 📝 SESSION NOTES

### Session 1 (Date: ____)
**Progress:**

**Issues:**

**Next Steps:**

---

### Session 2 (Date: ____)
**Progress:**

**Issues:**

**Next Steps:**

---

### Session 3 (Date: ____)
**Progress:**

**Issues:**

**Next Steps:**

---

## 🆘 TROUBLESHOOTING LOG

### Issue 1:
**Problem:**
**Solution:**
**Resolved:** [ ] Yes [ ] No

---

### Issue 2:
**Problem:**
**Solution:**
**Resolved:** [ ] Yes [ ] No

---

### Issue 3:
**Problem:**
**Solution:**
**Resolved:** [ ] Yes [ ] No

---

## 📊 PROJECT METRICS

**Total Time Spent:** `____` hours
**Phases Completed:** `____` / 6
**Success Rate:** `____%`
**Production Ready:** [ ] Yes [ ] No

---

## 🎯 NEXT SESSION QUICK START

**When you start next session, tell Claude:**

"Continue with PUMPDRIVE_FIX_CHECKLIST.md - I'm at Phase [X] Step [Y]"

OR

"I completed Phase [X], update the checklist and continue to Phase [Y]"

**Claude will:**
1. Read this file
2. See what's checked off
3. Continue from where you left off
4. Update checkboxes as steps complete

---

## 📁 KEY FILE LOCATIONS

```
Project Root: /Users/rakeshpatel/Desktop/tshla-medical

Files Being Modified:
- src/services/pumpDriveAI.service.ts (line 1 + line ~150)
- .env (add OpenAI key + MySQL password)

Backend API:
- server/pump-report-api.js (port 3002)

Database Schemas:
- server/database/pump-users-schema.sql
- server/database/medical-staff-schema.sql
- server/database/pump-report-schema.sql

OpenAI API Key:
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

Production URL:
https://www.tshla.ai

GitHub Repo:
https://github.com/RakeshEPC/tshla-medical.git
```

---

**END OF CHECKLIST**
