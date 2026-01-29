# Real-Time Medication & Lab Orders - Comprehensive Test Cases

## 🧪 Test Case 1: Diabetes Management Visit

```
Patient is a 62-year-old male with type 2 diabetes and hypertension here for follow-up. Blood pressure is 142/88 today, A1C is 8.2%.

MEDICATIONS:
Start Jardiance 10mg PO once daily in the morning, dispense 30 tablets, 2 refills, send to CVS pharmacy. Continue Metformin 1000mg PO twice daily with meals, quantity 60, refills 3, send to Walgreens. Increase Lisinopril from 10mg to 20mg once daily, dispense 30, refills 3, to CVS. Add Atorvastatin 40mg PO once nightly at bedtime, quantity 90, 3 refills, send to CVS.

LABS:
Order fasting glucose and A1C at Quest for 3 months. Get comprehensive metabolic panel at LabCorp today to check kidney function. Send fasting lipid panel to Quest. Order urine microalbumin at in-office lab.
```

**Expected Medications:**
- Jardiance 10mg • once daily PO • Qty: #30 • RF: 2 → CVS
- Metformin 1000mg • twice daily PO • Qty: #60 • RF: 3 → Walgreens
- Lisinopril 20mg • once daily PO • Qty: #30 • RF: 3 → CVS (MODIFIED)
- Atorvastatin 40mg • once nightly PO • Qty: #90 • RF: 3 → CVS

**Expected Lab Groups:**
- **Today @ LabCorp**: CMP
- **Today @ In-Office**: Urine Microalbumin
- **Future @ Quest**: Glucose (Fasting), A1C, Lipid Panel (Fasting)

---

## 🧪 Test Case 2: Acute Visit with STAT Labs

```
Patient presents with chest pain. EKG shows nonspecific ST changes.

MEDS:
Give Aspirin 325mg PO now, then 81mg daily, dispense 30, refills 3, send to CVS. Start Metoprolol 25mg PO twice daily, quantity 60, 2 refills, to Walgreens.

LABS:
Order STAT troponin at hospital lab. Get STAT BNP at hospital lab. Send CMP and CBC to LabCorp today. Order lipid panel at Quest for tomorrow.
```

**Expected Medications:**
- Aspirin 325mg • now PO • Qty: #30 • RF: 3 → CVS
- Aspirin 81mg • daily PO • Qty: #30 • RF: 3 → CVS
- Metoprolol 25mg • twice daily PO • Qty: #60 • RF: 2 → Walgreens

**Expected Lab Groups:**
- **🚨 Today - STAT @ Hospital Lab**: Troponin, BNP
- **⚡ Today @ LabCorp**: CMP, CBC
- **📋 Tomorrow @ Quest**: Lipid Panel

---

## 🧪 Test Case 3: Multiple Pharmacies & Specialty Meds

```
Patient with chronic conditions needs refills.

MEDICATIONS:
Prescribe Insulin Glargine 100 units/mL, 20 units subcutaneously at bedtime, quantity 1 vial, send to specialty pharmacy. Start Gabapentin 300mg PO three times daily, dispense 90 tablets, 2 refills, send to Costco. Continue Omeprazole 40mg PO once daily, quantity 30, refills 3, to Target. Add Montelukast 10mg PO nightly, disp 30, 3 refills, send to mail order pharmacy.

LABS:
Order A1C at Quest. Get TSH and free T4 at LabCorp. Send vitamin D level to in-office lab.
```

**Expected Medications:**
- Insulin Glargine 100 units/mL • at bedtime SC • Qty: #1 • RF: 0 → Specialty Pharmacy
- Gabapentin 300mg • three times daily PO • Qty: #90 • RF: 2 → Costco
- Omeprazole 40mg • once daily PO • Qty: #30 • RF: 3 → Target
- Montelukast 10mg • nightly PO • Qty: #30 • RF: 3 → Mail Order

**Expected Lab Groups:**
- **@ Quest**: A1C
- **@ LabCorp**: TSH, Free T4
- **@ In-Office**: Vitamin D

---

## 🧪 Test Case 4: Medication Changes & Cancellations

```
Patient tolerating medications poorly, making changes today.

Start Metformin 500mg twice daily, dispense 60, send to CVS. Actually, increase that Metformin to 1000mg. Also prescribe Lisinopril 10mg daily, quantity 30, refills 3, to Walgreens. Stop the Lisinopril due to cough. Instead, start Losartan 50mg once daily, disp 30, 3 refills, send to CVS.

Get CBC and CMP at LabCorp today.
```

**Expected Medications:**
- Metformin 1000mg • twice daily PO • Qty: #60 • RF: 0 → CVS (MODIFIED)
- Lisinopril 10mg (CANCELLED)
- Losartan 50mg • once daily PO • Qty: #30 • RF: 3 → CVS

**Expected Lab Groups:**
- **Today @ LabCorp**: CBC, CMP

---

## 🧪 Test Case 5: Thyroid Management

```
Patient with hypothyroidism for medication adjustment.

MEDS:
Increase Levothyroxine from 75mcg to 100mcg once daily before breakfast, dispense 90 tablets, 3 refills, send to CVS pharmacy.

LABS:
Order TSH, free T4, and free T3 at Quest for 6 weeks. Get comprehensive metabolic panel at LabCorp today.
```

**Expected Medications:**
- Levothyroxine 100mcg • once daily PO • Qty: #90 • RF: 3 → CVS (MODIFIED)

**Expected Lab Groups:**
- **Today @ LabCorp**: CMP
- **Future @ Quest**: TSH, Free T4, Free T3

---

## 🧪 Test Case 6: Complex Multi-Pharmacy Setup

```
Patient needs multiple medications sent to different pharmacies based on insurance.

Start Jardiance 25mg once daily, dispense 30, 2 refills, to CVS. Prescribe Trulicity 1.5mg subcutaneously once weekly, quantity 4 pens, send to specialty pharmacy. Add Metformin 1000mg twice daily, disp 60, 3 refills, to Walmart. Continue Glimepiride 2mg once daily before breakfast, quantity 30, refills 3, send to Kroger.

Order fasting glucose at Quest. Get A1C and CMP at LabCorp. Send lipid panel to Quest, fasting required.
```

**Expected Medications:**
- Jardiance 25mg • once daily PO • Qty: #30 • RF: 2 → CVS
- Trulicity 1.5mg • once weekly SC • Qty: #4 • RF: 0 → Specialty Pharmacy
- Metformin 1000mg • twice daily PO • Qty: #60 • RF: 3 → Walmart
- Glimepiride 2mg • once daily PO • Qty: #30 • RF: 3 → Kroger

**Expected Lab Groups:**
- **@ LabCorp**: A1C, CMP
- **@ Quest**: Glucose (Fasting), Lipid Panel (Fasting)

---

## 🧪 Test Case 7: Urgent vs Routine Labs

```
Patient with diabetes and new symptoms.

MEDS:
Continue current medications. No changes today.

LABS:
Order STAT glucose at hospital lab due to symptoms. Get urgent CBC and CMP at LabCorp today. Send routine A1C and lipid panel to Quest for next week. Order TSH at Quest, routine.
```

**Expected Medications:**
- None

**Expected Lab Groups:**
- **🚨 Today - STAT @ Hospital Lab**: Glucose
- **⚡ Today @ LabCorp**: CBC, CMP
- **📋 Next Week @ Quest**: A1C, Lipid Panel, TSH

---

## 🧪 Test Case 8: Mixed Route Medications

```
Patient needs various medication routes.

Start Albuterol inhaler 2 puffs every 4-6 hours as needed, dispense 1 inhaler, 2 refills, send to CVS. Prescribe Insulin Aspart 100 units/mL, 6 units subcutaneously before meals, quantity 2 vials, send to specialty pharmacy. Add Timolol 0.5% eye drops, 1 drop in each eye twice daily, disp 1 bottle, 3 refills, to Walgreens. Continue Prednisone 10mg PO once daily, quantity 30, refills 1, send to CVS.

Get CBC and CMP at LabCorp today.
```

**Expected Medications:**
- Albuterol inhaler • every 4-6 hours as needed Inhaled • Qty: #1 • RF: 2 → CVS
- Insulin Aspart 100 units/mL • before meals SC • Qty: #2 • RF: 0 → Specialty Pharmacy
- Timolol 0.5% • twice daily Ophthalmic • Qty: #1 • RF: 3 → Walgreens
- Prednisone 10mg • once daily PO • Qty: #30 • RF: 1 → CVS

**Expected Lab Groups:**
- **Today @ LabCorp**: CBC, CMP

---

## 🧪 Test Case 9: Refill-Only Visit

```
Patient here for medication refills only, all working well.

MEDICATIONS:
Refill Metformin 1000mg twice daily, dispense 60 tablets, 3 refills, send to CVS. Refill Lisinopril 20mg once daily, quantity 30, 3 refills, to CVS. Refill Atorvastatin 40mg nightly, disp 90, 3 refills, send to CVS.

LABS:
Order fasting glucose, A1C, and lipid panel at Quest for 3 months.
```

**Expected Medications:**
- Metformin 1000mg • twice daily PO • Qty: #60 • RF: 3 → CVS
- Lisinopril 20mg • once daily PO • Qty: #30 • RF: 3 → CVS
- Atorvastatin 40mg • nightly PO • Qty: #90 • RF: 3 → CVS

**Expected Lab Groups:**
- **Future @ Quest**: Glucose (Fasting), A1C, Lipid Panel (Fasting)

---

## 🧪 Test Case 10: Kitchen Sink - Everything at Once

```
Complex patient with multiple issues requiring extensive orders.

MEDICATIONS:
Start Jardiance 10mg once daily in AM, dispense 30, 2 refills, CVS. Increase Metformin to 1000mg twice daily, quantity 60, 3 refills, Walgreens. Continue Lisinopril 20mg daily, disp 30, 3 refills, CVS. Add Atorvastatin 40mg nightly, quantity 90, 3 refills, CVS. Prescribe Gabapentin 300mg three times daily, disp 90, 2 refills, Target. Start Omeprazole 20mg daily, quantity 30, 3 refills, CVS. Add Montelukast 10mg nightly, disp 30, 3 refills, mail order.

LABS:
Order STAT troponin at hospital lab. Get urgent CBC, CMP, and lipid panel at LabCorp today. Send A1C, TSH, and vitamin D to Quest for tomorrow. Order urinalysis and urine microalbumin at in-office lab. Get liver function tests at LabCorp today. Send hemoglobin A1C to Quest, fasting required.
```

**Expected Medications (7 total):**
- Jardiance 10mg • once daily PO • Qty: #30 • RF: 2 → CVS
- Metformin 1000mg • twice daily PO • Qty: #60 • RF: 3 → Walgreens
- Lisinopril 20mg • daily PO • Qty: #30 • RF: 3 → CVS
- Atorvastatin 40mg • nightly PO • Qty: #90 • RF: 3 → CVS
- Gabapentin 300mg • three times daily PO • Qty: #90 • RF: 2 → Target
- Omeprazole 20mg • daily PO • Qty: #30 • RF: 3 → CVS
- Montelukast 10mg • nightly PO • Qty: #30 • RF: 3 → Mail Order

**Expected Lab Groups:**
- **🚨 Today - STAT @ Hospital Lab**: Troponin
- **⚡ Today @ LabCorp**: CBC, CMP, Lipid Panel, LFT
- **📋 Today @ In-Office**: Urinalysis, Urine Microalbumin
- **📋 Tomorrow @ Quest**: A1C (Fasting), TSH, Vitamin D, Hemoglobin A1C (Fasting)

---

## 🎯 Testing Checklist

For each test case, verify:

### Medications:
- [ ] Drug name extracted correctly
- [ ] Dosage captured (mg, mcg, units)
- [ ] Frequency parsed (once daily, twice daily, etc.)
- [ ] Route identified (PO, SC, Inhaled, etc.)
- [ ] Quantity extracted (#30, #60, #90, etc.)
- [ ] Refills captured (0-3+)
- [ ] Pharmacy assigned correctly
- [ ] Modifications detected (MODIFIED badge)
- [ ] Cancellations detected (CANCELLED section)
- [ ] Delete button works
- [ ] Copy button works

### Labs:
- [ ] Test name extracted fully (not fragments)
- [ ] Grouped by date AND location
- [ ] STAT labs show first with red background
- [ ] Urgent labs show with orange background
- [ ] Routine labs show with blue background
- [ ] Fasting indicator appears when mentioned
- [ ] Location extracted (Quest, LabCorp, In-Office, Hospital Lab, etc.)
- [ ] Each lab on separate line within group
- [ ] Delete button works per lab
- [ ] Copy button works
- [ ] Groups sorted by urgency

---

## 💡 Tips for Testing:

1. **Copy the entire block** from "Patient is..." through the end
2. **Paste into the transcript box** on http://localhost:5173/quick-note
3. **Watch real-time extraction** as text appears
4. **Try delete buttons** - click trash icon to remove items
5. **Try copy buttons** - copy individual items or "Copy All"
6. **Test modifications** - Add text like "Actually, increase Metformin to 2000mg"
7. **Test cancellations** - Add text like "Stop the Lisinopril"

---

## 🐛 Known Limitations:

- Very complex sentence structures may confuse parser
- Non-standard medication names might not be detected
- Pharmacy extraction requires explicit mention ("send to CVS")
- Lab location extraction requires "at" or "to" keywords
- Numeric dosages only (not "one tablet")

---

**Ready to test!** Start with Test Case 1 and work your way up to the complex ones! 🚀
