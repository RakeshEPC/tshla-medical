/**
 * Simple Test for Persona-Based Pump Recommendations
 * No external dependencies
 */

import { pumpPersonaEngine } from './pumpPersonaEngine.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

// Test scenarios for each persona
const PERSONA_TESTS = [
  {
    name: 'Tech Enthusiast Test',
    personaId: 'tech_enthusiast',
    dealBreakers: {},
    expectedTopPumps: ['Twiist', 't:slim X2', 'Tandem Mobi']
  },
  {
    name: 'Simplicity Seeker Test', 
    personaId: 'simplicity_seeker',
    dealBreakers: {},
    expectedTopPumps: ['Beta Bionics iLet', 'Medtronic 780G']
  },
  {
    name: 'Active Adventurer Test',
    personaId: 'active_lifestyle',
    dealBreakers: { waterproof_requirement: 'yes_waterproof' },
    expectedTopPumps: ['Omnipod 5']
  },
  {
    name: 'Control Perfectionist Test',
    personaId: 'control_perfectionist', 
    dealBreakers: {},
    expectedTopPumps: ['Medtronic 780G', 't:slim X2']
  },
  {
    name: 'Tubeless Deal-breaker Test',
    personaId: 'active_lifestyle',
    dealBreakers: { tubeless_requirement: 'yes_tubeless' },
    expectedTopPumps: ['Omnipod 5'] // Only tubeless pump
  },
  {
    name: 'Parent/Caregiver Test',
    personaId: 'parent_caregiver',
    dealBreakers: {},
    expectedTopPumps: ['Omnipod 5', 'Medtronic 780G']
  }
];

logDebug('pumpPersona.simple-test', 'Debug message', {});

// Test individual personas
for (const test of PERSONA_TESTS) {
  logInfo('pumpPersona.simple-test', 'Info message', {});
  
  try {
    const result = pumpPersonaEngine.getPersonaRecommendations(
      test.personaId, 
      test.dealBreakers
    );
    
    if (result.recommendations.length === 0) {
      logDebug('pumpPersona.simple-test', 'Debug message', {});
      if (result.eliminated.length > 0) {
        logDebug('pumpPersona.simple-test', 'Debug message', {});}`);
      }
    } else {
      const topPump = result.recommendations[0];
      logDebug('pumpPersona.simple-test', 'Debug message', {});
      logDebug('pumpPersona.simple-test', 'Debug message', {});`).join(', ')}`);
      logDebug('pumpPersona.simple-test', 'Debug message', {});
      
      // Validate expected results
      const topPumpName = topPump.pump.name;
      const isExpected = test.expectedTopPumps.some(expected => 
        topPumpName.includes(expected) || expected.includes(topPumpName)
      );
      
      if (isExpected) {
        logDebug('pumpPersona.simple-test', 'Debug message', {});
      } else {
        logDebug('pumpPersona.simple-test', 'Debug message', {});}`);
      }
    }
    
  } catch (error) {
    logError('pumpPersona.simple-test', 'Error message', {});
  }
  
  logDebug('pumpPersona.simple-test', 'Debug output', { data: data: "placeholder" });
}

// Test bias across all personas
logDebug('pumpPersona.simple-test', 'Debug message', {});

const pumpCounts = new Map<string, number>();
const totalTests = PERSONA_TESTS.length;

for (const test of PERSONA_TESTS) {
  try {
    const result = pumpPersonaEngine.getPersonaRecommendations(
      test.personaId,
      test.dealBreakers
    );
    
    if (result.recommendations.length > 0) {
      const topPump = result.recommendations[0].pump.name;
      pumpCounts.set(topPump, (pumpCounts.get(topPump) || 0) + 1);
    }
  } catch (error) {
    logWarn('pumpPersona.simple-test', 'Warning message', {});
  }
}

logDebug('pumpPersona.simple-test', 'Debug message', {});
const sortedResults = Array.from(pumpCounts.entries())
  .sort((a, b) => b[1] - a[1]);

for (const [pump, count] of sortedResults) {
  const percentage = ((count / totalTests) * 100).toFixed(1);
  logDebug('pumpPersona.simple-test', 'Debug message', {});
}

// Check for extreme bias
const totalWins = Array.from(pumpCounts.values()).reduce((a, b) => a + b, 0);
const topPumpCount = sortedResults[0]?.[1] || 0;
const expectedAverage = totalWins / sortedResults.length;

if (topPumpCount > expectedAverage * 2) {
  logDebug('pumpPersona.simple-test', 'Debug message', {});
} else {
  logDebug('pumpPersona.simple-test', 'Debug message', {});
}

// Test keyword matching
logDebug('pumpPersona.simple-test', 'Debug message', {});

const keywordTests = [
  {
    keywords: ['technology', 'app', 'smartphone', 'data'],
    expectedPersona: 'tech_enthusiast'
  },
  {
    keywords: ['simple', 'easy', 'minimal', 'basic'],
    expectedPersona: 'simplicity_seeker'
  },
  {
    keywords: ['active', 'swimming', 'sports', 'exercise'],
    expectedPersona: 'active_lifestyle'
  },
  {
    keywords: ['control', 'precision', 'tight', 'data'],
    expectedPersona: 'control_perfectionist'
  }
];

for (const test of keywordTests) {
  const detectedPersona = pumpPersonaEngine.findBestPersona(test.keywords);
  
  if (detectedPersona) {
    logDebug('pumpPersona.simple-test', 'Debug message', {});}] → ${detectedPersona.name}`);
    
    if (detectedPersona.id === test.expectedPersona) {
      logDebug('pumpPersona.simple-test', 'Debug message', {});
    } else {
      logDebug('pumpPersona.simple-test', 'Debug message', {});
    }
  } else {
    logDebug('pumpPersona.simple-test', 'Debug message', {});}] → No persona match found`);
  }
}

// Show all available personas
logDebug('pumpPersona.simple-test', 'Debug message', {});
const allPersonas = pumpPersonaEngine.getAllPersonas();
for (const persona of allPersonas) {
  logDebug('pumpPersona.simple-test', 'Debug message', {});
  logDebug('pumpPersona.simple-test', 'Debug message', {});
  logDebug('pumpPersona.simple-test', 'Debug message', {});}`);
  logDebug('pumpPersona.simple-test', 'Debug message', {});}\n`);
}

logInfo('pumpPersona.simple-test', 'Info message', {});