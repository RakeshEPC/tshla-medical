# Azure BAA Evidence Collection Checklist

**Purpose:** Gather proof of Microsoft Azure BAA coverage for external parties
**Date:** January 8, 2026

---

## 📸 Screenshots to Collect from Azure Portal

### 1. Azure Subscription Overview
**Location:** Azure Portal → Subscriptions
**Screenshot should show:**
- ✅ Subscription ID
- ✅ Subscription Name
- ✅ Status (Active)
- ✅ Your organization name
- ✅ Start date

**Why:** Proves you have an active Azure subscription

---

### 2. Azure OpenAI Resource
**Location:** Azure Portal → Resource Groups → [Your RG] → tshla-openai-prod
**Screenshot should show:**
- ✅ Resource name: `tshla-openai-prod`
- ✅ Resource type: Azure OpenAI Service
- ✅ Location: East US
- ✅ Status: Running
- ✅ Endpoint URL

**Why:** Proves you're using Azure OpenAI for healthcare

---

### 3. Service Health & Compliance
**Location:** Azure Portal → Service Health → Planned Maintenance
**Screenshot should show:**
- ✅ Service Health dashboard
- ✅ Compliance tab (if available)
- ✅ Your resources listed

**Why:** Shows ongoing Azure service relationship

---

### 4. Microsoft Entra ID (Azure AD) Overview
**Location:** Azure Portal → Microsoft Entra ID → Properties
**Screenshot should show:**
- ✅ Tenant/Directory name
- ✅ Tenant ID
- ✅ Your organization details

**Why:** Proves organizational relationship with Microsoft

---

## 📄 Documents to Download

### Document Package for External Party

Create a folder with these files:

```
Azure-BAA-Documentation/
├── 1-Microsoft-Product-Terms.pdf
├── 2-Data-Protection-Addendum.pdf
├── 3-Azure-HIPAA-Overview.pdf
├── 4-BAA-Attestation-Letter.pdf (signed)
├── 5-Azure-Subscription-Proof.pdf
├── 6-Resource-List.pdf
└── README.txt
```

---

## 📥 How to Download Each Document

### **1. Microsoft Product Terms**

**Steps:**
1. Go to: https://www.microsoft.com/licensing/terms
2. Click: "Product Terms"
3. Select: "Download Product Terms"
4. Choose: Current version (latest date)
5. Save as: `Microsoft-Product-Terms-[Date].pdf`

**What to highlight:**
- Section referencing "Data Protection Addendum"
- HIPAA BAA automatic inclusion
- Azure OpenAI Service coverage

---

### **2. Data Protection Addendum (DPA)**

**Steps:**
1. Go to: https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA
2. Click: "Download" or "View PDF"
3. Save as: `Microsoft-DPA-HIPAA-BAA.pdf`

**What to highlight:**
- Appendix 3: Security Measures
- HIPAA/HITECH compliance provisions
- Business Associate obligations

---

### **3. Azure HIPAA Overview**

**Option A - Official Page:**
1. Go to: https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-hipaa-us
2. Print to PDF or save webpage
3. Save as: `Azure-HIPAA-Compliance-Overview.pdf`

**Option B - Trust Center:**
1. Go to: https://servicetrust.microsoft.com
2. Search: "HIPAA"
3. Download: Azure HIPAA compliance documents
4. Save as: `Azure-HIPAA-Service-Trust.pdf`

---

### **4. BAA Attestation Letter**

**Steps:**
1. Use template: `Microsoft-BAA-Attestation-Template.md`
2. Fill in your organization details:
   - Organization name
   - Azure subscription ID
   - Resource names (`tshla-openai-prod`, etc.)
   - Your name and title
   - Date
3. Have authorized person sign
4. Convert to PDF
5. Save as: `BAA-Attestation-Letter-[YourOrg]-[Date].pdf`

---

### **5. Azure Subscription Proof**

**Steps:**
1. Azure Portal → Subscriptions
2. Click your subscription
3. Take screenshot or export details
4. **Redact sensitive info:**
   - ❌ Billing details
   - ❌ API keys
   - ❌ Passwords
   - ✅ Keep: Subscription ID, Name, Status
5. Save as: `Azure-Subscription-Proof.pdf`

---

### **6. Resource List**

Create a document listing your Azure resources:

```markdown
# Azure Resources Used for Healthcare (PHI Processing)

**Organization:** [Your Org]
**Date:** [Date]

## Resources Covered by Microsoft BAA

1. **Azure OpenAI Service**
   - Resource Name: tshla-openai-prod
   - Resource Type: Azure OpenAI
   - Location: East US
   - Purpose: AI processing of clinical notes
   - PHI Processed: Yes

2. **Azure Container Apps**
   - Resource Name: tshla-unified-api
   - Resource Type: Container Apps
   - Location: East US
   - Purpose: Backend API hosting
   - PHI Processed: Yes

3. **Azure Storage** (if applicable)
   - Resource Name: [Your storage name]
   - Purpose: File storage
   - PHI Processed: [Yes/No]

4. **Azure Communication Services** (if applicable)
   - Purpose: Phone communications
   - PHI Processed: [Yes/No]

All resources listed above are covered by the Microsoft Business Associate
Agreement through the Microsoft Product Terms and Data Protection Addendum.
```

Save as: `Azure-Resource-List.pdf`

---

### **7. README.txt**

Include a README file explaining the documentation:

```
Azure HIPAA BAA Documentation Package
======================================

This package contains evidence that [Your Organization] has a valid Business
Associate Agreement (BAA) with Microsoft Corporation for the use of Microsoft
Azure services in compliance with HIPAA.

Contents:
---------
1. Microsoft-Product-Terms.pdf
   - Official Microsoft licensing terms
   - Shows HIPAA BAA is included by default

2. Data-Protection-Addendum.pdf
   - The actual BAA language and provisions
   - Includes HIPAA-specific security measures

3. Azure-HIPAA-Overview.pdf
   - Azure's HIPAA compliance documentation
   - Explains how Azure supports HIPAA compliance

4. BAA-Attestation-Letter.pdf
   - Signed attestation from our organization
   - Confirms our acceptance of Microsoft BAA terms

5. Azure-Subscription-Proof.pdf
   - Proof of active Azure subscription
   - Shows our organizational relationship with Microsoft

6. Resource-List.pdf
   - List of Azure resources processing PHI
   - All covered under Microsoft BAA

Key Points:
-----------
✓ Microsoft's BAA is automatic for all HIPAA-covered customers
✓ No separate signature required
✓ Included via Microsoft Product Terms and DPA
✓ Covers all Azure services we use
✓ Updated automatically with Azure subscription

For Questions:
--------------
Contact: [Your Name]
Email: [Your Email]
Phone: [Your Phone]

Date Prepared: [Date]
Valid As Of: [Date]
```

---

## 🎯 Quick Response Package (Minimum Requirements)

**If the requesting party just needs quick proof, send:**

1. **Email with these 3 attachments:**
   - Microsoft DPA/HIPAA BAA (PDF)
   - Azure HIPAA Overview (PDF)
   - Your signed attestation letter (PDF)

2. **Email body:**

```
Subject: Microsoft Azure HIPAA BAA Documentation - [Your Organization]

Dear [Name],

As requested, please find attached documentation confirming that [Your Organization]
has a valid HIPAA Business Associate Agreement (BAA) with Microsoft Corporation for
our use of Microsoft Azure services.

Key Points:
• Microsoft's BAA is incorporated automatically through the Microsoft Product Terms
  and Data Protection Addendum (DPA)
• This applies to all Azure services we use, including Azure OpenAI Service
• No separate BAA signature is required per Microsoft's standard business practices
• Documentation: https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/use-your-data-securely

Attachments:
1. Microsoft Data Protection Addendum (contains BAA provisions)
2. Azure HIPAA Compliance Overview
3. Signed attestation letter from our organization

Azure Resources Covered:
• Azure OpenAI Service (tshla-openai-prod)
• Azure Container Apps (tshla-unified-api)
• [Other resources if applicable]

Please let me know if you need any additional information or clarification.

Best regards,
[Your Name]
[Your Title]
[Your Organization]
[Contact Info]
```

---

## ✅ Verification Checklist

Before sending to external party, verify:

- [ ] All documents are current/up-to-date
- [ ] Attestation letter is signed by authorized person
- [ ] Sensitive information is redacted (billing, keys, etc.)
- [ ] Organization name is consistent across all documents
- [ ] Azure subscription ID matches everywhere
- [ ] Resource names are accurate
- [ ] Contact information is correct
- [ ] All PDFs are readable and formatted properly
- [ ] File names are professional (no spaces, clear naming)
- [ ] Package is organized in logical folder structure

---

## 📋 Common Requesting Parties & Their Requirements

### **Insurance Companies**
**Usually need:**
- Attestation letter (signed)
- Microsoft DPA/BAA
- List of Azure resources processing their data

### **Healthcare Partners / Other Providers**
**Usually need:**
- Attestation letter
- Azure HIPAA overview
- Proof of active Azure subscription

### **Auditors / Compliance Officers**
**Usually need:**
- Complete documentation package (all 6 documents)
- Azure Portal screenshots
- Resource list with data flow diagram

### **Legal Teams**
**Usually need:**
- Full Microsoft Product Terms
- Complete DPA with all appendices
- Signed attestation on letterhead

---

## 💡 Pro Tips

1. **Keep a "ready-to-send" folder** with all these documents updated
2. **Update quarterly** when Microsoft releases new terms
3. **Get attestation letter signed in advance** by authorized person
4. **Use company letterhead** for professional appearance
5. **Redact carefully** - never share sensitive credentials
6. **Keep original sources** - link to Microsoft's official pages
7. **Version control** - date all documents clearly

---

**Questions?** See main documentation: `HIPAA-BAA-TRACKER.md`

**Last Updated:** January 8, 2026
**Next Review Due:** April 8, 2026 (quarterly)
