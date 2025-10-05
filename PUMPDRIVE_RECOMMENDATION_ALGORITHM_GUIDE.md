# PumpDrive Recommendation Algorithm - Complete Reverse Engineering Guide

**Generated:** October 3, 2025
**Purpose:** Understanding how to trigger specific pump recommendations based on user inputs

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [How the Algorithm Works](#how-the-algorithm-works)
3. [Scoring Algorithm Breakdown](#scoring-algorithm-breakdown)
4. [Reverse Engineering Tables](#reverse-engineering-tables)
5. [Feature Selections Analysis](#feature-selections-analysis)
6. [Guaranteed Winning Combinations](#guaranteed-winning-combinations)
7. [Complete Feature-to-Pump Mapping](#complete-feature-to-pump-mapping)
8. [Technical Implementation Details](#technical-implementation-details)

---

## Executive Summary

The PumpDrive recommendation system uses **two different engines**:

### 1. **Rule-Based Engine** (Fallback)
- **Location:** `server/pump-report-api.js` - `generateRuleBasedRecommendations()`
- **Inputs Used:**
  - ✅ Sliders (activity, techComfort, simplicity, discreteness, timeDedication)
  - ✅ Free text keywords
  - ❌ Feature selections (collected but **not used**)
- **Deterministic:** Same inputs = same outputs
- **Pumps Covered:** 4 pumps only (Omnipod 5, Tandem t:slim X2, Medtronic 780G, Tandem Mobi)

### 2. **AI-Powered Engine** (Primary)
- **Location:** Uses AWS Bedrock (Claude 3 Sonnet)
- **Inputs Used:**
  - ✅ Sliders
  - ✅ Free text
  - ✅ Feature selections
  - ✅ Follow-up clarifications
- **Non-deterministic:** AI can produce varied recommendations
- **Pumps Covered:** All 6 pumps (includes Beta Bionics iLet, Twiist)

---

## How the Algorithm Works

### Input Collection Flow

```
Step 1: Sliders (5 questions)
   ↓
Step 2: Feature Selections (special situations/preferences)
   ↓
Step 3: Free Text Story (current situation)
   ↓
Step 4: Follow-up Clarifications (AI-generated questions)
   ↓
Step 5: Recommendation Generation
```

### Decision Tree

```
AWS Bedrock Available?
├─ YES → Use AI Engine (analyzes ALL inputs including features)
└─ NO  → Use Rule-Based Engine (ignores features, uses only sliders + free text)
```

---

## Scoring Algorithm Breakdown

### Base Scores (All Start Equal)
```javascript
{
  'Omnipod 5': 70,
  'Tandem t:slim X2': 70,
  'Medtronic 780G': 70,
  'Tandem Mobi': 70
}
```

### Scoring Modifiers (Rule-Based)

#### **Omnipod 5 Bonuses**
| Condition | Points | Total Possible |
|-----------|--------|----------------|
| Free text contains "tubeless" OR "patch" | +15 | |
| `discreteness` slider ≥ 6 | +15 | |
| `simplicity` ≥ 6 AND `techComfort` ≤ 4 | +10 | |
| **Maximum Score** | | **95** |

#### **Tandem Mobi Bonuses**
| Condition | Points | Total Possible |
|-----------|--------|----------------|
| Free text contains "small" OR "discrete" | +20 | |
| `discreteness` slider ≥ 6 | +10 | |
| **Maximum Score** | | **100** ⭐ |

> **Note:** Tandem Mobi has the highest possible score - it ALWAYS wins when "small" is mentioned!

#### **Tandem t:slim X2 Bonuses**
| Condition | Points | Total Possible |
|-----------|--------|----------------|
| `techComfort` slider ≥ 7 | +15 | |
| `activity` slider ≥ 6 | +5 | |
| **Maximum Score** | | **90** |

#### **Medtronic 780G Bonuses**
| Condition | Points | Total Possible |
|-----------|--------|----------------|
| `techComfort` ≥ 6 AND `timeDedication` ≤ 4 | +15 | |
| **Maximum Score** | | **85** |

---

## Reverse Engineering Tables

### Table 1: Slider Values to Get Each Pump

| **Target Pump** | **activity** | **techComfort** | **simplicity** | **discreteness** | **timeDedication** | **Score** |
|-----------------|--------------|-----------------|----------------|------------------|--------------------|-----------|
| **Omnipod 5** | any | 1-4 | 6-10 | 6-10 | any | 95 |
| **Tandem Mobi** | any | any | any | 6-10 | any | 100 |
| **Tandem t:slim X2** | 6-10 | 7-10 | any | 1-5 | any | 90 |
| **Medtronic 780G** | 1-5 | 6 | any | 1-5 | 1-4 | 85 |

### Table 2: Free Text Keywords to Get Each Pump

| **Target Pump** | **Keywords to INCLUDE** | **Keywords to AVOID** | **Why** |
|-----------------|-------------------------|----------------------|---------|
| **Omnipod 5** | "tubeless", "patch", "no tubing", "waterproof" | "small", "discrete" | +15 points for tubeless keywords |
| **Tandem Mobi** | "small", "smallest", "tiny", "discrete", "pocket" | (none needed) | +20 points - highest boost! |
| **Tandem t:slim X2** | "tech", "touchscreen", "active", "advanced" | "small", "discrete", "tubeless" | Needs tech preference, avoid others |
| **Medtronic 780G** | "automation", "automatic", "hands-off" | "small", "discrete", "tubeless" | Needs automation focus, avoid others |

### Table 3: Priority Order (When Multiple Pumps Qualify)

```
Tandem Mobi (100)
    > Omnipod 5 (95)
    > Tandem t:slim X2 (90)
    > Medtronic 780G (85)
```

**Tiebreaker Rule:** If scores are equal, the first pump in the object order wins (alphabetically sorted results determine this).

---

## Feature Selections Analysis

### Available Features by Pump

#### **Medtronic 780G Features**
| Feature ID | Title | Category | Why Important |
|-----------|-------|----------|---------------|
| `aa-battery-power` | Swap batteries anywhere, anytime 🔋 | Power | No charging needed |
| `aggressive-control` | Most aggressive blood sugar control 🎯 | Automation | 100% correction doses |
| `fully-submersible` | Swim and dive up to 12 feet 🏊‍♂️ | Design | Only pump for serious swimming |

#### **Tandem t:slim X2 Features**
| Feature ID | Title | Category | Why Important |
|-----------|-------|----------|---------------|
| `touchscreen-control` | Smartphone-like touchscreen 📱 | Interface | Easy navigation |
| `multiple-cgm-options` | Works with multiple CGM brands 🔄 | Convenience | Dexcom/Libre compatible |
| `phone-bolusing` | Deliver insulin from phone 📲 | Convenience | No pump needed |

#### **Tandem Mobi Features**
| Feature ID | Title | Category | Why Important |
|-----------|-------|----------|---------------|
| `ultra-small-size` | Smallest pump ever made 🤏 | Design | Ultra-discreet |
| `iphone-only-control` | Completely controlled by iPhone 📱 | Interface | No pump buttons |
| `wireless-charging` | Wireless charging like phone 🔌 | Power | Convenient |

#### **Omnipod 5 Features**
| Feature ID | Title | Category | Why Important |
|-----------|-------|----------|---------------|
| `completely-tubeless` | Zero tubing for total freedom 🎪 | Design | No tubes to catch |
| `waterproof-pod` | Swim without disconnecting 💦 | Design | Waterproof |
| `dual-control-options` | Use phone OR controller 🎮 | Interface | Flexibility |

#### **Beta Bionics iLet Features** *(AI-only)*
| Feature ID | Title | Category | Why Important |
|-----------|-------|----------|---------------|
| `no-carb-counting` | Never count carbs again 🍎 | Automation | Meal announcements |
| `simple-meal-announcements` | Say "usual" or "more" 🗣️ | Automation | Simplified |
| `inductive-charging` | Wireless charging ⚡ | Power | Like toothbrush |

#### **Twiist Features** *(AI-only)*
| Feature ID | Title | Category | Why Important |
|-----------|-------|----------|---------------|
| `apple-watch-bolusing` | Deliver insulin from Apple Watch ⌚ | Innovation | Wrist control |
| `emoji-bolusing` | Dose with food emojis 😀 | Innovation | Fun interface |
| `ultra-lightweight` | Weighs only 2 ounces 🪶 | Design | Lightest available |

### ⚠️ **CRITICAL FINDING: Features Are Not Used in Rule-Based Scoring**

```javascript
// From server/pump-report-api.js line 2073
function generateRuleBasedRecommendations(userData) {
  const sliders = userData.sliders || {};
  const freeText = userData.freeText?.currentSituation || '';
  const features = userData.features || [];  // ← Extracted but NEVER USED!

  // ... rest of function only uses sliders and freeText
}
```

**Impact:**
- ✅ Features ARE saved to database
- ✅ Features ARE used by AI engine
- ❌ Features are IGNORED by rule-based engine

**Workaround:** Use free text keywords to simulate feature preferences in rule-based mode.

---

## Guaranteed Winning Combinations

### Configuration 1: Get Omnipod 5 (Score: 95)

```yaml
Sliders:
  activity: 5
  techComfort: 3
  simplicity: 8
  discreteness: 8
  timeDedication: 5

Free Text:
  "I want a tubeless pump that's discreet and simple to use.
   I don't like dealing with tubing and want something waterproof."

Feature Selections:
  - 🎪 Zero tubing for total freedom
  - 💦 Swim without disconnecting
  - 🎮 Use phone OR controller

Expected Result:
  Primary: Omnipod 5 (95 points)
  Secondary: Tandem Mobi (80 points)
  Reasoning: Tubeless (+15) + Discretion (+15) + Simplicity+LowTech (+10)
```

### Configuration 2: Get Tandem Mobi (Score: 100) ⭐

```yaml
Sliders:
  activity: 5
  techComfort: 5
  simplicity: 5
  discreteness: 8
  timeDedication: 5

Free Text:
  "I want the smallest pump available, need something discrete
   that fits in small pockets."

Feature Selections:
  - 🤏 Smallest pump ever made
  - 📱 Completely controlled by iPhone
  - 🔌 Wireless charging

Expected Result:
  Primary: Tandem Mobi (100 points)
  Secondary: Omnipod 5 (85 points)
  Reasoning: "small" keyword (+20) + Discretion slider (+10)
  → ALWAYS WINS when "small" is mentioned!
```

### Configuration 3: Get Tandem t:slim X2 (Score: 90)

```yaml
Sliders:
  activity: 8
  techComfort: 9
  simplicity: 8
  discreteness: 2
  timeDedication: 8

Free Text:
  "I'm very active and love technology. I want advanced features
   and touchscreen control with multiple CGM options."

Feature Selections:
  - 📱 Smartphone-like touchscreen
  - 🔄 Works with multiple CGM brands
  - 📲 Deliver insulin from phone

Expected Result:
  Primary: Tandem t:slim X2 (90 points)
  Secondary: Omnipod 5 (70 points)
  Reasoning: High tech comfort (+15) + Active lifestyle (+5)
  → Wins when tech-savvy and avoiding size/tubeless keywords
```

### Configuration 4: Get Medtronic 780G (Score: 85)

```yaml
Sliders:
  activity: 3
  techComfort: 6  # ← Must be EXACTLY 6 (not 7+)
  simplicity: 5
  discreteness: 3
  timeDedication: 3  # ← Must be ≤ 4

Free Text:
  "I want reliable automation without spending much time on
   device management. Need something with aggressive control."

Feature Selections:
  - 🔋 Swap batteries anywhere, anytime
  - 🎯 Most aggressive blood sugar control
  - 🏊‍♂️ Swim and dive up to 12 feet

Expected Result:
  Primary: Medtronic 780G (85 points)
  Secondary: Omnipod 5 (70 points)
  Reasoning: Tech=6 + TimeDedication≤4 (+15)
  → Hardest to trigger - requires specific conditions
```

---

## Complete Feature-to-Pump Mapping

### Category: Power & Charging 🔋

| Feature | Pump | Impact (AI) | Impact (Rule-Based) |
|---------|------|-------------|---------------------|
| AA battery power | Medtronic 780G | ✅ Considered | ❌ Ignored |
| Wireless charging (phone-style) | Tandem Mobi | ✅ Considered | ❌ Ignored |
| Inductive charging | Beta Bionics iLet | ✅ Considered | ❌ Not available |

### Category: Controls & Interface 📱

| Feature | Pump | Impact (AI) | Impact (Rule-Based) |
|---------|------|-------------|---------------------|
| Touchscreen control | Tandem t:slim X2 | ✅ Considered | ❌ Ignored |
| iPhone-only control | Tandem Mobi | ✅ Considered | ❌ Ignored |
| Dual control (phone OR controller) | Omnipod 5 | ✅ Considered | ❌ Ignored |
| Apple Watch bolusing | Twiist | ✅ Considered | ❌ Not available |
| Emoji bolusing | Twiist | ✅ Considered | ❌ Not available |

### Category: Size & Wearability 💎

| Feature | Pump | Impact (AI) | Impact (Rule-Based) |
|---------|------|-------------|---------------------|
| Ultra-small size | Tandem Mobi | ✅ Considered | ❌ Ignored (use "small" in text) |
| Completely tubeless | Omnipod 5 | ✅ Considered | ❌ Ignored (use "tubeless" in text) |
| Fully submersible (12 feet) | Medtronic 780G | ✅ Considered | ❌ Ignored |
| Waterproof pod | Omnipod 5 | ✅ Considered | ❌ Ignored (use "waterproof" in text) |
| Ultra-lightweight (2 oz) | Twiist | ✅ Considered | ❌ Not available |

### Category: Smart Automation 🤖

| Feature | Pump | Impact (AI) | Impact (Rule-Based) |
|---------|------|-------------|---------------------|
| Aggressive control (100% correction) | Medtronic 780G | ✅ Considered | ❌ Ignored |
| No carb counting | Beta Bionics iLet | ✅ Considered | ❌ Not available |
| Simple meal announcements | Beta Bionics iLet | ✅ Considered | ❌ Not available |

### Category: Daily Convenience ✨

| Feature | Pump | Impact (AI) | Impact (Rule-Based) |
|---------|------|-------------|---------------------|
| Multiple CGM options | Tandem t:slim X2 | ✅ Considered | ❌ Ignored |
| Phone bolusing | Tandem t:slim X2 | ✅ Considered | ❌ Ignored |

---

## Technical Implementation Details

### Code Location Map

```
Backend (Rule-Based Engine):
├─ server/pump-report-api.js
│  ├─ Line 1960: POST /api/pumpdrive/recommend
│  ├─ Line 2070: generateRuleBasedRecommendations()
│  ├─ Line 2073: features extracted but unused ⚠️
│  ├─ Line 2076-2079: Slider thresholds
│  ├─ Line 2081-2082: Free text keyword detection
│  └─ Line 2085-2106: Scoring logic

Frontend (Feature Definitions):
├─ src/data/pumpFeatures.ts
│  ├─ Line 10-169: PUMP_FEATURES array
│  └─ Line 171-178: FEATURE_CATEGORIES

Frontend (Slider Definitions):
├─ src/pages/PumpDriveSliders.tsx
│  └─ Line 17-68: SLIDERS array

Frontend (Unified Flow):
└─ src/pages/PumpDriveUnified.tsx
   └─ Line 80: AssessmentStep flow
```

### Slider Threshold Reference

```javascript
// From server/pump-report-api.js
const wantsSimplicity = (sliders.simplicity || 5) >= 6;     // ≥6 = true
const wantsDiscretion = (sliders.discreteness || 5) >= 6;   // ≥6 = true
const isActive = (sliders.activity || 5) >= 6;              // ≥6 = true
const lowTechComfort = (sliders.techComfort || 5) <= 4;     // ≤4 = true
```

**Default Value:** If slider not set, defaults to 5

### Free Text Keyword Detection

```javascript
// From server/pump-report-api.js
const prefersSmall = freeText.toLowerCase().includes('small') ||
                     freeText.toLowerCase().includes('discrete');

const prefersTubeless = freeText.toLowerCase().includes('tubeless') ||
                        freeText.toLowerCase().includes('patch');
```

**Case Insensitive:** All comparisons use `.toLowerCase()`

### Score Calculation Example

```javascript
// Example: User wants Omnipod 5
let scores = {
  'Omnipod 5': 70,        // Base
  'Tandem t:slim X2': 70,
  'Medtronic 780G': 70,
  'Tandem Mobi': 70
};

// User inputs:
// - discreteness: 8 (≥6) ✅
// - simplicity: 7 (≥6) ✅
// - techComfort: 3 (≤4) ✅
// - Free text: "I want a tubeless pump"

// Scoring:
if (prefersTubeless || wantsDiscretion)
  scores['Omnipod 5'] += 15;  // +15 (both true)

if (wantsSimplicity && lowTechComfort)
  scores['Omnipod 5'] += 10;  // +10 (both true)

// Final: Omnipod 5 = 95, others = 70
// Winner: Omnipod 5
```

---

## Key Insights & Recommendations

### 🎯 **Priority Ranking (Easiest to Hardest to Trigger)**

1. **Tandem Mobi** - Just say "small" (100 points)
2. **Omnipod 5** - Say "tubeless" + high discretion (95 points)
3. **Tandem t:slim X2** - High tech comfort + active (90 points)
4. **Medtronic 780G** - Very specific: tech=6, time≤4, no keywords (85 points)

### ⚠️ **Common Pitfalls**

1. **Selecting features doesn't help in rule-based mode** - Use free text instead
2. **"small" keyword overrides everything** - Mobi always wins
3. **Multiple triggers can conflict** - "small tubeless pump" gives Mobi priority
4. **Medtronic needs exact tech=6** - Not 7+, exactly 6
5. **iLet and Twiist don't appear** - Only in AI mode

### 🔧 **Workarounds for Feature Selection Impact**

Since features are ignored in rule-based mode, map them to free text:

| Feature | Free Text Keywords to Use |
|---------|---------------------------|
| 🎪 Tubeless | "tubeless", "patch", "no tubing" |
| 🤏 Smallest | "small", "smallest", "tiny" |
| 📱 Touchscreen | "touchscreen", "tech-savvy" |
| 🔋 AA batteries | "battery power", "no charging" |
| 🎯 Aggressive control | "aggressive", "tight control" |

### 📊 **Testing the Algorithm**

To verify the algorithm behavior:

1. **Clear all session data** in browser
2. **Set specific slider values** as documented above
3. **Use exact free text keywords** from the tables
4. **Check network tab** for `/api/pumpdrive/recommend` response
5. **Verify `score` field** in JSON response

Example test case:
```javascript
// Expected response for Tandem Mobi test
{
  "overallTop": [{
    "pumpName": "Tandem Mobi",
    "score": 100,  // ← Should be 100
    "reasons": [...]
  }],
  "alternatives": [...]
}
```

---

## Appendix A: Slider Details

### Slider 1: Activity Level 🏃
- **ID:** `activity`
- **Range:** 1-10
- **Threshold:** ≥6 for "active lifestyle"
- **Examples:**
  - 1: Mostly at desk, light walking
  - 5: Regular walks, some gym
  - 10: Daily workouts, sports

### Slider 2: Tech Comfort 📱
- **ID:** `techComfort`
- **Range:** 1-10
- **Thresholds:**
  - ≤4 for "low tech comfort" (Omnipod boost)
  - ≥6 for "automation" (Medtronic boost)
  - ≥7 for "tech-savvy" (t:slim boost)
- **Examples:**
  - 1: Keep it simple, basic phone
  - 5: Use apps daily
  - 10: Love new gadgets

### Slider 3: Simplicity Preference 🎛️
- **ID:** `simplicity`
- **Range:** 1-10
- **Threshold:** ≥6 for "wants simplicity"
- **Examples:**
  - 1: Super simple, fewer buttons
  - 5: Some features okay
  - 10: Give me all features

### Slider 4: Discreteness 🤫
- **ID:** `discreteness`
- **Range:** 1-10
- **Threshold:** ≥6 for "wants discretion"
- **Examples:**
  - 1: Must be completely hidden
  - 5: Prefer discreet
  - 10: Don't care who sees it

### Slider 5: Time Dedication ⏰
- **ID:** `timeDedication`
- **Range:** 1-10
- **Threshold:** ≤4 for "low time commitment"
- **Examples:**
  - 1: Minimal time, set-and-forget
  - 5: Few minutes daily
  - 10: Happy to spend time

---

## Appendix B: Response Format

### Rule-Based Response Structure
```json
{
  "overallTop": [{
    "pumpName": "Omnipod 5",
    "score": 95,
    "reasons": [
      "Tubeless design offers maximum discretion",
      "Simple pod system - no tubing to manage",
      "Automated insulin delivery with Dexcom G6/G7",
      "Waterproof and swim-friendly"
    ]
  }],
  "alternatives": [
    {
      "pumpName": "Tandem Mobi",
      "score": 80,
      "reasons": [...]
    },
    {
      "pumpName": "Tandem t:slim X2",
      "score": 75,
      "reasons": [...]
    }
  ],
  "keyFactors": [
    "Ease of use and simplicity",
    "Small size and discretion",
    "Active lifestyle compatibility"
  ],
  "personalizedInsights": "Based on your preferences for a smaller pump and tubeless design...",
  "reportId": 123  // ← Added after database save
}
```

---

## Appendix C: Database Schema

### Table: pump_reports

```sql
CREATE TABLE pump_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  report_data JSON NOT NULL,                -- Full request payload
  questionnaire_responses JSON,             -- Slider + feature data
  recommendations JSON,                     -- Full recommendation response
  primary_pump VARCHAR(100),                -- Winner pump name
  secondary_pump VARCHAR(100),              -- Runner-up pump name
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  payment_status ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid',
  payment_amount DECIMAL(10,2),
  payment_date TIMESTAMP NULL,
  stripe_payment_intent_id VARCHAR(255),
  provider_email VARCHAR(255),
  provider_sent_date TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES pump_users(id) ON DELETE CASCADE
);
```

---

## Version History

- **v1.0** (Oct 3, 2025) - Initial comprehensive guide
  - Reverse engineering complete
  - Feature analysis complete
  - All test cases documented

---

## Contact & Support

For questions about this algorithm:
- **Backend Code:** `server/pump-report-api.js`
- **Frontend Code:** `src/pages/PumpDriveUnified.tsx`
- **Feature Data:** `src/data/pumpFeatures.ts`

**Note:** This guide is based on the codebase as of commit `1529cc00` (Oct 3, 2025).

---

*End of Guide*
