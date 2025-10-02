/**
 * Test Persona-Based Pump Recommendations
 * Compare with feature-based approach
 */

import { pumpPersonaEngine } from './pumpPersonaEngine.service';
import { pumpRecommendationUnifiedService } from './pumpRecommendationUnified.service';

// Test scenarios for each persona
const PERSONA_TESTS = [
  {
    name: 'Tech Enthusiast Test',
    personaId: 'tech_enthusiast',
    dealBreakers: {},
    expectedTopPumps: ['Twiist', 't:slim X2', 'Tandem Mobi'],
  },
  {
    name: 'Simplicity Seeker Test',
    personaId: 'simplicity_seeker',
    dealBreakers: {},
    expectedTopPumps: ['Beta Bionics iLet', 'Medtronic 780G'],
  },
  {
    name: 'Active Adventurer Test',
    personaId: 'active_lifestyle',
    dealBreakers: { waterproof_requirement: 'yes_waterproof' },
    expectedTopPumps: ['Omnipod 5'],
  },
  {
    name: 'Control Perfectionist Test',
    personaId: 'control_perfectionist',
    dealBreakers: {},
    expectedTopPumps: ['Medtronic 780G', 't:slim X2'],
  },
  {
    name: 'Tubeless Deal-breaker Test',
    personaId: 'active_lifestyle',
    dealBreakers: { tubeless_requirement: 'yes_tubeless' },
    expectedTopPumps: ['Omnipod 5'], // Only tubeless pump
  },
];

console.log('🧪 Testing Persona-Based Pump Recommendations\n');

// Test individual personas
for (const test of PERSONA_TESTS) {
  console.log(`📋 ${test.name}`);

  try {
    const result = pumpPersonaEngine.getPersonaRecommendations(test.personaId, test.dealBreakers);

    if (result.recommendations.length === 0) {
      console.log('   ⚠️  No recommendations (all eliminated)');
      if (result.eliminated.length > 0) {
        console.log(`   🚫 Eliminated: ${result.eliminated.join(', ')}`);
      }
    } else {
      const topPump = result.recommendations[0];
      console.log(`   🏆 Top Choice: ${topPump.pump.name} (${topPump.matchScore}%)`);
      console.log(
        `   📊 Alternatives: ${result.recommendations
          .slice(1, 3)
          .map(r => `${r.pump.name} (${r.matchScore}%)`)
          .join(', ')}`
      );
      console.log(`   💡 Reason: ${topPump.reason}`);

      // Validate expected results
      const topPumpName = topPump.pump.name;
      const isExpected = test.expectedTopPumps.some(
        expected => topPumpName.includes(expected) || expected.includes(topPumpName)
      );

      if (isExpected) {
        console.log(`   ✅ Expected result confirmed`);
      } else {
        console.log(`   ⚠️  Unexpected result - expected: ${test.expectedTopPumps.join(' or ')}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
  }

  console.log('');
}

// Test bias across all personas
console.log('🔍 Testing Distribution Across All Personas\n');

const pumpCounts = new Map<string, number>();
const totalTests = PERSONA_TESTS.length;

for (const test of PERSONA_TESTS) {
  try {
    const result = pumpPersonaEngine.getPersonaRecommendations(test.personaId, test.dealBreakers);

    if (result.recommendations.length > 0) {
      const topPump = result.recommendations[0].pump.name;
      pumpCounts.set(topPump, (pumpCounts.get(topPump) || 0) + 1);
    }
  } catch (error) {
    console.warn(`Skipping ${test.name} due to error: ${error}`);
  }
}

console.log('   📊 Persona Distribution Results:');
const sortedResults = Array.from(pumpCounts.entries()).sort((a, b) => b[1] - a[1]);

for (const [pump, count] of sortedResults) {
  const percentage = ((count / totalTests) * 100).toFixed(1);
  console.log(`   ${pump}: ${count}/${totalTests} wins (${percentage}%)`);
}

// Check for extreme bias
const totalWins = Array.from(pumpCounts.values()).reduce((a, b) => a + b, 0);
const topPumpCount = sortedResults[0]?.[1] || 0;
const expectedAverage = totalWins / sortedResults.length;

if (topPumpCount > expectedAverage * 2) {
  console.log(
    `\n   ⚠️  Possible bias: ${sortedResults[0][0]} wins ${((topPumpCount / totalWins) * 100).toFixed(1)}% of persona tests`
  );
} else {
  console.log(
    `\n   ✅ Good distribution: Top pump wins ${((topPumpCount / totalWins) * 100).toFixed(1)}% (expected ~${(100 / sortedResults.length).toFixed(1)}%)`
  );
}

// Test unified service
console.log('\n🔗 Testing Unified Service\n');

const unifiedTests = [
  {
    name: 'Natural Language Test',
    request: {
      userDescription:
        'I love technology and want full smartphone control with detailed data analysis',
    },
  },
  {
    name: 'Direct Persona Test',
    request: {
      selectedPersona: 'active_lifestyle',
      dealBreakers: { waterproof_requirement: 'yes_waterproof' },
    },
  },
];

for (const test of unifiedTests) {
  console.log(`📋 ${test.name}`);

  try {
    const result = await pumpRecommendationUnifiedService.getRecommendations(test.request);

    console.log(
      `   🏆 Top Choice: ${result.topRecommendation.name} (${result.topRecommendation.score}%)`
    );
    console.log(`   🎯 Approach: ${result.methodology.approach}`);
    console.log(`   🎪 Confidence: ${result.confidence}%`);
    if (result.topRecommendation.personaMatch) {
      console.log(`   👤 Persona: ${result.topRecommendation.personaMatch}`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
  }

  console.log('');
}

console.log('✅ Persona-based testing completed!');
