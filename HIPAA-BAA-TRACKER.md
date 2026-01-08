# HIPAA Business Associate Agreement (BAA) Tracker

**Project:** TSHLA Medical
**Last Updated:** January 8, 2026

---

## Overview

This document tracks all Business Associate Agreements (BAAs) required for HIPAA compliance. BAAs are legally required when third-party vendors process, store, or transmit Protected Health Information (PHI).

---

## BAA Status Summary

| Vendor | Service | Status | Signed Date | Renewal Date | Storage Location |
|--------|---------|--------|-------------|--------------|------------------|
| **ElevenLabs** | AI Voice Agents (Diabetes Education) | ✅ **SIGNED** | [Date from PDF] | [Annual/as specified] | `/legal-compliance/baas/elevenlabs-baa-2026.pdf` |
| **Supabase** | Database & Backend (PHI Storage) | ✅ **SIGNED** | [Check PDF] | [Annual/as specified] | `/legal-compliance/baas/supabase-baa-[date].pdf` |
| **Deepgram** | Medical Speech-to-Text (Dictation) | ⏳ **PENDING** | - | - | TBD |
| **Microsoft Azure** | Azure OpenAI + Infrastructure | ✅ **AUTOMATIC** (Product Terms/DPA) | Automatic | N/A (Azure subscription) | Microsoft Product Terms |
| **~~OpenAI Standard API~~** | ~~Realtime API~~ | ✅ **MIGRATED TO AZURE** | N/A | N/A | No longer used |

---

## Vendor Details

### 1. ElevenLabs ✅

**Service:** Conversational AI Voice Agents
**Use Case:** Pre-visit diabetes education calls
**PHI Exposure:** Yes (patient conversations, health conditions)
**BAA Required:** Yes
**Status:** ✅ SIGNED

**Details:**
- Contract Type: Business Associate Agreement
- Signed Date: [Check PDF]
- Renewal: [Check PDF]
- Contact: [Check PDF]
- File Location: `/Users/rakeshpatel/Desktop/tshla-medical/legal-compliance/baas/elevenlabs-baa-2026.pdf`

**Services Covered:**
- Conversational AI agents
- Knowledge base for diabetes education
- Voice synthesis
- Call transcription storage

---

### 2. Deepgram ⏳

**Service:** Medical Speech-to-Text API
**Use Case:** Real-time clinical dictation, SOAP notes
**PHI Exposure:** Yes (clinical notes, patient names, conditions, medications)
**BAA Required:** Yes
**Status:** ⏳ PENDING VERIFICATION

**Action Required:**
1. Check if BAA was previously signed
2. If not signed, contact Deepgram to request BAA
3. Review and execute agreement
4. File signed copy

**Contact Information:**
- Website: https://deepgram.com
- Enterprise/Healthcare: https://deepgram.com/contact
- Email: [From their contact form]

**Checklist:**
- [ ] Verify existing BAA status
- [ ] Request BAA if not signed
- [ ] Legal review of BAA terms
- [ ] Execute BAA
- [ ] File signed copy
- [ ] Update this tracker with date and location

**Services Covered:**
- Real-time medical transcription (Nova-3 Medical model)
- Audio processing
- Transcription storage (if enabled)
- API access logs

---

### 3. Supabase ⏳

**Service:** PostgreSQL Database + Backend Infrastructure
**Use Case:** Primary storage for all patient data, appointments, clinical notes
**PHI Exposure:** Yes (ALL patient data stored here)
**BAA Required:** Yes (CRITICAL)
**Status:** ⏳ PENDING

**Action Required:**
1. Contact Supabase sales team
2. Request Team Plan + HIPAA add-on ($350/month)
3. Execute BAA
4. Enable HIPAA compliance mode in dashboard

**Contact Information:**
- Email: sales@supabase.com
- Subject: "HIPAA BAA Request for TSHLA Medical"
- Website: https://supabase.com/contact/sales

**Requirements:**
- Minimum Plan: Team Plan (~$25/month base)
- HIPAA Add-on: $350/month
- Total Cost: ~$375/month

**Checklist:**
- [ ] Contact Supabase sales
- [ ] Upgrade to Team Plan
- [ ] Request HIPAA add-on
- [ ] Legal review BAA terms
- [ ] Execute BAA
- [ ] Enable HIPAA mode in Supabase dashboard
- [ ] Configure High Compliance mode
- [ ] File signed copy
- [ ] Update this tracker

**Services Covered:**
- PostgreSQL database hosting
- Authentication (Supabase Auth)
- Row Level Security (RLS) - ✅ Already enabled
- Automatic backups
- Encryption at rest
- API access

---

## Compliance Checklist

### Technical Security ✅
- [x] Row Level Security (RLS) enabled on 39 PHI tables
- [x] Service role policies configured
- [x] Anonymous access blocked for PHI
- [x] Audit logging enabled
- [x] Encryption at rest (Supabase default)
- [x] HTTPS/TLS for all connections (default)

### Legal Compliance ⏳
- [x] ElevenLabs BAA signed
- [ ] Deepgram BAA verified/signed
- [ ] Supabase BAA signed
- [ ] HIPAA add-on enabled in Supabase
- [ ] All BAAs filed and accessible
- [ ] BAA renewal dates tracked

### Administrative ⏳
- [ ] HIPAA policies documented
- [ ] Staff training completed
- [ ] Incident response plan created
- [ ] Breach notification procedures documented
- [ ] Regular security audit schedule set

---

## File Organization

Recommended folder structure:

```
/Users/rakeshpatel/Desktop/tshla-medical/
└── legal-compliance/
    ├── baas/
    │   ├── elevenlabs-baa-2026.pdf ✅
    │   ├── deepgram-baa-[date].pdf (pending)
    │   └── supabase-baa-[date].pdf (pending)
    ├── policies/
    │   ├── hipaa-privacy-policy.pdf
    │   ├── hipaa-security-policy.pdf
    │   └── breach-notification-procedure.pdf
    ├── training/
    │   └── staff-hipaa-training-records.pdf
    └── audits/
        └── security-audit-[date].pdf
```

**Also backup to:**
- Google Drive / Dropbox / OneDrive
- Secure encrypted storage
- Off-site backup

---

## Important Reminders

### BAA Renewal
- Check renewal dates annually
- Set calendar reminders 30 days before expiration
- Review terms during renewal

### New Vendors
Before adding ANY new vendor that touches PHI:
1. Determine if they will access PHI
2. If yes → BAA is REQUIRED before use
3. Execute BAA before going live
4. Add to this tracker

### Audit Trail
Keep records of:
- All signed BAAs
- Correspondence about BAA requests
- Legal review notes
- Renewal dates and reminders

### HIPAA Violations
Not having a BAA with a vendor who processes PHI is a **HIPAA violation**:
- Penalties: $100-$50,000 per violation
- Annual maximum: Up to $1.5 million
- Possible criminal charges for willful neglect

---

## Contact Information

### TSHLA Medical
- Organization: [Your Organization Name]
- HIPAA Privacy Officer: [Name]
- Contact: [Email]
- Phone: [Phone]

### Legal Counsel
- Firm: [Law Firm Name]
- Attorney: [Name]
- Contact: [Email]
- Phone: [Phone]

---

## 4. Microsoft Azure ❓

**Service:** Azure OpenAI Service + Infrastructure
**Use Case:** Primary AI processing for clinical notes, Azure infrastructure
**PHI Exposure:** Yes (processes clinical notes, patient data)
**BAA Required:** Yes
**Status:** ❓ CHECK STATUS

**Action Required:**
1. Log into Azure Portal: https://portal.azure.com
2. Check Subscription → Policies → HIPAA/Healthcare compliance
3. Look for existing Microsoft BAA
4. If not found, contact Azure Support to request BAA

**Azure Resources:**
- **Azure OpenAI:** `tshla-openai-prod` (East US)
- **Container Apps:** `tshla-unified-api` (East US)
- **Storage:** (if configured for PHI)
- **Communication Services:** (if handling phone calls)

**Contact Information:**
- Azure Portal: https://portal.azure.com
- Azure Support: https://azure.microsoft.com/support
- HIPAA Docs: https://docs.microsoft.com/azure/compliance/hipaa

**Checklist:**
- [ ] Check Azure Portal for existing BAA
- [ ] Contact Azure Support if BAA not found
- [ ] Request BAA covering all Azure services
- [ ] Legal review of BAA terms
- [ ] Execute BAA
- [ ] File signed copy
- [ ] Update this tracker with date and location

**Services Covered by Microsoft BAA:**
- Azure OpenAI Service (primary AI processing)
- Azure Container Apps (backend hosting)
- Azure Storage (if storing PHI files)
- Azure Communication Services (if phone calls with PHI)
- All Azure infrastructure used for healthcare

**Important Note:**
ONE Microsoft BAA typically covers ALL Azure services you use.
You don't need separate BAAs for each Azure service.

---

## 5. OpenAI Platform API ❌

**Service:** Standard OpenAI API (platform.openai.com)
**Use Case:** Realtime API, PumpDrive scoring (backup/fallback)
**PHI Exposure:** Maybe (Realtime API for calls, PumpDrive recommendations)
**BAA Required:** Yes (if processing PHI)
**Status:** ❌ NOT AVAILABLE (Standard API)

**Problem:**
Standard OpenAI API does NOT offer BAA for regular accounts.
BAA only available for Enterprise customers.

**Current Usage:**
- OpenAI Realtime API (diabetes education phone calls)
- PumpDrive recommendation engine (stages 4, 5, 6)

**Options:**

### Option A: Migrate to Azure OpenAI (Recommended)
- Azure OpenAI now supports Realtime API
- Covered by Microsoft BAA
- More cost-effective
- Better integration with existing setup

### Option B: Get OpenAI Enterprise Plan
- Contact: https://openai.com/enterprise
- Cost: $$$$ (enterprise pricing)
- Timeline: 2-4 weeks
- Includes: BAA, dedicated support

### Option C: Ensure No PHI Processed
- Audit code to ensure standard OpenAI never sees PHI
- Document data flows
- May still need BAA for liability
- Risky approach

**Recommended Action:**
Migrate Realtime API usage to Azure OpenAI Service.
This gives you HIPAA compliance under your Microsoft BAA.

**Checklist:**
- [ ] Review current OpenAI API usage
- [ ] Determine if PHI is processed
- [ ] Choose migration strategy
- [ ] Implement solution (Azure migration recommended)
- [ ] Test thoroughly
- [ ] Document compliance approach

**References:**
- See: `OPENAI-SERVICES-ANALYSIS.md` for detailed breakdown
- Code: `server/openai-realtime-relay.js` (Realtime API)
- Code: `src/services/azureAI.service.ts` (Azure OpenAI)

---

## Next Actions

### This Week:
1. **Verify Deepgram BAA**
   - Check account/email for existing BAA
   - If not found, contact Deepgram support
   - Request HIPAA BAA documentation

2. **Contact Supabase**
   - Email sales@supabase.com
   - Request Team Plan + HIPAA add-on quote
   - Begin BAA execution process

### Within 2 Weeks:
3. **Execute Pending BAAs**
   - Complete legal review
   - Sign agreements
   - File copies securely

4. **Enable HIPAA Mode**
   - After Supabase BAA signed
   - Configure High Compliance mode
   - Verify all settings

### Ongoing:
5. **Maintain Compliance**
   - Monthly security reviews
   - Quarterly policy updates
   - Annual BAA renewals
   - Staff training updates

---

**Last Review Date:** January 8, 2026
**Next Review Due:** February 8, 2026
**Maintained By:** [Your Name]
