/**
 * Test script for pump recommendation engine
 * Tests all 6 pumps can reach 100%
 */

require('dotenv').config();
const OpenAI = require('openai');
const pumpEngine = require('./server/pump-recommendation-engine-ai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY
});

const OPENAI_MODELS = {
  freeText: process.env.VITE_OPENAI_MODEL_STAGE4 || 'gpt-4o-mini',
  context7: process.env.VITE_OPENAI_MODEL_STAGE5 || 'gpt-4o',
  finalAnalysis: process.env.VITE_OPENAI_MODEL_STAGE6 || 'gpt-4o'
};

// Test case 1: Medtronic 780G
const medtronicProfile = {
  sliders: {
    activity: 8,
    techComfort: 7,
    simplicity: 3,
    discreteness: 3,
    timeDedication: 4
  },
  features: [
    { id: 'aa-battery-power', title: 'AA Battery Power' },
    { id: 'aggressive-control', title: 'Aggressive Automation' },
    { id: 'fully-submersible', title: 'Fully Submersible' }
  ],
  freeText: {
    currentSituation: "I need the most aggressive automation with tight control - I want 100% correction doses. I am a competitive swimmer and dive regularly up to 12 feet deep. I travel internationally for work and love that I can swap AA batteries anywhere. When I have an occlusion I want to keep the insulin and not waste it."
  }
};

// Test case 2: Tandem t:slim X2
const tsimProfile = {
  sliders: {
    activity: 9,
    techComfort: 9,
    simplicity: 5,
    discreteness: 6,
    timeDedication: 6
  },
  features: [
    { id: 'touchscreen-control', title: 'Touchscreen Control' },
    { id: 'multiple-cgm-options', title: 'Multiple CGM Options' },
    { id: 'phone-bolusing', title: 'Phone Bolusing' }
  ],
  freeText: {
    currentSituation: "I'm extremely tech-savvy and love the modern touchscreen interface. I'm very active - gym daily, exercise regularly, play sports. I need multiple CGM options because I switch between Dexcom G7 and Libre. For my teenager, remote bolus via Tandem Source is a must. Love the t:connect platform with frequent updates."
  }
};

// Test case 3: Tandem Mobi
const mobiProfile = {
  sliders: {
    activity: 8,
    techComfort: 8,
    simplicity: 6,
    discreteness: 10,
    timeDedication: 6
  },
  features: [
    { id: 'ultra-small-size', title: 'Ultra Small Size' },
    { id: 'iphone-only-control', title: 'iPhone Only Control' },
    { id: 'wireless-charging', title: 'Wireless Charging' }
  ],
  freeText: {
    currentSituation: "I want the smallest, tiniest, most discreet pump that fits in my pocket. I'm an iPhone user and love that it's completely controlled by my iPhone. Wireless charging is perfect. The pump is so lightweight and comfortable I forget I'm wearing it."
  }
};

// Test case 4: Omnipod 5
const omnipodProfile = {
  sliders: {
    activity: 7,
    techComfort: 4,
    simplicity: 9,
    discreteness: 9,
    timeDedication: 8
  },
  features: [
    { id: 'completely-tubeless', title: 'Completely Tubeless' },
    { id: 'no-charging-needed', title: 'No Charging Needed' },
    { id: 'waterproof-pod', title: 'Waterproof Pod' }
  ],
  freeText: {
    currentSituation: "I absolutely need a tubeless pump with no tubing at all - complete freedom. I'm not tech-savvy and want something simple and easy. I love that there's no charging ever. It's fully waterproof so I can swim without disconnecting. I can wear it on my arm or stomach."
  }
};

// Test case 5: Beta Bionics iLet
const iLetProfile = {
  sliders: {
    activity: 4,
    techComfort: 3,
    simplicity: 10,
    discreteness: 5,
    timeDedication: 10
  },
  features: [
    { id: 'no-carb-counting', title: 'No Carb Counting' },
    { id: 'simple-meal-announcements', title: 'Simple Meal Announcements' },
    { id: 'minimal-alerts', title: 'Minimal Alerts' }
  ],
  freeText: {
    currentSituation: "I am completely burned out on carb counting - I want to skip carbs entirely. The meal announcements with simple meal sizes are life-changing. I have terrible alarm fatigue - I need minimal alarms. This is for my child and needs to be simple for kids. I want hands-off automation."
  }
};

// Test case 6: Twiist
const twiistProfile = {
  sliders: {
    activity: 8,
    techComfort: 9,
    simplicity: 6,
    discreteness: 9,
    timeDedication: 6
  },
  features: [
    { id: 'apple-watch-bolusing', title: 'Apple Watch Bolusing' },
    { id: 'ultra-lightweight', title: 'Ultra Lightweight' },
    { id: 'emoji-bolusing', title: 'Emoji Bolusing' }
  ],
  freeText: {
    currentSituation: "I want the most innovative pump with Apple Watch bolusing - dosing from my wrist is game-changing. It's the lightest pump at 2 ounces - I barely feel it. The emoji interface is perfect. Tidepool integration so 15 family members can follow is great. Love automatic OTA updates."
  }
};

// Run tests
async function runTests() {
  console.log('='.repeat(80));
  console.log('TESTING ALL 6 PUMPS CAN REACH 100%');
  console.log('='.repeat(80));
  console.log('');

  const tests = [
    { name: 'Medtronic 780G', profile: medtronicProfile, expectedTop: 'Medtronic 780G' },
    { name: 'Tandem t:slim X2', profile: tsimProfile, expectedTop: 'Tandem t:slim X2' },
    { name: 'Tandem Mobi', profile: mobiProfile, expectedTop: 'Tandem Mobi' },
    { name: 'Omnipod 5', profile: omnipodProfile, expectedTop: 'Omnipod 5' },
    { name: 'Beta Bionics iLet', profile: iLetProfile, expectedTop: 'Beta Bionics iLet' },
    { name: 'Twiist', profile: twiistProfile, expectedTop: 'Twiist' }
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`TEST: ${test.name}`);
    console.log(`${'─'.repeat(80)}`);

    try {
      const result = await pumpEngine.generatePumpRecommendationsOpenAI(
        openai,
        OPENAI_MODELS,
        test.profile
      );

      const topPump = result.overallTop[0];
      const score = topPump.score;
      const isCorrectPump = topPump.pumpName === test.expectedTop;
      const reached100 = score >= 100;

      console.log(`\n✓ Top Recommendation: ${topPump.pumpName}`);
      console.log(`✓ Score: ${score}%`);
      console.log(`✓ Expected: ${test.expectedTop}`);
      console.log(`✓ Match: ${isCorrectPump ? '✅ YES' : '❌ NO'}`);
      console.log(`✓ Reached 100%: ${reached100 ? '✅ YES' : '❌ NO (only ' + score + '%)'}`);
      console.log(`\nReasons:`);
      topPump.reasons.forEach((reason, i) => {
        console.log(`  ${i + 1}. ${reason}`);
      });

      console.log(`\nTop 3 Scores:`);
      [result.overallTop[0], ...result.alternatives.slice(0, 2)].forEach((pump, i) => {
        console.log(`  ${i + 1}. ${pump.pumpName}: ${pump.score}%`);
      });

      results.push({
        pump: test.name,
        topPump: topPump.pumpName,
        score,
        isCorrectPump,
        reached100,
        passed: isCorrectPump && reached100
      });

    } catch (error) {
      console.error(`❌ ERROR:`, error.message);
      results.push({
        pump: test.name,
        error: error.message,
        passed: false
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('');

  results.forEach(r => {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    const details = r.error
      ? `Error: ${r.error}`
      : `${r.topPump} @ ${r.score}% (expected ${r.pump})`;
    console.log(`${status} | ${r.pump.padEnd(25)} | ${details}`);
  });

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log('');
  console.log(`Results: ${passedCount}/${totalCount} tests passed`);

  if (passedCount === totalCount) {
    console.log('');
    console.log('🎉 SUCCESS! All 6 pumps can reach 100%!');
  } else {
    console.log('');
    console.log('⚠️ Some tests failed. Review the results above.');
  }

  console.log('');
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
