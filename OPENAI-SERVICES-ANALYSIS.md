# OpenAI Services Analysis - TSHLA Medical

**Created:** January 8, 2026
**Purpose:** Clarify which OpenAI services you're using and BAA requirements

---

## 🎯 Summary: Which OpenAI Are You Using?

### **Primary: Azure OpenAI (Microsoft)** ✅

**You are using:** Azure OpenAI Service (Microsoft Azure)
**NOT using:** Standard OpenAI API (platform.openai.com)

**Resource Name:** `tshla-openai-prod`
**Endpoint:** `https://tshla-openai-prod.openai.azure.com`
**Location:** East US (Azure)
**Provider:** Microsoft Azure

---

## 📊 Complete Service Breakdown

### 1. **Azure OpenAI** (Primary - HIPAA Compliant)

| Aspect | Details |
|--------|---------|
| **Service** | Azure OpenAI Service |
| **Provider** | Microsoft Azure |
| **Resource Name** | `tshla-openai-prod` |
| **Endpoint** | `https://tshla-openai-prod.openai.azure.com` |
| **Deployment** | `gpt-4` (or configured deployment) |
| **API Version** | `2024-02-01` |
| **BAA Status** | ✅ **Microsoft BAA Available** |
| **HIPAA Compliant** | ✅ **YES** (when BAA signed) |

**Configuration Variables:**
```bash
VITE_AZURE_OPENAI_ENDPOINT=https://tshla-openai-prod.openai.azure.com
VITE_AZURE_OPENAI_KEY=your-azure-key-here
VITE_AZURE_OPENAI_DEPLOYMENT=gpt-4
VITE_AZURE_OPENAI_API_VERSION=2024-02-01
VITE_PRIMARY_AI_PROVIDER=azure  # Set to 'azure' in production
```

**What It Does:**
- ✅ Clinical note formatting (SOAP notes)
- ✅ AI processing of dictation transcripts
- ✅ Patient summary generation
- ✅ Order extraction from notes
- ✅ CCD summary generation
- ✅ PumpDrive recommendation engine

**Code Reference:**
- Main service: `src/services/azureAI.service.ts`
- Version: 3.0.0 (Azure OpenAI only, no fallbacks)
- Comment from code: "HIPAA COMPLIANT - Azure OpenAI with Microsoft BAA"

---

### 2. **Standard OpenAI API** (Fallback - NOT HIPAA Compliant)

| Aspect | Details |
|--------|---------|
| **Service** | OpenAI Platform API |
| **Provider** | OpenAI Inc. |
| **Endpoint** | `https://api.openai.com` |
| **BAA Status** | ❌ **Not Available** (unless Enterprise) |
| **HIPAA Compliant** | ❌ **NO** (standard API) |
| **Your Usage** | ⚠️ **Backup/Fallback Only** |

**Configuration Variables:**
```bash
VITE_OPENAI_API_KEY=sk-proj-...
VITE_OPENAI_MODEL_STAGE4=gpt-4o-mini
VITE_OPENAI_MODEL_STAGE5=gpt-4o
VITE_OPENAI_MODEL_STAGE6=gpt-4o
```

**When It's Used:**
- Realtime API for diabetes education calls (OpenAI Realtime)
- PumpDrive AI scoring (stages 4, 5, 6)
- Fallback if Azure OpenAI unavailable (deprecated in v3.0)

**⚠️ HIPAA Risk:**
If standard OpenAI processes PHI without BAA = HIPAA violation

---

### 3. **"Simran Pump Drive"** - What Is This?

**Not a separate service** - Just page names in your app!

**Pages Found:**
- `/simran-pump-llm` - PumpDrive assistant page
- `/simran-pump-llm-debug` - Debug version
- `/simran-pump-llm-simple` - Simple version

**These pages USE:**
- Azure OpenAI (via your `azureAI.service.ts`)
- Standard OpenAI (for PumpDrive recommendation engine)

**Named "Simran":** Likely named after developer or user testing

**NOT a separate Azure resource** - Just routes in your React app

---

## 🔍 Azure Resources You Have

Based on your configuration, you have these Azure resources:

### Azure OpenAI
- **Resource:** `tshla-openai-prod`
- **Type:** Azure OpenAI Service
- **Location:** East US
- **Deployment:** GPT-4 (or similar)
- **Use:** Clinical note processing, AI formatting

### Azure Container Apps
- **Resource:** `tshla-unified-api`
- **Type:** Azure Container Apps
- **Location:** East US
- **Use:** Backend API hosting

### Azure Communication Services (Optional)
- **Type:** Azure Communication Services
- **Use:** Phone calls (if configured)
- **Note:** May also need BAA if handling PHI via phone

### Azure Container Registry
- **Resource:** (likely `tshlaacr` or similar)
- **Type:** Azure Container Registry
- **Use:** Docker image storage

### Azure Storage (If configured)
- **Type:** Azure Blob Storage
- **Use:** File storage (audio, documents)
- **Note:** Needs BAA if storing PHI

---

## 📋 BAA Requirements by Service

| Service | Provider | Your Usage | BAA Required | BAA Status |
|---------|----------|------------|--------------|------------|
| **Azure OpenAI** | Microsoft | ✅ Primary AI | ✅ YES | ❓ **CHECK** |
| **Standard OpenAI** | OpenAI Inc. | ⚠️ Backup/Realtime | ✅ YES (if used) | ❌ **Not Available** |
| **Azure Container Apps** | Microsoft | ✅ Backend hosting | ❌ No (infrastructure) | N/A |
| **Azure Storage** | Microsoft | Maybe | ⚠️ If stores PHI | ❓ **CHECK** |
| **Azure Comm Services** | Microsoft | Maybe | ⚠️ If phone calls | ❓ **CHECK** |

---

## ✅ What You Need to Do

### **IMMEDIATE: Check Azure/Microsoft BAA Status**

**You need ONE BAA with Microsoft that covers:**
- Azure OpenAI Service
- Azure Storage (if used for PHI)
- Azure Communication Services (if used for calls)

**How to Check:**
1. Go to: https://portal.azure.com
2. Navigate to: Subscriptions → Your Subscription → Policies
3. Look for: "HIPAA" or "Healthcare" compliance settings
4. Check: Azure Service Health → Compliance

**Or Contact Microsoft:**
- Azure Support Portal
- Request HIPAA BAA documentation
- Confirm coverage for your resources

### **PRIORITY 2: Handle Standard OpenAI**

**Your code uses Standard OpenAI for:**
- OpenAI Realtime API (diabetes education calls)
- PumpDrive recommendation engine

**Options:**

#### Option A: Get OpenAI Enterprise BAA
- Contact: https://openai.com/enterprise
- Requires: Enterprise plan ($$$)
- Timeline: 2-4 weeks

#### Option B: Migrate to Azure OpenAI Realtime (Recommended)
- Azure now has GPT-4o Realtime support
- Covered by your Microsoft BAA
- More cost-effective
- Better integration

#### Option C: Ensure No PHI in Standard OpenAI
- Review code to ensure standard OpenAI never processes PHI
- Document data flow
- May still need BAA for liability protection

---

## 🎯 Recommended Action Plan

### Week 1: Verify Microsoft BAA

1. **Check Azure Portal**
   - Log into Azure Portal
   - Check subscription compliance settings
   - Look for existing BAA

2. **Contact Microsoft if Needed**
   - Azure Support: https://azure.microsoft.com/support
   - Request HIPAA BAA
   - Confirm coverage for:
     - Azure OpenAI Service (`tshla-openai-prod`)
     - Azure Storage (if used)
     - Azure Communication Services (if used)

3. **Document Current State**
   - List all Azure resources
   - Identify which handle PHI
   - Map data flows

### Week 2: Address OpenAI Realtime

1. **Review Realtime API Usage**
   - Check: `server/openai-realtime-relay.js`
   - Determine: What PHI is processed?
   - Document: Data flow

2. **Choose Migration Path**
   - Option A: Azure OpenAI Realtime (recommended)
   - Option B: Get OpenAI Enterprise BAA
   - Option C: Architect to avoid PHI in standard OpenAI

3. **Implement Solution**
   - Update code if migrating
   - Test thoroughly
   - Document compliance

### Week 3: Update Documentation

1. **Update BAA Tracker**
   - File: `HIPAA-BAA-TRACKER.md`
   - Add: Microsoft/Azure BAA status
   - Add: OpenAI strategy

2. **Document Architecture**
   - Which services process PHI
   - Data flow diagrams
   - Compliance strategy

3. **Train Staff**
   - HIPAA requirements
   - Which services are covered
   - Incident response

---

## 🔐 Current Compliance Status

| Component | HIPAA Status | Notes |
|-----------|--------------|-------|
| **Supabase** | ✅ BAA Signed | Database covered |
| **ElevenLabs** | ✅ BAA Signed | Voice agents covered |
| **Deepgram** | ⏳ Pending | Waiting for BAA |
| **Azure OpenAI** | ❓ **Check** | Likely covered by Microsoft BAA |
| **Standard OpenAI** | ❌ **Gap** | No BAA for standard API |
| **RLS Security** | ✅ Enabled | 39 tables protected |

---

## 📞 Contact Information

### Microsoft Azure HIPAA Support
- Portal: https://azure.microsoft.com/support
- Documentation: https://docs.microsoft.com/azure/compliance/hipaa
- BAA Request: Through Azure Portal → Support

### OpenAI Enterprise
- Website: https://openai.com/enterprise
- Email: enterprise@openai.com
- Sales: Contact through website

### Your Resources
- Azure OpenAI: `tshla-openai-prod` (East US)
- Container App: `tshla-unified-api` (East US)
- Resource Group: `tshla-backend-rg` (likely)

---

## ❓ FAQ

### Q: Do I need separate BAAs for each Azure service?
**A:** No! One Microsoft BAA typically covers all Azure services used for healthcare.

### Q: Is Azure OpenAI the same as regular OpenAI?
**A:** No! Different services:
- **Azure OpenAI:** Microsoft-hosted, BAA available
- **Regular OpenAI:** OpenAI-hosted, no standard BAA

### Q: What is "tshla-openai-prod"?
**A:** Your Azure OpenAI resource name (like a server name in Azure)

### Q: What is "Simran Pump Drive"?
**A:** Just page names in your app (`/simran-pump-llm`), not a separate service

### Q: Can I use both Azure and regular OpenAI?
**A:** Yes, but:
- ✅ Azure OpenAI = HIPAA compliant with BAA
- ❌ Regular OpenAI = Need Enterprise plan for BAA

---

**Next Step:** Check your Azure portal for Microsoft BAA status, then update `HIPAA-BAA-TRACKER.md` with findings.

**Questions?** Review this document and check Azure Portal compliance settings.
