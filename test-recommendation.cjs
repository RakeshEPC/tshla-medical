/**
 * Test script for OpenAI pump recommendation engine
 * Run: node test-recommendation.js
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

// Test cases
const testCases = [
  {
    name: "Test 1: Active + Discreet + iPhone (Should favor Tandem Mobi or Omnipod 5)",
    userData: {
      sliders: {
        activity: 8,
        techComfort: 7,
        simplicity: 6,
        discreteness: 10,
        timeDedication: 6
      },
      features: ["completely-tubeless", "iphone-integration", "small-discreet"],
      freeText: {
        currentSituation: "I love being active and need something super discreet that works with my iPhone. I swim almost every day and want the smallest pump possible."
      }
    }
  },
  {
    name: "Test 2: Carb Burnout + Simplicity (Should favor Beta Bionics iLet)",
    userData: {
      sliders: {
        activity: 4,
        techComfort: 3,
        simplicity: 10,
        discreteness: 5,
        timeDedication: 10
      },
      features: ["no-carb-counting", "aggressive-automation", "simplicity-over-control"],
      freeText: {
        currentSituation: "Carb counting exhausts me. I just want something that works automatically without me having to think about it all the time. Minimal alerts please!"
      }
    }
  },
  {
    name: "Test 3: Tech Savvy + Active + CGM Flexibility (Should favor Tandem t:slim X2)",
    userData: {
      sliders: {
        activity: 8,
        techComfort: 9,
        simplicity: 5,
        discreteness: 6,
        timeDedication: 6
      },
      features: ["multiple-cgm-options", "activity-features", "iphone-integration"],
      freeText: {
        currentSituation: "I'm very tech-savvy and active. I want the most advanced pump with lots of customization options and the ability to use different CGMs."
      }
    }
  }
];

async function runTests() {
  console.log('='.repeat(80));
  console.log('OPENAI PUMP RECOMMENDATION ENGINE - TEST SUITE');
  console.log('='.repeat(80));
  console.log('\nModels configured:');
  console.log('  - Free Text (Stage 4):', OPENAI_MODELS.freeText);
  console.log('  - Context 7 (Stage 5):', OPENAI_MODELS.context7);
  console.log('  - Final Analysis (Stage 6):', OPENAI_MODELS.finalAnalysis);
  console.log('\n');

  for (const testCase of testCases) {
    console.log('\n' + '='.repeat(80));
    console.log(testCase.name);
    console.log('='.repeat(80));

    try {
      const startTime = Date.now();
      const result = await pumpEngine.generatePumpRecommendationsOpenAI(
        openai,
        OPENAI_MODELS,
        testCase.userData
      );
      const duration = Date.now() - startTime;

      console.log('\n✅ SUCCESS!');
      console.log(`Duration: ${duration}ms`);
      console.log('\nTop Recommendation:');
      console.log(`  Pump: ${result.overallTop[0].pumpName}`);
      console.log(`  Score: ${result.overallTop[0].score}%`);
      console.log(`  Reasons: ${result.overallTop[0].reasons.join(', ')}`);

      console.log('\nAlternatives:');
      result.alternatives.forEach((alt, idx) => {
        console.log(`  ${idx + 1}. ${alt.pumpName} (${alt.score}%)`);
      });

      console.log('\nKey Factors:', result.keyFactors.join(', '));
      console.log('\nPersonalized Insights:');
      console.log(`  ${result.personalizedInsights}`);

      if (result.finalAnalysis) {
        console.log('\nFinal AI Analysis:');
        console.log(`  Confidence: ${result.finalAnalysis.confidence}`);
        console.log(`  Key Strengths: ${result.finalAnalysis.keyStrengths?.join(', ')}`);
      }

    } catch (error) {
      console.error('\n❌ ERROR:', error.message);
      console.error(error.stack);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('ALL TESTS COMPLETE');
  console.log('='.repeat(80));
}

// Run tests
runTests().then(() => {
  console.log('\nTest suite finished. Press Ctrl+C to exit.');
  process.exit(0);
}).catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
