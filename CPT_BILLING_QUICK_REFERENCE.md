# CPT Billing - Quick Reference Card

## 🎯 Quick Summary

**Every dictated note now includes automatic CPT and ICD-10 billing suggestions!**

## ⏱️ For Best Results: Dictate Time

Say one of these phrases in your dictation:
- "**Total time 25 minutes**"
- "**Spent 35 minutes**"
- "**40 minute visit**"
- "**Face-to-face time 30 minutes**"

## 📊 CPT Code Reference

### Established Patient Office Visits

| Code | Time | Typical Complexity | When to Use |
|------|------|-------------------|-------------|
| **99212** | 10-19 min | Minimal/Low | Simple follow-up, stable condition |
| **99213** | 20-29 min | Low-Moderate | 1-2 problems, basic labs, few medication changes |
| **99214** | 30-39 min | Moderate | Multiple problems, several labs, medication adjustments |
| **99215** | 40-54 min | High | Complex/uncontrolled conditions, extensive workup |

**Note:** For visits >54 minutes, consider adding prolonged service code 99417

## 🔍 What Makes a Visit Complex?

### Higher Complexity If You:
- ✅ Address **3+ problems**
- ✅ Order **4+ labs/imaging**
- ✅ Make **2+ medication changes**
- ✅ Start/adjust **insulin**
- ✅ Manage **uncontrolled chronic conditions**
- ✅ Review **external records**

### Lower Complexity If:
- ⏺ Single stable condition
- ⏺ No labs ordered
- ⏺ No medication changes
- ⏺ Brief follow-up

## 📋 Common ICD-10 Codes (Auto-Suggested)

| Condition | ICD-10 | When Detected |
|-----------|--------|---------------|
| Type 2 Diabetes (controlled) | E11.9 | "diabetes" mentioned |
| Type 2 Diabetes (uncontrolled) | E11.65 | "uncontrolled diabetes" or high blood sugar |
| Hypothyroidism | E03.9 | "hypothyroid" or "thyroid" |
| Hypertension | I10 | "hypertension" or "high blood pressure" |
| Nausea with vomiting | R11.2 | "nausea and vomiting" |
| Obesity | E66.9 | "obesity" or "obese" |

## 💡 Pro Tips

### Maximize Accuracy
1. **Always state time spent** → Gets you 95% confidence
2. **List all problems** → "diabetes, hypothyroid, and hypertension"
3. **Name specific labs** → "ordering CMP, CBC, and A1C"
4. **State medication changes clearly** → "increasing Lantus to 40 units"

### Review Before Billing
**Check that:**
- [ ] Time matches actual visit duration
- [ ] Code level fits visit complexity
- [ ] All diagnosis codes present in note
- [ ] Documentation supports MDM justification

## ⚠️ Important Reminders

### Always Remember:
- ✋ **AI suggestions are REFERENCE ONLY**
- ✋ **YOU make the final billing decision**
- ✋ **Review for accuracy before submitting**
- ✋ **Ensure documentation supports code**

### Not Covered (Yet):
- ❌ **New patients** (use 99201-99205 manually)
- ❌ **Preventive visits** (use 99381-99397 manually)
- ❌ **Annual wellness visits** (use G0438/G0439)
- ❌ **Procedures** (add separately with modifier -25)

## 📖 Reading the Billing Section

### Sample Output Breakdown

```
Primary Recommendation: 99214                    ← Main suggested code
  • Time Range: 30-39 minutes                    ← Why this code
  • Complexity: MODERATE                         ← Complexity level
  • Confidence: 95%                              ← How confident (higher = better)

Medical Decision Making (MDM) Justification:
  • Problems addressed: 2                        ← Problems in note
  • Data reviewed/ordered: 3 items               ← Labs/imaging count
  • Risk level: MODERATE                         ← Clinical risk
  • Medication changes: 2                        ← Med changes count
  • Chronic conditions managed: 2                ← Chronic disease count

Alternative Codes to Consider:                   ← Other options
  • 99215 - If time >40 min                     ← When to use instead
  • 99213 - If time <30 min                     ← Conservative option

SUPPORTING DOCUMENTATION:
✓ Chief complaint documented                    ← Required elements present
✓ Assessment present                            ← ✓ = Good, ⚠ = Missing
✓ Plan documented
✓ Time spent documented                         ← Boosts confidence

ICD-10 Diagnosis Code Suggestions:
  ✓✓ E11.9 - Type 2 Diabetes                   ← ✓✓ = High confidence
  ✓  E03.9 - Hypothyroidism                     ← ✓ = Medium confidence
```

## 🚦 Confidence Levels Explained

| Confidence | Meaning | When You See It |
|------------|---------|----------------|
| **90-95%** | Very Reliable | Time documented + complexity clear |
| **70-80%** | Fairly Reliable | Complexity-based, no time stated |
| **60-70%** | Use Caution | Simple visit, limited data |

**Rule:** Higher confidence = more likely to be accurate

## 📞 When to Seek Guidance

**Consult your billing team if:**
- Code suggestion seems way off
- Unsure about new vs established patient
- Visit included procedures
- Multiple visits same day
- Medicare annual wellness visit
- Payer has specific requirements

## 🎓 Quick Training Scenarios

### Scenario 1: Simple Follow-Up
**Dictation:** *"Diabetes check, A1C 7.0, doing well, continue all meds, spent 15 minutes."*

**Expected Result:**
- Code: **99212** (simple, 15 min)
- ICD-10: E11.9
- Confidence: 95%

### Scenario 2: Moderate Complexity
**Dictation:** *"Type 2 diabetes and hypothyroid follow-up. A1C 8.0, TSH 3.2. Increase metformin to 1000 mg twice daily. Order lipid panel. Spent 25 minutes."*

**Expected Result:**
- Code: **99213** (2 problems, 1 med change, 25 min)
- ICD-10: E11.9, E03.9
- Confidence: 95%

### Scenario 3: High Complexity
**Dictation:** *"Uncontrolled diabetes with sugars in 300s. Started Mounjaro 2 weeks ago, now has nausea and vomiting. Stop Mounjaro. Start Lantus 30 units and NovoLog 10 units with meals. Order CMP, CBC, A1C, microalbumin. 40 minute visit."*

**Expected Result:**
- Code: **99215** (3 problems, 3 med changes, 4 labs, 40 min)
- ICD-10: E11.65, R11.2
- Confidence: 95%

## ✅ Daily Workflow

### Morning:
1. Start dictation as usual
2. **Mention time at end** of dictation
3. Review processed note

### After Dictation:
1. Check billing section at end of note
2. Verify code matches visit
3. Confirm ICD-10 codes accurate
4. Note any adjustments needed

### Before Submitting Bills:
1. Final review of documentation
2. Confirm code justified
3. Add modifiers if needed
4. Submit to billing system

---

## 📚 Full Documentation

For complete details, see:
- **User Guide:** `CPT_BILLING_FEATURE_GUIDE.md`
- **Implementation Summary:** `CPT_BILLING_IMPLEMENTATION_SUMMARY.md`

## 🆘 Need Help?

1. Check the user guide
2. Consult billing team
3. Review CMS E&M guidelines
4. Ask practice administrator

---

**Remember:** This tool helps you code accurately and defend your billing. It's a suggestion engine, not a replacement for clinical judgment!

**Version 1.0** | **Last Updated:** January 2026
