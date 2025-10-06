/**
 * AI-Powered Pump Recommendation Engine
 * Replaces AWS Bedrock with OpenAI
 * Cost: ~$0.039 per patient
 * Created: 2025-10-06
 */

/**
 * STAGE 1: Initialize all pumps at baseline 40%
 */
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

/**
 * STAGE 2: Apply slider adjustments (±12%)
 * Includes BOTH positive boosts and negative penalties
 */
function applySliderAdjustments(scores, sliders) {
  const {
    activity = 5,
    techComfort = 5,
    simplicity = 5,
    discreteness = 5,
    timeDedication = 5
  } = sliders;

  console.log('Applying slider adjustments:', { activity, techComfort, simplicity, discreteness, timeDedication });

  // Activity Level (1-10)
  if (activity >= 7) {
    // Very active
    scores['Tandem t:slim X2'] += 6;
    scores['Tandem Mobi'] += 4;
    scores['Omnipod 5'] += 3;
    scores['Twiist'] += 5;
    scores['Medtronic 780G'] -= 3;
    scores['Beta Bionics iLet'] -= 2;
  } else if (activity <= 3) {
    // Sedentary
    scores['Medtronic 780G'] += 3;
    scores['Omnipod 5'] += 2;
    scores['Beta Bionics iLet'] += 1;
  }

  // Tech Comfort (1-10)
  if (techComfort <= 3) {
    // Low tech
    scores['Omnipod 5'] += 8;
    scores['Beta Bionics iLet'] += 10;
    scores['Tandem t:slim X2'] -= 5;
    scores['Tandem Mobi'] -= 4;
    scores['Medtronic 780G'] -= 3;
    scores['Twiist'] -= 3;
  } else if (techComfort >= 7) {
    // High tech
    scores['Tandem t:slim X2'] += 8;
    scores['Tandem Mobi'] += 7;
    scores['Twiist'] += 6;
    scores['Medtronic 780G'] += 3;
    scores['Omnipod 5'] -= 2;
    scores['Beta Bionics iLet'] -= 4;
  } else {
    // Moderate tech (4-6)
    scores['Medtronic 780G'] += 2;
    scores['Beta Bionics iLet'] += 2;
  }

  // Simplicity Preference (1-10)
  if (simplicity >= 7) {
    // Want simple
    scores['Beta Bionics iLet'] += 12;
    scores['Omnipod 5'] += 8;
    scores['Tandem t:slim X2'] -= 4;
    scores['Tandem Mobi'] -= 3;
    scores['Medtronic 780G'] -= 2;
    scores['Twiist'] -= 2;
  } else if (simplicity <= 3) {
    // Want complex/features
    scores['Tandem t:slim X2'] += 5;
    scores['Twiist'] += 4;
    scores['Tandem Mobi'] += 3;
    scores['Medtronic 780G'] += 2;
    scores['Beta Bionics iLet'] -= 3;
    scores['Omnipod 5'] -= 1;
  }

  // Discreteness (1-10)
  if (discreteness >= 7) {
    // Very discreet
    scores['Tandem Mobi'] += 12;
    scores['Omnipod 5'] += 8;
    scores['Twiist'] += 7;
    scores['Medtronic 780G'] -= 6;
    scores['Beta Bionics iLet'] -= 3;
    scores['Tandem t:slim X2'] -= 2;
  } else if (discreteness <= 3) {
    // Don't care about discretion
    scores['Medtronic 780G'] += 1;
  }

  // Time Dedication (1-10)
  if (timeDedication <= 4) {
    // Low time
    scores['Beta Bionics iLet'] += 10;
    scores['Omnipod 5'] += 5;
    scores['Medtronic 780G'] += 3;
    scores['Tandem t:slim X2'] -= 2;
    scores['Tandem Mobi'] -= 1;
    scores['Twiist'] -= 1;
  } else if (timeDedication >= 8) {
    // High time (willing to tinker)
    scores['Tandem t:slim X2'] += 4;
    scores['Tandem Mobi'] += 3;
    scores['Twiist'] += 3;
    scores['Medtronic 780G'] += 2;
    scores['Beta Bionics iLet'] -= 5;
    scores['Omnipod 5'] -= 2;
  }

  return scores;
}

/**
 * STAGE 3: Apply feature preference adjustments (±8%)
 * Includes BOTH boosts and penalties
 */
function applyFeatureAdjustments(scores, selectedFeatures) {
  if (!selectedFeatures || selectedFeatures.length === 0) {
    console.log('No features selected, skipping feature adjustments');
    return scores;
  }

  console.log('Applying feature adjustments for', selectedFeatures.length, 'features');

  const FEATURE_IMPACT = {
    // Power & Charging
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
    },

    // Controls & Interface
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
    },

    // Size & Wearability
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
    },

    // Smart Automation
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
    },

    // Daily Convenience
    'multiple-cgm-options': {
      boosts: { 'Tandem t:slim X2': 8, 'Omnipod 5': 6, 'Beta Bionics iLet': 4 },
      penalties: { 'Tandem Mobi': -2 }
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

    // Innovation
    'emoji-bolusing': {
      boosts: { 'Twiist': 12 },
      penalties: { 'Medtronic 780G': -2 }
    }
  };

  selectedFeatures.forEach(feature => {
    const featureId = typeof feature === 'string' ? feature : feature.id;
    const impact = FEATURE_IMPACT[featureId];

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

/**
 * STAGE 4: AI-powered free text analysis (0-25%)
 * Uses OpenAI to extract semantic intent, not just keywords
 */
async function analyzeFreeTextWithAI(openai, freeText, model) {
  if (!freeText || freeText.trim().length < 10) {
    console.log('Free text too short, skipping AI analysis');
    return {
      extractedIntents: [],
      pumpScores: {
        'Medtronic 780G': { points: 0, reasoning: 'No free text provided' },
        'Tandem t:slim X2': { points: 0, reasoning: 'No free text provided' },
        'Tandem Mobi': { points: 0, reasoning: 'No free text provided' },
        'Omnipod 5': { points: 0, reasoning: 'No free text provided' },
        'Beta Bionics iLet': { points: 0, reasoning: 'No free text provided' },
        'Twiist': { points: 0, reasoning: 'No free text provided' }
      },
      dimensionsCovered: [],
      dimensionsMissing: Array.from({ length: 23 }, (_, i) => i + 1)
    };
  }

  console.log('Analyzing free text with AI (model:', model, ')...');

  const prompt = `You are an expert at understanding patient needs for insulin pumps. Extract TRUE INTENTIONS from patient free text, not just keywords.

PATIENT'S FREE TEXT:
"${freeText}"

YOUR TASK:
1. Extract all relevant needs/desires/pain points (focus on INTENT, not exact keywords)
2. Map each need to specific pump dimensions (1-23)
3. Score each pump (0-25 points) based on how well it addresses ALL extracted needs
4. Provide clear reasoning

23 PUMP DIMENSIONS:
1. Battery & power  2. Phone control  3. Tubing preference  4. Automation  5. CGM compatibility
6. Target adjustability  7. Exercise modes  8. Bolus workflow  9. Reservoir capacity  10. Adhesive tolerance
11. Water resistance  12. Alerts  13. User interface  14. Data sharing  15. Clinic support
16. Travel  17. Pediatric features  18. Discretion  19. Ecosystem  20. Reliability
21. Cost & insurance  22. Comfort  23. Updates

PUMP STRENGTHS:
- Medtronic 780G: AA batteries, most aggressive control (100%), 12ft submersible, 300 units, button interface, keep insulin on occlusion
- Tandem t:slim X2: Touchscreen, phone bolusing, multiple CGMs, exercise modes, remote bolus, frequent updates, loaner program
- Tandem Mobi: SMALLEST pump, pocket-sized, iPhone-only, wireless charging, short tubing, 8ft water, very discreet
- Omnipod 5: COMPLETELY TUBELESS, never charge, 8ft waterproof, phone OR controller (iOS/Android), simple interface, multiple wear sites
- Beta Bionics iLet: NO CARB COUNTING, meal announcements, hands-off automation, minimal alerts (4 only), 15-min charge, simple for kids
- Twiist: Apple Watch bolusing, LIGHTEST (2oz), emoji interface, Tidepool, automatic OTA, circular design, innovative

SCORING RULES:
- Perfect fit: +5 to +8 points
- Good fit: +3 to +5 points
- Mentioned: +1 to +2 points
- Not relevant: 0 points
- MAXIMUM per pump: +25 points

EXAMPLES:
"I love to swim" → Intent: Daily swimming (Dim 11) → Medtronic +8 (12ft), Omnipod +7 (tubeless in water), Mobi +5
"Carb counting exhausts me" → Intent: Carb burnout (Dim 8) → iLet +8 (no carbs), others +1
"For my teenager" → Intent: Pediatric/caregiver (Dim 17) → t:slim +8 (remote bolus), iLet +7 (simple)

OUTPUT (JSON):
{
  "extractedIntents": [
    {"intent": "string", "dimensions": [numbers], "confidence": "high|medium|low"}
  ],
  "pumpScores": {
    "Medtronic 780G": {"points": 0-25, "reasoning": "string"},
    "Tandem t:slim X2": {"points": 0-25, "reasoning": "string"},
    "Tandem Mobi": {"points": 0-25, "reasoning": "string"},
    "Omnipod 5": {"points": 0-25, "reasoning": "string"},
    "Beta Bionics iLet": {"points": 0-25, "reasoning": "string"},
    "Twiist": {"points": 0-25, "reasoning": "string"}
  },
  "dimensionsCovered": [numbers],
  "dimensionsMissing": [numbers]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You extract patient intent from free text and map to insulin pump features. Focus on MEANING not exact keywords.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error in AI free text analysis:', error);
    // Return empty analysis on error
    return {
      extractedIntents: [],
      pumpScores: Object.fromEntries(
        ['Medtronic 780G', 'Tandem t:slim X2', 'Tandem Mobi', 'Omnipod 5', 'Beta Bionics iLet', 'Twiist']
          .map(pump => [pump, { points: 0, reasoning: 'AI analysis failed' }])
      ),
      dimensionsCovered: [],
      dimensionsMissing: Array.from({ length: 23 }, (_, i) => i + 1)
    };
  }
}

function applyFreeTextBoosts(scores, aiAnalysis) {
  Object.entries(aiAnalysis.pumpScores).forEach(([pump, data]) => {
    const boost = Math.min(data.points, 25); // Cap at +25
    scores[pump] += boost;
    console.log(`  ${pump}: +${boost}% (${data.reasoning.substring(0, 60)}...)`);
  });

  return scores;
}

/**
 * Stage 5: Analyze Context 7 follow-up questions with AI (±5%)
 */
async function analyzeContext7WithAI(openai, currentScores, context7Answers, model) {
  try {
    const sortedPumps = Object.entries(currentScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Top 3 pumps

    const prompt = `You are analyzing follow-up questions (Context 7) to refine insulin pump recommendations.

CURRENT TOP 3 PUMPS:
${sortedPumps.map(([name, score]) => `${name}: ${score.toFixed(1)}%`).join('\n')}

CONTEXT 7 ANSWERS:
${JSON.stringify(context7Answers, null, 2)}

TASK: Analyze the Context 7 answers and determine small adjustments (±5% max) to pump scores based on:
1. Insurance coverage preferences
2. Support network availability
3. Lifestyle compatibility details
4. Technology integration needs
5. Long-term commitment considerations

Return JSON with this exact structure:
{
  "adjustments": {
    "Medtronic 780G": 2.5,
    "Tandem t:slim X2": -1,
    ...
  },
  "reasoning": "Brief explanation of why adjustments were made"
}`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: 'You are an expert insulin pump analyst providing precise scoring adjustments.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    console.log('Stage 5 Context 7 Analysis:', analysis);
    return analysis;

  } catch (error) {
    console.error('Error in Context 7 analysis:', error);
    return { adjustments: {}, reasoning: 'Context 7 analysis skipped due to error' };
  }
}

/**
 * Stage 5 Helper: Apply Context 7 adjustments
 */
function applyContext7Adjustments(scores, context7Analysis) {
  const adjustments = context7Analysis.adjustments || {};

  Object.keys(scores).forEach(pumpName => {
    if (adjustments[pumpName]) {
      const adjustment = Math.max(-5, Math.min(5, adjustments[pumpName])); // Cap at ±5
      scores[pumpName] += adjustment;
      console.log(`Context 7 adjustment for ${pumpName}: ${adjustment > 0 ? '+' : ''}${adjustment.toFixed(1)}%`);
    }
  });

  return scores;
}

/**
 * Stage 6: Final AI Analysis - Deep reasoning for top choice(s) (+20%)
 */
async function performFinalAIAnalysis(openai, currentScores, userData, freeTextAnalysis, context7Analysis, model) {
  try {
    const sortedPumps = Object.entries(currentScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Top 3 for consideration

    const scoreDiff = sortedPumps[0][1] - sortedPumps[1][1];
    const isClose = scoreDiff < 5; // If top 2 are within 5%, need careful analysis

    const prompt = `You are performing FINAL ANALYSIS for insulin pump recommendation.

CURRENT TOP 3 PUMPS (after Stages 1-5):
${sortedPumps.map(([name, score]) => `${name}: ${score.toFixed(1)}%`).join('\n')}

PATIENT DATA:
- Sliders: ${JSON.stringify(userData.sliders || {})}
- Selected Features: ${JSON.stringify(userData.features || [])}
- Free Text: ${userData.freeText?.currentSituation || 'None'}

PREVIOUS AI ANALYSIS:
- Free Text Intents: ${JSON.stringify(freeTextAnalysis.extractedIntents || [])}
${context7Analysis ? `- Context 7 Reasoning: ${context7Analysis.reasoning}` : ''}

SCORE DIFFERENCE: ${scoreDiff.toFixed(1)}% ${isClose ? '(CLOSE - careful analysis needed)' : '(CLEAR leader)'}

TASK: Perform comprehensive final analysis to determine:
1. Is the current #1 choice truly the best fit? (holistic review)
2. Should we boost #1 by +20% to show strong confidence?
3. OR should we boost #2 instead if it's actually better aligned?
4. Provide final personalized insights for the patient

SCORING RULES:
- Award +20% boost to the SINGLE best choice
- If scores are close (<5%), carefully consider all factors
- If #1 is clearly best, boost #1
- If #2 is actually better fit despite lower score, boost #2 instead
- Only ONE pump gets the +20% boost

Return JSON with this exact structure:
{
  "topChoicePump": "Pump Name",
  "boostAmount": 20,
  "confidence": "high|medium|low",
  "finalInsights": "Comprehensive personalized explanation (2-3 sentences)",
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "reasoning": "Why this pump received the final boost"
}`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: 'You are an expert diabetes educator making final pump recommendations with deep clinical reasoning.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4, // Slightly higher for nuanced reasoning
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    console.log('Stage 6 Final AI Analysis:', analysis);
    return {
      ...analysis,
      topChoiceBoost: analysis.boostAmount || 20
    };

  } catch (error) {
    console.error('Error in final AI analysis:', error);
    // Default: boost the current top pump
    const topPump = Object.entries(currentScores).sort((a, b) => b[1] - a[1])[0];
    return {
      topChoicePump: topPump[0],
      topChoiceBoost: 20,
      confidence: 'medium',
      finalInsights: 'Based on your comprehensive profile, this pump is the best match for your needs.',
      keyStrengths: ['Good overall fit', 'Aligns with preferences'],
      reasoning: 'Default boost due to analysis error'
    };
  }
}

/**
 * Stage 6 Helper: Apply final AI boost
 */
function applyFinalAIBoosts(scores, finalAnalysis) {
  const topChoice = finalAnalysis.topChoicePump;
  const boost = finalAnalysis.topChoiceBoost || 20;

  if (scores[topChoice] !== undefined) {
    scores[topChoice] += boost;
    console.log(`Final AI boost for ${topChoice}: +${boost}%`);
  } else {
    console.warn(`Warning: Final AI selected pump "${topChoice}" not found in scores`);
  }

  return scores;
}

/**
 * Main recommendation engine - orchestrates all stages
 */
async function generatePumpRecommendationsOpenAI(openai, models, userData) {
  console.log('=== Starting AI-Powered Pump Recommendation ===');
  const startTime = Date.now();

  try {
    // Stage 1: Initialize all pumps at 40%
    let scores = initializeScores();
    console.log('Stage 1 (Baseline):', scores);

    // Stage 2: Apply slider adjustments (±12%)
    scores = applySliderAdjustments(scores, userData.sliders || {});
    console.log('Stage 2 (Sliders):', scores);

    // Stage 3: Apply feature adjustments (±8%)
    scores = applyFeatureAdjustments(scores, userData.features || []);
    console.log('Stage 3 (Features):', scores);

    // Stage 4: AI-powered free text analysis (+25% max)
    const freeTextAnalysis = await analyzeFreeTextWithAI(
      openai,
      userData.freeText?.currentSituation || '',
      models.freeText
    );
    scores = applyFreeTextBoosts(scores, freeTextAnalysis);
    console.log('Stage 4 (Free Text):', scores);

    // Stage 5: Context 7 follow-up questions (±5%)
    let context7Analysis = null;
    if (userData.context7Answers && Object.keys(userData.context7Answers).length > 0) {
      context7Analysis = await analyzeContext7WithAI(openai, scores, userData.context7Answers, models.context7);
      scores = applyContext7Adjustments(scores, context7Analysis);
      console.log('Stage 5 (Context 7):', scores);
    } else {
      console.log('Stage 5 (Context 7): Skipped - no data provided');
    }

    // Stage 6: Final AI Analysis (+20% to top choice)
    const finalAnalysis = await performFinalAIAnalysis(openai, scores, userData, freeTextAnalysis, context7Analysis, models.finalAnalysis);
    scores = applyFinalAIBoosts(scores, finalAnalysis);
    console.log('Stage 6 (Final AI):', scores);

    // Format response
    const sortedScores = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([name, score]) => ({
        pumpName: name,
        score: Math.min(Math.max(score, 10), 100), // Cap between 10-100
        reasons: getReasons(name, freeTextAnalysis)
      }));

    const result = {
      overallTop: [sortedScores[0]],
      alternatives: sortedScores.slice(1, 4),
      keyFactors: extractKeyFactors(freeTextAnalysis, userData),
      personalizedInsights: finalAnalysis.finalInsights || generateInsights(sortedScores[0], freeTextAnalysis, finalAnalysis),
      freeTextAnalysis: freeTextAnalysis, // Include for debugging
      context7Analysis: context7Analysis, // Include for debugging
      finalAnalysis: finalAnalysis // Include for debugging
    };

    const duration = Date.now() - startTime;
    console.log(`=== Recommendation Complete in ${duration}ms ===`);
    console.log('Top choice:', result.overallTop[0].pumpName, '@', result.overallTop[0].score + '%');

    return result;

  } catch (error) {
    console.error('Error in AI recommendation engine:', error);
    // Fallback to basic scoring
    return {
      overallTop: [{
        pumpName: 'Omnipod 5',
        score: 75,
        reasons: ['System default recommendation', 'Popular choice for most patients']
      }],
      alternatives: [],
      keyFactors: ['System error - using default recommendation'],
      personalizedInsights: 'We encountered an error. Please try again.',
      error: error.message
    };
  }
}

/**
 * Helper: Get reasons for a pump based on analysis
 */
function getReasons(pumpName, freeTextAnalysis) {
  const pumpScore = freeTextAnalysis.pumpScores[pumpName];
  if (pumpScore && pumpScore.reasoning) {
    return [pumpScore.reasoning];
  }

  // Default reasons per pump
  const defaultReasons = {
    'Medtronic 780G': ['Aggressive automation', 'AA battery convenience', 'Best water resistance'],
    'Tandem t:slim X2': ['Touchscreen interface', 'Multiple CGM options', 'Advanced features'],
    'Tandem Mobi': ['Smallest pump available', 'Very discreet', 'iPhone integration'],
    'Omnipod 5': ['Completely tubeless', 'No charging needed', 'Simple to use'],
    'Beta Bionics iLet': ['No carb counting required', 'Minimal alerts', 'Hands-off automation'],
    'Twiist': ['Apple Watch control', 'Lightest pump', 'Most innovative']
  };

  return defaultReasons[pumpName] || ['Good overall option'];
}

/**
 * Helper: Extract key factors from analysis
 */
function extractKeyFactors(freeTextAnalysis, userData) {
  const factors = [];

  if (freeTextAnalysis.extractedIntents && freeTextAnalysis.extractedIntents.length > 0) {
    freeTextAnalysis.extractedIntents.forEach(intent => {
      factors.push(intent.intent);
    });
  }

  // Add from sliders
  const sliders = userData.sliders || {};
  if (sliders.activity >= 7) factors.push('Active lifestyle');
  if (sliders.techComfort <= 3) factors.push('Low tech comfort');
  if (sliders.simplicity >= 7) factors.push('Simplicity preference');
  if (sliders.discreteness >= 7) factors.push('Discretion important');
  if (sliders.timeDedication <= 4) factors.push('Minimal time dedication');

  return factors.length > 0 ? factors : ['Your lifestyle preferences', 'Ease of use', 'Technology comfort'];
}

/**
 * Helper: Generate personalized insights
 */
function generateInsights(topChoice, freeTextAnalysis, finalAnalysis) {
  const { pumpName, score } = topChoice;

  // Prefer final AI insights if available
  if (finalAnalysis && finalAnalysis.finalInsights) {
    return finalAnalysis.finalInsights;
  }

  // Fallback to free text analysis
  const analysis = freeTextAnalysis.pumpScores[pumpName];

  let insight = `Based on your preferences, the ${pumpName} is an excellent match at ${score}% compatibility. `;

  if (analysis && analysis.reasoning) {
    insight += analysis.reasoning;
  } else {
    insight += `This pump aligns well with your stated needs and lifestyle requirements.`;
  }

  return insight;
}

module.exports = {
  generatePumpRecommendationsOpenAI
};
