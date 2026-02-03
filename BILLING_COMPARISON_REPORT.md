# CPT Billing Comparison Report
## OLD (Non-Compliant) vs. NEW (CMS 2021 Compliant)

**Test Date:** 2026-02-03
**Notes Analyzed:** 10
**CPT Codes Changed:** 10 (100%)
**CPT Codes Unchanged:** 0 (0%)

---

## Executive Summary

This report compares the OLD billing logic (point-based, non-CMS-compliant) against the NEW CMS 2021 compliant logic on 10 real dictated notes from the database.

### Key Findings:

- **1 visits** had risk level downgraded (likely due to insulin/hospitalization fixes)
- **8 visits** had data points capped per CMS limits

---

## Detailed Comparison Table

| Note ID | Patient | Date | Old CPT | New CPT | Changed? | Key Differences |
|---------|---------|------|---------|---------|----------|----------------|
| 194 | NIDHI GUPTA | 2026-02-01 | 99215 | 99214 | ⚠️ YES | CPT changed: 99215 → 99214... (+2 more) |
| 193 | GAUDELIA HURTADO | 2026-02-01 | 99215 | 99213 | ⚠️ YES | CPT changed: 99215 → 99213... (+2 more) |
| 192 | ELIAS FOTY | 2026-01-02 | 99215 | 99214 | ⚠️ YES | CPT changed: 99215 → 99214... (+3 more) |
| 191 | IMRANALI RAJABALI | 2026-01-02 | 99215 | 99214 | ⚠️ YES | CPT changed: 99215 → 99214... (+2 more) |
| 190 | TERESA ROBERSON | 2026-02-01 | 99215 | 99214 | ⚠️ YES | CPT changed: 99215 → 99214... (+2 more) |
| 189 | Unidentified Patient | 2026-02-02 | 99215 | 99214 | ⚠️ YES | CPT changed: 99215 → 99214... (+2 more) |
| 188 | ABDEL TAWIL | 2026-01-02 | 99215 | 99213 | ⚠️ YES | CPT changed: 99215 → 99213... (+3 more) |
| 187 | DON JOHNSON | 2026-02-01 | 99215 | 99214 | ⚠️ YES | CPT changed: 99215 → 99214... (+3 more) |
| 186 | Unidentified Patient | 2026-02-02 | 99215 | 99214 | ⚠️ YES | CPT changed: 99215 → 99214... (+2 more) |
| 185 | YIPSY MELIAN | 2026-01-02 | 99215 | 99213 | ⚠️ YES | CPT changed: 99215 → 99213... (+2 more) |

---

## Detailed Note-by-Note Analysis

### Note 1: NIDHI GUPTA (ID: 194)

**Visit Date:** 2026-02-01
**Template:** None

**Transcript Preview:**
> Hello. Come on in. Come on in. How are you? Good. Good. Good. Good to you too. Alright. Have good ho...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** moderate
- **Data Points:** 6
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99214
- **Complexity:** moderate
- **Problem Complexity:** high
- **Data Complexity:** low
- **Risk Level:** moderate
- **Data Points:** 12
- **Confidence:** 70%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Risk Level: moderate

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99214
- Complexity: high → moderate
- Data points capped: 6 → 12 (CMS limit)

#### 💡 Explanation:
- Data points capped per CMS Category 1 limit (max 2 points for tests/imaging)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

### Note 2: GAUDELIA HURTADO (ID: 193)

**Visit Date:** 2026-02-01
**Template:** None

**Transcript Preview:**
> How are you? Good. Good. Tired? Yes. Yes? Oh my goodness. Alright. What's what's going on? Why is it...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** moderate
- **Data Points:** 1
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99213
- **Complexity:** low
- **Problem Complexity:** high
- **Data Complexity:** low
- **Risk Level:** low
- **Data Points:** 7
- **Confidence:** 65%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Data Complexity: low

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99213
- Complexity: high → low
- Risk: moderate → low

#### 💡 Explanation:
- Risk level changed due to CMS compliance fixes (insulin = MODERATE, stable post-discharge = MODERATE)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

### Note 3: ELIAS FOTY (ID: 192)

**Visit Date:** 2026-01-02
**Template:** None

**Transcript Preview:**
> Hey, Liz. How are you, buddy? Alright. I'm treating you well. Everything okay? Holidays is good? Eve...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** moderate
- **Data Points:** 5
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99214
- **Complexity:** moderate
- **Problem Complexity:** high
- **Data Complexity:** moderate
- **Risk Level:** low
- **Data Points:** 12
- **Confidence:** 70%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Data Complexity: moderate

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99214
- Complexity: high → moderate
- Risk: moderate → low
- Data points capped: 5 → 12 (CMS limit)

#### 💡 Explanation:
- Risk level changed due to CMS compliance fixes (insulin = MODERATE, stable post-discharge = MODERATE)
- Data points capped per CMS Category 1 limit (max 2 points for tests/imaging)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

### Note 4: IMRANALI RAJABALI (ID: 191)

**Visit Date:** 2026-01-02
**Template:** None

**Transcript Preview:**
> How are you? Alright. Well, how are the sugars? Hopefully, they're getting better. All of it is goin...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** moderate
- **Data Points:** 6
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99214
- **Complexity:** moderate
- **Problem Complexity:** high
- **Data Complexity:** low
- **Risk Level:** moderate
- **Data Points:** 11
- **Confidence:** 70%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Risk Level: moderate

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99214
- Complexity: high → moderate
- Data points capped: 6 → 11 (CMS limit)

#### 💡 Explanation:
- Data points capped per CMS Category 1 limit (max 2 points for tests/imaging)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

### Note 5: TERESA ROBERSON (ID: 190)

**Visit Date:** 2026-02-01
**Template:** None

**Transcript Preview:**
> You got. Oh, you you got a low blood sugar? Going down to 87. Oh, okay. Okay. Well, how have you bee...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** moderate
- **Data Points:** 5
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99214
- **Complexity:** moderate
- **Problem Complexity:** high
- **Data Complexity:** low
- **Risk Level:** moderate
- **Data Points:** 10
- **Confidence:** 70%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Risk Level: moderate

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99214
- Complexity: high → moderate
- Data points capped: 5 → 10 (CMS limit)

#### 💡 Explanation:
- Data points capped per CMS Category 1 limit (max 2 points for tests/imaging)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

### Note 6: Unidentified Patient (ID: 189)

**Visit Date:** 2026-02-02
**Template:** None

**Transcript Preview:**
> Hey, Donald. What's up, man? Hey, Always fifty, man. You're looking good, man. Come on in, man. How ...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** moderate
- **Data Points:** 6
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99214
- **Complexity:** moderate
- **Problem Complexity:** high
- **Data Complexity:** low
- **Risk Level:** moderate
- **Data Points:** 11
- **Confidence:** 70%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Risk Level: moderate

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99214
- Complexity: high → moderate
- Data points capped: 6 → 11 (CMS limit)

#### 💡 Explanation:
- Data points capped per CMS Category 1 limit (max 2 points for tests/imaging)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

### Note 7: ABDEL TAWIL (ID: 188)

**Visit Date:** 2026-01-02
**Template:** None

**Transcript Preview:**
> Patient comes in for follow-up. HEDidn't get a chance to do the blood work. We'll do labs today, but...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** moderate
- **Data Points:** 4
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99213
- **Complexity:** low
- **Problem Complexity:** high
- **Data Complexity:** low
- **Risk Level:** low
- **Data Points:** 10
- **Confidence:** 65%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Data Complexity: low

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99213
- Complexity: high → low
- Risk: moderate → low
- Data points capped: 4 → 10 (CMS limit)

#### 💡 Explanation:
- Risk level changed due to CMS compliance fixes (insulin = MODERATE, stable post-discharge = MODERATE)
- Data points capped per CMS Category 1 limit (max 2 points for tests/imaging)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

### Note 8: DON JOHNSON (ID: 187)

**Visit Date:** 2026-02-01
**Template:** None

**Transcript Preview:**
> Oh, wow. It's a drone. Flying back. Oh, that's a lot of stress, man. So the sugars were okay during ...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** high
- **Data Points:** 4
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99214
- **Complexity:** moderate
- **Problem Complexity:** high
- **Data Complexity:** low
- **Risk Level:** moderate
- **Data Points:** 12
- **Confidence:** 70%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Risk Level: moderate

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99214
- Complexity: high → moderate
- Risk: high → moderate
- Data points capped: 4 → 12 (CMS limit)

#### 💡 Explanation:
- Risk level changed due to CMS compliance fixes (insulin = MODERATE, stable post-discharge = MODERATE)
- Data points capped per CMS Category 1 limit (max 2 points for tests/imaging)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

### Note 9: Unidentified Patient (ID: 186)

**Visit Date:** 2026-02-02
**Template:** None

**Transcript Preview:**
> Hey, I'm Zana. How are you? Good. How are you? Good. Good. Good. To see you. Good to see you. Everyt...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** moderate
- **Data Points:** 7
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99214
- **Complexity:** moderate
- **Problem Complexity:** high
- **Data Complexity:** low
- **Risk Level:** moderate
- **Data Points:** 12
- **Confidence:** 70%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Risk Level: moderate

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99214
- Complexity: high → moderate
- Data points capped: 7 → 12 (CMS limit)

#### 💡 Explanation:
- Data points capped per CMS Category 1 limit (max 2 points for tests/imaging)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

### Note 10: YIPSY MELIAN (ID: 185)

**Visit Date:** 2026-01-02
**Template:** None

**Transcript Preview:**
> Hello. Yipsey, hey. How are you? Doctor. Patel, nice to meet you. Come on in. Come on in. What's goi...

#### OLD Logic (Point-Based)
- **CPT Code:** 99215
- **Complexity:** high
- **Risk Level:** moderate
- **Data Points:** 2
- **Confidence:** 75%

#### NEW Logic (CMS 2021 Compliant)
- **CPT Code:** 99213
- **Complexity:** low
- **Problem Complexity:** high
- **Data Complexity:** low
- **Risk Level:** low
- **Data Points:** 8
- **Confidence:** 65%
- **CMS 2-of-3 Qualifying Elements:**
  - Problem Complexity: high
  - Data Complexity: low

#### 🔍 Changes Detected:
- CPT changed: 99215 → 99213
- Complexity: high → low
- Risk: moderate → low

#### 💡 Explanation:
- Risk level changed due to CMS compliance fixes (insulin = MODERATE, stable post-discharge = MODERATE)
- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring

---

## Statistical Analysis

### Confidence Scores
- **Average OLD confidence:** 75.0%
- **Average NEW confidence:** 68.5%

### CPT Code Distribution

**OLD Logic:**
- 99215: 10 visits (100%)

**NEW Logic:**
- 99213: 3 visits (30%)
- 99214: 7 visits (70%)

---

## Compliance Improvements

### CMS 2021 Compliance Status:
- ✅ **MDM 2-of-3 Framework:** Implemented (was point-based)
- ✅ **Data Points Capping:** Category 1 capped at 2 points (was unlimited)
- ✅ **Prolonged Services:** Threshold corrected to 69 min (was 55 min)
- ✅ **Risk Classification:** Insulin = MODERATE (was HIGH)
- ✅ **Risk Classification:** Stable post-discharge = MODERATE (was HIGH)

### Audit Risk Assessment:
- **Before Fixes:** ⚠️⚠️⚠️ HIGH (systematic overcoding risk)
- **After Fixes:** ✅ LOW (CMS-compliant with proper disclaimers)

---

## Recommendations

1. **Review Changed Codes:**
   - Examine the 10 notes where CPT codes changed
   - Verify the NEW codes are clinically appropriate
   - Understand why changes occurred (documented in each note above)

2. **Provider Training:**
   - Educate providers on CMS 2-of-3 methodology
   - Explain why insulin visits may now show as MODERATE complexity
   - Emphasize importance of documenting time (for 95% confidence)

3. **Ongoing Monitoring:**
   - Track suggested vs. actually billed codes
   - Identify systematic patterns
   - Refine algorithms based on provider feedback

4. **Next Steps:**
   - Have certified medical coder review these 10 examples
   - Validate that NEW codes are more accurate than OLD codes
   - If validated, deploy NEW logic to production

---

**Generated:** 2026-02-03T12:29:27.469Z
**Tool:** CPT Billing Comparison Test v2.0
**Database:** Supabase (https://minvvjdflezibmgkplqb.supabase.co)
