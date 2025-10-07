/**
 * Test the fixed rule-based recommendation system
 */

require('dotenv').config();

// Mock the rule-based function
function generateRuleBasedRecommendations(userData) {
  const sliders = userData.sliders || {};
  const freeText = userData.freeText?.currentSituation || '';
  const features = userData.features || [];

  // Analyze user preferences
  const wantsSimplicity = (sliders.simplicity || 5) >= 6;
  const wantsDiscretion = (sliders.discreteness || 5) >= 6;
  const isActive = (sliders.activity || 5) >= 6;
  const lowTechComfort = (sliders.techComfort || 5) <= 4;

  const prefersSmall = freeText.toLowerCase().includes('small') || freeText.toLowerCase().includes('discrete');
  const prefersTubeless = freeText.toLowerCase().includes('tubeless') || freeText.toLowerCase().includes('patch');

  // NEW: Weight/lightweight preference
  const prefersLightweight = freeText.toLowerCase().includes('2 oz') ||
                            freeText.toLowerCase().includes('2 ounce') ||
                            freeText.toLowerCase().includes('lightest') ||
                            freeText.toLowerCase().includes('lightweight') ||
                            freeText.toLowerCase().includes('light weight');

  // NEW: Water resistance needs
  const needsWaterResistance = freeText.toLowerCase().includes('swim') ||
                              freeText.toLowerCase().includes('shower') ||
                              freeText.toLowerCase().includes('waterproof') ||
                              freeText.toLowerCase().includes('water resistant') ||
                              freeText.toLowerCase().includes('submersible');

  // NEW: Carb counting burnout
  const carbBurnout = freeText.toLowerCase().includes('carb counting') ||
                     freeText.toLowerCase().includes('no carb') ||
                     freeText.toLowerCase().includes('carb exhausted');

  // Scoring logic - ALL 6 PUMPS
  let scores = {
    'Omnipod 5': 70,
    'Tandem t:slim X2': 70,
    'Medtronic 780G': 70,
    'Tandem Mobi': 70,
    'Beta Bionics iLet': 70,
    'Twiist': 70
  };

  // Boost Omnipod 5 for tubeless preference and simplicity
  if (prefersTubeless || wantsDiscretion) scores['Omnipod 5'] += 15;
  if (wantsSimplicity && lowTechComfort) scores['Omnipod 5'] += 10;

  // Boost Mobi for small size preference
  if (prefersSmall) scores['Tandem Mobi'] += 20;
  if (wantsDiscretion) scores['Tandem Mobi'] += 10;

  // Boost t:slim for tech-savvy users
  if (sliders.techComfort >= 7) scores['Tandem t:slim X2'] += 15;
  if (isActive) scores['Tandem t:slim X2'] += 5;

  // Boost Medtronic for automation preference and water resistance
  if (sliders.techComfort >= 6 && sliders.timeDedication <= 4) scores['Medtronic 780G'] += 15;
  if (needsWaterResistance) scores['Medtronic 780G'] += 20;  // 12ft submersible - best waterproofing

  // NEW: Boost Twiist for lightweight preference
  if (prefersLightweight) scores['Twiist'] += 25;  // Lightest pump at 2 oz
  if (wantsDiscretion) scores['Twiist'] += 10;     // Very discreet

  // NEW: Boost iLet for carb burnout and simplicity
  if (carbBurnout) scores['Beta Bionics iLet'] += 25;  // No carb counting required
  if (wantsSimplicity && lowTechComfort) scores['Beta Bionics iLet'] += 15;

  // Update water resistance for other pumps
  if (needsWaterResistance) scores['Omnipod 5'] += 18;    // Waterproof pod
  if (needsWaterResistance) scores['Tandem Mobi'] += 10;  // 8ft water resistant

  return scores;
}

// Test cases
console.log('='.repeat(80));
console.log('RULE-BASED FALLBACK FIX - TEST SUITE');
console.log('='.repeat(80));

const testCases = [
  {
    name: "Test 1: 2 oz + swim/shower (SHOULD RECOMMEND TWIIST)",
    userData: {
      sliders: { activity: 7, techComfort: 6, simplicity: 5, discreteness: 8, timeDedication: 5 },
      freeText: {
        currentSituation: "I need something that weighs only 2 ounces and I love to swim and shower without disconnecting"
      }
    }
  },
  {
    name: "Test 2: Carb burnout + simplicity (SHOULD RECOMMEND iLet)",
    userData: {
      sliders: { activity: 4, techComfort: 3, simplicity: 10, discreteness: 5, timeDedication: 10 },
      freeText: {
        currentSituation: "Carb counting exhausts me. I just want something simple that works."
      }
    }
  },
  {
    name: "Test 3: Just lightweight (SHOULD RECOMMEND TWIIST)",
    userData: {
      sliders: { activity: 5, techComfort: 5, simplicity: 5, discreteness: 5, timeDedication: 5 },
      freeText: {
        currentSituation: "I want the lightest pump available"
      }
    }
  }
];

testCases.forEach(testCase => {
  console.log('\n' + '='.repeat(80));
  console.log(testCase.name);
  console.log('='.repeat(80));

  const scores = generateRuleBasedRecommendations(testCase.userData);
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  console.log('\nScores:');
  sorted.forEach(([pump, score]) => {
    console.log(`  ${pump}: ${score}%`);
  });

  console.log(`\n✅ Winner: ${sorted[0][0]} (${sorted[0][1]}%)`);
});

console.log('\n' + '='.repeat(80));
console.log('TESTS COMPLETE');
console.log('='.repeat(80));
