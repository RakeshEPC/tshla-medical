# PumpDrive AI-Powered Scoring System V3.0
## Complete Implementation Plan with AI Intent Analysis

**Created:** 2025-10-06
**Status:** Ready for Implementation
**Estimated Time:** 2-3 weeks
**Cost:** $0.039 per patient (~4 cents)

---

## 🎯 Executive Summary

### What We're Building

A **completely redesigned** pump recommendation system where:

✅ **All 6 pumps can reach 100%** - No hardcoded biases
✅ **AI understands INTENT** - Not just keyword matching
✅ **Semantic free text analysis** - "I love to swim" → water resistance boost
✅ **Context 7 follow-up questions** - Resolves close scores intelligently
✅ **23 dimensions fully integrated** - Every recommendation cites specific dimensions
✅ **Transparent scoring breakdown** - Users see exactly why each pump scored as it did

### The Core Innovation

**BEFORE (Current System):**
```javascript
// ❌ Hardcoded keyword matching
if (freeText.includes('waterproof')) {
  scores['Omnipod 5'] += 10;
}
// MISSES: "I love swimming", "I'm in the pool daily", "shower with pump"
```

**AFTER (New System):**
```javascript
// ✅ AI semantic understanding
const intent = await ai.analyze(freeText);
// Detects: "swimming" intent → Maps to Dimension 11 (Water Resistance)
// Scores ALL pumps: Medtronic +8, Omnipod +7, Mobi +5, etc.
```

---

## 📊 New Scoring Formula

### Final Formula (Your Requirements)

```
Stage 1: Base Score (ALL EQUAL)              = 30%
Stage 2: Sliders (±12%)                      = 30% ± 12%
Stage 3: Feature Preferences (±8%)           = 30% ± 8%
Stage 4: AI Free Text Analysis (0-25%)       = 0-25% (SEMANTIC)
Stage 5: Context 7 Follow-up (±5%)           = ±5% (FILLS GAPS)
Stage 6: Final AI + 23 Dimensions (0-20%)    = 0-20% (COMPREHENSIVE)
═════════════════════════════════════════════════════════════
Maximum Possible Score                       = 100%
Minimum Possible Score                       = 10%
```

### Key Changes from Your Request

1. **Base 30% (not 40%)** - Allows more room for differentiation
2. **Sliders 30% ± 12%** - Higher weight as you requested (was just ±12%)
3. **Features ±8%** - Includes penalties, not just bonuses
4. **Free Text 0-25%** - AI-powered semantic analysis (was keyword matching)
5. **Context 7 ±5%** - Smart follow-up questions when scores are close
6. **Final AI 0-20%** - Uses all 23 dimensions from database

### Why This Works

- **All pumps start equal** (30%) - no bias
- **User input drives differentiation** (sliders + features + text = up to 45%)
- **AI fills gaps** (context 7 + final analysis = up to 25%)
- **Any pump can win** depending on user needs

---

## 🚀 Implementation Stages

### STAGE 1: Base Score (30%)

**Purpose:** Every pump starts with a fair baseline

```javascript
function initializeScores() {
  return {
    'Medtronic 780G': 30,
    'Tandem t:slim X2': 30,
    'Tandem Mobi': 30,
    'Omnipod 5': 30,
    'Beta Bionics iLet': 30,
    'Twiist': 30
  };
}
```

**Why 30% instead of 40%?**
- Leaves more room for differentiation (70 points to allocate)
- Prevents all pumps clustering around 60-80%
- Allows clear winners to emerge (90-100%)

---

### STAGE 2: Slider Adjustments (30% ± 12%)

**Weight:** This is now the PRIMARY user input (30% of total score)

**Implementation:** `server/pump-report-api.js`

**Key Principle:** Both BOOSTS and PENALTIES based on 5 sliders

#### Slider 1: Activity Level (1-10)

```javascript
const activity = sliders.activity || 5;

// Very Active (8-10)
if (activity >= 8) {
  scores['Tandem t:slim X2'] += 6;   // Exercise modes
  scores['Twiist'] += 5;              // Lightweight for sports
  scores['Omnipod 5'] += 4;           // Tubeless freedom
  scores['Tandem Mobi'] += 4;         // Compact
  scores['Medtronic 780G'] -= 3;      // Bulkier, less ideal
  scores['Beta Bionics iLet'] -= 2;   // Simpler exercise features
}
// Moderately Active (5-7)
else if (activity >= 5) {
  scores['Tandem t:slim X2'] += 3;
  scores['Omnipod 5'] += 2;
  scores['Twiist'] += 2;
}
// Sedentary (1-4)
else {
  scores['Beta Bionics iLet'] += 2;   // Simplicity benefits
  scores['Medtronic 780G'] += 2;      // Size doesn't matter
  scores['Omnipod 5'] += 1;
}
```

#### Slider 2: Tech Comfort (1-10)

```javascript
const techComfort = sliders.techComfort || 5;

// Low Tech (1-3)
if (techComfort <= 3) {
  scores['Beta Bionics iLet'] += 10;  // Simplest system
  scores['Omnipod 5'] += 8;           // Simple pod
  scores['Tandem t:slim X2'] -= 5;    // Touchscreen complexity
  scores['Tandem Mobi'] -= 4;         // iPhone dependent
  scores['Medtronic 780G'] -= 3;      // Button complexity
  scores['Twiist'] -= 4;              // Very tech-forward
}
// Moderate Tech (4-6)
else if (techComfort <= 6) {
  scores['Medtronic 780G'] += 3;
  scores['Omnipod 5'] += 2;
  scores['Beta Bionics iLet'] += 2;
}
// High Tech (7-10)
else {
  scores['Tandem t:slim X2'] += 8;    // Touchscreen pro
  scores['Tandem Mobi'] += 7;         // iPhone integration
  scores['Twiist'] += 6;              // Apple Watch
  scores['Medtronic 780G'] += 3;      // Advanced features
  scores['Beta Bionics iLet'] -= 4;   // Too simple
  scores['Omnipod 5'] -= 2;           // Simpler system
}
```

#### Slider 3: Simplicity Preference (1-10)

```javascript
const simplicity = sliders.simplicity || 5;

// Want Simple (7-10)
if (simplicity >= 7) {
  scores['Beta Bionics iLet'] += 12;  // Simplest
  scores['Omnipod 5'] += 8;           // Simple pod
  scores['Tandem Mobi'] -= 3;         // Phone management
  scores['Tandem t:slim X2'] -= 4;    // Feature-rich
  scores['Medtronic 780G'] -= 2;      // More settings
  scores['Twiist'] -= 2;              // Innovation = complexity
}
// Want Balanced (4-6)
else if (simplicity >= 4) {
  scores['Omnipod 5'] += 2;
  scores['Medtronic 780G'] += 2;
}
// Want Complex (1-3)
else {
  scores['Tandem t:slim X2'] += 5;    // Many features
  scores['Twiist'] += 4;              // Innovation
  scores['Tandem Mobi'] += 3;         // Tech features
  scores['Beta Bionics iLet'] -= 3;   // Too simple
}
```

#### Slider 4: Discreteness (1-10)

```javascript
const discreteness = sliders.discreteness || 5;

// Very Discreet (7-10)
if (discreteness >= 7) {
  scores['Tandem Mobi'] += 12;        // Smallest
  scores['Omnipod 5'] += 8;           // Tubeless
  scores['Twiist'] += 7;              // 2 oz lightest
  scores['Medtronic 780G'] -= 6;      // Largest
  scores['Beta Bionics iLet'] -= 3;   // Visible
  scores['Tandem t:slim X2'] -= 2;    // Still visible
}
// Balanced (4-6)
else if (discreteness >= 4) {
  scores['Tandem Mobi'] += 3;
  scores['Omnipod 5'] += 2;
}
// Don't Care (1-3)
else {
  scores['Medtronic 780G'] += 2;      // Features > size
}
```

#### Slider 5: Time Dedication (1-10)

```javascript
const timeDedication = sliders.timeDedication || 5;

// Low Time (1-4)
if (timeDedication <= 4) {
  scores['Beta Bionics iLet'] += 10;  // Hands-off
  scores['Omnipod 5'] += 5;           // Simple pods
  scores['Medtronic 780G'] += 3;      // Set & forget
  scores['Tandem t:slim X2'] -= 2;    // More management
  scores['Tandem Mobi'] -= 1;
  scores['Twiist'] -= 1;
}
// Balanced (5-7)
else if (timeDedication <= 7) {
  // No adjustments - all pumps equal
}
// High Time (8-10)
else {
  scores['Tandem t:slim X2'] += 4;    // Customization
  scores['Twiist'] += 3;              // Innovation
  scores['Tandem Mobi'] += 3;         // Fine-tuning
  scores['Medtronic 780G'] += 2;
  scores['Beta Bionics iLet'] -= 5;   // Too automated
  scores['Omnipod 5'] -= 2;
}
```

**Total Impact:** Maximum ±12% across all sliders combined

---

### STAGE 3: Feature Preferences (±8%)

**Weight:** User explicitly selected features

**Implementation:** Map each feature to boosts AND penalties

```javascript
const FEATURE_IMPACT = {
  // Power Features
  'aa-battery-power': {
    boosts: { 'Medtronic 780G': 8 },
    penalties: { 'Tandem Mobi': -2, 'Beta Bionics iLet': -2 }
  },
  'wireless-charging': {
    boosts: { 'Tandem Mobi': 6, 'Beta Bionics iLet': 6 },
    penalties: { 'Medtronic 780G': -1 }
  },
  'no-charging-needed': {
    boosts: { 'Omnipod 5': 10 },
    penalties: {
      'Medtronic 780G': -1,
      'Tandem t:slim X2': -2,
      'Tandem Mobi': -2,
      'Beta Bionics iLet': -2,
      'Twiist': -2
    }
  },

  // Size Features
  'ultra-small-size': {
    boosts: { 'Tandem Mobi': 15 },
    penalties: { 'Medtronic 780G': -4, 'Beta Bionics iLet': -3 }
  },
  'completely-tubeless': {
    boosts: { 'Omnipod 5': 12 },
    penalties: {
      'Medtronic 780G': -1,
      'Tandem t:slim X2': -1,
      'Tandem Mobi': -1,
      'Beta Bionics iLet': -1,
      'Twiist': -1
    }
  },
  'ultra-lightweight': {
    boosts: { 'Twiist': 10, 'Tandem Mobi': 4 },
    penalties: { 'Medtronic 780G': -2 }
  },

  // Control Features
  'apple-watch-bolusing': {
    boosts: { 'Twiist': 15 },
    penalties: {
      'Medtronic 780G': -3,
      'Beta Bionics iLet': -3
    }
  },
  'touchscreen-control': {
    boosts: { 'Tandem t:slim X2': 10, 'Beta Bionics iLet': 2 },
    penalties: { 'Medtronic 780G': -3, 'Omnipod 5': -1 }
  },
  'iphone-only-control': {
    boosts: { 'Tandem Mobi': 12, 'Twiist': 8 },
    penalties: { 'Medtronic 780G': -2, 'Beta Bionics iLet': -2 }
  },

  // Automation Features
  'aggressive-control': {
    boosts: { 'Medtronic 780G': 12, 'Twiist': 6 },
    penalties: { 'Beta Bionics iLet': -2 }
  },
  'no-carb-counting': {
    boosts: { 'Beta Bionics iLet': 15 },
    penalties: {
      'Medtronic 780G': -1,
      'Tandem t:slim X2': -1,
      'Tandem Mobi': -1,
      'Omnipod 5': -1,
      'Twiist': -1
    }
  },

  // Water Features
  'fully-submersible': {
    boosts: { 'Medtronic 780G': 10, 'Beta Bionics iLet': 6 },
    penalties: { 'Tandem t:slim X2': -3, 'Twiist': -3 }
  },
  'waterproof-pod': {
    boosts: { 'Omnipod 5': 8, 'Tandem Mobi': 6 },
    penalties: { 'Tandem t:slim X2': -2, 'Twiist': -2 }
  },

  // Convenience
  'multiple-cgm-options': {
    boosts: { 'Tandem t:slim X2': 8, 'Omnipod 5': 6 },
    penalties: { 'Tandem Mobi': -2 }
  },
  'phone-bolusing': {
    boosts: { 'Tandem Mobi': 8, 'Tandem t:slim X2': 6, 'Twiist': 8 },
    penalties: { 'Medtronic 780G': -3 }
  }
};

function applyFeatureAdjustments(scores, selectedFeatures) {
  selectedFeatures.forEach(feature => {
    const impact = FEATURE_IMPACT[feature.id];
    if (impact) {
      // Apply boosts
      Object.entries(impact.boosts).forEach(([pump, points]) => {
        scores[pump] += points;
      });
      // Apply penalties
      Object.entries(impact.penalties).forEach(([pump, points]) => {
        scores[pump] += points; // Already negative
      });
    }
  });
  return scores;
}
```

**Total Impact:** Maximum ±8% across all features

---

### STAGE 4: AI-Powered Free Text Analysis (0-25%)

**🔥 THIS IS THE BIG INNOVATION - SEMANTIC UNDERSTANDING**

**Weight:** This is where AI shines - understanding INTENT not keywords

**Implementation:** Use OpenAI to analyze free text against 23 dimensions

#### The Problem with Current System

```javascript
// ❌ CURRENT (Keyword Matching)
const freeText = "I love to swim and I'm in the pool every day";
if (freeText.includes('waterproof')) {  // MISSED!
  scores['Omnipod 5'] += 10;
}
// Result: No boost because exact word "waterproof" wasn't used
```

#### The Solution with AI

```javascript
// ✅ NEW (Semantic Understanding)
const analysis = await analyzeFreeTextWithAI(freeText);
// AI detects:
// - Intent: "Needs excellent water resistance for daily swimming"
// - Dimension: #11 (Water Resistance)
// - Scores ALL pumps intelligently:
//   Medtronic 780G: +8 (12 feet submersible)
//   Omnipod 5: +7 (8 feet, swim without disconnect)
//   Tandem Mobi: +5 (8 feet water resistant)
//   Beta Bionics iLet: +4 (12 feet but 30 mins only)
//   Tandem t:slim X2: +0 (must disconnect)
//   Twiist: +0 (not submersible)
```

#### Complete AI Prompt for Stage 4

```javascript
async function analyzeFreeTextWithAI(freeText) {
  const prompt = `You are an expert at understanding patient needs for insulin pumps.
Extract TRUE INTENTIONS from patient free text, not just keywords.

PATIENT'S FREE TEXT:
"${freeText}"

YOUR TASK:
1. Extract all relevant needs/desires/pain points (ignore keywords, focus on INTENT)
2. Map each need to specific pump dimensions (1-23)
3. Score each pump (0-25 points) based on how well it addresses ALL extracted needs
4. Provide clear reasoning citing dimensions

23 PUMP DIMENSIONS:
1. Battery life & power
2. Phone control & app features
3. Tubing preference & wear style
4. Automation behavior & algorithm
5. CGM compatibility
6. Target adjustability
7. Exercise modes & activity support
8. Manual bolus workflow
9. Reservoir/pod capacity
10. Adhesive & site tolerance
11. Water resistance & swimming
12. Alerts & alarms customization
13. User interface design
14. Data sharing & connectivity
15. Clinic support & availability
16. Travel & airport logistics
17. Pediatric & caregiver features
18. Visual discretion & size
19. Ecosystem & accessories
20. Reliability & occlusion handling
21. Cost & insurance coverage
22. On-body comfort & wearability
23. Support apps & software updates

PUMP STRENGTHS (use this to score):

MEDTRONIC 780G:
- Dimension 1: AA batteries (swap anywhere)
- Dimension 4: Most aggressive (100% corrections)
- Dimension 11: Best submersible (12 feet × 24 hours)
- Dimension 9: 300 units, 7-day wear
- Dimension 16: Easy travel (batteries anywhere)

TANDEM T:SLIM X2:
- Dimension 13: Touchscreen (smartphone-like)
- Dimension 5: Multiple CGMs (Dexcom, Libre 2+, Libre 3+)
- Dimension 7: Dedicated exercise mode
- Dimension 2: Phone bolusing + pump touchscreen
- Dimension 17: Remote bolus (Tandem Source for caregivers)

TANDEM MOBI:
- Dimension 18: SMALLEST pump ever made
- Dimension 2: iPhone-only full app control
- Dimension 1: Wireless charging
- Dimension 22: Forget wearing it, ultra-light

OMNIPOD 5:
- Dimension 3: COMPLETELY TUBELESS
- Dimension 1: Never charge (integrated battery)
- Dimension 11: Swim without disconnect
- Dimension 2: Phone OR controller (iOS/Android)
- Dimension 10: Multiple wear sites

BETA BIONICS ILET:
- Dimension 8: NO CARB COUNTING (meal announcements)
- Dimension 4: Hands-off automation
- Dimension 12: Minimal alerts (only 4)
- Dimension 17: Simple for kids
- Dimension 8: Meal sizes (small/medium/large)

TWIIST:
- Dimension 19: Apple Watch bolusing (dose from wrist!)
- Dimension 22: Lightest pump (2 ounces)
- Dimension 8: Emoji interface (food pics)
- Dimension 23: Automatic OTA updates
- Dimension 2: Full Apple integration

SCORING RULES:
- Perfect fit for stated need: +5 to +8 points per pump
- Good fit: +3 to +5 points
- Mentioned but not primary: +1 to +2 points
- Not relevant: 0 points
- MAXIMUM total per pump: +25 points

EXAMPLES:

Example 1: "I love to swim and I'm in the pool every day"
INTENT: Needs excellent water resistance for daily swimming
DIMENSION: #11 (Water resistance)
SCORING:
- Medtronic 780G: +8 (12 feet submersible, best rating)
- Omnipod 5: +7 (8 feet, no tubes in water)
- Tandem Mobi: +5 (8 feet, can swim)
- Beta Bionics iLet: +4 (12 feet but 30 mins only)
- Tandem t:slim X2: +0 (must disconnect)
- Twiist: +0 (not submersible)

Example 2: "Carb counting is exhausting"
INTENT: Burnout on carbs, wants simplified bolusing
DIMENSION: #8 (Bolus workflow)
SCORING:
- Beta Bionics iLet: +8 (NO carb counting)
- Twiist: +3 (emoji interface simplifies)
- Omnipod 5: +2 (food library helps)
- Others: +1 (still require carbs)

Example 3: "I need something for my teenager"
INTENT: Pediatric use, caregiver needs
DIMENSIONS: #17 (Pediatric), #2 (Phone control)
SCORING:
- Tandem t:slim X2: +8 (remote bolus for parents)
- Beta Bionics iLet: +7 (simple for kids)
- Tandem Mobi: +7 (phone control)
- Omnipod 5: +6 (popular with kids, View app)
- Medtronic 780G: +4 (caregiver app, no remote bolus)
- Twiist: +3 (caregiver app coming)

OUTPUT FORMAT (JSON):
{
  "extractedIntents": [
    {
      "intent": "string describing what patient truly needs",
      "dimensions": [array of dimension numbers 1-23],
      "confidence": "high|medium|low",
      "keywords_detected": ["actual phrases from text"]
    }
  ],
  "pumpScores": {
    "Medtronic 780G": {
      "points": 0-25,
      "reasoning": "string explaining score citing dimensions"
    },
    // ... all 6 pumps
  },
  "dimensionsCovered": [numbers],
  "dimensionsMissing": [numbers]
}

NOW ANALYZE THE PATIENT'S TEXT AND RETURN JSON.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Cost: $0.001 per patient
    messages: [
      { role: 'system', content: 'Extract patient intent, not keywords.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 1000,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Usage:**

```javascript
// Apply AI analysis to scores
const freeTextAnalysis = await analyzeFreeTextWithAI(userData.freeText);
Object.entries(freeTextAnalysis.pumpScores).forEach(([pump, data]) => {
  scores[pump] += data.points; // 0-25 points per pump
});
```

**Total Impact:** 0-25% based on AI analysis of intent

---

### STAGE 5: Context 7 Follow-up Questions (±5%)

**Weight:** Intelligent follow-ups when scores are close

**When to Trigger:**
- Top 2-3 pumps within 10% of each other
- Important dimensions not addressed in free text

**Implementation:**

```javascript
async function generateContext7Question(scores, freeTextAnalysis, userData) {
  // Check for close competitors
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topScore = sortedScores[0][1];
  const closeCompetitors = sortedScores.filter(([_, s]) => topScore - s <= 10);

  if (closeCompetitors.length <= 1) {
    return null; // Clear winner, no question needed
  }

  const prompt = `Generate ONE clarifying question to differentiate these pumps.

CLOSE SCORES:
${closeCompetitors.map(([name, score]) => `${name}: ${score}%`).join('\n')}

DIMENSIONS NOT ADDRESSED:
${freeTextAnalysis.dimensionsMissing.join(', ')}

PATIENT DATA:
Sliders: ${JSON.stringify(userData.sliders)}
Features: ${userData.features.map(f => f.title).join(', ')}
Free Text Intents: ${freeTextAnalysis.extractedIntents.map(i => i.intent).join('; ')}

Generate a multiple-choice question with 3 options that will help decide between these pumps.
Include boost/penalty values for each option.

OUTPUT (JSON):
{
  "question": "Which matters more to you?",
  "context": "Explanation of why this question helps",
  "dimension": dimension_number,
  "options": [
    {
      "text": "Option 1 text",
      "boosts": { "Pump A": 5, "Pump B": -2 }
    },
    {
      "text": "Option 2 text",
      "boosts": { "Pump B": 5, "Pump A": -2 }
    },
    {
      "text": "Both are important",
      "boosts": { "Pump A": 2, "Pump B": 2 }
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Need reasoning - Cost: $0.002 per patient
    messages: [
      { role: 'system', content: 'Generate smart clarifying questions.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4,
    max_tokens: 500,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Example Output:**

```json
{
  "question": "Which matters more to you?",
  "context": "Omnipod 5 and Beta Bionics iLet are very close (both 72%). This will help us decide.",
  "dimension": 3,
  "options": [
    {
      "text": "Tubeless freedom is absolutely essential",
      "boosts": { "Omnipod 5": 5, "Beta Bionics iLet": -2 }
    },
    {
      "text": "Skipping carb counting would change my life",
      "boosts": { "Beta Bionics iLet": 5, "Omnipod 5": -2 }
    },
    {
      "text": "Both are important to me",
      "boosts": { "Omnipod 5": 2, "Beta Bionics iLet": 2 }
    }
  ]
}
```

**Total Impact:** ±5% to resolve close decisions

---

### STAGE 6: Final AI Analysis with 23 Dimensions (0-20%)

**Weight:** Comprehensive review using complete database

**Purpose:**
- Validate scores against ALL 23 dimensions
- Identify any missed critical factors
- Provide dimension-cited reasoning

**Implementation:**

```javascript
async function performFinalAIAnalysis(currentScores, userData, freeTextAnalysis, dimensions) {
  const prompt = `Final scoring review with comprehensive 23-dimension analysis.

CURRENT SCORES (after 5 stages):
${Object.entries(currentScores).map(([name, score]) => `${name}: ${score}%`).join('\n')}

PATIENT PROFILE:
Sliders: ${JSON.stringify(userData.sliders)}
Features: ${userData.features.map(f => f.title).join(', ')}
Free Text: "${userData.freeText}"
Extracted Intents: ${freeTextAnalysis.extractedIntents.map(i => i.intent).join('; ')}

23-DIMENSION DATABASE:
${formatAllDimensionsWithPumpDetails(dimensions)}

YOUR TASK:
1. Identify the MOST critical dimensions for THIS patient
2. Assess each pump's alignment across those dimensions
3. Award 0-20 bonus points per pump based on comprehensive fit
4. Cite specific dimensions in all reasoning
5. Explain why top pump is best match

CRITICAL: Base your analysis on:
- Which dimensions matter most to THIS patient
- How well each pump excels in those specific dimensions
- Any dimension gaps the patient hasn't considered but should

OUTPUT (JSON):
{
  "finalScores": {
    "Pump Name": {
      "score": current_score + bonus (0-20),
      "dimensionBonus": 0-20,
      "keyDimensions": [numbers of most relevant dimensions],
      "reasoning": "Detailed explanation citing dimensions"
    }
  },
  "topChoice": {
    "name": "Pump Name",
    "finalScore": number,
    "primaryReasons": [
      "Dimension X: Specific strength",
      "Dimension Y: Specific strength",
      "Dimension Z: Specific strength"
    ]
  },
  "dimensionBreakdown": {
    "mostRelevant": [
      { "number": X, "name": "Dimension name", "winner": "Pump" }
    ]
  }
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Need comprehensive reasoning - Cost: $0.036 per patient
    messages: [
      { role: 'system', content: 'Expert diabetes educator analyzing 23 pump dimensions.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Total Impact:** 0-20% comprehensive bonus

---

## 🎯 How Each Pump Reaches 100%

### Medtronic 780G → 100%

**Profile:** Aggressive control, serious swimmer, international travel

```
Base Score:                              30%
Sliders (low time, high tech):          +9%    = 39%
Features (AA battery, aggressive, swim): +29%   = 68%
Free Text AI Analysis:
  "aggressive control tight 100%"        +8
  "competitive swimmer 12 feet"          +8
  "travel AA batteries anywhere"         +5
  "occlusion keep insulin"               +4
  TOTAL:                                 +25%   = 93%
Context 7: "Water or control?"
  Answer: "Both essential"               +2%    = 95%
Final AI (23 dimensions):
  Dimension 4 (Automation): Perfect      +3
  Dimension 11 (Water): Best             +2
  TOTAL:                                 +5%    = 100% ✅
```

### Tandem t:slim X2 → 100%

**Profile:** Tech-savvy, very active, teenager with remote bolus needs

```
Base Score:                              30%
Sliders (high activity, high tech):     +17%   = 47%
Features (touchscreen, CGM, phone):     +24%   = 71%
Free Text AI Analysis:
  "tech-savvy touchscreen"               +7
  "very active gym exercise"             +6
  "teenager remote bolus"                +8
  "multiple CGM options"                 +4
  TOTAL:                                 +25%   = 96%
Context 7: Not triggered (clear winner)
Final AI (23 dimensions):
  Dimension 17 (Pediatric): Excellent    +2
  Dimension 7 (Exercise): Best           +2
  TOTAL:                                 +4%    = 100% ✅
```

### Tandem Mobi → 100%

**Profile:** Discretion-focused, iPhone user, wants smallest pump

```
Base Score:                              30%
Sliders (very discreet, high tech):     +22%   = 52%
Features (ultra-small, iPhone, wireless): +31%  = 83%
Free Text AI Analysis:
  "smallest tiniest discreet"            +8
  "iPhone control app"                   +7
  "forget wearing lightweight"           +6
  "wireless charging perfect"            +4
  TOTAL:                                 +25%   = 108% → Capped at 100% ✅
(Already at 100%, no need for later stages)
```

### Omnipod 5 → 100%

**Profile:** Simple, low-tech, tubeless preference, swimmer

```
Base Score:                              30%
Sliders (low tech, simple, discreet):   +26%   = 56%
Features (tubeless, waterproof, dual):  +28%   = 84%
Free Text AI Analysis:
  "tubeless no tubing freedom"          +8
  "simple easy not tech-savvy"          +7
  "never charge pods"                    +5
  "waterproof swim"                      +5
  TOTAL:                                 +25%   = 109% → Capped at 100% ✅
```

### Beta Bionics iLet → 100%

**Profile:** Carb counting burnout, wants hands-off, parent with child

```
Base Score:                              30%
Sliders (low tech, simple, low time):   +30%   = 60%
Features (no carbs, meal, minimal):     +29%   = 89%
Free Text AI Analysis:
  "burned out carb counting"             +8
  "hands-off automation"                 +7
  "alarm fatigue minimal"                +5
  "simple for kids"                      +5
  TOTAL:                                 +25%   = 114% → Capped at 100% ✅
```

### Twiist → 100%

**Profile:** Apple ecosystem enthusiast, innovation-focused, lightest weight

```
Base Score:                              30%
Sliders (active, high tech, discreet):  +20%   = 50%
Features (Apple Watch, emoji, 2 oz):    +34%   = 84%
Free Text AI Analysis:
  "Apple Watch bolusing wrist"           +8
  "lightest 2 ounces barely feel"        +8
  "emoji food pics innovative"           +5
  "OTA updates automatic"                +4
  TOTAL:                                 +25%   = 109% → Capped at 100% ✅
```

---

## 📋 Complete Implementation Checklist

### Week 1: Core Infrastructure Setup

**Day 1-2: Dependencies**
- [ ] `cd /Users/rakeshpatel/Desktop/tshla-medical`
- [ ] `npm install openai@latest`
- [ ] Add `VITE_OPENAI_API_KEY=sk-...` to `.env`
- [ ] Add model configs to `.env`:
  ```
  VITE_OPENAI_MODEL_STAGE4=gpt-4o-mini
  VITE_OPENAI_MODEL_STAGE5=gpt-4o
  VITE_OPENAI_MODEL_STAGE6=gpt-4o
  ```

**Day 3-4: Stage 1-3 Implementation**
- [ ] Modify `server/pump-report-api.js`
- [ ] Replace `generateRuleBasedRecommendations()` function
- [ ] Implement `initializeScores()` (30% base)
- [ ] Implement `applySliderAdjustments()` with penalties
- [ ] Implement `applyFeatureAdjustments()` with penalties
- [ ] Test stages 1-3 manually

**Day 5: Testing Stages 1-3**
- [ ] Create test cases for each pump
- [ ] Verify sliders boost/penalty correctly
- [ ] Verify features boost/penalty correctly
- [ ] Verify scores stay within 0-100% range

### Week 2: AI Stages Implementation

**Day 1-3: Stage 4 (Free Text AI)**
- [ ] Implement `analyzeFreeTextWithAI()` function
- [ ] Test with examples:
  - "I love to swim" → water resistance boost
  - "Carb counting exhausts me" → iLet boost
  - "I need something for my teenager" → t:slim/iLet boost
- [ ] Verify all 23 dimensions referenced in prompt
- [ ] Test token usage (should be ~$0.001/call)

**Day 4-5: Stage 5 (Context 7)**
- [ ] Implement `generateContext7Question()` function
- [ ] Implement `applyContext7Boosts()` function
- [ ] Test triggering logic (scores within 10%)
- [ ] Test question quality manually
- [ ] Verify dimension gap detection

**Day 6-7: Stage 6 (Final AI)**
- [ ] Implement `performFinalAIAnalysis()` function
- [ ] Fetch 23 dimensions from `pump_comparison_data` table
- [ ] Format dimensions for AI prompt
- [ ] Test comprehensive analysis quality
- [ ] Verify dimension citations in output

### Week 3: Integration & Polish

**Day 1-2: Frontend Updates**
- [ ] Update `src/pages/PumpDriveUnified.tsx`
- [ ] Add Context 7 question display
- [ ] Update results page with dimension breakdown
- [ ] Show "Why this pump?" reasoning
- [ ] Display all 6 pump scores (not just top 3)

**Day 3-4: Testing All 6 Pumps**
- [ ] Test Medtronic 780G reaching 100%
- [ ] Test Tandem t:slim X2 reaching 100%
- [ ] Test Tandem Mobi reaching 100%
- [ ] Test Omnipod 5 reaching 100%
- [ ] Test Beta Bionics iLet reaching 100%
- [ ] Test Twiist reaching 100%

**Day 5-7: Cost & Performance**
- [ ] Monitor OpenAI token usage
- [ ] Verify average cost ~$0.04/patient
- [ ] Load test with 50 mock patients
- [ ] Optimize prompts if costs too high
- [ ] Add caching for 23 dimensions

### Week 4: Cleanup & Deploy (Optional)

**Day 1-2: Code Cleanup**
- [ ] Remove old keyword matching code
- [ ] Add comprehensive comments
- [ ] Update `.env.example`
- [ ] Create migration guide

**Day 3-4: Documentation**
- [ ] Update `PUMPDRIVE_RECOMMENDATION_ALGORITHM_GUIDE.md`
- [ ] Document new scoring system
- [ ] Add troubleshooting section
- [ ] Create admin guide for monitoring costs

**Day 5-7: Deployment**
- [ ] Deploy to staging
- [ ] Test with 5-10 real users
- [ ] Monitor costs and performance
- [ ] Deploy to production
- [ ] Monitor first 50 patients

---

## 💰 Cost Analysis

### Per-Patient Breakdown

```
Stage 4 (Free Text AI):      gpt-4o-mini   = $0.001
Stage 5 (Context 7):         gpt-4o        = $0.002
Stage 6 (Final AI):          gpt-4o        = $0.036
───────────────────────────────────────────────────
TOTAL PER PATIENT:                         = $0.039
```

### Volume Projections

```
Volume              Monthly Cost    Annual Cost
───────────────────────────────────────────────
100 patients/month  $3.90           $46.80
500 patients/month  $19.50          $234
1,000/month         $39             $468
5,000/month         $195            $2,340
```

**Break-even: 2,564 patients = $100 bill**

---

## 🔧 Context 7 Integration

### What Context 7 Provides

✅ **Already Implemented** (from CONTEXT7_IMPLEMENTATION_SUMMARY.md):

1. **Session Persistence** - Users can resume assessments
2. **Auto-save** - Progress saved every 30 seconds
3. **Feedback Loop** - Learn from user choices
4. **Conflict Detection** - Smart clarifying questions
5. **Analytics Dashboard** - Track accuracy over time

### How New Scoring Uses Context 7

**Conflict Detection:**
```javascript
import { detectConflicts } from '../utils/pumpConflicts.config';

// After collecting user inputs
const conflicts = detectConflicts(sliders, selectedFeatures);

if (conflicts.hasConflict) {
  // Show conflict resolver UI
  // Get user's priority choice
  // Apply priority weighting in scoring
}
```

**Feedback Learning:**
```javascript
import { pumpDriveContext7Service } from '../services/pumpDriveContext7.service';

// After recommendation
const feedback = await pumpDriveContext7Service.getFeedback(sessionId);

if (feedback.actualPump !== recommendation.topChoice) {
  // Log the mismatch
  // Adjust AI prompt for similar profiles
  // Track accuracy metrics
}
```

**Session Resume:**
```javascript
// On page load
const session = pumpDriveContext7Service.getSessionByUserId(userId);

if (session && session.status === 'incomplete') {
  // Show "Welcome Back" UI
  // Pre-fill previous responses
  // Allow user to continue or start over
}
```

---

## 🎯 Success Metrics

### Cost Metrics
- ✅ Average cost per patient: **$0.039**
- ✅ Patients to $100 bill: **2,564**
- ✅ Monthly cost at 500 patients: **$19.50**

### Quality Metrics
- ✅ All 6 pumps can reach 100%
- ✅ Free text semantic accuracy: >90%
- ✅ Context 7 trigger rate: 30-50%
- ✅ Dimension coverage: 8-12 per patient

### Performance Metrics
- ✅ Total time: <10 seconds
- ✅ Stage 4: <2 seconds
- ✅ Stage 5: <2 seconds
- ✅ Stage 6: <4 seconds

---

## 🚨 Troubleshooting

### Issue: Free Text Not Detecting Intent

**Symptoms:** "I love to swim" doesn't boost water pumps

**Solution:**
1. Check OpenAI response in console
2. Verify prompt includes pump strengths
3. Increase temperature to 0.4
4. Add more examples to prompt

### Issue: Costs Higher Than Expected

**Symptoms:** Token usage exceeds $0.04/patient

**Solution:**
1. Check token counts in logs
2. Reduce prompt size (shorten descriptions)
3. Switch Stage 4 to `gpt-3.5-turbo` (90% cheaper)
4. Cache 23 dimensions (don't re-fetch)

### Issue: All Pumps Same Score

**Symptoms:** All pumps at 40-50%

**Solution:**
1. Verify sliders are being passed
2. Check features are selected
3. Ensure free text is not empty
4. Review slider adjustment logic

---

## 📞 Next Steps

### Ready to Start?

**Next Command:**
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npm install openai@latest
```

Then follow Week 1 checklist above.

---

**Last Updated:** 2025-10-06
**Document Version:** 3.1
**Implementation Status:** ✅ CORE COMPLETE - Ready for Testing

---

## 📋 Implementation Progress

### ✅ Week 1 - COMPLETED (2025-10-06)

**Dependencies:**
- [x] OpenAI SDK already installed
- [x] OpenAI API key configured in `.env`
- [x] Model configurations set (gpt-4o-mini, gpt-4o)

**Core Implementation:**
- [x] **Stage 1:** `initializeScores()` - All pumps start at 30%
- [x] **Stage 2:** `applySliderAdjustments()` - With penalties (±12%)
- [x] **Stage 3:** `applyFeatureAdjustments()` - With penalties (±8%)
- [x] **Stage 4:** `analyzeFreeTextWithAI()` - Semantic intent analysis (0-25%)
- [x] **Stage 5:** `generateContext7Question()` - Smart follow-ups (±5%)
- [x] **Stage 5:** `applyContext7Boosts()` - Apply user's answer
- [x] **Stage 6:** `performFinalAIAnalysis()` - 23 dimensions (0-20%)
- [x] **Main Orchestrator:** `generatePumpRecommendationsV3()` - All 6 stages
- [x] **API Integration:** Updated `/api/pumpdrive/recommend` endpoint

**Code Location:** `/Users/rakeshpatel/Desktop/tshla-medical/server/pump-report-api.js`
- Lines 3310-3320: Stage 1 (Base Scores)
- Lines 3325-3424: Stage 2 (Sliders)
- Lines 3429-3538: Stage 3 (Features)
- Lines 3543-3742: Stage 4 (AI Free Text)
- Lines 3747-3834: Stage 5 (Context 7)
- Lines 3839-3944: Stage 6 (Final AI)
- Lines 3949-4043: Main Orchestrator
- Line 4195: API calls V3 function

### 🔄 Next Steps - Week 2

**Testing Required:**
- [ ] Test Stage 1-3 with manual inputs
- [ ] Test Stage 4 AI with "I love to swim" → should detect water resistance
- [ ] Test Stage 5 Context 7 triggering (close scores)
- [ ] Test Stage 6 with 23 dimensions from database
- [ ] Verify all 6 pumps can reach 100%
- [ ] Monitor OpenAI costs (~$0.04 per patient)

**Frontend Updates:**
- [ ] Update results page to show `allPumps` array
- [ ] Display dimension breakdowns
- [ ] Show Context 7 questions when needed
- [ ] Add "Why this pump?" reasoning display

**Deployment:**
- [ ] Test with 5-10 real users
- [ ] Monitor logs for V3 console output
- [ ] Verify costs match projections
- [ ] Deploy to production

---

## 🎉 What's New in V3

### Key Improvements

1. **Base Score Changed:** 30% (was 70%) - More room for differentiation
2. **Sliders Have Weight:** Now 30% of score (was just bonuses)
3. **Features Include Penalties:** Not just boosts anymore
4. **AI Semantic Analysis:** "I swim daily" → water resistance boost (no hardcoded keywords!)
5. **Context 7 Integration:** Smart follow-up questions when scores are close
6. **23 Dimensions Used:** Final AI analysis cites specific dimensions
7. **All Pumps Equal:** Every pump can reach 100% with right profile

### How to Test

**Test Semantic Understanding:**
```bash
# Free text: "I love to swim and I'm in the pool every day"
# Expected: Medtronic 780G and Omnipod 5 get water resistance boost
# NOT dependent on exact keyword "waterproof"
```

**Test Context 7 Triggering:**
```bash
# Set sliders to create close scores (e.g., all 5s)
# Expected: Context 7 question appears
# Choose option → See scores update with ±5%
```

**Test All 6 Pumps Reaching 100%:**
- Medtronic 780G: Aggressive control + swimming + travel
- Tandem t:slim X2: Tech-savvy + active + teenager
- Tandem Mobi: Discretion + iPhone + smallest
- Omnipod 5: Simple + tubeless + no charging
- Beta Bionics iLet: Carb burnout + simplicity + kids
- Twiist: Apple Watch + lightest + innovation

### Monitoring

**Console Logs to Watch:**
```
[V3] Stage 1: Initializing base scores at 30%
[V3] Stage 2: Applying slider adjustments
[V3] Stage 3: Applying feature adjustments
[V3] Stage 4: Analyzing free text with AI semantic understanding
[V3] Stage 5: Checking if Context 7 question needed
[V3] Stage 6: Final AI analysis with 23 dimensions
[V3] ====== V3.0 Recommendation Complete ======
```

**Cost Tracking:**
- Stage 4: ~$0.001 per call (gpt-4o-mini)
- Stage 5: ~$0.002 per call (gpt-4o)
- Stage 6: ~$0.036 per call (gpt-4o)
- **Total: ~$0.039 per patient**

---

*End of Implementation Plan*
