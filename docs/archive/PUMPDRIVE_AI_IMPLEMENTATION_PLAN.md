# PumpDrive AI-Powered Scoring System - Complete Implementation Plan

**Created:** 2025-10-06
**Status:** Ready for Implementation
**Estimated Time:** 3-4 weeks
**Cost:** $0.039 per patient (~4 cents)

---

## 📊 Executive Summary

### What We're Building

Replacing AWS Bedrock with OpenAI to create an intelligent pump recommendation system where:
- ✅ **All 6 pumps can reach 100%** (not just 4)
- ✅ **AI understands patient INTENT** (not just exact keywords)
- ✅ **Cost optimized at $0.039/patient** (95% cheaper than Bedrock)
- ✅ **Free text + AI have highest weight** (45% of total score)
- ✅ **Context 7 integration** for smart follow-up questions
- ✅ **23 dimensions fully utilized** from database

---

## 💰 Cost Analysis - Complete Breakdown

### Patients Until $100 Bill

| Configuration | Cost/Patient | Patients to $100 | Quality | Recommendation |
|---------------|--------------|------------------|---------|----------------|
| **GPT-4 Turbo (All)** | $0.233 | 429 | ⭐⭐⭐⭐⭐ | Research only |
| **GPT-4o (All)** | $0.058 | 1,724 | ⭐⭐⭐⭐⭐ | Production ready |
| **Hybrid (Recommended)** | $0.039 | **2,564** | ⭐⭐⭐⭐ | **BEST CHOICE** ⭐ |
| **GPT-4o Mini (All)** | $0.003 | 33,333 | ⭐⭐⭐ | Budget option |

### Recommended Hybrid Configuration

```
Stage 4 (Free Text Analysis):    GPT-4o Mini  = $0.001/patient
Stage 5 (Context 7 Questions):   GPT-4o       = $0.002/patient
Stage 6 (Final AI Analysis):     GPT-4o       = $0.036/patient
────────────────────────────────────────────────────────────────
TOTAL PER PATIENT:                            = $0.039 (4 cents)
```

### Annual Cost Projections

```
Volume:              Monthly Cost:    Annual Cost:
────────────────────────────────────────────────
100 patients/month   $3.90            $46.80
500 patients/month   $19.50           $234
1,000 patients/month $39              $468
5,000 patients/month $195             $2,340
```

**Break-even point: 2,564 patients = $100 bill**

---

## 🎯 Complete Scoring Architecture

### Final Formula

```
Base Score (All equal)                 = 40%
+ Stage 2: Sliders                     = ±12% (with penalties)
+ Stage 3: Feature Preferences         = ±8% (with penalties)
+ Stage 4: AI Free Text Analysis       = +25% max (semantic intent)
+ Stage 5: Context 7 AI Questions      = ±5% (fills gaps)
+ Stage 6: Final AI + 23 Dimensions    = +20% (comprehensive)
─────────────────────────────────────────────────────────────────
Maximum Possible                       = 110% → Capped at 100%
Minimum Possible                       = 20%
```

### Key Design Principles

1. **Free Text + AI = 45%** of total weight (was only 15% in old system)
2. **All 6 pumps start equal** at 40% (no bias)
3. **Penalties included** in sliders/features (not just bonuses)
4. **Semantic understanding** over keyword matching
5. **23 dimensions drive scoring** at every stage

---

## 📋 Stage-by-Stage Implementation

### STAGE 1: Baseline (40%)

```javascript
function initializeScores() {
  return {
    'Medtronic 780G': 40,
    'Tandem t:slim X2': 40,
    'Tandem Mobi': 40,
    'Omnipod 5': 40,
    'Beta Bionics iLet': 40,
    'Twiist': 40
  };
}
```

**Purpose:** Every pump starts equal - no inherent advantage.

---

### STAGE 2: Slider Adjustments (±12%)

**Implementation File:** `server/pump-report-api.js`

**Key Changes:**
- ✅ Include BOTH positive and negative adjustments
- ✅ All 5 sliders: activity, techComfort, simplicity, discreteness, timeDedication
- ✅ Range: ±12% max combined

**Example Logic:**

```javascript
function applySliderAdjustments(scores, sliders) {
  const { activity = 5, techComfort = 5, simplicity = 5, discreteness = 5, timeDedication = 5 } = sliders;

  // Activity (1-10)
  if (activity >= 7) {
    scores['Tandem t:slim X2'] += 6;
    scores['Tandem Mobi'] += 4;
    scores['Omnipod 5'] += 3;
    scores['Twiist'] += 5;
    scores['Medtronic 780G'] -= 3;  // ← PENALTY
    scores['Beta Bionics iLet'] -= 2;  // ← PENALTY
  }

  // Tech Comfort (1-10)
  if (techComfort <= 3) {
    scores['Omnipod 5'] += 8;
    scores['Beta Bionics iLet'] += 10;
    scores['Tandem t:slim X2'] -= 5;  // ← PENALTY
    scores['Tandem Mobi'] -= 4;  // ← PENALTY
  }

  // Simplicity (1-10)
  if (simplicity >= 7) {
    scores['Beta Bionics iLet'] += 12;
    scores['Omnipod 5'] += 8;
    scores['Tandem t:slim X2'] -= 4;  // ← PENALTY
    scores['Medtronic 780G'] -= 2;  // ← PENALTY
  }

  // Discreteness (1-10)
  if (discreteness >= 7) {
    scores['Tandem Mobi'] += 12;
    scores['Omnipod 5'] += 8;
    scores['Twiist'] += 7;
    scores['Medtronic 780G'] -= 6;  // ← PENALTY
    scores['Beta Bionics iLet'] -= 3;  // ← PENALTY
  }

  // Time Dedication (1-10)
  if (timeDedication <= 4) {
    scores['Beta Bionics iLet'] += 10;
    scores['Omnipod 5'] += 5;
    scores['Tandem t:slim X2'] -= 2;  // ← PENALTY
  }

  return scores;
}
```

**Complete slider logic documented in:** `PUMPDRIVE_AI_IMPLEMENTATION_PLAN.md` (this file) - Section "Complete Slider Logic"

---

### STAGE 3: Feature Preferences (±8%)

**Implementation File:** `server/pump-report-api.js`

**Key Changes:**
- ✅ Each feature has BOTH boosts and penalties
- ✅ Selecting a feature helps some pumps, hurts others
- ✅ Range: ±8% max combined

**Example Logic:**

```javascript
function applyFeatureAdjustments(scores, selectedFeatures) {
  const FEATURE_IMPACT = {
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
    'ultra-small-size': {
      boosts: { 'Tandem Mobi': 15 },
      penalties: { 'Medtronic 780G': -4, 'Beta Bionics iLet': -3 }
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
    }
    // ... all features
  };

  selectedFeatures.forEach(feature => {
    const impact = FEATURE_IMPACT[feature.id];
    if (impact) {
      Object.entries(impact.boosts).forEach(([pump, pts]) => scores[pump] += pts);
      Object.entries(impact.penalties).forEach(([pump, pts]) => scores[pump] += pts);
    }
  });

  return scores;
}
```

**Complete feature mapping documented in:** Section "Complete Feature Impact Matrix"

---

### STAGE 4: AI-Powered Free Text (0-25%)

**⚠️ THIS IS THE BIG CHANGE - REPLACES HARD-CODED KEYWORDS**

**Implementation File:** `server/pump-report-api.js`

**Old Approach (BROKEN):**
```javascript
// ❌ BAD: Exact keyword matching
if (freeText.includes('waterproof pod')) {
  scores['Omnipod 5'] += 10;
}
// MISSES: "I love to swim", "I'm in the pool daily", etc.
```

**New Approach (AI-POWERED):**
```javascript
async function analyzeFreeTextWithAI(freeText) {
  const prompt = `Extract INTENT from patient text (not just keywords).

PATIENT TEXT:
"${freeText}"

TASK:
1. Extract all needs/desires/pain points
2. Map to pump dimensions (1-23)
3. Score each pump (0-25 pts) based on fit

OUTPUT (JSON):
{
  "extractedIntents": [
    { "intent": "string", "dimensions": [numbers], "confidence": "high|medium|low" }
  ],
  "pumpScores": {
    "Medtronic 780G": { "points": 0-25, "reasoning": "string" },
    "Tandem t:slim X2": { "points": 0-25, "reasoning": "string" },
    // ... all 6 pumps
  },
  "dimensionsCovered": [numbers],
  "dimensionsMissing": [numbers]
}`;

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

**Examples of AI Understanding Intent:**

| Patient Says | AI Extracts | Pumps Boosted |
|--------------|-------------|---------------|
| "I love to swim" | Intent: Daily swimming, needs water resistance (Dimension 11) | Medtronic +8, Omnipod +7, Mobi +5 |
| "Carb counting exhausts me" | Intent: Burnout on carbs, wants simplification (Dimension 8) | iLet +8, Twiist +3, Omnipod +2 |
| "I need something for my teenager" | Intent: Pediatric use, caregiver needs (Dimension 17) | t:slim +12, iLet +10, Mobi +8 |
| "I don't want to think about insulin" | Intent: Hands-off automation (Dimensions 4, 8, 12) | iLet +15, Omnipod +8, Medtronic +6 |

**Complete prompt template in:** Section "Stage 4 Complete Prompt"

---

### STAGE 5: Context 7 Questions (±5%)

**Implementation File:** `server/pump-report-api.js`

**When to Trigger:**
- Close scores (within 10% of each other)
- Dimension gaps (important dimensions not addressed)

**Example Flow:**

```javascript
async function generateContext7Question(scores, freeTextAnalysis, userData) {
  // Check for close competitors
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topScore = sortedScores[0][1];
  const closeCompetitors = sortedScores.filter(([_, s]) => topScore - s <= 10);

  if (closeCompetitors.length <= 1) return null; // Clear winner

  const prompt = `Generate 1 question to differentiate pumps.

CLOSE SCORES:
${closeCompetitors.map(([n, s]) => `${n}: ${s}%`).join('\n')}

DIMENSIONS NOT ADDRESSED:
${freeTextAnalysis.dimensionsMissing.join(', ')}

Generate multiple-choice with 3 options and boost values.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Need reasoning - Cost: $0.002 per patient
    // ...
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Example Question Generated:**

```json
{
  "question": "Which matters more to you?",
  "context": "Omnipod and iLet are very close. This will help finalize.",
  "dimension": 3,
  "options": [
    {
      "text": "Tubeless freedom is non-negotiable",
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

---

### STAGE 6: Final AI Analysis (0-20%)

**Implementation File:** `server/pump-report-api.js`

**Purpose:** Comprehensive review using ALL 23 dimensions from database

```javascript
async function performFinalAIAnalysis(currentScores, userData, freeTextAnalysis, dimensions) {
  const prompt = `Final scoring review with 23-dimension analysis.

CURRENT SCORES (after 5 stages):
${Object.entries(currentScores).map(([n, s]) => `${n}: ${s}%`).join('\n')}

PATIENT PROFILE:
Sliders: ${JSON.stringify(userData.sliders)}
Features: ${userData.features.map(f => f.title).join(', ')}
Free Text: "${userData.freeText}"
Intents: ${freeTextAnalysis.extractedIntents.map(i => i.intent).join('; ')}

23-DIMENSION DATABASE:
${formatAllDimensionsWithDetails(dimensions)}

TASK:
1. Identify MOST critical dimensions for this patient
2. Assess each pump's alignment across dimensions
3. Award 0-20 bonus points per pump
4. Cite specific dimensions in reasoning

OUTPUT: Final scores with dimension citations`;

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

**Output Format:**

```json
{
  "finalScores": {
    "Omnipod 5": {
      "score": 98,
      "dimensionBonus": 18,
      "keyDimensions": [3, 11, 13, 18, 22],
      "reasoning": "Dimension 3 (Tubeless) perfect for freedom need. Dimension 11 (Water) excellent for swimming. Dimension 13 (Simple UI) matches low tech comfort..."
    }
  },
  "topChoice": {
    "name": "Omnipod 5",
    "finalScore": 98,
    "primaryReasons": [
      "Dimension 3: Completely tubeless eliminates tubing hassles",
      "Dimension 11: Waterproof for swimming without disconnect",
      "Dimension 13: Simple interface for low-tech users"
    ]
  },
  "dimensionBreakdown": {
    "mostRelevant": [
      { "number": 3, "name": "Tubing preference", "winner": "Omnipod 5" },
      { "number": 11, "name": "Water resistance", "winner": "Medtronic 780G" }
    ]
  }
}
```

---

## 🎯 How Each Pump Reaches 100%

### Medtronic 780G → 100%

**Target User:** Aggressive control swimmer who travels internationally

```
Base:                                    40%
Sliders (low time, high tech):          +9%    = 49%
Features (AA battery, aggressive, swim): +29%   = 78%
Free Text Keywords:
  "aggressive control tight 100%"        +15%
  "competitive swimmer dive 12 feet"     +15%
  "travel AA batteries"                  +15%
  "occlusion keep insulin"               +12%
  Total (capped):                        +25%   = 103% → 100% ✅
```

**Free Text Example:**
> "I need the most aggressive automation with tight control - I want 100% correction doses. I'm a competitive swimmer and dive regularly up to 12 feet deep. I travel internationally for work and love that I can swap AA batteries anywhere. When I have an occlusion I want to keep the insulin and not waste it."

---

### Tandem t:slim X2 → 100%

**Target User:** Tech-savvy active parent with teenager needing remote bolus

```
Base:                                    40%
Sliders (very active, high tech):       +19%   = 59%
Features (touchscreen, CGM, phone):     +23%   = 82%
Free Text Keywords:
  "tech-savvy touchscreen smartphone"    +12%
  "active gym exercise sports"           +10%
  "multiple CGM Dexcom Libre"            +10%
  "teenager remote bolus caregiver"      +12%
  "t:connect updates"                    +12%
  Total (capped):                        +25%   = 107% → 100% ✅
```

**Free Text Example:**
> "I'm extremely tech-savvy and love the modern touchscreen interface. I'm very active - gym daily, exercise regularly, play sports. I need multiple CGM options because I switch between Dexcom G7 and Libre. For my teenager, remote bolus via Tandem Source is a must. Love the t:connect platform with frequent updates."

---

### Tandem Mobi → 100%

**Target User:** Discretion-focused iPhone user wants smallest pump

```
Base:                                    40%
Sliders (very discreet, high tech):     +23%   = 63%
Features (ultra-small, iPhone, wireless): +31%  = 94%
Free Text Keywords:
  "smallest tiniest discreet pocket"     +15%
  "forget wearing lightweight"           +12%
  "iPhone control app"                   +12%
  "wireless charging"                    +10%
  Total (capped):                        +25%   = 119% → 100% ✅
```

**Free Text Example:**
> "I want the smallest, tiniest, most discreet pump that fits in my pocket. I'm an iPhone user and love that it's completely controlled by my iPhone. Wireless charging is perfect. The pump is so lightweight and comfortable I forget I'm wearing it."

---

### Omnipod 5 → 100%

**Target User:** Simple, low-tech user who values tubeless freedom

```
Base:                                    40%
Sliders (low tech, simple, discreet):   +29%   = 69%
Features (tubeless, waterproof, dual):  +28%   = 97%
Free Text Keywords:
  "tubeless no tubing pod"               +15%
  "simple easy basic"                    +12%
  "never charge"                         +12%
  "waterproof swim"                      +10%
  "multiple sites arm stomach"           +10%
  Total (capped):                        +25%   = 122% → 100% ✅
```

**Free Text Example:**
> "I absolutely need a tubeless pump with no tubing at all - complete freedom. I'm not tech-savvy and want something simple and easy. I love that there's no charging ever. It's fully waterproof so I can swim without disconnecting. I can wear it on my arm or stomach."

---

### Beta Bionics iLet → 100%

**Target User:** Carb-counting burnout parent with child

```
Base:                                    40%
Sliders (low tech, simple, low time):   +32%   = 72%
Features (no carbs, meal, charging):    +29%   = 101% → 100% ✅

Already at 100% from sliders + features alone!

Free Text would add another +25% but capped.
```

**Free Text Example:**
> "I am completely burned out on carb counting - I want to skip carbs entirely. The meal announcements with simple meal sizes are life-changing. I have terrible alarm fatigue - I need minimal alarms. This is for my child and needs to be simple for kids. I want hands-off automation."

---

### Twiist → 100%

**Target User:** Apple ecosystem enthusiast wants innovation

```
Base:                                    40%
Sliders (active, high tech, discreet):  +22%   = 62%
Features (Apple Watch, emoji, light):   +34%   = 96%
Free Text Keywords:
  "Apple Watch bolusing wrist"           +15%
  "lightest 2 ounces barely feel"        +15%
  "emoji food pics"                      +12%
  "Tidepool 15 follow"                   +12%
  "OTA updates innovative"               +15%
  Total (capped):                        +25%   = 121% → 100% ✅
```

**Free Text Example:**
> "I want the most innovative pump with Apple Watch bolusing - dosing from my wrist is game-changing. It's the lightest pump at 2 ounces - I barely feel it. The emoji interface is perfect. Tidepool integration so 15 family members can follow is great. Love automatic OTA updates."

---

## 📁 Implementation Checklist

### Week 1: Core Infrastructure

**Dependencies:**
- [ ] `cd /Users/rakeshpatel/Desktop/tshla-medical`
- [ ] `npm install openai@latest`
- [ ] `npm uninstall aws-sdk`
- [ ] Add `VITE_OPENAI_API_KEY=sk-...` to `.env`

**Code Changes - `server/pump-report-api.js`:**
- [ ] Import OpenAI: `const OpenAI = require('openai');`
- [ ] Initialize client: `const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });`
- [ ] Replace `generateRuleBasedRecommendations()` with `generatePumpRecommendationsOpenAI()`
- [ ] Implement `initializeScores()`
- [ ] Implement `applySliderAdjustments()` (with penalties)
- [ ] Implement `applyFeatureAdjustments()` (with penalties)
- [ ] Test stages 1-3 (baseline + sliders + features)

### Week 2: AI Stages

**Code Changes - `server/pump-report-api.js`:**
- [ ] Implement `analyzeFreeTextWithAI()` (Stage 4)
- [ ] Implement `applyFreeTextBoosts()`
- [ ] Test semantic analysis: "I love to swim" → water resistance boost
- [ ] Implement `generateContext7Question()` (Stage 5)
- [ ] Implement `applyContext7Boosts()`
- [ ] Test Context 7 triggering (close scores)
- [ ] Implement `performFinalAIAnalysis()` (Stage 6)
- [ ] Test with 23 dimensions from database
- [ ] Verify `fetchPumpComparisonData()` returns 23 dimensions

### Week 3: Integration & Testing

**Testing:**
- [ ] Test all 6 pumps reaching 100% (create test cases)
- [ ] Test free text variations (swim, carbs, teenager, etc.)
- [ ] Test Context 7 triggering logic
- [ ] Monitor token usage and costs
- [ ] Verify average cost ~$0.04 per patient
- [ ] Load test with 100 mock patients

**Frontend Updates:**
- [ ] Update `src/pages/PumpDriveUnified.tsx` for Context 7 display
- [ ] Update `src/components/PumpDriveResults.tsx` with AI reasoning
- [ ] Show dimension citations in results
- [ ] Display "Why this pump?" explanations

### Week 4: Cleanup & Launch

**Cleanup:**
- [ ] Remove ALL AWS Bedrock code (lines 3375-3520 in pump-report-api.js)
- [ ] Remove `require('aws-sdk')` imports
- [ ] Update `.env.example` (already says Bedrock removed)
- [ ] Delete unused Bedrock service files

**Documentation:**
- [ ] Update `PUMPDRIVE_RECOMMENDATION_ALGORITHM_GUIDE.md`
- [ ] Document new scoring system
- [ ] Add troubleshooting section
- [ ] Create cost monitoring guide

**Deployment:**
- [ ] Deploy to staging
- [ ] Test with real users (5-10 patients)
- [ ] Monitor costs and performance
- [ ] Deploy to production
- [ ] Monitor first 50 patients
- [ ] Collect feedback and iterate

---

## 🔧 Code Snippets - Copy/Paste Ready

### Main Function - Replace Entire generatePumpRecommendations

```javascript
/**
 * Generate pump recommendations using OpenAI (replaces AWS Bedrock)
 */
async function generatePumpRecommendationsOpenAI(userData) {
  console.log('Starting AI-powered pump recommendation...');

  // Stage 1: Initialize all pumps at 40%
  let scores = initializeScores();
  console.log('Stage 1 (Baseline):', scores);

  // Stage 2: Apply slider adjustments (±12%)
  scores = applySliderAdjustments(scores, userData.sliders || {});
  console.log('Stage 2 (Sliders):', scores);

  // Stage 3: Apply feature preference adjustments (±8%)
  scores = applyFeatureAdjustments(scores, userData.features || []);
  console.log('Stage 3 (Features):', scores);

  // Stage 4: AI-powered free text analysis (+25% max)
  const { scores: scoresAfterFreeText, freeTextAnalysis } = await applyFreeTextBoosts(
    scores,
    userData.freeText?.currentSituation || ''
  );
  scores = scoresAfterFreeText;
  console.log('Stage 4 (Free Text):', scores);

  // Stage 5: Context 7 question if needed (±5%)
  const context7Question = await generateContext7Question(scores, freeTextAnalysis, userData);

  if (context7Question && userData.context7Answer) {
    scores = applyContext7Boosts(scores, userData.context7Answer);
    console.log('Stage 5 (Context 7):', scores);
  }

  // Stage 6: Final AI analysis with 23 dimensions (+20%)
  const dimensions = await fetchPumpComparisonData();
  const finalAnalysis = await performFinalAIAnalysis(
    scores,
    userData,
    freeTextAnalysis,
    dimensions
  );
  console.log('Stage 6 (Final AI):', finalAnalysis.finalScores);

  // Format response
  return formatRecommendationResponse(finalAnalysis, context7Question);
}
```

### OpenAI Client Initialization

```javascript
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY
});

// Model configuration (can override in .env)
const MODELS = {
  freeText: process.env.VITE_OPENAI_MODEL_STAGE4 || 'gpt-4o-mini',
  context7: process.env.VITE_OPENAI_MODEL_STAGE5 || 'gpt-4o',
  finalAnalysis: process.env.VITE_OPENAI_MODEL_STAGE6 || 'gpt-4o'
};
```

### Environment Variables

Add to `.env`:

```bash
# OpenAI Configuration (replaces AWS Bedrock)
VITE_OPENAI_API_KEY=sk-proj-...your-key-here...

# Optional: Override models (defaults shown)
VITE_OPENAI_MODEL_STAGE4=gpt-4o-mini
VITE_OPENAI_MODEL_STAGE5=gpt-4o
VITE_OPENAI_MODEL_STAGE6=gpt-4o
```

---

## 📊 Complete Slider Logic

### Activity Slider (1-10)

```javascript
// Very Active (7-10)
if (activity >= 7) {
  scores['Tandem t:slim X2'] += 6;    // Exercise modes
  scores['Tandem Mobi'] += 4;          // Compact for activity
  scores['Omnipod 5'] += 3;            // Tubeless freedom
  scores['Twiist'] += 5;               // Lightweight
  scores['Medtronic 780G'] -= 3;       // Bulkier
  scores['Beta Bionics iLet'] -= 2;    // Less exercise features
}

// Sedentary (1-3)
else if (activity <= 3) {
  scores['Medtronic 780G'] += 3;       // Reliable, size OK
  scores['Omnipod 5'] += 2;            // Comfortable at rest
  scores['Beta Bionics iLet'] += 1;    // Simple automation
}
```

### Tech Comfort Slider (1-10)

```javascript
// Low Tech (1-3)
if (techComfort <= 3) {
  scores['Omnipod 5'] += 8;            // Simple pod system
  scores['Beta Bionics iLet'] += 10;   // Simplest interface
  scores['Tandem t:slim X2'] -= 5;     // Touchscreen complexity
  scores['Tandem Mobi'] -= 4;          // iPhone dependent
  scores['Medtronic 780G'] -= 3;       // Button complexity
  scores['Twiist'] -= 3;               // Very tech-forward
}

// High Tech (7-10)
else if (techComfort >= 7) {
  scores['Tandem t:slim X2'] += 8;     // Touchscreen pro
  scores['Tandem Mobi'] += 7;          // iPhone integration
  scores['Twiist'] += 6;               // Apple Watch
  scores['Medtronic 780G'] += 3;       // Tech features available
  scores['Omnipod 5'] -= 2;            // Simpler system
  scores['Beta Bionics iLet'] -= 4;    // Too simple for enthusiasts
}

// Moderate Tech (4-6)
else {
  scores['Medtronic 780G'] += 2;       // Balanced
  scores['Beta Bionics iLet'] += 2;    // Balanced
}
```

### Simplicity Slider (1-10)

```javascript
// Want Simple (7-10)
if (simplicity >= 7) {
  scores['Beta Bionics iLet'] += 12;   // Simplest system
  scores['Omnipod 5'] += 8;            // Simple pod
  scores['Tandem t:slim X2'] -= 4;     // Feature-rich
  scores['Tandem Mobi'] -= 3;          // Phone management
  scores['Medtronic 780G'] -= 2;       // More complex
  scores['Twiist'] -= 2;               // Innovation complexity
}

// Want Complex (1-3)
else if (simplicity <= 3) {
  scores['Tandem t:slim X2'] += 5;     // Many features
  scores['Twiist'] += 4;               // Innovation
  scores['Tandem Mobi'] += 3;          // Tech features
  scores['Medtronic 780G'] += 2;       // Customization
  scores['Beta Bionics iLet'] -= 3;    // Too simple
  scores['Omnipod 5'] -= 1;            // Simpler system
}
```

### Discreteness Slider (1-10)

```javascript
// Very Discreet (7-10)
if (discreteness >= 7) {
  scores['Tandem Mobi'] += 12;         // Smallest
  scores['Omnipod 5'] += 8;            // Tubeless
  scores['Twiist'] += 7;               // Lightest
  scores['Medtronic 780G'] -= 6;       // Largest
  scores['Beta Bionics iLet'] -= 3;    // Visible
  scores['Tandem t:slim X2'] -= 2;     // Still visible
}

// Don't Care (1-3)
else if (discreteness <= 3) {
  scores['Medtronic 780G'] += 1;       // Size OK
}
```

### Time Dedication Slider (1-10)

```javascript
// Low Time (1-4)
if (timeDedication <= 4) {
  scores['Beta Bionics iLet'] += 10;   // Hands-off
  scores['Omnipod 5'] += 5;            // Simple pods
  scores['Medtronic 780G'] += 3;       // Set & forget
  scores['Tandem t:slim X2'] -= 2;     // More management
  scores['Tandem Mobi'] -= 1;          // Phone management
  scores['Twiist'] -= 1;               // More management
}

// High Time (8-10)
else if (timeDedication >= 8) {
  scores['Tandem t:slim X2'] += 4;     // Customization pays off
  scores['Tandem Mobi'] += 3;          // Fine-tuning
  scores['Twiist'] += 3;               // Innovation
  scores['Medtronic 780G'] += 2;       // Customization
  scores['Beta Bionics iLet'] -= 5;    // Too automated
  scores['Omnipod 5'] -= 2;            // Simple system
}
```

---

## 📋 Complete Feature Impact Matrix

### Power & Charging Features

```javascript
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
    'Medtronic 780G': -1, 'Tandem t:slim X2': -2,
    'Tandem Mobi': -2, 'Beta Bionics iLet': -2, 'Twiist': -2
  }
},
'inductive-charging': {
  boosts: { 'Beta Bionics iLet': 6 },
  penalties: {}
}
```

### Controls & Interface Features

```javascript
'touchscreen-control': {
  boosts: { 'Tandem t:slim X2': 10, 'Beta Bionics iLet': 2 },
  penalties: { 'Medtronic 780G': -3, 'Omnipod 5': -1 }
},
'iphone-only-control': {
  boosts: { 'Tandem Mobi': 12, 'Twiist': 8 },
  penalties: { 'Medtronic 780G': -2, 'Beta Bionics iLet': -2 }
},
'dual-control-options': {
  boosts: { 'Omnipod 5': 8 },
  penalties: { 'Tandem Mobi': -1 }
},
'apple-watch-bolusing': {
  boosts: { 'Twiist': 15 },
  penalties: { 'Medtronic 780G': -3, 'Beta Bionics iLet': -3 }
},
'phone-bolusing': {
  boosts: { 'Tandem Mobi': 8, 'Tandem t:slim X2': 6, 'Twiist': 8 },
  penalties: { 'Medtronic 780G': -3, 'Beta Bionics iLet': -3 }
}
```

### Size & Wearability Features

```javascript
'ultra-small-size': {
  boosts: { 'Tandem Mobi': 15 },
  penalties: { 'Medtronic 780G': -4, 'Beta Bionics iLet': -3 }
},
'completely-tubeless': {
  boosts: { 'Omnipod 5': 12 },
  penalties: {
    'Medtronic 780G': -1, 'Tandem t:slim X2': -1,
    'Tandem Mobi': -1, 'Beta Bionics iLet': -1, 'Twiist': -1
  }
},
'ultra-lightweight': {
  boosts: { 'Twiist': 10, 'Tandem Mobi': 4 },
  penalties: { 'Medtronic 780G': -2 }
}
```

### Smart Automation Features

```javascript
'aggressive-control': {
  boosts: { 'Medtronic 780G': 12, 'Twiist': 6 },
  penalties: { 'Beta Bionics iLet': -2 }
},
'no-carb-counting': {
  boosts: { 'Beta Bionics iLet': 15 },
  penalties: {
    'Medtronic 780G': -1, 'Tandem t:slim X2': -1,
    'Tandem Mobi': -1, 'Omnipod 5': -1, 'Twiist': -1
  }
},
'simple-meal-announcements': {
  boosts: { 'Beta Bionics iLet': 10 },
  penalties: { 'Tandem t:slim X2': -2, 'Twiist': -2 }
}
```

### Daily Convenience Features

```javascript
'multiple-cgm-options': {
  boosts: { 'Tandem t:slim X2': 8, 'Omnipod 5': 6, 'Beta Bionics iLet': 4 },
  penalties: { 'Tandem Mobi': -2 }
}
```

### Water Features

```javascript
'fully-submersible': {
  boosts: { 'Medtronic 780G': 10, 'Beta Bionics iLet': 6 },
  penalties: { 'Tandem t:slim X2': -3, 'Twiist': -3 }
},
'waterproof-pod': {
  boosts: { 'Omnipod 5': 8, 'Tandem Mobi': 6 },
  penalties: { 'Tandem t:slim X2': -2, 'Twiist': -2 }
}
```

### Innovation Features

```javascript
'emoji-bolusing': {
  boosts: { 'Twiist': 12 },
  penalties: { 'Medtronic 780G': -2 }
}
```

---

## 📋 Stage 4 Complete Prompt

```javascript
const freeTextPrompt = `You are an expert at understanding patient needs for insulin pumps. Extract TRUE INTENTIONS from patient free text, not just keywords.

PATIENT'S FREE TEXT:
"${freeText}"

YOUR TASK:
1. Extract all relevant needs/desires/pain points (ignore keywords, focus on INTENT)
2. Map each need to specific pump dimensions (1-23)
3. Score each pump (0-25 points) based on how well it addresses ALL extracted needs
4. Provide clear reasoning citing dimensions

23 PUMP DIMENSIONS:
1. Battery life & power - How do they charge/power the pump?
2. Phone control & app - Do they want phone bolusing or just viewing?
3. Tubing preference & wear style - Tubeless? Short tube? Traditional?
4. Automation behavior - Aggressive? Gentle? Hands-off?
5. CGM compatibility - Which CGM do they use? Options matter?
6. Target adjustability - Simple targets? Complex profiles?
7. Exercise modes - Active lifestyle? Sports? Gym?
8. Manual bolus workflow - Carb counting? Meal announcements?
9. Reservoir/pod capacity - High insulin use? Frequent changes OK?
10. Adhesive & site tolerance - Skin sensitive? Multiple sites?
11. Water resistance - Swimming? Diving? Just showers?
12. Alerts & alarms - Customizable? Minimal? Alarm fatigue?
13. User interface - Touchscreen? Buttons? Phone-first?
14. Data sharing - Family? Clinic? Platform preference?
15. Clinic support - Established pump? New technology?
16. Travel & airport - Battery swaps? Chargers? International?
17. Pediatric & caregiver - Kids? Remote bolus? Parent control?
18. Visual discretion - Size matters? Want smallest? Don't care?
19. Ecosystem & accessories - Apple Watch? Phone app? Simple?
20. Reliability & occlusion - Keep insulin? Replace pod?
21. Cost & insurance - DME? Pharmacy? Financial assistance?
22. On-body comfort - Lightweight? Sleep comfort? Forget wearing?
23. Support apps & updates - Want latest? Set and forget?

PUMP STRENGTHS (use this to score):

MEDTRONIC 780G:
- Battery: AA batteries (swap anywhere, no charging)
- Automation: Most aggressive (100% corrections vs 60%)
- Water: Best submersible (12 feet × 24 hours)
- Reservoir: 300 units, 7-day wear option
- Control: Buttons only, app for viewing
- Interface: Traditional buttons, no touchscreen
- CGM: Medtronic Guardian/Libre (limited options)
- Travel: Easy (AA batteries anywhere)
- Reliability: Keep insulin on occlusion

TANDEM T:SLIM X2:
- Battery: Rechargeable USB, multi-day, fast charge
- Interface: Touchscreen (smartphone-like)
- Control: Phone bolusing + pump touchscreen
- CGM: Multiple options (Dexcom, Libre 2 Plus, Libre 3 Plus)
- Exercise: Dedicated exercise mode (140-160)
- Customization: Multiple profiles, temp targets
- Automation: Control-IQ, balanced (60% corrections)
- Pediatric: Remote bolus via Tandem Source
- Updates: Frequent firmware updates, modern platform
- Travel: Loaner pump program available
- Support: Widely known by clinics

TANDEM MOBI:
- Size: SMALLEST pump ever made (ultra-compact)
- Discretion: Fits in pocket, very discreet
- Control: iPhone-only full app control
- Battery: Wireless charging pad
- Tubing: Short tubing option, mini pump
- Water: IP28 (8 feet for 60 mins)
- Interface: Phone-first UI, modern app
- Comfort: Forget wearing it, lightweight
- Automation: Same Control-IQ as t:slim
- Reservoir: 200 units (smaller)

OMNIPOD 5:
- Tubing: COMPLETELY TUBELESS (zero tubes)
- Battery: Never charge (integrated pod battery)
- Water: IP28 (8 feet for 60 mins), swim without disconnect
- Control: Phone OR controller (both iOS/Android)
- Sites: Multiple wear sites (arm, stomach, thighs)
- Interface: Simple, low-tech friendly
- Discretion: Invisible under clothes, no tubing
- Travel: No charger needed, just pack pods
- Support: Very popular, wide clinic support
- Comfort: No tubes during sleep

BETA BIONICS ILET:
- Bolusing: NO CARB COUNTING (meal announcements only)
- Simplicity: Simple meal sizes (small/medium/large)
- Automation: Hands-off, set and forget
- Alerts: Minimal (only 4 essential alerts) - reduces alarm fatigue
- Interface: Minimalist touchscreen, very basic
- Battery: 15-min quick charge, 3-day battery
- Pediatric: Simple for kids, easy to understand
- Insurance: Medicare friendly, pharmacy benefits
- Time: Lowest time dedication

TWIIST:
- Innovation: Apple Watch bolusing (dose from wrist!)
- Weight: Lightest pump (2 ounces only)
- Bolusing: Emoji interface (food pics)
- Ecosystem: Full Apple integration (Watch + iPhone)
- Data: Tidepool (15 followers)
- Updates: Automatic OTA updates
- Design: Circular, compact, discreet
- Battery: Replaceable battery system (4 batteries + station)
- Interface: Phone-forward, modern app
- Technology: Newest, most innovative platform

SCORING RULES:
- Perfect fit for stated need: +5 to +8 points per pump
- Good fit: +3 to +5 points
- Mentioned but not primary: +1 to +2 points
- Not relevant: 0 points
- Contradicts stated need: 0 points (don't penalize)
- MAXIMUM total per pump: +25 points

EXAMPLES:

Example 1: "I love to swim and I'm in the pool every day"
INTENT: Needs excellent water resistance for daily swimming
DIMENSION: #11 (Water resistance)
SCORING:
- Medtronic 780G: +8 (12 feet submersible, best rating)
- Omnipod 5: +7 (8 feet, swim without disconnect, no tubing in water)
- Tandem Mobi: +5 (8 feet, can swim with it)
- Beta Bionics iLet: +4 (12 feet but only 30 mins)
- Tandem t:slim X2: +0 (must disconnect for swimming)
- Twiist: +0 (not submersible, must disconnect)

Example 2: "Carb counting is exhausting and I want something simpler"
INTENT: Burnout on carb counting, wants simplified bolusing
DIMENSION: #8 (Manual bolus workflow)
SCORING:
- Beta Bionics iLet: +8 (NO carb counting, meal announcements)
- Omnipod 5: +2 (still requires carbs but has food library)
- Twiist: +3 (emoji interface simplifies, but still carbs)
- Medtronic 780G: +1 (flexible but still carbs)
- Tandem t:slim X2: +1 (requires carbs)
- Tandem Mobi: +1 (requires carbs)

Example 3: "I'm not tech-savvy and want something really easy to use"
INTENT: Low tech comfort, wants simplicity
DIMENSIONS: #2 (Control), #13 (Interface), #8 (Bolusing)
SCORING:
- Beta Bionics iLet: +8 (simplest interface, minimal prompts, no carbs)
- Omnipod 5: +7 (simple pod system, low-tech friendly, dual control)
- Medtronic 780G: +4 (buttons are tactile, no touchscreen complexity)
- Tandem t:slim X2: +0 (touchscreen may be complex)
- Tandem Mobi: +0 (requires iPhone, phone-dependent)
- Twiist: +0 (very tech-forward, requires Apple ecosystem)

Example 4: "I need something for my teenager at school"
INTENT: Pediatric use, caregiver needs remote monitoring/control
DIMENSIONS: #17 (Pediatric & caregiver), #2 (Phone control)
SCORING:
- Tandem t:slim X2: +8 (remote bolus via Tandem Source for caregivers)
- Tandem Mobi: +7 (phone control helps caregivers)
- Omnipod 5: +6 (Omnipod View for sharing, popular with kids)
- Beta Bionics iLet: +7 (simple for kids, minimal complexity)
- Medtronic 780G: +4 (caregiver app for alerts, no remote bolus)
- Twiist: +3 (caregiver app in development)

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
    "Tandem t:slim X2": {
      "points": 0-25,
      "reasoning": "string"
    },
    "Tandem Mobi": {
      "points": 0-25,
      "reasoning": "string"
    },
    "Omnipod 5": {
      "points": 0-25,
      "reasoning": "string"
    },
    "Beta Bionics iLet": {
      "points": 0-25,
      "reasoning": "string"
    },
    "Twiist": {
      "points": 0-25,
      "reasoning": "string"
    }
  },
  "dimensionsCovered": [array of dimension numbers that were addressed],
  "dimensionsMissing": [array of dimension numbers NOT addressed - important for Context 7]
}

NOW ANALYZE THE PATIENT'S TEXT ABOVE AND RETURN JSON.`;
```

---

## 🎯 Success Metrics

### Cost Metrics (Target)
- ✅ Average cost per patient: **$0.039** (4 cents)
- ✅ Patients to $100 bill: **2,564 patients**
- ✅ Monthly cost at 500 patients: **$19.50**
- ✅ 95% cheaper than AWS Bedrock

### Quality Metrics (Target)
- ✅ All 6 pumps can reach 100% (validated test cases)
- ✅ Free text semantic accuracy: >90%
- ✅ Context 7 trigger rate: 30-50% of patients
- ✅ Patient satisfaction: >85% (measure via feedback)
- ✅ Dimension coverage: Average 8-12 dimensions per patient

### Performance Metrics (Target)
- ✅ Total recommendation time: <10 seconds
- ✅ Stage 4 (free text): <2 seconds
- ✅ Stage 5 (context 7): <2 seconds
- ✅ Stage 6 (final AI): <4 seconds
- ✅ API failure rate: <1%

---

## 🚨 Troubleshooting

### Issue: OpenAI API Key Not Working

**Symptoms:** 401 Unauthorized error

**Solution:**
1. Verify key in `.env`: `VITE_OPENAI_API_KEY=sk-proj-...`
2. Restart server: `cd server && npm run dev`
3. Check OpenAI dashboard for usage limits
4. Ensure key has not expired

### Issue: Costs Higher Than Expected

**Symptoms:** Token usage exceeds estimates

**Solution:**
1. Check token counts in console logs
2. Reduce prompt size (shorten dimension descriptions)
3. Switch Stage 4 to `gpt-3.5-turbo` (90% cheaper)
4. Cache 23 dimensions in memory (don't re-fetch)

### Issue: Free Text Not Detecting Intent

**Symptoms:** User says "I love to swim" but no water pumps boosted

**Solution:**
1. Check OpenAI response in console
2. Verify prompt includes pump strengths
3. Increase temperature to 0.4 for more creative interpretation
4. Add more examples to prompt

### Issue: Context 7 Never Triggers

**Symptoms:** No follow-up questions generated

**Solution:**
1. Check close score threshold (currently 10%)
2. Verify dimension gap detection logic
3. Lower threshold to 15% to trigger more often
4. Check console for `generateContext7Question` logs

### Issue: All Pumps Have Same Score

**Symptoms:** All pumps at 40-50%, no differentiation

**Solution:**
1. Verify sliders are being passed correctly
2. Check features are selected
3. Ensure free text is not empty
4. Review slider adjustment logic (may need tuning)

---

## 📞 Support & Next Steps

### Questions?

**Technical Issues:**
- Check logs: `tail -f /Users/rakeshpatel/Desktop/tshla-medical/server/logs/pump-api.log`
- Review this doc: `PUMPDRIVE_AI_IMPLEMENTATION_PLAN.md`
- Check OpenAI status: https://status.openai.com

**Implementation Help:**
- All code snippets are in this document
- Test cases provided for all 6 pumps
- Prompts ready to copy/paste

### Ready to Start?

**Next Command:**
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npm install openai@latest
```

Then follow Week 1 checklist above.

---

**Last Updated:** 2025-10-06
**Document Version:** 1.0
**Implementation Status:** Ready for Week 1

---

*End of Implementation Plan*
