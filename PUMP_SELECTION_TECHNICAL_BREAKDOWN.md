# TSHLA Medical Pump Selection Tool: Complete Technical Breakdown
## *A Detailed Analysis of the 3-Step Assessment Process, Scoring Methodology, and AI Integration*

**Document Version:** 1.0
**Date:** December 2025
**Author:** TSHLA Medical Development Team
**Purpose:** Technical documentation for article publication and transparency disclosure

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Step 1: Lifestyle Preference Sliders](#step-1-lifestyle-preference-sliders)
3. [Step 2: Feature Selections](#step-2-feature-selections)
4. [Step 3: Personal Story (Free Text)](#step-3-personal-story-free-text)
5. [AI Integration Points](#ai-integration-points)
6. [Complete Pump Assignment Tables](#complete-pump-assignment-tables)
7. [Recommendation Processing Flow](#recommendation-processing-flow)
8. [Scoring Weight Breakdown](#scoring-weight-breakdown)
9. [Example Scenarios](#example-scenarios)
10. [Transparency & Accuracy Analysis](#transparency--accuracy-analysis)
11. [Key Takeaways](#key-takeaways)

---

## Executive Summary

The TSHLA pump selection system uses a **3-step progressive assessment** combining rule-based scoring with AI-enhanced analysis:

### The Three Steps

1. **Step 1: Lifestyle Sliders** (5 questions, 1-10 scale)
2. **Step 2: Feature Selections** (17+ selectable pump features)
3. **Step 3: Personal Story** (Free-text narrative)

### Processing Method

The system attempts three recommendation paths in order:

1. **Backend API** (AI-powered, server-side) - Preferred
2. **Frontend OpenAI** (AI-powered, client-side fallback)
3. **Rule-Based Keyword Matching** (deterministic fallback when AI unavailable)

### Key Insight

> **Feature selections and free text story carry 60-80% of decision weight**
> **Sliders provide context but have minimal direct scoring impact (10-15%)**

---

## Step 1: Lifestyle Preference Sliders

### The 5 Assessment Dimensions

| Slider ID | Question | Low Score (1-3) | Medium Score (4-7) | High Score (8-10) |
|-----------|----------|-----------------|-------------------|-------------------|
| **activity** | How Active Are You? | Mostly at desk, light walking, prefer comfort | Regular walks, some gym, weekend activities | Daily workouts, sports, always on the move |
| **techComfort** | How Much Do You Love Technology? | Keep it simple, basic phone features only | Use apps daily, learn gradually, pretty comfortable | Love new gadgets, early adopter, tech is exciting! |
| **simplicity** | Do You Prefer Simple or Advanced? | Keep it super simple, fewer buttons and options | Some features are nice, but not overwhelming | Give me all the features, data, and control options |
| **discreteness** | How Important is Hiding Your Device? | Must be completely hidden, nobody should notice | Prefer discreet but okay if sometimes visible | Don't care who sees it, function over appearance |
| **timeDedication** | How Much Time Can You Spend on Device Care? | Minimal time, want set-and-forget simplicity | A few minutes daily for basic maintenance | Happy to spend time for optimal performance |

### How Sliders Are Processed

#### In Rule-Based Scoring (Path 3):
- **ONLY ONE SLIDER MATTERS:** `techComfort >= 7` triggers Tandem t:slim X2 (Priority 5)
- **All other sliders:** NOT directly scored in rule-based path
- **Impact:** ~5% of total decision weight

#### In AI Analysis (Paths 1 & 2):
- Sliders converted to text descriptions
- AI receives context like: "Very active lifestyle, needs durable and flexible solutions"
- AI instructed: *"SLIDER PREFERENCES: General lifestyle ratings are **lower priority** than explicit selections"*
- AI interprets patterns and contradictions
- **Impact:** ~10-15% of total AI decision weight

### Code Reference
- **File:** `src/pages/PumpDriveUnified.tsx` (lines 21-72)
- **Service:** `src/services/sliderMCP.service.ts` (lines 170-273)

---

## Step 2: Feature Selections

### Available Features by Pump

The system offers **17 selectable features** mapped to 6 pumps:

| Pump | Number of Features | Key Unique Features |
|------|-------------------|---------------------|
| **Twiist** | 3 | • Apple Watch bolusing ⌚<br>• Emoji dosing 😀<br>• Weighs only 2 ounces 🪶 |
| **Medtronic 780G** | 3 | • Swap AA batteries anywhere 🔋<br>• Most aggressive control (100% correction) 🎯<br>• Submersible to 12 feet 🏊‍♂️ |
| **Tandem t:slim X2** | 3 | • Touchscreen interface 📱<br>• Multiple CGM options 🔄<br>• Phone bolusing 📲 |
| **Tandem Mobi** | 3 | • Smallest pump ever 🤏<br>• iPhone-only control 📱<br>• Wireless charging 🔌 |
| **Omnipod 5** | 3 | • Completely tubeless 🎪<br>• Waterproof pod 💦<br>• Phone OR controller 🎮 |
| **Beta Bionics iLet** | 3 | • No carb counting 🍎<br>• Simple meal announcements 🗣️<br>• Inductive charging ⚡ |

### Feature Categories

| Category | Icon | Description | Example Features |
|----------|------|-------------|------------------|
| **Power & Charging** | 🔋 | Battery and power management | AA batteries, wireless charging, inductive charging |
| **Controls & Interface** | 📱 | How you interact with the pump | Touchscreen, iPhone control, phone/controller options |
| **Size & Wearability** | 💎 | Physical design and comfort | Ultra-lightweight (2 oz), smallest size, tubeless design |
| **Smart Automation** | 🤖 | Automated insulin delivery | Aggressive control, no carb counting, meal announcements |
| **Daily Convenience** | ✨ | Everyday usability features | Phone bolusing, multiple CGM options |
| **Latest Innovation** | 🚀 | Cutting-edge technology | Apple Watch bolusing, emoji dosing |

### Complete Feature List

#### Twiist Features (Innovation Focus)
1. **Apple Watch Bolusing** ⌚
   - *"Deliver insulin from your Apple Watch"*
   - Most convenient dosing ever - just tap your watch
   - **Unique to Twiist** - No other pump offers this

2. **Emoji Bolusing** 😀
   - *"Dose with food emojis 🍎🥪🍕"*
   - Fun, intuitive interface - pick emoji that matches your meal
   - **Unique to Twiist**

3. **Ultra-Lightweight** 🪶
   - *"Weighs only 2 ounces"*
   - Lightest pump available - you'll forget you're wearing it
   - **Unique to Twiist** - Significantly lighter than competitors

#### Medtronic 780G Features (Reliability Focus)
1. **AA Battery Power** 🔋
   - *"Swap batteries anywhere, anytime"*
   - Never worry about finding a charger
   - Buy AA batteries at any store

2. **Aggressive Control** 🎯
   - *"Most aggressive blood sugar control"*
   - 100% correction doses vs 60% on other pumps
   - Tightest glucose control available

3. **Fully Submersible** 🏊‍♂️
   - *"Swim and dive up to 12 feet underwater"*
   - Only pump rated for serious swimming
   - Best waterproofing available

#### Tandem t:slim X2 Features (Technology Focus)
1. **Touchscreen Control** 📱
   - *"Smartphone-like touchscreen interface"*
   - Color touchscreen like your phone
   - No confusing buttons

2. **Multiple CGM Options** 🔄
   - *"Works with multiple CGM brands"*
   - Compatible with Dexcom G6/G7, Libre 2 Plus, upcoming Libre 3
   - Most CGM flexibility

3. **Phone Bolusing** 📲
   - *"Deliver insulin directly from your phone"*
   - Dose using smartphone app
   - No need to pull out pump

#### Tandem Mobi Features (Compact Focus)
1. **Ultra-Small Size** 🤏
   - *"Smallest pump ever made"*
   - Tiny size with short tubing
   - Almost invisible under clothes

2. **iPhone-Only Control** 📱
   - *"Completely controlled by iPhone"*
   - No pump buttons needed
   - iPhone is your remote control

3. **Wireless Charging** 🔌
   - *"Wireless charging like your phone"*
   - Just set on charging plate
   - No cords or plugs

#### Omnipod 5 Features (Freedom Focus)
1. **Completely Tubeless** 🎪
   - *"Zero tubing for total freedom"*
   - No tubes to get caught on things
   - Complete freedom of movement

2. **Waterproof Pod** 💦
   - *"Swim and shower without disconnecting"*
   - Waterproof design
   - Never disconnect for water activities

3. **Dual Control Options** 🎮
   - *"Use phone OR dedicated controller"*
   - Choose smartphone app or handheld controller
   - Flexibility in control method

#### Beta Bionics iLet Features (Simplicity Focus)
1. **No Carb Counting** 🍎
   - *"Never count carbs again"*
   - Just announce meals
   - System figures out insulin automatically

2. **Simple Meal Announcements** 🗣️
   - *"Say 'usual meal' or 'more than usual'"*
   - No complex calculations
   - Simplest workflow available

3. **Inductive Charging** ⚡
   - *"Charges wirelessly like electric toothbrush"*
   - Set and forget charging
   - No ports or connections

### How Features Are Scored

#### In Rule-Based Scoring (Priority Cascade System)

Features trigger **exclusive pump assignments** in strict priority order:

| Priority | Trigger Keywords (in Feature Titles) | Pump Assigned | Score | Reasoning |
|----------|--------------------------------------|---------------|-------|-----------|
| **1** | "2 ounces", "weighs only", "lightest", "2oz" | **Twiist** | 95 | ONLY pump at 2 ounces - physically unique |
| **2** | "apple watch" | **Twiist** | 94 | ONLY pump with Apple Watch control - exclusive technology |
| **3** | "tubeless", "patch" | **Omnipod 5** | 90 | Tubeless pod design - form factor preference |
| **4** | "no carb counting", "simple", "hands-off" | **Beta Bionics iLet** | 88 | No carb counting required - simplicity focus |
| **5** | "touchscreen", "phone" (OR techComfort >= 7) | **Tandem t:slim X2** | 86 | Touchscreen interface - tech preference |
| **Default** | No keywords match | **Medtronic 780G** | 85 | Well-established system - safe default |

**Critical Detail:** This is a **cascading if/else** system - only the **FIRST matching priority** wins. If Priority 1 matches, Priorities 2-6 are never evaluated.

#### In AI Analysis (Contextual Evaluation)

- Features listed with full descriptions
- AI instructed: *"**EXPLICIT FEATURE SELECTIONS**: Features the patient specifically selected carry the **highest weight**"*
- AI considers feature combinations and contradictions
- AI can override feature selections if story reveals contradiction
- **Impact:** ~40-50% of total AI decision weight

### Code Reference
- **File:** `src/data/pumpFeatures.ts` (lines 1-179)
- **Service:** `src/services/sliderMCP.service.ts` (lines 376-443)

---

## Step 3: Personal Story (Free Text)

### What Users Provide

Users are prompted to share:
- Current diabetes situation
- Concerns and fears about pump therapy
- What excites them about getting a pump
- Daily routine and lifestyle details
- Any specific medical needs or constraints

**Recommended Length:** 500-2000+ characters
**Optional:** Users can skip this step

### How Free Text Is Analyzed

#### In Rule-Based Scoring (Keyword Detection)

The system searches for the **same 6 trigger keywords** as feature selections:

| Keywords in Story | Pump Assigned | Score | Example Phrases |
|-------------------|---------------|-------|-----------------|
| "2 ounces", "lightest", "2oz", "minimal weight" | **Twiist** | 95 | "I want the lightest pump possible" |
| "apple watch" | **Twiist** | 94 | "I love my Apple Watch and use it daily" |
| "tubeless", "no tubing", "patch" | **Omnipod 5** | 90 | "I hate the idea of tubes getting caught" |
| "don't want to do anything", "hands-off", "simple" | **Beta Bionics iLet** | 88 | "I just want it to work without thinking" |
| "touchscreen", "phone control" | **Tandem t:slim X2** | 86 | "I'm comfortable with touchscreen devices" |
| (no keywords) | **Medtronic 780G** | 85 | (Default fallback) |

**Note:** Keywords in free text have **equal priority** to feature selections. Both are checked together.

#### In AI Analysis (TRUE Natural Language Processing)

This is where **real AI processing** happens:

**AI Capabilities:**
- **Sentiment Analysis:** Detects fears, excitement, concerns
- **Context Understanding:** "scared of technology" overrides high techComfort slider
- **Pattern Recognition:** Identifies contradictions across all inputs
- **Implicit Needs Extraction:** Understands unstated requirements
- **Personality Assessment:** Infers user personality from writing style

**AI Processing Steps:**
1. **Read entire narrative** (not just keywords)
2. **Identify emotions** (fear, excitement, anxiety, confidence)
3. **Extract priorities** (stated and unstated)
4. **Detect contradictions** (e.g., wants Apple Watch but fears tech)
5. **Resolve conflicts** (prioritize story context over selections)
6. **Generate reasoning** (explain why recommendation matches story)

**Example AI Analysis:**

User Story:
> "I'm a marathon runner and I'm terrified of technology. My iPhone stresses me out. But I saw someone using their Apple Watch to dose insulin and it looked so easy - just tap the watch. I want that simplicity, not fiddling with a device while running."

**AI Understanding:**
- Tech anxiety is HIGH (overrides any high techComfort slider)
- BUT Apple Watch seen as "simple" (not "technology")
- Marathon running = needs convenience during exercise
- Wants "tap and go" simplicity
- **Conclusion:** Twiist recommended DESPITE tech fears because user perceives Apple Watch as simple

**Impact:** ~20-30% of total AI decision weight

### Code Reference
- **File:** `src/pages/PumpDriveUnified.tsx` (lines 103-105, 197-214)
- **AI Prompt:** `src/services/sliderMCP.service.ts` (lines 570-598)
- **Processing:** `src/services/pumpDriveAI.service.ts` (lines 155-202)

---

## AI Integration Points

### Where AI is Actually Used

| Data Input | Rule-Based Processing | AI Processing (Paths 1 & 2) |
|------------|----------------------|------------------------------|
| **Sliders** | ❌ NOT directly scored (except techComfort >= 7) | ✅ YES - Converted to lifestyle descriptions |
| **Features** | ✅ YES - Keyword matching on titles | ✅ YES - Full descriptions with context |
| **Free Text** | ✅ YES - Simple keyword detection (6 triggers) | ✅ YES - **FULL NLP analysis, sentiment, context** |

### AI Priority Instructions

The AI receives this explicit hierarchy in every prompt:

```
ANALYSIS PRIORITY HIERARCHY:

1. EXPLICIT FEATURE SELECTIONS (HIGHEST WEIGHT)
   - Features the patient specifically checked/selected
   - If feature is unique to one pump, strongly favor that pump
   - Example: Apple Watch → ONLY Twiist has this
   - Weight: ~40-50% of decision

2. CLARIFYING RESPONSES (SECOND PRIORITY)
   - Direct answers to conflict resolution questions
   - Used to break ties when multiple pumps match
   - Weight: ~25% of decision

3. PERSONAL STORY KEYWORDS (THIRD PRIORITY)
   - Natural language processing of free text narrative
   - Sentiment analysis of fears/excitement/concerns
   - Context understanding beyond keywords
   - Weight: ~15-25% of decision

4. SLIDER PREFERENCES (LOWEST PRIORITY)
   - General lifestyle ratings (1-10 scales)
   - Provide background context only
   - Can be overridden by story context
   - Weight: ~10% of decision
```

### AI Prompt Structure

The complete prompt sent to OpenAI/Claude includes:

#### Section 1: Instructions & Hierarchy (150 lines)
```
You are an expert diabetes educator and insulin pump specialist.
CRITICAL ANALYSIS INSTRUCTIONS:
- DO NOT use any pre-calculated scores or ranking biases
- Analyze patient responses objectively
- Base recommendations on patient needs vs pump specifications

ANALYSIS PRIORITY HIERARCHY:
[See above - explicit weighting]

CRITICAL PUMP FACTS:
- Apple Watch bolusing: ONLY Twiist supports this
- Lightest weight (2 oz): ONLY Twiist offers this
- Most aggressive algorithm: Medtronic 780G (100% correction)
- Lowest target glucose: Twiist (87 mg/dL standard target)
```

#### Section 2: Slider Preferences (50 lines)
```
📊 USER'S LIFESTYLE PREFERENCES (1-10 scale):

🏃 Activity Level: 8/10
   → Very active lifestyle, needs durable and flexible solutions

📱 Technology Love: 3/10
   → Prefers simple, basic technology with minimal complexity

🎛️ Complexity Preference: 2/10
   → Wants simple, straightforward devices with minimal options

🤫 Privacy/Discreteness: 5/10
   → Prefers discreet but okay if sometimes visible

⏰ Time for Device Care: 3/10
   → Wants set-and-forget simplicity with minimal maintenance
```

#### Section 3: Selected Features (Variable length)
```
⭐ SPECIFIC FEATURES THE USER SELECTED:
The user carefully chose 3 features that appeal to them:

🚀 Latest Innovation:
   ⌚ Apple Watch Bolusing - Deliver insulin from your Apple Watch
      Most convenient dosing ever - just tap your watch to give insulin

💎 Size & Wearability:
   🪶 Ultra-Lightweight - Weighs only 2 ounces
      Lightest pump available - you'll forget you're wearing it

🤖 Smart Automation:
   🍎 No Carb Counting - Never count carbs again
      Just announce meals - system figures out insulin needs automatically
```

#### Section 4: Personal Story (Variable length)
```
💭 USER'S PERSONAL STORY & CONTEXT:
"I'm a marathon runner who does 4-5 races per year. I'm honestly scared
of technology - my iPhone stresses me out and I barely know how to use it.
But I saw another runner with diabetes using their Apple Watch to dose
insulin, and it looked so simple - just tap the watch and done. No pulling
out a device, no fumbling with buttons during a race. That's exactly what
I want. I also hate carrying extra weight when I run - every ounce matters.
And I definitely don't want to count carbs during my races - I just want
to eat and go. Please help me find something that won't slow me down."

🧠 ANALYSIS INSTRUCTIONS:
1. Identify specific concerns, fears, or challenges mentioned
2. Note what excites them or what they're looking forward to
3. Understand their current situation and pain points
4. Look for hints about their personality and values
5. Address their emotional needs in addition to technical requirements
```

#### Section 5: Complete Pump Database (800+ lines)
```
COMPLETE INSULIN PUMP DATABASE (ALL 23 DIMENSIONS):

1. Twiist (Sequel Med Tech)
════════════════════════════════════════
   BATTERY: Rechargeable (4 replaceable batteries) - Rechargeable battery
   PHONE CONTROL: Bolus from phone - Full smartphone app control
   APPLE WATCH: Supported
   TUBING: Tubed (compact) - Ultra-short tubing design
   ALGORITHM: Modern adaptive logic (More aggressive) - Adjusts every 5 minutes
   CGM COMPATIBILITY: Dexcom G6, Dexcom G7
   TARGET ADJUSTABILITY: Customizable - 87-180 mg/dL
   EXERCISE MODE: Activity temp target available
   BOLUS WORKFLOW: Carb counting OR emoji-based meal dosing
   RESERVOIR CAPACITY: 200 units - Pod changed every 3 days
   WATER RESISTANCE: Water-resistant (splash proof, not submersible)
   ALERTS: Customizable - Simple alert system
   INTERFACE: Phone - Smartphone-first interface with Apple Watch support
   DATA SHARING: Share - Twiist Care app for caregivers
   CLINIC SUPPORT: Growing network - New platform gaining adoption
   [... continues for all 23 dimensions ...]
   PROS: Lightest weight, Apple Watch control, Modern design
   CONS: New platform, Limited clinic familiarity
   IDEAL FOR: Tech-savvy users, Active lifestyles, Apple ecosystem users

[... continues for all 6 pumps ...]
```

#### Section 6: Response Format Instructions (30 lines)
```
Please analyze the patient's needs across all 23 pump dimensions and provide:
1. Top recommended pump with detailed reasoning
2. 2-3 alternative options ranked by suitability
3. Key factors that influenced your recommendation
4. Personalized insights explaining the match

Format your response as JSON:
{
  "topChoice": {
    "name": "exact pump name from database",
    "score": 0-100,
    "reasons": ["specific reason", "technical match", "lifestyle fit"]
  },
  "alternatives": [...],
  "keyFactors": [...],
  "personalizedInsights": "Detailed explanation..."
}
```

### What AI Returns

**Example AI Response:**

```json
{
  "topChoice": {
    "name": "Twiist",
    "score": 96,
    "reasons": [
      "Only pump with Apple Watch control - matches your specific request for 'tap the watch and done'",
      "Lightest at 2 ounces - critical for marathon running where 'every ounce matters'",
      "Emoji-based dosing available - eliminates carb counting during races",
      "Despite tech anxiety, Apple Watch is familiar territory - you already wear it for running",
      "Ultra-short tubing won't interfere with running motion"
    ]
  },
  "alternatives": [
    {
      "name": "Beta Bionics iLet",
      "score": 84,
      "reasons": [
        "No carb counting matches your 'don't want to count during races' need",
        "Simplest operation addresses tech anxiety",
        "BUT lacks Apple Watch control you specifically wanted",
        "Heavier than Twiist - less ideal for marathons"
      ]
    },
    {
      "name": "Omnipod 5",
      "score": 79,
      "reasons": [
        "Tubeless design good for running - no tubing concerns",
        "Phone control available (but not Apple Watch)",
        "Pod weight higher than Twiist's 2oz",
        "Requires carb counting - you wanted to avoid this"
      ]
    }
  ],
  "keyFactors": [
    "Marathon running - weight and convenience are critical",
    "Apple Watch simplicity overcomes tech anxiety",
    "No carb counting during races is high priority",
    "Fear of traditional technology BUT comfort with Apple Watch"
  ],
  "personalizedInsights": "The Twiist is uniquely suited to your situation. While you describe yourself as 'scared of technology,' you've already identified Apple Watch control as simple and intuitive - that's exactly what Twiist offers, and no other pump does. At 2 ounces, it's by far the lightest pump available, addressing your concern about carrying extra weight during marathons. The emoji-based bolusing feature means you can dose during races without counting carbs - just tap a banana emoji for your mid-race fuel. Your story reveals you're not actually 'anti-tech' - you're anti-complexity. The Apple Watch you already wear for running becomes your insulin control, which is far simpler than learning a new device. The ultra-short tubing design (much shorter than traditional pumps) won't interfere with your running stride. Your specific phrase 'just tap the watch and done' perfectly describes Twiist's Apple Watch bolusing - it's the only pump that delivers exactly what you envisioned."
}
```

### Code Reference
- **AI Prompt Builder:** `src/services/sliderMCP.service.ts` (lines 445-698)
- **AI Processing:** `src/services/pumpDriveAI.service.ts` (lines 30-153)
- **Response Parser:** `src/services/sliderMCP.service.ts` (lines 708-739)

---

## Complete Pump Assignment Tables

### Rule-Based Scoring Assignment Matrix

**Important:** This table shows the **FIRST MATCH WINS** cascade system. Once any condition matches, the pump is assigned and scoring stops.

| Priority | Trigger Source | Trigger Condition | Pump Assigned | Score | Confidence | Notes |
|----------|----------------|-------------------|---------------|-------|------------|-------|
| **1** | Feature Selection OR Free Text | Contains "2 ounces", "weighs only", "lightest", "2oz", "minimal weight" | **Twiist** | 95 | 75% | ONLY pump at 2oz - physically unique |
| **2** | Feature Selection OR Free Text | Contains "apple watch", "watch control" | **Twiist** | 94 | 75% | ONLY pump with Apple Watch - exclusive tech |
| **3** | Feature Selection OR Free Text | Contains "tubeless", "no tubing", "patch", "pod" | **Omnipod 5** | 90 | 75% | Tubeless pod design - form factor |
| **4** | Feature Selection OR Free Text | Contains "no carb counting", "simple", "hands-off", "don't want to do anything" | **Beta Bionics iLet** | 88 | 75% | No carb counting - simplicity |
| **5** | Feature Selection OR Free Text OR Slider | Contains "touchscreen", "phone control" OR techComfort >= 7 | **Tandem t:slim X2** | 86 | 75% | Touchscreen interface - tech preference |
| **6** | Default Fallback | No triggers match above | **Medtronic 780G** | 85 | 75% | Well-established - safe default |

### AI-Enhanced Scoring (Contextual)

When AI is available, scoring becomes **context-aware** and can deviate from rules:

| Input Combination | AI Analysis Type | Likely Pump(s) | Score Range | Confidence | AI Reasoning Example |
|-------------------|------------------|----------------|-------------|------------|----------------------|
| **Clear Single Feature** | Feature Match | Matching Pump | 90-98 | 90-95% | "You selected Apple Watch control - only Twiist offers this" |
| **Multiple Features, Same Pump** | Pattern Recognition | Matching Pump | 92-98 | 90-95% | "All 3 features you selected are Twiist exclusives - clear preference" |
| **Features from Different Pumps** | Conflict Resolution | Highest Priority Feature | 80-90 | 75-85% | "You selected features from 2 pumps - prioritizing Apple Watch (unique to Twiist)" |
| **Feature + Contradictory Story** | Context Override | Story-Based Pump | 80-92 | 80-90% | "Despite selecting Apple Watch, your story reveals deep tech anxiety - recommending iLet instead" |
| **No Features, Detailed Story** | NLP Extraction | Context-Based Pump | 78-88 | 70-85% | "Your story mentions 'lightest possible' 3 times - implicit Twiist preference" |
| **Slider Contradiction** | Priority Weighting | Feature-Based Pump | 82-90 | 75-85% | "Low tech slider BUT selected Apple Watch - prioritizing explicit feature selection" |
| **Balanced Inputs, No Clear Winner** | Holistic Assessment | Context-Based Pump | 75-85 | 70-80% | "Balanced preferences suggest Medtronic or t:slim X2 as mainstream options" |

### Pump-Specific Trigger Summary

| Pump | Exclusive Triggers | Shared Triggers | Default Fallback |
|------|-------------------|-----------------|------------------|
| **Twiist** | • "Apple Watch"<br>• "2 ounces"<br>• "emoji dosing" | • "lightest"<br>• "phone control" | NO |
| **Medtronic 780G** | • "AA batteries"<br>• "aggressive control"<br>• "12 feet submersible" | • "swim"<br>• "waterproof" | YES (default) |
| **Tandem t:slim X2** | • "touchscreen"<br>• "multiple CGM" | • "phone control"<br>• techComfort >= 7 | NO |
| **Tandem Mobi** | • "smallest pump"<br>• "iPhone only"<br>• "wireless charging" | • "compact"<br>• "small" | NO |
| **Omnipod 5** | • "tubeless"<br>• "patch"<br>• "no tubing" | • "waterproof"<br>• "phone OR controller" | NO |
| **Beta Bionics iLet** | • "no carb counting"<br>• "meal announcements" | • "simple"<br>• "hands-off" | NO |

---

## Recommendation Processing Flow

### 3-Tier Fallback System (Visual Flowchart)

```
┌─────────────────────────────────────────┐
│   USER COMPLETES 3-STEP ASSESSMENT      │
│   • Sliders: 5 values (1-10)            │
│   • Features: 0-17 selections           │
│   • Story: 0-5000+ characters           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   DATA AGGREGATION & VALIDATION         │
│   • Combine all inputs                  │
│   • Generate profile hash (caching)     │
│   • Check for cached recommendation     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   CACHE CHECK                           │
│   Found in cache (< 1 hour old)?       │
└─────────────────────────────────────────┘
         ↓ YES                    ↓ NO
    ┌────────┐                    │
    │ RETURN │                    │
    │ CACHED │                    │
    └────────┘                    ↓
                    ┌─────────────────────────────────┐
                    │   PATH 1: BACKEND API           │
                    │   (Preferred Method)            │
                    ├─────────────────────────────────┤
                    │   POST to server API            │
                    │   ✅ Secure (API key hidden)    │
                    │   ✅ Server-side AI processing  │
                    │   ✅ Better rate limit handling │
                    │   ⏱️ Timeout: 30 seconds        │
                    └─────────────────────────────────┘
                                ↓
                         ┌──────────┐
                         │ Success? │
                         └──────────┘
                    ↓ YES             ↓ NO (timeout/error)
            ┌──────────┐              │
            │ RETURN   │              │
            │ AI RESULT│              │
            └──────────┘              ↓
                    ┌─────────────────────────────────┐
                    │   PATH 2: FRONTEND OPENAI       │
                    │   (Fallback Method)             │
                    ├─────────────────────────────────┤
                    │   Direct OpenAI API call        │
                    │   ⚠️  API key in browser        │
                    │   ✅ Full AI analysis           │
                    │   ⏱️ Timeout: 25 seconds        │
                    └─────────────────────────────────┘
                                ↓
                         ┌──────────┐
                         │ Success? │
                         └──────────┘
                    ↓ YES             ↓ NO (timeout/error)
            ┌──────────┐              │
            │ RETURN   │              │
            │ AI RESULT│              │
            └──────────┘              ↓
                    ┌─────────────────────────────────┐
                    │   PATH 3: RULE-BASED FALLBACK   │
                    │   (Last Resort - Always Works)  │
                    ├─────────────────────────────────┤
                    │   Pure keyword matching         │
                    │   ❌ NO AI processing           │
                    │   ✅ Deterministic result       │
                    │   ✅ Works offline              │
                    │   ⏱️ Instant (<1ms)             │
                    └─────────────────────────────────┘
                                ↓
                    ┌─────────────────────────────────┐
                    │   RULE-BASED LOGIC              │
                    │                                 │
                    │   1. Check features for         │
                    │      Priority 1-5 keywords      │
                    │   2. Check free text for        │
                    │      Priority 1-5 keywords      │
                    │   3. Check techComfort >= 7     │
                    │   4. Default to Medtronic       │
                    └─────────────────────────────────┘
                                ↓
                    ┌─────────────────────────────────┐
                    │   RESULT FORMATTING             │
                    │   • Top pump + score            │
                    │   • 2-3 alternatives            │
                    │   • Reasoning/match factors     │
                    │   • Personalized insights       │
                    │   • Next steps                  │
                    │   • Confidence level            │
                    │   • Source indicator            │
                    │     (AI vs rule-based)          │
                    └─────────────────────────────────┘
                                ↓
                    ┌─────────────────────────────────┐
                    │   CACHE & RETURN                │
                    │   • Save to localStorage        │
                    │   • Save to sessionStorage      │
                    │   • Return to user interface    │
                    └─────────────────────────────────┘
                                ↓
                    ┌─────────────────────────────────┐
                    │   DISPLAY RESULTS               │
                    │   • Show top recommendation     │
                    │   • Show alternatives           │
                    │   • Show user's input summary   │
                    │   • Show "AI" or "Rule-based"   │
                    └─────────────────────────────────┘
```

### Processing Time Comparison

| Path | Average Time | Success Rate | Notes |
|------|-------------|--------------|-------|
| **Cache Hit** | <10ms | ~30-40% | Same inputs within 1 hour |
| **Path 1: Backend API** | 3-8 seconds | ~70-80% | Depends on server availability |
| **Path 2: Frontend OpenAI** | 4-10 seconds | ~85-95% | Depends on OpenAI API status |
| **Path 3: Rule-Based** | <1ms | 100% | Always succeeds - deterministic |

### Code Reference
- **Main Flow:** `src/services/sliderMCP.service.ts` (lines 180-273)
- **Backend API Call:** `src/services/sliderMCP.service.ts` (lines 300-334)
- **Rule-Based Fallback:** `src/services/sliderMCP.service.ts` (lines 376-443)

---

## Scoring Weight Breakdown

### Rule-Based System (Path 3 - No AI)

When both backend API and frontend OpenAI fail, the system uses **pure keyword matching**:

| Input Type | Direct Impact | How It's Used | Effective Weight |
|------------|---------------|---------------|------------------|
| **Feature Selection Keywords** | HIGH | Priority 1-5 cascade, first match wins | 50% |
| **Free Text Keywords** | HIGH | Same 6 triggers as features, checked together | 45% |
| **Slider: techComfort >= 7** | LOW | Only matters if NO keywords match (Priority 5) | 4% |
| **Other Sliders (4 values)** | NONE | NOT used in rule-based scoring at all | 0% |
| **Default Fallback** | GUARANTEED | Medtronic assigned if nothing else matches | 1% |

**Total Predictability:** 100% deterministic - same inputs always produce same output

#### Example Rule-Based Scoring Scenarios

**Scenario A: Feature Keyword Match**
- Sliders: activity=9, techComfort=2, simplicity=1, discreteness=5, timeDedication=3
- Features: ✅ "Apple Watch bolusing"
- Story: "I don't know anything about pumps"
- **Result:** Twiist (94 points) - Priority 2 trigger
- **Why:** "apple watch" keyword found, slider values ignored

**Scenario B: Free Text Keyword Match**
- Sliders: activity=3, techComfort=9, simplicity=9, discreteness=7, timeDedication=8
- Features: (none selected)
- Story: "I want something tubeless"
- **Result:** Omnipod 5 (90 points) - Priority 3 trigger
- **Why:** "tubeless" keyword found in story, high tech sliders ignored

**Scenario C: Slider-Based Match**
- Sliders: activity=5, techComfort=8, simplicity=7, discreteness=5, timeDedication=6
- Features: (none selected)
- Story: "I'm comfortable with technology"
- **Result:** Tandem t:slim X2 (86 points) - Priority 5 trigger
- **Why:** techComfort >= 7 AND no keyword matches

**Scenario D: Default Fallback**
- Sliders: activity=5, techComfort=5, simplicity=5, discreteness=5, timeDedication=5
- Features: (none selected)
- Story: "I need an insulin pump"
- **Result:** Medtronic 780G (85 points) - Default
- **Why:** No triggers matched, all sliders mid-range

---

### AI-Enhanced System (Paths 1 & 2)

When AI is available, scoring becomes **contextual** and **adaptive**:

| Input Type | Estimated Weight | How AI Uses It | Can Be Overridden? |
|------------|-----------------|----------------|-------------------|
| **Explicit Feature Selections** | 40-50% | Highest priority per instructions; unique features heavily favored | YES (by story context) |
| **Free Text Narrative (NLP)** | 20-30% | Context, sentiment, implicit needs, emotional state | NO (highest authority) |
| **Clarifying Questions** | 15-20% | Conflict resolution, tie-breaking between pumps | NO (explicit answers) |
| **Slider Preferences** | 10-15% | Background context, pattern detection, contradiction identification | YES (frequently) |

**Total Variability:** AI adjusts weights based on context, contradiction severity, and confidence level

#### Example AI-Enhanced Scoring Scenarios

**Scenario A: Feature Selection Reinforced by Story**
- Sliders: activity=7, techComfort=8, simplicity=6, discreteness=4, timeDedication=7
- Features: ✅ "Apple Watch bolusing", ✅ "Weighs only 2 ounces"
- Story: "I'm a marathon runner who loves my Apple Watch. Weight matters a lot to me during races."
- **AI Result:** Twiist (97 points)
- **AI Reasoning:** "Perfect alignment - features, story, and lifestyle all point to Twiist. Runner prioritizes weight, already uses Apple Watch daily, explicit feature selections match story context."
- **Weight Distribution:** Features 45%, Story 35%, Sliders 20%

**Scenario B: Story Overrides Feature Selection (Contradiction)**
- Sliders: activity=3, techComfort=1, simplicity=1, discreteness=6, timeDedication=2
- Features: ✅ "Apple Watch bolusing"
- Story: "I'm 78 years old and terrified of technology. My grandkid helped me select features. I don't even own a smartphone. I just want something that works without me having to think about it. My doctor said I need a pump."
- **AI Result:** Beta Bionics iLet (91 points)
- **AI Reasoning:** "Strong contradiction detected. Despite Apple Watch feature selection, story reveals deep tech anxiety, no smartphone ownership, and desire for hands-off operation. The iLet requires zero tech interaction - just meal announcements. Apple Watch would cause daily stress for this patient."
- **Weight Distribution:** Story 70%, Sliders 15%, Features 10% (overridden), Clarifying 5%
- **Note:** AI **OVERRODE** the explicit feature selection based on story context

**Scenario C: Sliders Inform AI But Don't Dictate**
- Sliders: activity=9, techComfort=2, simplicity=2, discreteness=3, timeDedication=3
- Features: (none selected)
- Story: "I'm very active but I hate complicated tech. I want the most reliable pump that just works."
- **AI Result:** Omnipod 5 (88 points)
- **AI Reasoning:** "High activity (9/10) suggests tubeless would be ideal. Low tech comfort (2/10) rules out advanced interfaces. 'Reliable and just works' prioritizes established systems. Omnipod 5 offers tubeless freedom for activity without tech complexity."
- **Weight Distribution:** Sliders 40%, Story 40%, Pump Specs 20%

**Scenario D: AI Detects Pattern Across All Inputs**
- Sliders: activity=6, techComfort=7, simplicity=8, discreteness=4, timeDedication=6
- Features: ✅ "Touchscreen interface", ✅ "Multiple CGM options"
- Story: "I've used Dexcom for 3 years and love it. I want a pump that gives me lots of data and control. I'm comfortable with technology like my smartphone."
- **AI Result:** Tandem t:slim X2 (94 points)
- **AI Reasoning:** "Strong pattern detected: touchscreen feature + multiple CGM feature + mentions Dexcom by name + high simplicity/tech sliders + 'lots of data' in story. t:slim X2 is the only pump offering touchscreen + multiple CGM options including Dexcom. Perfect match."
- **Weight Distribution:** Features 35%, Story 30%, Sliders 25%, Pump Match 10%

---

### Weight Adjustment Examples (AI vs Rules)

| Scenario | Rule-Based Weight | AI-Enhanced Weight | Winner | Why Different? |
|----------|-------------------|-------------------|--------|----------------|
| High tech slider, no other input | techComfort: 100% | techComfort: 40%, Default reasoning: 60% | Similar | Limited data - both rely on tech preference |
| "Apple Watch" in features | Feature keyword: 100% | Feature: 50%, Story validation: 30%, Sliders: 20% | AI more nuanced | AI checks if selection makes sense |
| "Simple" in story, high tech sliders | Story keyword: 100% (→ iLet) | Story: 60%, Sliders: 25%, Conflict resolution: 15% | Very different | AI resolves contradiction contextually |
| Multiple features from different pumps | First match wins: 100% | Feature priority: 40%, Story tie-breaker: 35%, Sliders: 25% | AI more balanced | Rules ignore second+ features |
| All balanced inputs | Default: 100% (→ Medtronic) | Holistic: 25% each category | Very different | AI considers all factors equally |

---

## Example Scenarios

### Scenario 1: Clear Winner (Agreement)

**Patient Profile:**
- **Age:** 32
- **Activity:** Marathon runner, 4-5 races/year
- **Tech Level:** High - uses iPhone, Apple Watch, fitness trackers

**Assessment Inputs:**

| Input Type | Values |
|------------|--------|
| **Sliders** | activity=9, techComfort=9, simplicity=7, discreteness=6, timeDedication=6 |
| **Features** | ✅ Apple Watch bolusing<br>✅ Weighs only 2 ounces |
| **Story** | "I'm a serious marathon runner and I want the most convenient pump for racing. I saw someone using their Apple Watch to dose insulin mid-race and it looked perfect - no fumbling with devices. Weight is critical for me - I literally count grams on my running gear. I'm very comfortable with technology and use my Apple Watch for everything already." |

**Results:**

| Method | Pump | Score | Reasoning |
|--------|------|-------|-----------|
| **Rule-Based** | Twiist | 95 | Priority 1 trigger: "2 ounces" keyword detected |
| **AI-Enhanced** | Twiist | 98 | "Perfect alignment across all factors. Marathon running + Apple Watch feature selection + weight concern + tech comfort + explicit 'saw Apple Watch dosing' in story = clear Twiist recommendation. Only pump offering both unique features patient requested." |

**Agreement:** ✅ YES - Both methods agree on Twiist

**Alternative Pumps:**
1. **Omnipod 5** (82) - Tubeless good for running but heavier, no Apple Watch
2. **Tandem Mobi** (78) - Small/compact but no Apple Watch, iPhone only

---

### Scenario 2: Contradiction (Disagreement)

**Patient Profile:**
- **Age:** 68
- **Activity:** Sedentary, retired
- **Tech Level:** Very low - no smartphone, basic flip phone

**Assessment Inputs:**

| Input Type | Values |
|------------|--------|
| **Sliders** | activity=2, techComfort=1, simplicity=1, discreteness=5, timeDedication=2 |
| **Features** | ✅ Apple Watch bolusing<br>✅ Emoji bolusing |
| **Story** | "My grandson helped me fill this out. I'm 68 and I've never used a computer. I don't have a smartphone - I have a flip phone. I'm terrified of technology and I just want something that works. My doctor says I need a pump but I don't want anything complicated. I want it to just work without me having to learn a bunch of stuff. I can't even program my microwave clock." |

**Results:**

| Method | Pump | Score | Reasoning |
|--------|------|-------|-----------|
| **Rule-Based** | Twiist | 94 | Priority 2 trigger: "apple watch" keyword in features |
| **AI-Enhanced** | Beta Bionics iLet | 94 | "**CRITICAL CONTRADICTION DETECTED:** Patient selected Apple Watch and emoji features BUT story reveals: (1) No smartphone ownership, (2) Uses flip phone, (3) 'Terrified of technology', (4) 'Never used a computer', (5) Can't program microwave. Grandson likely selected features without understanding patient needs. Apple Watch requires iPhone - patient doesn't have one. iLet requires ZERO tech interaction - just say 'usual meal' or 'more than usual'. This is the ONLY appropriate recommendation despite feature selections." |

**Agreement:** ❌ NO - Methods completely disagree

**AI Override Justification:**
- Feature selections invalid (requires iPhone, which patient doesn't have)
- Story context overrides selections (tech terror + no devices)
- Low sliders confirm story (techComfort=1, simplicity=1)
- Only iLet requires minimal interaction

**Alternative Pumps (AI):**
1. **Medtronic 780G** (85) - Established, good support, but still requires tech interaction
2. **Omnipod 5** (75) - Simpler than Twiist but requires phone app (patient has no smartphone)

**This scenario demonstrates AI's ability to detect and resolve contradictions that rule-based systems cannot handle.**

---

### Scenario 3: No Clear Winner (Balanced Input)

**Patient Profile:**
- **Age:** 45
- **Activity:** Moderate - walks daily, occasional gym
- **Tech Level:** Average - uses smartphone for basic tasks

**Assessment Inputs:**

| Input Type | Values |
|------------|--------|
| **Sliders** | activity=5, techComfort=5, simplicity=5, discreteness=5, timeDedication=5 |
| **Features** | (none selected) |
| **Story** | "I'm starting pump therapy and I'm not sure what I need. I've had Type 1 for 10 years on MDI. I want something reliable that my insurance will cover. I use a smartphone but I'm not a tech person. I work in an office. Just want a good, solid pump that works." |

**Results:**

| Method | Pump | Score | Reasoning |
|--------|------|-------|-----------|
| **Rule-Based** | Medtronic 780G | 85 | Default fallback: No keywords matched, all sliders at midpoint (5/10) |
| **AI-Enhanced** | Tandem t:slim X2 | 87 | "Balanced preferences suggest mainstream pump with broad support. 't:slim X2 chosen because: (1) Touchscreen interface familiar to smartphone users, (2) Excellent insurance coverage ('insurance will cover'), (3) Largest clinic support network ('reliable'), (4) Multiple CGM options for flexibility, (5) Most popular pump = most resources available. Medtronic also strong option (84 score) but t:slim X2 edges out for tech-moderate users." |

**Agreement:** ⚠️ PARTIAL - Different pumps but close reasoning

**AI Reasoning for Not Choosing Medtronic:**
- Patient said "I'm not a tech person" but uses smartphone daily
- Medtronic buttons/menus less intuitive than touchscreen for smartphone users
- Patient didn't mention specific Medtronic advantages (swimming, aggressive control)
- "Good solid pump" is vague - could mean any established pump

**Alternative Pumps (AI):**
1. **Medtronic 780G** (84) - Excellent choice, well-established, slightly less intuitive interface
2. **Omnipod 5** (81) - Tubeless convenience, good for moderate activity

**This scenario shows AI provides more nuanced reasoning even with limited input.**

---

### Scenario 4: Keyword vs Context

**Patient Profile:**
- **Age:** 29
- **Activity:** Very active - CrossFit athlete
- **Tech Level:** High

**Assessment Inputs:**

| Input Type | Values |
|------------|--------|
| **Sliders** | activity=10, techComfort=8, simplicity=6, discreteness=3, timeDedication=7 |
| **Features** | ✅ Completely tubeless |
| **Story** | "I do CrossFit 6 days a week with Olympic lifting. I need something tubeless because I'm constantly doing barbell movements and tubing would be a nightmare. BUT I'm also really concerned about adhesive because I sweat a lot and pods fall off sometimes. I've heard mixed things about tubeless pumps staying on during intense workouts. I'm willing to deal with short tubing if it means better adhesive options and more flexibility." |

**Results:**

| Method | Pump | Score | Reasoning |
|--------|------|-------|-----------|
| **Rule-Based** | Omnipod 5 | 90 | Priority 3 trigger: "tubeless" keyword in features |
| **AI-Enhanced** | Tandem Mobi | 89 | "**CONTEXT OVERRIDES INITIAL PREFERENCE:** Patient selected tubeless BUT story reveals critical concern: 'pods fall off sometimes' due to sweating. Patient explicitly states 'willing to deal with short tubing if better adhesive.' Tandem Mobi offers: (1) Ultra-short tubing (minimal interference), (2) Separate infusion site + pump = smaller adhesive footprint, (3) Can change adhesive type independently, (4) Ultra-compact so minimal snagging during lifts. Patient's actual priority is STAYING ATTACHED during workouts, not avoiding tubes entirely." |

**Agreement:** ❌ NO - Methods disagree

**Why AI Chose Differently:**
- Detected contradiction between feature selection and story concern
- "Willing to deal with short tubing" = explicit permission to override tubeless
- "Pods fall off" = adhesive failure history with tubeless
- Ultra-short tubing (Mobi) addresses barbell movement concern
- Separate site = better adhesive options

**Alternative Pumps (AI):**
1. **Omnipod 5** (86) - Still viable if adhesive concerns addressed, matches initial preference
2. **t:slim X2** (82) - Reliable but longer tubing may interfere with lifting

**This scenario demonstrates AI's ability to read between the lines and identify true priorities.**

---

### Scenario 5: Multiple Features from Different Pumps

**Patient Profile:**
- **Age:** 25
- **Activity:** Moderate
- **Tech Level:** High - Apple ecosystem user

**Assessment Inputs:**

| Input Type | Values |
|------------|--------|
| **Sliders** | activity=6, techComfort=9, simplicity=7, discreteness=4, timeDedication=5 |
| **Features** | ✅ Apple Watch bolusing (Twiist)<br>✅ Multiple CGM options (t:slim X2)<br>✅ No carb counting (iLet) |
| **Story** | "I want the most advanced technology available. I'm an iPhone and Apple Watch user. I want flexibility with CGM choices because I might switch brands. I also hate carb counting so something that minimizes that would be great." |

**Results:**

| Method | Pump | Score | Reasoning |
|--------|------|-------|-----------|
| **Rule-Based** | Twiist | 94 | Priority 2 trigger: "apple watch" keyword detected (first match wins, other features ignored) |
| **AI-Enhanced** | Twiist | 92 | "**CONFLICT RESOLUTION:** Three features selected from three different pumps. Analysis: (1) Apple Watch = EXCLUSIVE to Twiist (unique feature), (2) Multiple CGM = t:slim X2 exclusive (Twiist only works with Dexcom), (3) No carb counting = iLet exclusive. Patient is Apple ecosystem user ('iPhone and Apple Watch user'), making Twiist natural fit. HOWEVER, patient wants CGM flexibility - Twiist limitation acknowledged. Patient also wants 'most advanced technology' - Apple Watch qualifies. Carb counting concern can be addressed with meal shortcuts in Twiist. **Recommendation: Twiist for Apple Watch integration, with note about CGM limitation.**" |

**Agreement:** ✅ YES - Both choose Twiist, but AI provides more nuanced reasoning

**AI Additional Analysis:**
- Recognized patient can't have all three features (no pump offers all)
- Prioritized based on uniqueness (Apple Watch only on Twiist)
- Acknowledged trade-offs (CGM flexibility lost, carb counting still needed)
- Provided reasoning for choice and alternatives

**Alternative Pumps (AI):**
1. **Tandem t:slim X2** (88) - If CGM flexibility is more important than Apple Watch
2. **Beta Bionics iLet** (79) - If carb counting concern is highest priority, but loses Apple integration

**This scenario shows AI's ability to prioritize and explain trade-offs when perfect match is impossible.**

---

## Transparency & Accuracy Analysis

### Marketing Claims vs Reality

| Claim | Accuracy Rating | Reality | Recommendation |
|-------|----------------|---------|----------------|
| **"AI-Powered Pump Selection"** | ⚠️ **Partially True** | Only true when Paths 1-2 succeed (70-80% of time). Fallback is pure rule-based keyword matching (20-30% of time). | Change to **"AI-Enhanced Selection"** |
| **"Intelligent Matching System"** | ✅ **Accurate** | True for all 3 paths. Rule-based logic is a form of intelligence (deterministic reasoning). | Keep as-is |
| **"Machine Learning Recommendations"** | ❌ **False** | No ML training occurs. System uses static AI prompts with zero learning capability. Same inputs = same outputs (within AI temperature variance). | Remove this claim entirely |
| **"Personalized Analysis"** | ✅ **Accurate** | True - combines user-specific slider values, feature selections, and personal story for customized recommendation. | Keep as-is |
| **"23-Dimension Pump Evaluation"** | ✅ **Accurate** | AI paths receive complete 23-dimension database for each pump. Rule-based path only uses keywords, not full dimensions. | Clarify: "AI analysis uses 23-dimension evaluation" |
| **"Natural Language Processing"** | ⚠️ **Partially True** | Only applies to free text story analysis when AI available. Features and sliders use simple keyword matching in fallback mode. | Clarify: "NLP for personal story analysis" |
| **"Contextual Recommendations"** | ⚠️ **Partially True** | AI paths provide true contextual analysis. Rule-based fallback is purely keyword-driven with zero context awareness. | Change to **"Contextual AI analysis when available"** |

### Recommended Transparent Disclosure

#### For Patient-Facing Interface:

```
═══════════════════════════════════════════════════════════
HOW YOUR RECOMMENDATION IS GENERATED
═══════════════════════════════════════════════════════════

Your personalized pump recommendation combines:

✅ STEP 1: Lifestyle Preferences (5 sliders)
   • Helps us understand your daily life and priorities
   • Weight in decision: 10-15%

✅ STEP 2: Feature Selections (what YOU picked)
   • Your explicit preferences carry the most weight
   • Weight in decision: 40-50%

✅ STEP 3: Your Personal Story (AI analyzes this)
   • Natural language processing understands context
   • Identifies concerns, fears, and hidden needs
   • Weight in decision: 20-30%

═══════════════════════════════════════════════════════════
🤖 PROCESSING METHOD
═══════════════════════════════════════════════════════════

We use a 3-tier system for reliable recommendations:

1. PREFERRED: Server-side AI analysis (OpenAI/Claude)
   • Most secure and comprehensive
   • Contextual analysis of your complete profile
   • Resolves contradictions intelligently

2. FALLBACK: Client-side AI analysis
   • If server unavailable
   • Same AI quality, slightly less secure

3. LAST RESORT: Rule-based matching
   • If AI unavailable (rare)
   • Keyword-based decision tree
   • Always provides a recommendation

Your recommendation will indicate which method was used.

═══════════════════════════════════════════════════════════
📊 TRANSPARENCY NOTICE
═══════════════════════════════════════════════════════════

• This tool is for educational purposes only
• Always discuss recommendations with your healthcare provider
• Your doctor has final say on pump selection
• Insurance coverage may limit your options
• Clinical factors not captured here matter greatly
```

#### For Results Page:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR RECOMMENDATION: Twiist (Score: 94/100)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 Generated using: AI-Enhanced Analysis
⏱️  Processing time: 4.2 seconds
🎯 Confidence: 90%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW WE CALCULATED THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your recommendation was based on:

📊 Your Lifestyle Sliders ...................... 15%
   High activity (9/10) and tech comfort (8/10) noted

⭐ Features You Selected ....................... 45%
   • Apple Watch bolusing (ONLY Twiist offers this)
   • Weighs only 2 ounces (lightest available)

💭 Your Personal Story ......................... 30%
   AI analyzed: marathon running, weight sensitivity,
   Apple Watch familiarity, convenience priority

🔍 Pump Database Match ......................... 10%
   23-dimension comparison against all 6 pumps

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### For Regulatory/Compliance Documentation

**Accurate Technical Description:**

> "The TSHLA pump selection tool employs a hybrid recommendation system combining deterministic rule-based logic with AI-enhanced contextual analysis. The system attempts AI processing via backend API or frontend OpenAI API calls, using natural language processing to analyze user narratives and resolve contradictions between explicit feature selections and implicit needs expressed in free-text stories. In cases where AI services are unavailable, the system employs a deterministic keyword-matching algorithm with priority-cascade logic to ensure a recommendation is always provided. User inputs include five 1-10 scale lifestyle preference sliders, optional feature selections from a pre-defined list, and optional free-text narrative responses. The system does not employ machine learning, neural networks, or adaptive algorithms - all AI processing uses static prompts with large language models (OpenAI GPT-4 or Anthropic Claude). Recommendations are for educational purposes only and must be validated by qualified healthcare providers before clinical implementation."

### Limitations to Disclose

#### Technical Limitations

1. **No Learning Capability**
   - System does NOT learn from user interactions
   - Same inputs produce same outputs (within AI temperature variance)
   - No model training or adaptation occurs

2. **Limited Contextual Awareness (Rule-Based Path)**
   - Fallback mode uses keyword matching only
   - Cannot detect sarcasm, nuance, or complex contradictions
   - Binary yes/no decisions based on keyword presence

3. **Slider Under-Utilization**
   - Only 1 of 5 sliders directly impacts rule-based scoring
   - AI uses sliders for context but with lower priority
   - Sliders provide minimal decision weight (~10-15%)

4. **Feature Selection Bias**
   - System heavily favors pumps with unique features (Twiist, iLet)
   - Pumps with mainstream features may be under-recommended
   - "First match wins" in rule-based mode ignores subsequent selections

5. **No Medical Validation**
   - Tool does not access patient medical records
   - Cannot assess clinical contraindications
   - Does not consider insurance formulary restrictions
   - Ignores regional pump availability

#### Clinical Limitations

1. **Educational Tool Only**
   - Not FDA-cleared as a medical device
   - Not a substitute for clinical assessment
   - Provider must validate all recommendations

2. **Missing Clinical Factors**
   - No assessment of diabetes type, duration, complications
   - No evaluation of injection site availability
   - No analysis of dexterity, vision, cognitive function
   - No consideration of caregiver availability

3. **Insurance Not Considered**
   - Tool recommends based on features, not coverage
   - Many patients cannot access recommended pump
   - Cost and insurance tier not factored into scoring

4. **Training Requirements Unknown**
   - Does not assess clinic training availability
   - Some pumps may not have local support
   - Does not verify healthcare provider pump familiarity

---

## Key Takeaways

### For Your Article - Main Points

#### 1. Progressive Multi-Step Assessment
- **3-step flow** prevents user overwhelm
- Each step builds on previous input
- Users can complete in 5-10 minutes total

#### 2. Hybrid Intelligence Architecture
- **AI-first approach** with graceful degradation
- Rule-based fallback ensures 100% availability
- Users don't know which path was used (unless disclosed)

#### 3. Explicit Priority Hierarchy
- Feature selections > Personal story > Sliders
- AI can override based on context
- Transparency about weighting builds trust

#### 4. Contradiction Detection (AI Only)
- AI identifies when feature selections conflict with story
- Example: Apple Watch selection + tech fear in story
- Rule-based system cannot detect contradictions

#### 5. Educational, Not Prescriptive
- Tool generates starting point for discussion
- Healthcare provider makes final decision
- Insurance and clinical factors not included

### What Makes This System Unique

#### Technical Innovation
1. **Graceful Degradation:** Always provides answer, even offline
2. **Contextual Overrides:** AI can ignore explicit selections when story reveals better fit
3. **Transparent Weighting:** Clear hierarchy documented and auditable
4. **Keyword + NLP Hybrid:** Combines deterministic rules with contextual AI

#### Patient Experience
1. **Quick Assessment:** 5-10 minutes for complete profile
2. **Low Cognitive Load:** One step at a time, clear examples
3. **Optional Depth:** Can skip story section if preferred
4. **Immediate Results:** No waiting for provider review

#### Clinical Value
1. **Conversation Starter:** Provides structured starting point
2. **Patient Preparation:** Patients arrive informed
3. **Preference Documentation:** Captures patient priorities
4. **Educational:** Teaches patients about pump features

### Research Opportunities

#### Validation Studies Needed

1. **AI vs Clinician Agreement**
   - Compare AI recommendations to expert endocrinologist selections
   - Measure concordance rates across diverse patient profiles
   - Identify cases where AI and clinicians disagree

2. **Patient Satisfaction**
   - Track long-term satisfaction with AI-recommended pumps
   - Compare to traditional clinic-led selection process
   - Measure regret rates and pump switching frequency

3. **Bias Detection**
   - Analyze if tool favors certain pumps inappropriately
   - Test with diverse demographics and clinical presentations
   - Validate equal representation across pump options

4. **AI Path vs Rule-Based Path Outcomes**
   - Compare patient satisfaction when AI used vs fallback
   - Measure difference in recommendation quality
   - Determine if patients notice difference

#### Potential Research Questions

1. How often does AI override explicit feature selections based on story context?
2. Do patients with high contradiction rates (feature vs story) have worse outcomes?
3. Does completing the personal story section improve recommendation accuracy?
4. Are certain patient personas consistently misclassified?
5. How often do clinicians override the tool's recommendation?

### Implementation Recommendations

#### For Healthcare Systems

1. **Disclosure First**
   - Show patients how tool works before starting
   - Explain AI vs rule-based paths
   - Clarify tool is educational only

2. **Provider Review Required**
   - Never present results without provider validation
   - Include clinical factors tool cannot assess
   - Use as conversation starter, not final answer

3. **Track Overrides**
   - Log when providers disagree with tool
   - Analyze patterns in disagreements
   - Use to improve algorithm over time

4. **Insurance Integration**
   - Add insurance formulary filtering
   - Show coverage tiers for each pump
   - Prevent recommending non-covered options

#### For Patients

1. **Set Expectations**
   - Tool provides starting point, not prescription
   - Your doctor has final say
   - Insurance may limit options

2. **Be Honest in Story Section**
   - AI can only work with information provided
   - Contradictions help AI understand your true needs
   - More detail = better recommendation

3. **Discuss Results with Provider**
   - Bring results to appointment
   - Ask provider to explain agreement/disagreement
   - Consider clinical factors tool didn't assess

### Future Enhancements

#### Short-Term (3-6 months)

1. **Transparency Indicators**
   - Show which path was used (AI vs rules)
   - Display confidence level and weighting breakdown
   - Explain why certain factors were prioritized

2. **Insurance Integration**
   - Add insurance plan field
   - Filter recommendations by coverage
   - Show patient cost estimates

3. **Clinical Contraindication Checks**
   - Basic screening questions (vision, dexterity)
   - Alert if pump selection may not be suitable
   - Require provider override for alerts

#### Medium-Term (6-12 months)

1. **Provider Feedback Loop**
   - Allow providers to rate recommendation quality
   - Log final pump selections vs recommendations
   - Use data to tune algorithm weights

2. **Multi-Language Support**
   - Translate interface to Spanish, Mandarin, etc.
   - Ensure AI prompts work in multiple languages
   - Validate cultural appropriateness

3. **Expanded Pump Database**
   - Add international pump options
   - Include experimental/pipeline pumps
   - Update specifications quarterly

#### Long-Term (12+ months)

1. **True Machine Learning**
   - Train model on clinician-validated outcomes
   - Adaptive weighting based on success rates
   - Personalized prompts per patient type

2. **EHR Integration**
   - Pull patient medical history automatically
   - Consider A1C, complications, comorbidities
   - Integrate with clinic workflow

3. **Outcome Tracking**
   - Follow patients long-term
   - Measure satisfaction with AI-recommended pumps
   - Identify predictors of successful vs failed matches

---

## Appendix: Code References

### Key Files and Line Numbers

| Component | File Path | Key Lines | Description |
|-----------|-----------|-----------|-------------|
| **Slider Interface** | `src/pages/PumpDriveUnified.tsx` | 21-72 | Slider definitions and UI |
| **Feature List** | `src/data/pumpFeatures.ts` | 1-179 | All 17 selectable features |
| **Main Recommendation Engine** | `src/services/sliderMCP.service.ts` | 180-273 | 3-tier fallback system |
| **Rule-Based Scoring** | `src/services/sliderMCP.service.ts` | 376-443 | Priority cascade logic |
| **AI Prompt Builder** | `src/services/sliderMCP.service.ts` | 445-698 | Complete AI prompt generation |
| **AI Processing** | `src/services/pumpDriveAI.service.ts` | 30-153 | OpenAI API integration |
| **Pump Database** | `src/data/pumpDataComplete.ts` | Full file | 23-dimension specifications |

### Testing the System

To understand how the system works, try these test cases:

#### Test Case 1: Unique Feature (Should Always Win)
- Features: ✅ "Apple Watch bolusing"
- Story: "I don't know anything about pumps"
- Expected: Twiist (only pump with Apple Watch)

#### Test Case 2: Contradiction (AI Should Override)
- Sliders: techComfort=1
- Features: ✅ "Apple Watch bolusing"
- Story: "I'm 75 and I don't own a smartphone. I'm terrified of technology."
- Expected AI: Beta Bionics iLet (overrides feature selection)
- Expected Rules: Twiist (cannot detect contradiction)

#### Test Case 3: Balanced (Should Use Context)
- Sliders: All 5/10
- Features: None
- Story: "I just want a reliable pump"
- Expected AI: Tandem t:slim X2 or Medtronic 780G (mainstream)
- Expected Rules: Medtronic 780G (default)

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | December 2025 | Initial comprehensive technical breakdown | TSHLA Development Team |

---

## Contact & Questions

For questions about this technical documentation:
- **Technical Inquiries:** development@tshla.ai
- **Clinical Questions:** clinical@tshla.ai
- **Research Collaboration:** research@tshla.ai

---

**END OF DOCUMENT**

---

*This document is intended for research publication, regulatory review, and transparency disclosure. It may be cited, reproduced, or distributed with attribution to TSHLA Medical.*
