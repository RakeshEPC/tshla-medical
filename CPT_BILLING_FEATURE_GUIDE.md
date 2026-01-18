# Automatic CPT Billing Feature - Complete Guide

## Overview

The TSHLA Medical App now automatically generates CPT (Current Procedural Terminology) billing suggestions at the end of every clinical note! This feature analyzes your dictation to suggest appropriate E&M (Evaluation and Management) codes based on visit complexity and time spent.

## What It Does

### Automatic Analysis
The system analyzes every dictated note for:
1. **Time spent** - Extracts phrases like "spent 35 minutes", "total time 40 minutes"
2. **Problem complexity** - Counts problems addressed and chronic conditions
3. **Data reviewed** - Identifies labs ordered, imaging, external records
4. **Clinical risk** - Assesses medication complexity and condition severity
5. **Medical Decision Making (MDM)** - Determines overall complexity level

### What Gets Added to Every Note

At the end of each processed note, you'll see a billing section that includes:

```
═══════════════════════════════════════════════════════
BILLING INFORMATION (AI-GENERATED)
═══════════════════════════════════════════════════════

POSSIBLE CPT CODES FOR THIS VISIT:

Primary Recommendation: 99214
  • Office/Outpatient Visit, Established Patient (30-39 min)
  • Time Range: 30-39 minutes
  • Complexity: MODERATE
  • Confidence: 95%

Medical Decision Making (MDM) Justification:
  • Problems addressed: 2
  • Data reviewed/ordered: 3 items
  • Risk level: MODERATE
  • Medication changes: 2
  • Chronic conditions managed: 2

Alternative Codes to Consider:
  • 99215 - If time >40 min or higher complexity documented
    Reason: Higher level if additional counseling documented
  • 99213 - If time <30 min or lower complexity
    Reason: Conservative coding option

SUPPORTING DOCUMENTATION:
✓ Chief complaint documented
✓ Assessment with diagnosis codes present
✓ Treatment plan documented
✓ Follow-up plan included
✓ Time spent documented

ICD-10 Diagnosis Code Suggestions:
  ✓✓ E11.65 - Type 2 Diabetes Mellitus with hyperglycemia
  ✓✓ E03.9 - Hypothyroidism, unspecified
  ✓✓ R11.2 - Nausea with vomiting

⚠ DISCLAIMER: AI-generated billing codes for reference only.
   Provider must verify accuracy and appropriateness before billing.
   Ensure all documentation supports the selected code.
```

## How Time-Based Billing Works

### Best Practice: Dictate Time Spent

For most accurate billing, **say the time spent** in your dictation:

**Example phrases:**
- "Total time 35 minutes"
- "Spent 40 minutes with this patient"
- "Face-to-face time 25 minutes"
- "Counseling time 30 minutes"

### Time-to-CPT Mapping

| Time Spent | CPT Code | Description | Confidence |
|------------|----------|-------------|------------|
| 10-19 min  | 99212 | Straightforward, minimal complexity | 90% |
| 20-29 min  | 99213 | Low to moderate complexity | 95% |
| 30-39 min  | 99214 | Moderate complexity | 95% |
| 40-54 min  | 99215 | High complexity | 95% |
| 55+ min    | 99215 + prolonged | Consider adding 99417 | 90% |

**Note:** When time is documented, confidence scores are higher (90-95%)

## Complexity-Based Billing (When Time Not Stated)

If you don't mention time, the system analyzes complexity:

### Complexity Scoring Algorithm

**Problem Count:**
- 1 simple problem = +1 point
- 2+ problems = +2-3 points
- "Multiple chronic conditions" phrase = +1 bonus point

**Data Points:**
- Each lab ordered (CMP, CBC, A1C, etc.) = +1 point
- Each imaging ordered = +1 point
- Review of external records = +2 points

**Risk Assessment:**
- Insulin changes = +2 points
- Starting new medication = +1 point
- 2+ medication changes = +1 point
- Uncontrolled chronic disease = +2 points
- 3+ conditions = +1 point

**Total Complexity:**
- 0-1 points = Minimal (99212)
- 2-4 points = Low (99213)
- 5-7 points = Moderate (99214)
- 8+ points = High (99215)

**Note:** Complexity-based codes have lower confidence (60-75%)

## ICD-10 Code Suggestions

The system automatically suggests diagnosis codes based on your assessment:

### Supported Conditions

| Condition | ICD-10 Code | Confidence |
|-----------|-------------|------------|
| Type 2 Diabetes (controlled) | E11.9 | High |
| Type 2 Diabetes (uncontrolled) | E11.65 | High |
| Hypothyroidism | E03.9 | High |
| Hyperthyroidism | E05.90 | High |
| Hypertension | I10 | High |
| Nausea with vomiting | R11.2 | High |
| Nausea only | R11.0 | Medium |
| Obesity | E66.9 | Medium |
| Prediabetes | R73.03 | High |

### Confidence Levels

- **✓✓ High confidence**: Pattern clearly matched in note
- **✓ Medium confidence**: Likely but needs verification
- **○ Low confidence**: Consider, but verify carefully

## Template Configuration

Each template can customize billing behavior:

### Default Configuration (All Templates)

```typescript
billingConfig: {
  enabled: true,              // Show billing section
  includeICD10: true,         // Include diagnosis code suggestions
  includeTimeTracking: true,  // Encourage time documentation
  customInstructions: ''      // Optional specialty-specific notes
}
```

### Disable Billing for Specific Templates

```typescript
billingConfig: {
  enabled: false  // Won't show billing section
}
```

### Specialty-Specific Configuration

**Diabetes Template:**
```typescript
billingConfig: {
  enabled: true,
  includeICD10: true,
  includeTimeTracking: true,
  customInstructions: 'Track time spent on diabetes education and device training for accurate billing'
}
```

## Examples

### Example 1: Time-Based High Complexity Visit

**Dictation:**
> "Patient comes in with nausea and vomiting for two weeks. Started on Mounjaro two weeks ago. Blood sugars were running in the 300s, now in the 200s. Also has hypothyroidism. We're stopping the Mounjaro. Going to restart him on Lantus 30 units daily and NovoLog 10 units with each meal. I'll order a CMP, CBC, A1C, and microalbumin. Follow up in two weeks. **Total time spent: 40 minutes.**"

**Billing Output:**
```
Primary Recommendation: 99215
  • Time: 40 minutes documented
  • Complexity: HIGH
  • Confidence: 95%

Medical Decision Making:
  • Problems addressed: 3
  • Data reviewed/ordered: 4 items
  • Risk level: HIGH
  • Medication changes: 3
  • Chronic conditions: 2

ICD-10 Suggestions:
  ✓✓ E11.65 - Type 2 Diabetes with hyperglycemia
  ✓✓ E03.9 - Hypothyroidism
  ✓✓ R11.2 - Nausea with vomiting
```

### Example 2: Complexity-Based (No Time Mentioned)

**Dictation:**
> "Patient in for routine thyroid check. TSH is 2.5, patient feels fine. Continue levothyroxine 100 mcg. Recheck in 6 months."

**Billing Output:**
```
Primary Recommendation: 99213
  • Time not documented - complexity-based
  • Complexity: LOW
  • Confidence: 65%

Medical Decision Making:
  • Problems addressed: 1
  • Data reviewed/ordered: 0 items
  • Risk level: LOW

⚠ Consider documenting: Total time spent for more accurate billing
```

### Example 3: Moderate Complexity with Labs

**Dictation:**
> "Diabetes follow-up. A1C is 8.5, up from 7.2. Patient admits not taking metformin regularly. We'll increase metformin to 1000 mg twice daily. Also ordering lipid panel and microalbumin. See back in 3 months. Spent 25 minutes."

**Billing Output:**
```
Primary Recommendation: 99213
  • Time: 25 minutes documented
  • Complexity: MODERATE
  • Confidence: 95%

Medical Decision Making:
  • Problems addressed: 1
  • Data reviewed/ordered: 2 items
  • Risk level: MODERATE
  • Medication changes: 1

ICD-10 Suggestions:
  ✓✓ E11.9 - Type 2 Diabetes Mellitus
```

## Important Disclaimers

### Legal & Compliance

1. **AI-Generated = Reference Only**: These are suggestions, not billing instructions
2. **Provider Responsibility**: You must verify codes match your documentation
3. **Payer Requirements**: Different payers may have different rules
4. **Audit Trail**: All billing decisions should be defensible
5. **No Guarantee**: System cannot guarantee payment or audit protection

### When to Override

You should manually adjust the suggested code if:
- Patient is **new** (not established) - use 99201-99205 range
- Significant **counseling** time not captured (>50% of visit)
- **Preventive visit** component (use 99381-99397)
- **Medicare Annual Wellness Visit** (use G0438/G0439)
- **Complexity underestimated** by the system
- **Payer-specific requirements** differ

## Best Practices

### For Maximum Accuracy

1. **Always dictate time spent**: "Total time 35 minutes"
2. **State problems clearly**: "Type 2 diabetes, hypothyroidism, nausea"
3. **Mention all labs/imaging**: "Ordering CMP, CBC, and A1C"
4. **Document medication changes**: "Increasing Lantus to 40 units"
5. **Note counseling time**: "Spent 15 minutes on insulin education"

### Review Before Billing

**Always check:**
- [ ] Time documented accurately reflects visit
- [ ] All problems addressed are in assessment
- [ ] Treatment plan matches complexity level
- [ ] ICD-10 codes match actual diagnoses
- [ ] Code level justified by documentation

### Audit Protection

**Document these elements:**
- Chief complaint
- Review of systems (if applicable)
- Physical exam findings
- Assessment with diagnoses
- Plan with specifics
- Follow-up instructions
- Time spent (if time-based coding)

## Technical Details

### Files Modified

1. **`src/services/cptBillingAnalyzer.service.ts`** (NEW)
   - Main analysis engine
   - 800+ lines of billing logic
   - Complexity scoring algorithms

2. **`src/services/enhancedTemplateProcessor.service.ts`**
   - Added billing section generation
   - Integrated CPT analyzer

3. **`src/services/cleanTemplateProcessor.service.ts`**
   - Added billing for simple templates
   - Basic extraction logic

4. **`src/types/template.types.ts`**
   - Added `BillingConfiguration` interface
   - Template-level billing config

5. **`src/lib/templates/defaultTemplates.ts`**
   - All 6 templates now include `billingConfig`
   - Billing enabled by default

### Confidence Score Calculation

```typescript
if (timeSpent !== null) {
  // Time-based coding
  if (timeInRange && complexityMatches) {
    confidence = 95%
  } else if (timeInRange) {
    confidence = 90%
  }
} else {
  // Complexity-based coding
  if (complexityLevel === 'high') {
    confidence = 75%
  } else if (complexityLevel === 'moderate') {
    confidence = 70%
  } else {
    confidence = 60-65%
  }
}
```

## FAQ

### Q: Does this automatically bill my patients?
**A:** No! This only suggests codes. You must review and submit billing manually.

### Q: What if the suggested code seems wrong?
**A:** Trust your clinical judgment. The system is a suggestion tool, not a decision-maker.

### Q: Can I turn off billing suggestions?
**A:** Yes, set `billingConfig.enabled: false` in the template.

### Q: Does it work for new patients?
**A:** The algorithm assumes established patients. For new patients, use 99201-99205 codes.

### Q: What about preventive visits?
**A:** System focuses on problem-focused visits. Use 99381-99397 for preventive care.

### Q: Can it handle multiple visits in one day?
**A:** Each note is analyzed independently. Use modifier -25 if billing separate E&M same day.

### Q: Does it account for modifiers?
**A:** No. You'll need to add modifiers (-25, -57, etc.) manually.

### Q: What if I do a procedure during the visit?
**A:** Add the procedure code separately. The E&M code may need modifier -25.

## Future Enhancements (Planned)

- [ ] Learning from provider corrections
- [ ] Specialty-specific code sets (99213-99215 + specialty procedures)
- [ ] New patient detection
- [ ] Modifier suggestions
- [ ] Prolonged service code automation (99417)
- [ ] Payer-specific rules
- [ ] Billing confidence trends over time
- [ ] Integration with billing software

## Support

If you have questions or need billing guidance:
1. Consult your practice's billing specialist
2. Review CMS E&M guidelines
3. Check payer-specific requirements
4. Consider professional coding consultation for complex cases

---

**Version:** 1.0
**Last Updated:** January 2026
**Author:** TSHLA Medical Development Team

**Remember:** This tool assists with documentation and coding suggestions. Final billing decisions are the provider's responsibility and must comply with applicable regulations and payer requirements.
